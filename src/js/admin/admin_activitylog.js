import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    where,
    query,
    onSnapshot,
    getFirestore
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

const tableBody = document.querySelector("tbody");
const barangaySelect = document.getElementById("barangay-select");
const searchBar = document.getElementById("search-bar");
let activityLogs = [];

// Pagination controls
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
let currentPage = 1;
const rowsPerPage = 5;

// Fetch usernames from tb_users
async function fetch_users() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_users"));
        let addedUsernames = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const userName = data.user_name;

            if (userName && !addedUsernames.includes(userName)) {
                addedUsernames.push(userName);
                const option = document.createElement("option");
                option.value = userName;
                option.textContent = userName;
                barangaySelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error Fetching Usernames:", error);
    }
}

// Real-time listener to fetch and update activity logs based on selected user
function fetch_activity_logs(filter = {}) {
    const activityLogsRef = collection(db, "tb_activity_log");
    onSnapshot(activityLogsRef, (snapshot) => {
        activityLogs = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            const searchTerm = filter.search?.toLowerCase().trim();
            const selectedUser = filter.user || ""; // Get selected user if any

            // Updated matchesSearch to use date and time instead of activity
            const matchesSearch = searchTerm
                ? `${data.date || ""} ${data.time || ""} ${data.user_type || ""} ${data.username || ""}`
                      .toLowerCase()
                      .includes(searchTerm)
                : true;

            const matchesUser = selectedUser
                ? data.username === selectedUser
                : true; // Filter by user if selected

            if (matchesSearch && matchesUser) {
                activityLogs.push({ id: doc.id, ...data });
            }
        });

        // Sort activityLogs by date and time in descending order (latest to oldest)
        activityLogs.sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time}`);
            const dateB = new Date(`${b.date} ${b.time}`);
            return dateB - dateA;
        });

        displayActivityLogs(activityLogs);
    });
}


let selectedActivityLogId = null;

function displayActivityLogs(activityLogs) {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = activityLogs.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">No records found.</td></tr>`;
    }

    pageData.forEach((log) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="checkbox">
                <input type="checkbox" class="checkbox" data-id="${log.activity_log_id}">
            </td>
            <td>${log.activity_log_id}</td>
            <td>${log.username || "N/A"}</td>
            <td>${log.user_type || "N/A"}</td>
            <td>${log.activity || "N/A"}</td>
            <td>${log.date || "N/A"}</td>
            <td>${log.time || "N/A"}</td>
        `;
        tableBody.appendChild(row);

        const checkbox = row.querySelector(".checkbox");
    });

    toggleBulkDeleteButton()
    updatePagination();
}

searchBar.addEventListener("input", () => {
    const searchTerm = searchBar.value.trim();
    const selectedUser = barangaySelect.value || null;  // Preserve selected user filter
    currentPage = 1;  // Reset to first page on search
    fetch_activity_logs({ search: searchTerm, user: selectedUser });
});

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
        const activityLogId = event.target.getAttribute("data-id");
        toggleBulkDeleteButton();
        if (event.target.checked) {
            selectedActivityLogId = activityLogId;
            console.log("Selected activityLogId: ", activityLogId);
        } else {
            selectedActivityLogId = null;
            console.log("Selected activityLogId: ", "activityLogId Unselected");

        }
    }
});

function updatePagination() {
    const totalPages = Math.ceil(activityLogs.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    updatePaginationButtons();
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(activityLogs.length / rowsPerPage);
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(activityLogs.length / rowsPerPage);
    if (direction === "prev" && currentPage > 1) {
        currentPage--;
    } else if (direction === "next" && currentPage < totalPages) {
        currentPage++;
    }
    displayActivityLogs(activityLogs);
    updatePagination();
}

// Handle user selection change to update activity logs
barangaySelect.addEventListener("change", () => {
    const selectedUser = barangaySelect.value;
    currentPage = 1; // Reset to first page on filter change
    fetch_activity_logs({ user: selectedUser || null });
});

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <---------------------------- BULK DELETE CODE ---------------------------->
const deleteSelectedBtn = document.getElementById("bulk-delete");
const bulkDeletePanel = document.getElementById("bulk-delete-panel");
const confirmDeleteBtn = document.getElementById("confirm-bulk-delete");
const cancelDeleteBtn = document.getElementById("cancel-bulk-delete");
const deleteMessage = document.getElementById("delete-message");
let idsToDelete = [];

deleteSelectedBtn.addEventListener("click", async () => {
    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");

    idsToDelete = [];
    let hasInvalidId = false;

    for (const checkbox of selectedCheckboxes) {
        const activityLogId = checkbox.getAttribute("data-id");

        // Validate activityLogId (null, undefined, or empty string)
        if (!activityLogId || activityLogId.trim() === "") {
            hasInvalidId = true;
            break;
        }

        try {
            const q = query(collection(db, "tb_activity_log"), where("activity_log_id", "==", Number(activityLogId)));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                hasInvalidId = true;
                break;
            }

            idsToDelete.push(activityLogId);
        } catch (error) {
            console.error("Error fetching activity log records:", error);
            hasInvalidId = true;
            break;
        }
    }

    if (hasInvalidId) {
        showDeleteMessage("ERROR: activityLogId of one or more selected records are invalid", false);
    } else {
        bulkDeletePanel.classList.add("show");
    }
});

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        for (const activityLogId of idsToDelete) {
            const q = query(collection(db, "tb_activity_log"), where("activity_log_id", "==", Number(activityLogId)));
            const querySnapshot = await getDocs(q);

            for (const docSnapshot of querySnapshot.docs) {
                const docRef = doc(db, "tb_activity_log", docSnapshot.id);
                await deleteDoc(docRef);
                console.log(`Log with activityLogId of ${activityLogId} deleted.`);
            }
        }

        showDeleteMessage("Selected logs have been deleted.", true);
        fetch_activity_logs();  // Refresh logs after deletion
    } catch (error) {
        console.error("Error deleting logs:", error);
        showDeleteMessage("Error deleting logs. Please try again.", false);
    }

    bulkDeletePanel.classList.remove("show");
});

cancelDeleteBtn.addEventListener("click", () => {
    bulkDeletePanel.classList.remove("show");
});

// Function to display messages
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

// Initial data fetch
fetch_activity_logs();
fetch_users();
