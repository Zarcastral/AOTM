import {
    collection,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    where,
    query,
    getFirestore
  } from "firebase/firestore";

import app from "../config/firebase_config.js";
const db = getFirestore(app);

const tableBody = document.getElementById("table_body");
const barangaySelect = document.getElementById("barangay-select");
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
let farmerAccounts = [];

async function fetch_farmer_accounts(filter = {}) {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_farmers"));
        farmerAccounts = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const searchTerm = filter.search?.toLowerCase();
            const matchesSearch = searchTerm
                ? `${data.first_name || ""} ${data.middle_name || ""} ${data.last_name || ""}`
                      .toLowerCase()
                      .includes(searchTerm) ||
                  (data.farmer_id || "").toLowerCase().includes(searchTerm) ||
                  (data.user_type || "").toLowerCase().includes(searchTerm) ||
                  (data.user_name || "").toLowerCase().includes(searchTerm)
                : true;

            const matchesBarangay = filter.barangay_name
                ? (data.barangay_name || "").toLowerCase() === filter.barangay_name.toLowerCase()
                : true;

            if (matchesSearch && matchesBarangay) {
                farmerAccounts.push({ id: doc.id, ...data });
            }
            
        });  
        
        const missingFarmerIds = []; // Array to store farmers with undefined IDs
        // <------------- FETCHED DATA SORT BY FARMER ID ASCENSION (assuming farmer_id is a string or number) ------------->
        farmerAccounts.sort((a, b) => {
            const farmerIdA = a.farmer_id;
            const farmerIdB = b.farmer_id;
            const farmerNameA = formatName(a.first_name, a.middle_name, a.last_name);
        
            if (farmerIdA === undefined) {
                missingFarmerIds.push(farmerNameA);
                return 0; /* Keeps the current order of undefined values kapag ginawang 1 mapupunta lahat ng
                farmers na walang id sa pinaka dulo*/
            }
            // Alphabetical Comparison (A-Z)
            if (isNaN(farmerIdA) && isNaN(farmerIdB)) {
                return String(farmerIdA).localeCompare(String(farmerIdB), undefined, { numeric: true, sensitivity: 'base' });
            }
        
            // Numeric Comparison (low to high)
            if (!isNaN(farmerIdA) && !isNaN(farmerIdB)) {
                return Number(farmerIdA) - Number(farmerIdB);
            }
        
            /* Pina prioritize yung number only, kapag may string yung farmer id matic ma pupunta sa dulo
             at ma so sort kasama dun sa mga kaparehas nyang may string yung farmer id*/
            return isNaN(farmerIdA) ? 1 : -1;
            
        });
                // Log missing farmer IDs in bulk
        if (missingFarmerIds.length > 0) {
            console.log("Farmer ID's are not retrieved for the following farmers: " + missingFarmerIds.join(", "));
        }
        

        currentPage = 1; // *Reset to the first page when data is filtered*
        updateTable();
    } catch (error) {
        console.error("Error Fetching Farmer Accounts:", error);
    }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatBarangay(barangay) {
    const formattedBarangay = barangay ? capitalizeWords(barangay): "";

    return `${formattedBarangay}`.trim();
}

function formatUserType(user_type){
    const formattedUserType = user_type ? capitalizeWords(user_type): "";
    return `${formattedUserType}`.trim();
}

function formatName(firstName, middleName, lastName) {

    function getMiddleInitial(middle) {
        return middle ? middle.charAt(0).toUpperCase() + "." : "";
    }

    const formattedFirstName = firstName ? capitalizeWords(firstName) : "";
    const formattedMiddleName = getMiddleInitial(middleName);
    const formattedLastName = lastName ? capitalizeWords(lastName) : "";

    return `${formattedFirstName} ${formattedMiddleName} ${formattedLastName} `.trim();
}

//  <----------- TABLE DISPLAY AND UPDATE -------------> 
let selectedFarmerId = null;

