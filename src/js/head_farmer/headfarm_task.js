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

// Utility function to check if current date is past end_date
function isPastEndDate(endDate) {
  const currentDate = new Date();
  const projectEndDate = new Date(endDate);
  return currentDate > projectEndDate;
}

// Function to show success panel
function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;

  document.body.appendChild(successMessage);

  // Fade in
  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.opacity = "1";
  }, 5);

  // Fade out after 4 seconds
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
  errorMessage.className = "success-message";
  errorMessage.textContent = message;
  errorMessage.style.backgroundColor = "#AC415B";

  document.body.appendChild(errorMessage);

  // Fade in
  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.opacity = "1";
  }, 5);

  // Fade out after 4 seconds
  setTimeout(() => {
    errorMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(errorMessage);
    }, 400);
  }, 4000);
}

export async function fetchProjectsForFarmer() {
  const userType = sessionStorage.getItem("user_type"); // Get user_type
  const farmerId = sessionStorage.getItem("farmer_id");

  // For Admin, Supervisor, or Farm President: Fetch via project_id
  if (["Admin", "Supervisor", "Farm President"].includes(userType)) {
    const projectId = sessionStorage.getItem("selected_project_id"); // From fetchAndStoreProjectDetails()

    if (!projectId) {
      console.log("No project ID found for this user.");
      return;
    }

    try {
      const projectsRef = collection(db, "tb_projects");
      const q = query(projectsRef, where("project_id", "==", parseInt(projectId, 10)));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("Project not found.");
        return;
      }

      querySnapshot.forEach((doc) => {
        const project = doc.data();
        if (project.status === "Ongoing") {
          sessionStorage.setItem("selected_crop_type", project.crop_type_name);
          sessionStorage.setItem("selected_crop_name", project.crop_name);
          sessionStorage.setItem("selected_project_end_date", project.end_date);
          console.log(`Fetched project ${project.project_id}`);
          fetchProjectTasks(project.crop_type_name, project.project_id);
        }
      });

    } catch (error) {
      console.error("Error fetching project:", error);
    }
    return;
  }

  // Original logic for Head Farmer
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

    querySnapshot.forEach((doc) => {
      const project = doc.data();
      if (project.status === "Ongoing") {
        sessionStorage.setItem("selected_project_id", String(project.project_id));
        sessionStorage.setItem("selected_crop_type", project.crop_type_name);
        sessionStorage.setItem("selected_crop_name", project.crop_name);
        sessionStorage.setItem("selected_project_end_date", project.end_date);
        console.log(`Fetched end_date for project ${project.project_id}`);
        fetchProjectTasks(project.crop_type_name, project.project_id);
      }
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
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
      renderTasks(); // You might want to pass a flag here if needed
      return;
    }

    allTasks = [];
    querySnapshot.forEach((docSnapshot) => {
      const taskData = docSnapshot.data();
      allTasks.push({
        id: docSnapshot.id,
        data: taskData,
      });
    });

    filteredTasks = [...allTasks];
    updatePagination();

    // Retrieve the user type from sessionStorage
    const userType = sessionStorage.getItem("user_type");
    // Determine if edit and delete options should be shown:
    // Only show if userType is "Head Farmer"
    const allowEditDelete = (userType === "Head Farmer");

    // Pass the flag to renderTasks so it can conditionally display the edit and delete buttons
    renderTasks(allowEditDelete);

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

function renderTasks(allowEditDelete) {
  // If allowEditDelete is not provided, determine it based on sessionStorage
  if (allowEditDelete === undefined) {
    const userType = sessionStorage.getItem("user_type");
    allowEditDelete = (userType === "Head Farmer");
  }

  const taskTableBody = document.getElementById("taskTableBody");
  if (!taskTableBody) return;

  taskTableBody.innerHTML = "";

  const searchInput = document.querySelector(".search-container input");
  const searchTerm = searchInput ? searchInput.value.trim() : "";

  if (filteredTasks.length === 0) {
    taskTableBody.innerHTML = `<tr><td colspan="6">${
      searchTerm ? "No record found." : "No tasks found."
    }</td></tr>`;
  } else {
    const startIndex = (currentPage - 1) * tasksPerPage;
    const endIndex = Math.min(startIndex + tasksPerPage, filteredTasks.length);
    const currentTasks = filteredTasks.slice(startIndex, endIndex);

    currentTasks.forEach((taskObj) => {
      const task = taskObj.data;
      const taskId = taskObj.id;

      // Build action icons based on allowEditDelete flag
      const actionIcons = allowEditDelete
        ? `
            <img src="../../images/eye.png" alt="View" class="view-icon" data-task-id="${taskId}">
            <img src="../../images/Edit.png" alt="Edit" class="edit-icon" data-task-id="${taskId}">
            <img src="../../images/Delete.png" alt="Delete" class="delete-icon" data-task-id="${taskId}">
          `
        : `
            <img src="../../images/eye.png" alt="View" class="view-icon" data-task-id="${taskId}">
          `;

      const taskRow = `
        <tr id="task-row-${taskId}">
          <td>${task.task_name}</td>
          <td>${task.subtasks.length}</td>
          <td class="start-date" data-task-id="${taskId}">${
        task.start_date ? task.start_date : "--"
      }</td>
          <td class="end-date" data-task-id="${taskId}">${
        task.end_date ? task.end_date : "--"
      }</td>
          <td>${task.task_status}</td>
          <td>
            <div class="action-icons">
              ${actionIcons}
            </div>
          </td>
        </tr>
      `;
      taskTableBody.insertAdjacentHTML("beforeend", taskRow);
    });
  }

  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  pageInfo.textContent =
    totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : "Page 1 of 1";
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

  const addTaskButton = document.getElementById("addTaskButton");  
const userType = sessionStorage.getItem("user_type");

// Disable button + style it if user is not Head Farmer
if (userType !== "Head Farmer") {
  addTaskButton.disabled = true;
  addTaskButton.style.opacity = "0.5";
  addTaskButton.style.cursor = "not-allowed";
}


  addTaskButton.addEventListener("click", () => {
    const endDate = sessionStorage.getItem("selected_project_end_date");
    if (endDate && isPastEndDate(endDate)) {
      showErrorPanel(
        "Project is way past the deadline, request extension of project"
      );
      return;
    }
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

  window.addEventListener("focus", () => {
    const cropTypeName = sessionStorage.getItem("selected_crop_type");
    const projectId = sessionStorage.getItem("selected_project_id");
    if (cropTypeName && projectId) {
      fetchProjectTasks(cropTypeName, projectId);
    }
  });
}

function attachRowEventListeners() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  const isPastEnd = endDate ? isPastEndDate(endDate) : false;

  document.querySelectorAll(".delete-icon").forEach((icon) => {
    const newIcon = icon.cloneNode(true);
    icon.parentNode.replaceChild(newIcon, icon);
    newIcon.addEventListener("click", async (event) => {
      if (isPastEnd) {
        showErrorPanel(
          "Project is way past the deadline, request extension of project"
        );
        return;
      }
      const taskId = event.currentTarget.dataset.taskId;
      try {
        const taskSnap = await getDocs(
          query(
            collection(db, "tb_project_task"),
            where("__name__", "==", taskId)
          )
        );
        if (!taskSnap.empty) {
          const taskData = taskSnap.docs[0].data();
          const taskName = taskData.task_name;
          if (taskData.task_status === "Completed") {
            showErrorPanel(`"${taskName}" is completed and cannot be deleted.`);
            console.log(`Attempted to delete completed task: ${taskName}`);
            return;
          }
        } else {
          console.log(`Task ${taskId} not found in Firestore.`);
          alert("Task not found.");
          return;
        }
      } catch (error) {
        console.error("❌ Error checking task status:", error);
        alert("Error checking task status. Try again.");
        return;
      }
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

      const tasksRef = collection(db, "tb_project_task");
      const q = query(tasksRef, where("__name__", "==", taskId));
      getDocs(q)
        .then((querySnapshot) => {
          if (!querySnapshot.empty) {
            const taskData = querySnapshot.docs[0].data();
            const projectTaskId = taskData.project_task_id;
            sessionStorage.setItem("project_task_id", projectTaskId);
            sessionStorage.setItem("selected_task_name", taskName);
            const endDate = sessionStorage.getItem("selected_project_end_date");
            if (endDate) {
              sessionStorage.setItem("selected_project_end_date", endDate);
            }
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
      if (isPastEnd) {
        showErrorPanel(
          "Project is way past the deadline, request extension of project"
        );
        return;
      }
      const taskId = event.currentTarget.dataset.taskId;
      const taskRow = document.getElementById(`task-row-${taskId}`);
      const currentTaskName =
        taskRow.querySelector("td:first-child").textContent;
      openEditModal(taskId, currentTaskName);
    });
  });
}

const addTaskModal = document.getElementById("addTaskModal");
const taskNameInput = document.getElementById("taskNameInput");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");

const deleteTaskModal = document.getElementById("deleteTaskModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const editTaskModal = document.getElementById("editTaskModal");
const editTaskNameInput = document.getElementById("editTaskNameInput");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const closeEditModalBtn = document.querySelector(".close-edit-modal");

let taskToDelete = null;
let taskToEdit = null;
let originalTaskName = null;

function openDeleteModal(taskId) {
  taskToDelete = taskId;
  deleteTaskModal.classList.remove("hidden");
}

function openEditModal(taskId, currentTaskName) {
  taskToEdit = taskId;
  originalTaskName = currentTaskName;
  editTaskNameInput.value = currentTaskName;
  editTaskModal.classList.remove("hidden");

  saveEditBtn.disabled = true;

  saveEditBtn.removeEventListener("click", saveEditHandler);
  cancelEditBtn.removeEventListener("click", cancelEditHandler);
  closeEditModalBtn.removeEventListener("click", cancelEditHandler);
  editTaskNameInput.removeEventListener("input", checkTaskNameChange);

  saveEditBtn.addEventListener("click", saveEditHandler);
  cancelEditBtn.addEventListener("click", cancelEditHandler);
  closeEditModalBtn.addEventListener("click", cancelEditHandler);
  editTaskNameInput.addEventListener("input", checkTaskNameChange);
}

function checkTaskNameChange() {
  const currentInput = editTaskNameInput.value.trim();
  saveEditBtn.disabled =
    currentInput.toLowerCase() === originalTaskName.toLowerCase();
}

async function saveEditHandler() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

  const newTaskNameRaw = editTaskNameInput.value.trim();
  if (!newTaskNameRaw) {
    alert("Please enter a task name.");
    return;
  }

  const newTaskName =
    newTaskNameRaw.charAt(0).toUpperCase() +
    newTaskNameRaw.slice(1).toLowerCase();

  if (newTaskName.toLowerCase() === originalTaskName.toLowerCase()) {
    editTaskModal.classList.add("hidden");
    return;
  }

  try {
    const projectId = sessionStorage.getItem("selected_project_id");
    if (!projectId) {
      alert("No project selected.");
      return;
    }

    const taskSnap = await getDocs(
      query(
        collection(db, "tb_project_task"),
        where("__name__", "==", taskToEdit)
      )
    );
    if (taskSnap.empty) {
      alert("Task not found.");
      return;
    }
    const projectTaskId = taskSnap.docs[0].data().project_task_id;

    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", String(projectId)),
      where("task_name", "==", newTaskName)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingTaskDoc = querySnapshot.docs.find(
        (doc) => doc.id !== taskToEdit
      );
      if (existingTaskDoc) {
        showErrorPanel(`"${newTaskName}" already exists in this project.`);
        editTaskNameInput.value = originalTaskName;
        saveEditBtn.disabled = true;
        return;
      }
    }

    const taskRef = doc(db, "tb_project_task", taskToEdit);
    await updateDoc(taskRef, { task_name: newTaskName });
    console.log(`✅ Task ${taskToEdit} updated to "${newTaskName}"`);

    const attendanceSubRef = collection(
      db,
      `tb_project_task/${taskToEdit}/Attendance`
    );
    const attendanceSubSnap = await getDocs(attendanceSubRef);
    if (!attendanceSubSnap.empty) {
      const updatePromises = attendanceSubSnap.docs.map((subDoc) =>
        updateDoc(subDoc.ref, { task_name: newTaskName })
      );
      await Promise.all(updatePromises);
      console.log(
        `✅ Updated ${attendanceSubSnap.size} Attendance subcollection records`
      );
    }

    const attendanceRef = collection(db, "tb_attendance");
    const attendanceQuery = query(
      attendanceRef,
      where("project_task_id", "==", projectTaskId)
    );
    const attendanceSnap = await getDocs(attendanceQuery);
    if (!attendanceSnap.empty) {
      const updateAttendancePromises = attendanceSnap.docs.map((attDoc) =>
        updateDoc(attDoc.ref, { task_name: newTaskName })
      );
      await Promise.all(updateAttendancePromises);
      console.log(`✅ Updated ${attendanceSnap.size} tb_attendance records`);
    }

    const taskIndex = allTasks.findIndex((task) => task.id === taskToEdit);
    if (taskIndex !== -1) {
      allTasks[taskIndex].data.task_name = newTaskName;
      filteredTasks = [...allTasks];
    }

    showSuccessPanel("Task name updated successfully!");
    editTaskModal.classList.add("hidden");
    renderTasks();
  } catch (error) {
    console.error("❌ Error updating task and related records:", error);
    alert("Failed to update task. Try again.");
  }
}

function cancelEditHandler() {
  editTaskNameInput.value = "";
  editTaskModal.classList.add("hidden");
  taskToEdit = null;
  originalTaskName = null;
}

async function saveTaskHandler() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

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

    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", String(projectId)),
      where("task_name", "==", taskName)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      showErrorPanel(
        "A task with this name already exists in the project. Please use a different name."
      );
      return;
    }

    const idCounterRef = doc(db, "tb_id_counters", "project_task_id_counter");
    const idCounterSnap = await getDocs(collection(db, "tb_id_counters"));

    let projectTaskId = 1;
    if (!idCounterSnap.empty) {
      const idCounterData = idCounterSnap.docs
        .find((doc) => doc.id === "project_task_id_counter")
        ?.data();
      if (idCounterData && idCounterData.count) {
        projectTaskId = idCounterData.count + 1;
        await updateDoc(idCounterRef, { count: projectTaskId });
      }
    } else {
      await setDoc(idCounterRef, { count: projectTaskId });
    }

    const newTask = {
      project_task_id: projectTaskId,
      task_name: taskName,
      project_id: String(projectId),
      crop_type_name: cropTypeName,
      crop_name: cropName,
      task_status: "Pending",
      subtasks: [],
      start_date: null,
      end_date: null,
    };

    const docRef = await addDoc(tasksRef, newTask);
    sessionStorage.setItem("project_task_id", projectTaskId);

    allTasks.push({
      id: docRef.id,
      data: newTask,
    });

    filteredTasks = [...allTasks];

    console.log(
      `✅ Task "${taskName}" added successfully with ID: ${projectTaskId}`
    );
    showSuccessPanel("Task added successfully!");
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
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    deleteTaskModal.classList.add("hidden");
    return;
  }

  if (!taskToDelete) return;

  try {
    const taskSnap = await getDocs(
      query(
        collection(db, "tb_project_task"),
        where("__name__", "==", taskToDelete)
      )
    );
    if (taskSnap.empty) {
      console.log(`Task ${taskToDelete} not found in Firestore.`);
      alert("Task not found.");
      deleteTaskModal.classList.add("hidden");
      return;
    }
    const projectTaskId = taskSnap.docs[0].data().project_task_id;

    const attendanceRef = collection(db, "tb_attendance");
    const attendanceQuery = query(
      attendanceRef,
      where("project_task_id", "==", projectTaskId)
    );
    const attendanceSnap = await getDocs(attendanceQuery);
    if (!attendanceSnap.empty) {
      const deleteAttendancePromises = attendanceSnap.docs.map((attDoc) =>
        deleteDoc(attDoc.ref)
      );
      await Promise.all(deleteAttendancePromises);
      console.log(`✅ Deleted ${attendanceSnap.size} tb_attendance records`);
    } else {
      console.log("No tb_attendance records found for this task.");
    }

    const attendanceSubRef = collection(
      db,
      `tb_project_task/${taskToDelete}/Attendance`
    );
    const attendanceSubSnap = await getDocs(attendanceSubRef);
    if (!attendanceSubSnap.empty) {
      const deleteSubPromises = attendanceSubSnap.docs.map((subDoc) =>
        deleteDoc(subDoc.ref)
      );
      await Promise.all(deleteSubPromises);
      console.log(
        `✅ Deleted ${attendanceSubSnap.size} Attendance subcollection records`
      );
    } else {
      console.log("No Attendance subcollection records found for this task.");
    }

    await deleteDoc(doc(db, "tb_project_task", taskToDelete));
    console.log(
      `✅ Task ${taskToDelete} deleted successfully from tb_project_task`
    );

    const taskIndex = allTasks.findIndex((task) => task.id === taskToDelete);
    if (taskIndex !== -1) {
      allTasks.splice(taskIndex, 1);
      filteredTasks = [...allTasks];
    }

    showSuccessPanel("Task and associated records deleted successfully!");
    updatePagination();
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
    renderTasks();
  } catch (error) {
    console.error("❌ Error deleting task and related records:", error);
    alert("Failed to delete task. Try again.");
  }

  deleteTaskModal.classList.add("hidden");
  taskToDelete = null;
}

document.addEventListener("DOMContentLoaded", () => {
  fetchProjectsForFarmer();
});
