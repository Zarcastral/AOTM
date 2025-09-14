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
          // Fetch from tb_farmers instead of tb_users
          const userQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();

            currentUser = {
              uid: user.uid,
              email: user.email,
              user_type: userData.user_type || "Unknown",
              barangay_name: userData.barangay_name || null,
              ...userData
            };

            if (!currentUser.user_type) {
              console.warn("User type is missing in tb_farmers.");
              reject("User type missing.");
            } else if (!currentUser.barangay_name) {
              console.warn("User has no barangay assigned in tb_farmers.");
              reject("User has no barangay.");
            } else {
              console.log("Authenticated user:", currentUser.email, "in barangay:", currentUser.barangay_name);
              resolve(currentUser);
            }
          } else {
            console.error("User record not found in tb_farmers collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user data from tb_farmers:", error);
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
   Score mapping for remark labels
   ------------------------------ */
const scoreMap = {
  "OUTSTANDING": 5,
  "HIGHLY_EFFICIENT": 4,
  "PRODUCTIVE": 3,
  "AVERAGE_PERFORMER": 2,
  "NEEDS_IMPROVEMENT": 1
};

function remarkToScore(remarkLabel) {
  if (!remarkLabel) return 1;
  const normalized = String(remarkLabel).trim().toUpperCase().replace(/ /g, "_");
  
  if (scoreMap[normalized]) return scoreMap[normalized];

  // Fallback for variations
  if (normalized.includes("OUTSTANDING")) return 5;
  if (normalized.includes("HIGHLY") && normalized.includes("EFFICIENT")) return 4;
  if (normalized.includes("PRODUCTIVE")) return 3;
  if (normalized.includes("AVERAGE")) return 2;
  if (normalized.includes("NEEDS") && normalized.includes("IMPROVEMENT")) return 1;

  const numeric = parseInt(String(remarkLabel).trim());
  if (!isNaN(numeric) && numeric >= 1 && numeric <= 5) return numeric;
  
  return 1;
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
   Fetch performance data (filtered by user's barangay)
   ------------------------------ */
async function fetchPerformance() {
  try {
    isDataLoading = true;
    updateDownloadButtonState();
    displayPerformance(filteredPerformance);

    await getAuthenticatedUser();
    if (!currentUser) {
      console.warn("User is not authenticated.");
      isDataLoading = false;
      updateDownloadButtonState();
      displayPerformance([]);
      return;
    }

    // Current user's barangay
    const userBarangay = currentUser.barangay_name;
    if (!userBarangay) {
      console.warn("Current user's barangay is not defined.");
      isDataLoading = false;
      updateDownloadButtonState();
      displayPerformance([]);
      return;
    }

    // Fetch projects and history filtered by the current user's barangay
    const projectsQuery = query(collection(db, "tb_projects"), where("barangay_name", "==", userBarangay));
    const projectsSnap = await getDocs(projectsQuery);

    const historyQuery = query(collection(db, "tb_project_history"), where("barangay_name", "==", userBarangay));
    const historySnap = await getDocs(historyQuery);

    const allProjectDocs = [...projectsSnap.docs, ...historySnap.docs];

    // GLOBAL MAP keyed by farmer_id to remove duplicates across all projects
    const farmersMap = {};

    for (const projectDoc of allProjectDocs) {
      const projectData = projectDoc.data();
      const projectId = projectData.project_id;
      const projectName = projectData.project_name || "Unknown Project";
      const projectBarangay = projectData.barangay_name || "N/A";

      const tasksQuery = query(collection(db, "tb_project_task"), where("project_id", "==", projectId));
      const tasksSnap = await getDocs(tasksQuery);
      const taskDocs = tasksSnap.docs;

      const attendanceDocs = [];

      if (taskDocs.length > 0) {
        for (const taskDoc of taskDocs) {
          const taskData = taskDoc.data();
          const taskProjectTaskId = taskData.project_task_id;
          if (!taskProjectTaskId) continue;

          const attSnap = await getDocs(query(collection(db, "tb_attendance"), where("project_task_id", "==", taskProjectTaskId)));
          attSnap.forEach(doc => attendanceDocs.push(doc));
        }
      } else {
        const attSnap = await getDocs(query(collection(db, "tb_attendance"), where("project_id", "==", projectId)));
        attSnap.forEach(doc => attendanceDocs.push(doc));
      }

      // Aggregate attendance into the global map with strict barangay filter
      for (const attDoc of attendanceDocs) {
        const attData = attDoc.data();
        const farmers = attData.farmers || [];
        if (!Array.isArray(farmers)) continue;

        farmers.forEach((f) => {
          const farmerId = f.farmer_id || f.id;
          const farmerBarangay = f.barangay || f.barangay_name || projectBarangay;

          // STRICT filter: only include farmers in current user's barangay
          if (!farmerId || farmerBarangay !== userBarangay) return;

          if (!farmersMap[farmerId]) {
            farmersMap[farmerId] = {
              farmer_name: f.farmer_name || f.name || "Unknown",
              barangay: farmerBarangay,
              presentDays: 0,
              totalSessions: 0,
              scoreSum: 0
            };
          }

          const present = String(f.present || "No").toLowerCase() === "yes";
          const remark = f.remarks || f.remark || f.remark_label || "Needs Improvement";

          if (present) farmersMap[farmerId].presentDays++;
          farmersMap[farmerId].totalSessions++;
          farmersMap[farmerId].scoreSum += remarkToScore(remark);
        });
      }
    }

    // Convert map to array and compute productivity
    const combinedRows = Object.values(farmersMap).map(farmer => {
      const totalSessions = farmer.totalSessions || 1;
      const avgProductivity = Math.round((farmer.presentDays / totalSessions) * 100);
      const remarkCategory = getRemarkFromPercentage(avgProductivity);

      return {
        farmer_name: farmer.farmer_name,
        barangay: farmer.barangay,
        present_days: farmer.presentDays,
        total_days: totalSessions,
        attendance: `${farmer.presentDays}/${totalSessions} days`,
        productivity: avgProductivity,
        productivity_display: `${avgProductivity}%`,
        remarks: remarkCategory
      };
    });

    performanceList = combinedRows.sort((a, b) => {
      if (b.productivity !== a.productivity) return b.productivity - a.productivity;
      const remarkScoreA = remarkToScore(a.remarks);
      const remarkScoreB = remarkToScore(b.remarks);
      if (remarkScoreB !== remarkScoreA) return remarkScoreB - remarkScoreA;
      return (a.farmer_name || "").localeCompare(b.farmer_name || "");
    });

    filteredPerformance = [...performanceList];
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
    filteredPerformance.sort((a, b) => {
      // First, sort by productivity descending
      if (b.productivity !== a.productivity) return b.productivity - a.productivity;

      // Then by remark score descending
      const remarkScoreA = remarkToScore(a.remarks);
      const remarkScoreB = remarkToScore(b.remarks);
      if (remarkScoreB !== remarkScoreA) return remarkScoreB - remarkScoreA;

      // Finally, alphabetically by farmer_name
      return (a.farmer_name || "").localeCompare(b.farmer_name || "");
    });

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
  if (!tableBody) return;

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginated = list.slice(startIndex, endIndex);

  if (isDataLoading) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Pulling Latest Records Please Wait..</td></tr>`;
  } else if (paginated.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No records found</td></tr>`;
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM fully loaded, initializing...");

  await fetchBarangayNames();

  const latestTimestampEl = document.getElementById("latest-record-timestamp");
  const savedPerformance = localStorage.getItem("performanceList");
  const savedTimestamp = localStorage.getItem("performanceTimestamp");

  if (savedPerformance) {
    performanceList = JSON.parse(savedPerformance);
    filteredPerformance = [...performanceList];
    displayPerformance(filteredPerformance);
  } else {
    displayPerformance([]);
  }

  // Restore latest record timestamp
  if (savedTimestamp && latestTimestampEl) {
    latestTimestampEl.textContent = `Latest Record Date and Time: ${savedTimestamp}`;
  }

  updateDownloadButtonState();

  const pullBtn = document.getElementById("pull-latest-btn");
  // Disable the button on page load
  if (pullBtn) {
    pullBtn.disabled = true;
    pullBtn.style.opacity = 0.5;
    pullBtn.style.cursor = 'not-allowed';
  }

  if (pullBtn) {
    pullBtn.disabled = false;
    pullBtn.style.opacity = 1;
    pullBtn.style.cursor = 'pointer';
  }

  if (pullBtn) {
    pullBtn.addEventListener("click", async () => {
      console.log("Pull Latest Records button clicked");

      // Disable button to prevent spamming
      pullBtn.disabled = true;
      pullBtn.style.opacity = 0.5;
      pullBtn.style.cursor = 'not-allowed';

      // Show temporary loading message
      isDataLoading = true;
      displayPerformance([]); // Shows "Pulling Latest Records Please Wait.."

      // Fetch latest data
      await fetchPerformance();

      // Update latest record timestamp
      const now = new Date();
      const formatted = now.toLocaleString("en-US", { 
        month: "long", day: "numeric", year: "numeric", 
        hour: "2-digit", minute: "2-digit", second: "2-digit" 
      });
      if (latestTimestampEl) latestTimestampEl.textContent = `Latest Record Date and Time: ${formatted}`;

      // Save new data and timestamp to localStorage
      localStorage.setItem("performanceList", JSON.stringify(filteredPerformance));
      localStorage.setItem("performanceTimestamp", formatted);

      // Re-enable button after data is fetched
      isDataLoading = false;
      displayPerformance(filteredPerformance);

      pullBtn.disabled = false;
      pullBtn.style.opacity = 1;
      pullBtn.style.cursor = 'pointer';
    });
  }

  // Search and barangay filters
  const searchBar = document.getElementById("performance-search-bar");
  if (searchBar) searchBar.addEventListener("input", filterPerformance);
  const barangaySelect = document.querySelector(".barangay_select");
  if (barangaySelect) barangaySelect.addEventListener("change", filterPerformance);

  // Pagination controls
  const prevPageBtn = document.getElementById("performance-prev-page");
  const nextPageBtn = document.getElementById("performance-next-page");

  if (prevPageBtn) prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayPerformance(filteredPerformance);
    }
  });

  if (nextPageBtn) nextPageBtn.addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredPerformance.length) {
      currentPage++;
      displayPerformance(filteredPerformance);
    }
  });

  // Automatically fetch data if needed on page load
  // await fetchPerformance();
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