function updateTable() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = farmerAccounts.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5">No records found.</td></tr>`;
    }

    pageData.forEach((data) => {
        const row = document.createElement("tr");
        const formattedName = formatName(data.first_name, data.middle_name, data.last_name);
        const formattedBarangay = formatBarangay(data.barangay_name);
        const formattedUserType = formatUserType(data.user_type);
        //<td>${formattedName}</td>
        row.innerHTML = `
            <td><input type="checkbox" class="checkbox" data-farmer-id="${data.farmer_id}"></td>
            <td>${data.farmer_id || "Farmer ID not recorded"}</td>
            <td>${formattedName || "User's name not recorded"}</td>
            <td>${formattedUserType || "User's role not recorded"}</td>
            <td>${formattedBarangay || "Barangay not recorded"}</td>
            <td>${data.contact || "Contact Number not recorded"}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${data.farmer_id}" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn view-btn" data-id="${data.farmer_id}" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
                <button class="action-btn delete-btn" data-id="${data.farmer_id}" title="Delete">
                    <img src="../../images/Delete.png" alt="Delete">
                </button>
            </td>
        `;
        tableBody.appendChild(row);
        
        // Add event listener to the checkbox to toggle row highlight
        const checkbox = row.querySelector(".checkbox");
        checkbox.addEventListener("change", function() {
            if (checkbox.checked) {
                row.classList.add("highlight");
            } else {
                row.classList.remove("highlight");
            }
        });
    });

    updatePagination();
    toggleBulkDeleteButton();
}

// <------------- Toggle Bulk Delete Button -------------> 
function toggleBulkDeleteButton() {
    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");
    const bulkDeleteBtn = document.getElementById("bulk-delete");

    // Enable the bulk delete button if at least one checkbox is selected
    if (selectedCheckboxes.length > 0) {
        bulkDeleteBtn.disabled = false;
    } else {
        bulkDeleteBtn.disabled = true;
    }
}

// <------------- Checkbox Change Event Listener -------------> 
tableBody.addEventListener("change", (event) => {
    if (event.target.classList.contains("checkbox")) {
        const farmerId = event.target.getAttribute("data-farmer-id");
        toggleBulkDeleteButton();
        if (event.target.checked) {
            selectedFarmerId = farmerId; // Store the farmer_id when checkbox is checked
            console.log("Selected Farmer ID: ", selectedFarmerId); // You can use this variable as needed
        } else {
            selectedFarmerId = null; // Reset the selected farmer_id when checkbox is unchecked
            console.log("Selected Farmer ID: ", "Farmer ID Unselected"); // You can use this variable as needed

        }
       
    }
});
// Update pagination display
function updatePagination() {
    const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
    const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// Function to change the page
function changePage(direction) {
    const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage);
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

// <------------- EDIT BUTTON CODE ------------->
async function editFarmerAccount(farmerId) {
    try {
        const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const farmerData = doc.data();
                localStorage.setItem("farmerData", JSON.stringify(farmerData));
                window.location.href = "admin_farmers_edit.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.error("Error fetching Farmer data for edit:", error);
    }
}

// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
    const target = event.target.closest("button"); // Ensure we're getting the button, not the image inside it
    if (!target) return; // Exit if no button was clicked

    const farmerId = target.getAttribute("data-id");

    if (target.classList.contains("edit-btn")) {
        editFarmerAccount(farmerId);
    } else if (target.classList.contains("view-btn")) {
        viewFarmerAccount(farmerId);
    } else if (target.classList.contains("delete-btn")) {
        deleteFarmerAccount(farmerId);
    }
});

// <------------- VIEW BUTTON CODE ------------->
async function viewFarmerAccount(farmerId) {
    try {
        const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const farmerData = doc.data();
                localStorage.setItem("farmerData", JSON.stringify(farmerData));
                window.location.href = "admin_farmers_view.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.log("Error fetching user data for view:", error);
    }
}


// <------------- DELETE CODES FUNCTION ------------->

// <------------- DELETE BUTTON EVENT LISTENER ------------->  
async function deleteFarmerAccount(farmer_id) {
    try {

        const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmer_id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            confirmationPanel.style.display = "flex";
            editFormContainer.style.pointerEvents = "none";
        } else {
            showDeleteMessage("No Farmer ID found, Unable to proceed with the deleting the record", false);
        }
    } catch (error) {
        console.log("Error deleting farmer account:", error);
    }
}


// <------------- DELETE A ROW AND REFRESH THE TABLE CODE ------------->
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;  // To store the ID of the row to be deleted

const deleteMessage = document.getElementById("delete-message");  // Reference to the success message

