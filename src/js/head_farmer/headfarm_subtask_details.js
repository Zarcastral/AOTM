// headfarm_subtask_details.js
import {
  collection,
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

// Function to initialize the subtask details page
export function initializeSubtaskDetailsPage() {
  document.addEventListener("DOMContentLoaded", async () => {
    // Retrieve data from sessionStorage
    const subtaskName =
      sessionStorage.getItem("subtask_name") || "Unnamed Subtask";
    const projectId = sessionStorage.getItem("selected_project_id"); // e.g., "118"
    const cropType = sessionStorage.getItem("selected_crop_type"); // e.g., "Kape"
    const cropName = sessionStorage.getItem("selected_crop_name"); // e.g., "Highland Vegetables"
    const projectTaskId = sessionStorage.getItem("project_task_id"); // e.g., "35"

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
        addNewDay(projectId, cropType, cropName, projectTaskId);
      });
    }

    // Fetch and display attendance data initially
    if (projectId && cropType && cropName && projectTaskId) {
      await fetchAttendanceData(projectId, cropType, cropName, projectTaskId);
    } else {
      console.error("Missing required sessionStorage values.");
      document.getElementById("attendanceTableBody").innerHTML = `
        <tr><td colspan="3">No project/task details selected.</td></tr>
      `;
    }

    // Navigate to headfarm_attendance.html when the eye icon is clicked
    document.addEventListener("click", (event) => {
      if (event.target.matches(".action-icons img[alt='View']")) {
        const date = event.target
          .closest("tr")
          .querySelector("td:first-child").textContent;
        sessionStorage.setItem("selected_date", date);
        window.location.href = "headfarm_attendance.html";
      }
    });
  });
}

// Function to fetch attendance data from Firestore
async function fetchAttendanceData(
  projectId,
  cropType,
  cropName,
  projectTaskId
) {
  try {
    // Query to find the matching document
    const tasksRef = collection(db, "tb_project_task");
    const q = query(
      tasksRef,
      where("project_id", "==", projectId),
      where("crop_type_name", "==", cropType),
      where("crop_name", "==", cropName),
      where("project_task_id", "==", Number(projectTaskId)) // Convert to number since it's stored as a number
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
    const taskId = taskDoc.id; // Get the document ID
    console.log("Found matching task with ID:", taskId);

    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const attendanceSnapshot = await getDocs(attendanceRef);

    const tbody = document.getElementById("attendanceTableBody");
    tbody.innerHTML = ""; // Clear existing rows

    console.log("Fetching attendance for task ID:", taskId);
    console.log("Number of attendance records found:", attendanceSnapshot.size);

    if (attendanceSnapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="3">No attendance records found.</td></tr>`;
    } else {
      attendanceSnapshot.forEach((doc) => {
        const date = doc.id; // Date is the document ID (e.g., "2025-03-26")
        const data = doc.data();
        const farmers = data.farmers || [];
        const presentCount = farmers.filter((farmer) => farmer.present).length;

        console.log(`Date: ${date}, Farmers:`, farmers);

        const row = `
          <tr>
            <td>${date}</td>
            <td>${presentCount}</td>
            <td class="action-icons">
              <img src="../../images/eye.png" alt="View">
              <img src="../../images/Delete.png" alt="Delete">
            </td>
          </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
      });
    }
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    document.getElementById("attendanceTableBody").innerHTML = `
      <tr><td colspan="3">Error loading attendance data.</td></tr>
    `;
  }
}

// Function to add a new day to Firestore and update the table
async function addNewDay(projectId, cropType, cropName, projectTaskId) {
  try {
    if (!projectId || !cropType || !cropName || !projectTaskId) {
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

    // Use current date as the document ID (e.g., "2025-03-26")
    const currentDate = new Date().toISOString().split("T")[0];

    // Reference to the specific attendance document under tb_project_task
    const attendanceRef = doc(
      db,
      "tb_project_task",
      taskId,
      "Attendance",
      currentDate
    );

    // Initial data for the new day
    await setDoc(attendanceRef, {
      farmers: [], // Empty initially
      timestamp: new Date().toISOString(),
    });

    console.log(`Added new day: ${currentDate} under task ID: ${taskId}`);

    // Refresh the table to show the new day
    await fetchAttendanceData(projectId, cropType, cropName, projectTaskId);

    alert(
      `New day (${currentDate}) added successfully! Click the view icon to add attendance details.`
    );
  } catch (error) {
    console.error("Error adding new day:", error);
    alert("Error adding new day: " + error.message);
  }
}
document.addEventListener("click", (event) => {
  if (event.target.matches(".action-icons img[alt='View']")) {
    const date = event.target
      .closest("tr")
      .querySelector("td:first-child").textContent;
    sessionStorage.setItem("selected_date", date);
    window.location.href = "headfarm_attendance.html";
  }
});

// Call the initialization function
initializeSubtaskDetailsPage();
