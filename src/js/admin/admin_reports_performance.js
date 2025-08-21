import {
  collection,
  getDocs,
  getDoc,
  getFirestore,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
  addDoc,
  arrayRemove,
  doc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// Global variable to store authenticated user details
let currentUser = null;

// State variable for data loading
let isDataLoading = false;

// <-----------------------ACTIVITY LOG CODE----------------------------->
async function saveActivityLog(action, description) {
  const allowedActions = ["Create", "Update", "Delete"];
  
  if (!allowedActions.includes(action)) {
    console.error("Invalid action. Allowed actions are: create, update, delete.");
    return;
  }

  if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
  }

  if (!currentUser) {
    console.error("No authenticated user found.");
    return;
  }

  try {
    const userDocRef = doc(db, "tb_users", currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error("User data not found in tb_users.");
      return;
    }

    const userData = userDocSnap.data();
    const userName = userData.user_name || "Unknown User";
    const userType = userData.user_type || "Unknown Type";

    const currentTimestamp = Timestamp.now().toDate();
    const date = currentTimestamp.toLocaleDateString("en-US");
    const time = currentTimestamp.toLocaleTimeString("en-US");

    const activityLogCollection = collection(db, "tb_activity_log");

    const counterDocRef = doc(db, "tb_id_counters", "activity_log_id_counter");
    const counterDocSnap = await getDoc(counterDocRef);

    if (!counterDocSnap.exists()) {
      console.error("Counter document not found.");
      return;
    }

    let currentCounter = counterDocSnap.data().value || 0;
    let newCounter = currentCounter + 1;

    await updateDoc(counterDocRef, { value: newCounter });

    await addDoc(activityLogCollection, {
      activity_log_id: newCounter,
      username: userName,
      user_type: userType,
      activity: action,
      activity_desc: description,
      date: date,
      time: time
    });

    console.log("Activity log saved successfully with ID:", newCounter);
  } catch (error) {
    console.error("Error saving activity log:", error);
  }
}

// <---------------------------------> GLOBAL VARIABLES <--------------------------------->
let performanceList = [];      // full combined rows
let filteredPerformance = [];  // filtered view
let currentPage = 1;
const rowsPerPage = 5;
let selectedMonth = null;
let selectedYear = new Date().getFullYear();

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
  if (currentUser) return currentUser;

  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            currentUser = {
              uid: user.uid,
              email: user.email,
              user_type: userData.user_type || "Unknown",
              ...userData
            };
            if (currentUser.user_type !== "Admin") {
              console.warn("User is not an Admin, cannot fetch performance data.");
              reject("User is not an Admin.");
            } else {
              console.log("Authenticated user is Admin:", currentUser.email);
              resolve(currentUser);
            }
          } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}

// Function to manage PDF download button state
function updateDownloadButtonState() {
  const downloadBtn = document.getElementById("download-btn");
  if (downloadBtn) {
    const isDisabled = isDataLoading || filteredPerformance.length === 0;
    downloadBtn.disabled = isDisabled;
    downloadBtn.style.opacity = isDisabled ? "0.5" : "1";
    downloadBtn.style.backgroundColor = isDisabled ? "#cccccc" : "";
    downloadBtn.style.cursor = isDisabled ? "not-allowed" : "pointer";
    console.log(`Download button state: ${isDisabled ? "disabled" : "enabled"}, filteredPerformance length: ${filteredPerformance.length}`);
  }
}

/* ------------------------------
   Representative percentages for remark labels
   ------------------------------ */
const remarkRep = {
  "NEEDS_IMPROVEMENT": 10,
  "AVERAGE_PERFORMER": 30,
  "PRODUCTIVE": 50,
  "HIGHLY_EFFICIENT": 70,
  "OUTSTANDING": 90
};

function remarkLabelToRepresentativePercent(remarkLabel) {
  if (!remarkLabel) return remarkRep["NEEDS_IMPROVEMENT"];
  const normalized = String(remarkLabel).trim().toLowerCase();

  if (normalized === "needs improvement" || normalized === "needs_improvement") return remarkRep["NEEDS_IMPROVEMENT"];
  if (normalized === "average performer" || normalized === "average_performer" || normalized === "average") return remarkRep["AVERAGE_PERFORMER"];
  if (normalized === "productive") return remarkRep["PRODUCTIVE"];
  if (normalized === "highly efficient" || normalized === "highly_efficient") return remarkRep["HIGHLY_EFFICIENT"];
  if (normalized === "outstanding") return remarkRep["OUTSTANDING"];
  const numeric = parseInt(String(remarkLabel).replace("%", "").trim());
  if (!isNaN(numeric)) return numeric;
  return remarkRep["NEEDS_IMPROVEMENT"];
}

