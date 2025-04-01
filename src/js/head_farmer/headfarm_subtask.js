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

// Debounce control for fetching
let isFetching = false;
// Debounce control for form submission
let isSubmitting = false;
// Debounce control for add subtask button
let isAddingSubtask = false;

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
      tbody.innerHTML = ""; // Clear table before rendering
      console.log(
        `Table cleared by ${source}, rendering ${subtasks.length} subtasks`
      );

      if (subtasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No subtasks found.</td></tr>`;
        return false;
      }

      let allCompleted = true;

      subtasks.forEach((subtask, index) => {
        const status = subtask.status || "Pending";
        const startDate = subtask.start_date || "-";
        const endDate = subtask.end_date || "-";
        if (status !== "Completed") allCompleted = false;

        const safeSubtaskName = subtask.subtask_name
          ? subtask.subtask_name.replace(/"/g, "")
          : "Unnamed Subtask";
        const row = `
          <tr>
            <td>${safeSubtaskName}</td>
            <td class="status-cell">${status}</td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td class="action-icons">
              <img src="../../images/eye.png" alt="View" class="w-4 h-4 view-icon" data-index="${index}" data-subtask-name="${safeSubtaskName}">
              <img src="../../images/Delete.png" alt="Delete" class="w-4 h-4 delete-icon" data-index="${index}">
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

  const deleteModal = document.getElementById("deleteConfirmModal");
  const closeDeleteModal = document.querySelector(".close-delete-modal");
  const cancelBtn = document.querySelector(".cancel-btn");
  const confirmDeleteBtn = document.querySelector(".confirm-delete-btn");
  let subtaskIndexToDelete = null;

  document.querySelectorAll(".delete-icon").forEach((icon) => {
    icon.removeEventListener("click", handleDeleteClick);
    icon.addEventListener("click", handleDeleteClick);
  });

  closeDeleteModal.removeEventListener("click", closeModalHandler);
  closeDeleteModal.addEventListener("click", closeModalHandler);

  cancelBtn.removeEventListener("click", cancelHandler);
  cancelBtn.addEventListener("click", cancelHandler);

  window.removeEventListener("click", windowClickHandler);
  window.addEventListener("click", windowClickHandler);

  confirmDeleteBtn.removeEventListener("click", confirmDeleteHandler);
  confirmDeleteBtn.addEventListener("click", confirmDeleteHandler);

  document.querySelectorAll(".view-icon").forEach((icon) => {
    icon.removeEventListener("click", handleViewClick);
    icon.addEventListener("click", handleViewClick);
  });

  async function handleDeleteClick(event) {
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
        alert(`"${subtask.subtask_name}" is completed and cannot be deleted.`);
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
    deleteModal.style.display = "none";
    subtaskIndexToDelete = null;
  }

  function cancelHandler() {
    deleteModal.style.display = "none";
    subtaskIndexToDelete = null;
  }

  function windowClickHandler(e) {
    if (e.target === deleteModal) {
      deleteModal.style.display = "none";
      subtaskIndexToDelete = null;
    }
  }

  async function confirmDeleteHandler() {
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
    window.location.href = "headfarm_subtask_details.html";
  }
}

// Function to delete subtask and associated attendance records from Firestore
async function deleteSubtask(projectTaskId, subtaskIndex) {
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

      if (deletedSubtaskName === sessionStorage.getItem("subtask_name")) {
        sessionStorage.removeItem("subtask_status");
      }

      await fetchSubtasks(projectTaskId, "deleteSubtask");
      await updateCompleteButtonState(projectTaskId);
    }
  } catch (error) {
    console.error("❌ Error deleting subtask or attendance records:", error);
  }
}

// Function to add new subtask
async function addSubtask(projectTaskId, newSubtaskName) {
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
      await fetchSubtasks(projectTaskId, "addSubtask");
      return true;
    } catch (error) {
      console.error("❌ Failed to save subtask to Firestore:", error);
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
    const taskStatus = taskData.task_status || "Pending"; // Changed from "status" to "task_status"
    const allCompleted = subtasks.every(
      (subtask) => subtask.status === "Completed"
    );

    // Disable button if task is "Completed" or if not all subtasks are completed
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

// New function to complete the task
async function completeTask(projectTaskId) {
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

      // Check if all subtasks are completed before allowing completion
      const allCompleted = subtasks.every(
        (subtask) => subtask.status === "Completed"
      );
      if (!allCompleted || subtasks.length === 0) {
        console.log(
          `Cannot complete task ${projectTaskId}: Not all subtasks are completed or no subtasks exist`
        );
        alert("Cannot complete task: All subtasks must be completed first.");
        return;
      }

      // Update task_status to "Completed" and set end_date
      await updateDoc(taskDocRef, {
        task_status: "Completed", // Changed from "status" to "task_status"
        end_date: today,
      });
      console.log(
        `✅ Task with project_task_id ${projectTaskId} marked as Completed`
      );

      // Update button state after completion
      await updateCompleteButtonState(projectTaskId);

      // Redirect back to headfarm_task.html
      window.location.href = "headfarm_task.html";
    } else {
      console.log(`No task found with project_task_id: ${projectTaskId}`);
      alert("Task not found. Unable to mark as completed.");
    }
  } catch (error) {
    console.error("❌ Error completing task:", error);
    alert("Failed to mark task as completed. Please try again.");
  }
}

// Function to initialize the subtask page
export function initializeSubtaskPage() {
  // Define handler functions outside DOMContentLoaded
  function handleBackClick() {
    window.location.href = "headfarm_task.html";
  }

  async function handleAddSubtaskClick(e) {
    e.preventDefault();
    if (isAddingSubtask) {
      console.log("Add subtask click already in progress, skipping...");
      return;
    }
    isAddingSubtask = true;

    const projectTaskId = sessionStorage.getItem("project_task_id");
    const modal = document.getElementById("subtaskModal");

    try {
      // Check task status before showing modal
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
          alert(
            "Adding subtask is not possible since task is already completed"
          );
          return;
        }

        // If task is not completed, show the modal
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
        subtaskName.charAt(0).toUpperCase() +
        subtaskName.slice(1).toLowerCase();
      const isDuplicate = existingSubtasks.some(
        (existing) =>
          existing.subtask_name.toLowerCase() === capitalizedName.toLowerCase()
      );

      if (isDuplicate) {
        subtaskInput.value = "";
        alert(`"${capitalizedName}" is already existing.`);
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

  // Attach listeners once outside DOMContentLoaded
  const addSubtaskBtn = document.querySelector(".add-subtask");
  if (addSubtaskBtn) {
    addSubtaskBtn.removeEventListener("click", handleAddSubtaskClick);
    addSubtaskBtn.addEventListener("click", handleAddSubtaskClick);
  }

  const closeModal = document.querySelector(".close-modal");
  if (closeModal) {
    closeModal.removeEventListener("click", handleCloseModal);
    closeModal.addEventListener("click", handleCloseModal);
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
      if (completeBtn) {
        completeBtn.onclick = null;
        completeBtn.onclick = async () => {
          if (!completeBtn.disabled) {
            console.log(
              "All subtasks are completed! Marking task as Completed..."
            );
            await completeTask(projectTaskId);
          }
        };
      }
    } else {
      console.log("No project_task_id found in sessionStorage.");
      document.querySelector(".subtask-table tbody").innerHTML = `
        <tr><td colspan="5">No task selected.</td></tr>
      `;
    }
  }
}

initializeSubtaskPage();
