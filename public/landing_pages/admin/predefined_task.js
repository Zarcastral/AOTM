import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";
import { fetchAssignedTasks } from "./fetch_assigned_tasks.js";

const db = getFirestore(app);
const taskList = document.getElementById("task-list");
const addTaskModal = document.getElementById("add-task-modal");
const editTaskModal = document.getElementById("edit-task-modal");
const openAddTaskModalBtn = document.getElementById("open-add-task-modal");
const closeAddTaskModalBtn = document.getElementById("close-add-task-modal");
const closeEditTaskModalBtn = document.getElementById("close-edit-task-modal");
const duplicateTaskModal = document.getElementById("duplicate-task-modal");
const noChangesModal = document.getElementById("no-changes-modal");
const deleteConfirmationModal = document.getElementById(
  "delete-confirmation-modal"
);
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
let taskToDeleteId = null; // Store the task ID for deletion

// ✅ Duplicate Subtask Modal
const duplicateSubtaskModal = document.createElement("div");
duplicateSubtaskModal.classList.add("modal");
duplicateSubtaskModal.innerHTML = `
    <div class="modal-content">
      <h2>Subtask Already Exists</h2>
      <p id="duplicate-subtask-message"></p>
      <button id="close-duplicate-subtask-modal">Okay</button>
    </div>
  `;
document.body.appendChild(duplicateSubtaskModal);

const closeDuplicateSubtaskModal = document.getElementById(
  "close-duplicate-subtask-modal"
);
const closeDuplicateTaskModal = document.getElementById(
  "close-duplicate-task-modal"
);
const closeNoChangesModal = document.getElementById("close-no-changes-modal");

const addTaskBtn = document.getElementById("add-task-btn");
const saveTasksBtn = document.getElementById("save-tasks-btn");
const newTaskInput = document.getElementById("new-task-input");
const newTaskList = document.getElementById("new-task-list");
const subtaskList = document.getElementById("subtask-list");
const addSubtaskBtn = document.getElementById("add-subtask-btn");
const saveSubtasksBtn = document.getElementById("save-subtasks-btn");
const newSubtaskInput = document.getElementById("new-subtask-input");

let tasks = [];
let editingTaskId = null;
let initialSubtasks = [];

// ✅ Ensure the "Add Task" button is disabled by default
addTaskBtn.disabled = true;

// ✅ Duplicate Task Modal Handling
const duplicateTaskMessage = document.getElementById("duplicate-task-message");
closeDuplicateTaskModal.addEventListener("click", () => {
  duplicateTaskModal.style.display = "none";
});

// ✅ No Changes Modal Handling
closeNoChangesModal.addEventListener("click", () => {
  noChangesModal.style.display = "none";
});

// ✅ Close Add Task Modal
function closeAddTaskPopup() {
  addTaskModal.style.display = "none";
  newTaskInput.value = "";
  newTaskList.innerHTML = "";
  tasks = [];
  checkSaveButtonState();
}

// ✅ Close Edit Task Modal
function closeEditTaskPopup() {
  editTaskModal.style.display = "none";
  newSubtaskInput.value = "";
  subtaskList.innerHTML = "";
  editingTaskId = null;
  initialSubtasks = [];
  checkSaveButtonState();
}

function checkSaveButtonState() {
  const newTaskText = newTaskInput.value.trim();
  const newSubtaskText = newSubtaskInput.value.trim();
  const taskListNotEmpty = newTaskList.children.length > 0;

  const subtaskListItems = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.replace(" X", "").trim()
  );

  // Check if subtasks changed
  const noChangesMade =
    JSON.stringify(subtaskListItems) === JSON.stringify(initialSubtasks);

  // ✅ Disable "Save Changes" button if the input is NOT empty
  saveSubtasksBtn.disabled = noChangesMade || newSubtaskText !== "";

  saveTasksBtn.disabled = newTaskText === "" && !taskListNotEmpty;
  addSubtaskBtn.disabled = newSubtaskText === "";
}

closeAddTaskModalBtn.addEventListener("click", closeAddTaskPopup);
closeEditTaskModalBtn.addEventListener("click", closeEditTaskPopup);
closeDuplicateSubtaskModal.addEventListener(
  "click",
  () => (duplicateSubtaskModal.style.display = "none")
);

// ✅ Disable 'Add Subtask' button when input is empty
newSubtaskInput.addEventListener("input", checkSaveButtonState);