function getRemarkFromPercentage(percentage) {
  const p = Number(percentage);
  if (isNaN(p)) return "Needs Improvement";
  if (p >= 81) return "Outstanding";
  if (p >= 61) return "Highly Efficient";
  if (p >= 41) return "Productive";
  if (p >= 21) return "Average Performer";
  return "Needs Improvement";
}

// Parse date and format as "Month name, Year"
function formatDate(date) {
  if (!date) return "N/A";
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function parseDate(dateValue) {
  if (!dateValue) return null;
  return typeof dateValue.toDate === "function" ? dateValue.toDate() : new Date(dateValue);
}

// Calculate total days between start and end date
function calculateTotalDays(startDate, endDate) {
  if (!startDate || !endDate) {
    console.warn("Missing start or end date for total days calculation");
    return 0;
  }
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    console.warn("Invalid start or end date");
    return 0;
  }
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
}

/* ------------------------------
   Fetch performance data
   ------------------------------ */
async function fetchPerformance() {
  try {
    isDataLoading = true;
    updateDownloadButtonState();
    displayPerformance(filteredPerformance); // Display loading message
    console.log("Starting fetchPerformance...");

    // Ensure auth loaded and user is Admin
    await getAuthenticatedUser();
    if (!currentUser || currentUser.user_type !== "Admin") {
      console.warn("User is not authorized to fetch performance data (not Admin).");
      isDataLoading = false;
      updateDownloadButtonState();
      displayPerformance([]);
      return;
    }

    const projectsQuery = query(collection(db, "tb_projects"), where("project_creator", "==", "Admin"));
    const projectsSnap = await getDocs(projectsQuery);
    console.log(`Found ${projectsSnap.size} projects where project_creator is Admin`);

    const combinedRows = [];

    for (const projectDoc of projectsSnap.docs) {
      const projectData = projectDoc.data();
      const projectId = projectData.project_id; // Use project_id field
      const projectBarangay = projectData.barangay_name || "N/A";
      const projectName = projectData.project_name || "Unknown Project";
      const projectStartDate = projectData.start_date;
      const projectEndDate = projectData.end_date;
      const totalDays = calculateTotalDays(projectStartDate, projectEndDate);
      console.log(`Processing project: ${projectName}, project_id: ${projectId}, Total Days: ${totalDays}, Start Date: ${projectStartDate ? (projectStartDate.toDate ? projectStartDate.toDate().toISOString() : projectStartDate) : 'N/A'}`);

      // Get project tasks from top-level tb_project_task collection
      const tasksQuery = query(collection(db, "tb_project_task"), where("project_id", "==", projectId));
      console.log(`Querying tasks with project_id: ${projectId}`);
      const tasksSnap = await getDocs(tasksQuery);
      const taskDocs = tasksSnap.docs;
      console.log(`Found ${taskDocs.length} tasks for project_id ${projectId}`);

      const farmerLowerToDisplay = {};
      const farmerLowerSet = new Set();
      const attendanceByTask = {};
      let sessionIds = [];

      if (taskDocs.length > 0) {
        sessionIds = taskDocs.map(t => t.id);

        for (const taskDoc of taskDocs) {
          const taskData = taskDoc.data();
          const taskProjectTaskId = taskData.project_task_id;
          if (!taskProjectTaskId) {
            console.warn(`Task ${taskDoc.id} has no project_task_id field, skipping`);
            continue;
          }
          const taskId = taskDoc.id;
          console.log(`Processing task with ID: ${taskId}, project_id: ${projectId}, project_task_id: ${taskProjectTaskId}`);
          let attendanceSnap;
          try {
            attendanceSnap = await getDocs(query(collection(db, "tb_attendance"), where("project_task_id", "==", taskProjectTaskId)));
            console.log(`Found ${attendanceSnap.size} attendance records for task project_task_id ${taskProjectTaskId}`);
          } catch (e) {
            console.error(`Error fetching attendance for task ${taskId}:`, e);
            attendanceSnap = { docs: [] };
          }

          const entries = [];
          for (const attDoc of attendanceSnap.docs) {
            const attData = attDoc.data();
            console.log(`Attendance data for task ${taskId}:`, attData);

            // Additional checks
            const attProjectTaskId = attData.project_task_id;
            if (!attProjectTaskId) {
              console.warn(`Skipping attendance ${attDoc.id} because no project_task_id field`);
              continue;
            }
            const taskQuery = query(collection(db, "tb_project_task"), where("project_task_id", "==", attProjectTaskId));
            const taskSnap = await getDocs(taskQuery);
            if (taskSnap.empty) {
              console.warn(`Skipping attendance ${attDoc.id} because no matching project_task_id ${attProjectTaskId}`);
              continue;
            }

            const attProjectId = attData.project_id;
            if (!attProjectId) {
              console.warn(`Skipping attendance ${attDoc.id} because no project_id field`);
              continue;
            }
            const projectQuery = query(collection(db, "tb_projects"), where("project_id", "==", attProjectId));
            const projectSnap = await getDocs(projectQuery);
            if (projectSnap.empty) {
              console.warn(`Skipping attendance ${attDoc.id} because no matching project_id ${attProjectId}`);
              continue;
            }

            const farmers = attData.farmers || [];

            if (Array.isArray(farmers)) {
              farmers.forEach(f => {
                if (f && typeof f === "object") {
                  const displayName = String(f.farmer_name || f.name || "Unknown").trim();
                  const lowerName = displayName.toLowerCase();
                  const present = String(f.present || "No").trim().toLowerCase();
                  const remark = f.remarks || f.remark || f.remark_label || "Needs Improvement";
                  const barangay = f.barangay || f.barangay_name || projectBarangay || "N/A";

                  entries.push({ lowerName, displayName, present, remark, barangay });
                  farmerLowerSet.add(lowerName);
                  if (!farmerLowerToDisplay[lowerName]) {
                    farmerLowerToDisplay[lowerName] = { displayName, barangay };
                  }
                }
              });
            } else {
              console.warn(`No valid farmers array found in attendance for task ${taskId}`);
            }
          }

          attendanceByTask[taskId] = entries;
        }
      } else {
        // Fallback: Query attendance directly by project_id
        let attendanceSnap;
        try {
          attendanceSnap = await getDocs(query(collection(db, "tb_attendance"), where("project_id", "==", projectId)));
          console.log(`Found ${attendanceSnap.size} attendance records directly for project ${projectId}`);
        } catch (e) {
          console.error(`Error fetching attendance for project ${projectId}:`, e);
          attendanceSnap = { docs: [] };
        }

        if (attendanceSnap.size === 0) {
          console.warn(`No attendance found for project_id ${projectId}, skipping`);
          continue;
        }

        sessionIds = attendanceSnap.docs.map(d => d.id);

        for (const attDoc of attendanceSnap.docs) {
          const sessionId = attDoc.id;
          const attData = attDoc.data();
          console.log(`Attendance data for session ${sessionId}:`, attData);

          // Additional checks for fallback
          const attProjectTaskId = attData.project_task_id;
          if (!attProjectTaskId) {
            console.warn(`Skipping attendance ${sessionId} because no project_task_id field`);
            continue;
          }
          const taskQuery = query(collection(db, "tb_project_task"), where("project_task_id", "==", attProjectTaskId));
          const taskSnap = await getDocs(taskQuery);
          if (taskSnap.empty) {
            console.warn(`Skipping attendance ${sessionId} because no matching project_task_id ${attProjectTaskId}`);
            continue;
          }

          const attProjectId = attData.project_id;
          if (!attProjectId) {
            console.warn(`Skipping attendance ${sessionId} because no project_id field`);
            continue;
          }
          const projectQuery = query(collection(db, "tb_projects"), where("project_id", "==", attProjectId));
          const projectSnap = await getDocs(projectQuery);
          if (projectSnap.empty) {
            console.warn(`Skipping attendance ${sessionId} because no matching project_id ${attProjectId}`);
            continue;
          }

          const entries = [];
          const farmers = attData.farmers || [];

          if (Array.isArray(farmers)) {
            farmers.forEach(f => {
              if (f && typeof f === "object") {
                const displayName = String(f.farmer_name || f.name || "Unknown").trim();
                const lowerName = displayName.toLowerCase();
                const present = String(f.present || "No").trim().toLowerCase();
                const remark = f.remarks || f.remark || f.remark_label || "Needs Improvement";
                const barangay = f.barangay || f.barangay_name || projectBarangay || "N/A";

                entries.push({ lowerName, displayName, present, remark, barangay });
                farmerLowerSet.add(lowerName);
                if (!farmerLowerToDisplay[lowerName]) {
                  farmerLowerToDisplay[lowerName] = { displayName, barangay };
                }
              }
            });
          } else {
            console.warn(`No valid farmers array found in attendance for session ${sessionId}`);
          }

          attendanceByTask[sessionId] = entries;
        }
      }

      if (farmerLowerSet.size === 0) {
        console.warn(`No farmers found for project_id ${projectId}, skipping`);
        continue;
      }

      for (const lowerName of farmerLowerSet) {
        const displayInfo = farmerLowerToDisplay[lowerName] || { displayName: lowerName, barangay: projectBarangay };
        const displayName = displayInfo.displayName || lowerName;
        const farmerBarangay = displayInfo.barangay || projectBarangay;

        let presentDays = 0;
        let repPercentSum = 0;

        for (const sessionId of sessionIds) {
          const entries = attendanceByTask[sessionId] || [];
          const found = entries.find(e => e.lowerName === lowerName);
          const present = found ? found.present : "no";
          const remarkForDay = found ? found.remark : "Needs Improvement";

          if (present.toLowerCase() === "yes") {
            presentDays++;
          }

          const repPercent = remarkLabelToRepresentativePercent(remarkForDay);
          repPercentSum += repPercent;
        }

        const avgProductivity = Math.round((repPercentSum / sessionIds.length) || 0);
        const remarkCategory = getRemarkFromPercentage(avgProductivity);
        const attendance = totalDays > 0 ? `${presentDays}/${totalDays} days` : "0/0 days";

        console.log(`Farmer: ${displayName}, Present Days: ${presentDays}, Total Days: ${totalDays}, Productivity: ${avgProductivity}%`);

        combinedRows.push({
          project_id: projectId,
          project_name: projectName,
          farmer_name: displayName,
          barangay: farmerBarangay,
          present_days: presentDays,
          total_days: totalDays,
          attendance: attendance,
          productivity: avgProductivity,
          productivity_display: `${avgProductivity}%`,
          remarks: remarkCategory,
          project_start_date: projectStartDate,
          project_end_date: projectEndDate
        });
      }
    }

    performanceList = combinedRows.sort((a, b) => b.productivity - a.productivity);
    filteredPerformance = [...performanceList];
    console.log("Performance List:", performanceList);

    currentPage = 1;
    isDataLoading = false;
    updateDownloadButtonState();
    filterPerformance();
  } catch (error) {
    console.error("Error fetching performance data:", error);
    isDataLoading = false;
    updateDownloadButtonState();
    displayPerformance([]);
  }
}

