import {
  addDoc,
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
const taskList = document.getElementById("task-list");
const addTaskModal = document.getElementById("add-task-modal");
const editTaskModal = document.getElementById("edit-task-modal");
const openAddTaskModalBtn = document.getElementById("open-add-task-modal");
const closeAddTaskModalBtn = document.getElementById("close-add-task-modal");
const closeEditTaskModalBtn = document.getElementById("close-edit-task-modal");
const duplicateTaskModal = document.getElementById("duplicate-task-modal");
const noChangesModal = document.getElementById("no-changes-modal");
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

// Show/Hide Add Task Modal
openAddTaskModalBtn.addEventListener("click", () => {
  addTaskModal.style.display = "flex";
});

closeAddTaskModalBtn.addEventListener("click", () => {
  closeAddTaskPopup();
});

// Show/Hide Edit Task Modal
closeEditTaskModalBtn.addEventListener("click", () => {
  closeEditTaskPopup();
});

// Show/Hide Duplicate Task Warning
closeDuplicateTaskModal.addEventListener("click", () => {
  duplicateTaskModal.style.display = "none";
});

// Show/Hide No Changes Warning
closeNoChangesModal.addEventListener("click", () => {
  noChangesModal.style.display = "none";
});

// Add Task to Temporary List
addTaskBtn.addEventListener("click", () => {
  const taskName = newTaskInput.value.trim();
  if (taskName && !tasks.includes(taskName)) {
    tasks.push(taskName);
    const li = document.createElement("li");
    li.innerHTML = `${taskName} <button class="delete-task-popup-btn">X</button>`;
    newTaskList.appendChild(li);
    newTaskInput.value = ""; // Clear input after adding
  }
});

// Remove Task from Temporary List
newTaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-task-popup-btn")) {
    e.target.parentElement.remove();
    tasks = tasks.filter(
      (task) =>
        task !== e.target.parentElement.textContent.replace(" X", "").trim()
    );
  }
});

// Save Tasks to Firestore with Duplication Check
saveTasksBtn.addEventListener("click", async () => {
  if (tasks.length === 0) {
    noChangesModal.style.display = "flex"; // Show message if no tasks were added
    return;
  }

  for (const taskName of tasks) {
    const q = query(
      collection(db, "tb_pretask"),
      where("task_name", "==", taskName)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      duplicateTaskModal.style.display = "flex";
      return;
    }

    await addDoc(collection(db, "tb_pretask"), {
      task_name: taskName,
      subtasks: [],
    });
  }
  closeAddTaskPopup(); // Close modal and clear inputs
  fetchTasks();
});

// Fetch Tasks from Firestore
async function fetchTasks() {
  taskList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "tb_pretask"));
  querySnapshot.forEach((doc) => {
    const taskData = doc.data();
    const taskItem = document.createElement("li");
    taskItem.innerHTML = `
            ${taskData.task_name} 
            <button class="edit-task-btn" data-id="${doc.id}">Edit</button>
            <button class="delete-task-btn" data-id="${doc.id}">Delete</button>
        `;
    taskList.appendChild(taskItem);
  });
}

// Handle Edit Task
taskList.addEventListener("click", async (e) => {
  if (e.target.classList.contains("edit-task-btn")) {
    editingTaskId = e.target.dataset.id;
    editTaskModal.style.display = "flex";

    const taskDoc = await getDocs(
      query(
        collection(db, "tb_pretask"),
        where("__name__", "==", editingTaskId)
      )
    );

    if (!taskDoc.empty) {
      const taskData = taskDoc.docs[0].data();
      subtaskList.innerHTML = "";
      taskData.subtasks.forEach((subtask) => {
        const li = document.createElement("li");
        li.innerHTML = `${subtask} <button class="delete-subtask-btn">X</button>`;
        subtaskList.appendChild(li);
      });
    }
  }
});

// Add Subtask
addSubtaskBtn.addEventListener("click", () => {
  const subtaskName = newSubtaskInput.value.trim();
  if (subtaskName) {
    const li = document.createElement("li");
    li.innerHTML = `${subtaskName} <button class="delete-subtask-btn">X</button>`;
    subtaskList.appendChild(li);
    newSubtaskInput.value = ""; // Clear input after adding
  }
});

// Save Subtasks to Firestore
saveSubtasksBtn.addEventListener("click", async () => {
  const subtasks = [];
  subtaskList.querySelectorAll("li").forEach((li) => {
    subtasks.push(li.textContent.replace(" X", "").trim());
  });

  if (editingTaskId) {
    const taskRef = doc(db, "tb_pretask", editingTaskId);
    await updateDoc(taskRef, { subtasks });
  } else {
    noChangesModal.style.display = "flex"; // Show message if no changes
    return;
  }

  closeEditTaskPopup(); // Close modal and clear inputs
  fetchTasks();
});

// Delete Task
taskList.addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-task-btn")) {
    const taskId = e.target.dataset.id;
    await deleteDoc(doc(db, "tb_pretask", taskId));
    fetchTasks();
  }
});

// Delete Subtask
subtaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-subtask-btn")) {
    e.target.parentElement.remove();
  }
});

// Function to Close Add Task Pop-up
function closeAddTaskPopup() {
  addTaskModal.style.display = "none";
  newTaskInput.value = "";
  newTaskList.innerHTML = "";
  tasks = [];
}

// Function to Close Edit Task Pop-up
function closeEditTaskPopup() {
  editTaskModal.style.display = "none";
  newSubtaskInput.value = "";
  subtaskList.innerHTML = "";
  editingTaskId = null;
}

// Initial Fetch of Tasks
fetchTasks();
