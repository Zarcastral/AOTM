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
import app from "../../src/config/firebase_config.js";

const db = getFirestore(app);

let allTasks = [];
let filteredTasks = [];
let tasksPerPage = 5;
let currentPage = 1;
let totalPages = 0;

// Utility function to check if current date is past end_date
function isPastEndDate(endDate, extendDate) {
  const currentDate = new Date();
  // Use extendDate if it exists and is valid, otherwise use endDate
  const effectiveEndDate = extendDate
    ? new Date(extendDate)
    : new Date(endDate);
  return currentDate > effectiveEndDate;
}

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
  errorMessage.className = "success-message";
  errorMessage.textContent = message;
  errorMessage.style.backgroundColor = "#AC415B";

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

// New function to display "No tasks available" message
function displayNoTasksMessage() {
  const taskTableBody = document.getElementById("taskTableBody");
  if (!taskTableBody) return;
  taskTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No tasks available.</td></tr>`;
  updateFinishProjectButton(); // Update button state when no tasks
}

// Modified fetchProjectsForFarmer to store project status
// Modified fetchProjectsForFarmer to store project status
// Modified fetchProjectsForFarmer to store lead_farmer_id
export async function fetchProjectsForFarmer() {
  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");

  if (["Admin", "Supervisor", "Farm President"].includes(userType)) {
    const projectId = sessionStorage.getItem("selected_project_id");
    if (!projectId) {
      console.log("No project ID found for this user.");
      displayNoTasksMessage();
      return;
    }
    // Existing logic for Admin/Supervisor/Farm President
    try {
      const projectsRef = collection(db, "tb_projects");
      const q = query(projectsRef, where("project_id", "==", parseInt(projectId, 10)));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        console.log("Project not found.");
        displayNoTasksMessage();
        return;
      }
      querySnapshot.forEach((doc) => {
        const project = doc.data();
        sessionStorage.setItem("selected_crop_type", project.crop_type_name);
        sessionStorage.setItem("selected_crop_name", project.crop_name);
        sessionStorage.setItem("selected_project_end_date", project.end_date);
        sessionStorage.setItem("selected_project_status", project.status);
        sessionStorage.setItem("selected_lead_farmer_id", String(project.lead_farmer_id));
        if (project.extend_date) {
          sessionStorage.setItem("selected_project_extend_date", project.extend_date);
        } else {
          sessionStorage.removeItem("selected_project_extend_date");
        }
        fetchProjectTasks(project.crop_type_name, project.project_id);
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      displayNoTasksMessage();
    }
    return;
  }

  if (!farmerId) {
    console.log("No farmer ID found in session.");
    displayNoTasksMessage();
    return;
  }

  try {
    const projectsRef = collection(db, "tb_projects");
    let q;
    if (userType === "Head Farmer") {
      // Try lead_farmer_id first
      q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
      const leadQuerySnapshot = await getDocs(q);
      if (!leadQuerySnapshot.empty) {
        leadQuerySnapshot.forEach((doc) => {
          const project = doc.data();
          sessionStorage.setItem("selected_project_id", String(project.project_id));
          sessionStorage.setItem("selected_crop_type", project.crop_type_name);
          sessionStorage.setItem("selected_crop_name", project.crop_name);
          sessionStorage.setItem("selected_project_end_date", project.end_date);
          sessionStorage.setItem("selected_project_status", project.status);
          sessionStorage.setItem("selected_lead_farmer_id", String(project.lead_farmer_id));
          fetchProjectTasks(project.crop_type_name, project.project_id);
        });
        return;
      }
      // Fallback: Check if farmer is associated with any project (requires a new field or collection)
      console.log("No lead project found, checking associated projects...");
      // Example: Assume a collection tb_project_members with farmer_id
      const membersRef = collection(db, "tb_project_members");
      q = query(membersRef, where("farmer_id", "==", farmerId));
      const memberQuerySnapshot = await getDocs(q);
      if (memberQuerySnapshot.empty) {
        console.log("No projects found for farmer.");
        displayNoTasksMessage();
        return;
      }
      // Get the first associated project (adjust as needed)
      const projectId = memberQuerySnapshot.docs[0].data().project_id;
      q = query(projectsRef, where("project_id", "==", parseInt(projectId, 10)));
      const projectQuerySnapshot = await getDocs(q);
      if (!projectQuerySnapshot.empty) {
        projectQuerySnapshot.forEach((doc) => {
          const project = doc.data();
          sessionStorage.setItem("selected_project_id", String(project.project_id));
          sessionStorage.setItem("selected_crop_type", project.crop_type_name);
          sessionStorage.setItem("selected_crop_name", project.crop_name);
          sessionStorage.setItem("selected_project_end_date", project.end_date);
          sessionStorage.setItem("selected_project_status", project.status);
          sessionStorage.setItem("selected_lead_farmer_id", String(project.lead_farmer_id));
          fetchProjectTasks(project.crop_type_name, project.project_id);
        });
      } else {
        console.log("No project details found.");
        displayNoTasksMessage();
      }
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
    displayNoTasksMessage();
  }
}

// Modified fetchProjectTasks to update button state
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
      displayNoTasksMessage();
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
    const userType = sessionStorage.getItem("user_type");
    const allowEditDelete = userType === "Head Farmer";
    renderTasks(allowEditDelete);
    updateFinishProjectButton(); // Check button state after fetching tasks
    attachGlobalEventListeners();
  } catch (error) {
    console.error("❌ Error fetching project tasks:", error);
    displayNoTasksMessage();
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

// Modified renderTasks to update button state
// Modified renderTasks to update button state and ensure pagination compatibility
function renderTasks(allowEditDelete) {
  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
  const isLeadFarmer = String(farmerId) === String(leadFarmerId);

  // Override allowEditDelete based on userType and lead_farmer_id
  allowEditDelete =
    userType === "Head Farmer" || (userType === "Farm President" && isLeadFarmer);

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

      const actionIcons = allowEditDelete
        ? `
            <img src="/public/images/eye.png" alt="View" class="view-icon" data-task-id="${taskId}">
            <img src="/public/images/Edit.png" alt="Edit" class="edit-icon" data-task-id="${taskId}">
            <img src="/public/images/Delete.png" alt="Delete" class="delete-icon" data-task-id="${taskId}">
          `
        : `
            <img src="/public/images/eye.png" alt="View" class="view-icon" data-task-id="${taskId}">
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
  updateFinishProjectButton(); // Update button state after rendering
}

