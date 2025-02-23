import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    getDoc,
    query,
    where,
    getFirestore
  } from "firebase/firestore";

import app from "../config/firebase_config.js";
const db = getFirestore(app);

const tableBody = document.getElementById("table_body");
const statusSelect = document.getElementById("status_select");
const searchBar = document.getElementById("search-bar");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
const editFormContainer = document.createElement("div");
editFormContainer.id = "edit-form-container";
editFormContainer.style.display = "none";
document.body.appendChild(editFormContainer);

let currentPage = 1;
const rowsPerPage = 5;
let projectList = [];

async function fetch_projects(filter = {}) {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_projects"));
        projectList = [];
        let projectIdList = []; // Store project IDs separately

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const projectId = data.project_id; // Store project_id in a variable
            projectIdList.push(projectId); // Push to projectIdList

            const searchTerm = filter.search?.toLowerCase();
            const matchesSearch = searchTerm
                ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
                  `${data.farm_president || ""}`.toLowerCase().includes(searchTerm) ||
                  (data.start_date || "").includes(searchTerm) ||
                  (data.end_date || "").includes(searchTerm) ||
                  (data.crop_type_name || "").toLowerCase().includes(searchTerm) ||
                  (data.status || "").toLowerCase().includes(searchTerm)
                : true;

            const matchesStatus = filter.status
                ? (data.status || "").toLowerCase() === filter.status.toLowerCase()
                : true;

            if (matchesSearch && matchesStatus) {
                projectList.push({ project_id: projectId, ...data });
            }
        });

        // Sort by start_date, then by end_date if start_date is the same
        projectList.sort((a, b) => {
            const startA = a.start_date ? new Date(a.start_date) : new Date(0);
            const startB = b.start_date ? new Date(b.start_date) : new Date(0);
            const endA = a.end_date ? new Date(a.end_date) : new Date(0);
            const endB = b.end_date ? new Date(b.end_date) : new Date(0);

            // First, sort by start_date
            if (startA - startB !== 0) {
                return startA - startB;
            }

            // If start_date is the same, sort by end_date
            return endA - endB;
        });

        console.log("Project IDs:", projectIdList); // Debugging: Log all project IDs

        currentPage = 1;
        updateTable();
        updatePagination();
    } catch (error) {
        console.error("Error Fetching User Accounts:", error);
    }
}


// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name){
    const formattedProjectName = project_name ? capitalizeWords(project_name): "";
    return `${formattedProjectName}`.trim();
}
function formatFarmPresident(farm_president){
    const formattedFarmPresident = farm_president ? capitalizeWords(farm_president): "";
    return `${formattedFarmPresident}`.trim();
}
function formatCrop(crop_type_name){
    const formattedCrop = crop_type_name ? capitalizeWords(crop_type_name): "";
    return `${formattedCrop}`.trim();
}
function formatStatus(status) {
    const formattedStatus = status ? capitalizeWords(status): "";
    return `${formattedStatus}`.trim();
}

