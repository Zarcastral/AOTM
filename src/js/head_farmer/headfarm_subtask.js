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

// Debounce control
let isFetching = false;

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

      // Render the table with static status, start_date, and end_date
      subtasks.forEach((subtask, index) => {
        const status = subtask.status || "Pending";
        const startDate = subtask.start_date || "-"; // Display "-" if no start date
        const endDate = subtask.end_date || "-"; // Display "-" if no end date
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

      // Attach event listeners after rendering
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
      const taskId = taskDoc.id; // Get the document ID for the subcollection path
      const subtasks = taskDoc.data().subtasks || [];

      const deletedSubtaskName = subtasks[subtaskIndex].subtask_name;

      // Step 1: Delete from Attendance subcollection
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

      // Step 2: Delete from tb_attendance collection
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

      // Step 3: Delete the subtask from tb_project_task
      subtasks.splice(subtaskIndex, 1);
      await updateDoc(taskDocRef, { subtasks });
      console.log(
        `✅ Subtask ${deletedSubtaskName} deleted from tb_project_task`
      );

      // Clear subtask_status from sessionStorage if the deleted subtask matches
      if (deletedSubtaskName === sessionStorage.getItem("subtask_name")) {
        sessionStorage.removeItem("subtask_status");
      }

      await fetchSubtasks(projectTaskId, "deleteSubtask");
    }
  } catch (error) {
    console.error("❌ Error deleting subtask or attendance records:", error);
  }
}

// Function to add new subtask with capitalization and single duplicate check
async function addSubtask(projectTaskId, newSubtasks) {
  console.log("Starting addSubtask with:", newSubtasks);

  // Fetch the task document from Firestore
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

    // Get the subtask input element
    const subtaskInput = document.getElementById("subtaskName");
    if (!subtaskInput) {
      console.error("Subtask input field not found!");
      return false;
    }

    // Process the new subtask (single subtask from form)
    const subtask = newSubtasks[0];
    const originalName = subtask.subtask_name.trim();
    console.log("Original subtask name:", originalName);

    // Capitalize the first letter (done once)
    const capitalizedName =
      originalName.charAt(0).toUpperCase() +
      originalName.slice(1).toLowerCase();
    console.log("Capitalized subtask name:", capitalizedName);

    // Check for duplicates (done once, case-insensitive)
    const isDuplicate = existingSubtasks.some(
      (existing) =>
        existing.subtask_name.toLowerCase() === capitalizedName.toLowerCase()
    );
    console.log("Duplicate check result:", isDuplicate);

    // If duplicate, show alert and clear textbox
    if (isDuplicate) {
      subtaskInput.value = ""; // Clear the textbox
      alert(`"${capitalizedName}" is already existing.`); // Show custom message
      console.log(`Duplicate found: "${capitalizedName}" - stopping`);
      return false; // Stop execution, modal stays open
    }

    // If no duplicate, proceed to save
    const newSubtask = {
      subtask_name: capitalizedName,
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
      return true; // Indicate success, modal will close
    } catch (error) {
      console.error("❌ Failed to save subtask to Firestore:", error);
      return false; // Indicate failure due to Firestore error
    }
  } else {
    console.log("No task document found for projectTaskId:", projectTaskId);
    return false; // No document found
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
        const addSubtaskBtn = document.querySelector(".add-subtask-btn"); // Assuming this is the submit button inside the form
        if (!addSubtaskBtn) {
          console.error("Add Subtask button not found!");
          return;
        }

        // Disable the button to prevent multiple clicks
        addSubtaskBtn.disabled = true;
        console.log("Add Subtask button disabled");

        const subtaskName = document.getElementById("subtaskName").value.trim();
        console.log("Form submitted with subtask name:", subtaskName);
        if (subtaskName) {
          const success = await addSubtask(projectTaskId, [
            { subtask_name: subtaskName },
          ]);
          console.log("AddSubtask result:", success);
          if (success) {
            console.log("Closing modal and resetting form");
            modal.style.display = "none";
            subtaskForm.reset();
            await updateCompleteButtonState(projectTaskId);
          } else {
            console.log("Modal remains open due to duplicate or error");
          }
        } else {
          console.log("No subtask name provided, submission ignored");
        }

        // Re-enable the button after processing
        addSubtaskBtn.disabled = false;
        console.log("Add Subtask button re-enabled");
      });
    } else {
      console.log("No project_task_id found in sessionStorage.");
      document.querySelector(".subtask-table tbody").innerHTML = `
        <tr><td colspan="5">No task selected.</td></tr>
      `;
    }
  }
}

initializeSubtaskPage();