let globalListenersAttached = false;


// New function to update the Finish Project button state
// Modified updateFinishProjectButton to check lead_farmer_id
function updateFinishProjectButton() {
  const finishButton = document.getElementById("finishProjectButton");
  const failButton = document.getElementById("failProjectButton");
  if (!finishButton || !failButton) return;

  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
  const projectStatus = sessionStorage.getItem("selected_project_status");

  // Disable both buttons if project is already Completed or Failed
  if (projectStatus === "Completed" || projectStatus === "Failed") {
    finishButton.disabled = true;
    failButton.disabled = true;
    return;
  }

  // Enable finish button for Head Farmer or Farm President with matching lead_farmer_id
  const isLeadFarmer = String(farmerId) === String(leadFarmerId);
  if (
    (userType === "Head Farmer" || (userType === "Farm President" && isLeadFarmer)) &&
    isLeadFarmer
  ) {
    const allTasksCompleted =
      allTasks.length > 0 &&
      allTasks.every((taskObj) => taskObj.data.task_status === "Completed");
    finishButton.disabled = !allTasksCompleted;
  } else {
    finishButton.disabled = true;
  }

  // Fail button: Enable only for Farm President (regardless of lead_farmer_id)
  failButton.disabled = userType !== "Farm President";
}



// Modified attachGlobalEventListeners to include Finish Project button handler
// Modified attachGlobalEventListeners to enable addTaskButton for Farm President with matching lead_farmer_id
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
  const finishProjectButton = document.getElementById("finishProjectButton");
  const failProjectButton = document.getElementById("failProjectButton");
  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
  const isLeadFarmer = String(farmerId) === String(leadFarmerId);

  // Enable addTaskButton for Head Farmer or Farm President with matching lead_farmer_id
  if (
    userType !== "Head Farmer" &&
    !(userType === "Farm President" && isLeadFarmer)
  ) {
    addTaskButton.disabled = true;
    addTaskButton.style.opacity = "0.5";
    addTaskButton.style.cursor = "not-allowed";
    if (finishProjectButton) {
      finishProjectButton.disabled = true;
      finishProjectButton.style.opacity = "0.5";
      finishProjectButton.style.cursor = "not-allowed";
    }
  } else {
    addTaskButton.disabled = false;
    addTaskButton.style.opacity = "1";
    addTaskButton.style.cursor = "pointer";
  }

  addTaskButton.addEventListener("click", () => {
    const endDate = sessionStorage.getItem("selected_project_end_date");
    const extendDate = sessionStorage.getItem("selected_project_extend_date");
    if (endDate && isPastEndDate(endDate, extendDate)) {
      showErrorPanel(
        "Project is way past the deadline, request extension of project"
      );
      return;
    }
    addTaskModal.classList.remove("hidden");
  });

  // Finish Project button handler
  if (finishProjectButton) {
    finishProjectButton.addEventListener("click", async () => {
      const projectId = sessionStorage.getItem("selected_project_id");
      if (!projectId) {
        showErrorPanel("No project selected.");
        return;
      }

      try {
        const projectsRef = collection(db, "tb_projects");
        const q = query(
          projectsRef,
          where("project_id", "==", parseInt(projectId, 10))
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showErrorPanel("Project not found.");
          return;
        }

        const projectDoc = querySnapshot.docs[0];
        await updateDoc(projectDoc.ref, { status: "Completed" });
        sessionStorage.setItem("selected_project_status", "Completed");
        showSuccessPanel("Project marked as Completed!");
        finishProjectButton.disabled = true;
        updateFinishProjectButton(); // Update both buttons
        console.log(`Project ${projectId} status updated to Completed`);
      } catch (error) {
        console.error("❌ Error updating project status:", error);
        showErrorPanel("Failed to complete project. Try again.");
      }
    });
  }

  // Fail Project button handler
  if (failProjectButton) {
    failProjectButton.addEventListener("click", () => {
      failProjectModal.classList.remove("hidden");
    });
  }

  // Fail Modal handlers
  if (confirmFailBtn) {
    confirmFailBtn.addEventListener("click", async () => {
      const projectId = sessionStorage.getItem("selected_project_id");
      if (!projectId) {
        showErrorPanel("No project selected.");
        failProjectModal.classList.add("hidden");
        return;
      }

      try {
        const projectsRef = collection(db, "tb_projects");
        const q = query(
          projectsRef,
          where("project_id", "==", parseInt(projectId, 10))
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showErrorPanel("Project not found.");
          failProjectModal.classList.add("hidden");
          return;
        }

        const projectDoc = querySnapshot.docs[0];
        await updateDoc(projectDoc.ref, { status: "Failed" });
        sessionStorage.setItem("selected_project_status", "Failed");
        showSuccessPanel("Project marked as Failed!");
        failProjectModal.classList.add("hidden");
        updateFinishProjectButton(); // Update both buttons
        console.log(`Project ${projectId} status updated to Failed`);
      } catch (error) {
        console.error("❌ Error updating project status to Failed:", error);
        showErrorPanel("Failed to mark project as Failed. Try again.");
        failProjectModal.classList.add("hidden");
      }
    });
  }

  if (cancelFailBtn) {
    cancelFailBtn.addEventListener("click", () => {
      failProjectModal.classList.add("hidden");
    });
  }

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
  const extendDate = sessionStorage.getItem("selected_project_extend_date");
  const isPastEnd = endDate ? isPastEndDate(endDate, extendDate) : false;

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
          showErrorPanel("Task not found.");
          return;
        }
      } catch (error) {
        console.error("❌ Error checking task status:", error);
        showErrorPanel("Error checking task status. Try again.");
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




const failProjectModal = document.getElementById("failProjectModal");
const confirmFailBtn = document.getElementById("confirmFailBtn");
const cancelFailBtn = document.getElementById("cancelFailBtn");












function checkTaskNameChange() {
  const currentInput = editTaskNameInput.value.trim();
  saveEditBtn.disabled =
    currentInput.toLowerCase() === originalTaskName.toLowerCase();
}

async function saveEditHandler() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  const extendDate = sessionStorage.getItem("selected_project_extend_date");
  if (endDate && isPastEndDate(endDate, extendDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

  const newTaskNameRaw = editTaskNameInput.value.trim();
  if (!newTaskNameRaw) {
    showErrorPanel("Please enter a task name.");
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
      showErrorPanel("No project selected.");
      return;
    }

    const taskSnap = await getDocs(
      query(
        collection(db, "tb_project_task"),
        where("__name__", "==", taskToEdit)
      )
    );
    if (taskSnap.empty) {
      showErrorPanel("Task not found.");
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
    showErrorPanel("Failed to update task. Try again.");
  }
}

function cancelEditHandler() {
  editTaskNameInput.value = "";
  editTaskModal.classList.add("hidden");
  taskToEdit = null;
  originalTaskName = null;
}

// Modified saveTaskHandler to update button state
// Modified saveTaskHandler to update button state
async function saveTaskHandler() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  const extendDate = sessionStorage.getItem("selected_project_extend_date");
  if (endDate && isPastEndDate(endDate, extendDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

  const taskName = taskNameInput.value.trim();

  if (!taskName) {
    showErrorPanel("Please enter a task name.");
    return;
  }

  try {
    const projectId = sessionStorage.getItem("selected_project_id");
    const cropTypeName = sessionStorage.getItem("selected_crop_type");
    const cropName = sessionStorage.getItem("selected_crop_name");

    if (!projectId || !cropTypeName || !cropName) {
      showErrorPanel("Missing project or crop details.");
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
    updateFinishProjectButton(); // Update button state after adding task
  } catch (error) {
    console.error("❌ Error adding task:", error);
    showErrorPanel("Failed to add task. Try again.");
  }
}



// Modified deleteTaskHandler to update button state
// Modified deleteTaskHandler to update button state
async function deleteTaskHandler() {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  const extendDate = sessionStorage.getItem("selected_project_extend_date");
  if (endDate && isPastEndDate(endDate, extendDate)) {
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
      showErrorPanel("Task not found.");
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
    if (allTasks.length === 0) {
      displayNoTasksMessage();
    } else {
      renderTasks();
    }
    updateFinishProjectButton(); // Update button state after deletion
  } catch (error) {
    console.error("❌ Error deleting task and related records:", error);
    showErrorPanel("Failed to delete task. Try again.");
  }

  deleteTaskModal.classList.add("hidden");
  taskToDelete = null;
} 

// Back button logic
async function configureBackButton() {
  const backContainer = document.querySelector(".back"); // Target the parent container
  const backLink = document.querySelector(".back-link"); // For event listener
  if (!backContainer || !backLink) {
    console.warn("Back container or link not found in the DOM.");
    return;
  }

  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const projectId = sessionStorage.getItem("selected_project_id");

  console.log("userType:", userType);
  console.log("farmerId:", farmerId);
  console.log("projectId:", projectId);

  if (!projectId) {
    console.error("No project_id found in sessionStorage.");
    backContainer.style.display = "none"; // Hide if no project ID
    return;
  }

  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(
      projectsRef,
      where("project_id", "==", parseInt(projectId, 10))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("Project not found in tb_projects.");
      backContainer.style.display = "none"; // Hide if project not found
      return;
    }

    const projectData = querySnapshot.docs[0].data();
    const leadFarmerId = projectData.lead_farmer_id;

    console.log("leadFarmerId:", leadFarmerId);

    const isLeadFarmer = farmerId && String(leadFarmerId) === String(farmerId);
    console.log("isLeadFarmer:", isLeadFarmer);

    // Define user types and their respective redirect paths
    const navigationPaths = {
      Admin: "../../../../public/landing_pages/admin/viewproject.html",
      Supervisor: "../../../../public/landing_pages/admin/viewproject.html",
      "Farm President":
        "../../../public/landing_pages/farm_president/viewproject.html",
    };

    const canNavigateBack = Object.keys(navigationPaths).includes(userType);
    console.log("canNavigateBack:", canNavigateBack);

    if (isLeadFarmer && userType === "Head Farmer") {
      // Hide back button only for Head Farmers who are lead farmers
      backContainer.style.display = "none";
      backContainer.classList.remove("visible");
      console.log("Back button hidden: Head Farmer is lead farmer.");
    } else if (canNavigateBack) {
      // Show back button and enable navigation for Admin, Supervisor, and Farm President
      backContainer.style.display = "block";
      backContainer.classList.add("visible");
      console.log("Back button visible: User is allowed to navigate back.");

      backLink.addEventListener("click", (event) => {
        event.preventDefault();
        sessionStorage.setItem("selectedProjectId", projectId); // Consistent key
        const redirectPath = navigationPaths[userType];
        window.location.href = redirectPath;
        console.log(`Navigating to ${redirectPath}`);
      });
    } else {
      // For other users (e.g., regular Farmers), hide or use default behavior
      backContainer.style.display = "none";
      backContainer.classList.remove("visible");
      console.log(
        "Back button hidden: User type not allowed to navigate back."
      );
    }
  } catch (error) {
    console.error("Error fetching project data for back button:", error);
    backContainer.style.display = "none";
    backContainer.classList.remove("visible");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchProjectsForFarmer();
  configureBackButton();
});