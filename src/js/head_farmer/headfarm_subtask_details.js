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
    const subtaskName =
      sessionStorage.getItem("subtask_name") || "Unnamed Subtask";
    const projectId = sessionStorage.getItem("selected_project_id");
    const cropType = sessionStorage.getItem("selected_crop_type");
    const cropName = sessionStorage.getItem("selected_crop_name");
    const projectTaskId = sessionStorage.getItem("project_task_id");

    console.log("Retrieved from sessionStorage:", {
      subtaskName,
      projectId,
      cropType,
      cropName,
      projectTaskId,
    });

    const taskNameElement = document.getElementById("taskName");
    if (taskNameElement) {
      taskNameElement.textContent = subtaskName;
    } else {
      console.error("Element with ID 'taskName' not found.");
    }

    const backButton = document.querySelector(".back-btn");
    if (backButton) {
      backButton.addEventListener("click", () => {
        window.location.href = "headfarm_subtask.html";
      });
    }

    const addDayBtn = document.querySelector(".add-day-btn");
    const completeBtn = document.querySelector(".completed-btn");

    if (addDayBtn) {
      addDayBtn.addEventListener("click", async () => {
        await addNewDay(
          projectId,
          cropType,
          cropName,
          projectTaskId,
          subtaskName
        );
      });
    }

    if (completeBtn) {
      completeBtn.addEventListener("click", async () => {
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

            console.log(
              "Task query executed. Number of documents found:",
              taskSnapshot.size
            );

            if (!taskSnapshot.empty) {
              const taskDoc = taskSnapshot.docs[0];
              const taskId = taskDoc.id;
              const taskData = taskDoc.data();
              const subtasks = taskData.subtasks || [];

              console.log("Current task data:", taskData);
              console.log("Subtasks array before update:", subtasks);

              const subtaskIndex = subtasks.findIndex(
                (subtask) => subtask.subtask_name === subtaskName
              );

              if (subtaskIndex === -1) {
                console.error(
                  "Subtask not found in the task document:",
                  subtaskName
                );
                alert("Error: Subtask not found in the task");
                return;
              }

              const currentDate = new Date().toISOString().split("T")[0];
              subtasks[subtaskIndex].status = "Completed";
              subtasks[subtaskIndex].end_date = currentDate;

              await updateDoc(doc(db, "tb_project_task", taskId), {
                subtasks: subtasks,
              });

              // Store subtask_status in sessionStorage as "Completed"
              sessionStorage.setItem("subtask_status", "Completed");

              console.log("Subtasks array after update:", subtasks);
              console.log(
                `Database updated: Status set to "Completed" for subtask: ${subtaskName} in tb_project_task/${taskId}`
              );
              console.log(
                "subtask_status stored in sessionStorage:",
                sessionStorage.getItem("subtask_status")
              );
              alert("Subtask marked as Completed and saved to database!");
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
              alert("Error: Could not find matching task");
            }
          } catch (error) {
            console.error("Error updating subtask status in database:", error);
            alert("Error marking subtask as completed: " + error.message);
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
    // Set subtask_status to match the database status
    let subtask_status = subtask ? subtask.status || "Pending" : "Pending";

    // Log initial subtask_status
    console.log(
      "Current value of subtask_status before update:",
      subtask_status
    );

    // Set to "Ongoing" if there are attendance records and not "Completed"
    if (!attendanceSnapshot.empty && subtask_status !== "Completed") {
      const subtaskIndex = subtasks.findIndex(
        (st) => st.subtask_name === subtaskName
      );
      if (subtaskIndex !== -1) {
        subtasks[subtaskIndex].status = "Ongoing";
        await updateDoc(doc(db, "tb_project_task", taskId), {
          subtasks: subtasks,
        });
        subtask_status = "Ongoing"; // Update local variable
        sessionStorage.setItem("subtask_status", "Ongoing"); // Sync to sessionStorage
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
      // If no attendance records, ensure subtask_status is "Pending" if not "Completed"
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

      completedBtn.disabled =
        hasZeroAttendance || currentStatus === "Completed";
      console.log(
        `Completed button disabled: ${
          hasZeroAttendance || currentStatus === "Completed"
        }`
      );
      console.log(`Add Day button remains enabled for click detection`);

      if (latestAttendanceData) {
        const { presentCount, totalRecords } = latestAttendanceData;
        const attendanceSummary =
          presentCount === 0 ? "0" : `${presentCount}/${totalRecords}`;
        sessionStorage.setItem("totalAttendanceRecords", attendanceSummary);
        console.log(`totalAttendanceRecords set to: ${attendanceSummary}`);
      }
    }

    // Log final subtask_status
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
      alert(
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
      start_date: currentDate,
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
      await updateDoc(doc(db, "tb_project_task", taskId), {
        subtasks: subtasks,
      });
      sessionStorage.setItem("subtask_status", "Ongoing"); // Sync to sessionStorage
      console.log(
        `Database updated: Status set to "Ongoing" and start_date set to "${currentDate}" for subtask: ${subtaskName}`
      );
      console.log(
        "subtask_status stored in sessionStorage:",
        sessionStorage.getItem("subtask_status")
      );
    }

    console.log(
      `Added new day with UID: ${newAttendanceRef.id} under task ID: ${taskId}, saved to database`
    );

    await fetchAttendanceData(
      projectId,
      cropType,
      cropName,
      projectTaskId,
      subtaskName
    );

    alert(
      `New day (${currentDate}) added successfully and saved to database! Click the view icon to add attendance details.`
    );
  } catch (error) {
    console.error("Error adding new day to database:", error);
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
      alert(
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
      `Deleted attendance record with ID: ${docToDelete.id} for date: ${dateCreated} from database`
    );
    alert(
      `Attendance record for ${dateCreated} deleted successfully from database!`
    );

    const remainingQuery = query(
      attendanceRef,
      where("subtask_name", "==", subtaskName)
    );
    const remainingSnapshot = await getDocs(remainingQuery);
    const subtaskIndex = subtasks.findIndex(
      (st) => st.subtask_name === subtaskName
    );
    if (subtaskIndex !== -1 && subtasks[subtaskIndex].status !== "Completed") {
      if (remainingSnapshot.empty) {
        subtasks[subtaskIndex].status = "Pending";
        subtasks[subtaskIndex].start_date = null;
        subtasks[subtaskIndex].end_date = null;
        await updateDoc(doc(db, "tb_project_task", taskId), {
          subtasks: subtasks,
        });
        sessionStorage.setItem("subtask_status", "Pending"); // Sync to sessionStorage
        console.log(
          `Database updated: Status set to "Pending" and dates reset for subtask: ${subtaskName} due to no remaining records`
        );
        console.log(
          "subtask_status stored in sessionStorage:",
          sessionStorage.getItem("subtask_status")
        );
      }
    } else if (subtasks[subtaskIndex].status === "Completed") {
      console.log(
        `Subtask ${subtaskName} remains Completed; no status change allowed`
      );
    }
  } catch (error) {
    console.error("Error deleting attendance record from database:", error);
    alert("Error deleting attendance record: " + error.message);
  }
}

initializeSubtaskDetailsPage();
