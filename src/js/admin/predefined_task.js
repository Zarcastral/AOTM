import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
import { fetchAssignedTasks } from "./fetch_assigned_tasks.js";

const db = getFirestore(app);
const taskList = document.getElementById("task-list");
const addTaskModal = document.getElementById("add-task-modal");
const editTaskModal = document.getElementById("edit-task-modal");
const openAddTaskModalBtn = document.getElementById("open-add-task-modal");
const closeAddTaskModalBtn = document.getElementById("close-add-task-modal");
const closeEditTaskModalBtn = document.getElementById("close-edit-task-modal");
const deleteConfirmationModal = document.getElementById(
  "delete-confirmation-modal"
);
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const searchBar = document.getElementById("search-bar");
let taskToDeleteId = null;

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
let currentPage = 1;
const rowsPerPage = 5;
let allTasks = [];

addTaskBtn.disabled = true;

// Function to show success panel
function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;

  document.body.appendChild(successMessage);

  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.opacity = "1";
  }, 5);

  setTimeout(() => {
    successMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(successMessage);
    }, 400);
  }, 4000);
}

// Function to show error panel
function showErrorPanel(message) {
  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = message;

  document.body.appendChild(errorMessage);

  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.opacity = "1";
  }, 5);

  setTimeout(() => {
    errorMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(errorMessage);
    }, 400);
  }, 4000);
}

// Debounce function to limit how often fetchTasks is called
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function closeAddTaskPopup() {
  addTaskModal.style.display = "none";
  newTaskInput.value = "";
  newTaskList.innerHTML = "";
  tasks = [];
  checkSaveButtonState();
}

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
    (li) => ({ subtask_name: li.textContent.trim() })
  );

  const formattedInitialSubtasks = initialSubtasks.map((subtask) =>
    typeof subtask === "string" ? { subtask_name: subtask } : subtask
  );

  const noChangesMade =
    JSON.stringify(subtaskListItems) ===
    JSON.stringify(formattedInitialSubtasks);

  saveSubtasksBtn.disabled = noChangesMade || newSubtaskText !== "";
  saveTasksBtn.disabled = newTaskText !== "" || !taskListNotEmpty;
  addSubtaskBtn.disabled = newSubtaskText === "";
  addTaskBtn.disabled = newTaskText === "";
}

closeAddTaskModalBtn.addEventListener("click", closeAddTaskPopup);
closeEditTaskModalBtn.addEventListener("click", closeEditTaskPopup);

newSubtaskInput.addEventListener("input", checkSaveButtonState);
newTaskInput.addEventListener("input", checkSaveButtonState);

addTaskBtn.addEventListener("click", async () => {
  let taskName = newTaskInput.value.trim();

  if (!taskName) {
    addTaskBtn.disabled = true;
    return;
  }

  taskName = taskName.charAt(0).toUpperCase() + taskName.slice(1);

  if (tasks.includes(taskName)) {
    showErrorPanel(`"${taskName}" is already in the list.`);
    return;
  }

  const querySnapshot = await getDocs(
    query(collection(db, "tb_pretask"), where("task_name", "==", taskName))
  );

  if (!querySnapshot.empty) {
    showErrorPanel(`"${taskName}" already exists in the database.`);
    return;
  }

  tasks.push(taskName);
  const li = document.createElement("li");
  li.innerHTML = `${taskName} <button class="delete-task-popup-btn"><img src="/public/images/Delete.png" alt="Delete" title="Delete Task" class="action-icon delete-task-icon"></button>`;
  newTaskList.appendChild(li);

  newTaskInput.value = "";
  checkSaveButtonState();
});

newTaskList.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".delete-task-popup-btn");
  if (deleteBtn) {
    const li = deleteBtn.parentElement;
    const taskName = li.textContent.trim().split(" ")[0];
    li.remove();
    tasks = tasks.filter((task) => task !== taskName);
    checkSaveButtonState();
  }
});

