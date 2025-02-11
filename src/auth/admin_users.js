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
        const querySnapshot = await getDocs(collection(db, "tb_users"));
        farmerAccounts = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const searchTerm = filter.search?.toLowerCase();
            const matchesSearch = searchTerm
                ? `${data.first_name || ""} ${data.middle_name || ""} ${data.last_name || ""}`
                      .toLowerCase()
                      .includes(searchTerm) ||
                  (data.email || "").toLowerCase().includes(searchTerm) ||
                  (data.user_name || "").toLowerCase().includes(searchTerm) ||
                  (data.user_type || "").toLowerCase().includes(searchTerm)
                : true;

            const matchesBarangay = filter.barangay_name
                ? (data.barangay || "").toLowerCase() === filter.barangay_name.toLowerCase()
                : true;

            if (matchesSearch && matchesBarangay) {
                farmerAccounts.push({ id: doc.id, ...data });
            }
            
        });

        // <------------- FETCHED DATA SORT BY FARMER ID ASCENSION (assuming is a string or number) ------------->
        farmerAccounts.sort((a, b) => {
            const userNameA = a.user_name || ''; // Default to an empty string if undefined
            const userNameB = b.user_name || ''; // Default to an empty string if undefined
            return userNameA.localeCompare(userNameB, undefined, { sensitivity: "base" });
        });
        

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
let selectedUsername = null;

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
        const formattedBarangay = formatBarangay(data.barangay);
        const formattedUserType = formatUserType(data.user_type);
        //<td>${formattedName}</td>
        row.innerHTML = `
            <td><input type="checkbox" class="checkbox" data-user-name="${data.user_name}"></td>
            <td>${data.user_name || ""}</td>
            <td>${formattedName || ""}</td>
            <td>${formattedUserType || ""}</td>
            <td>${formattedBarangay || ""}</td>
            <td>${data.contact || ""}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${data.user_name}" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn view-btn" data-id="${data.user_name}" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
                <button class="action-btn delete-btn" data-id="${data.user_name}" title="Delete">
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

    updatePaginationControls();
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
        const username = event.target.getAttribute("data-user-name");
        toggleBulkDeleteButton();
        if (event.target.checked) {
            selectedUsername = username;
        } else {
            selectedUsername = null;
        }
        if (event.target.checked) {
            console.log("Checkbox checked for username: ", username);  // Log when checkbox is checked
        } else {
            console.log("Checkbox unchecked for username: ", username);  // Log when checkbox is unchecked
        }
    }
});

// <------------- Update Pagination Controls ------------->
function updatePaginationControls() {
    pageNumberSpan.textContent = `Page ${currentPage}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage * rowsPerPage >= farmerAccounts.length;
}

function changePage(direction) {
    if (direction === "prev" && currentPage > 1) {
        currentPage--;
    } else if (direction === "next" && currentPage * rowsPerPage < farmerAccounts.length) {
        currentPage++;
    }
    updateTable();
}

prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));


// <------------- EDIT BUTTON CODE ------------->
async function editUserAccount(user_name) {
    try {
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const farmerData = doc.data();
                localStorage.setItem("farmerData", JSON.stringify(farmerData));
                window.location.href = "admin_users_edit.html";
            });
        } else {
            console.error("No matching document found for farmer with username:", user_name);
        }
    } catch (error) {
        console.error("Error fetching farmer data for edit:", error);
    }
}


// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
    const target = event.target.closest("button"); // Ensure we're getting the button, not the image inside it
    if (!target) return; // Exit if no button was clicked

    const username = target.getAttribute("data-id");

    if (target.classList.contains("edit-btn")) {
        editUserAccount(username);
    } else if (target.classList.contains("view-btn")) {
        viewUserAccount(username);
    } else if (target.classList.contains("delete-btn")) {
        confirmDelete(username);
    }
});

// <------------- VIEW BUTTON CODE ------------->
async function viewUserAccount(user_name) {
    try {
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const farmerData = doc.data();
                localStorage.setItem("farmerData", JSON.stringify(farmerData));
                window.location.href = "admin_users_view.html";
            });
        } else {
            console.error("No matching document found for farmer with username:", user_name);
        }
    } catch (error) {
        console.error("Error fetching farmer data for edit:", error);
    }
}

// <------------- DELETE BUTTON EVENT LISTENER ------------->
tableBody.addEventListener("click", (event) => {
    const target = event.target;
    if (target.classList.contains("delete-btn")) {
        selectedRowId = target.getAttribute("data-id");
        // Show confirmation panel
        confirmationPanel.style.display = "flex";
        // Disable the form
        editFormContainer.style.pointerEvents = "none";
    }
});


function confirmDelete(username) {
    selectedRowId = username;
    confirmationPanel.style.display = "flex";
    editFormContainer.style.pointerEvents = "none";
}

// <------------- DELETE ROW AND TABLE REFRESH CODE ------------->
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;  // To store the ID of the row to be deleted

const deleteMessage = document.getElementById("delete-message");  // Reference to the success message

confirmDeleteButton.addEventListener("click", async () => {
    if (selectedRowId) {
        try {
            // Delete the record from Firestore
            const farmerDocRef = doc(db, "tb_users", selectedRowId);
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

deleteSelectedBtn.addEventListener("click", () => {
    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");

    idsToDelete = [];
    selectedCheckboxes.forEach((checkbox) => {
        const username = checkbox.getAttribute("data-user-name");
        if (username) {
            idsToDelete.push(username);
        }
    });

    if (idsToDelete.length > 0) {
        // Show bulk delete panel
        bulkDeletePanel.classList.add("show");
    } else {
        showDeleteMessage("No farmers selected for deletion.", false);
    }
});

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        for (const username of idsToDelete) {
            const q = query(collection(db, "tb_users"), where("user_name", "==", username));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (docSnapshot) => {
                const docRef = doc(db, "tb_users", docSnapshot.id);
                await deleteDoc(docRef);
                console.log(`Account with Username of ${username} deleted.`);
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
        }, 300);
    }, 3000); 
}

fetch_farmer_accounts();
fetch_barangays();

