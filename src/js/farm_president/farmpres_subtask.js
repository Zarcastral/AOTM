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
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

// Debounce controls
let isFetching = false;
let isSubmitting = false;
let isAddingSubtask = false;

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

// Utility function to check if current date is past end_date
function isPastEndDate(endDate) {
  const currentDate = new Date();
  const projectEndDate = new Date(endDate);
  return currentDate > projectEndDate;
}

// Function to fetch subtasks and populate the table
async function fetchSubtasks(projectTaskId, source = "unknown") {
  if (isFetching) {
    console.log(`Fetch already in progress from ${source}, skipping...`);
    return;
  }
  isFetching = true;

  try {
    console.log(
      `Starting fetchSubtasks from ${source} for projectTaskId: ${projectTaskId}`
    );
    const endDate = sessionStorage.getItem("selected_project_end_date");
    console.log(`Fetched end_date on subtask page: ${endDate}`);

    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskDoc = querySnapshot.docs[0];
      const taskDocRef = taskDoc.ref;
      let subtasks = taskDoc.data().subtasks || [];
      console.log(`Subtasks fetched from ${source}:`, subtasks);

      const tbody = document.querySelector(".subtask-table tbody");
      if (!tbody) {
        console.error("Table body not found!");
        return false;
      }
      tbody.innerHTML = "";
      console.log(
        `Table cleared by ${source}, rendering ${subtasks.length} subtasks`
      );

      if (subtasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No subtasks found.</td></tr>`;
        return false;
      }

      let allCompleted = true;

      const farmerId = sessionStorage.getItem("farmer_id");
      const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
      const isLeadFarmer = String(farmerId) === String(leadFarmerId);

      subtasks.forEach((subtask, index) => {
        const status = subtask.status || "Pending";
        const startDate = subtask.start_date || "-";
        const endDate = subtask.end_date || "-";
        if (status !== "Completed") allCompleted = false;

        const safeSubtaskName = subtask.subtask_name
          ? subtask.subtask_name.replace(/"/g, "")
          : "Unnamed Subtask";

        let deleteButton = "";
        if (isLeadFarmer) {
          deleteButton = `<img src="/images/Delete.png" alt="Delete" class="w-4 h-4 delete-icon" data-index="${index}">`;
        }

        const row = `
          <tr>
            <td>${safeSubtaskName}</td>
            <td class="status-cell">${status}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td class="action-icons">
              <img src="/images/eye.png" alt="View" class="w-4 h-4 view-icon" data-index="${index}" data-subtask-name="${safeSubtaskName}">
              ${deleteButton}
            </td>
          </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
        console.log(
          `Rendered row for subtask: ${safeSubtaskName} with status: ${status}, start_date: ${startDate}, end_date: ${endDate} from ${source}`
        );
      });

      attachEventListeners(projectTaskId);
      return allCompleted;
    } else {
      console.log(
        `No task found with project_task_id: ${projectTaskId} from ${source}`
      );
      const tbody = document.querySelector(".subtask-table tbody");
      tbody.innerHTML = `<tr><td colspan="5">Task not found.</td></tr>`;
    }
  } catch (error) {
    console.error(`❌ Error fetching subtasks from ${source}:`, error);
    const tbody = document.querySelector(".subtask-table tbody");
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="5">Error loading subtasks.</td></tr>`;
  } finally {
    isFetching = false;
    console.log(`Fetch completed from ${source}`);
  }
  return false;
}

// Function to attach event listeners to table elements
function attachEventListeners(projectTaskId) {
  console.log("Attaching event listeners for projectTaskId:", projectTaskId);
  const endDate = sessionStorage.getItem("selected_project_end_date");
  const isPastEnd = endDate ? isPastEndDate(endDate) : false;

  const deleteModal = document.getElementById("deleteConfirmModal");
  const closeDeleteModal = document.querySelector(".close-delete-modal");
  const cancelBtn = document.querySelector("#deleteConfirmModal .cancel-btn");
  const confirmDeleteBtn = document.querySelector(".confirm-delete-btn");
  let subtaskIndexToDelete = null;

  // Verify elements exist before attaching listeners
  if (!deleteModal) {
    console.error("Delete modal not found with ID: deleteConfirmModal");
    return;
  }
  if (!closeDeleteModal) {
    console.error(
      "Close modal button not found with class: close-delete-modal"
    );
  }
  if (!cancelBtn) {
    console.error(
      "Cancel button not found with selector: #deleteConfirmModal .cancel-btn"
    );
  }
  if (!confirmDeleteBtn) {
    console.error(
      "Confirm delete button not found with class: confirm-delete-btn"
    );
  }

  document.querySelectorAll(".delete-icon").forEach((icon) => {
    icon.removeEventListener("click", handleDeleteClick);
    icon.addEventListener("click", handleDeleteClick);
  });

  if (closeDeleteModal) {
    closeDeleteModal.removeEventListener("click", closeModalHandler);
    closeDeleteModal.addEventListener("click", closeModalHandler);
  }

  if (cancelBtn) {
    cancelBtn.removeEventListener("click", cancelHandler);
    cancelBtn.addEventListener("click", cancelHandler);
  } else {
    console.warn("Cancel button not found; cancel functionality may not work");
  }

  // Remove and re-add window click handler only once
  window.removeEventListener("click", windowClickHandler);
  window.addEventListener("click", windowClickHandler);

  if (confirmDeleteBtn) {
    confirmDeleteBtn.removeEventListener("click", confirmDeleteHandler);
    confirmDeleteBtn.addEventListener("click", confirmDeleteHandler);
  }

  document.querySelectorAll(".view-icon").forEach((icon) => {
    icon.removeEventListener("click", handleViewClick);
    icon.addEventListener("click", handleViewClick);
  });

  async function handleDeleteClick(event) {
    if (isPastEnd) {
      showErrorPanel(
        "Project is way past the deadline, request extension of project"
      );
      return;
    }
    subtaskIndexToDelete = event.target.dataset.index;
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const subtasks = querySnapshot.docs[0].data().subtasks || [];
      const subtask = subtasks[subtaskIndexToDelete];
      if (subtask.status === "Completed") {
        showErrorPanel(
          `"${subtask.subtask_name}" is completed and cannot be deleted.`
        );
        console.log(
          `Attempted to delete completed subtask: ${subtask.subtask_name}`
        );
        subtaskIndexToDelete = null;
        return;
      }
    }
    deleteModal.style.display = "flex";
  }

  function closeModalHandler() {
    console.log("Close modal button clicked");
    deleteModal.style.display = "none";
    subtaskIndexToDelete = null;
  }

  function cancelHandler() {
    console.log("Delete modal cancel button clicked");
    deleteModal.style.display = "none";
    subtaskIndexToDelete = null;
  }

  function windowClickHandler(e) {
    if (e.target === deleteModal) {
      console.log("Clicked outside modal to close");
      deleteModal.style.display = "none";
      subtaskIndexToDelete = null;
    }
  }

  async function confirmDeleteHandler() {
    console.log("Confirm delete button clicked");
    if (isPastEnd) {
      showErrorPanel(
        "Project is way past the deadline, request extension of project"
      );
      deleteModal.style.display = "none";
      return;
    }
    if (subtaskIndexToDelete !== null) {
      await deleteSubtask(projectTaskId, subtaskIndexToDelete);
      deleteModal.style.display = "none";
      subtaskIndexToDelete = null;
    }
  }

  function handleViewClick(event) {
    const index = event.target.dataset.index;
    const subtaskName = event.target.dataset.subtaskName;
    console.log("Storing in sessionStorage:", {
      index,
      subtaskName,
      projectTaskId,
    });
    sessionStorage.setItem("subtask_index", index);
    sessionStorage.setItem("project_task_id", projectTaskId);
    sessionStorage.setItem("subtask_name", subtaskName);
    window.location.href = "farmpres_subtask_details.html";
  }
}

// Function to delete subtask and associated attendance records from Firestore
async function deleteSubtask(projectTaskId, subtaskIndex) {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

  try {
    console.log(`Deleting subtask at index ${subtaskIndex}`);
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskDoc = querySnapshot.docs[0];
      const taskDocRef = taskDoc.ref;
      const taskId = taskDoc.id;
      const subtasks = taskDoc.data().subtasks || [];

      const subtask = subtasks[subtaskIndex];
      const deletedSubtaskName = subtask.subtask_name;

      if (subtask.status === "Completed") {
        console.log(
          `Subtask "${deletedSubtaskName}" is completed and cannot be deleted.`
        );
        return;
      }

      const attendanceRef = collection(
        db,
        "tb_project_task",
        taskId,
        "Attendance"
      );
      const attendanceQuery = query(
        attendanceRef,
        where("subtask_name", "==", deletedSubtaskName)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      if (!attendanceSnapshot.empty) {
        for (const docSnap of attendanceSnapshot.docs) {
          await deleteDoc(
            doc(db, "tb_project_task", taskId, "Attendance", docSnap.id)
          );
          console.log(
            `Deleted attendance record with ID: ${docSnap.id} for subtask: ${deletedSubtaskName} from Attendance subcollection`
          );
        }
      } else {
        console.log(
          `No attendance records found in subcollection for subtask: ${deletedSubtaskName}`
        );
      }

      const tbAttendanceRef = collection(db, "tb_attendance");
      const tbAttendanceQuery = query(
        tbAttendanceRef,
        where("project_task_id", "==", Number(projectTaskId)),
        where("subtask_name", "==", deletedSubtaskName)
      );
      const tbAttendanceSnapshot = await getDocs(tbAttendanceQuery);

      if (!tbAttendanceSnapshot.empty) {
        for (const docSnap of tbAttendanceSnapshot.docs) {
          await deleteDoc(doc(db, "tb_attendance", docSnap.id));
          console.log(
            `Deleted attendance record with ID: ${docSnap.id} for subtask: ${deletedSubtaskName} from tb_attendance`
          );
        }
      } else {
        console.log(
          `No attendance records found in tb_attendance for subtask: ${deletedSubtaskName}`
        );
      }

      subtasks.splice(subtaskIndex, 1);
      await updateDoc(taskDocRef, { subtasks });
      console.log(
        `✅ Subtask ${deletedSubtaskName} deleted from tb_project_task`
      );
      showSuccessPanel("Subtask deleted successfully!");

      if (deletedSubtaskName === sessionStorage.getItem("subtask_name")) {
        sessionStorage.removeItem("subtask_status");
      }

      await fetchSubtasks(projectTaskId, "deleteSubtask");
      await updateCompleteButtonState(projectTaskId);
    }
  } catch (error) {
    console.error("❌ Error deleting subtask or attendance records:", error);
    showErrorPanel("Failed to delete subtask. Please try again.");
  }
}

// Function to add new subtask
async function addSubtask(projectTaskId, newSubtaskName) {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return false;
  }

  console.log("Starting addSubtask with:", newSubtaskName);

  const tasksRef = collection(db, "tb_project_task");
  const q = query(
    tasksRef,
    where("project_task_id", "==", Number(projectTaskId))
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const taskDoc = querySnapshot.docs[0];
    const taskDocRef = taskDoc.ref;
    const existingSubtasks = taskDoc.data().subtasks || [];
    console.log("Existing subtasks:", existingSubtasks);

    const newSubtask = {
      subtask_name: newSubtaskName,
      status: "Pending",
      start_date: null,
      end_date: null,
    };
    console.log("New subtask to save:", newSubtask);

    const updatedSubtasks = [...existingSubtasks, newSubtask];
    try {
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks });
      console.log("✅ Subtask saved successfully:", newSubtask);
      showSuccessPanel("Subtask added successfully!");
      await fetchSubtasks(projectTaskId, "addSubtask");
      return true;
    } catch (error) {
      console.error("❌ Failed to save subtask to Firestore:", error);
      showErrorPanel("Failed to add subtask. Please try again.");
      return false;
    }
  } else {
    console.log("No task document found for projectTaskId:", projectTaskId);
    return false;
  }
}

// Function to update the complete button state
async function updateCompleteButtonState(projectTaskId) {
  const completeBtn = document.getElementById("completeTaskBtn");
  if (!completeBtn) return;

  const tasksRef = collection(db, "tb_project_task");
  const q = query(
    tasksRef,
    where("project_task_id", "==", Number(projectTaskId))
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const taskData = querySnapshot.docs[0].data();
    const subtasks = taskData.subtasks || [];
    const taskStatus = taskData.task_status || "Pending";
    const allCompleted = subtasks.every(
      (subtask) => subtask.status === "Completed"
    );

    const isDisabled =
      taskStatus === "Completed" || !allCompleted || subtasks.length === 0;
    completeBtn.disabled = isDisabled;
    completeBtn.classList.toggle("disabled", isDisabled);
    completeBtn.style.cursor = isDisabled ? "not-allowed" : "pointer";
    console.log(
      `Button state updated: disabled=${isDisabled}, taskStatus=${taskStatus}, subtasks=${subtasks.length}, allCompleted=${allCompleted}`
    );
  }
}

// Function to complete the task
async function completeTask(projectTaskId) {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

  try {
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskDoc = querySnapshot.docs[0];
      const taskDocRef = taskDoc.ref;
      const taskData = taskDoc.data();
      const subtasks = taskData.subtasks || [];
      const today = new Date().toISOString().split("T")[0];

      const allCompleted = subtasks.every(
        (subtask) => subtask.status === "Completed"
      );
      if (!allCompleted || subtasks.length === 0) {
        console.log(
          `Cannot complete task ${projectTaskId}: Not all subtasks are completed or no subtasks exist`
        );
        showErrorPanel(
          "Cannot complete task: All subtasks must be completed first."
        );
        return;
      }

      await updateDoc(taskDocRef, {
        task_status: "Completed",
        end_date: today,
      });
      console.log(
        `✅ Task with project_task_id ${projectTaskId} marked as Completed`
      );
      showSuccessPanel("Task marked as completed successfully!");

      await updateCompleteButtonState(projectTaskId);

      window.location.href = "farmpres_task.html";
    } else {
      console.log(`No task found with project_task_id: ${projectTaskId}`);
      showErrorPanel("Task not found. Unable to mark as completed.");
    }
  } catch (error) {
    console.error("❌ Error completing task:", error);
    showErrorPanel("Failed to mark task as completed. Please try again.");
  }
}

// Define handler functions outside to avoid redefinition
function handleBackClick() {
  window.location.href = "farmpres_task.html";
}

async function handleAddSubtaskClick(e) {
  e.preventDefault();
  if (isAddingSubtask) {
    console.log("Add subtask click already in progress, skipping...");
    return;
  }
  isAddingSubtask = true;
  console.log("Add Subtask button clicked");

  const projectTaskId = sessionStorage.getItem("project_task_id");
  const modal = document.getElementById("subtaskModal");
  const endDate = sessionStorage.getItem("selected_project_end_date");

  try {
    if (endDate && isPastEndDate(endDate)) {
      showErrorPanel(
        "Project is way past the deadline, request extension of project"
      );
      return;
    }

    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskData = querySnapshot.docs[0].data();
      const taskStatus = taskData.task_status || "Pending";

      if (taskStatus === "Completed") {
        console.log(
          `Cannot add subtask: Task ${projectTaskId} is already completed`
        );
        showErrorPanel(
          "Adding subtask is not possible since task is already completed"
        );
        return;
      }

      modal.style.display = "flex";
    }
  } finally {
    isAddingSubtask = false;
  }
}

function handleCloseModal() {
  const modal = document.getElementById("subtaskModal");
  const subtaskForm = document.getElementById("subtaskForm");
  modal.style.display = "none";
  subtaskForm.reset();
}

function handleCancelModal() {
  const modal = document.getElementById("subtaskModal");
  const subtaskForm = document.getElementById("subtaskForm");
  modal.style.display = "none";
  subtaskForm.reset();
}

function handleWindowClick(e) {
  const modal = document.getElementById("subtaskModal");
  const subtaskForm = document.getElementById("subtaskForm");
  if (e.target === modal) {
    modal.style.display = "none";
    subtaskForm.reset();
  }
}

async function handleSubtaskSubmit(e) {
  e.preventDefault();
  if (isSubmitting) {
    console.log("Submission already in progress, skipping...");
    return;
  }
  isSubmitting = true;

  const addSubtaskBtn = document.querySelector(".submit-btn");
  const subtaskInput = document.getElementById("subtaskName");
  const modal = document.getElementById("subtaskModal");
  const subtaskForm = document.getElementById("subtaskForm");
  const projectTaskId = sessionStorage.getItem("project_task_id");

  if (!addSubtaskBtn) {
    console.error("Add Subtask button not found!");
    isSubmitting = false;
    return;
  }

  addSubtaskBtn.disabled = true;
  console.log("Add Subtask button disabled");

  const subtaskName = subtaskInput.value.trim();
  console.log("Form submitted with subtask name:", subtaskName);

  if (!subtaskName) {
    console.log("No subtask name provided, submission ignored");
    addSubtaskBtn.disabled = false;
    isSubmitting = false;
    return;
  }

  const tasksRef = collection(db, "tb_project_task");
  const q = query(
    tasksRef,
    where("project_task_id", "==", Number(projectTaskId))
  );
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const existingSubtasks = querySnapshot.docs[0].data().subtasks || [];
    const capitalizedName =
      subtaskName.charAt(0).toUpperCase() + subtaskName.slice(1).toLowerCase();
    const isDuplicate = existingSubtasks.some(
      (existing) =>
        existing.subtask_name.toLowerCase() === capitalizedName.toLowerCase()
    );

    if (isDuplicate) {
      subtaskInput.value = "";
      showErrorPanel(`"${capitalizedName}" is already existing.`);
      console.log(`Duplicate found: "${capitalizedName}" - stopping`);
      addSubtaskBtn.disabled = false;
      isSubmitting = false;
      return;
    }

    const success = await addSubtask(projectTaskId, capitalizedName);
    console.log("AddSubtask result:", success);
    if (success) {
      console.log("Closing modal and resetting form");
      modal.style.display = "none";
      subtaskForm.reset();
      await updateCompleteButtonState(projectTaskId);
    } else {
      console.log("Modal remains open due to error");
    }
  } else {
    console.log("No task document found for projectTaskId:", projectTaskId);
  }

  addSubtaskBtn.disabled = false;
  console.log("Add Subtask button re-enabled");
  isSubmitting = false;
}

// Function to initialize the subtask page
export function initializeSubtaskPage() {
  async function handleDOMContentLoaded() {
    const taskName = sessionStorage.getItem("selected_task_name") || "Planting";
    document.getElementById("taskName").textContent = taskName;

    const projectTaskId = sessionStorage.getItem("project_task_id");
    if (projectTaskId) {
      console.log(`Initializing page with Project Task ID: ${projectTaskId}`);

      await fetchSubtasks(projectTaskId, "initializeSubtaskPage");
      await updateCompleteButtonState(projectTaskId);

      const backBtn = document.querySelector(".back-btn");
      if (backBtn) {
        backBtn.removeEventListener("click", handleBackClick);
        backBtn.addEventListener("click", handleBackClick);
      }

      const completeBtn = document.getElementById("completeTaskBtn");
      const farmerId = sessionStorage.getItem("farmer_id");
      const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
      const isLeadFarmer = String(farmerId) === String(leadFarmerId);

      if (completeBtn) {
        // Only enable for lead farmers, but retain completion logic
        if (!isLeadFarmer) {
          completeBtn.disabled = true;
          completeBtn.classList.add("disabled");
          completeBtn.style.cursor = "not-allowed";
        }

        completeBtn.onclick = null;
        completeBtn.onclick = async () => {
          // Only allow click if not disabled and user is lead farmer
          if (!completeBtn.disabled && isLeadFarmer) {
            showSuccessPanel(
              "All subtasks are completed! Marking task as Completed..."
            );
            console.log(
              "All subtasks are completed! Marking task as Completed..."
            );
            await completeTask(projectTaskId);
          }
        };
      }
      if (!projectTaskId) {
        console.log("No project_task_id found in sessionStorage.");
        document.querySelector(".subtask-table tbody").innerHTML = `
          <tr><td colspan="5">No task selected.</td></tr>
        `;
      }
    }
  }

  const addSubtaskBtn = document.querySelector(".add-subtask");
  const farmerId = sessionStorage.getItem("farmer_id");
  const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
  const isLeadFarmer = String(farmerId) === String(leadFarmerId);

  if (addSubtaskBtn) {
    if (!isLeadFarmer) {
      addSubtaskBtn.disabled = true;
      addSubtaskBtn.style.opacity = "0.5";
      addSubtaskBtn.style.cursor = "not-allowed";
    } else {
      addSubtaskBtn.disabled = false;
      addSubtaskBtn.style.opacity = "1";
      addSubtaskBtn.style.cursor = "pointer";
      addSubtaskBtn.removeEventListener("click", handleAddSubtaskClick);
      addSubtaskBtn.addEventListener("click", handleAddSubtaskClick);
      console.log("Add Subtask event listener attached");
    }
  }

  const closeModal = document.querySelector(".close-modal");
  if (closeModal) {
    closeModal.removeEventListener("click", handleCloseModal);
    closeModal.addEventListener("click", handleCloseModal);
  }

  const cancelModalBtn = document.querySelector(".modal-cancel-btn");
  if (cancelModalBtn) {
    cancelModalBtn.removeEventListener("click", handleCancelModal);
    cancelModalBtn.addEventListener("click", handleCancelModal);
  }

  window.removeEventListener("click", handleWindowClick);
  window.addEventListener("click", handleWindowClick);

  const subtaskForm = document.getElementById("subtaskForm");
  if (subtaskForm) {
    subtaskForm.removeEventListener("submit", handleSubtaskSubmit);
    subtaskForm.addEventListener("submit", handleSubtaskSubmit);
  }

  document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
  document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);
}

// Call initialization once
initializeSubtaskPage();
