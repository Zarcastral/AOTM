import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    setDoc,
    where,
    Timestamp,
    query,
    onSnapshot,
    getFirestore
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

const tableBody = document.querySelector("tbody");
const userSelect = document.getElementById("user-select");
const actSelect = document.getElementById("user-type-select");
const searchBar = document.getElementById("search-bar");
let archiveRecords = [];

// Pagination controls
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
let currentPage = 1;
const rowsPerPage = 5;

// <---------------------------- INITIALIZE ---------------------------->
document.addEventListener("DOMContentLoaded", () => {
    fetchArchive();
    fetchUsers();
    fetchUserType();
    fetchDocumentType();
    restoreButtonListeners();
});

// <-----------------------ACTIVITY LOG CODE----------------------------->
async function saveActivityLog(action, description) {
    const allowedActions = ["Create", "Update", "Delete"];
    if (!allowedActions.includes(action)) {
      console.error(
        "Invalid action. Allowed actions are: create, update, delete."
      );
      return;
    }
    if (!description || typeof description !== "string") {
      console.error("Activity description is required and must be a string.");
      return;
    }
  
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Use user.email instead of user.uid to query tb_users
        const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
        const userQuerySnapshot = await getDocs(userQuery);
        
        if (userQuerySnapshot.empty) {
          console.error("User data not found in tb_users for email:", user.email);
          return;
        }
  
        const userDocSnap = userQuerySnapshot.docs[0]; // Get the first matching document
        const userData = userDocSnap.data();
        const userName = userData.user_name || "Unknown User";
        const userType = userData.user_type || "Unknown Type";
  
        const currentTimestamp = Timestamp.now().toDate();
        const date = currentTimestamp.toLocaleDateString("en-US");
        const time = currentTimestamp.toLocaleTimeString("en-US");
  
        const activityLogCollection = collection(db, "tb_activity_log");
        try {
          const counterDocRef = doc(
            db,
            "tb_id_counters",
            "activity_log_id_counter"
          );
          const counterDocSnap = await getDoc(counterDocRef);
          if (!counterDocSnap.exists()) {
            console.error("Counter document not found.");
            return;
          }
  
          let currentCounter = counterDocSnap.data().value || 0;
          let newCounter = currentCounter + 1;
          await updateDoc(counterDocRef, { value: newCounter });
  
          await addDoc(activityLogCollection, {
            activity_log_id: newCounter,
            username: userName,
            user_type: userType,
            activity: action,
            activity_desc: description,
            date: date,
            time: time,
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

function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}
// Populate user dropdown and maintain filtering consistency
async function fetchUsers(userType = "") {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_archive"));
        const userSelect = document.getElementById("user-select");
        let addedUsernames = new Set();

        // Clear previous options and add default "Select User" option
        userSelect.innerHTML = `<option value="">Select User</option>`;

        if (userType) {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const archivedBy = data.archived_by;

                if (archivedBy) {
                    const userName = archivedBy.user_name;
                    const userTypeFromDoc = archivedBy.user_type;

                    if (userName && userTypeFromDoc.toLowerCase() === userType.toLowerCase() && !addedUsernames.has(userName.toLowerCase())) {
                        addedUsernames.add(userName.toLowerCase());
                        const option = document.createElement("option");
                        option.value = userName.toLowerCase();
                        option.textContent = userName;
                        userSelect.appendChild(option);
                    }
                }
            });
        }

        // Apply filter when dropdown value changes
        userSelect.addEventListener("change", () => {
            const selectedUserType = document.getElementById("user-type-select").value; // Get current user type filter
            fetchArchive({ user: userSelect.value.toLowerCase(), userType: selectedUserType });
        });

    } catch (error) {
        console.error("Error Fetching Users:", error);
    }
}

