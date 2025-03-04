import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";

const db = getFirestore(app);

// Dynamically add the fetch.css stylesheet
const link = document.createElement("link");
link.rel = "stylesheet";
link.type = "text/css";
link.href = "fetch.css"; // Replace with your actual CSS file path
document.head.appendChild(link);

// Fetch assigned tasks and populate the table
export function fetchAssignedTasks() {
  try {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    if (!taskListTable) {
      console.error("Table body element not found.");
      return;
    }

    return onSnapshot(collection(db, "tb_task_list"), (querySnapshot) => {
      taskListTable.innerHTML = ""; // Clear existing data

      querySnapshot.forEach((taskDoc) => {
        const taskData = taskDoc.data();
        const taskId = taskData.task_id || "N/A";
        const cropTypeName = taskData.crop_type_name || "N/A";
        const taskName = taskData.task_name || "N/A";

        let assignedOn = "N/A";
        if (taskData.assigned_on?.seconds) {
          const date = new Date(taskData.assigned_on.seconds * 1000);
          assignedOn = date.toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }

        // Create table row
        const row = document.createElement("tr");
        row.innerHTML = `  
          <td>${taskId}</td>
          <td>${cropTypeName}</td>
          <td>${taskName}</td>
          <td>${assignedOn}</td>
          <td>
            <button class="edit-btn" data-id="${taskId}" data-task="${taskName}">Edit</button>
            <button class="delete-btn" data-id="${taskId}">Delete</button>
          </td>
        `;
        taskListTable.appendChild(row);
      });

      // Attach event listeners to Edit buttons
      document.querySelectorAll(".edit-btn").forEach((button) => {
        button.addEventListener("click", async (event) => {
          const taskId = event.target.getAttribute("data-id");
          const taskName = event.target.getAttribute("data-task");
          openEditSubModal(taskId, taskName);
        });
      });

      // Attach event listeners to Delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
          const taskId = event.target.getAttribute("data-id");
          console.log("Delete Task:", taskId);
          deleteTask(taskId);
        });
      });
    });
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
  }
}

// Open Edit Task Modal & Fetch Subtasks
async function openEditSubModal(taskId, taskName) {
  const modal = document.getElementById("edit-subtasks-modal");
  const taskNameDisplay = document.getElementById("edit-task-name-display");
  const subtaskList = document.getElementById("subtask-list-subtasks"); // Updated ID
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks"); // Updated ID

  taskNameDisplay.textContent = `Task Name: ${taskName}`;
  subtaskList.innerHTML = ""; // Clear old subtasks
  saveBtn.setAttribute("data-id", taskId);
  saveBtn.disabled = true; // Disable Save button initially

  try {
    // Firestore query to get the task document where task_id == taskId
    const tasksCollection = collection(db, "tb_task_list");
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);

    if (querySnapshot.empty) {
      console.error("Task not found.");
      return;
    }

    let docId = "";
    let taskData = {};

    querySnapshot.forEach((doc) => {
      docId = doc.id;
      taskData = doc.data();
    });

    const subtasks = taskData.subtasks || [];

    // Populate existing subtasks
    subtasks.forEach((subtask, index) => {
      addSubtaskToList(subtask, index);
    });

    // Store the actual Firestore doc ID for updates
    saveBtn.setAttribute("data-doc-id", docId);

    modal.style.display = "block"; // Show modal
  } catch (error) {
    console.error("Error fetching task details:", error);
  }
}

