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
let harvestList = [];
let filteredHarvest = [];
let currentPage = 1;
const rowsPerPage = 5;
let selectedHarvest = [];
let originalHarvestList = [];
let selectedMonth = null;
let selectedYear = new Date().getFullYear();

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            resolve({ 
              ...user, 
              farmer_id: farmerData.farmer_id,
              user_type: farmerData.user_type 
            });
          } else {
            console.error("Farmer record not found in tb_farmers collection.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}

// Fetch harvest data from tb_harvest and tb_harvest_history filtered by farmer_id
async function fetchHarvest() {
  try {
    const user = await getAuthenticatedUser();
    
    // Reference to both collections
    const harvestCollection = collection(db, "tb_harvest");
    const harvestHistoryCollection = collection(db, "tb_harvest_history");

    // Queries for both collections filtering by farm_pres_id
    const harvestQuery = query(harvestCollection, where("farm_pres_id", "==", user.farmer_id));
    const harvestHistoryQuery = query(harvestHistoryCollection, where("farm_pres_id", "==", user.farmer_id));

    // Combine data from both collections
    harvestList = [];
    
    // Listen to tb_harvest
    const unsubscribeHarvest = onSnapshot(harvestQuery, (harvestSnapshot) => {
      const harvestData = harvestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: "tb_harvest" }));
      updateHarvestList(harvestData, "tb_harvest");
    }, (error) => {
      console.error("Error listening to tb_harvest:", error);
    });

    // Listen to tb_harvest_history
    const unsubscribeHistory = onSnapshot(harvestHistoryQuery, (historySnapshot) => {
      const historyData = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: "tb_harvest_history" }));
      updateHarvestList(historyData, "tb_harvest_history");
    }, (error) => {
      console.error("Error listening to tb_harvest_history:", error);
    });

    // Function to update harvestList and trigger display
    function updateHarvestList(newData, source) {
      // Filter out existing records from the same source
      harvestList = harvestList.filter(item => item.source !== source);
      // Add new data
      harvestList = [...harvestList, ...newData];
      originalHarvestList = harvestList;
      const consolidatedData = consolidateHarvestByCropType(harvestList);
      harvestList = consolidatedData;
      originalHarvestList = consolidatedData;
      filterHarvest();
    }

  } catch (error) {
    console.error("Error fetching Harvest:", error);
  }
}

// Function to convert kg to metric tons and round to 2 decimal places
function convertToMetricTons(kgValue) {
  if (!kgValue || isNaN(kgValue)) return 0;
  const mtValue = parseFloat(kgValue) / 1000;
  return Number(mtValue.toFixed(2));
}

// Function to format date to "Month Year"
function formatMonthYear(date) {
  if (!date) return "N/A";
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Function to consolidate harvest records by crop_type_name
function consolidateHarvestByCropType(harvestData) {
  const consolidated = {};

  harvestData.forEach(harvest => {
    const cropType = harvest.crop_type_name || "Unknown";
    if (!consolidated[cropType]) {
      consolidated[cropType] = {
        crop_type_name: cropType,
        barangay_name: new Set(),
        crop_name: harvest.crop_name || "N/A",
        farmer_name: new Set(),
        harvest_date: [],
        start_date: [],
        end_date: [],
        harvest_id: [],
        total_harvested_crops: 0,
        total_harvest_crops_mt: 0,
        land_area: 0,
        unit: "kg"
      };
    }

    if (harvest.barangay_name) consolidated[cropType].barangay_name.add(harvest.barangay_name);
    if (harvest.farmer_name && Array.isArray(harvest.farmer_name)) {
      harvest.farmer_name.forEach(farmer => consolidated[cropType].farmer_name.add(farmer));
    }
    if (harvest.harvest_date) consolidated[cropType].harvest_date.push(parseDate(harvest.harvest_date));
    if (harvest.start_date) consolidated[cropType].start_date.push(parseDate(harvest.start_date));
    if (harvest.end_date) consolidated[cropType].end_date.push(parseDate(harvest.end_date));
    if (harvest.harvest_id) consolidated[cropType].harvest_id.push(harvest.harvest_id);
    if (harvest.total_harvested_crops) {
      const kgValue = parseFloat(harvest.total_harvested_crops) || 0;
      consolidated[cropType].total_harvested_crops += kgValue;
      consolidated[cropType].total_harvest_crops_mt = convertToMetricTons(consolidated[cropType].total_harvested_crops);
    }
    if (harvest.land_area) {
      consolidated[cropType].land_area += parseFloat(harvest.land_area) || 0;
    }
  });

  return Object.values(consolidated).map(item => ({
    ...item,
    barangay_name: Array.from(item.barangay_name).join(", "),
    farmer_name: Array.from(item.farmer_name),
    // Oldest start_date (earliest), Latest end_date and harvest_date (most recent)
    start_date: item.start_date.length ? item.start_date.sort((a, b) => a - b)[0] : null, // Oldest
    end_date: item.end_date.length ? item.end_date.sort((a, b) => b - a)[0] : null, // Latest
    harvest_date: item.harvest_date.length ? item.harvest_date.sort((a, b) => b - a)[0] : null, // Latest
    harvest_id: item.harvest_id
  }));
}

// Fetch Barangay names from tb_barangay collection
async function fetchBarangayNames() {
  const barangaysCollection = collection(db, "tb_barangay");
  const barangaysSnapshot = await getDocs(barangaysCollection);
  const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);
  populateBarangayDropdown(barangayNames);
}

