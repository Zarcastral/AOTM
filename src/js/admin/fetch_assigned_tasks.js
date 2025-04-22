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

function capitalizeFirstLetter(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Function to show success panel
function showSuccessPanel(message) {
  // Remove existing success or error panels
  const existingPanels = document.querySelectorAll(".success-message, .error-message");
  existingPanels.forEach((panel) => panel.remove());

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
      if (successMessage.parentNode) {
        document.body.removeChild(successMessage);
      }
    }, 400);
  }, 4000);
}

// Function to show error panel
function showErrorPanel(message) {
  // Remove existing success or error panels
  const existingPanels = document.querySelectorAll(".success-message, .error-message");
  existingPanels.forEach((panel) => panel.remove());

  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = message;

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
      if (errorMessage.parentNode) {
        document.body.removeChild(errorMessage);
      }
    }, 400);
  }, 4000);
}

function showDeleteConfirmationModal(taskId, taskName, cropTypeName) {
  const modal = document.getElementById("delete-confirmation-modal");
  const messageElement = document.getElementById("delete-confirmation-message");
  const confirmBtn = document.getElementById("confirm-delete-btn");
  const cancelBtn = document.getElementById("cancel-delete-btn");

  messageElement.textContent = `You are currently deleting the task "${taskName}" on crop type "${cropTypeName}". Are you sure you want to delete?`;
  modal.style.display = "flex";

  confirmBtn.onclick = () => {
    modal.style.display = "none";
    deleteTask(taskId);
  };

  cancelBtn.onclick = () => (modal.style.display = "none");

  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = "none";
  };
}

async function deleteTask(taskId) {
  try {
    const tasksCollection = collection(db, "tb_task_list");
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);

    if (querySnapshot.empty) {
      showErrorPanel("Task not found!");
      return;
    }

    const deletePromises = querySnapshot.docs.map((taskDoc) =>
      deleteDoc(doc(db, "tb_task_list", taskDoc.id))
    );
    await Promise.all(deletePromises);

    showSuccessPanel("Task deleted successfully!");
    await fetchAssignedTasks();

    const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
    if (assignedTasks.length === 0) {
      assignedCurrentPage = 1;
    } else if (assignedCurrentPage > totalPages) {
      assignedCurrentPage = totalPages;
    }

    displayAssignedTasks(assignedCurrentPage);
    updateAssignedPagination();
  } catch (error) {
    console.error("Error deleting task:", error);
    showErrorPanel("Failed to delete task. Please try again.");
  }
}

window.openEditSubModal = async function openEditSubModal(taskId, taskName) {
  const modal = document.getElementById("edit-subtasks-modal");
  const taskNameDisplay = document.getElementById("edit-task-name-display");
  const subtaskList = document.getElementById("subtask-list-subtasks");
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks");

  taskNameDisplay.textContent = `Task Name: ${taskName}`;
  subtaskList.innerHTML = "";
  saveBtn.setAttribute("data-id", taskId);
  saveBtn.disabled = true;

  try {
    const tasksCollection = collection(db, "tb_task_list");
    const taskQuery = query(
      tasksCollection,
      where("task_id", "==", Number(taskId))
    );
    const querySnapshot = await getDocs(taskQuery);
    if (querySnapshot.empty) {
      showErrorPanel("Task not found!");
      return;
    }

    let docId = "";
    let taskData = {};
    querySnapshot.forEach((doc) => {
      docId = doc.id;
      taskData = doc.data();
    });

    initialSubtasks = taskData.subtasks || [];
    initialSubtasks.forEach((subtask, index) =>
      addSubtaskToList(subtask, index)
    );

    saveBtn.setAttribute("data-doc-id", docId);
    modal.style.display = "block";
    toggleSaveButton();
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    showErrorPanel("Failed to fetch subtasks. Please try again.");
  }
};

function addSubtaskToList(subtask, index) {
  const subtaskList = document.getElementById("subtask-list-subtasks");
  const subtaskItem = document.createElement("li");
  subtaskItem.classList.add("subtask-item");
  subtaskItem.setAttribute("data-index", index);

  // Check if subtask is an object with a subtask_name property, otherwise use it as a string
  const subtaskName =
    typeof subtask === "object" && subtask.subtask_name
      ? subtask.subtask_name
      : subtask;

  subtaskItem.innerHTML = `
        <span class="subtask-text">${subtaskName}</span>
        <button class="remove-subtask-btn" onclick="removeSubtask(${index})">
            <img src="/images/Delete.png" alt="Remove">
        </button>
    `;
  subtaskList.appendChild(subtaskItem);
  toggleSaveButton();
}

