import {
    collection,
    getDocs,
    getDoc,
    getFirestore,
    query,
    where,
    deleteDoc,
    updateDoc,
    Timestamp,
    onSnapshot,
    setDoc,
    addDoc,
    arrayRemove,
    doc
  } from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);

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

// <-----------------------ACTIVITY LOG CODE----------------------------->
/*
      ACTIVITY LOG RECORD FORMAT
      await saveActivityLog("Update", `Added ${cropStock} ${unit} of stock for ${cropTypeName} by ${userType}`);
      await saveActivityLog("Delete", `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`);
      await saveActivityLog("Create", `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`);
*/
async function saveActivityLog(action, description) {
  // Define allowed actions
  const allowedActions = ["Create", "Update", "Delete"];
  
  // Validate action
  if (!allowedActions.includes(action)) {
    console.error("Invalid action. Allowed actions are: create, update, delete.");
    return;
  }

  // Ensure description is provided
  if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
  }

  // Use onAuthStateChanged to wait for authentication status
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch authenticated user's data from tb_users collection
      const userDocRef = doc(db, "tb_users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error("User data not found in tb_users.");
        return;
      }

      const userData = userDocSnap.data();
      const userName = userData.user_name || "Unknown User";
      const userType = userData.user_type || "Unknown Type";

      const currentTimestamp = Timestamp.now().toDate();
      const date = currentTimestamp.toLocaleDateString("en-US");
      const time = currentTimestamp.toLocaleTimeString("en-US");

      const activityLogCollection = collection(db, "tb_activity_log");

      try {
        // Fetch and increment the activity_log_id_counter
        const counterDocRef = doc(db, "tb_id_counters", "activity_log_id_counter");
        const counterDocSnap = await getDoc(counterDocRef);

        if (!counterDocSnap.exists()) {
          console.error("Counter document not found.");
          return;
        }

        let currentCounter = counterDocSnap.data().value || 0;
        let newCounter = currentCounter + 1;

        // Update the counter in the database
        await updateDoc(counterDocRef, { value: newCounter });

        // Use the incremented counter as activity_log_id
        await addDoc(activityLogCollection, {
          activity_log_id: newCounter, // Use counter instead of a placeholder
          username: userName,
          user_type: userType,
          activity: action,
          activity_desc: description, // Add descriptive message
          date: date,
          time: time
        });

        console.log("Activity log saved successfully with ID:", newCounter);
      } catch (error) {
        console.error("Error saving activity log:", error);
      }
    } else {
      console.error("No authenticated user found.");
    }
  });
}

async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
                    const userSnapshot = await getDocs(userQuery);

                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        const userName = userData.user_name;  
                        const userType = userData.user_type;  
                        
                        resolve({ user_name: userName, email: user.email, user_type: userType });
                    } else {
                        console.error("User record not found in tb_users.");
                        reject("User record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching user from tb_users:", error);
                    reject(error);
                }
            } else {
                reject("No authenticated user.");
            }
        });
    });
}


