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
const userSelect = document.getElementById("user-select");
const actSelect = document.getElementById("activity-select");
const searchBar = document.getElementById("search-bar");
let activityLogs = [];

// Pagination controls
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
let currentPage = 1;
const rowsPerPage = 10;

// <---------------------------- INITIALIZE ---------------------------->
document.addEventListener("DOMContentLoaded", () => {
    fetch_activity_logs();
    fetchUsers();
    fetchActivities();
});

// Populate user dropdown and maintain filtering consistency
async function fetchUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_activity_log"));
        const userSelect = document.getElementById("user-select");
        let addedUsernames = new Set();

        // Clear previous options and add default "All Users" option
        userSelect.innerHTML = `<option value="">Select User</option>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const userName = data.username;

            if (userName && !addedUsernames.has(userName.toLowerCase())) {
                addedUsernames.add(userName.toLowerCase());
                const option = document.createElement("option");
                option.value = userName.toLowerCase();
                option.textContent = userName;
                userSelect.appendChild(option);
            }
        });

        // Apply filter when dropdown value changes
        userSelect.addEventListener("change", () => {
            const selectedActivity = document.getElementById("activity-select").value; // Get current activity filter
            fetch_activity_logs({ user: userSelect.value.toLowerCase(), activity: selectedActivity });
        });

    } catch (error) {
        console.error("Error Fetching Users:", error);
    }
}

// Populate activity dropdown & update logs when selection changes
async function fetchActivities() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_activity_log"));
        const actSelect = document.getElementById("activity-select");
        let addedActivities = new Set();

        // Clear previous options and add default "All Activities" option
        actSelect.innerHTML = `<option value="">Select Activity</option>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const activity = data.activity;

            if (activity && !addedActivities.has(activity.toLowerCase())) {
                addedActivities.add(activity.toLowerCase()); // Store in lowercase for consistency
                const option = document.createElement("option");
                option.value = activity.toLowerCase();
                option.textContent = activity; // Keep original case for display
                actSelect.appendChild(option);
            }
        });

        // Apply filter when dropdown value changes
        actSelect.addEventListener("change", () => {
            const selectedUser = document.getElementById("user-select").value; // Get current user filter
            fetch_activity_logs({ activity: actSelect.value.toLowerCase(), user: selectedUser });
        });

    } catch (error) {
        console.error("Error Fetching Activities:", error);
    }
}

// Real-time listener to fetch and update activity logs based on filters
function fetch_activity_logs(filter = {}) {
    const activityLogsRef = collection(db, "tb_activity_log");
    onSnapshot(activityLogsRef, (snapshot) => {
        activityLogs = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            const searchTerm = filter.search?.toLowerCase().trim();
            const selectedUser = filter.user?.toLowerCase() || ""; 
            const selectedActivity = filter.activity?.toLowerCase() || ""; // Get selected activity & make lowercase

            // Convert all relevant fields to lowercase for case-insensitive matching
            const activityField = (data.activity || "").toLowerCase();
            const activityDescField = (data.activity_desc || "").toLowerCase();
            const usernameField = (data.username || "").toLowerCase();
            const userTypeField = (data.user_type || "").toLowerCase();
            const dateField = (data.date || "").toLowerCase();
            const timeField = (data.time || "").toLowerCase();

            // Match search term (date, time, user_type, username, activity_desc)
            const matchesSearch = searchTerm
                ? `${dateField} ${timeField} ${userTypeField} ${usernameField} ${activityDescField}`
                    .includes(searchTerm)
                : true;

            // Match selected user (if not default "All Users")
            const matchesUser = selectedUser ? usernameField === selectedUser : true;

            // Match selected activity (if not default "All Activities")
            const matchesActivity = selectedActivity ? activityField === selectedActivity : true;

            if (matchesSearch && matchesUser && matchesActivity) {
                activityLogs.push({ id: doc.id, ...data });
            }
        });

        // Sort logs by date & time (latest first)
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
            <td>${log.activity_desc || "N/A"}</td>
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
    const selectedUser = userSelect.value || null;  // Preserve selected user filter
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

let lastChecked = null;

// <------------- Checkbox Change Event Listener -------------> 
tableBody.addEventListener("click", (event) => {
    // Ensure the event only listens for checkboxes
    if (event.target.matches("input[type='checkbox'].checkbox")) {
        const checkboxes = Array.from(tableBody.querySelectorAll("input[type='checkbox'].checkbox"));

        if (event.shiftKey && lastChecked) {
            const start = checkboxes.indexOf(lastChecked);
            const end = checkboxes.indexOf(event.target);

            const range = [start, end].sort((a, b) => a - b);

            // Apply the state of the last clicked checkbox to the range
            const isChecked = lastChecked.checked;

            for (let i = range[0]; i <= range[1]; i++) {
                checkboxes[i].checked = isChecked;
            }
        }

        lastChecked = event.target;

        // Toggle bulk delete button
        toggleBulkDeleteButton();

        // Log selected activity log IDs
        const selectedIds = checkboxes
            .filter(cb => cb.checked)
            .map(cb => cb.getAttribute("data-id"));

        console.log("Selected IDs: ", selectedIds);
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
userSelect.addEventListener("change", () => {
    const selectedUser = userSelect.value;
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
let isDeleting = false;  // Flag to prevent multiple clicks

deleteSelectedBtn.addEventListener("click", async () => {
    if (isDeleting) return;  // Prevent multiple clicks
    isDeleting = true;        // Set flag to true

    const selectedCheckboxes = tableBody.querySelectorAll("input[type='checkbox']:checked");

    idsToDelete = [];
    let hasInvalidId = false;

    for (const checkbox of selectedCheckboxes) {
        const activityLogId = checkbox.getAttribute("data-id");

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

    isDeleting = false;  // Reset flag
});

confirmDeleteBtn.addEventListener("click", async () => {
    if (isDeleting) return;  // Prevent multiple clicks
    isDeleting = true;        // Set flag to true

    try {
        for (const activityLogId of idsToDelete) {
            const q = query(collection(db, "tb_activity_log"), where("activity_log_id", "==", Number(activityLogId)));
            const querySnapshot = await getDocs(q);

            for (const docSnapshot of querySnapshot.docs) {
                const docRef = doc(db, "tb_activity_log", docSnapshot.id);
                await deleteDoc(docRef);
                console.log(`Log with activityLogId of ${activityLogId} deleted.`);  // Only one log per deletion
            }
        }

        showDeleteMessage("Selected logs have been deleted.", true);
        fetch_activity_logs();  // Refresh logs after deletion
    } catch (error) {
        console.error("Error deleting logs:", error);
        showDeleteMessage("Error deleting logs. Please try again.", false);
    }

    bulkDeletePanel.classList.remove("show");
    isDeleting = false;  // Reset flag
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
