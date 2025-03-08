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

// Function to delete a task
async function deleteTask(taskId) {
  try {
    const tasksCollection = collection(db, "tb_task_list");
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);

    if (!querySnapshot.empty) {
      querySnapshot.forEach(async (taskDoc) => {
        await deleteDoc(doc(db, "tb_task_list", taskDoc.id));
      });

      alert("Task deleted successfully!");
      fetchAssignedTasks();
    }
  } catch (error) {
    console.error("Error deleting task:", error);
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

    initialSubtasks = taskData.subtasks || []; // Store initial subtasks
    initialSubtasks.forEach((subtask, index) =>
      addSubtaskToList(subtask, index)
    );

    saveBtn.setAttribute("data-doc-id", docId);
    modal.style.display = "block";
    toggleSaveButton(); // Ensure button state is set
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
};

// Function to add a subtask to the list

// Function to remove a subtask
window.removeSubtask = function (index) {
  const subtaskItem = document.querySelector(`[data-index="${index}"]`);
  if (subtaskItem) {
    subtaskItem.remove();
    document.getElementById("save-subtasks-btn-subtasks").disabled = false;
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
    addSubtaskBtn.classList.add("disabled-btn"); // Apply the disabled style
  } else {
    addSubtaskBtn.disabled = false;
    addSubtaskBtn.classList.remove("disabled-btn"); // Remove the disabled style
  }
}

// Attach event listener to input field
document
  .getElementById("new-subtask-input-subtasks")
  .addEventListener("input", toggleAddSubtaskButton);

// Ensure the button is disabled when the page loads
document.addEventListener("DOMContentLoaded", toggleAddSubtaskButton);

let initialSubtasks = []; // Store the initial state of subtasks
let subtasksChanged = false; // Track if any subtask has been added or removed

// Function to toggle "Save Changes" button state
function toggleSaveButton() {
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks");
  const subtaskList = document.getElementById("subtask-list-subtasks");

  // Get the current list of subtasks
  const currentSubtasks = Array.from(subtaskList.children).map((item) =>
    item.querySelector(".subtask-text").textContent.trim()
  );

  // Check if the current subtasks are the same as the initial list
  const isSameAsInitial =
    JSON.stringify(currentSubtasks) === JSON.stringify(initialSubtasks);

  // Enable the save button only if there are changes
  saveBtn.disabled = isSameAsInitial;
}

// Function to open the edit modal and load subtasks
async function openEditSubModal(taskId, taskName) {
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

    initialSubtasks = taskData.subtasks || []; // Store initial subtasks
    initialSubtasks.forEach((subtask, index) =>
      addSubtaskToList(subtask, index)
    );

    saveBtn.setAttribute("data-doc-id", docId);
    modal.style.display = "block";
    toggleSaveButton(); // Ensure button state is set
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
}

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
  toggleSaveButton(); // Check if changes occurred
}

// Function to remove a subtask
window.removeSubtask = function (index) {
  const subtaskItem = document.querySelector(`[data-index="${index}"]`);
  if (subtaskItem) {
    subtaskItem.remove();
    toggleSaveButton();
  }
};

