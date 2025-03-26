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

let allTasks = [];
let filteredTasks = [];
let tasksPerPage = 5;
let currentPage = 1;
let totalPages = 0;

export async function fetchProjectsForFarmer() {
  const farmerId = sessionStorage.getItem("farmer_id");

  if (!farmerId) {
    console.log("No farmer ID found in session.");
    return;
  }

  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No project found where the farmer is a team lead.");
      return;
    }

    querySnapshot.forEach(async (doc) => {
      const project = doc.data();
      if (project.status === "Ongoing") {
        sessionStorage.setItem("selected_project_id", String(project.project_id));
        sessionStorage.setItem("selected_crop_type", project.crop_type_name);
        sessionStorage.setItem("selected_crop_name", project.crop_name);
        await fetchProjectTasks(project.crop_type_name, project.project_id);
      }
    });
  } catch (error) {
    console.error("❌ Error fetching projects:", error);
  }
}

async function fetchProjectTasks(cropTypeName, projectId) {
  try {
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("crop_type_name", "==", cropTypeName),
      where("project_id", "==", projectId.toString())
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`No tasks found for project ID ${projectId}.`);
      allTasks = [];
      filteredTasks = [];
      renderTasks();
      return;
    }

    allTasks = [];
    querySnapshot.forEach((docSnapshot) => {
      allTasks.push({
        id: docSnapshot.id,
        data: docSnapshot.data(),
      });
    });

    filteredTasks = [...allTasks];
    updatePagination();
    renderTasks();

    attachGlobalEventListeners();
  } catch (error) {
    console.error("❌ Error fetching project tasks:", error);
  }
}

function updatePagination() {
  totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  } else if (filteredTasks.length === 0) {
    currentPage = 1;
  }
}

function renderTasks() {
  const taskTableBody = document.getElementById("taskTableBody");
  taskTableBody.innerHTML = "";

  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = Math.min(startIndex + tasksPerPage, filteredTasks.length);
  const currentTasks = filteredTasks.slice(startIndex, endIndex);

  currentTasks.forEach((taskObj) => {
    const task = taskObj.data;
    const taskId = taskObj.id;

    const taskRow = `
      <tr id="task-row-${taskId}">
        <td>${task.task_name}</td>
        <td>${task.subtasks.length}</td>
        <td class="start-date" data-task-id="${taskId}">${task.start_date ? task.start_date : "--"}</td>
        <td class="end-date" data-task-id="${taskId}">${task.end_date ? task.end_date : "--"}</td>
        <td>
          <select class="status-dropdown" data-task-id="${taskId}">
            <option value="Pending" ${task.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Ongoing" ${task.status === "Ongoing" ? "selected" : ""}>Ongoing</option>
            <option value="Completed" ${task.status === "Completed" ? "selected" : ""}>Completed</option>
          </select>
        </td>
        <td>
          <div class="action-icons">
            <img src="../../images/eye.png" alt="View" class="view-icon" data-task-id="${taskId}">
            <img src="../../images/Edit.png" alt="Edit" class="edit-icon" data-task-id="${taskId}">
            <img src="../../images/Delete.png" alt="Delete" class="delete-icon" data-task-id="${taskId}">
          </div>
        </td>
      </tr>
    `;
    taskTableBody.insertAdjacentHTML("beforeend", taskRow);
  });

  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  pageInfo.textContent = totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : "Page 1 of 1";
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || filteredTasks.length === 0;

  attachRowEventListeners();
}

let globalListenersAttached = false;

function attachGlobalEventListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTasks();
    }
  });

  document.getElementById("nextPageBtn").addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTasks();
    }
  });

  document.getElementById("addTaskButton").addEventListener("click", () => {
    addTaskModal.classList.remove("hidden");
  });

  cancelTaskBtn.addEventListener("click", () => {
    taskNameInput.value = "";
    addTaskModal.classList.add("hidden");
  });

  saveTaskBtn.addEventListener("click", saveTaskHandler);

  cancelDeleteBtn.addEventListener("click", () => {
    taskToDelete = null;
    deleteTaskModal.classList.add("hidden");
  });

  confirmDeleteBtn.addEventListener("click", deleteTaskHandler);

  const searchInput = document.querySelector(".search-container input");
  searchInput.addEventListener("input", (event) => {
    const searchTerm = event.target.value.trim().toLowerCase();
    filteredTasks = allTasks.filter((taskObj) =>
      taskObj.data.task_name.toLowerCase().includes(searchTerm)
    );
    currentPage = 1;
    updatePagination();
    renderTasks();
  });
}

