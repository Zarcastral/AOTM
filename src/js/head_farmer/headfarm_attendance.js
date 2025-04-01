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
import app from "../../../src/config/firebase_config.js";

// Initialize Firestore
const db = getFirestore(app);

// Utility function to check if current date is past end_date
function isPastEndDate(endDate) {
  const currentDate = new Date();
  const projectEndDate = new Date(endDate);
  return currentDate > projectEndDate;
}

// Function to filter farmers based on search term
function filterFarmers(farmerNames, farmerIds, attendanceData, searchTerm) {
  const filteredResults = [];
  farmerNames.forEach((name, index) => {
    if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
      const farmerAttendance =
        attendanceData.find((entry) => entry.farmer_name === name) || {};
      filteredResults.push({
        name,
        id: farmerIds[index],
        attendance: farmerAttendance,
      });
    }
  });
  return filteredResults;
}

// Function to render the table
function renderTable(filteredFarmers, selectedDate) {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";

  if (filteredFarmers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No record is found</td></tr>`;
    return;
  }

  const sessionedDate = sessionStorage.getItem("selected_date");

  filteredFarmers.forEach((farmer, index) => {
    const isChecked = farmer.attendance.present === "Yes";
    const remarkValue = farmer.attendance.remarks || "";
    const farmerDate =
      farmer.attendance && farmer.attendance.date
        ? farmer.attendance.date
        : new Date().toISOString().split("T")[0];
    const isDateDifferent = farmerDate !== sessionedDate;
    const dateStyle = isDateDifferent ? 'style="color: red;"' : "";

    const capitalizedRemark = remarkValue
      ? remarkValue.charAt(0).toUpperCase() + remarkValue.slice(1).toLowerCase()
      : "";

    const row = `
      <tr>
        <td><input type="checkbox" class="attendance-checkbox" data-index="${index}" ${
      isChecked ? "checked" : ""
    }></td>
        <td>${farmer.name || "Unknown Farmer"}</td>
        <td>Farmer</td>
        <td ${dateStyle}>${farmerDate}</td>
        <td>
          <select class="remarks-select" data-index="${index}" required>
            <option value="" ${
              !remarkValue ? "selected" : ""
            }>Select remark</option>
            <option value="productive" ${
              capitalizedRemark === "Productive" ? "selected" : ""
            } style="color: #28a745;">Productive</option>
            <option value="average" ${
              capitalizedRemark === "Average" ? "selected" : ""
            }>Average</option>
            <option value="needs-improvement" ${
              capitalizedRemark === "Needs-improvement" ? "selected" : ""
            } style="color: #dc3545;">Needs improvement</option>
          </select>
        </td>
        <td style="display: none;">${farmer.id}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// Function to fetch farmers and set up search
async function fetchFarmers(projectId) {
  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(projectsRef, where("project_id", "==", Number(projectId)));
    const querySnapshot = await getDocs(q);

    let farmerNames = [];
    let farmerIds = [];
    let attendanceData = [];
    const selectedDate = sessionStorage.getItem("selected_date");
    const subtaskName = sessionStorage.getItem("subtask_name");

    if (!querySnapshot.empty) {
      const projectDoc = querySnapshot.docs[0];
      const projectData = projectDoc.data();
      console.log("Raw project data:", projectData);

      const farmers = projectData.farmer_name || [];
      farmerNames = farmers.map(
        (farmer) => farmer.farmer_name || "Unknown Farmer"
      );
      farmerIds = farmers.map((farmer) => farmer.farmer_id || "Unknown ID");

      sessionStorage.setItem(
        "crop_type_name",
        projectData.crop_type_name || "Kape"
      );
      sessionStorage.setItem(
        "crop_name",
        projectData.crop_name || "Highland Vegetables"
      );

      const projectTaskId = sessionStorage.getItem("project_task_id");
      const taskName = sessionStorage.getItem("selected_task_name");
      const selectedProjectId = sessionStorage.getItem("selected_project_id");

      if (
        projectTaskId &&
        taskName &&
        selectedProjectId &&
        selectedDate &&
        subtaskName
      ) {
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

          // Query attendance with both date_created and subtask_name
          const attendanceQuery = query(
            attendanceCollectionRef,
            where("date_created", "==", selectedDate),
            where("subtask_name", "==", subtaskName)
          );
          const attendanceSnapshot = await getDocs(attendanceQuery);

          console.log(
            `Fetching attendance for subtask: ${subtaskName}, date: ${selectedDate}. Records found:`,
            attendanceSnapshot.size
          );

          if (!attendanceSnapshot.empty) {
            const attendanceDoc = attendanceSnapshot.docs[0];
            sessionStorage.setItem("attendance_doc_id", attendanceDoc.id);
            attendanceData = attendanceDoc.data().farmers || [];
            console.log(
              `Fetched attendance data for ${subtaskName}:`,
              attendanceData
            );

            // Calculate present count and total records
            const presentCount = attendanceData.filter(
              (farmer) => farmer.present === "Yes"
            ).length;
            const totalRecords = attendanceData.length;
            const attendanceSummary =
              presentCount === 0 ? "0" : `${presentCount}/${totalRecords}`;
            sessionStorage.setItem("totalAttendanceRecords", attendanceSummary);
            console.log(
              `Attendance summary for ${subtaskName} on ${selectedDate}: ${attendanceSummary}`
            );
          } else {
            console.log(
              `No attendance records found for subtask: ${subtaskName} on ${selectedDate}`
            );
            sessionStorage.setItem("totalAttendanceRecords", "0");
          }
        } else {
          console.error("No matching task found in tb_project_task for:", {
            selectedProjectId,
            projectTaskId,
            taskName,
          });
        }
      } else {
        console.error(
          "Missing required sessionStorage values for attendance fetch:",
          {
            projectTaskId,
            taskName,
            selectedProjectId,
            selectedDate,
            subtaskName,
          }
        );
      }

      const initialFilteredFarmers = filterFarmers(
        farmerNames,
        farmerIds,
        attendanceData,
        ""
      );
      renderTable(initialFilteredFarmers, selectedDate);

      const searchInput = document.querySelector(".search-bar input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const searchTerm = e.target.value;
          const filteredFarmers = filterFarmers(
            farmerNames,
            farmerIds,
            attendanceData,
            searchTerm
          );
          renderTable(filteredFarmers, selectedDate);
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

// Function to show confirmation modal and return a Promise
function confirmSaveAttendance() {
  return new Promise((resolve) => {
    const modal = document.getElementById("saveConfirmationModal");
    const confirmBtn = document.getElementById("confirmSaveBtn");
    const cancelBtn = document.getElementById("cancelSaveBtn");

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

// Function to save attendance data with modal confirmation
async function saveAttendance(projectId) {
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    alert("Project is way past the deadline, request extension of project");
    return;
  }

  const confirmed = await confirmSaveAttendance();
  if (!confirmed) {
    console.log("Save canceled by user.");
    return;
  }

  try {
    const checkboxes = document.querySelectorAll(".attendance-checkbox");
    const remarks = document.querySelectorAll(".remarks-select");

    for (const remark of remarks) {
      if (!remark.value || remark.value === "") {
        alert("Please select a remark for all farmers.");
        return;
      }
    }

    const originalSelectedDate = sessionStorage.getItem("selected_date");
    const todayDate = new Date().toISOString().split("T")[0];
    const projectTaskId = sessionStorage.getItem("project_task_id");
    const taskName = sessionStorage.getItem("selected_task_name");
    const selectedProjectId = sessionStorage.getItem("selected_project_id");
    const attendanceDocId = sessionStorage.getItem("attendance_doc_id");
    const cropName = sessionStorage.getItem("crop_name");
    const cropTypeName = sessionStorage.getItem("crop_type_name");
    const subtaskName = sessionStorage.getItem("subtask_name") || taskName;

    console.log("Sessioned values:", {
      projectTaskId,
      taskName,
      selectedProjectId,
      attendanceDocId,
      cropName,
      cropTypeName,
      subtaskName,
      selectedDate: originalSelectedDate,
    });

    let existingAttendanceData = [];
    let projectTaskRef, attendanceSubcollectionRef, subAttendanceDocRef;

    if (
      projectTaskId &&
      taskName &&
      selectedProjectId &&
      originalSelectedDate
    ) {
      const projectTaskCollectionRef = collection(db, "tb_project_task");
      const taskQuery = query(
        projectTaskCollectionRef,
        where("project_id", "==", selectedProjectId),
        where("project_task_id", "==", Number(projectTaskId)),
        where("task_name", "==", taskName)
      );
      const querySnapshot = await getDocs(taskQuery);

      if (!querySnapshot.empty) {
        const projectTaskDoc = querySnapshot.docs[0];
        projectTaskRef = doc(db, "tb_project_task", projectTaskDoc.id);
        attendanceSubcollectionRef = collection(projectTaskRef, "Attendance");

        if (attendanceDocId) {
          subAttendanceDocRef = doc(
            attendanceSubcollectionRef,
            attendanceDocId
          );
          const attendanceDocSnapshot = await getDoc(subAttendanceDocRef);
          if (attendanceDocSnapshot.exists()) {
            existingAttendanceData = attendanceDocSnapshot.data().farmers || [];
          }
        }
      }
    }

    const updatedAttendanceData = [];
    let hasChanges = false;

    checkboxes.forEach((checkbox, index) => {
      const row = checkbox.closest("tr");
      const farmerName = row.querySelector("td:nth-child(2)").textContent;
      const farmerId = row.querySelector("td:nth-child(6)").textContent;
      const remarkValue = remarks[index].value;
      const isPresent = checkbox.checked ? "yes" : "no";

      const capitalizedPresent =
        isPresent.charAt(0).toUpperCase() + isPresent.slice(1).toLowerCase();
      const capitalizedRemark =
        remarkValue.charAt(0).toUpperCase() +
        remarkValue.slice(1).toLowerCase();

      const currentData = {
        farmer_id: farmerId,
        farmer_name: farmerName,
        present: capitalizedPresent,
        date: todayDate,
        remarks: capitalizedRemark,
      };

      const existingRecord = existingAttendanceData.find(
        (entry) => entry.farmer_name === farmerName
      );

      if (
        !existingRecord ||
        existingRecord.present !== capitalizedPresent ||
        existingRecord.remarks !== capitalizedRemark
      ) {
        updatedAttendanceData.push(currentData);
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      alert("No changes detected in attendance data.");
      return;
    }

    const mergedFarmers = existingAttendanceData.map((existing) => {
      const updated = updatedAttendanceData.find(
        (update) => update.farmer_name === existing.farmer_name
      );
      return updated || existing;
    });

    updatedAttendanceData.forEach((updated) => {
      if (!mergedFarmers.some((m) => m.farmer_name === updated.farmer_name)) {
        mergedFarmers.push(updated);
      }
    });

    const tbAttendanceData = {
      project_id: Number(projectId),
      farmers: mergedFarmers,
      date_created: originalSelectedDate || todayDate,
      task_name: taskName,
      project_task_id: Number(projectTaskId),
      subtask_name: subtaskName,
      crop_name: cropName,
      crop_type_name: cropTypeName,
    };

    let tbAttendanceDocId;
    const existingTbAttendanceRef = collection(db, "tb_attendance");
    const tbAttendanceQuery = query(
      existingTbAttendanceRef,
      where("project_id", "==", Number(projectId)),
      where("date_created", "==", originalSelectedDate || todayDate),
      where("project_task_id", "==", Number(projectTaskId)),
      where("subtask_name", "==", subtaskName)
    );
    const tbAttendanceSnapshot = await getDocs(tbAttendanceQuery);

    if (!tbAttendanceSnapshot.empty) {
      const existingDoc = tbAttendanceSnapshot.docs[0];
      tbAttendanceDocId = existingDoc.id;
      await setDoc(
        doc(db, "tb_attendance", tbAttendanceDocId),
        tbAttendanceData,
        { merge: true }
      );
    } else {
      const attendanceDocRef = await addDoc(
        collection(db, "tb_attendance"),
        tbAttendanceData
      );
      tbAttendanceDocId = attendanceDocRef.id;
    }

    console.log(
      "Attendance saved/updated to tb_attendance with ID:",
      tbAttendanceDocId
    );

    if (projectTaskId && taskName && selectedProjectId) {
      if (!projectTaskRef) {
        const projectTaskCollectionRef = collection(db, "tb_project_task");
        const taskQuery = query(
          projectTaskCollectionRef,
          where("project_id", "==", selectedProjectId),
          where("project_task_id", "==", Number(projectTaskId)),
          where("task_name", "==", taskName)
        );
        const querySnapshot = await getDocs(taskQuery);
        if (!querySnapshot.empty) {
          projectTaskRef = doc(db, "tb_project_task", querySnapshot.docs[0].id);
        }
      }

      if (projectTaskRef) {
        attendanceSubcollectionRef = collection(projectTaskRef, "Attendance");
        subAttendanceDocRef = attendanceDocId
          ? doc(attendanceSubcollectionRef, attendanceDocId)
          : doc(attendanceSubcollectionRef);

        // Save to Attendance subcollection without start_date
        await setDoc(
          subAttendanceDocRef,
          {
            farmers: mergedFarmers,
            date_created: originalSelectedDate || todayDate,
            subtask_name: subtaskName,
          },
          { merge: true }
        );

        if (!attendanceDocId) {
          sessionStorage.setItem("attendance_doc_id", subAttendanceDocRef.id);
        }

        console.log(
          "Attendance subcollection updated with UID:",
          subAttendanceDocRef.id
        );
      }
    }

    alert("Attendance data updated successfully!");
    await fetchFarmers(projectId);
  } catch (error) {
    console.error("Error saving attendance data:", error);
    alert("Error saving attendance data: " + error.message);
  }
}

// Helper function to compare arrays of farmer records
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  const normalize = (arr) =>
    arr.map(({ farmer_id, farmer_name, present, date, remarks }) => ({
      farmer_id,
      farmer_name,
      present,
      date,
      remarks,
    }));

  const aStr = JSON.stringify(normalize(a));
  const bStr = JSON.stringify(normalize(b));
  return aStr === bStr;
}

// Initialize the page
export function initializeAttendancePage() {
  document.addEventListener("DOMContentLoaded", async () => {
    const projectId = sessionStorage.getItem("selected_project_id");
    const endDate = sessionStorage.getItem("selected_project_end_date");

    if (!projectId) {
      console.error("No selected_project_id found in sessionStorage.");
      document.querySelector(
        "tbody"
      ).innerHTML = `<tr><td colspan="5">No project selected.</td></tr>`;
      return;
    }

    console.log(`Fetched end_date on attendance page: ${endDate}`); // Log end_date

    const backArrow = document.querySelector(".back-arrow");
    if (backArrow) {
      backArrow.addEventListener("click", () => {
        window.location.href = "headfarm_subtask_details.html";
      });
    }

    await fetchFarmers(projectId);

    const saveBtn = document.querySelector(".save-btn");
    if (saveBtn) {
      const subtaskStatus = sessionStorage.getItem("subtask_status");
      console.log(`Subtask status from sessionStorage: ${subtaskStatus}`);

      if (subtaskStatus === "Completed") {
        saveBtn.disabled = true;
        console.log("Save button disabled because subtask_status is Completed");
      } else {
        saveBtn.disabled = false;
        console.log("Save button enabled");
      }

      saveBtn.addEventListener("click", async () => {
        if (endDate && isPastEndDate(endDate)) {
          alert(
            "Project is way past the deadline, request extension of project"
          );
          return;
        }
        await saveAttendance(projectId);
      });
    } else {
      console.error("Save button not found in the DOM.");
    }
  });
}

initializeAttendancePage();