confirmDeleteButton.addEventListener("click", async () => {
    if (selectedRowId) {
        try {
            // Delete the record from Firestore
            const farmerDocRef = doc(db, "tb_farmers", selectedRowId);
            await deleteDoc(farmerDocRef);
            console.log("Record deleted successfully!");

            // Refresh the table after deletion
            fetch_farmer_accounts();

            // Show success message
            deleteMessage.style.display = "block";
            setTimeout(() => {
                deleteMessage.style.opacity = "1";  // Fade in

                // Hide the success message after 3 seconds
                setTimeout(() => {
                    deleteMessage.style.opacity = "0";  // Fade out
                    setTimeout(() => {
                        deleteMessage.style.display = "none";  // Hide it completely
                    }, 300);  // Wait for the fade-out transition to finish
                }, 3000);  // Wait for 3 seconds before hiding
            }, 0);
        } catch (error) {
            console.error("Error deleting record:", error);
        }
    }

    // Close the confirmation panel and re-enable the form
    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
});

cancelDeleteButton.addEventListener("click", () => {
    // Close the confirmation panel and re-enable the form
    confirmationPanel.style.display = "none";
    editFormContainer.style.pointerEvents = "auto";
});

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", () => {
    fetch_farmer_accounts({
        search: searchBar.value,
        barangay_name: barangaySelect.value,
    });
});

barangaySelect.addEventListener("change", () => {
    fetch_farmer_accounts({
        search: searchBar.value,
        barangay_name: barangaySelect.value,
    });
});

prevPageBtn.addEventListener("click", () => changePage('prev'));
nextPageBtn.addEventListener("click", () => changePage('next'));

// <----------------------- BARANGAY DROP DOWN CODE ----------------------->

async function fetch_barangays() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_barangay"));

        // Create an array to track barangay names that have already been added
        let addedBarangays = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const barangayName = data.barangay_name;

            // Check if the barangay name is already in the addedBarangays array
            if (!addedBarangays.includes(barangayName)) {
                addedBarangays.push(barangayName);

                const option = document.createElement("option");
                option.value = barangayName;
                option.textContent = barangayName;
                barangaySelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error Fetching Barangays:", error);
    }
}
// <---------------------------- BULK DELETE CODE ---------------------------->

const deleteSelectedBtn = document.getElementById("bulk-delete");
const bulkDeletePanel = document.getElementById("bulk-delete-panel");
const confirmDeleteBtn = document.getElementById("confirm-bulk-delete");
const cancelDeleteBtn = document.getElementById("cancel-bulk-delete");
let idsToDelete = [];

deleteSelectedBtn.addEventListener("click", async () => {
    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");

    idsToDelete = [];
    let hasInvalidId = false;

    for (const checkbox of selectedCheckboxes) {
        const farmerId = checkbox.getAttribute("data-farmer-id");

        // Validate farmerId (null, undefined, or empty string)
        if (!farmerId || farmerId.trim() === "") {
            hasInvalidId = true;
            break;
        }

        /*  Check if the farmer_id exists in the database
            kailangan to for error trapping kasi chine check nya muna kung yung na retrieve na farmer id
            dun sa mga checkboxes is nag eexist talaga sa firestore database
        */
        try {
            const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                hasInvalidId = true;
                break;
            }

            idsToDelete.push(farmerId);
        } catch (error) {
            console.error("Error fetching farmer records:", error);
            hasInvalidId = true;
            break;
        }
    }

    if (hasInvalidId) {
        showDeleteMessage("ERROR: Farmer ID of one or more selected records are invalid", false);
    } else {
        bulkDeletePanel.classList.add("show");
    }
});


confirmDeleteBtn.addEventListener("click", async () => {
    try {
        for (const farmerId of idsToDelete) {
            const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (docSnapshot) => {
                const docRef = doc(db, "tb_farmers", docSnapshot.id);
                await deleteDoc(docRef);
                console.log(`Farmer with ID ${farmerId} deleted.`);
            });
        }
        
        showDeleteMessage("Selected farmers have been deleted.", true);
        fetch_farmer_accounts();
    } catch (error) {
        console.error("Error deleting farmers:", error);
        showDeleteMessage("Error deleting farmers. Please try again.", false);
    }

    bulkDeletePanel.classList.remove("show"); 
});

cancelDeleteBtn.addEventListener("click", () => {

    bulkDeletePanel.classList.remove("show"); 
});

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
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

fetch_farmer_accounts();
fetch_barangays();

