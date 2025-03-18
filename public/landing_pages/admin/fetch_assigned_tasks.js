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
link.href = "fetch.css"; // Adjust path if necessary
document.head.appendChild(link);

// Function to capitalize the first letter of each word
function capitalizeFirstLetter(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Function to show delete confirmation modal
function showDeleteConfirmationModal(taskId, taskName, cropTypeName) {
  const confirmDelete = confirm(
    `You are currently deleting the task "${taskName}" on crop type "${cropTypeName}".\nAre you sure you want to delete?`
  );

  if (confirmDelete) {
    deleteTask(taskId);
  }
}

// Function to delete a task and adjust pagination if necessary
async function deleteTask(taskId) {
  try {
    const tasksCollection = collection(db, "tb_task_list");
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);

    if (querySnapshot.empty) {
      console.warn(`No task found with task_id: ${taskId}`);
      alert("Task not found!");
      return;
    }

    // Delete all matching documents
    const deletePromises = querySnapshot.docs.map((taskDoc) =>
      deleteDoc(doc(db, "tb_task_list", taskDoc.id))
    );
    await Promise.all(deletePromises);

    alert("Task deleted successfully!");

    // Refresh tasks and adjust pagination
    await fetchAssignedTasks();

    // Check if the current page is empty and adjust
    const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
    if (assignedTasks.length === 0) {
      assignedCurrentPage = 1; // Reset to page 1 if no tasks remain
    } else if (assignedCurrentPage > totalPages) {
      assignedCurrentPage = totalPages; // Move to the last available page
    }

    displayAssignedTasks(assignedCurrentPage);
    updateAssignedPagination();
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Failed to delete task. Please try again.");
  }
}

// Open modal and load subtasks
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
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);
    if (querySnapshot.empty) return;

    let docId = "";
    let taskData = {};
    querySnapshot.forEach((doc) => {
      docId = doc.id;
      taskData = doc.data();
    });

    initialSubtasks = taskData.subtasks || [];
    initialSubtasks.forEach((subtask, index) =>
      addSubtaskToList(subtask, index)
    );

    saveBtn.setAttribute("data-doc-id", docId);
    modal.style.display = "block";
    toggleSaveButton();
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
};

// Function to add a subtask to the list
function addSubtaskToList(subtaskName, index) {
  const subtaskList = document.getElementById("subtask-list-subtasks");

  const subtaskItem = document.createElement("li");
  subtaskItem.classList.add("subtask-item");
  subtaskItem.setAttribute("data-index", index);
  subtaskItem.innerHTML = `
      <span class="subtask-text">${subtaskName}</span>
      <button class="remove-subtask-btn" onclick="removeSubtask(${index})">❌</button>
  `;

  subtaskList.appendChild(subtaskItem);
  toggleSaveButton();
}

// Function to remove a subtask
window.removeSubtask = function (index) {
  const subtaskItem = document.querySelector(`[data-index="${index}"]`);
  if (subtaskItem) {
    subtaskItem.remove();
    toggleSaveButton();
  }
};

// Close modal event listener
document
  .getElementById("close-edit-subtasks-modal")
  .addEventListener("click", () => {
    document.getElementById("edit-subtasks-modal").style.display = "none";
    document.getElementById("new-subtask-input-subtasks").value = "";
    document.getElementById("subtask-list-subtasks").innerHTML = "";
  });

// Add new subtask
document
  .getElementById("add-subtask-btn-subtasks")
  .addEventListener("click", () => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );
    let newSubtaskName = newSubtaskInput.value.trim();

    if (newSubtaskName !== "") {
      newSubtaskName = capitalizeFirstLetter(newSubtaskName);

      const subtaskList = document.getElementById("subtask-list-subtasks");
      const existingSubtasks = Array.from(subtaskList.children).map((item) =>
        item.querySelector(".subtask-text").textContent.trim().toLowerCase()
      );

      if (existingSubtasks.includes(newSubtaskName.toLowerCase())) {
        alert("Subtask already exists! Please enter a different subtask.");
        return;
      }

      const index = subtaskList.children.length;
      addSubtaskToList(newSubtaskName, index);

      newSubtaskInput.value = "";
      document.getElementById("save-subtasks-btn-subtasks").disabled = false;
    } else {
      alert("Please enter a valid subtask.");
    }
  });

// Function to enable/disable the "Add Subtask" button and update its style
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

// Attach event listener to input field
document
  .getElementById("new-subtask-input-subtasks")
  .addEventListener("input", toggleAddSubtaskButton);

// Ensure the button is disabled when the page loads
document.addEventListener("DOMContentLoaded", toggleAddSubtaskButton);

let initialSubtasks = [];

// Function to toggle "Save Changes" button state
function toggleSaveButton() {
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks");
  const subtaskList = document.getElementById("subtask-list-subtasks");

  const currentSubtasks = Array.from(subtaskList.children).map((item) =>
    item.querySelector(".subtask-text").textContent.trim()
  );

  const isSameAsInitial =
    JSON.stringify(currentSubtasks) === JSON.stringify(initialSubtasks);

  saveBtn.disabled = isSameAsInitial;
}

