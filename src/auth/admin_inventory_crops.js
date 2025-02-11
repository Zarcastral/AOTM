import {
  collection,
  getDocs,
  getFirestore
} from "firebase/firestore";

import app from "../config/firebase_config.js";

const db = getFirestore(app);

let cropsList = []; // Declare cropsList globally for filtering
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = cropsList; // Declare a variable for filtered crops


// Fetch crops data from Firestore
async function fetchCrops() {
  console.log("Fetching crops..."); // Debugging
  try {
    const cropsCollection = collection(db, "tb_crop_types");
    const cropsSnapshot = await getDocs(cropsCollection);
    cropsList = cropsSnapshot.docs.map(doc => doc.data());

    console.log("Crops fetched:", cropsList); // Debugging
    displayCrops(cropsList);
  } catch (error) {
    console.error("Error fetching crops:", error);
  }
}

// Display crops in the table
function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows

  if (cropsList.length === 0) {
    // Show "No records found" if cropsList is empty
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="6" style="text-align: center; color: red;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  // Remove any "No records found" message if there are records
  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  // Render crops list in the table
  cropsList.forEach((crop, index) => {
    const row = document.createElement("tr");

    const cropName = crop.crop_name || "Crop Name not recorded";
    const cropType = crop.crop_type_name || "Crop Category not recorded.";
    const dateAdded = crop.dateAdded
      ? (crop.dateAdded.toDate ? crop.dateAdded.toDate().toLocaleDateString() : new Date(crop.dateAdded).toLocaleDateString())
      : "Date not recorded";
    const currentStock = crop.current_stock || "0";
    const unit = crop.unit || "Units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${index + 1}</td>
        <td>${cropType}</td>
        <td>${cropName}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
    `;

    tableBody.appendChild(row);
  });
  updatePagination();
}

// Update pagination display
function updatePagination() {
  document.getElementById("crop-page-number").textContent = `Page ${currentPage}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("crop-prev-page").disabled = currentPage === 1;
  document.getElementById("crop-next-page").disabled = (currentPage * rowsPerPage) >= filteredCrops.length;
}

// Event listener for "Previous" button
document.getElementById("crop-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayCrops(filteredCrops); // Pass filteredCrops to displayCrops
    updatePagination();
  }
});

// Event listener for "Next" button
document.getElementById("crop-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredCrops.length) {
    currentPage++;
    displayCrops(filteredCrops); // Pass filteredCrops to displayCrops
    updatePagination();
  }
});
// Fetch crop names for the dropdown
async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map(doc => doc.data().crop_name);

  populateCropDropdown(cropNames);
}

// Populate the crop dropdown with crop names
function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  cropSelect.innerHTML = firstOption;

  cropNames.forEach(cropName => {
    const option = document.createElement("option");
    option.textContent = cropName;
    cropSelect.appendChild(option);
  });
}
// ---------------------------- PAGINATION CODE ---------------------------- //
// Event listener to filter crops based on dropdown selection
document.querySelector(".crop_select").addEventListener("change", function () {
  const selectedCrop = this.value.toLowerCase();
  // Filter crops based on selected value
    filteredCrops = selectedCrop
    ? cropsList.filter(crop => crop.crop_name?.toLowerCase() === selectedCrop)
    : cropsList; // If no selection, show all crops

    currentPage = 1; // Reset to the first page when filter is applied
  displayCrops(filteredCrops); // Update the table with filtered crops
});

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchCrops();
});
