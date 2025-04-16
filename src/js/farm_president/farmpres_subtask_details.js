import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

// Initialize Firestore
const db = getFirestore(app);

// Function to show success panel
function showSuccessPanel(message) {
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
      document.body.removeChild(successMessage);
    }, 400);
  }, 4000);
}

// Function to show error panel
function showErrorPanel(message) {
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
      document.body.removeChild(errorMessage);
    }, 400);
  }, 4000);
}

// Utility function to check if current date is past end_date
function isPastEndDate(endDate) {
  const currentDate = new Date();
  const projectEndDate = new Date(endDate);
  return currentDate > projectEndDate;
}

// Function to show confirmation modal for completing subtask and return a Promise
function confirmCompleteSubtask() {
  return new Promise((resolve) => {
    const modal = document.getElementById("completeConfirmationModal");
    const confirmBtn = document.getElementById("confirmCompleteBtn");
    const cancelBtn = document.getElementById("cancelCompleteBtn");

    modal.style.display = "flex";

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
    const subtaskName =
      sessionStorage.getItem("subtask_name") || "Unnamed Subtask";
    const projectId = sessionStorage.getItem("selected_project_id");
    const cropType = sessionStorage.getItem("selected_crop_type");
    const cropName = sessionStorage.getItem("selected_crop_name");
    const projectTaskId = sessionStorage.getItem("project_task_id");
    const endDate = sessionStorage.getItem("selected_project_end_date");

    console.log("Retrieved from sessionStorage:", {
      subtaskName,
      projectId,
      cropType,
      cropName,
      projectTaskId,
      endDate,
    });
    console.log(`Fetched end_date on subtask details page: ${endDate}`);

    try {
      const tasksRef = collection(db, "tb_project_task");
      const taskQuery = query(
        tasksRef,
        where("project_id", "==", projectId),
        where("crop_type_name", "==", cropType),
        where("crop_name", "==", cropName),
        where("project_task_id", "==", Number(projectTaskId))
      );
      const taskSnapshot = await getDocs(taskQuery);

      if (!taskSnapshot.empty) {
        const taskDoc = taskSnapshot.docs[0];
        const taskData = taskDoc.data();
        const subtasks = taskData.subtasks || [];
        const subtask = subtasks.find((st) => st.subtask_name === subtaskName);

        const initialStatus = subtask ? subtask.status || "Pending" : "Pending";
        sessionStorage.setItem("subtask_status", initialStatus);
        console.log(
          "Initial subtask_status fetched and stored in sessionStorage:",
          sessionStorage.getItem("subtask_status")
        );
      } else {
        console.error("No matching task found to fetch initial status:", {
          projectId,
          cropType,
          cropName,
          projectTaskId,
        });
        sessionStorage.setItem("subtask_status", "Pending");
        console.log(
          "No task found; subtask_status set to 'Pending' in sessionStorage"
        );
      }
    } catch (error) {
      console.error("Error fetching initial subtask status:", error);
      sessionStorage.setItem("subtask_status", "Pending");
      console.log(
        "Error occurred; subtask_status set to 'Pending' in sessionStorage"
      );
    }

    const taskNameElement = document.getElementById("taskName");
    if (taskNameElement) {
      taskNameElement.textContent = subtaskName;
    } else {
      console.error("Element with ID 'taskName' not found.");
    }

    const backButton = document.querySelector(".back-btn");
    if (backButton) {
      backButton.addEventListener("click", () => {
        window.location.href = "farmpres_subtask.html";
      });
    }

    const addDayBtn = document.querySelector(".add-day-btn");
    const completeBtn = document.querySelector(".completed-btn");
    const farmerId = sessionStorage.getItem("farmer_id");
    const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
    const isLeadFarmer = String(farmerId) === String(leadFarmerId);

    // Enable addDayBtn only if user is the lead farmer
    if (addDayBtn) {
      if (!isLeadFarmer) {
        addDayBtn.disabled = true;
        addDayBtn.style.opacity = "0.5";
        addDayBtn.style.cursor = "not-allowed";
      } else {
        addDayBtn.disabled = false;
        addDayBtn.style.opacity = "1";
        addDayBtn.style.cursor = "pointer";
        addDayBtn.addEventListener("click", async () => {
          if (endDate && isPastEndDate(endDate)) {
            showErrorPanel(
              "Project is way past the deadline, request extension of project"
            );
            return;
          }
          await addNewDay(
            projectId,
            cropType,
            cropName,
            projectTaskId,
            subtaskName
          );
        });
      }
    }

    if (completeBtn) {
      completeBtn.addEventListener("click", async () => {
        if (endDate && isPastEndDate(endDate)) {
          showErrorPanel(
            "Project is way past the deadline, request extension of project"
          );
          return;
        }
        const confirmed = await confirmCompleteSubtask();
        if (confirmed) {
          try {
            const tasksRef = collection(db, "tb_project_task");
            const taskQuery = query(
              tasksRef,
              where("project_id", "==", projectId),
              where("crop_type_name", "==", cropType),
              where("crop_name", "==", cropName),
              where("project_task_id", "==", Number(projectTaskId))
            );
            const taskSnapshot = await getDocs(taskQuery);

            if (!taskSnapshot.empty) {
              const taskDoc = taskSnapshot.docs[0];
              const taskId = taskDoc.id;
              const taskData = taskDoc.data();
              const subtasks = taskData.subtasks || [];

              const subtaskIndex = subtasks.findIndex(
                (subtask) => subtask.subtask_name === subtaskName
              );

              if (subtaskIndex === -1) {
                console.error(
                  "Subtask not found in the task document:",
                  subtaskName
                );
                showErrorPanel("Error: Subtask not found in the task");
                return;
              }

              const currentDate = new Date().toISOString().split("T")[0];
              subtasks[subtaskIndex].status = "Completed";
              subtasks[subtaskIndex].end_date = currentDate;

              await updateDoc(doc(db, "tb_project_task", taskId), {
                subtasks: subtasks,
              });

              sessionStorage.setItem("subtask_status", "Completed");
              console.log(
                "subtask_status updated in sessionStorage:",
                sessionStorage.getItem("subtask_status")
              );

              console.log(
                `Database updated: Status set to "Completed" for subtask: ${subtaskName} in tb_project_task/${taskId}`
              );
              showSuccessPanel(
                "Subtask marked as Completed and saved to database!"
              );
              completeBtn.disabled = true;

              await fetchAttendanceData(
                projectId,
                cropType,
                cropName,
                projectTaskId,
                subtaskName
              );
            } else {
              console.error("No matching task found with query:", {
                projectId,
                cropType,
                cropName,
                projectTaskId,
              });
              showErrorPanel("Error: Could not find matching task");
            }
          } catch (error) {
            console.error("Error updating subtask status in database:", error);
            showErrorPanel(
              "Error marking subtask as completed: " + error.message
            );
          }
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
        window.location.href = "farmpres_attendance.html";
      } else if (event.target.matches(".action-icons img[alt='Delete']")) {
        if (endDate && isPastEndDate(endDate)) {
          showErrorPanel(
            "Project is way past the deadline, request extension of project"
          );
          return;
        }
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

    const taskDoc = querySnapshot.docs[0];
    const taskId = taskDoc.id;
    const taskData = taskDoc.data();
    const subtasks = taskData.subtasks || [];
    console.log("Found matching task with ID:", taskId);

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
    const addDayBtn = document.querySelector(".add-day-btn");
    let hasZeroAttendance = false;

    const subtask = subtasks.find((st) => st.subtask_name === subtaskName);
    let subtask_status = subtask ? subtask.status || "Pending" : "Pending";

    console.log(
      "Current value of subtask_status before update:",
      subtask_status
    );

    if (!attendanceSnapshot.empty && subtask_status !== "Completed") {
      const subtaskIndex = subtasks.findIndex(
        (st) => st.subtask_name === subtaskName
      );
      if (subtaskIndex !== -1) {
        subtasks[subtaskIndex].status = "Ongoing";
        await updateDoc(doc(db, "tb_project_task", taskId), {
          subtasks: subtasks,
        });
        subtask_status = "Ongoing";
        sessionStorage.setItem("subtask_status", "Ongoing");
        console.log(
          `Database updated: Status set to "Ongoing" for subtask: ${subtaskName} due to existing attendance records`
        );
        console.log(
          "subtask_status stored in sessionStorage:",
          sessionStorage.getItem("subtask_status")
        );
      }
    }

    if (attendanceSnapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="3">No attendance records found for subtask: ${subtaskName}.</td></tr>`;
      sessionStorage.setItem("totalAttendanceRecords", "0");
      completedBtn.disabled = true;
      if (subtask_status !== "Completed") {
        sessionStorage.setItem("subtask_status", "Pending");
        console.log(
          "subtask_status stored in sessionStorage:",
          sessionStorage.getItem("subtask_status")
        );
      }
    } else {
      const currentStatus = subtask_status;
      const selectedDate = sessionStorage.getItem("selected_date");
      let latestAttendanceData = null;

      const farmerId = sessionStorage.getItem("farmer_id");
      const leadFarmerId = sessionStorage.getItem("selected_lead_farmer_id");
      const isLeadFarmer = String(farmerId) === String(leadFarmerId);

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

        // Conditionally render the Delete button based on lead farmer status
        let deleteButton = "";
        if (isLeadFarmer) {
          deleteButton = `<img src="/images/Delete.png" alt="Delete" class="w-4 h-4 delete-icon" data-index="${doc.id}">`;
        }

        const row = `
          <tr>
            <td>${dateCreated}</td>
            <td>${attendanceSummary}</td>
            <td class="action-icons">
              <img src="/images/eye.png" alt="View">
              ${deleteButton}
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

      completedBtn.disabled =
        hasZeroAttendance || currentStatus === "Completed";
      console.log(
        `Completed button disabled: ${
          hasZeroAttendance || currentStatus === "Completed"
        }`
      );
      console.log(
        `Add Day button state managed in initializeSubtaskDetailsPage`
      );

      if (latestAttendanceData) {
        const { presentCount, totalRecords } = latestAttendanceData;
        const attendanceSummary =
          presentCount === 0 ? "0" : `${presentCount}/${totalRecords}`;
        sessionStorage.setItem("totalAttendanceRecords", attendanceSummary);
        console.log(`totalAttendanceRecords set to: ${attendanceSummary}`);
      }
    }

    console.log(`Final subtask_status after processing: ${subtask_status}`);
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
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

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
    const taskData = taskDoc.data();
    const subtasks = taskData.subtasks || [];
    console.log("Found matching task with ID:", taskId);

    const subtask = subtasks.find((st) => st.subtask_name === subtaskName);
    const subtask_status = subtask ? subtask.status || "Pending" : "Pending";

    if (subtask_status === "Completed") {
      console.log(
        `Subtask ${subtaskName} is already Completed, blocking new day addition`
      );
      showErrorPanel(
        "This subtask is already completed; adding new date records is not allowed."
      );
      return;
    }

    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const currentDate = new Date().toISOString().split("T")[0];
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
      showErrorPanel(
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

    const subtaskIndex = subtasks.findIndex(
      (st) => st.subtask_name === subtaskName
    );
    if (
      subtaskIndex !== -1 &&
      (!subtask || !subtask.status || subtask.status === "Pending")
    ) {
      subtasks[subtaskIndex].status = "Ongoing";
      subtasks[subtaskIndex].start_date = currentDate;
    }

    await updateDoc(doc(db, "tb_project_task", taskId), {
      task_status: "Ongoing",
      start_date: currentDate,
      subtasks: subtasks,
    });

    sessionStorage.setItem("subtask_status", "Ongoing");
    console.log(
      `Database updated: task_status set to "Ongoing" and start_date set to "${currentDate}" for task and subtask: ${subtaskName}`
    );

    await fetchAttendanceData(
      projectId,
      cropType,
      cropName,
      projectTaskId,
      subtaskName
    );

    showSuccessPanel(
      `New day (${currentDate}) added successfully and saved to database! Click the view icon to add attendance details.`
    );
  } catch (error) {
    console.error("Error adding new day to database:", error);
    showErrorPanel("Error adding new day: " + error.message);
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
    modal.style.display = "flex";

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
  const endDate = sessionStorage.getItem("selected_project_end_date");
  if (endDate && isPastEndDate(endDate)) {
    showErrorPanel(
      "Project is way past the deadline, request extension of project"
    );
    return;
  }

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
    const taskData = taskDoc.data();
    const subtasks = taskData.subtasks || [];
    console.log("Found matching task with ID:", taskId);

    const subtask = subtasks.find((st) => st.subtask_name === subtaskName);
    const subtask_status = subtask ? subtask.status || "Pending" : "Pending";

    if (subtask_status === "Completed") {
      showErrorPanel(
        "This subtask is already completed; deleting date records is not allowed."
      );
      return;
    }

    const confirmed = await confirmDeleteModal(dateCreated);
    if (!confirmed) {
      console.log("Deletion canceled by user.");
      return;
    }

    const attendanceRef = collection(
      db,
      "tb_project_task",
      taskId,
      "Attendance"
    );
    const deleteSubcollectionQuery = query(
      attendanceRef,
      where("subtask_name", "==", subtaskName),
      where("date_created", "==", dateCreated)
    );
    const deleteSubcollectionSnapshot = await getDocs(deleteSubcollectionQuery);

    if (deleteSubcollectionSnapshot.empty) {
      console.warn(
        "No matching attendance record found in subcollection to delete."
      );
    } else {
      const docToDelete = deleteSubcollectionSnapshot.docs[0];
      await deleteDoc(
        doc(db, "tb_project_task", taskId, "Attendance", docToDelete.id)
      );
      console.log(
        `Deleted attendance record with ID: ${docToDelete.id} for date: ${dateCreated} from Attendance subcollection`
      );
    }

    const tbAttendanceRef = collection(db, "tb_attendance");
    const deleteTbAttendanceQuery = query(
      tbAttendanceRef,
      where("project_id", "==", Number(projectId)),
      where("project_task_id", "==", Number(projectTaskId)),
      where("subtask_name", "==", subtaskName),
      where("date_created", "==", dateCreated)
    );
    const tbAttendanceSnapshot = await getDocs(deleteTbAttendanceQuery);

    if (tbAttendanceSnapshot.empty) {
      console.warn(
        "No matching attendance record found in tb_attendance to delete."
      );
    } else {
      const tbDocToDelete = tbAttendanceSnapshot.docs[0];
      await deleteDoc(doc(db, "tb_attendance", tbDocToDelete.id));
      console.log(
        `Deleted attendance record with ID: ${tbDocToDelete.id} for date: ${dateCreated} from tb_attendance`
      );
    }

    const remainingQuery = query(
      attendanceRef,
      where("subtask_name", "==", subtaskName)
    );
    const remainingSnapshot = await getDocs(remainingQuery);
    const subtaskIndex = subtasks.findIndex(
      (st) => st.subtask_name === subtaskName
    );
    const currentDate = new Date().toISOString().split("T")[0];

    if (subtaskIndex !== -1 && subtasks[subtaskIndex].status !== "Completed") {
      if (remainingSnapshot.empty) {
        subtasks[subtaskIndex].status = "Pending";
        subtasks[subtaskIndex].start_date = null;
        subtasks[subtaskIndex].end_date = null;
        await updateDoc(doc(db, "tb_project_task", taskId), {
          task_status: "Pending",
          start_date: null,
          subtasks: subtasks,
        });
        sessionStorage.setItem("subtask_status", "Pending");
        console.log(
          `Database updated: task_status set to "Pending" and start_date cleared for task and subtask ${subtaskName} due to no remaining records`
        );
      } else {
        subtasks[subtaskIndex].status = "Ongoing";
        await updateDoc(doc(db, "tb_project_task", taskId), {
          task_status: "Ongoing",
          start_date: currentDate,
          subtasks: subtasks,
        });
        sessionStorage.setItem("subtask_status", "Ongoing");
        console.log(
          `Database updated: task_status set to "Ongoing" and start_date set to "${currentDate}" for task and subtask ${subtaskName} due to remaining records`
        );
      }
    } else if (subtasks[subtaskIndex].status === "Completed") {
      console.log(
        `Subtask ${subtaskName} remains Completed; no status change allowed`
      );
    }

    showSuccessPanel(
      `Attendance record for ${dateCreated} deleted successfully from both collections!`
    );
  } catch (error) {
    console.error("Error deleting attendance record from database:", error);
    showErrorPanel("Error deleting attendance record: " + error.message);
  }
}

initializeSubtaskDetailsPage();