function attachRowEventListeners() {
  document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
    const newDropdown = dropdown.cloneNode(true);
    dropdown.parentNode.replaceChild(newDropdown, dropdown);
    newDropdown.addEventListener("change", async (event) => {
      const taskId = event.target.dataset.taskId;
      const newStatus = event.target.value;
      await updateTaskStatus(taskId, newStatus);
    });
  });

  document.querySelectorAll(".delete-icon").forEach((icon) => {
    const newIcon = icon.cloneNode(true);
    icon.parentNode.replaceChild(newIcon, icon);
    newIcon.addEventListener("click", (event) => {
      const taskId = event.currentTarget.dataset.taskId;
      openDeleteModal(taskId);
    });
  });

  document.querySelectorAll(".view-icon").forEach((icon) => {
    const newIcon = icon.cloneNode(true);
    icon.parentNode.replaceChild(newIcon, icon);
    newIcon.addEventListener("click", (event) => {
      const taskId = event.currentTarget.dataset.taskId;
      const taskRow = document.getElementById(`task-row-${taskId}`);
      const taskName = taskRow.querySelector("td:first-child").textContent;

      const tasksRef = collection(db, "tb_project_task"); // Fixed typo here
      const q = query(tasksRef, where("__name__", "==", taskId));
      getDocs(q)
        .then((querySnapshot) => {
          if (!querySnapshot.empty) {
            const taskData = querySnapshot.docs[0].data();
            const projectTaskId = taskData.project_task_id;
            sessionStorage.setItem("project_task_id", projectTaskId);
            sessionStorage.setItem("selected_task_name", taskName);
            window.location.href = "headfarm_subtask.html";
          }
        })
        .catch((error) => {
          console.error("❌ Error fetching task data:", error);
        });
    });
  });

  document.querySelectorAll(".edit-icon").forEach((icon) => {
    const newIcon = icon.cloneNode(true);
    icon.parentNode.replaceChild(newIcon, icon);
    newIcon.addEventListener("click", (event) => {
      const taskId = event.currentTarget.dataset.taskId;
      console.log(`Edit clicked for task ${taskId}`);
    });
  });
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    const taskDocRef = doc(db, "tb_project_task", taskId);
    const updateData = { status: newStatus };
    const today = new Date().toISOString().split("T")[0];

    if (newStatus === "Ongoing") {
      updateData.start_date = today;
      updateData.end_date = null;
    } else if (newStatus === "Pending") {
      updateData.end_date = null;
      updateData.start_date = null;
    } else if (newStatus === "Completed") {
      updateData.end_date = today;
    }

    await updateDoc(taskDocRef, updateData);
    console.log(`✅ Task ${taskId} status updated to ${newStatus}`);

    const taskIndex = allTasks.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      allTasks[taskIndex].data.status = newStatus;
      allTasks[taskIndex].data.start_date = updateData.start_date || allTasks[taskIndex].data.start_date;
      allTasks[taskIndex].data.end_date = updateData.end_date || allTasks[taskIndex].data.end_date;
      filteredTasks = [...allTasks];
    }

    updatePagination();
    renderTasks();
  } catch (error) {
    console.error("❌ Error updating task status:", error);
  }
}

const addTaskModal = document.getElementById("addTaskModal");
const taskNameInput = document.getElementById("taskNameInput");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");

const deleteTaskModal = document.getElementById("deleteTaskModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let taskToDelete = null;

function openDeleteModal(taskId) {
  taskToDelete = taskId;
  deleteTaskModal.classList.remove("hidden");
}

async function saveTaskHandler() {
  const taskName = taskNameInput.value.trim();

  if (!taskName) {
    alert("Please enter a task name.");
    return;
  }

  try {
    const projectId = sessionStorage.getItem("selected_project_id");
    const cropTypeName = sessionStorage.getItem("selected_crop_type");
    const cropName = sessionStorage.getItem("selected_crop_name");

    if (!projectId || !cropTypeName || !cropName) {
      alert("Missing project or crop details.");
      return;
    }

    // Check for duplicate task name in the same project
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", String(projectId)),
      where("task_name", "==", taskName)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      alert("A task with this name already exists in the project. Please use a different name.");
      return;
    }

    // If no duplicate is found, proceed to add the task
    const docRef = await addDoc(tasksRef, {
      task_name: taskName,
      project_id: String(projectId),
      crop_type_name: cropTypeName,
      crop_name: cropName,
      status: "Pending",
      subtasks: [],
    });

    allTasks.push({
      id: docRef.id,
      data: {
        task_name: taskName,
        project_id: String(projectId),
        crop_type_name: cropTypeName,
        crop_name: cropName,
        status: "Pending",
        subtasks: [],
      },
    });

    filteredTasks = [...allTasks];

    console.log(`✅ Task "${taskName}" added successfully!`);
    alert("Task added successfully!");
    taskNameInput.value = "";
    addTaskModal.classList.add("hidden");

    updatePagination();
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    renderTasks();
  } catch (error) {
    console.error("❌ Error adding task:", error);
    alert("Failed to add task. Try again.");
  }
}

async function deleteTaskHandler() {
  if (!taskToDelete) return;

  try {
    await deleteDoc(doc(db, "tb_project_task", taskToDelete));
    console.log(`✅ Task ${taskToDelete} deleted successfully!`);

    const taskIndex = allTasks.findIndex((task) => task.id === taskToDelete);
    if (taskIndex !== -1) {
      allTasks.splice(taskIndex, 1);
      filteredTasks = [...allTasks];
    }

    alert("Task deleted successfully!");
    updatePagination();
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
    renderTasks();
  } catch (error) {
    console.error("❌ Error deleting task:", error);
    alert("Failed to delete task. Try again.");
  }

  deleteTaskModal.classList.add("hidden");
  taskToDelete = null;
}

fetchProjectsForFarmer();