saveTasksBtn.addEventListener("click", async () => {
  if (tasks.length === 0) {
    showErrorPanel("No new tasks were added.");
    return;
  }

  try {
    for (const taskName of tasks) {
      await addDoc(collection(db, "tb_pretask"), {
        task_name: taskName,
        subtasks: [],
      });
    }
    closeAddTaskPopup();
    fetchTasks();
    showSuccessPanel("Tasks added successfully!");
  } catch (error) {
    console.error("Error adding tasks:", error);
    showErrorPanel("Failed to add tasks. Please try again.");
  }
});

saveSubtasksBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;

  const updatedSubtasks = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => ({ subtask_name: li.textContent.trim() })
  );

  const formattedInitialSubtasks = initialSubtasks.map((subtask) =>
    typeof subtask === "string" ? { subtask_name: subtask } : subtask
  );

  if (
    JSON.stringify(updatedSubtasks) === JSON.stringify(formattedInitialSubtasks)
  ) {
    showErrorPanel("No changes were made to subtasks.");
    return;
  }

  try {
    const taskRef = doc(db, "tb_pretask", editingTaskId);
    await updateDoc(taskRef, { subtasks: updatedSubtasks });

    closeEditTaskPopup();
    fetchTasks();
    showSuccessPanel("Subtasks updated successfully!");
  } catch (error) {
    console.error("Error updating subtasks:", error);
    showErrorPanel("Failed to update subtasks. Please try again.");
  }
});

async function fetchTasks(searchQuery = "") {
  const taskList = document.getElementById("task-list");
  taskList.style.opacity = "0";
  taskList.innerHTML = "";

  try {
    const querySnapshot = await getDocs(collection(db, "tb_pretask"));

    allTasks = [];
    querySnapshot.forEach((doc) => {
      allTasks.push({
        id: doc.id,
        data: doc.data(),
      });
    });

    let filteredTasks = allTasks;
    if (searchQuery) {
      filteredTasks = allTasks.filter((task) =>
        task.data.task_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const totalPages = Math.ceil(filteredTasks.length / rowsPerPage);

    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredTasks.length);

    if (filteredTasks.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="2" class="no-tasks-found">No tasks found</td>
      `;
      taskList.appendChild(row);
    } else {
      for (let i = startIndex; i < endIndex; i++) {
        const taskData = filteredTasks[i].data;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${taskData.task_name}</td>
          <td>
            <img src="/public/images/image 27.png" alt="Edit" title="Edit Task" class="action-icon edit-task-icon" data-id="${filteredTasks[i].id}">
            <img src="/public/images/Delete.png" alt="Delete" title="Delete Task" class="action-icon delete-task-icon" data-id="${filteredTasks[i].id}">
          </td>
        `;
        taskList.appendChild(row);
      }

      const deleteIcons = document.querySelectorAll(".delete-task-icon");
      deleteIcons.forEach((icon) => {
        icon.addEventListener("click", (e) => {
          taskToDeleteId = e.target.dataset.id;
          deleteConfirmationModal.style.display = "flex";
        });
      });

      const editIcons = document.querySelectorAll(".edit-task-icon");
      editIcons.forEach((icon) => {
        icon.addEventListener("click", async (e) => {
          editingTaskId = e.target.dataset.id;
          editTaskModal.style.display = "flex";

          const taskRef = doc(db, "tb_pretask", editingTaskId);
          const taskSnap = await getDoc(taskRef);

          if (taskSnap.exists()) {
            const taskData = taskSnap.data();
            subtaskList.innerHTML = "";
            initialSubtasks = [...taskData.subtasks];

            taskData.subtasks.forEach((subtask) => {
              const subtaskName =
                typeof subtask === "string" ? subtask : subtask.subtask_name;
              const li = document.createElement("li");
              li.innerHTML = `${subtaskName} <img src="/public/images/Delete.png" alt="Delete" class="delete-subtask-btn">`;
              subtaskList.appendChild(li);
            });

            saveSubtasksBtn.disabled = true;
            checkSaveButtonState();
          }
        });
      });
    }

    setTimeout(() => {
      taskList.style.opacity = "1";
    }, 100);

    updatePaginationControls(totalPages);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    showErrorPanel("Failed to fetch tasks. Please try again.");
  }
}

