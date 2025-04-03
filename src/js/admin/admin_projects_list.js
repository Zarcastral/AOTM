import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    getDoc,
    query,
    where,
    getFirestore
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();
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

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
                    const userSnapshot = await getDocs(userQuery);

                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        console.log("Authenticated user data:", userData); // Debugging line
                        resolve(userData.user_type); // Return ONLY user_type
                    } else {
                        console.error("User record not found in tb_users collection.");
                        reject("User record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching user_name:", error);
                    reject(error);
                }
            } else {
                console.error("User not authenticated. Please log in.");
                reject("User not authenticated.");
            }
        });
    });
}

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
            const projectId = String(data.project_id || ""); // Convert to string
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

        // Sort by start_date in descending order, then by end_date in descending order if start_date is the same
        projectList.sort((a, b) => {
            const startA = a.start_date ? new Date(a.start_date) : new Date(0);
            const startB = b.start_date ? new Date(b.start_date) : new Date(0);
            const endA = a.end_date ? new Date(a.end_date) : new Date(0);
            const endB = b.end_date ? new Date(b.end_date) : new Date(0);

            // First, sort by start_date in descending order
            if (startB - startA !== 0) {  // Reversed subtraction for descending order
                return startB - startA;    // Latest start_date first
            }

            // If start_date is the same, sort by end_date in descending order
            return endB - endA;            // Latest end_date first
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




// <------------------ FUNCTION TO LOG PROJECT DETAILS TO CONSOLE ------------------------>
function logProjectDetails() {
    console.log("----- PROJECT DETAILS -----");
    projectList.forEach((project, index) => {
        console.log(`Project #${index + 1}:`, {
            ID: project.project_id,
            Name: project.project_name,
            President: project.farm_president,
            Dates: `${project.start_date} - ${project.end_date}`,
            Crop: project.crop_type_name,
            Status: project.status,
            Progress: "KUNWARI MAY PROGRESS BAR" // Replace with actual progress data if available
        });
    });
    console.log("---------------------------");
}

logProjectDetails();





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
            <td>KUNWARI MAY PROGRESS BAR</td>
            <td>${formattedStatus || "Status not recorded"}</td>
            <td>
                <button class="action-btn view-btn" data-id="${data.project_id}" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
                <button class="action-btn edit-btn" data-id="${data.project_id}" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn delete-btn" data-id="${data.project_id}" title="View">
                    <img src="../../images/delete.png" alt="View">
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
    console.log("Clicked Button - Project ID:", project_id); // Debugging

    if (target.classList.contains("edit-btn")) {
        editUserAccount(project_id);
    } else if (target.classList.contains("view-btn")) {
        viewUserAccount(project_id);
    } else if (target.classList.contains("delete-btn")) {
        deleteProjects(project_id);
    }
});

// <------------- EDIT BUTTON CODE ------------->
async function editUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const projectData = doc.data();

                // Convert status to lowercase and check if it is "ongoing"
                if (projectData.status && projectData.status.toLowerCase() === "ongoing") {
                    showDeleteMessage("Editing is not allowed for ongoing projects.", false);
                    return;
                }

                // Allow editing if not "ongoing"
                localStorage.setItem("projectData", JSON.stringify(projectData));
                window.location.href = "admin_projects_edit.html";
            });
        } else {
            showDeleteMessage("No matching record found, unable to proceed with the requested action.", false);
        }
    } catch (error) {
        console.error("Error fetching user data for edit:", error);
    }
}

// <------------- VIEW BUTTON CODE ------------->
function viewUserAccount(projectId) {
    sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10)); // Convert to integer
    window.location.href = "viewproject.html"; // Redirect to viewproject.html
}


// <------------- DELETE PROJECT FUNCTION ------------->
// <------------- ENHANCED DELETE FUNCTION WITH ALERT ------------->
async function deleteProject(projectId) {
    try {
        const targetId = Number(projectId);
        const q = query(collection(db, "tb_projects"), where("project_id", "==", targetId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnapshot = querySnapshot.docs[0];
            const projectData = docSnapshot.data();
            const status = projectData.status?.toLowerCase() || '';

            // Block deletion for ongoing projects with alert
            if (status === 'ongoing') {
                alert("⛔ Cannot delete project\nThis project is currently ongoing and cannot be deleted.");
                return false;
            }

            // Block other non-pending statuses
            if (status !== 'pending') {
                throw new Error(`Project status "${formatStatus(projectData.status)}" does not allow deletion`);
            }

            // Proceed with deletion for pending projects
            await deleteDoc(docSnapshot.ref);
            await fetch_projects();
            return true;
        }
        
        throw new Error('Project not found in database');
    } catch (error) {
        console.error("Delete error:", error.message);
        showDeleteMessage(error.message, false);
        return false;
    }
}

// <------------- UPDATED EVENT HANDLER ------------->
tableBody.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".delete-btn");
    if (!deleteBtn) return;

    const projectId = deleteBtn.dataset.id;
    const confirmation = confirm("Are you sure you want to delete this project?");

    if (confirmation) {
        const success = await deleteProject(projectId);
        if (success) {
            showDeleteMessage("Pending project deleted successfully", true);
        }
    }
});