// ✅ Check for Duplicate Task Before Adding to the List
addTaskBtn.addEventListener("click", async () => {
  console.log("Add Task button clicked!");
  let taskName = newTaskInput.value.trim();

  if (!taskName) {
    addTaskBtn.disabled = true; // 🔴 Prevent empty tasks
    return;
  }

  // Capitalize first letter
  taskName = taskName.charAt(0).toUpperCase() + taskName.slice(1);

  // Check if task is already in the pop-up list
  if (tasks.includes(taskName)) {
    duplicateTaskMessage.textContent = `"${taskName}" is already in the list.`;
    duplicateTaskModal.style.display = "flex";
    return;
  }

  // Check if task already exists in Firestore
  const querySnapshot = await getDocs(
    query(collection(db, "tb_pretask"), where("task_name", "==", taskName))
  );

  if (!querySnapshot.empty) {
    duplicateTaskMessage.textContent = `"${taskName}" already exists in the database.`;
    duplicateTaskModal.style.display = "flex";
    return;
  }

  // ✅ Add task to the list if no duplicate is found
  tasks.push(taskName);
  const li = document.createElement("li");
  li.innerHTML = `${taskName} <button class="delete-task-popup-btn">X</button>`;
  newTaskList.appendChild(li);

  // ✅ Clear input field
  newTaskInput.value = "";

  // ✅ Disable button after adding task
  checkTaskInput();

  checkSaveButtonState();
});

// ✅ Remove Task from List (Popup)
newTaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-task-popup-btn")) {
    e.target.parentElement.remove();
    tasks = tasks.filter(
      (task) =>
        task !== e.target.parentElement.textContent.replace(" X", "").trim()
    );
    checkSaveButtonState();
  }
});

// ✅ Save Tasks to Firestore
saveTasksBtn.addEventListener("click", async () => {
  if (tasks.length === 0) {
    noChangesModal.style.display = "flex";
    return;
  }

  for (const taskName of tasks) {
    await addDoc(collection(db, "tb_pretask"), {
      task_name: taskName,
      subtasks: [],
    });
  }

  closeAddTaskPopup();
  addTaskBtn.disabled = true;
  fetchTasks();
});

// ✅ Save Subtasks to Firestore
saveSubtasksBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;

  const updatedSubtasks = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.replace(" X", "").trim()
  );

  if (JSON.stringify(updatedSubtasks) === JSON.stringify(initialSubtasks)) {
    noChangesModal.style.display = "flex"; // Show "No Changes" modal
    return;
  }

  try {
    const taskRef = doc(db, "tb_pretask", editingTaskId);
    await updateDoc(taskRef, { subtasks: updatedSubtasks });

    console.log("Subtasks updated successfully!");
    closeEditTaskPopup();
    fetchTasks(); // Refresh task list
  } catch (error) {
    console.error("Error updating subtasks:", error);
  }
});

