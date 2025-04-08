import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    setDoc,
    getDoc,
    query,
    where,
    getFirestore,
    onSnapshot
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

const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
const deleteMessage = document.getElementById("delete-message");
let selectedRowId = null;

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
                        resolve(userData.user_type);
                    } else {
                        reject("User record not found.");
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
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
        let projectIdList = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const projectId = String(data.project_id || "");
            projectIdList.push(projectId);

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

        projectList.sort((a, b) => {
            const startA = a.start_date ? new Date(a.start_date) : new Date(0);
            const startB = b.start_date ? new Date(b.start_date) : new Date(0);
            const endA = a.end_date ? new Date(a.end_date) : new Date(0);
            const endB = b.end_date ? new Date(b.end_date) : new Date(0);

            if (startB - startA !== 0) {
                return startB - startA;
            }
            return endB - endA;
        });

        currentPage = 1;
        updateTable();
        updatePagination();
    } catch (error) {
        console.error("Error Fetching Projects:", error);
    }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name) {
    return project_name ? capitalizeWords(project_name) : "";
}

function formatFarmPresident(farm_president) {
    return farm_president ? capitalizeWords(farm_president) : "";
}

function formatCrop(crop_type_name) {
    return crop_type_name ? capitalizeWords(crop_type_name) : "";
}

function formatStatus(status) {
    return status ? capitalizeWords(status) : "";
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
            Progress: ""
        });
    });
    console.log("---------------------------");
}

logProjectDetails();

