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
        const farmerId = sessionStorage.getItem("farmer_id") || ""; // Fetch farmer_id from sessionStorage

        const querySnapshot = await getDocs(collection(db, "tb_projects"));
        projectList = [];
        let projectIdList = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const projectId = String(data.project_id || "");

            // Check email in tb_projects instead of farm_president
            if ((data.farmer_id || "").toLowerCase() !== farmerId.toLowerCase()) {
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


//FETCH PROJECT DETAILS
async function fetchProjectDetails(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            let projectData = null;
            querySnapshot.forEach((doc) => {
                projectData = doc.data();
            });

            if (projectData) {
                const filteredProjectData = {
                    project_creator: projectData.project_creator || "N/A",
                    crop_type_name: projectData.crop_type_name || "N/A",
                    crop_type_quantity: projectData.crop_type_quantity || 0,
                    equipment: projectData.equipment || [],
                    fertilizer: projectData.fertilizer || []
                };

                console.log("Fetched Project Details:", filteredProjectData);
                return filteredProjectData;
            }
        }

        console.warn("No project found with the given project_id:", project_id);
        return null;
    } catch (error) {
        console.error("Error fetching project details:", error);
        return null;
    }
}


//CROP STOCK
async function fetchCropStockByOwner(projectCreator, cropTypeName) {
    console.log(`Fetching crop stock for project creator: ${projectCreator} with crop type: ${cropTypeName}`);

    try {
        // Query the tb_crop_stock collection
        const cropStockQuery = query(collection(db, "tb_crop_stock"));
        const cropStockSnapshot = await getDocs(cropStockQuery);

        let foundStock = null;

        cropStockSnapshot.forEach((doc) => {
            const cropStockData = doc.data();

            // Check if crop_type_name matches
            if (cropStockData.crop_type_name === cropTypeName) {
                // Find a stock entry where owned_by matches projectCreator
                const matchingStocks = cropStockData.stocks.filter(stock => stock.owned_by === projectCreator);

                if (matchingStocks.length > 0) {
                    foundStock = {
                        crop_name: cropStockData.crop_name || "N/A",
                        crop_type_id: cropStockData.crop_type_id || "N/A",
                        crop_type_name: cropStockData.crop_type_name || "N/A",
                        unit: cropStockData.unit || "N/A",
                        stocks: matchingStocks.map(stock => ({
                            current_stock: stock.current_stock || 0,
                            owned_by: stock.owned_by || "N/A",
                            stock_date: stock.stock_date || "N/A"
                        }))
                    };
                }
            }
        });

        if (foundStock) {
            console.log("Fetched Crop Stock:", foundStock);
        } else {
            console.log(`No crop stock found for project creator: ${projectCreator} with crop type: ${cropTypeName}`);
        }

        return foundStock;
    } catch (error) {
        console.error("Error fetching crop stock:", error);
        return null;
    }
}





//DITO SYA MAGBABAWAS NG STOCK HA
async function updateCropStockAfterAssignment(project_id) {
    try {
        // Fetch project details
        const projectData = await fetchProjectDetails(project_id);
        if (!projectData || !projectData.project_creator || !projectData.crop_type_name) {
            console.warn("Missing project details, cannot update stock.");
            return;
        }

        // Fetch crop stock for the project creator with crop_type_name
        const cropStockData = await fetchCropStockByOwner(projectData.project_creator, projectData.crop_type_name);
        if (!cropStockData || !cropStockData.stocks || cropStockData.stocks.length === 0) {
            console.warn("No crop stock found for the project creator.");
            return;
        }

        const requiredQuantity = projectData.crop_type_quantity;
        console.log(`Required quantity for project: ${requiredQuantity}`);

        let stockUpdated = false;

        for (let i = 0; i < cropStockData.stocks.length; i++) {
            let stock = cropStockData.stocks[i];

            if (stock.owned_by === projectData.project_creator) {
                let updatedStockValue = stock.current_stock - requiredQuantity;

                if (updatedStockValue < 0) {
                    console.warn(`Not enough stock! Current: ${stock.current_stock}, Required: ${requiredQuantity}`);
                    return;
                }

                console.log(`Updating stock for ${stock.owned_by}. New Stock: ${updatedStockValue}`);

                // Update only the specific stock inside the array
                cropStockData.stocks[i].current_stock = updatedStockValue;
                stockUpdated = true;
                break; // Stop after updating the first matching stock
            }
        }

        if (stockUpdated) {
            // Update Firestore
            const cropStockQuery = query(collection(db, "tb_crop_stock"), 
                                         where("crop_type_name", "==", projectData.crop_type_name));
            const cropStockSnapshot = await getDocs(cropStockQuery);

            if (!cropStockSnapshot.empty) {
                cropStockSnapshot.forEach(async (doc) => {
                    const cropStockRef = doc.ref;
                    await updateDoc(cropStockRef, { stocks: cropStockData.stocks });
                });
                console.log("Stock updated successfully!");
            } else {
                console.warn("Crop stock document not found in the database.");
            }
        }
    } catch (error) {
        console.error("Error updating crop stock:", error);
    }
}