function updatePaginationControls(totalPages) {
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");
  const pageInfo = document.getElementById("page-info");

  pageInfo.textContent = `${currentPage} of ${totalPages || 1}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

confirmDeleteBtn.addEventListener("click", async () => {
  if (taskToDeleteId) {
    try {
      await deleteDoc(doc(db, "tb_pretask", taskToDeleteId));
      taskToDeleteId = null;
      deleteConfirmationModal.style.display = "none";
      fetchTasks(searchBar.value.trim());
      showSuccessPanel("Task deleted successfully!");
    } catch (error) {
      console.error("Error deleting task:", error);
      showErrorPanel("Failed to delete task. Please try again.");
    }
  }
});

cancelDeleteBtn.addEventListener("click", () => {
  taskToDeleteId = null;
  deleteConfirmationModal.style.display = "none";
});

addSubtaskBtn.addEventListener("click", () => {
  let subtaskName = newSubtaskInput.value.trim();

  if (!subtaskName) return;

  subtaskName = subtaskName.charAt(0).toUpperCase() + subtaskName.slice(1);

  const existingSubtasks = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.trim()
  );

  if (existingSubtasks.includes(subtaskName)) {
    showErrorPanel(`"${subtaskName}" is already in the list.`);
    return;
  }

  const li = document.createElement("li");
  li.innerHTML = `${subtaskName} <img src="/public/images/Delete.png" alt="Delete" class="delete-subtask-btn">`;
  subtaskList.appendChild(li);
  newSubtaskInput.value = "";
  checkSaveButtonState();
});

subtaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-subtask-btn")) {
    e.target.parentElement.remove();
    checkSaveButtonState();
  }
});

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

let cropTypes = [];

openAssignTaskModalBtn.addEventListener("click", () => {
  assignTaskModal.style.display = "flex";
  loadCropTypes();
  loadTasks();
});

closeAssignTaskModalBtn.addEventListener("click", () => {
  assignTaskModal.style.display = "none";
});

async function loadCropTypes() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_crop_types"));
    cropTypes = [];
    cropTypeSelect.innerHTML = "<option value=''></option>";

    if (querySnapshot.empty) {
      showErrorPanel("No crop types available.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      if (cropData && cropData.crop_type_name && cropData.crop_name) {
        cropTypes.push({
          id: doc.id,
          name: cropData.crop_type_name,
          cropName: cropData.crop_name,
        });
      }
    });

    cropTypes.sort((a, b) => a.name.localeCompare(b.name));

    cropTypes.forEach((crop) => {
      const option = document.createElement("option");
      option.value = crop.id;
      option.textContent = crop.name;
      option.dataset.cropName = crop.cropName;
      cropTypeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading crop types:", error);
    showErrorPanel("Failed to load crop types. Please try again.");
  }
}

async function loadTasks() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_pretask"));
    taskCheckboxesContainer.innerHTML = "";

    if (querySnapshot.empty) {
      showErrorPanel("No tasks available to assign.");
      return;
    }

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
  } catch (error) {
    console.error("Error loading tasks:", error);
    showErrorPanel("Failed to load tasks. Please try again.");
  }
}

assignTasksBtn.addEventListener("click", async () => {
  assignTasksBtn.disabled = true;

  const selectedCropTypeId = cropTypeSelect.value;
  const selectedCropTypeName =
    cropTypeSelect.options[cropTypeSelect.selectedIndex].text;
  const selectedTaskIds = Array.from(
    document.querySelectorAll('input[name="tasks"]:checked')
  ).map((checkbox) => checkbox.value);

  if (!selectedCropTypeId || selectedTaskIds.length === 0) {
    showErrorPanel("Please select a crop type and at least one task.");
    assignTasksBtn.disabled = false;
    return;
  }

  try {
    const cropRef = doc(db, "tb_crop_types", selectedCropTypeId);
    const cropSnap = await getDoc(cropRef);

    if (!cropSnap.exists()) {
      showErrorPanel("Error: Crop type not found.");
      assignTasksBtn.disabled = false;
      return;
    }

    const cropData = cropSnap.data();
    const cropName = cropData.crop_name;

    const counterRef = doc(db, "tb_id_counters", "task_id_counter");
    let counterSnap = await getDoc(counterRef);

    let taskCounter;
    if (counterSnap.exists()) {
      taskCounter = counterSnap.data().count;
    } else {
      taskCounter = 1;
      await setDoc(counterRef, { count: taskCounter });
    }

    let duplicateTasks = [];

    for (const taskId of selectedTaskIds) {
      const taskRef = doc(db, "tb_pretask", taskId);
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        continue;
      }

      const taskData = taskSnap.data();

      const taskListQuery = query(
        collection(db, "tb_task_list"),
        where("crop_type_name", "==", selectedCropTypeName),
        where("task_name", "==", taskData.task_name)
      );
      const taskListSnapshot = await getDocs(taskListQuery);

      if (!taskListSnapshot.empty) {
        duplicateTasks.push(taskData.task_name);
        continue;
      }

      const formattedSubtasks = (taskData.subtasks || []).map((subtask) =>
        typeof subtask === "string" ? { subtask_name: subtask } : subtask
      );

      await addDoc(collection(db, "tb_task_list"), {
        task_id: taskCounter,
        crop_type_name: selectedCropTypeName,
        crop_name: cropName,
        task_name: taskData.task_name,
        subtasks: formattedSubtasks,
        assigned_on: new Date(),
      });

      taskCounter++;
    }

    if (taskCounter !== counterSnap.data().count) {
      await updateDoc(counterRef, { count: taskCounter });
    }

    if (duplicateTasks.length > 0) {
      const duplicateMessage = `The following tasks are already assigned to "${selectedCropTypeName}":\n${duplicateTasks
        .map((task) => `- ${task}`)
        .join("\n")}`;
      showErrorPanel(duplicateMessage);
    }

    if (selectedTaskIds.length > duplicateTasks.length) {
      cropTypeSelect.value = "";
      document
        .querySelectorAll('input[name="tasks"]:checked')
        .forEach((checkbox) => (checkbox.checked = false));

      if (typeof fetchAssignedTasks === "function") {
        fetchAssignedTasks();
      }

      showSuccessPanel("Tasks assigned successfully!");
      assignTaskModal.style.display = "none";
    }
  } catch (error) {
    showErrorPanel("An error occurred while assigning tasks. Please try again.");
    console.error("Error assigning tasks:", error);
  } finally {
    assignTasksBtn.disabled = false;
  }
});

const debouncedFetchTasks = debounce(fetchTasks, 300);

searchBar.addEventListener("input", (e) => {
  currentPage = 1;
  const searchQuery = e.target.value.trim();
  debouncedFetchTasks(searchQuery);
});

document.addEventListener("DOMContentLoaded", () => {
  fetchTasks();
  document
    .getElementById("open-add-task-modal")
    .addEventListener("click", function () {
      document.getElementById("add-task-modal").style.display = "flex";
    });

  document
    .getElementById("close-add-task-modal")
    .addEventListener("click", function () {
      document.getElementById("add-task-modal").style.display = "none";
    });
});

document.getElementById("prev-page-btn").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    fetchTasks(searchBar.value.trim());
  }
});

document.getElementById("next-page-btn").addEventListener("click", () => {
  const totalPages = Math.ceil(allTasks.length / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    fetchTasks(searchBar.value.trim());
  }
});