// Populate the barangay dropdown
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

// Populate the crop type dropdown
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

// Function to sort harvest by crop_type_name
function sortHarvestByCropType() {
  filteredHarvest.sort((a, b) => a.crop_type_name.localeCompare(b.crop_type_name));
}

// Unified function to filter harvest
function filterHarvest() {
  const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();
  const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
  const selectedCropType = document.querySelector(".crop_select").value.toLowerCase();

  filteredHarvest = [...originalHarvestList];

  if (searchQuery) {
    filteredHarvest = filteredHarvest.filter(harvest => {
      return (
        harvest.crop_name?.toLowerCase().includes(searchQuery) ||
        harvest.crop_type_name?.toLowerCase().includes(searchQuery)
      );
    });
  }

  if (selectedBarangay) {
    filteredHarvest = filteredHarvest.filter(harvest => harvest.barangay_name?.toLowerCase().includes(selectedBarangay));
  }

  if (selectedCropType) {
    filteredHarvest = filteredHarvest.filter(harvest => harvest.crop_type_name?.toLowerCase() === selectedCropType);
  }

  if (selectedMonth) {
    filteredHarvest = filteredHarvest.filter(harvest => {
      const harvestDate = harvest.harvest_date ? parseDate(harvest.harvest_date) : null;
      const harvestMonth = harvestDate ? harvestDate.getMonth() + 1 : null;
      const harvestYear = harvestDate ? harvestDate.getFullYear() : null;
      return harvestMonth === selectedMonth && harvestYear === selectedYear;
    });
  }

  currentPage = 1;
  sortHarvestByCropType();
  displayHarvest(filteredHarvest);
}