// <------------- TABLE DISPLAY AND UPDATE ------------->
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
        row.innerHTML = `
            <td>${formattedProjectName || "Project Name not recorded"}</td>
            <td>${formattedFarmPresident || "Farm President not recorded"}</td>
            <td>${data.start_date || "Start Date not recorded"}</td>
            <td>${data.end_date || "End Date not recorded"}</td>
            <td>${formattedCrop || "Crop not recorded"}</td>
            <td></td>
            <td>${formattedStatus || "Status not recorded"}</td>
            <td>
                <button class="action-btn view-btn" data-id="${data.project_id}" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
                <button class="action-btn edit-btn" data-id="${data.project_id}" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn delete-btn" data-id="${data.project_id}" title="Delete">
                    <img src="../../images/delete.png" alt="Delete">
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
                if (projectData.status?.toLowerCase() === "ongoing") {
                    showDeleteMessage("Editing is not allowed for ongoing projects.", false);
                    return;
                }
                localStorage.setItem("projectData", JSON.stringify(projectData));
                window.location.href = "admin_projects_edit.html";
            });
        } else {
            showDeleteMessage("No matching record found.", false);
        }
    } catch (error) {
        console.error("Error fetching user data for edit:", error);
    }
}

// <------------- VIEW BUTTON CODE ------------->
function viewUserAccount(projectId) {
    sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10));
    window.location.href = "viewproject.html";
}

// <------------- DELETE PROJECTS FUNCTION ------------->
async function deleteProjects(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnapshot = querySnapshot.docs[0];
            const docRef = docSnapshot.ref;
            const projectData = docSnapshot.data();
            const status = projectData.status?.toLowerCase() || "";

            if (status === "ongoing") {
                showDeleteMessage("Project cannot be deleted because it is already ongoing.", false);
                return;
            } else if (status === "pending") {
                selectedRowId = docRef.id;
                confirmationPanel.style.display = "flex";
                editFormContainer.style.pointerEvents = "none";
            } else {
                showDeleteMessage("Deletion not allowed for this project status.", false);
            }
        } else {
            showDeleteMessage("No project found.", false);
        }
    } catch (error) {
        console.error("Error finding project:", error);
        showDeleteMessage("Error finding project.", false);
    }
}

// <------------- DELETE CONFIRMATION HANDLER ------------->
confirmDeleteButton.addEventListener("click", async () => {
    if (!selectedRowId) return;

    try {
        const projectDocRef = doc(db, "tb_projects", selectedRowId);
        const projectSnapshot = await getDoc(projectDocRef);

        if (!projectSnapshot.exists()) {
            showDeleteMessage("Project not found.", false);
            return;
        }

        const projectData = projectSnapshot.data();
        const projectCreator = projectData.project_creator?.toLowerCase(); // Normalize to lowercase

        if (projectData.status?.toLowerCase() !== "pending") {
            showDeleteMessage("Project cannot be deleted because it is not in 'Pending' status.", false);
            return;
        }

        let cropUpdated = false;
        let allFertilizersUpdated = true;
        let allEquipmentUpdated = true;

        // Update Crop Stock
        if (projectData.crop_type_name && projectData.crop_type_quantity) {
            const cropStockQuery = query(
                collection(db, "tb_crop_stock"),
                where("crop_type_name", "==", projectData.crop_type_name)
            );
            const cropStockSnapshot = await getDocs(cropStockQuery);

            if (!cropStockSnapshot.empty) {
                const cropStockDoc = cropStockSnapshot.docs[0];
                const cropStockRef = doc(db, "tb_crop_stock", cropStockDoc.id);
                let stockArray = cropStockDoc.data().stocks || [];
                const userStockIndex = stockArray.findIndex(stock => 
                    stock.owned_by?.toLowerCase() === projectCreator
                ); // Case-insensitive match

                if (userStockIndex !== -1) {
                    stockArray[userStockIndex].current_stock += projectData.crop_type_quantity;
                } else {
                    stockArray.push({ owned_by: projectCreator, current_stock: projectData.crop_type_quantity });
                }
                await updateDoc(cropStockRef, { stocks: stockArray });
                cropUpdated = true;
            } else {
                throw new Error(`Crop stock for ${projectData.crop_type_name} not found`);
            }
        } else {
            cropUpdated = true; // No crop to update
        }

        // Update Fertilizer Stock (multiple items possible)
        if (projectData.fertilizer && Array.isArray(projectData.fertilizer) && projectData.fertilizer.length > 0) {
            for (const fertilizer of projectData.fertilizer) {
                if (!fertilizer.fertilizer_name || !fertilizer.fertilizer_quantity) continue;

                const fertilizerStockQuery = query(
                    collection(db, "tb_fertilizer_stock"),
                    where("fertilizer_name", "==", fertilizer.fertilizer_name)
                );
                const fertilizerStockSnapshot = await getDocs(fertilizerStockQuery);

                if (!fertilizerStockSnapshot.empty) {
                    const fertilizerStockDoc = fertilizerStockSnapshot.docs[0];
                    const fertilizerStockRef = doc(db, "tb_fertilizer_stock", fertilizerStockDoc.id);
                    let stockArray = fertilizerStockDoc.data().stocks || [];
                    const userStockIndex = stockArray.findIndex(stock => 
                        stock.owned_by?.toLowerCase() === projectCreator
                    ); // Case-insensitive match

                    if (userStockIndex !== -1) {
                        stockArray[userStockIndex].current_stock += fertilizer.fertilizer_quantity;
                    } else {
                        stockArray.push({ owned_by: projectCreator, current_stock: fertilizer.fertilizer_quantity });
                    }
                    await updateDoc(fertilizerStockRef, { stocks: stockArray });
                } else {
                    allFertilizersUpdated = false;
                    throw new Error(`Fertilizer stock for ${fertilizer.fertilizer_name} not found`);
                }
            }
        } else {
            allFertilizersUpdated = true; // No fertilizers to update
        }

        // Update Equipment Stock (multiple items possible)
        if (projectData.equipment && Array.isArray(projectData.equipment) && projectData.equipment.length > 0) {
            for (const equipment of projectData.equipment) {
                if (!equipment.equipment_name || !equipment.equipment_quantity) continue;

                const equipmentStockQuery = query(
                    collection(db, "tb_equipment_stock"),
                    where("equipment_name", "==", equipment.equipment_name)
                );
                const equipmentStockSnapshot = await getDocs(equipmentStockQuery);

                if (!equipmentStockSnapshot.empty) {
                    const equipmentStockDoc = equipmentStockSnapshot.docs[0];
                    const equipmentStockRef = doc(db, "tb_equipment_stock", equipmentStockDoc.id);
                    let stockArray = equipmentStockDoc.data().stocks || [];
                    const userStockIndex = stockArray.findIndex(stock => 
                        stock.owned_by?.toLowerCase() === projectCreator
                    ); // Case-insensitive match

                    if (userStockIndex !== -1) {
                        stockArray[userStockIndex].current_stock += equipment.equipment_quantity;
                    } else {
                        stockArray.push({ owned_by: projectCreator, current_stock: equipment.equipment_quantity });
                    }
                    await updateDoc(equipmentStockRef, { stocks: stockArray });
                } else {
                    allEquipmentUpdated = false;
                    throw new Error(`Equipment stock for ${equipment.equipment_name} not found`);
                }
            }
        } else {
            allEquipmentUpdated = true; // No equipment to update
        }

        // Proceed with deletion if all updates succeed
        if (cropUpdated && allFertilizersUpdated && allEquipmentUpdated) {
            await deleteDoc(projectDocRef);
            showDeleteMessage("Project Record has been successfully deleted and stock has been restored!", true);
            fetch_projects();
        } else {
            showDeleteMessage("Stock update failed. Project not deleted.", false);
        }
    } catch (error) {
        console.error("Error deleting record:", error);
        showDeleteMessage(`Error: ${error.message}`, false);
    }

    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
    selectedRowId = null;
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

// <----------------------- STATUS DROP DOWN CODE ----------------------->
async function fetch_status() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_projects"));
        let addedStatus = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let statusName = data.status || "";
            if (!statusName || statusName.trim() === "") return;

            statusName = statusName.charAt(0).toUpperCase() + statusName.slice(1).toLowerCase();
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

// <------------------ FUNCTION TO DISPLAY DELETE MESSAGE ------------------------>
function showDeleteMessage(message, success) {
    deleteMessage.querySelector("p").textContent = message;
    deleteMessage.style.backgroundColor = success ? "#41A186" : "#f44336";
    deleteMessage.style.opacity = "1";
    deleteMessage.style.display = "block";

    setTimeout(() => {
        deleteMessage.style.opacity = "0";
        setTimeout(() => {
            deleteMessage.style.display = "none";
        }, 400);
    }, 4000);
}

// NEW CODE: Real-time listener for moving completed projects
function setupProjectHistoryListener() {
    const projectsCollection = collection(db, "tb_projects");
    const historyCollection = collection(db, "tb_project_history");

    onSnapshot(projectsCollection, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const projectData = change.doc.data();
            const projectId = change.doc.id;

            if (projectData.status?.toLowerCase() === "completed") {
                try {
                    await setDoc(doc(historyCollection, projectId), {
                        ...projectData,
                        moved_to_history_timestamp: new Date().toISOString()
                    });
                    await deleteDoc(doc(db, "tb_projects", projectId));
                    fetch_projects();
                } catch (error) {
                    console.error("Error moving completed project to history:", error);
                }
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const successMessage = localStorage.getItem("successMessage");
    if (successMessage) {
        showDeleteMessage(successMessage, true);
        localStorage.removeItem("successMessage");
    }
    setupProjectHistoryListener();
});

fetch_projects();
fetch_status();