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
  onSnapshot,
  addDoc,
  arrayRemove,
  doc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// <---------------------------------> GLOBAL VARIABLES <--------------------------------->
let projectsList = []; // Full list of projects
let filteredProjects = []; // Filtered list of projects
let currentPage = 1;
const rowsPerPage = 5;
let selectedProjects = [];
let originalProjectsList = [];
let selectedMonth = null;
let selectedYear = new Date().getFullYear(); // Default to current year

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            resolve({ ...user, user_type: userData.user_type });
          } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user_type:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}

// Fetch projects
async function fetchProjects() {
  try {
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(projectsCollection);

    onSnapshot(projectsQuery, async (snapshot) => {
      projectsList = snapshot.docs.map(doc => {
        const project = doc.data();
        project.id = doc.id;
        return project;
      });

      originalProjectsList = projectsList;
      filterProjects(); // Apply filters after fetching projects
    }, (error) => {
      console.error("Error listening to Projects:", error);
    });
  } catch (error) {
    console.error("Error fetching Projects:", error);
  }
}

// Fetch Barangay names from tb_barangay collection
async function fetchBarangayNames() {
  const barangaysCollection = collection(db, "tb_barangay");
  const barangaysSnapshot = await getDocs(barangaysCollection);
  const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);

  populateBarangayDropdown(barangayNames);
}

// Populate the barangay dropdown with barangay names
function populateBarangayDropdown(barangayNames) {
  const barangaySelect = document.querySelector(".barangay_select");
  if (!barangaySelect) {
    console.error("Barangay dropdown not found!");
    return;
  }
  const firstOption = barangaySelect.querySelector("option")?.outerHTML || "";

  barangaySelect.innerHTML = firstOption;

  barangayNames.forEach(barangayName => {
    const option = document.createElement("option");
    option.textContent = barangayName;
    option.value = barangayName;
    barangaySelect.appendChild(option);
  });
}

// Fetch Crop Type names from tb_crop_types collection
async function fetchCropTypeNames() {
  const cropTypesCollection = collection(db, "tb_crop_types");
  const cropTypesSnapshot = await getDocs(cropTypesCollection);
  const cropTypeNames = cropTypesSnapshot.docs.map(doc => doc.data().crop_type_name);

  populateCropTypeDropdown(cropTypeNames);
}

// Populate the crop type dropdown with crop type names
function populateCropTypeDropdown(cropTypeNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop type dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";

  cropSelect.innerHTML = firstOption;

  cropTypeNames.forEach(cropTypeName => {
    const option = document.createElement("option");
    option.textContent = cropTypeName;
    option.value = cropTypeName;
    cropSelect.appendChild(option);
  });
}

// Function to parse dates
function parseDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }

  return new Date(dateValue);
}

// Function to sort projects by date (latest to oldest)
function sortProjectsById() {
  filteredProjects.sort((a, b) => {
    const startDateA = a.start_date ? parseDate(a.start_date) : null;
    const endDateA = a.end_date ? parseDate(a.end_date) : null;
    const startDateB = b.start_date ? parseDate(b.start_date) : null;
    const endDateB = b.end_date ? parseDate(b.end_date) : null;

    const latestDateA = endDateA || startDateA;
    const latestDateB = endDateB || startDateB;

    if (latestDateA && latestDateB) {
      return latestDateB - latestDateA;
    } else if (!latestDateA && !latestDateB) {
      return a.project_id - b.project_id;
    } else {
      return latestDateB ? 1 : -1;
    }
  });
}

// Unified function to filter projects based on all criteria
function filterProjects() {
  const searchQuery = document.getElementById("projects-search-bar").value.toLowerCase().trim();
  const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
  const selectedCropType = document.querySelector(".crop_select").value.toLowerCase();

  // Start with the full projects list
  filteredProjects = [...originalProjectsList];

  // Apply search query filter
  if (searchQuery) {
    filteredProjects = filteredProjects.filter(project => {
      return (
        project.project_name?.toLowerCase().includes(searchQuery) ||
        project.project_type?.toLowerCase().includes(searchQuery) ||
        project.project_id?.toString().includes(searchQuery)
      );
    });
  }

  // Apply barangay filter (only if a barangay is selected)
  if (selectedBarangay) {
    filteredProjects = filteredProjects.filter(project => project.barangay_name?.toLowerCase() === selectedBarangay);
  }

  // Apply crop type filter (only if a crop type is selected)
  if (selectedCropType) {
    filteredProjects = filteredProjects.filter(project => project.crop_type_name?.toLowerCase() === selectedCropType);
  }

  // Apply month/year filter (if applicable)
  if (selectedMonth) {
    filteredProjects = filteredProjects.filter(project => {
      const startDate = project.start_date ? parseDate(project.start_date) : null;
      const endDate = project.end_date ? parseDate(project.end_date) : null;

      const startMonth = startDate ? startDate.getMonth() + 1 : null;
      const startYear = startDate ? startDate.getFullYear() : null;
      const endMonth = endDate ? endDate.getMonth() + 1 : null;
      const endYear = endDate ? endDate.getFullYear() : null;

      return (
        (startMonth === selectedMonth && startYear === selectedYear) ||
        (endMonth === selectedMonth && endYear === selectedYear)
      );
    });
  }

  // Reset pagination and update the table
  currentPage = 1;
  sortProjectsById();
  displayProjects(filteredProjects);
}