window.removeSubtask = function (index) {
  const subtaskItem = document.querySelector(`[data-index="${index}"]`);
  if (subtaskItem) {
    subtaskItem.remove();
    toggleSaveButton();
  }
};

document
  .getElementById("close-edit-subtasks-modal")
  .addEventListener("click", () => {
    document.getElementById("edit-subtasks-modal").style.display = "none";
    document.getElementById("new-subtask-input-subtasks").value = "";
    document.getElementById("subtask-list-subtasks").innerHTML = "";
  });

document
  .getElementById("add-subtask-btn-subtasks")
  .addEventListener("click", () => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );
    let newSubtaskName = newSubtaskInput.value.trim();

    if (newSubtaskName === "") {
      showErrorPanel("Please enter a valid subtask.");
      return;
    }

    newSubtaskName = capitalizeFirstLetter(newSubtaskName);
    const subtaskList = document.getElementById("subtask-list-subtasks");
    const existingSubtasks = Array.from(subtaskList.children).map((item) =>
      item.querySelector(".subtask-text").textContent.trim().toLowerCase()
    );

    if (existingSubtasks.includes(newSubtaskName.toLowerCase())) {
      showErrorPanel(
        `Subtask "${newSubtaskName}" already exists! Please enter a different subtask.`
      );
      return;
    }

    const index = subtaskList.children.length;
    addSubtaskToList(newSubtaskName, index);
    newSubtaskInput.value = "";
    document.getElementById("save-subtasks-btn-subtasks").disabled = false;
  });

function toggleAddSubtaskButton() {
  const newSubtaskInput = document.getElementById("new-subtask-input-subtasks");
  const addSubtaskBtn = document.getElementById("add-subtask-btn-subtasks");

  if (newSubtaskInput.value.trim() === "") {
    addSubtaskBtn.disabled = true;
    addSubtaskBtn.classList.add("disabled-btn");
  } else {
    addSubtaskBtn.disabled = false;
    addSubtaskBtn.classList.remove("disabled-btn");
  }
}

document
  .getElementById("new-subtask-input-subtasks")
  .addEventListener("input", toggleAddSubtaskButton);
document.addEventListener("DOMContentLoaded", toggleAddSubtaskButton);

let initialSubtasks = [];

function toggleSaveButton() {
  const saveBtn = document.getElementById("save-subtasks-btn-subtasks");
  const subtaskList = document.getElementById("subtask-list-subtasks");
  const currentSubtasks = Array.from(subtaskList.children).map((item) =>
    item.querySelector(".subtask-text").textContent.trim()
  );
  const initialSubtaskNames = initialSubtasks.map((subtask) =>
    typeof subtask === "object" && subtask.subtask_name
      ? subtask.subtask_name
      : subtask
  );
  const isSameAsInitial =
    JSON.stringify(currentSubtasks) === JSON.stringify(initialSubtaskNames);
  saveBtn.disabled = isSameAsInitial;
}