// Function to check if save should be aborted
document
  .getElementById("save-subtasks-btn-subtasks")
  .addEventListener("click", async (event) => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );

    // Prevent saving if the input contains text
    if (newSubtaskInput.value.trim() !== "") {
      if (!window.alertDisplayed) {
        alert(
          "You might want to add the subtask or clear the input field before saving."
        );
        window.alertDisplayed = true; // Prevent duplicate alerts
        setTimeout(() => (window.alertDisplayed = false), 2000); // Reset after 2s
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

    // Disable button immediately to prevent multiple clicks
    saveBtn.disabled = true;

    try {
      const subtaskList = document.getElementById("subtask-list-subtasks");
      const subtasks = Array.from(subtaskList.children).map((item) =>
        item.querySelector(".subtask-text").textContent.trim()
      );

      // If no changes were made, prevent saving
      if (JSON.stringify(subtasks) === JSON.stringify(initialSubtasks)) {
        if (!window.alertDisplayed) {
          alert("No changes were made to the subtasks.");
          window.alertDisplayed = true;
          setTimeout(() => (window.alertDisplayed = false), 2000);
        }
        saveBtn.disabled = false; // Re-enable since no changes were made
        return;
      }

      // Reference to Firestore document
      const taskRef = doc(db, "tb_task_list", docId);

      // Update Firestore document with new subtasks
      await updateDoc(taskRef, { subtasks });

      // Alert user once
      if (!window.alertDisplayed) {
        alert("Subtasks saved successfully!");
        window.alertDisplayed = true;
        setTimeout(() => (window.alertDisplayed = false), 2000);
      }

      // Update initial subtasks after saving
      initialSubtasks = subtasks;
      toggleSaveButton();

      // Close the modal after saving
      document.getElementById("edit-subtasks-modal").style.display = "none";
    } catch (error) {
      console.error("Error saving subtasks:", error);
      if (!window.alertDisplayed) {
        alert("Failed to save changes. Please try again.");
        window.alertDisplayed = true;
        setTimeout(() => (window.alertDisplayed = false), 2000);
      }
      saveBtn.disabled = false; // Re-enable in case of failure
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

    cropDropdown.innerHTML = `<option value="">All Crops</option>`; // Default option

    const cropsSnapshot = await getDocs(collection(db, "tb_crops"));
    cropsSnapshot.forEach((cropDoc) => {
      const cropData = cropDoc.data();
      const cropName = cropData.crop_name || "Unknown Crop";

      const option = document.createElement("option");
      option.value = cropName;
      option.textContent = cropName;
      cropDropdown.appendChild(option);
    });

    // Add event listener to filter tasks when crop is selected
    cropDropdown.addEventListener("change", fetchAssignedTasks);
  } catch (error) {
    console.error("Error fetching crop names:", error);
  }
}

// Function to fetch and display assigned tasks
export async function fetchAssignedTasks() {
  try {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    if (!taskListTable) {
      console.error("Table body element not found.");
      return;
    }

    taskListTable.innerHTML = "";
    const selectedCrop = document.getElementById("crop-filter")?.value || ""; // Get selected crop

    let taskQuery = collection(db, "tb_task_list");
    if (selectedCrop) {
      taskQuery = query(taskQuery, where("crop_name", "==", selectedCrop));
    }

    const querySnapshot = await getDocs(taskQuery);
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

      const row = document.createElement("tr");
      row.innerHTML = `  
        <td>${taskId}</td>
        <td>${cropName}</td>
        <td>${cropTypeName}</td>
        <td>${taskName}</td>
        <td>${assignedOn}</td>
        <td>
          <button class="edit-btn" data-id="${taskId}" data-task="${taskName}">Edit</button>
          <button class="delete-btn" data-id="${taskId}" data-task="${taskName}" data-crop="${cropName}" data-crop-type="${cropTypeName}">Delete</button>
        </td>
      `;
      taskListTable.appendChild(row);
    });

    document.querySelectorAll(".edit-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const taskId = event.target.getAttribute("data-id");
        const taskName = event.target.getAttribute("data-task");
        openEditSubModal(taskId, taskName);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const taskId = event.target.getAttribute("data-id");
        const taskName = event.target.getAttribute("data-task");
        const cropName = event.target.getAttribute("data-crop");
        const cropTypeName = event.target.getAttribute("data-crop-type");
        showDeleteConfirmationModal(taskId, taskName, cropName, cropTypeName);
      });
    });
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
  }
}

// Initialize page with crop dropdown and task list
document.addEventListener("DOMContentLoaded", async () => {
  await populateCropDropdown();
  fetchAssignedTasks();
});