/* ------------------------------
   Fetch and populate barangay names
   ------------------------------ */
async function fetchBarangayNames() {
  try {
    const barangaysCollection = collection(db, "tb_barangay");
    const barangaysSnapshot = await getDocs(barangaysCollection);
    const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);
    console.log("Barangay Names:", barangayNames);
    populateBarangayDropdown(barangayNames);
  } catch (e) {
    console.error("Error fetching barangay names:", e);
  }
}

function populateBarangayDropdown(barangayNames) {
  const barangaySelect = document.querySelector(".barangay_select");
  if (!barangaySelect) {
    console.warn("Barangay select element not found");
    return;
  }
  const firstOption = barangaySelect.querySelector("option")?.outerHTML || '<option value="">Barangay</option>';
  barangaySelect.innerHTML = firstOption;

  barangayNames.forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    option.value = name;
    barangaySelect.appendChild(option);
  });
}

/* ------------------------------
   Filtering - filterPerformance
   ------------------------------ */
function filterPerformance() {
  const searchInput = document.getElementById("performance-search-bar");
  const searchQuery = searchInput ? String(searchInput.value).toLowerCase().trim() : "";
  const selectedBarangay = (document.querySelector(".barangay_select")?.value || "").toLowerCase();

  console.log("Filtering with:", { searchQuery, selectedBarangay, selectedMonth, selectedYear });

  filteredPerformance = [...performanceList];

  if (searchQuery) {
    filteredPerformance = filteredPerformance.filter(row => {
      const match = String(row.farmer_name || "").toLowerCase().includes(searchQuery) ||
                    String(row.project_name || "").toLowerCase().includes(searchQuery);
      console.log(`Search filter for ${row.farmer_name || 'Unknown'}: ${match}`);
      return match;
    });
  }

  if (selectedBarangay) {
    filteredPerformance = filteredPerformance.filter(row => {
      const match = String(row.barangay || "").toLowerCase().includes(selectedBarangay);
      console.log(`Barangay filter for ${row.farmer_name || 'Unknown'}: ${match}, Barangay: ${row.barangay || 'N/A'}`);
      return match;
    });
  }

  if (selectedMonth !== null && selectedYear !== null) {
    filteredPerformance = filteredPerformance.filter(row => {
      const startDate = row.project_start_date ? parseDate(row.project_start_date) : null;
      const match = startDate && startDate.getMonth() + 1 === selectedMonth && startDate.getFullYear() === selectedYear;
      console.log(`Month filter for ${row.farmer_name || 'Unknown'}: ${match}, Start Date: ${startDate ? startDate.toISOString() : 'N/A'}`);
      return match;
    });
  } else {
    console.log("No month filter applied (selectedMonth is null)");
  }

  filteredPerformance.sort((a, b) => b.productivity - a.productivity);
  console.log("Filtered Performance:", filteredPerformance);
  displayPerformance(filteredPerformance);
}