document
  .getElementById("save-subtasks-btn-subtasks")
  .addEventListener("click", async (event) => {
    const newSubtaskInput = document.getElementById(
      "new-subtask-input-subtasks"
    );
    if (newSubtaskInput.value.trim() !== "") {
      showErrorPanel(
        "Please add the subtask or clear the input field before saving."
      );
      return;
    }

    const saveBtn = event.target;
    const taskId = saveBtn.getAttribute("data-id");
    const docId = saveBtn.getAttribute("data-doc-id");

    if (!taskId || !docId) {
      showErrorPanel("Invalid task data. Please try again.");
      return;
    }

    saveBtn.disabled = true;

    try {
      const subtaskList = document.getElementById("subtask-list-subtasks");
      const subtasks = Array.from(subtaskList.children).map((item) => {
        const subtaskText = item
          .querySelector(".subtask-text")
          .textContent.trim();
        return { subtask_name: subtaskText };
      });

      const initialSubtaskNames = initialSubtasks.map((subtask) =>
        typeof subtask === "object" && subtask.subtask_name
          ? subtask.subtask_name
          : subtask
      );

      if (
        JSON.stringify(subtasks.map((s) => s.subtask_name)) ===
        JSON.stringify(initialSubtaskNames)
      ) {
        showErrorPanel("No changes were made to the subtasks.");
        return;
      }

      const taskRef = doc(db, "tb_task_list", docId);
      await updateDoc(taskRef, { subtasks });

      showSuccessPanel("Subtasks saved successfully!");
      initialSubtasks = subtasks;
      toggleSaveButton();
      document.getElementById("edit-subtasks-modal").style.display = "none";
    } catch (error) {
      console.error("Error saving subtasks:", error);
      showErrorPanel("Failed to save changes. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  });

document
  .getElementById("close-edit-subtasks-modal")
  .addEventListener("click", () => {
    document.getElementById("save-subtasks-btn-subtasks").disabled = true;
  });

async function populateCropDropdown() {
  try {
    const cropDropdown = document.getElementById("crop-filter");
    if (!cropDropdown) {
      showErrorPanel("Crop filter element not found.");
      return;
    }

    cropDropdown.innerHTML = `<option value="">Crops</option>`;
    const cropsSnapshot = await getDocs(collection(db, "tb_crops"));
    if (cropsSnapshot.empty) {
      showErrorPanel("No crops available.");
      return;
    }

    cropsSnapshot.forEach((cropDoc) => {
      const cropData = cropDoc.data();
      const cropName = cropData.crop_name || "Unknown Crop";
      const option = document.createElement("option");
      option.value = cropName;
      option.textContent = cropName;
      cropDropdown.appendChild(option);
    });

    cropDropdown.addEventListener("change", async () => {
      const selectedCrop = cropDropdown.value;
      await populateCropTypeDropdown(selectedCrop);
      fetchAssignedTasks();
    });
  } catch (error) {
    console.error("Error populating crop dropdown:", error);
    showErrorPanel("Failed to load crops. Please try again.");
  }
}

async function populateCropTypeDropdown(selectedCrop = "") {
  try {
    const cropTypeDropdown = document.getElementById("crop-type-filter");
    if (!cropTypeDropdown) {
      showErrorPanel("Crop type filter element not found.");
      return;
    }

    cropTypeDropdown.innerHTML = `<option value="">Crop Type</option>`;
    const tasksSnapshot = await getDocs(collection(db, "tb_task_list"));
    const cropTypes = new Set();

    if (tasksSnapshot.empty) {
      showErrorPanel("No crop types available.");
      return;
    }

    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      const cropName = taskData.crop_name || "N/A";
      const cropTypeName = taskData.crop_type_name || "Unknown Crop Type";
      if (!selectedCrop || cropName === selectedCrop) {
        cropTypes.add(cropTypeName);
      }
    });

    const sortedCropTypes = Array.from(cropTypes).sort();
    sortedCropTypes.forEach((cropType) => {
      const option = document.createElement("option");
      option.value = cropType;
      option.textContent = cropType;
      cropTypeDropdown.appendChild(option);
    });

    cropTypeDropdown.addEventListener("change", fetchAssignedTasks);
  } catch (error) {
    console.error("Error populating crop type dropdown:", error);
    showErrorPanel("Failed to load crop types. Please try again.");
  }
}

let assignedTasks = [];
let assignedCurrentPage = 1;
const assignedRowsPerPage = 5;

export async function fetchAssignedTasks() {
  try {
    const taskListTable = document.getElementById("assigned-tasks-table-body");
    if (!taskListTable) {
      showErrorPanel("Task table element not found.");
      return;
    }

    taskListTable.innerHTML = "";
    const selectedCrop = document.getElementById("crop-filter")?.value || "";
    const selectedCropType =
      document.getElementById("crop-type-filter")?.value || "";

    let taskQuery = collection(db, "tb_task_list");
    if (selectedCrop || selectedCropType) {
      taskQuery = query(
        taskQuery,
        ...(selectedCrop ? [where("crop_name", "==", selectedCrop)] : []),
        ...(selectedCropType
          ? [where("crop_type_name", "==", selectedCropType)]
          : [])
      );
    }

    const querySnapshot = await getDocs(taskQuery);
    assignedTasks = [];

    if (querySnapshot.empty) {
      displayAssignedTasks(assignedCurrentPage);
      updateAssignedPagination();
      return;
    }

    querySnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      const taskId = taskData.task_id || "N/A";
      const cropName = taskData.crop_name || "N/A";
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

      assignedTasks.push({
        taskId,
        cropName,
        cropTypeName,
        taskName,
        assignedOn,
      });
    });

    const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
    if (assignedCurrentPage > totalPages && totalPages > 0) {
      assignedCurrentPage = totalPages;
    } else if (assignedTasks.length === 0) {
      assignedCurrentPage = 1;
    }

    displayAssignedTasks(assignedCurrentPage);
    updateAssignedPagination();
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    showErrorPanel("Failed to fetch tasks. Please try again.");
  }
}

