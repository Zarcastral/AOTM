import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
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

      // Store crop_type_name and crop_name in sessionStorage
      sessionStorage.setItem(
        "crop_type_name",
        projectData.crop_type_name || "Kape"
      );
      sessionStorage.setItem(
        "crop_name",
        projectData.crop_name || "Highland Vegetables"
      );

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
    const checkedFarmers = []; // Array to store names of farmers who are checked
    checkboxes.forEach((checkbox, index) => {
      const farmerName = document.querySelector(
        `tbody tr:nth-child(${index + 1}) td:nth-child(2)`
      ).textContent;
      const farmerAttendance = {
        farmer_name: farmerName,
        present: checkbox.checked,
        date: dates[index].value || new Date().toISOString().split("T")[0], // Default to today if empty
        remarks: remarks[index].value,
      };
      attendanceData.push(farmerAttendance);

      // If checkbox is checked, add farmer name to checkedFarmers array
      if (checkbox.checked) {
        checkedFarmers.push(farmerName);
      }
    });

    // Save to tb_attendance collection
    await addDoc(collection(db, "tb_attendance"), {
      project_id: Number(projectId),
      attendance: attendanceData,
      timestamp: new Date().toISOString(),
    });

    // Retrieve and log sessionStorage values for debugging
    const projectTaskId = sessionStorage.getItem("project_task_id");
    const taskName = sessionStorage.getItem("selected_task_name");
    const selectedProjectId = sessionStorage.getItem("selected_project_id");
    const selectedDate =
      sessionStorage.getItem("selected_date") ||
      new Date().toISOString().split("T")[0];

    console.log("SessionStorage values 0 Values:");
    console.log("selected_project_id:", selectedProjectId);
    console.log("project_task_id:", projectTaskId);
    console.log("selected_task_name:", taskName);
    console.log("selected_date:", selectedDate);

    if (!projectTaskId || !taskName || !selectedProjectId || !selectedDate) {
      console.warn("Missing sessionStorage values for tb_project_task save.");
      alert(
        "Missing required session data. Attendance saved, but task data incomplete."
      );
      return;
    }

    // Reference to the tb_project_task collection
    const projectTaskCollectionRef = collection(db, "tb_project_task");

    // Query to find the correct document
    const taskQuery = query(
      projectTaskCollectionRef,
      where("project_id", "==", selectedProjectId), // String type from sessionStorage
      where("project_task_id", "==", Number(projectTaskId)), // Number type to match DB
      where("task_name", "==", taskName)
    );
    const querySnapshot = await getDocs(taskQuery);

    console.log("Query results:", querySnapshot.size, "documents found");
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        console.log("Matching document data:", doc.data());
      });
    }

    if (!querySnapshot.empty) {
      // Use the first matching document
      const projectTaskDoc = querySnapshot.docs[0];
      const projectTaskRef = doc(db, "tb_project_task", projectTaskDoc.id);

      // Reference to the Attendance subcollection
      const attendanceSubcollectionRef = collection(
        projectTaskRef,
        "Attendance"
      );

      // Query to check if a document for this date already exists in the subcollection
      const dateQuery = query(
        attendanceSubcollectionRef,
        where("date", "==", selectedDate)
      );
      const dateSnapshot = await getDocs(dateQuery);

      if (!dateSnapshot.empty) {
        // If a document exists for this date, update it
        const existingDoc = dateSnapshot.docs[0];
        const existingFarmers = existingDoc.data().farmers || [];
        const updatedFarmers = [
          ...new Set([...existingFarmers, ...checkedFarmers]),
        ]; // Merge and remove duplicates

        await updateDoc(doc(attendanceSubcollectionRef, existingDoc.id), {
          farmers: updatedFarmers,
          timestamp: new Date().toISOString(),
        });
        console.log("Updated existing attendance for date:", selectedDate);
      } else {
        // If no document exists, create a new one in the subcollection
        await addDoc(attendanceSubcollectionRef, {
          date: selectedDate,
          farmers: checkedFarmers,
          timestamp: new Date().toISOString(),
        });
        console.log("Created new attendance record for date:", selectedDate);
      }
    } else {
      console.error(
        "No matching tb_project_task document found for the given criteria."
      );
      alert(
        "No matching project task found. Attendance saved to tb_attendance only."
      );
      return;
    }

    console.log("Attendance data saved:", attendanceData);
    alert("Attendance and task data saved successfully!");
  } catch (error) {
    console.error("Error saving attendance or task data:", error);
    alert("Error saving attendance or task data.");
  }
}

// Initialize the page
initializeAttendancePage();