async function fetchTasks() {
  const taskList = document.getElementById("task-list");
  taskList.innerHTML = ""; // Clear existing rows
  const querySnapshot = await getDocs(collection(db, "tb_pretask"));
  querySnapshot.forEach((doc) => {
    const taskData = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${taskData.task_name}</td>
        <td>
         <button class="edit-task-btn" data-id="${doc.id}">Edit</button>
         <button class="delete-task-btn" data-id="${doc.id}">Delete</button>
        </td>
      `;
    taskList.appendChild(row);
  });

  // Add delete task functionality
  const deleteButtons = document.querySelectorAll(".delete-task-btn");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      taskToDeleteId = e.target.dataset.id;
      deleteConfirmationModal.style.display = "flex"; // Show the confirmation modal
    });
  });
}

// ✅ Handle Confirm Delete
confirmDeleteBtn.addEventListener("click", async () => {
  if (taskToDeleteId) {
    // Delete from Firestore
    await deleteDoc(doc(db, "tb_pretask", taskToDeleteId));

    // Remove task from the UI
    const taskItem = document
      .querySelector(`[data-id="${taskToDeleteId}"]`)
      .closest("li");
    taskItem.remove();

    // Reset taskToDeleteId and hide the modal
    taskToDeleteId = null;
    deleteConfirmationModal.style.display = "none";
  }
});

// ✅ Handle Cancel Delete
cancelDeleteBtn.addEventListener("click", () => {
  taskToDeleteId = null;
  deleteConfirmationModal.style.display = "none"; // Hide the modal
});

// ✅ Disable "Okay" button when input is empty
function checkTaskInput() {
  const taskName = newTaskInput.value.trim();
  addTaskBtn.disabled = taskName === ""; // ✅ Disable if empty
}

// ✅ Ensure the "Add Task" button is updated on input changes
newTaskInput.addEventListener("input", checkTaskInput);

// ✅ Ensure the "Add Task" button is disabled on page load
document.addEventListener("DOMContentLoaded", checkTaskInput);

// ✅ Add Subtask in 'Edit Task' Pop-up
addSubtaskBtn.addEventListener("click", () => {
  let subtaskName = newSubtaskInput.value.trim();

  if (!subtaskName) return;

  subtaskName = subtaskName.charAt(0).toUpperCase() + subtaskName.slice(1);

  // Check for duplicate subtask in UI
  const existingSubtasks = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.replace(" X", "").trim()
  );

  if (existingSubtasks.includes(subtaskName)) {
    document.getElementById(
      "duplicate-subtask-message"
    ).textContent = `"${subtaskName}" is already in the list.`;
    duplicateSubtaskModal.style.display = "flex";
    return;
  }

  // Add new subtask to list
  const li = document.createElement("li");
  li.innerHTML = `${subtaskName} <button class="delete-subtask-btn">X</button>`;
  subtaskList.appendChild(li);
  newSubtaskInput.value = "";

  checkSaveButtonState(); // 🔴 Update button state after adding
});

// ✅ Remove Subtask in 'Edit Task' Pop-up (Event Delegation)
subtaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-subtask-btn")) {
    e.target.parentElement.remove();
    checkSaveButtonState(); // 🔴 Update button state after deleting
  }
});

taskList.addEventListener("click", async (e) => {
  if (e.target.classList.contains("edit-task-btn")) {
    editingTaskId = e.target.dataset.id;
    editTaskModal.style.display = "flex";

    const taskRef = doc(db, "tb_pretask", editingTaskId);
    const taskSnap = await getDoc(taskRef);

    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      subtaskList.innerHTML = ""; // Clear existing list
      initialSubtasks = [...taskData.subtasks]; // Store initial subtasks

      taskData.subtasks.forEach((subtask) => {
        const li = document.createElement("li");
        li.innerHTML = `${subtask} <button class="delete-subtask-btn">X</button>`;
        subtaskList.appendChild(li);
      });

      // ✅ Ensure button is initially disabled when opening modal
      saveSubtasksBtn.disabled = true;

      checkSaveButtonState(); // Call after setting initial state
    } else {
      console.error("Task not found in Firestore");
    }
  }
});

fetchTasks();

// New Elements for Assigning Tasks to Crop Type
const assignTaskModal = document.getElementById("assign-task-modal");
const openAssignTaskModalBtn = document.getElementById(
  "open-assign-task-modal"
);
const closeAssignTaskModalBtn = document.getElementById(
  "close-assign-task-modal"
);
const assignTasksBtn = document.getElementById("assign-tasks-btn");
const cropTypeSelect = document.getElementById("crop-type-select");
const taskCheckboxesContainer = document.getElementById("task-checkboxes");

let cropTypes = []; // Store crop types

// Open Assign Task Modal and load data
openAssignTaskModalBtn.addEventListener("click", () => {
  assignTaskModal.style.display = "flex"; // Show the modal
  loadCropTypes(); // Fetch and load crop types into dropdown
  loadTasks(); // Fetch and load tasks into checkboxes
});

// Close the modal
closeAssignTaskModalBtn.addEventListener("click", () => {
  assignTaskModal.style.display = "none"; // Hide the modal
});

// Fetch and load crop types into dropdown
async function loadCropTypes() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_crop_types"));
    cropTypes = [];
    cropTypeSelect.innerHTML = "<option value=''>Select a crop type</option>"; // Default option

    if (querySnapshot.empty) {
      console.log("No crop types found in Firestore.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      if (cropData && cropData.crop_type_name && cropData.crop_name) {
        cropTypes.push({
          id: doc.id,
          name: cropData.crop_type_name,
          cropName: cropData.crop_name, // Store crop_name for later use
        });
      }
    });

    // ✅ Sort crop types alphabetically by name
    cropTypes.sort((a, b) => a.name.localeCompare(b.name));

    // ✅ Populate dropdown after sorting
    cropTypes.forEach((crop) => {
      const option = document.createElement("option");
      option.value = crop.id;
      option.textContent = crop.name;
      option.dataset.cropName = crop.cropName; // Store crop_name in dataset
      cropTypeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching crop types:", error);
  }
}

// Fetch and load tasks into checkboxes
async function loadTasks() {
  const querySnapshot = await getDocs(collection(db, "tb_pretask"));
  taskCheckboxesContainer.innerHTML = ""; // Clear previous checkboxes

  // Loop through existing tasks and populate them as checkboxes
  querySnapshot.forEach((doc) => {
    const taskData = doc.data();
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = doc.id;
    checkbox.name = "tasks";
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(taskData.task_name));
    taskCheckboxesContainer.appendChild(label);
    taskCheckboxesContainer.appendChild(document.createElement("br"));
  });
}

// Assign tasks to selected crop type
assignTasksBtn.addEventListener("click", async () => {
  assignTasksBtn.disabled = true; // Disable button while saving

  const selectedCropTypeId = cropTypeSelect.value;
  const selectedCropTypeName =
    cropTypeSelect.options[cropTypeSelect.selectedIndex].text;
  const selectedTaskIds = Array.from(
    document.querySelectorAll('input[name="tasks"]:checked')
  ).map((checkbox) => checkbox.value);

  if (!selectedCropTypeId || selectedTaskIds.length === 0) {
    alert("Please select a crop type and at least one task.");
    assignTasksBtn.disabled = false;
    return;
  }

  try {
    console.log("Fetching crop_name...");
    const cropRef = doc(db, "tb_crop_types", selectedCropTypeId);
    const cropSnap = await getDoc(cropRef);

    if (!cropSnap.exists()) {
      console.error("Crop type not found in tb_crop_types.");
      alert("Error: Crop type not found.");
      assignTasksBtn.disabled = false;
      return;
    }

    const cropData = cropSnap.data();
    const cropName = cropData.crop_name; // ✅ Get crop_name from Firestore
    console.log("Found crop_name:", cropName);

    console.log("Fetching task_id_counter...");
    const counterRef = doc(db, "tb_id_counters", "task_id_counter"); // Fixed collection name
    let counterSnap = await getDoc(counterRef);

    let taskCounter;
    if (counterSnap.exists()) {
      taskCounter = counterSnap.data().count; // Use 'count'
      console.log("Current task_id_counter:", taskCounter);
    } else {
      console.warn("task_id_counter not found. Creating new counter...");
      taskCounter = 1; // Start from 1 if missing
      await setDoc(counterRef, { count: taskCounter });
    }

    let duplicateTasks = []; // Track duplicate task names

    for (const taskId of selectedTaskIds) {
      console.log("Processing task:", taskId);
      const taskRef = doc(db, "tb_pretask", taskId);
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        console.warn(`Task with ID ${taskId} not found in tb_pretask.`);
        continue;
      }

      const taskData = taskSnap.data();
      console.log("Task data:", taskData);

      // ✅ Check for duplicate task name in tb_task_list
      const taskListQuery = query(
        collection(db, "tb_task_list"),
        where("crop_type_name", "==", selectedCropTypeName),
        where("task_name", "==", taskData.task_name)
      );
      const taskListSnapshot = await getDocs(taskListQuery);

      if (!taskListSnapshot.empty) {
        duplicateTasks.push(taskData.task_name);
        continue; // Skip adding duplicate task
      }

      // ✅ Save task to Firestore (without crop_type_id)
      console.log(
        `Saving task "${taskData.task_name}" with task_id ${taskCounter}...`
      );
      await addDoc(collection(db, "tb_task_list"), {
        task_id: taskCounter, // Assign task_id from count
        crop_type_name: selectedCropTypeName,
        crop_name: cropName, // ✅ Save crop_name
        task_name: taskData.task_name,
        subtasks: taskData.subtasks || [],
        assigned_on: new Date(),
      });

      taskCounter++; // Increment counter
    }

    // ✅ Update count in Firestore if new tasks were added
    if (taskCounter !== counterSnap.data().count) {
      console.log("Updating task_id_counter to:", taskCounter);
      await updateDoc(counterRef, { count: taskCounter });
    }

    // ✅ Show duplicate message if any tasks were already assigned
    if (duplicateTasks.length > 0) {
      alert(
        `The following tasks are already assigned to "${selectedCropTypeName}":\n\n` +
          duplicateTasks.map((task) => `- ${task}`).join("\n")
      );
    }

    // ✅ Clear form if at least one task was assigned
    if (selectedTaskIds.length > duplicateTasks.length) {
      cropTypeSelect.value = "";
      document
        .querySelectorAll('input[name="tasks"]:checked')
        .forEach((checkbox) => (checkbox.checked = false));

      if (typeof fetchAssignedTasks === "function") {
        fetchAssignedTasks();
      }

      alert("Tasks assigned successfully!");
    }
  } catch (error) {
    console.error("Error assigning tasks:", error);
    alert("An error occurred while assigning tasks. Please try again.");
  } finally {
    assignTasksBtn.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("open-add-task-modal")
    .addEventListener("click", function () {
      document.getElementById("add-task-modal").style.display = "flex"; // Change from "block" to "flex"
    });

  document
    .getElementById("close-add-task-modal")
    .addEventListener("click", function () {
      document.getElementById("add-task-modal").style.display = "none";
    });
});