// Function to capitalize the first letter of each word
function capitalizeFirstLetter(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Add a new subtask to the list
document
  .getElementById("add-subtask-btn-subtasks")
  .addEventListener("click", () => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );
    let newSubtaskName = newSubtaskInput.value.trim();

    if (newSubtaskName !== "") {
      newSubtaskName = capitalizeFirstLetter(newSubtaskName); // Capitalize first letter

      const subtaskList = document.getElementById("subtask-list-subtasks");
      const existingSubtasks = Array.from(subtaskList.children).map((item) =>
        item.querySelector(".subtask-text").textContent.trim().toLowerCase()
      );

      if (existingSubtasks.includes(newSubtaskName.toLowerCase())) {
        alert("Subtask already exists! Please enter a different subtask.");
        return;
      }

      const index = subtaskList.children.length;
      addSubtaskToList(newSubtaskName, index);
      newSubtaskInput.value = "";
      document.getElementById("save-subtasks-btn-subtasks").disabled = false;
    } else {
      alert("Please enter a valid subtask.");
    }
  });

// Remove subtask from the list
// Make removeSubtask accessible globally
window.removeSubtask = function (index) {
  const subtaskItem = document.querySelector(`[data-index="${index}"]`);
  if (subtaskItem) {
    subtaskItem.remove();
    document.getElementById("save-subtasks-btn-subtasks").disabled = false; // Updated ID
  }
};

// Add subtask item to the list (Fix for Bullet Issue)
function addSubtaskToList(subtaskName, index) {
  const subtaskList = document.getElementById("subtask-list-subtasks");

  const subtaskItem = document.createElement("li");
  subtaskItem.classList.add("subtask-item");
  subtaskItem.setAttribute("data-index", index);
  subtaskItem.innerHTML = `  
    <span class="subtask-text">${subtaskName}</span>  
    <button class="remove-subtask-btn" onclick="removeSubtask(${index})">❌</button>
  `;

  subtaskList.appendChild(subtaskItem);
}

// Save updated subtasks to Firestore (Fix for Bullet Issue)
document
  .getElementById("save-subtasks-btn-subtasks")
  .addEventListener("click", async () => {
    const taskDocId = document
      .getElementById("save-subtasks-btn-subtasks")
      .getAttribute("data-doc-id");
    const updatedSubtasks = [];

    document.querySelectorAll(".subtask-item").forEach((item) => {
      updatedSubtasks.push(
        item.querySelector(".subtask-text").textContent.trim()
      ); // Get only text
    });

    try {
      await updateDoc(doc(db, "tb_task_list", taskDocId), {
        subtasks: updatedSubtasks,
      });
      alert("Subtasks updated successfully!");
      document.getElementById("edit-subtasks-modal").style.display = "none";
    } catch (error) {
      console.error("Error updating subtasks:", error);
    }
  });

// JavaScript code to handle modal close functionality
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("edit-subtasks-modal");
  const closeButton = document.getElementById("close-edit-subtasks-modal");
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks");
  const subtaskInput = document.getElementById("new-subtask-input-subtasks");
  const subtaskList = document.getElementById("subtask-list-subtasks");

  let hasListChanged = false; // Track if subtask list has changed

  closeButton.addEventListener("click", () => {
    modal.style.display = "none";
    clearSubtaskInput();
  });

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
      clearSubtaskInput();
    }
  });

  function clearSubtaskInput() {
    subtaskInput.value = "";
    checkSubtaskListChanges();
  }

  subtaskList.addEventListener("DOMSubtreeModified", () => {
    hasListChanged = true; // ✅ Mark that subtasks were added/removed
    checkSubtaskListChanges();
  });

  subtaskInput.addEventListener("input", () => {
    checkSubtaskListChanges();
  });

  function checkSubtaskListChanges() {
    if (hasListChanged || subtaskList.children.length > 0) {
      // ✅ If a subtask was added/removed, enable the save button
      saveBtn.disabled = false;
    }

    // ✅ If input field is NOT empty, disable save button
    if (subtaskInput.value.trim() !== "") {
      saveBtn.disabled = true;
    }

    // ✅ If input is cleared and subtasks changed, re-enable save button
    if (
      subtaskInput.value.trim() === "" &&
      (hasListChanged || subtaskList.children.length > 0)
    ) {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", () => {
    hasListChanged = false; // ✅ Reset change tracking after saving
    checkSubtaskListChanges(); // Ensure correct state after saving
  });
});