/* ------------------------------
   Get color for remark
   ------------------------------ */
function getRemarkColor(remark) {
  if (!remark) return '#000000';
  const norm = remark.toLowerCase();
  if (norm === 'outstanding' || norm === 'highly efficient' || norm === 'productive') return '#41a186';
  if (norm === 'average performer') return '#9854cb';
  if (norm === 'needs improvement') return '#ac415b';
  return '#000000';
}

/* ------------------------------
   Display performance in table
   ------------------------------ */
function displayPerformance(list) {
  const tableBody = document.querySelector(".performance_table table tbody");
  if (!tableBody) {
    console.error("Table body element not found, selector: .performance_table table tbody");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginated = list.slice(startIndex, endIndex);

  console.log(`Displaying ${paginated.length} records for page ${currentPage}, startIndex: ${startIndex}, endIndex: ${endIndex}`);

  if (isDataLoading) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Processing data please wait...</td></tr>`;
    console.log("Displaying loading message");
  } else if (paginated.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No records found</td></tr>`;
    console.log("No records to display, showing 'No records found'");
  } else {
    paginated.forEach((rowData, i) => {
      const rank = startIndex + i + 1;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rank}</td>
        <td>${rowData.farmer_name || "N/A"}</td>
        <td>${rowData.barangay || "N/A"}</td>
        <td>${rowData.attendance || "0/0 days"}</td>
        <td>${rowData.productivity != null ? rowData.productivity + "%" : "N/A"}</td>
        <td style="color: ${getRemarkColor(rowData.remarks)};">${rowData.remarks || "N/A"}</td>
      `;
      tableBody.appendChild(tr);
      console.log(`Rendered row ${rank}:`, rowData);
    });
  }

  updatePagination();
  updateDownloadButtonState();
}

/* ------------------------------
   Pagination controls
   ------------------------------ */
function updatePagination() {
  const totalPages = Math.ceil(filteredPerformance.length / rowsPerPage) || 1;
  const pageNumberEl = document.getElementById("performance-page-number");
  if (pageNumberEl) {
    pageNumberEl.textContent = `${currentPage} of ${totalPages}`;
  } else {
    console.warn("Page number element not found");
  }
  const prevBtn = document.getElementById("performance-prev-page");
  const nextBtn = document.getElementById("performance-next-page");
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  console.log(`Pagination updated: Page ${currentPage} of ${totalPages}`);
}

/* ------------------------------
   Month picker
   ------------------------------ */
function showMonthPicker() {
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  const monthPicker = document.getElementById('month-picker');
  const yearDisplay = document.getElementById('year-display');
  
  if (yearDisplay) yearDisplay.textContent = selectedYear;
  if (!calendarIcon || !monthPicker) {
    console.warn("Calendar icon or month picker not found");
    return;
  }

  monthPicker.style.position = 'absolute';
  monthPicker.style.top = `${calendarIcon.offsetHeight + 5}px`;
  monthPicker.style.right = '0px';
  monthPicker.style.left = 'auto';
  monthPicker.style.display = monthPicker.style.display === 'none' ? 'block' : 'none';
}

/* ------------------------------
   Event listeners and initialization
   ------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded, initializing...");
  fetchBarangayNames();
  displayPerformance([]); // Initial display (will show "No records found" briefly)
  fetchPerformance();
  updateDownloadButtonState();

  const calendarIcon = document.querySelector('.calendar-btn-icon');
  if (calendarIcon) calendarIcon.addEventListener('click', showMonthPicker);

  document.addEventListener('click', (event) => {
    const monthPicker = document.getElementById('month-picker');
    const calendarIcon = document.querySelector('.calendar-btn-icon');
    if (monthPicker && calendarIcon && !monthPicker.contains(event.target) && !calendarIcon.contains(event.target)) {
      monthPicker.style.display = 'none';
    }
  });

  const prevYearBtn = document.getElementById('prev-year');
  const nextYearBtn = document.getElementById('next-year');
  if (prevYearBtn) prevYearBtn.addEventListener('click', () => {
    selectedYear--;
    const yd = document.getElementById('year-display');
    if (yd) yd.textContent = selectedYear;
    filterPerformance();
  });

  if (nextYearBtn) nextYearBtn.addEventListener('click', () => {
    selectedYear++;
    const yd = document.getElementById('year-display');
    if (yd) yd.textContent = selectedYear;
    filterPerformance();
  });

  document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      selectedMonth = index + 1;
      filterPerformance();
      document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
      btn.style.backgroundColor = '#41A186';
      const mp = document.getElementById('month-picker');
      if (mp) mp.style.display = 'none';
      const ci = document.querySelector('.calendar-btn-icon');
      if (ci) ci.style.filter = 'brightness(0.5)';
    });
  });

  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    selectedMonth = null;
    selectedYear = new Date().getFullYear();
    const ci = document.querySelector('.calendar-btn-icon');
    if (ci) ci.style.filter = 'none';
    document.querySelectorAll('#month-picker .month-btn').forEach(btn => {
      btn.style.backgroundColor = 'transparent';
    });
    const yd = document.getElementById('year-display');
    if (yd) yd.textContent = selectedYear;
    filterPerformance();
    const mp = document.getElementById('month-picker');
    if (mp) mp.style.display = 'none';
  });

  const searchBar = document.getElementById("performance-search-bar");
  if (searchBar) searchBar.addEventListener("input", filterPerformance);
  const barangaySelect = document.querySelector(".barangay_select");
  if (barangaySelect) barangaySelect.addEventListener("change", filterPerformance);

  const prevPageBtn = document.getElementById("performance-prev-page");
  if (prevPageBtn) prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayPerformance(filteredPerformance);
    }
  });

  const nextPageBtn = document.getElementById("performance-next-page");
  if (nextPageBtn) nextPageBtn.addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredPerformance.length) {
      currentPage++;
      displayPerformance(filteredPerformance);
    }
  });
});

/* ------------------------------
   PDF generation
   ------------------------------ */
const downloadBtn = document.getElementById("download-btn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (document.getElementById("download-btn").disabled) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const fullName = `${currentUser?.first_name || "Unknown"} ${currentUser?.middle_name ? currentUser.middle_name.charAt(0) + "." : ""} ${currentUser?.last_name || "User"}`.trim();
    const userTypePrint = currentUser?.user_type || "Unknown";
    const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const tableData = filteredPerformance.map((row, idx) => [
      (idx + 1).toString(),
      row.farmer_name || "N/A",
      row.barangay || "N/A",
      row.attendance || "0/0 days",
      row.productivity != null ? `${row.productivity}%` : "N/A",
      row.remarks || "N/A"
    ]);

    const columns = ["#", "Farmer Name", "Barangay", "Attendance", "Productivity Percentage", "Remarks"];
    const columnWidths = [10, 60, 40, 30, 35, 35];
    const totalTableWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    const leftMargin = Math.max(10, (pageWidth - totalTableWidth) / 2);

    const addHeader = (doc) => {
      const headerImg = "/images/BarasHeader.png";
      const headerImgWidth = 60;
      const headerImgHeight = 40;
      try {
        doc.addImage(headerImg, "PNG", (pageWidth - headerImgWidth) / 2, 5, headerImgWidth, headerImgHeight);
      } catch (e) {
        console.error("Error adding header image:", e);
      }

      doc.setLineWidth(0.4);
      doc.setDrawColor(51, 51, 51);
      doc.line(10, 45, pageWidth - 10, 45);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("FOR", 20, 70);
      doc.text(":", 42, 70);
      doc.text("FROM", 20, 80);
      doc.text(":", 42, 80);
      doc.text(fullName, 50, 80);
      doc.text("DATE", 20, 90);
      doc.text(":", 42, 90);
      doc.text(currentDate, 50, 90);
      doc.text("SUBJECT", 20, 100);
      doc.text(":", 42, 100);
      doc.text("Performance Report", 50, 100);

      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text(`AGRICULTURAL PERFORMANCE DATA`, pageWidth / 2, 55, { align: "center" });
    };

    const addBody = (doc, data) => {
      const tableEndY = data.cursor.y + 35;
      if (tableEndY < pageHeight - 30) {
        doc.setLineWidth(0.4);
        doc.setDrawColor(51, 51, 51);
        doc.line(10, tableEndY, pageWidth - 10, tableEndY);
      }
    };

    const addFooter = (doc, pageNumber, pageCount) => {
      const footerImg = "/images/BarasFooter.png";
      const footerImgWidth = 140;
      const footerImgHeight = 15;
      try {
        doc.addImage(footerImg, "PNG", (pageWidth - footerImgWidth) / 2, pageHeight - 30, footerImgWidth, footerImgHeight);
      } catch (e) {
        console.error("Error adding footer image:", e);
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Date Generated: ${currentDate}`, 10, pageHeight - 10);
      doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 10, pageHeight - 10, { align: "right" });
    };

    let currentPdfPage = 0;
    const rowsPerPdfPage = Math.floor((pageHeight - 65 - 105) / 10) || 20;

    while (currentPdfPage * rowsPerPdfPage < tableData.length) {
      const startIndex = currentPdfPage * rowsPerPdfPage;
      const endIndex = Math.min(startIndex + rowsPerPdfPage, tableData.length);
      const pageData = tableData.slice(startIndex, endIndex);

      if (currentPdfPage > 0) doc.addPage();

      addHeader(doc);
      doc.autoTable({
        startY: 105,
        head: [columns],
        body: pageData,
        theme: "grid",
        margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
        styles: { fontSize: 10, cellPadding: 1, overflow: "linebreak", font: "helvetica", textColor: [51, 51, 51], lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
        headStyles: { fillColor: [255, 255, 255], textColor: [65, 161, 134], fontSize: 12, font: "helvetica", fontStyle: "bold", lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
        columnStyles: Object.fromEntries(columns.map((_, i) => [i, { cellWidth: columnWidths[i] }])),
        didDrawPage: (data) => {
          addBody(doc, data);
        },
      });

      currentPdfPage++;
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    const isPreviewSupported = window.innerWidth > 768;
    if (isPreviewSupported) {
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const previewPanel = document.getElementById("pdf-preview-panel");
      const previewContainer = document.getElementById("pdf-preview-container");

      if (previewContainer) previewContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%"></iframe>`;
      if (previewPanel) previewPanel.style.display = "flex";
      document.body.classList.add("preview-active");

      const previewCancelBtn = document.getElementById("preview-cancel-btn");
      const previewDoneBtn = document.getElementById("preview-done-btn");

      if (previewCancelBtn) previewCancelBtn.onclick = () => {
        if (previewPanel) previewPanel.style.display = "none";
        document.body.classList.remove("preview-active");
        URL.revokeObjectURL(pdfUrl);
      };

      if (previewDoneBtn) previewDoneBtn.onclick = async () => {
        doc.save(`Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        await saveActivityLog("Create", `Performance Report downloaded by ${userTypePrint} ${fullName}`);
        if (previewPanel) previewPanel.style.display = "none";
        document.body.classList.remove("preview-active");
        URL.revokeObjectURL(pdfUrl);
      };
    } else {
      doc.save(`Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      await saveActivityLog("Create", `Performance Report downloaded by ${userTypePrint} ${fullName}`);
    }
  });
}