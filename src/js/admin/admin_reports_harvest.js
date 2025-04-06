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

// Global variable to store authenticated user details
let currentUser = null;

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

  try {
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
let harvestList = [];
let filteredHarvest = [];
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
            currentUser = {
              uid: user.uid,
              email: user.email,
              ...userDoc.data()
            };
            resolve(currentUser);
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

// Fetch harvest data for current user's project_creator from both tb_harvest and tb_harvest_history
async function fetchHarvest() {
  try {
    const user = await getAuthenticatedUser();
    const harvestCollection = collection(db, "tb_harvest");
    const harvestHistoryCollection = collection(db, "tb_harvest_history");
    const harvestQuery = query(
      harvestCollection,
      where("project_creator", "==", user.user_type)
    );
    const harvestHistoryQuery = query(
      harvestHistoryCollection,
      where("project_creator", "==", user.user_type)
    );

    // Listen to tb_harvest
    onSnapshot(harvestQuery, (harvestSnapshot) => {
      const harvestData = harvestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Listen to tb_harvest_history
      onSnapshot(harvestHistoryQuery, (historySnapshot) => {
        const historyData = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const combinedData = [...harvestData, ...historyData];
        
        harvestList = consolidateHarvestByCropType(combinedData);
        filteredHarvest = [...harvestList];
        filterHarvest();
      }, (error) => {
        console.error("Error listening to Harvest History:", error);
      });
    }, (error) => {
      console.error("Error listening to Harvest:", error);
    });
  } catch (error) {
    console.error("Error fetching Harvest:", error);
  }
}

// Function to convert kg to metric tons
function convertToMetricTons(kgValue) {
  if (!kgValue || isNaN(kgValue)) return 0;
  const mtValue = parseFloat(kgValue) / 1000;
  return Number(mtValue.toFixed(2));
}

// Consolidate harvest records by crop_type_name
function consolidateHarvestByCropType(harvestData) {
  const consolidated = {};

  harvestData.forEach(harvest => {
    const cropType = harvest.crop_type_name || "Unknown";
    if (!consolidated[cropType]) {
      consolidated[cropType] = {
        crop_type_name: cropType,
        crop_name: harvest.crop_name || "N/A",
        farmer_name: new Set(),
        barangay_name: harvest.barangay_name || "N/A",
        land_area: 0,
        start_date: [],
        end_date: [],
        harvest_date: [],
        total_harvested_crops: 0
      };
    }

    if (harvest.farmer_name && Array.isArray(harvest.farmer_name)) {
      harvest.farmer_name.forEach(farmer => consolidated[cropType].farmer_name.add(farmer));
    }
    if (harvest.land_area) consolidated[cropType].land_area += parseFloat(harvest.land_area) || 0;
    if (harvest.start_date) consolidated[cropType].start_date.push(parseDate(harvest.start_date));
    if (harvest.end_date) consolidated[cropType].end_date.push(parseDate(harvest.end_date));
    if (harvest.harvest_date) consolidated[cropType].harvest_date.push(parseDate(harvest.harvest_date));
    if (harvest.total_harvested_crops) {
      consolidated[cropType].total_harvested_crops += parseFloat(harvest.total_harvested_crops) || 0;
    }
  });

  return Object.values(consolidated).map(item => ({
    crop_name: item.crop_name,
    crop_type_name: item.crop_type_name,
    farmer_count: item.farmer_name.size,
    barangay_name: item.barangay_name,
    land_area: item.land_area,
    start_date: item.start_date.length ? item.start_date.sort((a, b) => a - b)[0] : null,
    end_date: item.end_date.length ? item.end_date.sort((a, b) => b - a)[0] : null,
    harvest_date: item.harvest_date.length ? item.harvest_date.sort((a, b) => b - a)[0] : null,
    production_mt: convertToMetricTons(item.total_harvested_crops)
  }));
}

// Fetch and populate barangay names
async function fetchBarangayNames() {
  const barangaysCollection = collection(db, "tb_barangay");
  const barangaysSnapshot = await getDocs(barangaysCollection);
  const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);
  populateBarangayDropdown(barangayNames);
}

