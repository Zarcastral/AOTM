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
      const taskDoc = querySnapshot.docs[0]; // Assuming one match
      const subtasks = taskDoc.data().subtasks || [];
      console.log("Subtasks:", subtasks);

      const tbody = document.querySelector(".subtask-table tbody");
      tbody.innerHTML = ""; // Clear existing rows

      if (subtasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3">No subtasks found.</td></tr>`;
      } else {
        subtasks.forEach((subtask, index) => {
          const status = subtask.status || "Pending"; // Default to Pending
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
                  }>Completed</option>
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

        // Add event listeners to update Firestore when dropdown changes
        document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
          dropdown.addEventListener("change", async (event) => {
            const index = event.target.dataset.index;
            const newStatus = event.target.value;
            await updateSubtaskStatus(projectTaskId, index, newStatus);
          });
        });

        // Add event listeners for delete icons
        document.querySelectorAll(".delete-icon").forEach((icon) => {
          icon.addEventListener("click", async (event) => {
            const index = event.target.dataset.index;
            await deleteSubtask(projectTaskId, index);
          });
        });
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
        subtasks[subtaskIndex].status = newStatus;
        await updateDoc(taskDocRef, { subtasks });
        console.log(`✅ Status updated to ${newStatus}`);
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

      const updatedSubtasks = [...existingSubtasks, ...newSubtasks];
      await updateDoc(taskDocRef, { subtasks: updatedSubtasks });
      console.log("✅ Subtasks added");
      fetchSubtasks(projectTaskId); // Refresh UI
    }
  } catch (error) {
    console.error("❌ Error adding subtasks:", error);
  }
}

// Function to initialize the subtask page
export function initializeSubtaskPage() {
  document.addEventListener("DOMContentLoaded", () => {
    const taskName = sessionStorage.getItem("selected_task_name") || "Planting";
    document.getElementById("taskName").textContent = taskName;

    const projectTaskId = sessionStorage.getItem("project_task_id");
    if (projectTaskId) {
      console.log(`Selected Project Task ID: ${projectTaskId}`);
      fetchSubtasks(projectTaskId);

      document.querySelector(".add-subtask").addEventListener("click", () => {
        const subtaskName = prompt("Enter subtask name:");
        if (subtaskName) {
          addSubtask(projectTaskId, [
            { subtask_name: subtaskName, status: "Pending" },
          ]);
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
