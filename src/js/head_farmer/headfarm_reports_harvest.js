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
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}

// Fetch harvest data from tb_harvest and tb_harvest_history collections
async function fetchHarvest() {
  try {
    const user = await getAuthenticatedUser();
    
    // Get the current user's farmer_id from tb_farmers collection
    const farmersCollection = collection(db, "tb_farmers");
    const farmerQuery = query(farmersCollection, where("email", "==", user.email));
    const farmerSnapshot = await getDocs(farmerQuery);
    
    if (farmerSnapshot.empty) {
      console.error("No farmer document found for current user");
      return;
    }
    
    const farmerData = farmerSnapshot.docs[0].data();
    const currentFarmerId = farmerData.farmer_id;
    if (!currentFarmerId) {
      console.error("farmer_id field not found in farmer document");
      return;
    }
    console.log("Current Farmer ID:", currentFarmerId);

    // Reference to both collections
    const harvestCollection = collection(db, "tb_harvest");
    const harvestHistoryCollection = collection(db, "tb_harvest_history");

    // Queries for both collections filtering by lead_farmer_id
    const harvestQuery = query(
      harvestCollection,
      where("lead_farmer_id", "==", currentFarmerId)
    );
    const harvestHistoryQuery = query(
      harvestHistoryCollection,
      where("lead_farmer_id", "==", currentFarmerId)
    );

    // Combine data from both collections
    harvestList = [];
    
    // Listen to tb_harvest
    const unsubscribeHarvest = onSnapshot(harvestQuery, (snapshot) => {
      const harvestData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: "tb_harvest" }));
      console.log("Harvest Data:", harvestData);
      updateHarvestList(harvestData, "tb_harvest");
    }, (error) => {
      console.error("Error listening to tb_harvest:", error);
    });

    // Listen to tb_harvest_history
    const unsubscribeHistory = onSnapshot(harvestHistoryQuery, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: "tb_harvest_history" }));
      console.log("Harvest History Data:", historyData);
      updateHarvestList(historyData, "tb_harvest_history");
    }, (error) => {
      console.error("Error listening to tb_harvest_history:", error);
    });

    // Function to update harvestList and trigger display
    function updateHarvestList(newData, source) {
      harvestList = harvestList.filter(item => item.source !== source);
      harvestList = [...harvestList, ...newData];
      originalHarvestList = harvestList;
      filterHarvest();
    }

  } catch (error) {
    console.error("Error fetching harvest data:", error);
  }
}

// Function to convert kg to metric tons and round to 2 decimal places
function convertToMetricTons(kgValue) {
  if (!kgValue || isNaN(kgValue)) return 0;
  const mtValue = parseFloat(kgValue) / 1000;
  return Number(mtValue.toFixed(2));
}

function parseDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  return new Date(dateValue);
}

function getMonthName(date) {
  if (!date) return "N/A";
  return date.toLocaleString('default', { month: 'long' });
}

function formatDate(date) {
  if (!date) return "N/A";
  return date.toLocaleDateString("en-US");
}

function sortHarvestByCropType() {
  filteredHarvest.sort((a, b) => {
    const cropTypeA = a.crop_type_name || "";
    const cropTypeB = b.crop_type_name || "";
    return cropTypeA.localeCompare(cropTypeB);
  });
}

