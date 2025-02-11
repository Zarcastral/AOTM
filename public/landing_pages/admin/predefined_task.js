import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";

const db = getFirestore(app);

// Selectors
const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const editModal = document.getElementById("edit-modal");
const closeModalBtn = document.querySelector(".close-btn");
const editTaskName = document.getElementById("edit-task-name");
const subtaskList = document.getElementById("subtask-list");
const newSubtaskInput = document.getElementById("new-subtask");
const addSubtaskBtn = document.getElementById("add-subtask-btn");
const saveChangesBtn = document.getElementById("save-changes-btn");

let currentTaskId = null;
let subtasks = [];

// Function to fetch and display tasks
async function fetchTasks() {
  taskList.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "tb_pretask"));
  querySnapshot.forEach((docSnap) => {
    const taskData = docSnap.data();
    const taskId = docSnap.id;
    const li = document.createElement("li");

    li.innerHTML = `
            <span>${taskData.task_name}</span>
            <button class="edit-btn" data-id="${taskId}" data-name="${
      taskData.task_name
    }" data-subtasks='${JSON.stringify(taskData.subtasks || [])}'>Edit</button>
            <button class="delete-btn" data-id="${taskId}">Delete</button>
        `;

    taskList.appendChild(li);
  });

  // Attach event listeners dynamically
  document.querySelectorAll(".edit-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const taskId = event.target.getAttribute("data-id");
      const taskName = event.target.getAttribute("data-name");
      const taskSubtasks = JSON.parse(
        event.target.getAttribute("data-subtasks")
      );
      openEditModal(taskId, taskName, taskSubtasks);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const taskId = event.target.getAttribute("data-id");
      await deleteDoc(doc(db, "tb_pretask", taskId));
      fetchTasks();
    });
  });
}

// Function to add a task
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const taskName = document.getElementById("task-name").value;
  await addDoc(collection(db, "tb_pretask"), {
    task_name: taskName,
    subtasks: [],
  });
  taskForm.reset();
  fetchTasks();
});

// Function to open the edit modal
function openEditModal(taskId, taskName, taskSubtasks) {
  currentTaskId = taskId;
  editTaskName.textContent = taskName;
  subtasks = taskSubtasks;
  updateSubtaskList();
  editModal.style.display = "flex";
}

// Function to update the subtask list in the modal
function updateSubtaskList() {
  subtaskList.innerHTML = "";
  subtasks.forEach((subtask, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
            ${subtask}
            <button onclick="removeSubtask(${index})">Remove</button>
        `;
    subtaskList.appendChild(li);
  });
}

// Function to remove a subtask
window.removeSubtask = (index) => {
  subtasks.splice(index, 1);
  updateSubtaskList();
};

// Function to add a subtask
addSubtaskBtn.addEventListener("click", () => {
  const newSubtask = newSubtaskInput.value.trim();
  if (newSubtask) {
    subtasks.push(newSubtask);
    updateSubtaskList();
    newSubtaskInput.value = "";
  }
});

// Function to save changes
saveChangesBtn.addEventListener("click", async () => {
  if (currentTaskId) {
    await updateDoc(doc(db, "tb_pretask", currentTaskId), {
      subtasks: subtasks,
    });
    editModal.style.display = "none";
    fetchTasks();
  }
});

// Close modal event
closeModalBtn.addEventListener("click", () => {
  editModal.style.display = "none";
});

// Fetch tasks on load
fetchTasks();