// Function to check if save should be aborted
document
  .getElementById("save-subtasks-btn-subtasks")
  .addEventListener("click", async (event) => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );

    if (newSubtaskInput.value.trim() !== "") {
      if (!window.alertDisplayed) {
        alert(
          "You might want to add the subtask or clear the input field before saving."
        );
        window.alertDisplayed = true;
        setTimeout(() => (window.alertDisplayed = false), 2000);
      }
      return;
    }

    const saveBtn = event.target;
    const taskId = saveBtn.getAttribute("data-id");
    const docId = saveBtn.getAttribute("data-doc-id");

    if (!taskId || !docId) {
      console.error("Task ID or Document ID missing. Cannot save changes.");
      return;
    }

    saveBtn.disabled = true;

    try {
      const subtaskList = document.getElementById("subtask-list-subtasks");
      const subtasks = Array.from(subtaskList.children).map((item) =>
        item.querySelector(".subtask-text").textContent.trim()
      );

      if (JSON.stringify(subtasks) === JSON.stringify(initialSubtasks)) {
        if (!window.alertDisplayed) {
          alert("No changes were made to the subtasks.");
          window.alertDisplayed = true;
          setTimeout(() => (window.alertDisplayed = false), 2000);
        }
        saveBtn.disabled = false;
        return;
      }

      const taskRef = doc(db, "tb_task_list", docId);
      await updateDoc(taskRef, { subtasks });

      if (!window.alertDisplayed) {
        alert("Subtasks saved successfully!");
        window.alertDisplayed = true;
        setTimeout(() => (window.alertDisplayed = false), 2000);
      }

      initialSubtasks = subtasks;
      toggleSaveButton();

      document.getElementById("edit-subtasks-modal").style.display = "none";
    } catch (error) {
      console.error("Error saving subtasks:", error);
      if (!window.alertDisplayed) {
        alert("Failed to save changes. Please try again.");
        window.alertDisplayed = true;
        setTimeout(() => (window.alertDisplayed = false), 2000);
      }
      saveBtn.disabled = false;
    }
  });

// Function to reset everything when modal is closed
document
  .getElementById("close-edit-subtasks-modal")
  .addEventListener("click", () => {
    document.getElementById("save-subtasks-btn-subtasks").disabled = true;
  });

// Function to populate the crop name dropdown
async function populateCropDropdown() {
  try {
    const cropDropdown = document.getElementById("crop-filter");
    if (!cropDropdown) {
      console.error("Crop dropdown not found.");
      return;
    }

    cropDropdown.innerHTML = `<option value="">All Crops</option>`;

    const cropsSnapshot = await getDocs(collection(db, "tb_crops"));
    cropsSnapshot.forEach((cropDoc) => {
      const cropData = cropDoc.data();
      const cropName = cropData.crop_name || "Unknown Crop";

      const option = document.createElement("option");
      option.value = cropName;
      option.textContent = cropName;
      cropDropdown.appendChild(option);
    });

    cropDropdown.addEventListener("change", fetchAssignedTasks);
  } catch (error) {
    console.error("Error fetching crop names:", error);
  }
}

// Variables for Assigned Tasks pagination
let assignedTasks = [];
let assignedCurrentPage = 1;
const assignedRowsPerPage = 5;

// Function to fetch and display assigned tasks
export async function fetchAssignedTasks() {
  try {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    if (!taskListTable) {
      console.error("Table body element not found.");
      return;
    }

    taskListTable.innerHTML = "";
    const selectedCrop = document.getElementById("crop-filter")?.value || "";

    let taskQuery = collection(db, "tb_task_list");
    if (selectedCrop) {
      taskQuery = query(taskQuery, where("crop_name", "==", selectedCrop));
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
        assignedOn = date.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }

      assignedTasks.push({
        taskId,
        cropName,
        cropTypeName,
        taskName,
        assignedOn,
      });
    });

    // Adjust current page if it exceeds total pages after fetch
    const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
    if (assignedCurrentPage > totalPages && totalPages > 0) {
      assignedCurrentPage = totalPages;
    } else if (assignedTasks.length === 0) {
      assignedCurrentPage = 1;
    }

    displayAssignedTasks(assignedCurrentPage);
    updateAssignedPagination();
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
  }
}

// Function to display assigned tasks for the current page
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
        <button class="edit-btn" data-id="${task.taskId}" data-task="${task.taskName}" title="Edit">Edit</button>
        <button class="delete-btn" data-id="${task.taskId}" data-task="${task.taskName}" data-crop="${task.cropName}" data-crop-type="${task.cropTypeName}" title="Delete">Delete</button>
      </td>
    `;
    taskListTable.appendChild(row);
  });
}

// Function to update pagination controls for Assigned Tasks
function updateAssignedPagination() {
  const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
  const nextBtn = document.getElementById("assigned-next-page-btn");
  const prevBtn = document.getElementById("assigned-prev-page-btn");
  const pageInfo = document.getElementById("assigned-page-info");

  pageInfo.textContent = `Page ${assignedCurrentPage} of ${totalPages || 1}`;

  prevBtn.disabled = assignedCurrentPage === 1;
  nextBtn.disabled = assignedCurrentPage === totalPages || totalPages === 0;
}

// Event listeners for Assigned Tasks pagination buttons and initialization
document.addEventListener("DOMContentLoaded", async () => {
  await populateCropDropdown();
  fetchAssignedTasks();

  // Event delegation for delete buttons
  document.getElementById("assigned-tasks-table-body").addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-btn")) {
      const taskId = event.target.getAttribute("data-id");
      const taskName = event.target.getAttribute("data-task");
      const cropTypeName = event.target.getAttribute("data-crop-type");
      showDeleteConfirmationModal(taskId, taskName, cropTypeName);
    }
  });

  // Event delegation for edit buttons
  document.getElementById("assigned-tasks-table-body").addEventListener("click", (event) => {
    if (event.target.classList.contains("edit-btn")) {
      const taskId = event.target.getAttribute("data-id");
      const taskName = event.target.getAttribute("data-task");
      openEditSubModal(taskId, taskName);
    }
  });

  // Pagination controls
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