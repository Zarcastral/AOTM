import {
  collection,
  getDocs,
  getFirestore
} from "firebase/firestore";

import app from "../config/firebase_config.js";

const db = getFirestore(app);

async function fetchCrops() {
  console.log("Fetching crops..."); // Debugging
  try {
    const cropsCollection = collection(db, "tb_crop_types");
    const cropsSnapshot = await getDocs(cropsCollection);
    const cropsList = cropsSnapshot.docs.map(doc => doc.data());

    console.log("Crops fetched:", cropsList); // Debugging
    displayCrops(cropsList);
  } catch (error) {
    console.error("Error fetching crops:", error);
  }
}


function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows

  cropsList.forEach((crop, index) => {
    const row = document.createElement("tr");

    // Handle null/undefined fields
    const cropName = crop.crop_name || "No Name";
    const cropType = crop.crop_type_name || "No Type";
    const dateAdded = crop.dateAdded
    ? (crop.dateAdded.toDate ? crop.dateAdded.toDate().toLocaleDateString() : new Date(crop.dateAdded).toLocaleDateString()) 
    : "N/A";
      const currentStock = crop.current_stock || "0";
    const unit = crop.unit || "units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${index + 1}</td>
        <td>${cropName}</td>
        <td>${cropType}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
    `;

    tableBody.appendChild(row);
  });
}

// Run fetchCrops on DOMContentLoaded
document.addEventListener("DOMContentLoaded", fetchCrops);


// Fetch crop names for the dropdown
async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map(doc => doc.data().crop_name);

  populateCropDropdown(cropNames);
}

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



async function fetchFertilizer() {
  console.log("Fetching crops..."); // Debugging
  try {
    const fertilizerCollection = collection(db, "tb_fertilizer");
    const fertilizerSnapshot = await getDocs(fertilizerCollection);
    const fertilizerList = fertilizerSnapshot.docs.map(doc => doc.data());

    console.log("Fertilizers fetched:", fertilizerList); // Debugging
    displayFertilizer(fertilizerList);
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
  }
}


function displayFertilizer(fertilizerList) {
  const tableBody = document.querySelector(".fertilizer_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .fertilizer_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows

  fertilizerList.forEach((fertilizer, index) => {
    const row = document.createElement("tr");

    // Handle null/undefined fields
    const fertilizerName = fertilizer.fertilizer_name || "No Name";
    const fertilizerType = fertilizer.fertilizer_category || "No Type";
    const dateAdded = fertilizer.dateAdded
    ? (fertilizer.dateAdded.toDate ? fertilizer.dateAdded.toDate().toLocaleDateString() : new Date(fertilizer.dateAdded).toLocaleDateString()) 
    : "N/A";
      const currentStock = fertilizer.current_stock || "0";
    const unit = fertilizer.unit || "units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${index + 1}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizerType}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
    `;

    tableBody.appendChild(row);
  });
}

// Run fetchCrops on DOMContentLoaded
document.addEventListener("DOMContentLoaded", fetchFertilizer);


// Fetch crop names for the dropdown
async function fetchFertilizerNames() {
  const fertilizerCollection = collection(db, "tb_fertilizer_types");
  const fertilizerSnapshot = await getDocs(fertilizerCollection);
  const fertilizerNames = fertilizerSnapshot.docs.map(doc => doc.data().fertilizer_type_name);

  populateFertilizerDropdown(fertilizerNames);
}

function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");  
  if (!fertilizerSelect) {
    console.error("Fertilizer dropdown not found!");
    return;
  }

  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  fertilizerSelect.innerHTML = firstOption;

  // Add each fertilizer name as an option in the dropdown
  fertilizerNames.forEach(fertilizerName => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}


async function fetchEquipment() {
  console.log("Fetching crops..."); // Debugging
  try {
    const equipmentCollection = collection(db, "tb_equipment");
    const equipmentSnapshot = await getDocs(equipmentCollection);
    const equipmentList = equipmentSnapshot.docs.map(doc => doc.data());

    console.log("Equipments fetched:", equipmentList); // Debugging
    displayEquipment(equipmentList);
  } catch (error) {
    console.error("Error fetching equipments:", error);
  }
}


function displayEquipment(equipmentList) {
  const tableBody = document.querySelector(".equipment_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .equipment_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows

  equipmentList.forEach((equipment, index) => {
    const row = document.createElement("tr");

    // Handle null/undefined fields
    const equipmentName = equipment.equipment_name || "No Name";
    const equipmentType = equipment.equipment_category || "No Type";
    const dateAdded = equipment.dateAdded
    ? (equipment.dateAdded.toDate ? equipment.dateAdded.toDate().toLocaleDateString() : new Date(equipment.dateAdded).toLocaleDateString()) 
    : "N/A";
      const currentStock = equipment.current_stock || "0";
    const unit = equipment.unit || "units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${index + 1}</td>
        <td>${equipmentName}</td>
        <td>${equipmentType}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
    `;

    tableBody.appendChild(row);
  });
}

// Run fetchCrops on DOMContentLoaded
document.addEventListener("DOMContentLoaded", fetchEquipment);


// Fetch crop names for the dropdown
async function fetchEquipmentNames() {
  const equipmentCollection = collection(db, "tb_equipment_types");
  const equipmentSnapshot = await getDocs(equipmentCollection);
  const equipmentNames = equipmentSnapshot.docs.map(doc => doc.data().equipment_type_name);

  populateEquipmentDropdown(equipmentNames);
}

function populateEquipmentDropdown(equipmentNames) {
  const equipmentSelect = document.querySelector(".equipment_select");  
  if (!equipmentSelect) {
    console.error("equipment dropdown not found!");
    return;
  }

  const firstOption = equipmentSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  equipmentSelect.innerHTML = firstOption;

  // Add each equipment name as an option in the dropdown
  equipmentNames.forEach(equipmentName => {
    const option = document.createElement("option");
    option.textContent = equipmentName;
    equipmentSelect.appendChild(option);
  });
}

fetchCropNames();
fetchCrops();
fetchFertilizerNames();
fetchFertilizer();
fetchEquipmentNames();
fetchEquipment();