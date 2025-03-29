import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

// Initialize Firestore
const db = getFirestore(app);

// Function to show confirmation modal for completing subtask and return a Promise
function confirmCompleteSubtask() {
  return new Promise((resolve) => {
    const modal = document.getElementById("completeConfirmationModal");
    const confirmBtn = document.getElementById("confirmCompleteBtn");
    const cancelBtn = document.getElementById("cancelCompleteBtn");

    modal.style.display = "block";

    confirmBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };

    cancelBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}

// Function to initialize the subtask details page
export function initializeSubtaskDetailsPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    // Retrieve data from sessionStorage
    const subtaskName =
      sessionStorage.getItem("subtask_name") || "Unnamed Subtask";
    const projectId = sessionStorage.getItem("selected_project_id");
    const cropType = sessionStorage.getItem("selected_crop_type");
    const cropName = sessionStorage.getItem("selected_crop_name");
    const projectTaskId = sessionStorage.getItem("project_task_id");

    // Debug log to verify retrieval
    console.log("Retrieved from sessionStorage:", {
      subtaskName,
      projectId,
      cropType,
      cropName,
      projectTaskId,
    });

    // Update the task name in the HTML
    const taskNameElement = document.getElementById("taskName");
    if (taskNameElement) {
      taskNameElement.textContent = subtaskName;
    } else {
      console.error("Element with ID 'taskName' not found.");
    }

    // Back button navigation
    const backButton = document.querySelector(".back-btn");
    if (backButton) {
      backButton.addEventListener("click", () => {
        window.location.href = "headfarm_subtask.html";
      });
    }

    // Add Day button functionality
    const addDayBtn = document.querySelector(".add-day-btn");
    if (addDayBtn) {
      addDayBtn.addEventListener("click", () => {
        addNewDay(projectId, cropType, cropName, projectTaskId, subtaskName);
      });
    }

    const completeBtn = document.querySelector(".completed-btn");
    if (completeBtn) {
      completeBtn.addEventListener("click", async () => {
        const confirmed = await confirmCompleteSubtask();
        if (confirmed) {
          sessionStorage.setItem("subtask_status", "Complete");
          console.log("Subtask status set to: Complete");
          alert("Subtask marked as Complete!");
          // Optionally, disable further edits or redirect
          // e.g., window.location.href = "headfarm_subtask.html";
        } else {
          console.log("Complete action canceled by user.");
        }
      });
    }

    if (projectId && cropType && cropName && projectTaskId) {
      await fetchAttendanceData(
        projectId,
        cropType,
        cropName,
        projectTaskId,
        subtaskName
      );
    } else {
      console.error("Missing required sessionStorage values.");
      document.getElementById("attendanceTableBody").innerHTML = `
        <tr><td colspan="3">No project/task details selected.</td></tr>
      `;
    }

    document.addEventListener("click", async (event) => {
      if (event.target.matches(".action-icons img[alt='View']")) {
        const dateCreated = event.target
          .closest("tr")
          .querySelector("td:first-child").textContent;
        sessionStorage.setItem("selected_date", dateCreated);
        window.location.href = "headfarm_attendance.html";
      } else if (event.target.matches(".action-icons img[alt='Delete']")) {
        const dateCreated = event.target
          .closest("tr")
          .querySelector("td:first-child").textContent;
        await deleteAttendanceRecord(
          projectId,
          cropType,
          cropName,
          projectTaskId,
          subtaskName,
          dateCreated
        );
        await fetchAttendanceData(
          projectId,
          cropType,
          cropName,
          projectTaskId,
          subtaskName
        );
      }
    });
  });
}

// Function to fetch attendance data from Firestore
async function fetchAttendanceData(
  projectId,
  cropType,
  cropName,
  projectTaskId,
  subtaskName
) {
  try {
    // Query to find the matching document in tb_project_task
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", projectId),
      where("crop_type_name", "==", cropType),
      where("crop_name", "==", cropName),
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error("No matching task found in tb_project_task.");
      document.getElementById("attendanceTableBody").innerHTML = `
        <tr><td colspan="3">No matching task found.</td></tr>
      `;
      return;
    }

    // Assume the first matching document (should be unique with project_task_id)
    const taskDoc = querySnapshot.docs[0];
    const taskId = taskDoc.id;
    console.log("Found matching task with ID:", taskId);

    // Query the Attendance subcollection with subtask_name filter
    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const attendanceQuery = query(
      attendanceRef,
      where("subtask_name", "==", subtaskName)
    );
    const attendanceSnapshot = await getDocs(attendanceQuery);

    const tbody = document.getElementById("attendanceTableBody");
    tbody.innerHTML = "";

    console.log("Fetching attendance for task ID:", taskId);
    console.log("Number of attendance records found:", attendanceSnapshot.size);

    const completedBtn = document.querySelector(".completed-btn");
    let hasZeroAttendance = false;

    if (attendanceSnapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="3">No attendance records found for subtask: ${subtaskName}.</td></tr>`;
      sessionStorage.setItem("totalAttendanceRecords", "0");
      sessionStorage.setItem("subtask_status", "Pending"); // No records = Pending
      console.log("No attendance records, subtask_status set to: Pending");
      completedBtn.disabled = true;
    } else {
      sessionStorage.setItem("subtask_status", "Ongoing"); // Records exist = Ongoing
      console.log("Attendance records exist, subtask_status set to: Ongoing");

      const selectedDate = sessionStorage.getItem("selected_date");
      let latestAttendanceData = null;

      attendanceSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateCreated = data.date_created || "No Date";
        const farmers = data.farmers || [];
        const presentCount = farmers.filter(
          (farmer) => farmer.present === "Yes"
        ).length;
        const totalRecords = farmers.length;
        const attendanceSummary =
          presentCount === 0 ? "0" : `${presentCount}/${totalRecords}`;

        if (presentCount === 0) {
          hasZeroAttendance = true;
        }

        console.log(`Date Created: ${dateCreated}, Farmers:`, farmers);

        const row = `
          <tr>
            <td>${dateCreated}</td>
            <td>${attendanceSummary}</td>
            <td class="action-icons">
              <img src="../../images/eye.png" alt="View">
              <img src="../../images/Delete.png" alt="Delete">
            </td>
          </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);

        if (selectedDate && dateCreated === selectedDate) {
          latestAttendanceData = { presentCount, totalRecords };
        } else if (!selectedDate && !latestAttendanceData) {
          latestAttendanceData = { presentCount, totalRecords };
        }
      });

      completedBtn.disabled = hasZeroAttendance;
      console.log(`Completed button disabled: ${hasZeroAttendance}`);

      if (latestAttendanceData) {
        const { presentCount, totalRecords } = latestAttendanceData;
        const attendanceSummary =
          presentCount === 0 ? "0" : `${presentCount}/${totalRecords}`;
        sessionStorage.setItem("totalAttendanceRecords", attendanceSummary);
        console.log(`totalAttendanceRecords set to: ${attendanceSummary}`);
      }
    }
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    document.getElementById("attendanceTableBody").innerHTML = `
      <tr><td colspan="3">Error loading attendance data.</td></tr>
    `;
  }
}

