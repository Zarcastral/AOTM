import {
  collection,
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

// ✅ Enable/Disable Buttons
function checkSaveButtonState() {
  const newTaskText = newTaskInput.value.trim();
  const newSubtaskText = newSubtaskInput.value.trim();
  const taskListNotEmpty = newTaskList.children.length > 0;
  const subtaskListItems = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.replace(" X", "").trim()
  );
  const noChangesMade =
    JSON.stringify(subtaskListItems) === JSON.stringify(initialSubtasks);

  saveTasksBtn.disabled = newTaskText === "" && !taskListNotEmpty;
  saveSubtasksBtn.disabled = noChangesMade;
  addSubtaskBtn.disabled = newSubtaskText === "";
}

// ✅ Show/Hide Add Task Modal
openAddTaskModalBtn.addEventListener("click", () => {
  addTaskModal.style.display = "flex";
  checkSaveButtonState();
});

closeAddTaskModalBtn.addEventListener("click", closeAddTaskPopup);
closeEditTaskModalBtn.addEventListener("click", closeEditTaskPopup);
closeDuplicateTaskModal.addEventListener(
  "click",
  () => (duplicateTaskModal.style.display = "none")
);
closeNoChangesModal.addEventListener(
  "click",
  () => (noChangesModal.style.display = "none")
);
closeDuplicateSubtaskModal.addEventListener(
  "click",
  () => (duplicateSubtaskModal.style.display = "none")
);

// ✅ Disable 'Add Subtask' button when input is empty
newSubtaskInput.addEventListener("input", checkSaveButtonState);

// ✅ Add Task to List (Popup)
addTaskBtn.addEventListener("click", () => {
  const taskName = newTaskInput.value.trim();
  if (taskName && !tasks.includes(taskName)) {
    tasks.push(taskName);
    const li = document.createElement("li");
    li.innerHTML = `${taskName} <button class="delete-task-popup-btn">X</button>`;
    newTaskList.appendChild(li);
    newTaskInput.value = "";
  }
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

// ✅ Add Subtask with Duplication Check
addSubtaskBtn.addEventListener("click", () => {
  const subtaskName = newSubtaskInput.value.trim();

  if (!subtaskName) return; // Prevent empty input

  const existingSubtasks = Array.from(subtaskList.children).map((li) =>
    li.textContent.replace(" X", "").trim()
  );

  if (existingSubtasks.includes(subtaskName)) {
    document.getElementById(
      "duplicate-subtask-message"
    ).textContent = `"${subtaskName}" is already registered.`;
    duplicateSubtaskModal.style.display = "flex"; // ✅ Ensure modal is displayed
    return;
  }

  const li = document.createElement("li");
  li.innerHTML = `${subtaskName} <button class="delete-subtask-btn">X</button>`;
  subtaskList.appendChild(li);
  newSubtaskInput.value = "";
  checkSaveButtonState();
});

// ✅ Delete Subtask from List in Edit Task Modal
subtaskList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-subtask-btn")) {
    e.target.parentElement.remove();
    checkSaveButtonState();
  }
});

// ✅ Save Subtasks to Firestore
saveSubtasksBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;

  const updatedSubtasks = Array.from(subtaskList.querySelectorAll("li")).map(
    (li) => li.textContent.replace(" X", "").trim()
  );

  if (JSON.stringify(updatedSubtasks) === JSON.stringify(initialSubtasks)) {
    noChangesModal.style.display = "flex";
    return;
  }

  await updateDoc(doc(db, "tb_pretask", editingTaskId), {
    subtasks: updatedSubtasks,
  });

  closeEditTaskPopup();
  fetchTasks();
});

// ✅ Fetch Tasks from Firestore
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

// ✅ Open Edit Task Modal
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
      initialSubtasks = [...taskData.subtasks];

      taskData.subtasks.forEach((subtask) => {
        const li = document.createElement("li");
        li.innerHTML = `${subtask} <button class="delete-subtask-btn">X</button>`;
        subtaskList.appendChild(li);
      });
    }
    checkSaveButtonState();
  }
});

fetchTasks();
