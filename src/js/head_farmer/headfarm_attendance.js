import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
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

    // Fetch farmers and attendance data for the project
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

// Function to fetch farmers from tb_projects and attendance from tb_project_task
async function fetchFarmers(projectId) {
  try {
    // Fetch farmers from tb_projects
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

      // Fetch attendance data from tb_project_task
      const projectTaskId = sessionStorage.getItem("project_task_id");
      const taskName = sessionStorage.getItem("selected_task_name");
      const selectedProjectId = sessionStorage.getItem("selected_project_id");
      const selectedDate = sessionStorage.getItem("selected_date");

      let attendanceData = [];
      let attendanceDocId = null;
      if (projectTaskId && taskName && selectedProjectId && selectedDate) {
        const projectTaskCollectionRef = collection(db, "tb_project_task");
        const taskQuery = query(
          projectTaskCollectionRef,
          where("project_id", "==", selectedProjectId),
          where("project_task_id", "==", Number(projectTaskId)),
          where("task_name", "==", taskName)
        );
        const taskSnapshot = await getDocs(taskQuery);

        if (!taskSnapshot.empty) {
          const projectTaskDoc = taskSnapshot.docs[0];
          const projectTaskRef = doc(db, "tb_project_task", projectTaskDoc.id);
          const attendanceCollectionRef = collection(
            projectTaskRef,
            "Attendance"
          );
          const attendanceQuery = query(
            attendanceCollectionRef,
            where("date_created", "==", selectedDate)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);

          if (!attendanceSnapshot.empty) {
            const attendanceDoc = attendanceSnapshot.docs[0];
            attendanceDocId = attendanceDoc.id;
            attendanceData = attendanceDoc.data().farmers || [];
            console.log("Fetched attendance data:", attendanceData);
            sessionStorage.setItem("attendance_doc_id", attendanceDocId); // Store the UID
          }
        }
      }

      const tbody = document.querySelector("tbody");
      tbody.innerHTML = ""; // Clear existing rows

      if (farmerNames.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No farmers found for this project.</td></tr>`;
      } else {
        farmerNames.forEach((name, index) => {
          // Find matching attendance data for this farmer
          const farmerAttendance =
            attendanceData.find((entry) => entry.farmer_name === name) || {};
          const isChecked = farmerAttendance.present || false;
          const remarkValue = farmerAttendance.remarks || "productive"; // Default to "productive" if no remark

          const row = `
            <tr>
              <td><input type="checkbox" class="attendance-checkbox" data-index="${index}" ${
            isChecked ? "checked" : ""
          }></td>
              <td>${name || "Unknown Farmer"}</td>
              <td>Farmer</td> <!-- Default role -->
              <td>${
                selectedDate || "No Date"
              }</td> <!-- Display the selected date -->
              <td>
                <select class="remarks-select" data-index="${index}" required>
                  <option value="productive" ${
                    remarkValue === "productive" ? "selected" : ""
                  } style="color: #28a745;">Productive</option>
                  <option value="average" ${
                    remarkValue === "average" ? "selected" : ""
                  }>Average</option>
                  <option value="needs-improvement" ${
                    remarkValue === "needs-improvement" ? "selected" : ""
                  } style="color: #dc3545;">Needs improvement</option>
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
    console.error("Error fetching farmers or attendance:", error);
    document.querySelector(
      "tbody"
    ).innerHTML = `<tr><td colspan="5">Error loading farmers.</td></tr>`;
  }
}

// Function to save attendance data
async function saveAttendance(projectId) {
  try {
    const checkboxes = document.querySelectorAll(".attendance-checkbox");
    const remarks = document.querySelectorAll(".remarks-select");

    // Check if all remarks are selected
    for (const remark of remarks) {
      if (!remark.value) {
        alert("Please select a remark for all farmers.");
        return;
      }
    }

    const attendanceData = [];
    const checkedFarmers = []; // Array to store farmer data with remarks and date
    const selectedDate =
      sessionStorage.getItem("selected_date") ||
      new Date().toISOString().split("T")[0];

    checkboxes.forEach((checkbox, index) => {
      const farmerName = document.querySelector(
        `tbody tr:nth-child(${index + 1}) td:nth-child(2)`
      ).textContent;
      const remarkValue = remarks[index].value;

      const farmerAttendance = {
        farmer_name: farmerName,
        present: checkbox.checked,
        date: selectedDate,
        remarks: remarkValue,
      };
      attendanceData.push(farmerAttendance);

      // If checkbox is checked, add farmer data to checkedFarmers
      if (checkbox.checked) {
        checkedFarmers.push({
          farmer_name: farmerName,
          date: selectedDate,
          remarks: remarkValue,
        });
      }
    });

    // Save to tb_attendance collection
    await addDoc(collection(db, "tb_attendance"), {
      project_id: Number(projectId),
      attendance: attendanceData,
    });

    // Retrieve sessionStorage values
    const projectTaskId = sessionStorage.getItem("project_task_id");
    const taskName = sessionStorage.getItem("selected_task_name");
    const selectedProjectId = sessionStorage.getItem("selected_project_id");
    const attendanceDocId = sessionStorage.getItem("attendance_doc_id");

    console.log("SessionStorage Values:");
    console.log("selected_project_id:", selectedProjectId);
    console.log("project_task_id:", projectTaskId);
    console.log("selected_task_name:", taskName);
    console.log("selected_date:", selectedDate);
    console.log("attendance_doc_id:", attendanceDocId);

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
      where("project_id", "==", selectedProjectId),
      where("project_task_id", "==", Number(projectTaskId)),
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
      let attendanceDocRef;

      if (attendanceDocId) {
        // Use existing document ID if available
        attendanceDocRef = doc(attendanceSubcollectionRef, attendanceDocId);
      } else {
        // Create a new document with auto-generated UID
        attendanceDocRef = doc(attendanceSubcollectionRef);
      }

      // Fetch existing data to merge
      const attendanceDocSnapshot = await getDoc(attendanceDocRef);
      let existingFarmers = [];
      if (attendanceDocSnapshot.exists()) {
        existingFarmers = attendanceDocSnapshot.data().farmers || [];
      }

      // Merge new farmers with existing ones, avoiding duplicates based on farmer_name
      const mergedFarmers = [...existingFarmers];
      checkedFarmers.forEach((newFarmer) => {
        const exists = mergedFarmers.some(
          (existing) => existing.farmer_name === newFarmer.farmer_name
        );
        if (!exists) {
          mergedFarmers.push(newFarmer);
        } else {
          // Update existing farmer's data
          const index = mergedFarmers.findIndex(
            (existing) => existing.farmer_name === newFarmer.farmer_name
          );
          mergedFarmers[index] = newFarmer; // Update with new remarks
        }
      });

      // Save or update the document with date_created
      await setDoc(
        attendanceDocRef,
        {
          farmers: mergedFarmers,
          date_created: selectedDate,
        },
        { merge: true }
      );

      // Store the attendance document ID in sessionStorage if it's a new document
      if (!attendanceDocId) {
        sessionStorage.setItem("attendance_doc_id", attendanceDocRef.id);
      }

      console.log("Attendance saved/updated with UID:", attendanceDocRef.id);
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
    alert("Error saving attendance or task data: " + error.message);
  }
}

// Initialize the page
initializeAttendancePage();