// Populate user type dropdown & update logs when selection changes
async function fetchUserType() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_archive"));
        const actSelect = document.getElementById("user-type-select");
        let addedUserType = new Set();

        // Clear previous options and add default "Select User Type" option
        actSelect.innerHTML = `<option value="">Select User Type</option>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const archivedBy = data.archived_by;

            if (archivedBy) {
                const userType = archivedBy.user_type;

                if (userType && !addedUserType.has(userType.toLowerCase())) {
                    addedUserType.add(userType.toLowerCase()); // Store in lowercase for consistency
                    const option = document.createElement("option");
                    option.value = userType.toLowerCase();
                    option.textContent = userType; // Keep original case for display
                    actSelect.appendChild(option);
                }
            }
        });

        // Apply filter when dropdown value changes
        actSelect.addEventListener("change", () => {
            const selectedUserType = actSelect.value; // Get current user type filter
            fetchUsers(selectedUserType); // Fetch users based on selected user type
            fetchArchive({ userType: selectedUserType.toLowerCase() });
        });

    } catch (error) {
        console.error("Error Fetching User Types:", error);
    }
}
async function fetchDocumentType() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_archive"));
        const docTypeSelect = document.getElementById("document-type-select");
        let addedDocumentType = new Set();

        // Clear previous options and add default "Select Document Type" option
        docTypeSelect.innerHTML = `<option value="">Select Document Type</option>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const documentType = data.document_type;

            if (documentType && !addedDocumentType.has(documentType.toLowerCase())) {
                addedDocumentType.add(documentType.toLowerCase()); // Store in lowercase for consistency
                const option = document.createElement("option");
                option.value = documentType.toLowerCase();
                option.textContent = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase(); // Capitalize first letter
                docTypeSelect.appendChild(option);
            }
        });

        // Apply filter when dropdown value changes
        docTypeSelect.addEventListener("change", () => {
            const selectedDocumentType = document.getElementById("document-type-select").value; // Get current document type filter
            fetchArchive({ documentType: docTypeSelect.value.toLowerCase() });
        });

    } catch (error) {
        console.error("Error Fetching Document Types:", error);
    }
}

function fetchArchive(filter = {}) {
    const archiveRef = collection(db, "tb_archive");
    onSnapshot(archiveRef, (snapshot) => {
        archiveRecords = []; // Update the global array

        snapshot.forEach((doc) => {
            const data = doc.data();
            const searchTerm = filter.search?.toLowerCase().trim();
            const selectedUser = filter.user?.toLowerCase() || "";
            const selectedDocumentType = filter.documentType?.toLowerCase() || "";
            const selectedUserType = filter.userType?.toLowerCase() || "";

            const cropTypeName = (data.crop_type_name || "").toLowerCase();
            const cropName = (data.crop_name || "").toLowerCase();
            const archiveDate = (data.archive_date || "").split("T")[0]; // Extract only the date part
            const timeField = (data.time || "");
            const archiveDocument = (data.document_type || "").toLowerCase();
            const documentId = (data.crop_type_id || "");
            const archiveId = (data.archive_id || ""); // Fetch the archive_id field
            const documentName = (data.document_name || ""); // Fetch the archive_id field

            const archivedBy = data.archived_by || {};
            const userName = (archivedBy.user_name || "").toLowerCase();
            const userType = (archivedBy.user_type || "").toLowerCase();

            const matchesSearch = searchTerm
                ? `${archiveDate} ${timeField} ${cropName} ${cropTypeName} ${documentId}`.includes(searchTerm)
                : true;

            const matchesUser = selectedUser ? userName === selectedUser : true;
            const matchesDocumentType = selectedDocumentType ? archiveDocument === selectedDocumentType : true;
            const matchesUserType = selectedUserType ? userType === selectedUserType : true;

            if (matchesSearch && matchesUser && matchesDocumentType && matchesUserType) {
                archiveRecords.push({ id: doc.id, archive_id: archiveId, ...data, archive_date: archiveDate,
                    user_name: archivedBy.user_name, user_type: archivedBy.user_type, documentName: archivedBy.document_name});
            }
        });

        archiveRecords.sort((a, b) => {
            const archiveIdComparison = b.archive_id - a.archive_id;
            if (archiveIdComparison !== 0) {
                return archiveIdComparison;
            }
            return new Date(`${b.archive_date}T${b.time}`) - new Date(`${a.archive_date}T${a.time}`);
        });

        currentPage = 1;  // Reset to first page on new fetch
        displayArchiveRecords();
    });
}