function populateBarangayDropdown(barangayNames) {
  const barangaySelect = document.querySelector(".barangay_select");
  if (!barangaySelect) return;
  const firstOption = barangaySelect.querySelector("option")?.outerHTML || "";
  barangaySelect.innerHTML = firstOption;

  barangayNames.forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    option.value = name;
    barangaySelect.appendChild(option);
  });
}

// Fetch and populate crop type names
async function fetchCropTypeNames() {
  const cropTypesCollection = collection(db, "tb_crop_types");
  const cropTypesSnapshot = await getDocs(cropTypesCollection);
  const cropTypeNames = cropTypesSnapshot.docs.map(doc => doc.data().crop_type_name);
  populateCropTypeDropdown(cropTypeNames);
}

function populateCropTypeDropdown(cropTypeNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) return;
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";
  cropSelect.innerHTML = firstOption;

  cropTypeNames.forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    option.value = name;
    cropSelect.appendChild(option);
  });
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

// Filter harvest data
function filterHarvest() {
  const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();
  const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
  const selectedCropType = document.querySelector(".crop_select").value.toLowerCase();

  filteredHarvest = [...harvestList];

  if (searchQuery) {
    filteredHarvest = filteredHarvest.filter(harvest => 
      harvest.crop_name?.toLowerCase().includes(searchQuery) ||
      harvest.crop_type_name?.toLowerCase().includes(searchQuery)
    );
  }

  if (selectedBarangay) {
    filteredHarvest = filteredHarvest.filter(harvest => 
      harvest.barangay_name?.toLowerCase().includes(selectedBarangay)
    );
  }

  if (selectedCropType) {
    filteredHarvest = filteredHarvest.filter(harvest => 
      harvest.crop_type_name?.toLowerCase() === selectedCropType
    );
  }

  if (selectedMonth) {
    filteredHarvest = filteredHarvest.filter(harvest => {
      const harvestDate = harvest.harvest_date ? parseDate(harvest.harvest_date) : null;
      return harvestDate?.getMonth() + 1 === selectedMonth && 
             harvestDate?.getFullYear() === selectedYear;
    });
  }

  currentPage = 1;
  filteredHarvest.sort((a, b) => a.crop_type_name.localeCompare(b.crop_type_name));
  displayHarvest(filteredHarvest);
}