//TEAM ASSIGN
async function teamAssign(project_id) {
    const panel = document.getElementById("team-assign-confirmation-panel");
    if (!panel) {
        console.error("Error: Confirmation panel not found!");
        return;
    }
    panel.style.display = "flex";

// Fetch and log project details
const projectData = await fetchProjectDetails(project_id);
if (!projectData) {
    console.error("Error: Failed to fetch project details.");
    return;
}
console.log("Project Details:", projectData);

// Fetch and log crop stock data separately
if (projectData.project_creator && projectData.crop_type_name) {
    const cropStock = await fetchCropStockByOwner(projectData.project_creator, projectData.crop_type_name);
    console.log("Crop Stock by Owner:", cropStock ? cropStock : "No stock found.");
} else {
    console.warn("Missing project creator or crop type name, skipping crop stock fetch.");
}


    
    

    try {
        const userBarangay = sessionStorage.getItem("barangay_name");

        // Fetch all active projects in the barangay
        const projectQuery = query(collection(db, "tb_projects"), where("barangay_name", "==", userBarangay));
        const projectSnapshot = await getDocs(projectQuery);
        const assignedTeamIds = new Set();

        projectSnapshot.forEach((doc) => {
            const projectData = doc.data();
            if (projectData.team_id) {
                assignedTeamIds.add(parseInt(projectData.team_id, 10));
            }
        });

        console.log("Assigned Team IDs:", Array.from(assignedTeamIds));

        // Fetch available teams
        const teamQuery = query(collection(db, "tb_teams"), where("barangay_name", "==", userBarangay));
        const teamSnapshot = await getDocs(teamQuery);

        let displayedTeamIds = [];
        let teamListHtml = `
            <div class="team-assign-box">
                <h3>Available Teams</h3>
                <div class="team-list-container">
        `;

        teamSnapshot.forEach((doc) => {
            const teamData = doc.data();
            const teamId = parseInt(teamData.team_id, 10);

            console.log(`Checking team: ${teamId} (Is assigned? ${assignedTeamIds.has(teamId)})`);

            if (assignedTeamIds.has(teamId)) return; // Skip already assigned teams

            displayedTeamIds.push(teamId);
            const teamName = teamData.team_name;
            const leadFarmer = teamData.lead_farmer;
            const leadFarmerEmail = teamData.lead_farmer_email || "N/A"; // Get lead farmer email
            const totalFarmers = teamData.farmer_name ? teamData.farmer_name.length : 0;

            teamListHtml += `
                <div class="team-item" 
                     data-team-id="${teamId}" 
                     data-team-name="${teamName}" 
                     data-lead-farmer="${leadFarmer}" 
                     data-lead-farmer-email="${leadFarmerEmail}"
                     data-farmers='${JSON.stringify(teamData.farmer_name || [])}'>
                    <strong>${teamName}</strong><br>
                    Lead: ${leadFarmer} (${leadFarmerEmail})<br>
                    Total Farmers: ${totalFarmers}
                </div>
            `;
        });

        console.log("Displayed Team IDs (After Filtering):", displayedTeamIds);

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
            lead_farmer_email: selectedElement.getAttribute("data-lead-farmer-email"),
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
                            const currentDate = new Date().toISOString(); // Get current date

                            await updateDoc(projectRef, {
                                team_id: selectedTeam.team_id,
                                team_name: selectedTeam.team_name,
                                lead_farmer: selectedTeam.lead_farmer,
                                lead_farmer_email: selectedTeam.lead_farmer_email, // ✅ Inserted lead farmer email
                                farmer_name: selectedTeam.farmer_name,
                                crop_date: currentDate,
                                fertilizer_date: currentDate,
                                equipment_date: currentDate,
                                status: "Ongoing" // ✅ Status updated from Pending to Ongoing
                            });

                            localStorage.setItem("projectData", JSON.stringify({
                                ...doc.data(),
                                team_id: selectedTeam.team_id,
                                team_name: selectedTeam.team_name,
                                lead_farmer: selectedTeam.lead_farmer,
                                lead_farmer_email: selectedTeam.lead_farmer_email, // ✅ Inserted lead farmer email
                                farmer_name: selectedTeam.farmer_name,
                                crop_date: currentDate,
                                fertilizer_date: currentDate,
                                equipment_date: currentDate,
                                status: "Ongoing"
                            }));

                            alert(`Team "${selectedTeam.team_name}" has been successfully assigned! Project status updated to Ongoing.`);
                            
// ✅ Call the function to update crop stock after assigning a team
                await updateCropStockAfterAssignment(project_id);


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

                panel.style.display = "none";
            };
        } else {
            console.error("Error: Confirm button (confirm-team-assign) not found!");
        }
    }, 100);
}


    // Function to reset selection
    // Function to reset selection and close the popup
function resetTeamSelection() {
    const panel = document.getElementById("team-assign-confirmation-panel");
    if (panel) {
        panel.style.display = "none"; // Hide the popup
    }
    selectedTeam = null;
}


    // Cancel button event listeners
    setTimeout(() => {
        const cancelTeamAssign = document.getElementById("cancel-team-assign");
        if (cancelTeamAssign) cancelTeamAssign.addEventListener("click", resetTeamSelection);
    }, 100);





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