function filterHarvest() {
  const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();

  filteredHarvest = [...originalHarvestList];

  if (searchQuery) {
    filteredHarvest = filteredHarvest.filter(harvest => {
      const cropName = harvest.crop_name?.toLowerCase() || "";
      const cropTypeName = harvest.crop_type_name?.toLowerCase() || "";
      const harvestDate = harvest.harvest_date ? formatDate(parseDate(harvest.harvest_date)).toLowerCase() : "";
      const endDate = harvest.end_date ? formatDate(parseDate(harvest.end_date)).toLowerCase() : "";
      const startDate = harvest.start_date ? formatDate(parseDate(harvest.start_date)).toLowerCase() : "";
      const totalHarvestedCrops = harvest.total_harvested_crops ? harvest.total_harvested_crops.toString().toLowerCase() : "";

      return (
        cropName.includes(searchQuery) ||
        cropTypeName.includes(searchQuery) ||
        harvestDate.includes(searchQuery) ||
        endDate.includes(searchQuery) ||
        startDate.includes(searchQuery) ||
        totalHarvestedCrops.includes(searchQuery)
      );
    });
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

function filterHarvestByMonth() {
  filterHarvest();
}

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

function displayHarvest(harvestList) {
  const tableBody = document.querySelector(".harvest_table table tbody");
  const downloadBtn = document.getElementById("download-btn");

  if (!tableBody) {
    console.error("Table body not found inside .harvest_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHarvest = harvestList.slice(startIndex, endIndex);

  if (filteredHarvest.length === 0) {
    downloadBtn.disabled = true;
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="10" style="text-align: center;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  } else {
    downloadBtn.disabled = false;
  }

  paginatedHarvest.forEach((harvest) => {
    const row = document.createElement("tr");
    const commodity = harvest.project_name || "N/A";
    const cropType = harvest.crop_name || "N/A";
    const farmersCount = harvest.lead_farmer ? 1 : 0;
    const barangay = harvest.barangay_name || "N/A";
    const areaPlanted = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const startDate = harvest.start_date ? formatDate(new Date(harvest.start_date)) : "N/A";
    const areaHarvested = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const endDate = harvest.end_date ? formatDate(parseDate(harvest.end_date)) : "N/A";
    const production = harvest.total_harvested_crops ? `${convertToMetricTons(harvest.total_harvested_crops)} mt` : "N/A";
    const harvestDate = harvest.harvest_date ? formatDate(parseDate(harvest.harvest_date)) : "N/A";

    row.innerHTML = `
      <td>${commodity}</td>
      <td>${cropType}</td>
      <td>${farmersCount}</td>
      <td>${barangay}</td>
      <td>${areaPlanted}</td>
      <td>${startDate}</td>
      <td>${areaHarvested}</td>
      <td>${endDate}</td>
      <td>${production}</td>
      <td>${harvestDate}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredHarvest.length / rowsPerPage) || 1;
  document.getElementById("harvest-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("harvest-prev-page").disabled = currentPage === 1;
  document.getElementById("harvest-next-page").disabled = currentPage >= Math.ceil(filteredHarvest.length / rowsPerPage);
}

document.addEventListener('DOMContentLoaded', () => {
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
  const lastName = farmerData.last_name || "User";
  const fullName = `${firstName} ${middleName} ${lastName}`.trim();
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tableData = filteredHarvest.map((harvest) => {
    const commodity = harvest.project_name || "N/A";
    const cropType = harvest.crop_name || "N/A";
    const farmersCount = harvest.lead_farmer ? 1 : 0;
    const barangay = harvest.barangay_name || "N/A";
    const areaPlanted = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const startDate = harvest.start_date ? formatDate(new Date(harvest.start_date)) : "N/A";
    const areaHarvested = harvest.land_area ? `${harvest.land_area} ha` : "N/A";
    const endDate = harvest.end_date ? formatDate(parseDate(harvest.end_date)) : "N/A";
    const production = harvest.total_harvested_crops ? `${convertToMetricTons(harvest.total_harvested_crops)} mt` : "N/A";
    const harvestDate = harvest.harvest_date ? formatDate(parseDate(harvest.harvest_date)) : "N/A";

    return [
      commodity,
      cropType,
      farmersCount.toString(),
      barangay,
      areaPlanted,
      startDate,
      areaHarvested,
      endDate,
      production,
      harvestDate
    ];
  });

  const columns = [
    "Commodity", "Type of Crop", "No. of Farmers", "Barangay",
    "Area Planted (ha)", "To Date", "Area Harvested (ha)", "To Date", "Production (mt)", "To Date"
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
    doc.text(`HARVEST PRODUCTION DATA ${reportYear}`, pageWidth / 2, 100, { align: "center" });
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