//  <------------- TABLE DISPLAY AND UPDATE ------------->
function updateTable() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = projectList.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5">No records found.</td></tr>`;
    }

    pageData.forEach((data) => {
        const row = document.createElement("tr");
        const formattedProjectName = formatProjectName(data.project_name);
        const formattedFarmPresident = formatFarmPresident(data.farm_president);
        const formattedCrop = formatCrop(data.crop_type_name);
        const formattedStatus = formatStatus(data.status);
        //yung projectid papalitan ng progress bar
        row.innerHTML = `
            <td>${formattedProjectName || "Project Name not recorded"}</td>
            <td>${formattedFarmPresident || "Farm President not recorded"}</td>
            <td>${data.start_date || "Start Date not recorded"}</td>
            <td>${data.end_date || "End Date not recorded"}</td>
            <td>${formattedCrop || "Crop not recorded"}</td>
            <td>${data.project_id || "Project Progress not recorded"}</td>
            <td>${formattedStatus || "Status not recorded"}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${data.project_id}" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn view-btn" data-id="${data.project_id}" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(projectList.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    updatePaginationButtons();
}


function updatePaginationButtons() {
    const totalPages = Math.ceil(projectList.length / rowsPerPage);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}


function changePage(direction) {
    const totalPages = Math.ceil(projectList.length / rowsPerPage);
    if (direction === "prev" && currentPage > 1) {
        currentPage--;
    } else if (direction === "next" && currentPage < totalPages) {
        currentPage++;
    }
    updateTable();
    updatePagination();
}

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    const project_id = target.getAttribute("data-id");

    if (target.classList.contains("edit-btn")) {
        editUserAccount(project_id);
    } else if (target.classList.contains("view-btn")) {
        viewUserAccount(project_id);
    } else if (target.classList.contains("delete-btn")) {
        deleteUserAccount(project_id);
    }
});

// <------------- EDIT BUTTON CODE ------------->
async function editUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", project_id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                localStorage.setItem("userData", JSON.stringify(userData));
                window.location.href = "admin_projects_edit.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.error("Error fetching user data for edit:", error);
    }
}

// <------------- VIEW BUTTON CODE ------------->
async function viewUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", project_id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                localStorage.setItem("userData", JSON.stringify(userData));
                window.location.href = "admin_users_view.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.log("Error fetching user data for view:", error);
    }
}

// <------------- DELETE BUTTON EVENT LISTENER ------------->
async function deleteUserAccount(project_id) {
    try {

        const q = query(collection(db, "tb_projects"), where("project_id", "==", project_id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            confirmationPanel.style.display = "flex";
            editFormContainer.style.pointerEvents = "none";
        } else {
            showDeleteMessage("No project_id is found, Unable to proceed with the deleting the record", false);
        }
    } catch (error) {
        console.log("Error deleting User Account:", error);
    }
}

// <------------- DELETE ROW AND TABLE REFRESH CODE ------------->
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;
const deleteMessage = document.getElementById("delete-message");

confirmDeleteButton.addEventListener("click", async () => {
    if (selectedRowId) {
        try {

            const userDocRef = doc(db, "tb_projects", selectedRowId);
            await deleteDoc(userDocRef);
            console.log("Record deleted successfully!");

            fetch_projects();

            deleteMessage.style.display = "block";
            setTimeout(() => {
                deleteMessage.style.opacity = "1";
                setTimeout(() => {
                    deleteMessage.style.opacity = "0";
                    setTimeout(() => {
                        deleteMessage.style.display = "none";
                    }, 300);
                }, 3000);
            }, 0);
        } catch (error) {
            console.error("Error deleting record:", error);
        }
    }

    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
});

cancelDeleteButton.addEventListener("click", () => {
    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
});

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", () => {
    fetch_projects({
        search: searchBar.value,
        status: statusSelect.value,
    });
});

statusSelect.addEventListener("change", () => {
    fetch_projects({
        search: searchBar.value,
        status: statusSelect.value,
    });
});

prevPageBtn.addEventListener("click", () => changePage('prev'));
nextPageBtn.addEventListener("click", () => changePage('next'));

// <----------------------- STATUS DROP DOWN CODE ----------------------->
async function fetch_status() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_projects"));

        let addedStatus = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let statusName = data.status ? data.status.toUpperCase() : "";

            // Case-insensitive check by converting all stored values to uppercase
            if (!addedStatus.includes(statusName)) {
                addedStatus.push(statusName);

                const option = document.createElement("option");
                option.value = statusName;
                option.textContent = statusName;
                statusSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error Fetching Status:", error);
    }
}


// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE and ERROR MESSAGES ------------------------>
function showDeleteMessage(message, success) {
    deleteMessage.textContent = message;
    deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
    deleteMessage.style.opacity = '1';
    deleteMessage.style.display = 'block';

    setTimeout(() => {
        deleteMessage.style.opacity = '0';
        setTimeout(() => {
            deleteMessage.style.display = 'none'; 
        }, 400);
    }, 4000); 
}

fetch_projects();
fetch_status();