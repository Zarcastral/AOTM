import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    getDoc,
    query,
    where,
    getFirestore,
    updateDoc
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

let currentPage = 1;
const rowsPerPage = 5;
let projectList = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is authenticated:", user.email);
        fetch_projects();  // Run this ONLY after authentication is confirmed
    } else {
        console.error("User not authenticated.");
        // Redirect to login page or prompt for sign-in
    }
});

async function fetch_projects(filter = {}) {
    try {
        const user = auth.currentUser;  // Ensure user is passed correctly

        if (!user) {
            console.error("User not authenticated.");
            return;
        }

        const farmerDocRef = doc(db, "tb_farmers", user.uid);
        const farmerDocSnap = await getDoc(farmerDocRef);

        if (!farmerDocSnap.exists()) {
            console.error("Farmer document not found.");
            return;
        }

        const farmerData = farmerDocSnap.data();
        const farmerEmail = farmerData.email || "";  // Fetch email from tb_farmers

        const querySnapshot = await getDocs(collection(db, "tb_projects"));
        projectList = [];
        let projectIdList = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const projectId = String(data.project_id || "");

            // Check email in tb_projects instead of farm_president
            if ((data.email || "").toLowerCase() !== farmerEmail.toLowerCase()) {
                return;
            }

            projectIdList.push(projectId);

            const searchTerm = filter.search?.toLowerCase();
            const matchesSearch = searchTerm
                ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
                  `${data.email || ""}`.toLowerCase().includes(searchTerm) ||  // Updated condition
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

        console.log("Project IDs:", projectIdList);
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
    console.log("Clicked Edit Button - Project ID:", project_id); // Debugging

    if (target.classList.contains("edit-btn")) {
        teamAssign(project_id);
    } else if (target.classList.contains("view-btn")) {
        viewProject(project_id);
    } else if (target.classList.contains("delete-btn")) {
        deleteUserAccount(project_id);
    }
});