function fetch_user_accounts(filter = {}) {
    const q = collection(db, "tb_users");

    onSnapshot(q, async (querySnapshot) => {
        // Clear the array only once before processing the snapshot
        const userAccountsTemp = [];
        const missingUsernames = [];

        // Use Promise.all to wait for all doc existence checks in parallel
        const promises = querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            
            try {
                // Check if the document still exists
                const docRef = doc.ref;
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    console.warn(`User data not found in tb_users: ${data.user_name || "Unknown User"}`);
                    return;
                }

                const searchTerm = filter.search?.toLowerCase();

                const matchesSearch = searchTerm
                    ? `${data.first_name || ""} ${data.middle_name || ""} ${data.last_name || ""}`
                          .toLowerCase()
                          .includes(searchTerm) ||
                      (data.user_name || "").toLowerCase().includes(searchTerm) ||
                      (data.barangay_name || "").toLowerCase().includes(searchTerm) ||
                      (data.user_type || "").toLowerCase().includes(searchTerm)
                    : true;

                const matchesBarangay = filter.barangay_name
                    ? (data.barangay_name || "").toLowerCase() === filter.barangay_name.toLowerCase()
                    : true;

                if (matchesSearch && matchesBarangay) {
                    userAccountsTemp.push({ id: doc.id, ...data });
                }
            } catch (error) {
                console.error(`Error processing document: ${doc.id}`, error);
            }
        });

        await Promise.all(promises);

        // Sort the results by username
        userAccountsTemp.sort((a, b) => {
            const userNameA = a.user_name || "";
            const userNameB = b.user_name || "";
            const missName = formatName(a.first_name, a.middle_name, a.last_name);

            if (!userNameA) {
                missingUsernames.push(missName);
                return 0;
            }

            // Alphabetical Comparison (A-Z)
            return userNameA.localeCompare(userNameB, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (missingUsernames.length > 0) {
            console.log("Usernames are not retrieved for the following User Accounts: " + missingUsernames.join(", "));
        }

        // Update the global userAccounts with the latest data
        userAccounts = userAccountsTemp;

        currentPage = 1;
        updateTable();
        updatePagination();
    }, (error) => {
        console.error("Error Fetching User Accounts:", error);
    });
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
        tableBody.innerHTML = `<tr><td colspan="7">No records found</td></tr>`;
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
                <button class="action-btn view-btn" data-id="${data.user_name}" title="View">
                    <img src="/images/eye.png" alt="View">
                </button>
                <button class="action-btn edit-btn" data-id="${data.user_name}" title="Edit">
                    <img src="/images/Edit.png" alt="Edit">
                </button>
                <button class="action-btn delete-btn" data-id="${data.user_name}" title="Delete">
                    <img src="/images/Delete.png" alt="Delete">
                </button>
            </td>
        `;
        tableBody.appendChild(row);
        const checkbox = row.querySelector(".checkbox");
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
                window.location.href = "supervisor_users_edit.html";
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
                window.location.href = "supervisor_users_view.html";
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
        const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userDocId = userDoc.id;

            // Show confirmation before deleting
            confirmationPanel.style.display = "flex";
            editFormContainer.style.pointerEvents = "none";

            // Store the selected row ID and user name
            selectedRowId = userDocId;

            // Store the username for deletion
            confirmDeleteButton.dataset.userName = user_name;

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
            const userName = confirmDeleteButton.dataset.userName;

            // Archive before deleting
            await archiveAndDelete("tb_users", "user_name", [userName]);

            // Only delete after archiving succeeds
            const userDocRef = doc(db, "tb_users", selectedRowId);
            await deleteDoc(userDocRef);
            
            console.log(`Archived and deleted: ${userName}`);

            fetch_user_accounts();

            // Show success message
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
            console.error("Error archiving or deleting record:", error);
            showDeleteMessage("Error archiving or deleting record.", false);
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

// Function to archive and delete documents from a given collection while managing archive_id_counter
async function archiveAndDelete(collectionName, matchField, valuesToDelete) {
    if (valuesToDelete.length === 0) {
        console.warn("No items selected for deletion.");
        return;
    }

    try {
        const mainCollection = collection(db, collectionName);
        const archiveCollection = collection(db, "tb_archive");
        const counterDocRef = doc(db, "tb_id_counters", "archive_id_counter");
        let hasArchived = false;

        // Retrieve the authenticated user's username and type
        const user = await getAuthenticatedUser();
        const userName = user.user_name;   // Use fetched user_name
        const userType = user.user_type;   // Use fetched user_type

        const counterDocSnap = await getDoc(counterDocRef);
        let archiveCounter = counterDocSnap.exists() ? counterDocSnap.data().counter : 0;

        if (isNaN(archiveCounter)) {
            archiveCounter = 0;
        }

        for (const value of valuesToDelete) {
            const querySnapshot = await getDocs(query(mainCollection, where(matchField, "==", value)));

            if (!querySnapshot.empty) {
                for (const docSnapshot of querySnapshot.docs) {
                    archiveCounter++;
                    const data = docSnapshot.data();
                    const archiveId = archiveCounter;

                    const now = new Date();
                    const archiveDate = now.toISOString().split('T')[0];
                    const hours = now.getHours();
                    const minutes = now.getMinutes();
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const archiveTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

                    const archivedData = {
                        ...data,
                        archive_id: archiveId,
                        document_type: "User Account",
                        document_name: `${data.user_type} Account of ${data.first_name} ${data.middle_name} ${data.last_name}`,
                        archive_date: archiveDate,
                        archive_time: archiveTime,
                        archived_by: {
                            user_name: userName,
                            user_type: userType
                        }
                    };

                    const archiveRef = doc(archiveCollection);
                    await setDoc(archiveRef, archivedData);

                    await deleteDoc(doc(db, collectionName, docSnapshot.id));

                    console.log(`Archived and deleted document ID from ${collectionName}:`, docSnapshot.id);
                    hasArchived = true;
                }
            }
        }

        if (hasArchived) {
            await setDoc(counterDocRef, { counter: archiveCounter }, { merge: true });
        } else {
            console.warn(`WARNING: No records found in ${collectionName} for deletion.`);
        }

        await saveActivityLog("Delete", `Archived ${valuesToDelete.length} User Accounts`);
        console.log(`Processing complete for User Accounts:`, valuesToDelete);
        showDeleteMessage(`Selected User Accounts have been archived`, true);

    } catch (error) {
        console.error(`Error archiving or deleting records from ${collectionName}:`, error);
        showDeleteMessage(`Error processing user accounts!`, false);
    }
}


// Modify bulk delete functionality to use archiveAndDelete
// Function to check if the current user is trying to delete their own account
async function currentAccountChecker(userNamesToDelete) {
    try {
        const user = await getAuthenticatedUser();  // Get the current authenticated user
        const currentUserName = user.user_name;     // Current user's user_name

        return userNamesToDelete.includes(currentUserName);
    } catch (error) {
        console.error("Error fetching authenticated user:", error);
        return false;
    }
}

// Bulk delete functionality with self-deletion prevention
deleteSelectedBtn.addEventListener("click", async () => {
    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");

    idsToDelete = [];
    let hasInvalidId = false;

    for (const checkbox of selectedCheckboxes) {
        const user_name = checkbox.getAttribute("data-user-name");

        if (!user_name || user_name.trim() === "") {
            hasInvalidId = true;
            break;
        }

        try {
            const q = query(collection(db, "tb_users"), where("user_name", "==", user_name));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                hasInvalidId = true;
                break;
            }

            idsToDelete.push(user_name);
        } catch (error) {
            console.error("Error fetching user records:", error);
            hasInvalidId = true;
            break;
        }
    }

    if (hasInvalidId) {
        showDeleteMessage("ERROR: Username of one or more selected records are invalid", false);
    } else {
        const isDeletingOwnAccount = await currentAccountChecker(idsToDelete);

        if (isDeletingOwnAccount) {
            showDeleteMessage("You cannot delete your own account while logged in", false);
        } else {
            bulkDeletePanel.classList.add("show");
        }
    }
});

// Confirm delete with archive functionality
confirmDeleteBtn.addEventListener("click", async () => {
    try {
        await archiveAndDelete("tb_users", "user_name", idsToDelete);
        fetch_user_accounts();
    } catch (error) {
        console.error("Error archiving or deleting users:", error);
        showDeleteMessage("Error archiving or deleting users. Please try again.", false);
    }

    bulkDeletePanel.classList.remove("show");
});

// Cancel delete action
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

