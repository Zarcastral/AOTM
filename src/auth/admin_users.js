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
let userAccounts = [];

async function fetch_user_accounts(filter = {}) {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_users"));
        userAccounts = [];

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
                ? (data.barangay_name || "").toLowerCase() === filter.barangay_name.toLowerCase()
                : true;

            if (matchesSearch && matchesBarangay) {
                userAccounts.push({ id: doc.id, ...data });
            }
        });

        const missingUsernames = []; // Array to store users with undefined IDs
        // <------------- FETCHED DATA SORT BY USERNAME ASCENSION ------------->
        userAccounts.sort((a, b) => {
            const userNameA = a.user_name;
            const userNameB = b.user_name;
            const missName = formatName(a.first_name, a.middle_name, a.last_name);
        
            if (userNameA === undefined) {
                missingUsernames.push(missName);
                return 0; /* Keeps the current order of undefined values kapag ginawang 1 mapupunta lahat ng
                users na walang id sa pinaka dulo*/
            }
            // Alphabetical Comparison (A-Z)
            if (isNaN(userNameA) && isNaN(userNameB)) {
                return String(userNameA).localeCompare(String(userNameB), undefined, {numeric: true, sensitivity: 'base' });
            }
        });
                // Log missing user IDs in bulk
        if (missingUsernames.length > 0) {
            console.log("Usernames are not retrieved for the following User Accounts: " + missingUsernames.join(", "));
        }

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
    const pageData = userAccounts.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5">No records found.</td></tr>`;
    }

    pageData.forEach((data) => {
        const row = document.createElement("tr");
        const formattedName = formatName(data.first_name, data.middle_name, data.last_name);
        const formattedBarangay = formatBarangay(data.barangay_name);
        const formattedUserType = formatUserType(data.user_type);
        row.innerHTML = `
            <td><input type="checkbox" class="checkbox" data-user-name="${data.user_name}"></td>
            <td>${data.user_name || "Account name not recorded"}</td>
            <td>${formattedName || "User's name not recorded"}</td>
            <td>${formattedUserType || "User's role not recorded"}</td>
            <td>${formattedBarangay || "Barangay not recorded"}</td>
            <td>${data.contact || "Contact number not recorded"}</td>
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
            console.log("Selected username: ", username);
        } else {
            selectedUsername = null;
            console.log("Selected username: ", "Username Unselected");

        }
    }
});

function updatePagination() {
    const totalPages = Math.ceil(userAccounts.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    updatePaginationButtons();
}


function updatePaginationButtons() {
    const totalPages = Math.ceil(userAccounts.length / rowsPerPage);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}


function changePage(direction) {
    const totalPages = Math.ceil(userAccounts.length / rowsPerPage);
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

    const username = target.getAttribute("data-id");

    if (target.classList.contains("edit-btn")) {
        editUserAccount(username);
    } else if (target.classList.contains("view-btn")) {
        viewUserAccount(username);
    } else if (target.classList.contains("delete-btn")) {
        deleteUserAccount(username);
    }
});

// <------------- EDIT BUTTON CODE ------------->
async function editUserAccount(user_name) {
    try {
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                localStorage.setItem("userData", JSON.stringify(userData));
                window.location.href = "admin_users_edit.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.error("Error fetching user data for edit:", error);
    }
}


// <------------- VIEW BUTTON CODE ------------->
async function viewUserAccount(user_name) {
    try {
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
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
async function deleteUserAccount(user_name) {
    try {
        // Query Firestore to get the document ID based on user_name
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Assuming user_name is unique, get the first matched document
            const userDoc = querySnapshot.docs[0];
            const userDocId = userDoc.id;

            // Show confirmation before deleting
            confirmationPanel.style.display = "flex";
            editFormContainer.style.pointerEvents = "none";

            // Store the selected row ID
            selectedRowId = userDocId;
        } else {
            showDeleteMessage("No matching record found, unable to delete.", false);
        }
    } catch (error) {
        console.error("Error deleting User Account:", error);
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

            const userDocRef = doc(db, "tb_users", selectedRowId);
            await deleteDoc(userDocRef);
            console.log("Record deleted successfully!");

            fetch_user_accounts();

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
    fetch_user_accounts({
        search: searchBar.value,
        barangay_name: barangaySelect.value,
    });
});

barangaySelect.addEventListener("change", () => {
    fetch_user_accounts({
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
        const user_name = checkbox.getAttribute("data-user-name");

        // Validate usernmae (null, undefined, or empty string)
        if (!user_name || user_name.trim() === "") {
            hasInvalidId = true;
            break;
        }

        /*  Check if the user_name exists in the database
            kailangan to for error trapping kasi chine check nya muna kung yung na retrieve na farmer id
            dun sa mga checkboxes is nag eexist talaga sa firestore database
        */
        try {
            const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                hasInvalidId = true;
                break;
            }

            idsToDelete.push(user_name);
        } catch (error) {
            console.error("Error fetching farmer records:", error);
            hasInvalidId = true;
            break;
        }
    }

    if (hasInvalidId) {
        showDeleteMessage("ERROR: Username of one or more selected records are invalid", false);
    } else {
        bulkDeletePanel.classList.add("show");
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
        
        showDeleteMessage("Selected users have been deleted.", true);
        fetch_user_accounts();
    } catch (error) {
        console.error("Error deleting users:", error);
        showDeleteMessage("Error deleting users. Please try again.", false);
    }

    bulkDeletePanel.classList.remove("show"); 
});

cancelDeleteBtn.addEventListener("click", () => {

    bulkDeletePanel.classList.remove("show"); 
});

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

fetch_user_accounts();
fetch_barangays();

