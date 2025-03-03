import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";

const db = getFirestore(app);

export async function fetchAssignedTasks() {
  try {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    if (!taskListTable) {
      console.error("Table body element not found.");
      return;
    }

    // Listen to changes in Firestore
    const unsubscribe = onSnapshot(
      collection(db, "tb_task_list"),
      (querySnapshot) => {
        taskListTable.innerHTML = ""; // Clear existing data

        querySnapshot.forEach((taskDoc) => {
          const taskData = taskDoc.data();
          const taskId = taskData.task_id || "N/A"; // ✅ Fetch task_id from Firestore, not document ID
          console.log("Fetched Task ID:", taskId); // Debugging: Ensure correct task_id is retrieved

          const cropTypeName = taskData.crop_type_name || "N/A";
          const taskName = taskData.task_name || "N/A";

          // Convert Firestore timestamp to readable format
          let assignedOn = "N/A";
          if (taskData.assigned_on?.seconds) {
            const date = new Date(taskData.assigned_on.seconds * 1000);
            assignedOn = date.toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          }

          // Create table row with Task ID from Firestore field
          const row = document.createElement("tr");
          row.innerHTML = `
          <td>${taskId}</td>  <!-- ✅ Correct Task ID field -->
          <td>${cropTypeName}</td>
          <td>${taskName}</td>
          <td>${assignedOn}</td>
          <td>
            <button class="edit-btn" data-id="${taskId}" data-crop="${cropTypeName}" data-task="${taskName}">Edit</button>
            <button class="delete-btn" data-id="${taskId}">Delete</button>
          </td>
        `;
          taskListTable.appendChild(row);
        });

        // Attach event listeners to edit buttons
        document.querySelectorAll(".edit-btn").forEach((button) => {
          button.addEventListener("click", async (event) => {
            const taskId = event.target.getAttribute("data-id");
            console.log("Clicked Edit Task ID:", taskId); // Debugging output
            openEditModal(taskId);
          });
        });

        // Attach event listeners to delete buttons
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", async (event) => {
            const taskId = event.target.getAttribute("data-id");
            deleteTask(taskId);
          });
        });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
  }
}

// Function to delete task (you can add your implementation)
async function deleteTask(taskId) {
  try {
    await deleteDoc(doc(db, "tb_task_list", taskId));
    console.log(`Task with ID ${taskId} deleted successfully!`);
  } catch (error) {
    console.error("Error deleting task:", error);
  }
}

// Open the Edit Task Modal and fetch subtasks
async function openEditModal(docId) {
  try {
    const taskDoc = await getDoc(doc(db, "tb_task_list", docId));
    if (!taskDoc.exists()) {
      console.error("Task not found.");
      return;
    }

    const taskData = taskDoc.data();
    document.getElementById("editTaskModalTitle").textContent = "Edit Task";

    // Clear existing subtasks before appending new ones
    const subtaskList = document.getElementById("subtaskList");
    subtaskList.innerHTML = "";

    if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
      taskData.subtasks.forEach((subtask, index) => {
        addSubtaskToList(subtask, index);
      });
    }

    // Store docId for saving changes
    document
      .getElementById("saveSubtasksBtn")
      .setAttribute("data-doc-id", docId);

    // Open the modal
    document.getElementById("editTaskModal").style.display = "block";
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
}

function addSubtaskToList(subtaskName, index) {
  const subtaskList = document.getElementById("subtaskList");

  const subtaskItem = document.createElement("div");
  subtaskItem.classList.add("subtask-item");
  subtaskItem.setAttribute("data-index", index);

  subtaskItem.innerHTML = `
      • <span>${subtaskName}</span>
      <button class="delete-subtask" onclick="removeSubtask(${index})">X</button>
  `;

  subtaskList.appendChild(subtaskItem);
}

function addSubtask() {
  const newSubtaskInput = document.getElementById("newSubtaskInput");
  const newSubtaskName = newSubtaskInput.value.trim();

  if (newSubtaskName === "") {
    alert("Please enter a valid subtask name.");
    return;
  }

  const subtaskList = document.getElementById("subtaskList");
  const index = subtaskList.children.length;

  addSubtaskToList(newSubtaskName, index);

  newSubtaskInput.value = "";
}

function removeSubtask(index) {
  const subtaskList = document.getElementById("subtaskList");
  const subtaskItem = subtaskList.querySelector(`[data-index='${index}']`);

  if (subtaskItem) {
    subtaskItem.remove();
  }
}

async function saveSubtasks() {
  const docId = document
    .getElementById("saveSubtasksBtn")
    .getAttribute("data-doc-id");
  const subtaskList = document.getElementById("subtaskList");

  const updatedSubtasks = [];
  subtaskList.querySelectorAll(".subtask-item span").forEach((subtaskSpan) => {
    updatedSubtasks.push(subtaskSpan.textContent);
  });

  try {
    await updateDoc(doc(db, "tb_task_list", docId), {
      subtasks: updatedSubtasks,
    });
    alert("Subtasks updated successfully!");
    document.getElementById("editTaskModal").style.display = "none";
  } catch (error) {
    console.error("Error updating subtasks:", error);
  }
}
