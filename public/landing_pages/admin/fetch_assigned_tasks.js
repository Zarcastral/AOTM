import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    query,
    updateDoc,
    where,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";

const db = getFirestore(app);

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "fetch.css";
document.head.appendChild(link);

function capitalizeFirstLetter(str) {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

function showSuccessPopup(message) {
    const modal = document.getElementById("success-modal");
    const messageElement = document.getElementById("success-message");
    const closeBtn = document.getElementById("close-success-modal");

    messageElement.textContent = message;
    modal.style.display = "flex";

    closeBtn.onclick = () => (modal.style.display = "none");
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

function showErrorPopup(message) {
    const modal = document.getElementById("error-modal");
    const messageElement = document.getElementById("error-message");
    const closeBtn = document.getElementById("close-error-modal");

    messageElement.textContent = message;
    modal.style.display = "block";

    closeBtn.onclick = () => (modal.style.display = "none");
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

function showWarningPopup(message) {
    const modal = document.getElementById("warning-modal");
    const messageElement = document.getElementById("warning-message");
    const closeBtn = document.getElementById("close-warning-modal");

    messageElement.textContent = message;
    modal.style.display = "block";

    closeBtn.onclick = () => (modal.style.display = "none");
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

function showInfoPopup(message) {
    const modal = document.getElementById("info-modal");
    const messageElement = document.getElementById("info-message");
    const closeBtn = document.getElementById("close-info-modal");

    messageElement.textContent = message;
    modal.style.display = "block";

    closeBtn.onclick = () => (modal.style.display = "none");
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

function showDeleteConfirmationModal(taskId, taskName, cropTypeName) {
    const modal = document.getElementById("delete-confirmation-modal");
    const messageElement = document.getElementById("delete-confirmation-message");
    const confirmBtn = document.getElementById("confirm-delete-btn");
    const cancelBtn = document.getElementById("cancel-delete-btn");

    messageElement.textContent = `You are currently deleting the task "${taskName}" on crop type "${cropTypeName}". Are you sure you want to delete?`;
    modal.style.display = "flex";

    confirmBtn.onclick = () => {
        modal.style.display = "none";
        deleteTask(taskId);
    };

    cancelBtn.onclick = () => (modal.style.display = "none");

    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = "none";
    };
}

async function deleteTask(taskId) {
    try {
        const tasksCollection = collection(db, "tb_task_list");
        const taskQuery = query(tasksCollection, where("task_id", "==", Number(taskId)));
        const querySnapshot = await getDocs(taskQuery);

        if (querySnapshot.empty) {
            showErrorPopup("Task not found!");
            return;
        }

        const deletePromises = querySnapshot.docs.map((taskDoc) => deleteDoc(doc(db, "tb_task_list", taskDoc.id)));
        await Promise.all(deletePromises);

        showSuccessPopup("Task deleted successfully!");
        await fetchAssignedTasks();

        const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
        if (assignedTasks.length === 0) {
            assignedCurrentPage = 1;
        } else if (assignedCurrentPage > totalPages) {
            assignedCurrentPage = totalPages;
        }

        displayAssignedTasks(assignedCurrentPage);
        updateAssignedPagination();
    } catch (error) {
        showErrorPopup("Failed to delete task. Please try again.");
    }
}

window.openEditSubModal = async function openEditSubModal(taskId, taskName) {
    const modal = document.getElementById("edit-subtasks-modal");
    const taskNameDisplay = document.getElementById("edit-task-name-display");
    const subtaskList = document.getElementById("subtask-list-subtasks");
    const saveBtn = document.getElementById("save-subtasks-btn-subtasks");

    taskNameDisplay.textContent = `Task Name: ${taskName}`;
    subtaskList.innerHTML = "";
    saveBtn.setAttribute("data-id", taskId);
    saveBtn.disabled = true;

    try {
        const tasksCollection = collection(db, "tb_task_list");
        const taskQuery = query(tasksCollection, where("task_id", "==", Number(taskId)));
        const querySnapshot = await getDocs(taskQuery);
        if (querySnapshot.empty) return;

        let docId = "";
        let taskData = {};
        querySnapshot.forEach((doc) => {
            docId = doc.id;
            taskData = doc.data();
        });

        initialSubtasks = taskData.subtasks || [];
        initialSubtasks.forEach((subtask, index) => addSubtaskToList(subtask, index));

        saveBtn.setAttribute("data-doc-id", docId);
        modal.style.display = "block";
        toggleSaveButton();
    } catch (error) {
        console.error("Error fetching subtasks:", error); // Added for debugging
    }
};

function addSubtaskToList(subtask, index) {
    const subtaskList = document.getElementById("subtask-list-subtasks");
    const subtaskItem = document.createElement("li");
    subtaskItem.classList.add("subtask-item");
    subtaskItem.setAttribute("data-index", index);

    // Check if subtask is an object with a subtask_name property, otherwise use it as a string
    const subtaskName = typeof subtask === "object" && subtask.subtask_name ? subtask.subtask_name : subtask;

    subtaskItem.innerHTML = `
        <span class="subtask-text">${subtaskName}</span>
        <button class="remove-subtask-btn" onclick="removeSubtask(${index})">
            <img src="../../images/Delete.png" alt="Remove">
        </button>
    `;
    subtaskList.appendChild(subtaskItem);
    toggleSaveButton();
}

window.removeSubtask = function (index) {
    const subtaskItem = document.querySelector(`[data-index="${index}"]`);
    if (subtaskItem) {
        subtaskItem.remove();
        toggleSaveButton();
    }
};

document.getElementById("close-edit-subtasks-modal").addEventListener("click", () => {
    document.getElementById("edit-subtasks-modal").style.display = "none";
    document.getElementById("new-subtask-input-subtasks").value = "";
    document.getElementById("subtask-list-subtasks").innerHTML = "";
});

document.getElementById("add-subtask-btn-subtasks").addEventListener("click", () => {
    const newSubtaskInput = document.getElementById("new-subtask-input-subtasks");
    let newSubtaskName = newSubtaskInput.value.trim();

    if (newSubtaskName !== "") {
        newSubtaskName = capitalizeFirstLetter(newSubtaskName);
        const subtaskList = document.getElementById("subtask-list-subtasks");
        const existingSubtasks = Array.from(subtaskList.children).map((item) =>
            item.querySelector(".subtask-text").textContent.trim().toLowerCase()
        );

        if (existingSubtasks.includes(newSubtaskName.toLowerCase())) {
            showWarningPopup("Subtask already exists! Please enter a different subtask.");
            return;
        }

        const index = subtaskList.children.length;
        addSubtaskToList(newSubtaskName, index);
        newSubtaskInput.value = "";
        document.getElementById("save-subtasks-btn-subtasks").disabled = false;
    } else {
        showInfoPopup("Please enter a valid subtask.");
    }
});

function toggleAddSubtaskButton() {
    const newSubtaskInput = document.getElementById("new-subtask-input-subtasks");
    const addSubtaskBtn = document.getElementById("add-subtask-btn-subtasks");

    if (newSubtaskInput.value.trim() === "") {
        addSubtaskBtn.disabled = true;
        addSubtaskBtn.classList.add("disabled-btn");
    } else {
        addSubtaskBtn.disabled = false;
        addSubtaskBtn.classList.remove("disabled-btn");
    }
}

document.getElementById("new-subtask-input-subtasks").addEventListener("input", toggleAddSubtaskButton);
document.addEventListener("DOMContentLoaded", toggleAddSubtaskButton);

let initialSubtasks = [];

function toggleSaveButton() {
    const saveBtn = document.getElementById("save-subtasks-btn-subtasks");
    const subtaskList = document.getElementById("subtask-list-subtasks");
    const currentSubtasks = Array.from(subtaskList.children).map((item) =>
        item.querySelector(".subtask-text").textContent.trim()
    );
    const isSameAsInitial = JSON.stringify(currentSubtasks) === JSON.stringify(initialSubtasks);
    saveBtn.disabled = isSameAsInitial;
}

document.getElementById("save-subtasks-btn-subtasks").addEventListener("click", async (event) => {
    const newSubtaskInput = document.getElementById("new-subtask-input-subtasks");
    if (newSubtaskInput.value.trim() !== "") {
        if (!window.alertDisplayed) {
            showWarningPopup("You might want to add the subtask or clear the input field before saving.");
            window.alertDisplayed = true;
            setTimeout(() => (window.alertDisplayed = false), 2000);
        }
        return;
    }

    const saveBtn = event.target;
    const taskId = saveBtn.getAttribute("data-id");
    const docId = saveBtn.getAttribute("data-doc-id");

    if (!taskId || !docId) {
        return;
    }

    saveBtn.disabled = true;

    try {
        const subtaskList = document.getElementById("subtask-list-subtasks");
        const subtasks = Array.from(subtaskList.children).map((item) => {
            const subtaskText = item.querySelector(".subtask-text").textContent.trim();
            return { subtask_name: subtaskText }; // Save as object with subtask_name
        });

        // Convert initialSubtasks to an array of strings for comparison
        const initialSubtaskNames = initialSubtasks.map(subtask =>
            typeof subtask === "object" && subtask.subtask_name ? subtask.subtask_name : subtask
        );

        if (JSON.stringify(subtasks.map(s => s.subtask_name)) === JSON.stringify(initialSubtaskNames)) {
            if (!window.alertDisplayed) {
                showInfoPopup("No changes were made to the subtasks.");
                window.alertDisplayed = true;
                setTimeout(() => (window.alertDisplayed = false), 2000);
            }
            saveBtn.disabled = false;
            return;
        }

        const taskRef = doc(db, "tb_task_list", docId);
        await updateDoc(taskRef, { subtasks });

        if (!window.alertDisplayed) {
            showSuccessPopup("Subtasks saved successfully!");
            window.alertDisplayed = true;
            setTimeout(() => (window.alertDisplayed = false), 2000);
        }

        initialSubtasks = subtasks; // Update initialSubtasks to match saved structure
        toggleSaveButton();
        document.getElementById("edit-subtasks-modal").style.display = "none";
    } catch (error) {
        if (!window.alertDisplayed) {
            showErrorPopup("Failed to save changes. Please try again.");
            window.alertDisplayed = true;
            setTimeout(() => (window.alertDisplayed = false), 2000);
        }
        saveBtn.disabled = false;
    }
});

document.getElementById("close-edit-subtasks-modal").addEventListener("click", () => {
    document.getElementById("save-subtasks-btn-subtasks").disabled = true;
});

async function populateCropDropdown() {
    try {
        const cropDropdown = document.getElementById("crop-filter");
        if (!cropDropdown) {
            return;
        }

        cropDropdown.innerHTML = `<option value="">Crops</option>`;
        const cropsSnapshot = await getDocs(collection(db, "tb_crops"));
        cropsSnapshot.forEach((cropDoc) => {
            const cropData = cropDoc.data();
            const cropName = cropData.crop_name || "Unknown Crop";
            const option = document.createElement("option");
            option.value = cropName;
            option.textContent = cropName;
            cropDropdown.appendChild(option);
        });

        cropDropdown.addEventListener("change", async () => {
            const selectedCrop = cropDropdown.value;
            await populateCropTypeDropdown(selectedCrop);
            fetchAssignedTasks();
        });
    } catch (error) {}
}

async function populateCropTypeDropdown(selectedCrop = "") {
    try {
        const cropTypeDropdown = document.getElementById("crop-type-filter");
        if (!cropTypeDropdown) {
            return;
        }

        cropTypeDropdown.innerHTML = `<option value="">Crop Type</option>`;
        const tasksSnapshot = await getDocs(collection(db, "tb_task_list"));
        const cropTypes = new Set();

        tasksSnapshot.forEach((taskDoc) => {
            const taskData = taskDoc.data();
            const cropName = taskData.crop_name || "N/A";
            const cropTypeName = taskData.crop_type_name || "Unknown Crop Type";
            if (!selectedCrop || cropName === selectedCrop) {
                cropTypes.add(cropTypeName);
            }
        });

        const sortedCropTypes = Array.from(cropTypes).sort();
        sortedCropTypes.forEach((cropType) => {
            const option = document.createElement("option");
            option.value = cropType;
            option.textContent = cropType;
            cropTypeDropdown.appendChild(option);
        });

        cropTypeDropdown.addEventListener("change", fetchAssignedTasks);
    } catch (error) {}
}

let assignedTasks = [];
let assignedCurrentPage = 1;
const assignedRowsPerPage = 5;

export async function fetchAssignedTasks() {
    try {
        const taskListTable = document.getElementById("assigned-tasks-table-body");
        if (!taskListTable) {
            return;
        }

        taskListTable.innerHTML = "";
        const selectedCrop = document.getElementById("crop-filter")?.value || "";
        const selectedCropType = document.getElementById("crop-type-filter")?.value || "";

        let taskQuery = collection(db, "tb_task_list");
        if (selectedCrop || selectedCropType) {
            taskQuery = query(
                taskQuery,
                ...(selectedCrop ? [where("crop_name", "==", selectedCrop)] : []),
                ...(selectedCropType ? [where("crop_type_name", "==", selectedCropType)] : [])
            );
        }

        const querySnapshot = await getDocs(taskQuery);
        assignedTasks = [];

        querySnapshot.forEach((taskDoc) => {
            const taskData = taskDoc.data();
            const taskId = taskData.task_id || "N/A";
            const cropName = taskData.crop_name || "N/A";
            const cropTypeName = taskData.crop_type_name || "N/A";
            const taskName = taskData.task_name || "N/A";
            let assignedOn = "N/A";

            if (taskData.assigned_on?.seconds) {
                const date = new Date(taskData.assigned_on.seconds * 1000);
                assignedOn = date.toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric" });
            }

            assignedTasks.push({ taskId, cropName, cropTypeName, taskName, assignedOn });
        });

        const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
        if (assignedCurrentPage > totalPages && totalPages > 0) {
            assignedCurrentPage = totalPages;
        } else if (assignedTasks.length === 0) {
            assignedCurrentPage = 1;
        }

        displayAssignedTasks(assignedCurrentPage);
        updateAssignedPagination();
    } catch (error) {}
}

function displayAssignedTasks(page) {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    taskListTable.innerHTML = "";

    if (assignedTasks.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="6" style="text-align: center;">No tasks available</td>`;
        taskListTable.appendChild(row);
        return;
    }

    const startIndex = (page - 1) * assignedRowsPerPage;
    const endIndex = startIndex + assignedRowsPerPage;
    const paginatedTasks = assignedTasks.slice(startIndex, endIndex);

    paginatedTasks.forEach((task) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${task.taskId}</td>
            <td>${task.cropName}</td>
            <td>${task.cropTypeName}</td>
            <td>${task.taskName}</td>
            <td>${task.assignedOn}</td>
            <td>
                <button class="edit-btn" data-id="${task.taskId}" data-task="${task.taskName}" title="Edit">
                    <img src="../../images/image 27.png" alt="Edit">
                </button>
                <button class="delete-btn" data-id="${task.taskId}" data-task="${task.taskName}" data-crop="${task.cropName}" data-crop-type="${task.cropTypeName}" title="Delete">
                    <img src="../../images/Delete.png" alt="Delete">
                </button>
            </td>
        `;
        taskListTable.appendChild(row);
    });
}

function updateAssignedPagination() {
    const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
    const nextBtn = document.getElementById("assigned-next-page-btn");
    const prevBtn = document.getElementById("assigned-prev-page-btn");
    const pageInfo = document.getElementById("assigned-page-info");

    pageInfo.textContent = `${assignedCurrentPage} of ${totalPages || 1}`;
    prevBtn.disabled = assignedCurrentPage === 1;
    nextBtn.disabled = assignedCurrentPage === totalPages || totalPages === 0;
}

document.addEventListener("DOMContentLoaded", async () => {
    await populateCropDropdown();
    await populateCropTypeDropdown();
    fetchAssignedTasks();

    document.getElementById("assigned-tasks-table-body").addEventListener("click", (event) => {
        if (event.target.closest(".delete-btn")) {
            const button = event.target.closest(".delete-btn");
            const taskId = button.getAttribute("data-id");
            const taskName = button.getAttribute("data-task");
            const cropTypeName = button.getAttribute("data-crop-type");
            showDeleteConfirmationModal(taskId, taskName, cropTypeName);
        }
    });

    document.getElementById("assigned-tasks-table-body").addEventListener("click", (event) => {
        if (event.target.closest(".edit-btn")) {
            const button = event.target.closest(".edit-btn");
            const taskId = button.getAttribute("data-id");
            const taskName = button.getAttribute("data-task");
            openEditSubModal(taskId, taskName);
        }
    });

    document.getElementById("assigned-next-page-btn").addEventListener("click", () => {
        if (assignedCurrentPage < Math.ceil(assignedTasks.length / assignedRowsPerPage)) {
            assignedCurrentPage++;
            displayAssignedTasks(assignedCurrentPage);
            updateAssignedPagination();
        }
    });

    document.getElementById("assigned-prev-page-btn").addEventListener("click", () => {
        if (assignedCurrentPage > 1) {
            assignedCurrentPage--;
            displayAssignedTasks(assignedCurrentPage);
            updateAssignedPagination();
        }
    });
});