// Function to filter projects by month (now calls filterProjects)
function filterProjectsByMonth() {
  filterProjects();
}

// Function to clear the month filter
function clearMonthFilter() {
  selectedMonth = null;
  selectedYear = new Date().getFullYear();
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  calendarIcon.style.filter = 'none';
  document.querySelectorAll('#month-picker .month-btn').forEach(btn => {
    btn.style.backgroundColor = 'transparent';
  });
  const yearDisplay = document.getElementById('year-display');
  if (yearDisplay) {
    yearDisplay.textContent = selectedYear;
  }
  filterProjects();
}

// Function to show the month picker
function showMonthPicker() {
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  const monthPicker = document.getElementById('month-picker');
  const yearDisplay = document.getElementById('year-display');
  
  if (yearDisplay) {
    yearDisplay.textContent = selectedYear;
  }

  monthPicker.style.position = 'absolute';
  monthPicker.style.top = `${calendarIcon.offsetHeight + 5}px`;
  monthPicker.style.right = '0px';
  monthPicker.style.left = 'auto';

  monthPicker.style.display = monthPicker.style.display === 'none' ? 'block' : 'none';
}

// Display projects in the table
function displayProjects(projectsList) {
  const tableBody = document.querySelector(".projects_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .projects_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedProjects = projectsList.slice(startIndex, endIndex);

  if (paginatedProjects.length === 0) {
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="14" style="text-align: center; color: red;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedProjects.forEach((project) => {
    const row = document.createElement("tr");
    const projectId = project.project_id || "project Id not recorded";
    const projectName = project.project_name || "project Name not recorded";
    const projectStatus = project.status || "N/A";
    const projectFarmPres = project.farm_president || "N/A";
    const projectBarangay = project.barangay_name || "N/A";
    const projectCategory = project.crop_name || "N/A";
    const projectCropType = project.crop_type_name || "N/A";
    const projectEquipment = project.equipment || "N/A";
    const projectStart = project.start_date || "N/A";
    const projectEnd = project.end_date || "N/A";

    row.innerHTML = `
      <td>${projectId}</td>
      <td>${projectName}</td>
      <td>N/A</td>
      <td>${projectStatus}</td>
      <td>${projectFarmPres}</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>${projectBarangay}</td>
      <td>N/A</td>
      <td>${projectCategory}</td>
      <td>${projectCropType}</td>
      <td>N/A</td>
      <td>N/A</td>
      <td>${projectStart} <br> ${projectEnd}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage) || 1;
  document.getElementById("projects-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("projects-prev-page").disabled = currentPage === 1;
  document.getElementById("projects-next-page").disabled = currentPage >= Math.ceil(filteredProjects.length / rowsPerPage);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchBarangayNames();
  fetchCropTypeNames();
  fetchProjects();

  const calendarIcon = document.querySelector('.calendar-btn-icon');
  if (calendarIcon) {
    calendarIcon.addEventListener('click', showMonthPicker);
  }

  document.addEventListener('click', (event) => {
    const monthPicker = document.getElementById('month-picker');
    const calendarIcon = document.querySelector('.calendar-btn-icon');
    if (monthPicker && !monthPicker.contains(event.target) && !calendarIcon.contains(event.target)) {
      monthPicker.style.display = 'none';
    }
  });

  document.getElementById('prev-year').addEventListener('click', () => {
    selectedYear--;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjectsByMonth();
  });

  document.getElementById('next-year').addEventListener('click', () => {
    selectedYear++;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjectsByMonth();
  });

  document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      selectedMonth = index + 1;
      filterProjectsByMonth();
      document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
      btn.style.backgroundColor = '#007BFF';
      document.getElementById('month-picker').style.display = 'none';
      document.querySelector('.calendar-btn-icon').style.filter = 'brightness(0.5)';
    });
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    clearMonthFilter();
    document.getElementById('month-picker').style.display = 'none';
  });

  // Add event listeners for filters
  document.getElementById("projects-search-bar").addEventListener("input", filterProjects);
  document.querySelector(".barangay_select").addEventListener("change", filterProjects);
  document.querySelector(".crop_select").addEventListener("change", filterProjects);

  // Pagination event listeners
  document.getElementById("projects-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayProjects(filteredProjects);
    }
  });

  document.getElementById("projects-next-page").addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredProjects.length) {
      currentPage++;
      displayProjects(filteredProjects);
    }
  });
});

document.getElementById("download-btn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf; // Ensure this includes the full jsPDF with image support
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Prepare table data from the full filteredProjects array
  const tableData = filteredProjects.map((project, index) => {
    const projectId = project.project_id || "project Id not recorded";
    const projectName = project.project_name || "project Name not recorded";
    const projectStatus = project.status || "N/A";
    const projectFarmPres = project.farm_president || "N/A";
    const projectBarangay = project.barangay_name || "N/A";
    const projectCategory = project.crop_name || "N/A";
    const projectCropType = project.crop_type_name || "N/A";
    const projectEquipment = project.equipment || "N/A";
    const projectStart = project.start_date ? parseDate(project.start_date).toLocaleDateString() : "N/A";
    const projectEnd = project.end_date ? parseDate(project.end_date).toLocaleDateString() : "N/A";

    return [
      (index + 1).toString(), // No.
      projectName,
      "N/A", // No. of Task
      projectStatus,
      projectFarmPres,
      "N/A", // Lead Farmer/s
      "N/A", // Farmers
      projectBarangay,
      "N/A", // Land Area
      projectCategory,
      projectCropType,
      "N/A", // Fertilizer
      projectEquipment,
      `${projectStart} - ${projectEnd}`, // Duration
    ];
  });

  const columns = [
    "No.", "Project Name", "No. of Task", "Status", "Farm President", "Lead Farmer/s",
    "Farmers", "Barangay", "Land Area", "Category", "Crop Type", "Fertilizer", "Equipment", "Duration",
  ];

  const columnWidths = [10, 25, 15, 15, 20, 25, 30, 20, 15, 25, 15, 20, 25, 20];
  const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

  // Header container
  const addHeader = (doc) => {
    const headerImg = "../../../public/images/BarasHeader.png";
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
    doc.text("FOR:", 20, 60);
    doc.text("FROM:", 20, 70);
    doc.text("DATE:", 20, 80);
    doc.text("SUBJECT:", 20, 90);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("AGRICULTURAL PRODUCTION DATA 2025", pageWidth / 2, 100, { align: "center" });
  };

  // Body container (table and bottom line)
  const addBody = (doc, data) => {
    const tableEndY = data.cursor.y + 35; // Bottom line 35mm below table
    if (tableEndY < pageHeight - 30) { // Ensure it fits above footer
      doc.setLineWidth(0.4);
      doc.setDrawColor(51, 51, 51);
      doc.line(10, tableEndY, pageWidth - 10, tableEndY);
    }
  };

  // Footer container
  const addFooter = (doc, data) => {
    const footerImg = "../../../public/images/BarasFooter.png";
    const footerImgWidth = 140;
    const footerImgHeight = 15;
    try {
      doc.addImage(footerImg, "PNG", (pageWidth - footerImgWidth) / 2, pageHeight - 30, footerImgWidth, footerImgHeight);
    } catch (e) {
      console.error("Error adding footer image:", e);
    }

    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 10, pageHeight - 10, { align: "right" });
  };

  // Pagination logic with table content limit
  const maxTableHeight = pageHeight - 65; // 65mm reserved (30mm footer + 35mm for bottom line)
  const rowHeightEstimate = 10; // Increased to 10mm to account for potential wrapping
  const baseRowsPerPage = Math.floor((maxTableHeight - 105) / rowHeightEstimate); // 105 is startY
  const rowsPerPage = baseRowsPerPage; // No extra rows, just base to ensure fit
  let currentPage = 0;

  while (currentPage * rowsPerPage < tableData.length) {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
    const pageData = tableData.slice(startIndex, endIndex);

    if (currentPage > 0) {
      doc.addPage();
    }

    addHeader(doc);

    doc.autoTable({
      startY: 105,
      head: [columns],
      body: pageData,
      theme: "grid",
      margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
      styles: {
        fontSize: 7,
        cellPadding: 1,
        overflow: "linebreak",
        font: "helvetica",
        textColor: [51, 51, 51],
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [65, 161, 134],
        fontSize: 8,
        font: "helvetica",
        fontStyle: "bold",
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      columnStyles: Object.fromEntries(columns.map((_, i) => [i, { cellWidth: columnWidths[i] }])),
      didDrawPage: (data) => {
        addBody(doc, data);
        addFooter(doc, data);
      },
    });

    currentPage++;
  }

  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const previewPanel = document.getElementById("pdf-preview-panel");
  const previewContainer = document.getElementById("pdf-preview-container");

  previewContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%"></iframe>`;
  previewPanel.style.display = "flex";
  document.body.classList.add("preview-active");

  document.getElementById("preview-cancel-btn").onclick = () => {
    previewPanel.style.display = "none";
    document.body.classList.remove("preview-active");
    URL.revokeObjectURL(pdfUrl);
  };

  document.getElementById("preview-done-btn").onclick = () => {
    doc.save(`Project_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    previewPanel.style.display = "none";
    document.body.classList.remove("preview-active");
    URL.revokeObjectURL(pdfUrl);
  };
});