function displayArchiveRecords() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = archiveRecords.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8">No records found</td></tr>`;
    }

    pageData.forEach((archive) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${archive.archive_id}</td>
            <td>${archive.archive_date || "N/A"}</td>
            <td>${archive.archive_time || "N/A"}</td>
            <td>${archive.user_name || "N/A"}</td>
            <td>${archive.user_type || "N/A"}</td>
            <td>${archive.crop_type_id || archive.email}</td>
            <td>${capitalizeWords(archive.document_type || "N/A")}</td>
            <td>${archive.document_name}</td>
            <td>
                <button class="action-btn restore-btn" data-id="${archive.archive_id}" title="Restore Document">
                    <img src="../../images/restore.png" alt="restore">
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    restoreButtonListeners();
    updatePagination();
}

searchBar.addEventListener("input", () => {
    const searchTerm = searchBar.value.trim();
    const selectedUser = userSelect.value || null;  // Preserve selected user filter
    currentPage = 1;  // Reset to first page on search
    fetchArchive({ search: searchTerm, user: selectedUser });
});
// Add this script after your pageData.forEach loop

function restoreButtonListeners() {
    const restoreButtons = document.querySelectorAll(".restore-btn");
    restoreButtons.forEach(button => {
        button.addEventListener("click", async () => {
            const archiveId = button.getAttribute("data-id");

            // Validate archiveId (null, undefined, or empty string)
            if (!archiveId || archiveId.trim() === "") {
                showRestoreMessage("ERROR: Invalid archiveId", false);
                return;
            }

            try {
                const q = query(collection(db, "tb_archive"), where("archive_id", "==", Number(archiveId)));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    showRestoreMessage("ERROR: No records found for the given archiveId", false);
                    return;
                }

                idsToRestore = [archiveId];
                console.log("Showing restore panel"); // Debugging log
                restorePanel.classList.add("show");
                console.log("Restore panel class list:", restorePanel.classList); // Debugging log
            } catch (error) {
                console.error("Error fetching archive records:", error);
                showRestoreMessage("Error fetching archive records. Please try again.", false);
            }
        });
    });
}

function updatePagination() {
    const totalPages = Math.ceil(archiveRecords.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    updatePaginationButtons();
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(archiveRecords.length / rowsPerPage);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(archiveRecords.length / rowsPerPage);
    if (direction === "prev" && currentPage > 1) {
        currentPage--;
    } else if (direction === "next" && currentPage < totalPages) {
        currentPage++;
    }
    displayArchiveRecords();
}

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <---------------------------- BULK RESTORE CODE ---------------------------->
const restoreButtons = document.querySelectorAll(".restore-btn");
const restorePanel = document.getElementById("restore-panel");
const confirmRestoreBtn = document.getElementById("confirm-restore");
const cancelRestoreBtn = document.getElementById("cancel-restore");
const restoreMessage = document.getElementById("restore-message");
let idsToRestore = [];

restoreButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const archiveId = button.getAttribute("data-id");

        // Validate archiveId (null, undefined, or empty string)
        if (!archiveId || archiveId.trim() === "") {
            showRestoreMessage("ERROR: Invalid archiveId", false);
            return;
        }

        try {
            const q = query(collection(db, "tb_archive"), where("archive_id", "==", Number(archiveId)));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showRestoreMessage("ERROR: No records found for the given archiveId", false);
                return;
            }

            idsToRestore = [archiveId];
            console.log("Showing restore panel"); // Debugging log
            restorePanel.classList.add("show");
            console.log("Restore panel class list:", restorePanel.classList); // Debugging log
        } catch (error) {
            console.error("Error fetching archive records:", error);
            showRestoreMessage("Error fetching archive records. Please try again.", false);
        }
    });
});