// <------------- DELETE BUTTON EVENT LISTENER ------------->
async function deleteProjects(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Retrieve the first matching document
            const docSnapshot = querySnapshot.docs[0];
            const docRef = docSnapshot.ref;
            const projectData = docSnapshot.data();

            // Convert status to lowercase for case-insensitive comparison
            const status = projectData.status ? projectData.status.toLowerCase() : "";

            // Check the status field
            if (status === "Ongoing") {
                showDeleteMessage("Project cannot be deleted because it is already ongoing.", false);
                return;
            } else if (status === "Pending") {
                selectedRowId = docRef.id; // Store the document ID for deletion
                confirmationPanel.style.display = "flex";
                editFormContainer.style.pointerEvents = "none";
            } else {
                console.error("Invalid project status. Deletion not allowed.");
            }
        } else {
            showDeleteMessage("No project_id found, unable to proceed with deleting the record", false);
        }
    } catch (error) {
        console.error("Error finding project:", error);
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
            // Get authenticated user's user_type
            const user_type = await getAuthenticatedUser();
            console.log("Extracted user_type:", user_type);
            
            if (!user_type) {
                console.error("Error: user_type is undefined or null.");
                return;
            }
            
            const projectDocRef = doc(db, "tb_projects", selectedRowId);
            const projectSnapshot = await getDoc(projectDocRef);

            if (projectSnapshot.exists()) {
                const projectData = projectSnapshot.data();
                const { status, crop_type_name, fertilizer_type, quantity_crop_type, quantity_fertilizer_type } = projectData;
                
                console.log("Project Data:", projectData);

                // 🔴 Check if status is "pending" (case insensitive)
                if (!status || status.toLowerCase() !== "pending") {
                    showDeleteMessage("Project cannot be deleted because it is not in 'Pending' status.", false);
                    return;
                }

                let cropUpdated = false;
                let fertilizerUpdated = false;

                // 🔹 Update crop stock (tb_crop_stock)
                if (crop_type_name) {
                    const cropStockQuery = query(collection(db, "tb_crop_stock"), where("crop_type_name", "==", crop_type_name));
                    const cropStockSnapshot = await getDocs(cropStockQuery);

                    if (!cropStockSnapshot.empty) {
                        const cropStockDoc = cropStockSnapshot.docs[0]; // Get first matching document
                        const cropStockRef = doc(db, "tb_crop_stock", cropStockDoc.id);
                        let cropStockData = cropStockDoc.data();
                        let stockArray = cropStockData.stocks || [];

                        // Find stock entry by owned_by
                        const userStockIndex = stockArray.findIndex(stock => stock.owned_by === user_type);

                        if (userStockIndex !== -1) {
                            // Update current_stock
                            stockArray[userStockIndex].current_stock += quantity_crop_type;
                        } else {
                            console.warn(`No crop stock entry found for owned_by: ${user_type}. Creating new entry.`);
                            stockArray.push({ owned_by: user_type, current_stock: quantity_crop_type });
                        }

                        await updateDoc(cropStockRef, { stocks: stockArray });
                        cropUpdated = true;
                    } else {
                        console.error(`Crop stock document with crop_type_name '${crop_type_name}' not found.`);
                    }
                } else {
                    console.error("Error: crop_type_name is undefined.");
                }

                // 🔹 Update fertilizer stock (tb_fertilizer_stock)
                if (fertilizer_type) {
                    const fertilizerStockQuery = query(
                        collection(db, "tb_fertilizer_stock"),
                        where("fertilizer_name", "==", fertilizer_type) // Match fertilizer_name in tb_fertilizer_stock
                    );
                    const fertilizerStockSnap = await getDocs(fertilizerStockQuery);
                    
                    if (!fertilizerStockSnap.empty) {
                        const fertilizerStockDoc = fertilizerStockSnap.docs[0]; // Get first matching document
                        const fertilizerStockRef = doc(db, "tb_fertilizer_stock", fertilizerStockDoc.id);
                        const fertilizerStockData = fertilizerStockDoc.data();
                        let stockArray = fertilizerStockData.stocks || [];
                    
                        // Find stock entry by owned_by
                        const userStockIndex = stockArray.findIndex(stock => stock.owned_by === user_type);
                    
                        if (userStockIndex !== -1) {
                            // Update current_stock
                            stockArray[userStockIndex].current_stock += quantity_fertilizer_type;
                        } else {
                            console.warn(`No fertilizer stock entry found for owned_by: ${user_type}. Creating new entry.`);
                            stockArray.push({ owned_by: user_type, current_stock: quantity_fertilizer_type });
                        }
                    
                        await updateDoc(fertilizerStockRef, { stocks: stockArray });
                        fertilizerUpdated = true;
                    } else {
                        console.error(`Fertilizer stock document with fertilizer_name '${fertilizer_type}' not found.`);
                    }
                } else {
                    console.error("Error: fertilizer_type is undefined.");
                }

                // Proceed with deletion only if both stock updates were successful
                if (cropUpdated && fertilizerUpdated) {
                    await deleteDoc(projectDocRef);
                    showDeleteMessage("Record deleted successfully! Stock updated.", true);
                    fetch_projects(); // Refresh table
                } else {
                    showDeleteMessage("Stock update failed. Project not deleted.", false);
                }
            } else {
                console.error("Project not found.");
            }
        } catch (error) {
            console.error("Error deleting record:", error);
        }
    }

    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
    selectedRowId = null; // Reset selection after deletion
});

cancelDeleteButton.addEventListener("click", () => {
    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
    selectedRowId = null;
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
            let statusName = data.status || "";
            
            // Skip if status is null, undefined, or empty string
            if (!statusName || statusName.trim() === "") {
                return;
            }

            // Capitalize only the first letter
            statusName = statusName.charAt(0).toUpperCase() + statusName.slice(1).toLowerCase();

            // Case-insensitive check by converting all stored values to a consistent format
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

document.addEventListener("DOMContentLoaded", () => {
    const successMessage = localStorage.getItem("successMessage");

    if (successMessage) {
        showDeleteMessage(successMessage, true);
        localStorage.removeItem("successMessage"); // Clear after showing
    }
});

fetch_projects();
fetch_status();