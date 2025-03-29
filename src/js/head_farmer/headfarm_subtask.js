import {
  collection,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

// Debounce control
let isFetching = false;
let fetchTimeout = null;

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
        tbody.innerHTML = `<tr><td colspan="3">No subtasks found.</td></tr>`;
        return false;
      }

      let allCompleted = true;
      const sessionedSubtaskName = sessionStorage.getItem("subtask_name");
      const sessionedSubtaskStatus =
        sessionStorage.getItem("subtask_status") || "Pending";

      // Update the specific subtask status in Firestore
      let subtaskUpdated = false;
      subtasks = subtasks.map((subtask) => {
        if (
          sessionedSubtaskName &&
          subtask.subtask_name === sessionedSubtaskName
        ) {
          if (subtask.status !== sessionedSubtaskStatus) {
            subtaskUpdated = true;
            return { ...subtask, status: sessionedSubtaskStatus };
          }
        }
        return subtask;
      });

      if (subtaskUpdated) {
        await updateDoc(taskDocRef, { subtasks });
        console.log(
          `✅ Updated status to ${sessionedSubtaskStatus} for subtask: ${sessionedSubtaskName} from ${source}`
        );
      }

      // Render the table
      subtasks.forEach((subtask, index) => {
        const status = subtask.status || "Pending";
        if (status !== "Completed") allCompleted = false;
        const isPending = status === "Pending";

        const safeSubtaskName = subtask.subtask_name
          ? subtask.subtask_name.replace(/"/g, "")
          : "Unnamed Subtask";
        const row = `
            <tr>
              <td>${safeSubtaskName}</td>
              <td>
                <select class="status-dropdown" data-index="${index}">
                  <option value="Pending" ${
                    status === "Pending" ? "selected" : ""
                  }>Pending</option>
                  <option value="Ongoing" ${
                    status === "Ongoing" ? "selected" : ""
                  }>Ongoing</option>
                  <option value="Completed" ${
                    status === "Completed" ? "selected" : ""
                  } ${isPending ? "disabled" : ""}>Completed</option>
                </select>
              </td>
              <td class="action-icons">
                <img src="../../images/eye.png" alt="View" class="w-4 h-4 view-icon" data-index="${index}" data-subtask-name="${safeSubtaskName}">
                <img src="../../images/Delete.png" alt="Delete" class="w-4 h-4 delete-icon" data-index="${index}">
              </td>
            </tr>
          `;
        tbody.insertAdjacentHTML("beforeend", row);
        console.log(
          `Rendered row for subtask: ${safeSubtaskName} from ${source}`
        );
      });

      // Attach event listeners after rendering
      attachEventListeners(projectTaskId);
      return allCompleted;
    } else {
      console.log(
        `No task found with project_task_id: ${projectTaskId} from ${source}`
      );
      const tbody = document.querySelector(".subtask-table tbody");
      tbody.innerHTML = `<tr><td colspan="3">Task not found.</td></tr>`;
    }
  } catch (error) {
    console.error(`❌ Error fetching subtasks from ${source}:`, error);
    const tbody = document.querySelector(".subtask-table tbody");
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="3">Error loading subtasks.</td></tr>`;
  } finally {
    isFetching = false;
    console.log(`Fetch completed from ${source}`);
  }
  return false;
}

// Function to attach event listeners to table elements
function attachEventListeners(projectTaskId) {
  console.log("Attaching event listeners for projectTaskId:", projectTaskId);

  // Status dropdown listeners
  document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
    dropdown.removeEventListener("change", handleStatusChange);
    dropdown.removeEventListener("click", handleDropdownClick);

    dropdown.addEventListener("change", handleStatusChange);
    dropdown.addEventListener("click", handleDropdownClick);
  });

  // Delete confirmation handling
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

  // Eye icon redirection
  document.querySelectorAll(".view-icon").forEach((icon) => {
    icon.removeEventListener("click", handleViewClick);
    icon.addEventListener("click", handleViewClick);
  });

  function handleStatusChange(event) {
    const index = event.target.dataset.index;
    const newStatus = event.target.value;
    console.log(`Status change triggered for index ${index} to ${newStatus}`);
    updateSubtaskStatus(projectTaskId, index, newStatus);
  }

  function handleDropdownClick(event) {
    const currentStatus = event.target.value;
    const completedOption = event.target.querySelector(
      'option[value="Completed"]'
    );
    completedOption.disabled = currentStatus === "Pending";
  }

  function handleDeleteClick(event) {
    subtaskIndexToDelete = event.target.dataset.index;
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

// Function to update subtask status in Firestore
async function updateSubtaskStatus(projectTaskId, subtaskIndex, newStatus) {
  try {
    console.log(`Updating status for index ${subtaskIndex} to ${newStatus}`);
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskDoc = querySnapshot.docs[0];
      const taskDocRef = taskDoc.ref;
      const subtasks = taskDoc.data().subtasks || [];

      if (subtasks[subtaskIndex]) {
        subtasks[subtaskIndex].status = newStatus;

        if (newStatus === "Ongoing" && !subtasks[subtaskIndex].start_date) {
          subtasks[subtaskIndex].start_date = new Date().toISOString();
          subtasks[subtaskIndex].end_date = null;
        } else if (newStatus === "Pending") {
          subtasks[subtaskIndex].start_date = null;
          subtasks[subtaskIndex].end_date = null;
        } else if (
          newStatus === "Completed" &&
          subtasks[subtaskIndex].start_date
        ) {
          subtasks[subtaskIndex].end_date = new Date().toISOString();
        }

        await updateDoc(taskDocRef, { subtasks });
        console.log(`✅ Status updated to ${newStatus}`);

        const subtaskName = subtasks[subtaskIndex].subtask_name;
        if (subtaskName === sessionStorage.getItem("subtask_name")) {
          sessionStorage.setItem("subtask_status", newStatus);
        }

        await fetchSubtasks(projectTaskId, "updateSubtaskStatus");
      }
    }
  } catch (error) {
    console.error("❌ Error updating subtask status:", error);
  }
}

// Function to delete subtask from Firestore
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
      const subtasks = taskDoc.data().subtasks || [];

      const deletedSubtaskName = subtasks[subtaskIndex].subtask_name;
      subtasks.splice(subtaskIndex, 1);
      await updateDoc(taskDocRef, { subtasks });
      console.log("✅ Subtask deleted");

      if (deletedSubtaskName === sessionStorage.getItem("subtask_name")) {
        sessionStorage.removeItem("subtask_status");
      }

      await fetchSubtasks(projectTaskId, "deleteSubtask");
    }
  } catch (error) {
    console.error("❌ Error deleting subtask:", error);
  }
}

// Function to add new subtask
async function addSubtask(projectTaskId, newSubtasks) {
  try {
    console.log("Adding new subtask:", newSubtasks);
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

      const formattedSubtasks = newSubtasks.map((subtask) => ({
        ...subtask,
        status: "Pending",
        start_date: null,
        end_date: null,
      }));

      const updatedSubtasks = [...existingSubtasks, ...formattedSubtasks];
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks });
      console.log("✅ Subtasks added with status: Pending");

      await fetchSubtasks(projectTaskId, "addSubtask");
    }
  } catch (error) {
    console.error("❌ Error adding subtasks:", error);
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
    const subtasks = querySnapshot.docs[0].data().subtasks || [];
    const allCompleted = subtasks.every(
      (subtask) => subtask.status === "Completed"
    );

    completeBtn.disabled = !allCompleted || subtasks.length === 0;
    completeBtn.style.opacity =
      allCompleted && subtasks.length > 0 ? "1" : "0.5";
    completeBtn.style.cursor =
      allCompleted && subtasks.length > 0 ? "pointer" : "not-allowed";
  }
}

// Function to initialize the subtask page
export function initializeSubtaskPage() {
  // Remove any existing listener to prevent duplicates
  document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
  document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

  async function handleDOMContentLoaded() {
    const taskName = sessionStorage.getItem("selected_task_name") || "Planting";
    document.getElementById("taskName").textContent = taskName;

    const projectTaskId = sessionStorage.getItem("project_task_id");
    if (projectTaskId) {
      console.log(`Initializing page with Project Task ID: ${projectTaskId}`);

      // Fetch subtasks only once on initialization
      await fetchSubtasks(projectTaskId, "initializeSubtaskPage");
      await updateCompleteButtonState(projectTaskId);

      const backBtn = document.querySelector(".back-btn");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          window.location.href = "headfarm_task.html";
        });
      }

      const completeBtn = document.getElementById("completeTaskBtn");
      if (completeBtn) {
        completeBtn.onclick = () => {
          if (!completeBtn.disabled) {
            console.log("All subtasks are completed!");
          }
        };
      }

      const modal = document.getElementById("subtaskModal");
      const addSubtaskBtn = document.querySelector(".add-subtask");
      const closeModal = document.querySelector(".close-modal");
      const subtaskForm = document.getElementById("subtaskForm");

      addSubtaskBtn.addEventListener("click", (e) => {
        e.preventDefault();
        modal.style.display = "flex";
      });

      closeModal.addEventListener("click", () => {
        modal.style.display = "none";
        subtaskForm.reset();
      });

      window.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
          subtaskForm.reset();
        }
      });

      subtaskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const subtaskName = document.getElementById("subtaskName").value.trim();
        if (subtaskName) {
          await addSubtask(projectTaskId, [{ subtask_name: subtaskName }]);
          modal.style.display = "none";
          subtaskForm.reset();
          await updateCompleteButtonState(projectTaskId);
        }
      });
    } else {
      console.log("No project_task_id found in sessionStorage.");
      document.querySelector(".subtask-table tbody").innerHTML = `
          <tr><td colspan="3">No task selected.</td></tr>
        `;
    }
  }
}

initializeSubtaskPage();
