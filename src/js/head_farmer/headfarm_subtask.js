// Import Firebase Firestore functions
import {
  collection,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js"; // Same path as headfarm_task.js

// Initialize Firestore
const db = getFirestore(app);

// Function to fetch subtasks and populate the table
async function fetchSubtasks(projectTaskId) {
  try {
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const taskDoc = querySnapshot.docs[0];
      const subtasks = taskDoc.data().subtasks || [];
      console.log("Subtasks:", subtasks);

      const tbody = document.querySelector(".subtask-table tbody");
      tbody.innerHTML = "";

      if (subtasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">No subtasks found.</td></tr>`;
      } else {
        let allCompleted = true;

        subtasks.forEach((subtask, index) => {
          const status = subtask.status || "Pending";
          if (status !== "Completed") allCompleted = false;
          const isPending = status === "Pending";
          
          const row = `
            <tr>
              <td>${subtask.subtask_name || "Unnamed Subtask"}</td>
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
                <img src="../../images/eye.png" alt="View" class="w-4 h-4">
                <img src="../../images/Delete.png" alt="Delete" class="w-4 h-4 delete-icon" data-index="${index}">
              </td>
            </tr>
          `;
          tbody.insertAdjacentHTML("beforeend", row);
        });

        // Status dropdown listeners
        document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
          dropdown.addEventListener("change", async (event) => {
            const index = event.target.dataset.index;
            const newStatus = event.target.value;
            await updateSubtaskStatus(projectTaskId, index, newStatus);
          });

          dropdown.addEventListener("click", (event) => {
            const currentStatus = event.target.value;
            const completedOption = event.target.querySelector('option[value="Completed"]');
            if (currentStatus === "Pending") {
              completedOption.disabled = true;
            } else {
              completedOption.disabled = false;
            }
          });
        });

        // Delete confirmation handling (unchanged)
        const deleteModal = document.getElementById("deleteConfirmModal");
        const closeDeleteModal = document.querySelector(".close-delete-modal");
        const cancelBtn = document.querySelector(".cancel-btn");
        const confirmDeleteBtn = document.querySelector(".confirm-delete-btn");
        let subtaskIndexToDelete = null;

        document.querySelectorAll(".delete-icon").forEach((icon) => {
          icon.addEventListener("click", (event) => {
            subtaskIndexToDelete = event.target.dataset.index;
            deleteModal.style.display = "flex";
          });
        });

        closeDeleteModal.addEventListener("click", () => {
          deleteModal.style.display = "none";
          subtaskIndexToDelete = null;
        });

        cancelBtn.addEventListener("click", () => {
          deleteModal.style.display = "none";
          subtaskIndexToDelete = null;
        });

        window.addEventListener("click", (e) => {
          if (e.target === deleteModal) {
            deleteModal.style.display = "none";
            subtaskIndexToDelete = null;
          }
        });

        confirmDeleteBtn.addEventListener("click", async () => {
          if (subtaskIndexToDelete !== null) {
            await deleteSubtask(projectTaskId, subtaskIndexToDelete);
            deleteModal.style.display = "none";
            subtaskIndexToDelete = null;
          }
        });

        return allCompleted; // Return status for button handling
      }
    } else {
      console.log("No task found with this project_task_id.");
      const tbody = document.querySelector(".subtask-table tbody");
      tbody.innerHTML = `<tr><td colspan="3">Task not found.</td></tr>`;
    }
  } catch (error) {
    console.error("❌ Error fetching subtasks:", error);
    const tbody = document.querySelector(".subtask-table tbody");
    tbody.innerHTML = `<tr><td colspan="3">Error loading subtasks.</td></tr>`;
  }
  return false; // Default return if error or no subtasks
}

// Function to update subtask status in Firestore
async function updateSubtaskStatus(projectTaskId, subtaskIndex, newStatus) {
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
      const subtasks = taskDoc.data().subtasks || [];

      if (subtasks[subtaskIndex]) {
        // Update status and handle dates
        subtasks[subtaskIndex].status = newStatus;
        
        if (newStatus === "Ongoing" && !subtasks[subtaskIndex].start_date) {
          subtasks[subtaskIndex].start_date = new Date().toISOString();
          subtasks[subtaskIndex].end_date = null; // Ensure end_date is null when starting
        } else if (newStatus === "Pending") {
          subtasks[subtaskIndex].start_date = null;
          subtasks[subtaskIndex].end_date = null;
        } else if (newStatus === "Completed" && subtasks[subtaskIndex].start_date) {
          subtasks[subtaskIndex].end_date = new Date().toISOString();
        }

        await updateDoc(taskDocRef, { subtasks });
        console.log(`✅ Status updated to ${newStatus}`);
        fetchSubtasks(projectTaskId); // Refresh UI
      }
    }
  } catch (error) {
    console.error("❌ Error updating subtask status:", error);
  }
}

// Function to delete subtask from Firestore
async function deleteSubtask(projectTaskId, subtaskIndex) {
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
      const subtasks = taskDoc.data().subtasks || [];

      subtasks.splice(subtaskIndex, 1); // Remove subtask
      await updateDoc(taskDocRef, { subtasks });
      console.log("✅ Subtask deleted");
      fetchSubtasks(projectTaskId); // Refresh UI
    }
  } catch (error) {
    console.error("❌ Error deleting subtask:", error);
  }
}

// Function to add new subtask
async function addSubtask(projectTaskId, newSubtasks) {
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
      const existingSubtasks = taskDoc.data().subtasks || [];

      const formattedSubtasks = newSubtasks.map(subtask => ({
        ...subtask,
        start_date: null,
        end_date: null
      }));

      const updatedSubtasks = [...existingSubtasks, ...formattedSubtasks];
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks });
      console.log("✅ Subtasks added");
      fetchSubtasks(projectTaskId);
    }
  } catch (error) {
    console.error("❌ Error adding subtasks:", error);
  }
}

// Function to initialize the subtask page
export function initializeSubtaskPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    const taskName = sessionStorage.getItem("selected_task_name") || "Planting";
    document.getElementById("taskName").textContent = taskName;

    const projectTaskId = sessionStorage.getItem("project_task_id");
    if (projectTaskId) {
      console.log(`Selected Project Task ID: ${projectTaskId}`);
      
      // Fetch subtasks and get completion status
      const allCompleted = await fetchSubtasks(projectTaskId);

      // Handle Completed button
      const completeBtn = document.getElementById("completeTaskBtn");
      if (completeBtn) { // Check if button exists
        if (allCompleted) {
          completeBtn.disabled = false;
          completeBtn.style.opacity = "1";
          completeBtn.style.cursor = "pointer";
        } else {
          completeBtn.disabled = true;
          completeBtn.style.opacity = "0.5";
          completeBtn.style.cursor = "not-allowed";
        }

        completeBtn.onclick = () => {
          if (!completeBtn.disabled) {
            console.log("All subtasks are completed!");
            // Add your desired functionality here
          }
        };
      } else {
        console.warn("Completed button not found in DOM");
      }

      // Modal handling (unchanged)
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

      subtaskForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const subtaskName = document.getElementById("subtaskName").value.trim();
        if (subtaskName) {
          addSubtask(projectTaskId, [
            { subtask_name: subtaskName, status: "Pending" }
          ]);
          modal.style.display = "none";
          subtaskForm.reset();
        }
      });
    } else {
      console.log("No project_task_id found in sessionStorage.");
      document.querySelector(
        ".subtask-table tbody"
      ).innerHTML = `<tr><td colspan="3">No task selected.</td></tr>`;
    }
  });
}

initializeSubtaskPage();