//TEAM ASSIGN
async function teamAssign(project_id) {
    // Show the confirmation popup
    const panel = document.getElementById("team-assign-confirmation-panel");
    if (!panel) {
        console.error("Error: Confirmation panel not found!");
        return;
    }
    panel.style.display = "flex";

    try {
        const userBarangay = sessionStorage.getItem("barangay_name");

        // Fetch all active projects in the barangay
        const projectQuery = query(collection(db, "tb_projects"), where("barangay_name", "==", userBarangay));
        const projectSnapshot = await getDocs(projectQuery);
        const assignedTeamIds = new Set();

        // Collect team_ids that are already assigned to active projects (convert to integer)
        projectSnapshot.forEach((doc) => {
            const projectData = doc.data();
            if (projectData.team_id) {
                assignedTeamIds.add(parseInt(projectData.team_id, 10)); // Ensure it's an integer
            }
        });

        console.log("Assigned Team IDs:", Array.from(assignedTeamIds)); // Debugging

        // Fetch available teams
        const teamQuery = query(collection(db, "tb_teams"), where("barangay_name", "==", userBarangay));
        const teamSnapshot = await getDocs(teamQuery);

        let displayedTeamIds = []; // Store displayed team IDs
        let teamListHtml = `<div class="team-assign-box">
                                <h3>Available Teams</h3>
                                <div class="team-list-container">`;

        teamSnapshot.forEach((doc) => {
            const teamData = doc.data();
            const teamId = parseInt(teamData.team_id, 10); // Ensure it's an integer

            console.log(`Checking team: ${teamId} (Is assigned? ${assignedTeamIds.has(teamId)})`); // Debugging

            // 🚀 **NEW FIX: Skip teams that are already assigned**
            if (assignedTeamIds.has(teamId)) {
                return; // This team is already assigned, so we don't display it
            }

            displayedTeamIds.push(teamId); // Add to displayed teams list
            const teamName = teamData.team_name;
            const leadFarmer = teamData.lead_farmer;
            const totalFarmers = teamData.farmer_name ? teamData.farmer_name.length : 0;

            teamListHtml += `<div class="team-item" 
                                data-team-id="${teamId}" 
                                data-team-name="${teamName}" 
                                data-lead-farmer="${leadFarmer}" 
                                data-farmers='${JSON.stringify(teamData.farmer_name || [])}'>
                                <strong>${teamName}</strong><br>
                                Lead: ${leadFarmer}<br>
                                Total Farmers: ${totalFarmers}
                             </div>`;
        });

        console.log("Displayed Team IDs (After Filtering):", displayedTeamIds); // Debugging

        teamListHtml += "</div></div>";
        document.getElementById("team-assign-list").innerHTML = teamListHtml;
    } catch (error) {
        console.error("Error fetching team data:", error);
    }

    let selectedTeam = null;

    // Event delegation for selecting a team
    document.getElementById("team-assign-list").addEventListener("click", function (event) {
        let selectedElement = event.target.closest(".team-item");
        if (!selectedElement) return;

        document.querySelectorAll(".team-item").forEach(item => {
            item.style.backgroundColor = "";
            item.style.color = "";
        });

        selectedElement.style.backgroundColor = "#4CAF50";
        selectedElement.style.color = "white";

        // Store selected team details
        selectedTeam = {
            team_id: parseInt(selectedElement.getAttribute("data-team-id"), 10),
            team_name: selectedElement.getAttribute("data-team-name"),
            lead_farmer: selectedElement.getAttribute("data-lead-farmer"),
            farmer_name: JSON.parse(selectedElement.getAttribute("data-farmers"))
        };
    });

    // Ensure confirm button exists before adding event listener
    setTimeout(() => {
        const confirmBtn = document.getElementById("confirm-team-assign");
        if (confirmBtn) {
            confirmBtn.onclick = async function () {
                if (!selectedTeam) {
                    alert("Please select a team first.");
                    return;
                }

                try {
                    const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        querySnapshot.forEach(async (doc) => {
                            const projectRef = doc.ref;
                            await updateDoc(projectRef, {
                                team_id: selectedTeam.team_id, // Store as integer
                                team_name: selectedTeam.team_name,
                                lead_farmer: selectedTeam.lead_farmer,
                                farmer_name: selectedTeam.farmer_name
                            });

                            localStorage.setItem("projectData", JSON.stringify({
                                ...doc.data(),
                                team_id: selectedTeam.team_id,
                                team_name: selectedTeam.team_name,
                                lead_farmer: selectedTeam.lead_farmer,
                                farmer_name: selectedTeam.farmer_name
                            }));

                            alert(`Team "${selectedTeam.team_name}" has been successfully assigned!`);
                            
                            // Redirect to farmpres_project.html after successful save
                            window.location.href = "farmpres_project.html";
                        });
                    } else {
                        alert("No matching project found. Unable to proceed.");
                    }
                } catch (error) {
                    console.error("Error updating project with team assignment:", error);
                    alert("An error occurred while assigning the team. Please try again.");
                }

                // Close popup
                panel.style.display = "none";
            };
        } else {
            console.error("Error: Confirm button (confirm-team-assign) not found!");
        }
    }, 100);

    // Function to reset selection
    function resetTeamSelection() {
        panel.style.display = "none";
        selectedTeam = null;
    }

    // Cancel button event listeners
    setTimeout(() => {
        const cancelTeamAssign = document.getElementById("cancel-team-assign");
        if (cancelTeamAssign) cancelTeamAssign.addEventListener("click", resetTeamSelection);
    }, 100);
}









    
















// <------------- VIEW BUTTON CODE ------------->
/*async function viewUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const projectData = doc.data();
                localStorage.setItem("projectData", JSON.stringify(projectData));
                window.location.href = "admin_users_view.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.log("Error fetching user data for view:", error);
    }
}*/

function viewProject(projectId) {
    sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10)); // Convert to integer
    window.location.href = "viewproject.html"; // Redirect to viewproject.html
}

// <------------- DELETE BUTTON EVENT LISTENER ------------->
async function deleteUserAccount(project_id) {
    try {

        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
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

fetch_status();