// Function to add a new day to Firestore and update the table
async function addNewDay(
  projectId,
  cropType,
  cropName,
  projectTaskId,
  subtaskName
) {
  try {
    if (
      !projectId ||
      !cropType ||
      !cropName ||
      !projectTaskId ||
      !subtaskName
    ) {
      throw new Error("Missing required sessionStorage values");
    }

    // Query to find the matching document
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", projectId),
      where("crop_type_name", "==", cropType),
      where("crop_name", "==", cropName),
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("No matching task found in tb_project_task");
    }

    // Assume the first matching document
    const taskDoc = querySnapshot.docs[0];
    const taskId = taskDoc.id;
    console.log("Found matching task with ID:", taskId);

    // Use current date for date_created field
    const currentDate = new Date().toISOString().split("T")[0];
    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const todayQuery = query(
      attendanceRef,
      where("date_created", "==", currentDate),
      where("subtask_name", "==", subtaskName)
    );
    const todaySnapshot = await getDocs(todayQuery);

    if (!todaySnapshot.empty) {
      console.log(
        "Attendance record for today already exists:",
        todaySnapshot.docs[0].id
      );
      alert(
        "A record for today already exists. No new record will be created."
      );
      return;
    }

    const newAttendanceRef = doc(attendanceRef);
    await setDoc(newAttendanceRef, {
      farmers: [],
      date_created: currentDate,
      project_id: projectId,
      project_task_id: Number(projectTaskId),
      subtask_name: subtaskName,
      crop_type_name: cropType,
      crop_name: cropName,
    });

    console.log(
      `Added new day with UID: ${newAttendanceRef.id} under task ID: ${taskId}`
    );

    // Refresh the table to show the new day
    await fetchAttendanceData(
      projectId,
      cropType,
      cropName,
      projectTaskId,
      subtaskName
    );

    alert(
      `New day (${currentDate}) added successfully! Click the view icon to add attendance details.`
    );
  } catch (error) {
    console.error("Error adding new day:", error);
    alert("Error adding new day: " + error.message);
  }
}

// Function to show delete confirmation modal and return a Promise
function confirmDeleteModal(dateCreated) {
  return new Promise((resolve) => {
    const modal = document.getElementById("deleteConfirmationModal");
    const message = document.getElementById("deleteModalMessage");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");

    message.textContent = `Are you sure you want to delete the attendance record for ${dateCreated}?`;
    modal.style.display = "block";

    confirmBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };

    cancelBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
  });
}

// Function to delete an attendance record from Firestore with modal confirmation
async function deleteAttendanceRecord(
  projectId,
  cropType,
  cropName,
  projectTaskId,
  subtaskName,
  dateCreated
) {
  try {
    if (
      !projectId ||
      !cropType ||
      !cropName ||
      !projectTaskId ||
      !subtaskName ||
      !dateCreated
    ) {
      throw new Error("Missing required parameters for deletion");
    }

    const confirmed = await confirmDeleteModal(dateCreated);
    if (!confirmed) {
      console.log("Deletion canceled by user.");
      return;
    }

    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", projectId),
      where("crop_type_name", "==", cropType),
      where("crop_name", "==", cropName),
      where("project_task_id", "==", Number(projectTaskId))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("No matching task found in tb_project_task");
    }

    const taskDoc = querySnapshot.docs[0];
    const taskId = taskDoc.id;
    console.log("Found matching task with ID:", taskId);

    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const deleteQuery = query(
      attendanceRef,
      where("subtask_name", "==", subtaskName),
      where("date_created", "==", dateCreated)
    );
    const deleteSnapshot = await getDocs(deleteQuery);

    if (deleteSnapshot.empty) {
      console.error("No matching attendance record found to delete.");
      alert("No attendance record found for this date.");
      return;
    }

    const docToDelete = deleteSnapshot.docs[0];
    await deleteDoc(
      doc(db, "tb_project_task", taskId, "Attendance", docToDelete.id)
    );
    console.log(
      `Deleted attendance record with ID: ${docToDelete.id} for date: ${dateCreated}`
    );
    alert(`Attendance record for ${dateCreated} deleted successfully!`);
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    alert("Error deleting attendance record: " + error.message);
  }
}

initializeSubtaskDetailsPage();