// Replace the existing confirmRestoreBtn event listener with this modified version
confirmRestoreBtn.addEventListener("click", async () => {
    try {
        // Ensure an authenticated user exists
        const user = await new Promise((resolve) => {
            onAuthStateChanged(auth, (user) => resolve(user));
        });
        if (!user) {
            console.error("Cannot restore: No authenticated user.");
            showRestoreMessage("Please log in to restore records.", false);
            return;
        }

        console.log("Authenticated user:", user.uid); // Debug: Confirm user

        for (const archiveId of idsToRestore) {
            const q = query(collection(db, "tb_archive"), where("archive_id", "==", Number(archiveId)));
            const querySnapshot = await getDocs(q);

            for (const docSnapshot of querySnapshot.docs) {
                let docData = docSnapshot.data();
                const docRef = doc(db, "tb_archive", docSnapshot.id);

                const documentType = docData.document_type || "Unknown Document";
                const documentName = docData.document_name || docData.crop_type_id || docData.email || "Unknown ID";
                const userName = docData.archived_by?.user_name || "Unknown User";
                const userType = docData.archived_by?.user_type || "Unknown User";

                delete docData.document_name;
                delete docData.document_type;
                delete docData.archive_date;
                delete docData.archive_id;
                delete docData.archive_time;
                delete docData.archived_by;

                let targetCollection = "";
                if (docSnapshot.data().document_type === "Inventory") {
                    if (docData.crop_type_id) {
                        targetCollection = "tb_crop_types";
                    } else if (docData.fertilizer_id) {
                        targetCollection = "tb_fertilizer";
                    }
                } else if (docSnapshot.data().document_type === "Inventory Stock") {
                    if (docData.crop_type_id) {
                        targetCollection = "tb_crop_stock";
                    } else if (docData.fertilizer_id) {
                        targetCollection = "tb_fertilizer_stock";
                    }
                } else if (docSnapshot.data().document_type === "User Account") {
                    targetCollection = "tb_users";
                } else if (docSnapshot.data().document_type === "Farmer Account") {
                    targetCollection = "tb_farmers";
                }

                if (targetCollection) {
                    // Perform the restore
                    await setDoc(doc(db, targetCollection, docSnapshot.id), docData);
                    await deleteDoc(docRef);

                    // Debug: Confirm this point is reached
                    console.log(`Attempting to save activity log for archiveId ${archiveId}`);

                    // Call saveActivityLog with error handling
                    try {
                        await saveActivityLog(
                            "Update",
                            `Restored the ${documentName} originally archived by ${userType} ${userName}`
                        );
                        console.log(`Activity log saved for archiveId ${archiveId}`);
                    } catch (logError) {
                        console.error("Failed to save activity log:", logError);
                        showRestoreMessage("Restored, but activity log failed to save.", true);
                    }

                    console.log(`Record with archiveId of ${archiveId} restored to ${targetCollection}.`);
                } else {
                    console.error(`No valid target collection found for document with archiveId of ${archiveId}.`);
                }
            }
        }

        showRestoreMessage("Selected records have been restored.", true);
        fetchArchive();
    } catch (error) {
        console.error("Error restoring records:", error);
        showRestoreMessage("Error restoring records. Please try again.", false);
    }

    restorePanel.classList.remove("show");
});

// Function to display messages
function showRestoreMessage(message, success) {
    restoreMessage.textContent = message;
    restoreMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
    restoreMessage.style.opacity = '1';
    restoreMessage.style.display = 'block';

    setTimeout(() => {
        restoreMessage.style.opacity = '0';
        setTimeout(() => {
            restoreMessage.style.display = 'none';
        }, 400);
    }, 4000);
}