// Display harvest in table
function displayHarvest(harvestList) {
  const tableBody = document.querySelector(".harvest_table table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHarvest = harvestList.slice(startIndex, endIndex);

  if (paginatedHarvest.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center;">No records found</td></tr>`;
    return;
  }

  paginatedHarvest.forEach(harvest => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${harvest.crop_name || "N/A"}</td>
      <td>${harvest.crop_type_name || "N/A"}</td>
      <td>${harvest.farmer_count || 0}</td>
      <td>${harvest.barangay_name || "N/A"}</td>
      <td>${harvest.land_area || "N/A"}</td>
      <td>${formatDate(harvest.start_date)}</td>
      <td>${harvest.land_area || "N/A"}</td>
      <td>${formatDate(harvest.end_date)}</td>
      <td>${harvest.production_mt ? `${harvest.production_mt} mt` : "N/A"}</td>
      <td>${formatDate(harvest.harvest_date)}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

// Update pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredHarvest.length / rowsPerPage) || 1;
  document.getElementById("harvest-page-number").textContent = `${currentPage} of ${totalPages}`;
  document.getElementById("harvest-prev-page").disabled = currentPage === 1;
  document.getElementById("harvest-next-page").disabled = currentPage >= totalPages;
}

// Show month picker
function showMonthPicker() {
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  const monthPicker = document.getElementById('month-picker');
  const yearDisplay = document.getElementById('year-display');
  
  if (yearDisplay) yearDisplay.textContent = selectedYear;

  monthPicker.style.position = 'absolute';
  monthPicker.style.top = `${calendarIcon.offsetHeight + 5}px`;
  monthPicker.style.right = '0px';
  monthPicker.style.left = 'auto';
  monthPicker.style.display = monthPicker.style.display === 'none' ? 'block' : 'none';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchBarangayNames();
  fetchCropTypeNames();
  fetchHarvest();

  const calendarIcon = document.querySelector('.calendar-btn-icon');
  if (calendarIcon) calendarIcon.addEventListener('click', showMonthPicker);

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
    filterHarvest();
  });

  document.getElementById('next-year').addEventListener('click', () => {
    selectedYear++;
    document.getElementById('year-display').textContent = selectedYear;
    filterHarvest();
  });

  document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      selectedMonth = index + 1;
      filterHarvest();
      document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
      btn.style.backgroundColor = '#41A186';
      document.getElementById('month-picker').style.display = 'none';
      document.querySelector('.calendar-btn-icon').style.filter = 'brightness(0.5)';
    });
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    selectedMonth = null;
    selectedYear = new Date().getFullYear();
    document.querySelector('.calendar-btn-icon').style.filter = 'none';
    document.querySelectorAll('#month-picker .month-btn').forEach(btn => {
      btn.style.backgroundColor = 'transparent';
    });
    document.getElementById('year-display').textContent = selectedYear;
    filterHarvest();
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

// PDF generation
document.getElementById("download-btn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fullName = `${currentUser.first_name || "Unknown"} ${currentUser.middle_name ? currentUser.middle_name.charAt(0) + "." : ""} ${currentUser.last_name || "User"}`.trim();
  const userTypePrint = currentUser.user_type || "Unknown";
  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const tableData = filteredHarvest.map(harvest => [
    harvest.crop_name || "N/A",
    harvest.crop_type_name || "N/A",
    harvest.farmer_count.toString() || "0",
    harvest.barangay_name || "N/A",
    harvest.land_area.toString() || "N/A",
    formatDate(harvest.start_date),
    harvest.land_area.toString() || "N/A",
    formatDate(harvest.end_date),
    harvest.production_mt ? `${harvest.production_mt} mt` : "N/A",
    formatDate(harvest.harvest_date)
  ]);

  const columns = [
    "Commodity", "Type of Crop", "No. of Farmers Served", "Barangay",
    "Area Planted (ha)", "To Date", "Area Harvested (ha)", "To Date",
    "Production (mt)", "To Date"
  ];

  const columnWidths = [25, 25, 20, 30, 20, 20, 20, 20, 25, 25];
  const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

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
    doc.text(`AGRICULTURAL PRODUCTION DATA ${selectedYear || new Date().getFullYear()}`, pageWidth / 2, 100, { align: "center" });
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

  let currentPage = 0;
  const rowsPerPage = Math.floor((pageHeight - 65 - 105) / 10);

  while (currentPage * rowsPerPage < tableData.length) {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
    const pageData = tableData.slice(startIndex, endIndex);

    if (currentPage > 0) doc.addPage();

    addHeader(doc);
    doc.autoTable({
      startY: 105,
      head: [columns],
      body: pageData,
      theme: "grid",
      margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
      styles: { fontSize: 5, cellPadding: 1, overflow: "linebreak", font: "helvetica", textColor: [51, 51, 51], lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
      headStyles: { fillColor: [255, 255, 255], textColor: [65, 161, 134], fontSize: 7, font: "helvetica", fontStyle: "bold", lineColor: [132, 138, 156], lineWidth: 0.1, halign: "center", valign: "top" },
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
    await saveActivityLog("Create", `Harvest Report downloaded by ${userTypePrint} ${fullName}`);
    previewPanel.style.display = "none";
    document.body.classList.remove("preview-active");
    URL.revokeObjectURL(pdfUrl);
  };
});