// Function to filter harvest by month
function filterHarvestByMonth() {
  filterHarvest();
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
  filterHarvest();
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

// Display harvest in the table
function displayHarvest(harvestList) {
  const tableBody = document.querySelector(".harvest_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .harvest_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHarvest = harvestList.slice(startIndex, endIndex);

  if (paginatedHarvest.length === 0) {
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="10" style="text-align: center;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedHarvest.forEach((harvest) => {
    const row = document.createElement("tr");
    const cropName = harvest.crop_name || "N/A";
    const cropTypeName = harvest.crop_type_name || "N/A";
    const farmerCount = harvest.farmer_name?.length || 0;
    const barangayName = harvest.barangay_name || "N/A";
    const landArea = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const startDate = formatMonthYear(harvest.start_date);
    const endDate = formatMonthYear(harvest.end_date);
    const production = harvest.total_harvest_crops_mt ? `${harvest.total_harvest_crops_mt} mt` : "N/A";
    const harvestDate = formatMonthYear(harvest.harvest_date);

    row.innerHTML = `
      <td>${cropName}</td>
      <td>${cropTypeName}</td>
      <td>${farmerCount}</td>
      <td>${barangayName}</td>
      <td>${landArea}</td>
      <td>${startDate}</td>
      <td>${landArea}</td>
      <td>${endDate}</td>
      <td>${production}</td>
      <td>${harvestDate}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredHarvest.length / rowsPerPage) || 1;
  document.getElementById("harvest-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("harvest-prev-page").disabled = currentPage === 1;
  document.getElementById("harvest-next-page").disabled = currentPage >= Math.ceil(filteredHarvest.length / rowsPerPage);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchBarangayNames();
  fetchCropTypeNames();
  fetchHarvest();

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
    filterHarvestByMonth();
  });

  document.getElementById('next-year').addEventListener('click', () => {
    selectedYear++;
    document.getElementById('year-display').textContent = selectedYear;
    filterHarvestByMonth();
  });

  document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      selectedMonth = index + 1;
      filterHarvestByMonth();
      document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
      btn.style.backgroundColor = '#41A186';
      document.getElementById('month-picker').style.display = 'none';
      document.querySelector('.calendar-btn-icon').style.filter = 'brightness(0.5)';
    });
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    clearMonthFilter();
    document.getElementById('month-picker').style.display = 'none';
  });

  document.getElementById("harvest-search-bar").addEventListener("input", filterHarvest);
  document.querySelector(".barangay_select").addEventListener("change", filterHarvest);
  document.querySelector(".crop_select").addEventListener("change", filterHarvest);

  document.getElementById("harvest-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayHarvest(filteredHarvest);
    }
  });

  document.getElementById("harvest-next-page").addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredHarvest.length) {
      currentPage++;
      displayHarvest(filteredHarvest);
    }
  });
});

document.getElementById("download-btn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const user = await getAuthenticatedUser();
  const farmersCollection = collection(db, "tb_farmers");
  const farmerQuery = query(farmersCollection, where("email", "==", user.email));
  const farmerSnapshot = await getDocs(farmerQuery);
  const farmerData = farmerSnapshot.docs[0].data();

  const firstName = farmerData.first_name || "Unknown";
  const middleName = farmerData.middle_name ? `${farmerData.middle_name.charAt(0)}.` : "";
  const lastName = farmerData.last_name || "Farmer";
  const fullName = `${firstName} ${middleName} ${lastName}`.trim();
  const userTypePrint = farmerData.user_type || "Unknown";

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tableData = filteredHarvest.map((harvest) => {
    const cropName = harvest.crop_name || "N/A";
    const cropTypeName = harvest.crop_type_name || "N/A";
    const farmerCount = harvest.farmer_name?.length || 0;
    const barangayName = harvest.barangay_name || "N/A";
    const landArea = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const startDate = formatMonthYear(harvest.start_date);
    const endDate = formatMonthYear(harvest.end_date);
    const production = harvest.total_harvest_crops_mt ? `${harvest.total_harvest_crops_mt} mt` : "N/A";
    const harvestDate = formatMonthYear(harvest.harvest_date);

    return [
      cropName,
      cropTypeName,
      farmerCount.toString(),
      barangayName,
      landArea,
      startDate,
      landArea,
      endDate,
      production,
      harvestDate
    ];
  });

  const columns = [
    "Commodity",
    "Type of Crop",
    "No. of Farmers Served",
    "Barangay",
    "Area Planted (ha)",
    "To Date",
    "Area Harvested (ha)",
    "To Date",
    "Production (mt)",
    "To Date"
  ];

  const columnWidths = [25, 25, 20, 30, 20, 20, 20, 20, 25, 25];
  const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

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
    doc.text("FOR", 20, 60);
    doc.text(":", 42, 60);
    doc.text("FROM", 20, 70);
    doc.text(":", 42, 70);
    doc.text(fullName, 50, 70);
    doc.text("DATE", 20, 80);
    doc.text(":", 42, 80);
    doc.text(currentDate, 50, 80);
    doc.text("SUBJECT", 20, 90);
    doc.text(":", 42, 90);
    doc.text("Harvest Report", 50, 90);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    const reportYear = selectedYear || new Date().getFullYear();
    doc.text(`AGRICULTURAL PRODUCTION DATA ${reportYear}`, pageWidth / 2, 100, { align: "center" });
  };

  const addBody = (doc, data) => {
    const tableEndY = data.cursor.y + 35;
    if (tableEndY < pageHeight - 30) {
      doc.setLineWidth(0.4);
      doc.setDrawColor(51, 51, 51);
      doc.line(10, tableEndY, pageWidth - 10, tableEndY);
    }
  };

  const addFooter = (doc, data) => {
    const footerImg = "/images/BarasFooter.png";
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

  const maxTableHeight = pageHeight - 65;
  const rowHeightEstimate = 10;
  const baseRowsPerPage = Math.floor((maxTableHeight - 105) / rowHeightEstimate);
  const rowsPerPage = baseRowsPerPage;
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
        fontSize: 5,
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
        fontSize: 7,
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

  document.getElementById("preview-done-btn").onclick = async () => {
    doc.save(`Harvest_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    previewPanel.style.display = "none";
    document.body.classList.remove("preview-active");
    URL.revokeObjectURL(pdfUrl);
  };
});