function displayAssignedTasks(page) {
  const taskListTable = document.getElementById("assigned-tasks-table-body");
  taskListTable.innerHTML = "";

  if (assignedTasks.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" style="text-align: center;">No tasks available</td>`;
    taskListTable.appendChild(row);
    return;
  }

  const startIndex = (page - 1) * assignedRowsPerPage;
  const endIndex = startIndex + assignedRowsPerPage;
  const paginatedTasks = assignedTasks.slice(startIndex, endIndex);

  paginatedTasks.forEach((task) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${task.taskId}</td>
            <td>${task.cropName}</td>
            <td>${task.cropTypeName}</td>
            <td>${task.taskName}</td>
            <td>${task.assignedOn}</td>
            <td>
                <button class="edit-btn" data-id="${task.taskId}" data-task="${task.taskName}" title="Edit">
                    <img src="/images/image 27.png" alt="Edit">
                </button>
                <button class="delete-btn" data-id="${task.taskId}" data-task="${task.taskName}" data-crop="${task.cropName}" data-crop-type="${task.cropTypeName}" title="Delete">
                    <img src="/images/Delete.png" alt="Delete">
                </button>
            </td>
        `;
    taskListTable.appendChild(row);
  });
}

function updateAssignedPagination() {
  const totalPages = Math.ceil(assignedTasks.length / assignedRowsPerPage);
  const nextBtn = document.getElementById("assigned-next-page-btn");
  const prevBtn = document.getElementById("assigned-prev-page-btn");
  const pageInfo = document.getElementById("assigned-page-info");

  pageInfo.textContent = `${assignedCurrentPage} of ${totalPages || 1}`;
  prevBtn.disabled = assignedCurrentPage === 1;
  nextBtn.disabled = assignedCurrentPage === totalPages || totalPages === 0;
}

document.addEventListener("DOMContentLoaded", async () => {
  await populateCropDropdown();
  await populateCropTypeDropdown();
  fetchAssignedTasks();

  document
    .getElementById("assigned-tasks-table-body")
    .addEventListener("click", (event) => {
      if (event.target.closest(".delete-btn")) {
        const button = event.target.closest(".delete-btn");
        const taskId = button.getAttribute("data-id");
        const taskName = button.getAttribute("data-task");
        const cropTypeName = button.getAttribute("data-crop-type");
        showDeleteConfirmationModal(taskId, taskName, cropTypeName);
      }
    });

  document
    .getElementById("assigned-tasks-table-body")
    .addEventListener("click", (event) => {
      if (event.target.closest(".edit-btn")) {
        const button = event.target.closest(".edit-btn");
        const taskId = button.getAttribute("data-id");
        const taskName = button.getAttribute("data-task");
        openEditSubModal(taskId, taskName);
      }
    });

  document
    .getElementById("assigned-next-page-btn")
    .addEventListener("click", () => {
      if (
        assignedCurrentPage <
        Math.ceil(assignedTasks.length / assignedRowsPerPage)
      ) {
        assignedCurrentPage++;
        displayAssignedTasks(assignedCurrentPage);
        updateAssignedPagination();
      }
    });

  document
    .getElementById("assigned-prev-page-btn")
    .addEventListener("click", () => {
      if (assignedCurrentPage > 1) {
        assignedCurrentPage--;
        displayAssignedTasks(assignedCurrentPage);
        updateAssignedPagination();
      }
    });
});
