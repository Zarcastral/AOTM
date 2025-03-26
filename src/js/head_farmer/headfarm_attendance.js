// headfarm_attendance.js
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js"; // Adjust path as needed

// Initialize Firestore
const db = getFirestore(app);

// Function to initialize the attendance page
export function initializeAttendancePage() {
  document.addEventListener("DOMContentLoaded", async () => {
    // Retrieve project ID from sessionStorage
    const projectId = sessionStorage.getItem("selected_project_id");
    if (!projectId) {
      console.error("No selected_project_id found in sessionStorage.");
      document.querySelector(
        "tbody"
      ).innerHTML = `<tr><td colspan="5">No project selected.</td></tr>`;
      return;
    }

    // Back arrow navigation
    const backArrow = document.querySelector(".back-arrow");
    if (backArrow) {
      backArrow.addEventListener("click", () => {
        window.location.href = "headfarm_subtask_details.html";
      });
    }

    // Fetch farmers for the project
    await fetchFarmers(projectId);

    // Save button functionality
    const saveBtn = document.querySelector(".save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        saveAttendance(projectId);
      });
    }
  });
}

// Function to fetch farmers from tb_projects and populate the table
async function fetchFarmers(projectId) {
  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(projectsRef, where("project_id", "==", Number(projectId)));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const projectDoc = querySnapshot.docs[0];
      const projectData = projectDoc.data();
      const farmerNames = projectData.farmer_name || []; // Array of strings
      console.log("Farmer names fetched:", farmerNames);

      const tbody = document.querySelector("tbody");
      tbody.innerHTML = ""; // Clear existing rows

      if (farmerNames.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No farmers found for this project.</td></tr>`;
      } else {
        farmerNames.forEach((name, index) => {
          const row = `
            <tr>
              <td><input type="checkbox" class="attendance-checkbox" data-index="${index}"></td>
              <td>${name || "Unknown Farmer"}</td>
              <td>Farmer</td> <!-- Default role since no role field exists -->
              <td><input type="date" class="date-input" data-index="${index}"></td>
              <td>
                <select class="remarks-select" data-index="${index}">
                  <option value="productive" style="color: #28a745;">Productive</option>
                  <option value="average" selected>Average</option>
                  <option value="needs-improvement" style="color: #dc3545;">Needs improvement</option>
                </select>
              </td>
            </tr>
          `;
          tbody.insertAdjacentHTML("beforeend", row);
        });
      }
    } else {
      console.log("No project found with this project_id.");
      document.querySelector(
        "tbody"
      ).innerHTML = `<tr><td colspan="5">Project not found.</td></tr>`;
    }
  } catch (error) {
    console.error("Error fetching farmers:", error);
    document.querySelector(
      "tbody"
    ).innerHTML = `<tr><td colspan="5">Error loading farmers.</td></tr>`;
  }
}

// Function to save attendance data
async function saveAttendance(projectId) {
  try {
    const checkboxes = document.querySelectorAll(".attendance-checkbox");
    const dates = document.querySelectorAll(".date-input");
    const remarks = document.querySelectorAll(".remarks-select");

    const attendanceData = [];
    checkboxes.forEach((checkbox, index) => {
      const farmerName = document.querySelector(
        `tbody tr:nth-child(${index + 1}) td:nth-child(2)`
      ).textContent;
      attendanceData.push({
        farmer_name: farmerName,
        present: checkbox.checked,
        date: dates[index].value || new Date().toISOString().split("T")[0], // Default to today if empty
        remarks: remarks[index].value,
      });
    });

    // Save to Firestore (example: new 'tb_attendance' collection)
    await addDoc(collection(db, "tb_attendance"), {
      project_id: Number(projectId),
      attendance: attendanceData,
      timestamp: new Date().toISOString(),
    });

    console.log("Attendance data saved:", attendanceData);
    alert("Attendance saved successfully!");
  } catch (error) {
    console.error("Error saving attendance:", error);
    alert("Error saving attendance.");
  }
}

// Initialize the page
initializeAttendancePage();
