import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  query,
  where,

  getFirestore,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
import { toggleLoadingIndicator } from "../../auth/loading.js"; // Import loading indicator
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// Lock flag to prevent multiple saveProject executions
let isSaving = false;

// Function to get authenticated user
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(
            collection(db, "tb_users"),
            where("email", "==", user.email)
          );
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            resolve(userData.user_type);
          } else {
            reject("User record not found.");
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject("User not authenticated.");
      }
    });
  });
}

// Load project data from localStorage
async function loadProjectData() {
  const projectDataString = localStorage.getItem("projectData");
  if (!projectDataString) {
    console.warn("No project data found in localStorage.");
    return;
  }

  try {
    const projectData = JSON.parse(projectDataString);
    console.log("Loaded projectData from localStorage:", projectData);

    // Populate basic fields
    document.getElementById("project-name").value = projectData.project_name || "";
    document.getElementById("status").value = projectData.status || "Pending";
    document.getElementById("barangay").value = projectData.barangay_name || "";
    document.getElementById("start-date").value = projectData.start_date || "";
    document.getElementById("end-date").value = projectData.end_date || "";

    // Load related dropdowns
    await loadFarmPresidents(projectData.farmer_id);
    await loadCrops(projectData.crop_name);
    await loadCropTypes(projectData.crop_name, projectData.crop_type_name);

    // Set crop quantity and unit
    const quantityInput = document.getElementById("quantity-crop-type");
    quantityInput.value = projectData.crop_type_quantity || "";
    document.getElementById("crop-unit").value = projectData.crop_unit || "kg";
    console.log("Set crop_type_quantity:", projectData.crop_type_quantity);

    // Load fertilizer records
    if (projectData.fertilizer && Array.isArray(projectData.fertilizer)) {
      console.log("Loading fertilizers:", projectData.fertilizer);
      const container = document.getElementById("fertilizer-container");
      container.innerHTML = ""; // Clear existing content
      for (const fert of projectData.fertilizer) {
        console.log("Adding fertilizer:", fert);
        await addFertilizerForm(fert, true); // Bypass duplicate check
      }
    } else {
      console.warn("No fertilizer data found or invalid format:", projectData.fertilizer);
    }

    // Load equipment records
    if (projectData.equipment && Array.isArray(projectData.equipment)) {
      console.log("Loading equipment:", projectData.equipment);
      const container = document.getElementById("equipment-container");
      container.innerHTML = ""; // Clear existing content
      for (const equip of projectData.equipment) {
        console.log("Adding equipment:", equip);
        await addEquipmentForm(equip, true); // Bypass duplicate check
      }
    } else {
      console.warn("No equipment data found or invalid format:", projectData.equipment);
    }
  } catch (error) {
    console.error("Error loading project data:", error);
  }
}

// Load farm presidents
window.loadFarmPresidents = async function (selectedFarmerId = null) {
  const querySnapshot = await getDocs(
    query(
      collection(db, "tb_farmers"),
      where("user_type", "==", "Farm President")
    )
  );
  const assignToSelect = document.getElementById("assign-to");
  assignToSelect.innerHTML = '<option value="">Select Farm President</option>';

  let selectedSet = false;
  querySnapshot.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().first_name;
    if (selectedFarmerId && doc.data().farmer_id === selectedFarmerId) {
      option.selected = true;
      selectedSet = true;
    }
    assignToSelect.appendChild(option);
  });

  if (selectedSet) {
    loadBarangay(assignToSelect.value);
  }
};

// Load barangay based on farm president
window.loadBarangay = async function (farmPresidentId) {
  const barangayInput = document.getElementById("barangay");
  const projectDataString = localStorage.getItem("projectData");
  const projectData = projectDataString ? JSON.parse(projectDataString) : {};
  const selectedFarmland = projectData.farm_land || null;

  if (!farmPresidentId) {
    barangayInput.value = "";
    await loadFarmland("");
    return;
  }

  try {
    const docRef = doc(db, "tb_farmers", farmPresidentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const barangayName = docSnap.data().barangay_name || "N/A";
      barangayInput.value = barangayName;
      await loadFarmland(barangayName, selectedFarmland);
    } else {
      barangayInput.value = "";
      await loadFarmland("");
    }
  } catch (error) {
    console.error("Error loading barangay:", error);
    barangayInput.value = "Error";
    await loadFarmland("");
  }
};

// Load farmland based on barangay
window.loadFarmland = async function (barangayName, selectedFarmland = null) {
  const farmlandSelect = document.getElementById("farmland");
  farmlandSelect.innerHTML = '<option value="">Select Farmland</option>';

  if (!barangayName) {
    farmlandSelect.disabled = true;
    return;
  }

  farmlandSelect.disabled = false;
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, "tb_farmland"),
        where("barangay_name", "==", barangayName)
      )
    );

    let foundSelected = false;
    querySnapshot.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().farmland_name;
      if (selectedFarmland && doc.data().farmland_name === selectedFarmland) {
        option.selected = true;
        foundSelected = true;
      }
      farmlandSelect.appendChild(option);
    });

    if (selectedFarmland && !foundSelected) {
      farmlandSelect.value = "";
    }
  } catch (error) {
    console.error("Error loading farmland:", error);
    farmlandSelect.innerHTML = '<option value="">Error loading farmland</option>';
  }
};

// Load crops
window.loadCrops = async function (selectedCrop = null) {
  const cropsSelect = document.getElementById("crops");
  const userType = sessionStorage.getItem("user_type");

  if (!cropsSelect || !userType) return;

  try {
    const querySnapshot = await getDocs(collection(db, "tb_crop_stock"));
    const uniqueCrops = new Set();

    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];
      const isOwnedByUser = stocksArray.some(
        (stock) => stock.owned_by === userType
      );

      if (isOwnedByUser && cropData.crop_name) {
        uniqueCrops.add(cropData.crop_name.trim());
      }
    });

    cropsSelect.innerHTML = '<option value="">Select Crop</option>';
    uniqueCrops.forEach((crop) => {
      const option = document.createElement("option");
      option.value = crop;
      option.textContent = crop;
      if (selectedCrop && crop === selectedCrop) {
        option.selected = true;
      }
      cropsSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading crops:", error);
  }
};

// Load crop types
window.loadCropTypes = async function (selectedCrop, selectedCropType = null) {
  if (!selectedCrop) return;

  const cropTypeSelect = document.getElementById("crop-type");
  cropTypeSelect.innerHTML = '<option value="">Select Crop Type</option>';
  const userType = sessionStorage.getItem("user_type");

  window.cropStockMap = {};
  const querySnapshot = await getDocs(
    query(
      collection(db, "tb_crop_stock"),
      where("crop_name", "==", selectedCrop)
    )
  );

  querySnapshot.forEach((doc) => {
    const cropData = doc.data();
    const cropTypeName = cropData.crop_type_name;
    const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];
    const userStock = stocksArray.find((stock) => stock.owned_by === userType);
    const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

    window.cropStockMap[cropTypeName] = currentStock;

    const option = document.createElement("option");
    option.value = cropTypeName;
    option.textContent = `${cropTypeName} ${
      currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
    }`;
    if (selectedCropType && cropTypeName === selectedCropType) {
      option.selected = true;
    }
    cropTypeSelect.appendChild(option);
  });

  cropTypeSelect.addEventListener("change", function () {
    const selectedCropType = this.value;
    const maxStock = window.cropStockMap[selectedCropType] || 0;
    const quantityInput = document.getElementById("quantity-crop-type");

    quantityInput.value = "";
    quantityInput.disabled = maxStock === 0;
    quantityInput.placeholder = maxStock > 0 ? `Max: ${maxStock}` : "Out of stock";
  });

  const quantityInput = document.getElementById("quantity-crop-type");
  quantityInput.addEventListener("input", function () {
    // No automatic disabling
  });

  if (selectedCropType) {
    cropTypeSelect.dispatchEvent(new Event("change"));
  }
};

// Add fertilizer form
window.addFertilizerForm = async function (fertData = null, bypassDuplicateCheck = false) {
  const container = document.getElementById("fertilizer-container");
  const existingFertilizers = bypassDuplicateCheck
    ? []
    : Array.from(container.querySelectorAll(".fertilizer__group")).map(group => {
        const type = group.querySelector(".fertilizer__type").value;
        const name = group.querySelector(".fertilizer__name").value;
        return `${type}:${name}`;
      });

  const div = document.createElement("div");
  div.classList.add("fertilizer__group");

  const fertilizerTypes = await getFertilizerTypes();

  div.innerHTML = `
    <div class="form__group">
      <label class="form__label">Fertilizer Type:</label>
      <select class="form__select1 fertilizer__type">
        <option value="">Select Fertilizer Type</option>
        ${fertilizerTypes.map((type) => `<option value="${type}">${type}</option>`).join("")}
      </select>
    </div>
    <div class="form__group">
      <label class="form__label">Fertilizer Name:</label>
      <select class="form__select fertilizer__name">
        <option value="">Select Fertilizer Type First</option>
      </select>
    </div>
    <div class="form__group">
      <label class="form__label">Fertilizer Quantity:</label>
      <input type="number" class="form__input fertilizer__quantity" placeholder="Available Stock: -">
    </div>
    <button class="btn btn--remove" onclick="window.removeFertilizerForm(this)">Remove</button>
  `;

  container.appendChild(div); // Append immediately

  const fertilizerTypeDropdown = div.querySelector(".fertilizer__type");
  const fertilizerNameDropdown = div.querySelector(".fertilizer__name");
  const quantityInput = div.querySelector(".fertilizer__quantity");

  fertilizerTypeDropdown.addEventListener("change", function () {
    loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput, fertData);
  });

  fertilizerNameDropdown.addEventListener("change", function () {
    const selectedType = fertilizerTypeDropdown.value;
    const selectedName = this.value;
    const key = `${selectedType}:${selectedName}`;

    if (!bypassDuplicateCheck && selectedType && selectedName && existingFertilizers.includes(key)) {
      showprojectUpdateMessage(`Fertilizer '${selectedName}' of type '${selectedType}' is already added.`, false);
      div.remove();
      return;
    }
  });

  if (fertData) {
    console.log("Populating fertilizer form with:", fertData);
    fertilizerTypeDropdown.value = fertData.fertilizer_type || "";
    await loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput, fertData);
    fertilizerNameDropdown.value = fertData.fertilizer_name || "";
    quantityInput.value = fertData.fertilizer_quantity || "";
    fertilizerNameDropdown.dispatchEvent(new Event("change"));
  }
};

// Get fertilizer types
async function getFertilizerTypes() {
  const userType = sessionStorage.getItem("user_type");
  if (!userType) return [];

  const querySnapshot = await getDocs(collection(db, "tb_fertilizer_stock"));
  const uniqueTypes = new Set();

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.stocks) && data.stocks.some(stock => stock.owned_by === userType)) {
      uniqueTypes.add(data.fertilizer_type);
    }
  });

  return Array.from(uniqueTypes);
}

// Load fertilizer names with stock
async function loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput, fertData = null) {
  const selectedType = fertilizerTypeDropdown.value;
  fertilizerNameDropdown.innerHTML = '<option value="">Select Fertilizer Name</option>';
  const userType = sessionStorage.getItem("user_type");

  if (!selectedType || !userType) return;

  const q = query(
    collection(db, "tb_fertilizer_stock"),
    where("fertilizer_type", "==", selectedType)
  );
  const querySnapshot = await getDocs(q);

  window.fertilizerStockMap = window.fertilizerStockMap || {};

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const stocksArray = Array.isArray(data.stocks) ? data.stocks : [];
    const userStock = stocksArray.find((stock) => stock.owned_by === userType);
    const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

    window.fertilizerStockMap[data.fertilizer_name] = currentStock;

    const option = document.createElement("option");
    option.value = data.fertilizer_name;
    // Show both record quantity (if applicable) and current stock
    const recordQty = fertData && fertData.fertilizer_name === data.fertilizer_name && fertData.fertilizer_type === selectedType
      ? fertData.fertilizer_quantity
      : null;
    option.textContent = `${data.fertilizer_name} ${
      recordQty !== null ? `(Qty: ${recordQty}, Stock: ${currentStock})` : `(Stock: ${currentStock})`
    }${currentStock === 0 ? " - Out of Stock" : ""}`;
    fertilizerNameDropdown.appendChild(option);
  });

  fertilizerNameDropdown.addEventListener("change", function () {
    const selectedFertilizer = this.value;
    const maxStock = window.fertilizerStockMap[selectedFertilizer] || 0;
    quantityInput.disabled = maxStock === 0;
    quantityInput.placeholder = maxStock > 0 ? `Max: ${maxStock}` : "Out of stock";
    // Only reset quantity if not pre-populated or if changing to a different item
    if (!fertData || fertData.fertilizer_name !== selectedFertilizer) {
      quantityInput.value = "";
    }
  });

  quantityInput.addEventListener("input", function () {
    // No automatic disabling
  });
}

// Add equipment form
window.addEquipmentForm = async function (equipData = null, bypassDuplicateCheck = false) {
  const container = document.getElementById("equipment-container");
  const existingEquipment = bypassDuplicateCheck
    ? []
    : Array.from(container.querySelectorAll(".equipment__group")).map(group => {
        const type = group.querySelector(".equipment__type").value;
        const name = group.querySelector(".equipment__name").value;
        return `${type}:${name}`;
      });

  const div = document.createElement("div");
  div.classList.add("equipment__group");

  const equipmentTypes = await getEquipmentTypes();

  div.innerHTML = `
    <div class="form__group">
      <label class="form__label">Equipment Type:</label>
      <select class="form__select1 equipment__type">
        <option value="">Select Equipment Type</option>
        ${equipmentTypes.map((type) => `<option value="${type}">${type}</option>`).join("")}
      </select>
    </div>
    <div class="form__group">
      <label class="form__label">Equipment Name:</label>
      <select class="form__select equipment__name">
        <option value="">Select Equipment Type First</option>
      </select>
    </div>
    <div class="form__group">
      <label class="form__label">Equipment Quantity:</label>
      <input type="number" class="form__input equipment__quantity">
    </div>
    <button class="btn btn--remove" onclick="window.removeEquipmentForm(this)">Remove</button>
  `;

  container.appendChild(div); // Append immediately

  const equipmentTypeDropdown = div.querySelector(".equipment__type");
  const equipmentNameDropdown = div.querySelector(".equipment__name");
  const quantityInput = div.querySelector(".equipment__quantity");

  equipmentTypeDropdown.addEventListener("change", function () {
    loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput, equipData);
  });

  equipmentNameDropdown.addEventListener("change", function () {
    const selectedType = equipmentTypeDropdown.value;
    const selectedName = this.value;
    const key = `${selectedType}:${selectedName}`;

    if (!bypassDuplicateCheck && selectedType && selectedName && existingEquipment.includes(key)) {
      showprojectUpdateMessage(`Equipment '${selectedName}' of type '${selectedType}' is already added.`, false);
      div.remove();
      return;
    }
  });

  if (equipData) {
    console.log("Populating equipment form with:", equipData);
    equipmentTypeDropdown.value = equipData.equipment_type || "";
    await loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput, equipData);
    equipmentNameDropdown.value = equipData.equipment_name || "";
    quantityInput.value = equipData.equipment_quantity || "";
    equipmentNameDropdown.dispatchEvent(new Event("change"));
  }
};

// Get equipment types
async function getEquipmentTypes() {
  const userType = sessionStorage.getItem("user_type");
  if (!userType) return [];

  const querySnapshot = await getDocs(collection(db, "tb_equipment_stock"));
  const uniqueTypes = new Set();

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.stocks) && data.stocks.some(stock => stock.owned_by === userType)) {
      uniqueTypes.add(data.equipment_type);
    }
  });

  return Array.from(uniqueTypes);
}

// Load equipment names with stock
async function loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput, equipData = null) {
  const selectedType = equipmentTypeDropdown.value;
  equipmentNameDropdown.innerHTML = '<option value="">Select Equipment Name</option>';
  const userType = sessionStorage.getItem("user_type");

  if (!selectedType || !userType) return;

  const q = query(
    collection(db, "tb_equipment_stock"),
    where("equipment_type", "==", selectedType)
  );
  const querySnapshot = await getDocs(q);

  window.equipmentStockMap = window.equipmentStockMap || {};

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const stocksArray = Array.isArray(data.stocks) ? data.stocks : [];
    const userStock = stocksArray.find((stock) => stock.owned_by === userType);
    const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

    window.equipmentStockMap[data.equipment_name] = currentStock;

    const option = document.createElement("option");
    option.value = data.equipment_name;
    // Show both record quantity (if applicable) and current stock
    const recordQty = equipData && equipData.equipment_name === data.equipment_name && equipData.equipment_type === selectedType
      ? equipData.equipment_quantity
      : null;
    option.textContent = `${data.equipment_name} ${
      recordQty !== null ? `(Qty: ${recordQty}, Stock: ${currentStock})` : `(Stock: ${currentStock})`
    }${currentStock === 0 ? " - Out of Stock" : ""}`;
    equipmentNameDropdown.appendChild(option);
  });

  equipmentNameDropdown.addEventListener("change", function () {
    const selectedEquipment = this.value;
    const maxStock = window.equipmentStockMap[selectedEquipment] || 0;
    quantityInput.disabled = maxStock === 0;
    quantityInput.placeholder = maxStock > 0 ? `Max: ${maxStock}` : "Out of stock";
    // Only reset quantity if not pre-populated or if changing to a different item
    if (!equipData || equipData.equipment_name !== selectedEquipment) {
      quantityInput.value = "";
    }
  });

  quantityInput.addEventListener("input", function () {
    // No automatic disabling
  });
}

// Remove fertilizer form
window.removeFertilizerForm = function (button) {
  button.parentElement.remove();
};

// Remove equipment form
window.removeEquipmentForm = function (button) {
  button.parentElement.remove();
};

// Get next project ID
window.getNextProjectID = async function () {
  const counterRef = doc(db, "tb_id_counters", "projects_id_counter");
  const counterSnap = await getDoc(counterRef);

  let newProjectID = 1;
  if (counterSnap.exists()) {
    newProjectID = counterSnap.data().count + 1;
  }

  await setDoc(counterRef, { count: newProjectID }, { merge: true });
  return newProjectID;
};

// Get farmland ID
window.getFarmlandId = async function (farmlandName) {
  if (!farmlandName) return null;

  const q = query(
    collection(db, "tb_farmland"),
    where("farmland_name", "==", farmlandName)
  );
  const querySnapshot = await getDocs(q);

  return !querySnapshot.empty ? querySnapshot.docs[0].data().farmland_id : null;
};

// Get farmer ID by name
async function getFarmerIdByName(farmPresidentName) {
  try {
    const farmersQuery = query(
      collection(db, "tb_farmers"),
      where("first_name", "==", farmPresidentName)
    );
    const farmersQuerySnapshot = await getDocs(farmersQuery);

    if (!farmersQuerySnapshot.empty) {
      return farmersQuerySnapshot.docs[0].data().farmer_id.toString();
    }
    return null;
  } catch (error) {
    console.error("Error fetching farmer_id:", error);
    return null;
  }
}

// Update save button state
function updateSaveButtonState() {
  const saveButton = document.getElementById("save-button");
  saveButton.disabled = false; // Always enabled
}

// Reset form
function resetForm() {
  document.getElementById("project-name").value = "";
  document.getElementById("assign-to").selectedIndex = 0;
  document.getElementById("status").value = "Pending";
  document.getElementById("crops").selectedIndex = 0;
  document.getElementById("barangay").value = "";
  document.getElementById("farmland").innerHTML = '<option value="">Select Farmland</option>';
  document.getElementById("crop-type").innerHTML = '<option value="">Select Crop Type</option>';
  document.getElementById("quantity-crop-type").value = "";
  document.getElementById("crop-unit").value = "kg";
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  document.getElementById("fertilizer-container").innerHTML = "";
  document.getElementById("equipment-container").innerHTML = "";
  localStorage.removeItem("projectData");

  setTimeout(() => {
    window.location.href = "admin_projects_list.html";
  }, 500);
}

// Check if value is a Firestore Timestamp
function isTimestampObject(value) {
  return value && typeof value === "object" && "seconds" in value && "nanoseconds" in value;
}

// Save project
window.saveProject = async function () {
  if (isSaving) {
    showprojectUpdateMessage("Save operation is already in progress. Please wait.", false);
    return;
  }

  isSaving = true;
  const cancelButton = document.getElementById("cancel-button");
  const saveButton = document.getElementById("save-button");
  cancelButton.disabled = true;
  saveButton.disabled = true;

  // Show loading indicator
  toggleLoadingIndicator(true);

  try {
    const userType = sessionStorage.getItem("user_type");
    const projectName = document.getElementById("project-name").value.trim();
    const assignToSelect = document.getElementById("assign-to");
    const farmPresidentName = assignToSelect.options[assignToSelect.selectedIndex].text;
    const status = document.getElementById("status").value;
    const cropName = document.getElementById("crops").value;
    const barangayName = document.getElementById("barangay").value.trim();
    const farmlandSelect = document.getElementById("farmland");
    const farmlandName = farmlandSelect.options[farmlandSelect.selectedIndex].text;
    const farmlandId = await getFarmlandId(farmlandName);
    const cropTypeName = document.getElementById("crop-type").value;
    const quantityCropType = parseInt(document.getElementById("quantity-crop-type").value.trim()) || 0;
    const cropUnit = document.getElementById("crop-unit").value.trim();
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    console.log("quantityCropType before validation:", quantityCropType);

    if (!projectName) {
      throw new Error("Project name is required");
    }
    if (!assignToSelect.value || farmPresidentName === "Select Farm President") {
      throw new Error("Please select a Farm President");
    }
    if (!cropName || cropName === "Select Crop") {
      throw new Error("Please select a crop");
    }
    if (!farmlandName || farmlandName === "Select Farmland") {
      throw new Error("Please select a farmland");
    }
    if (!cropTypeName || cropTypeName === "Select Crop Type") {
      throw new Error("Please select a crop type");
    }
    if (!quantityCropType || quantityCropType <= 0) {
      throw new Error("Crop quantity must be a positive number");
    }
    if (!cropUnit) {
      throw new Error("Crop unit is required");
    }
    if (!startDate) {
      throw new Error("Start date is required");
    }
    if (!endDate) {
      throw new Error("End date is required");
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (endDateObj < startDateObj) {
      throw new Error("The end date cannot be earlier than the start date. Please fix it.");
    }

    const farmerId = await getFarmerIdByName(farmPresidentName);
    if (!farmerId) {
      throw new Error(`Farm President '${farmPresidentName}' not found.`);
    }

    const fertilizerGroups = document.querySelectorAll(".fertilizer__group");
    let fertilizerData = [];
    fertilizerGroups.forEach((group) => {
      const type = group.querySelector(".fertilizer__type").value;
      const name = group.querySelector(".fertilizer__name").value;
      const quantity = parseInt(group.querySelector(".fertilizer__quantity").value) || 0;
      if (type && name && quantity >= 0) {
        fertilizerData.push({
          fertilizer_type: type,
          fertilizer_name: name,
          fertilizer_quantity: quantity,
          fertilizer_unit: "kg",
        });
      }
    });

    const equipmentGroups = document.querySelectorAll(".equipment__group");
    let equipmentData = [];
    equipmentGroups.forEach((group) => {
      const type = group.querySelector(".equipment__type").value;
      const name = group.querySelector(".equipment__name").value;
      const quantity = parseInt(group.querySelector(".equipment__quantity").value) || 0;
      if (type && name && quantity >= 0) {
        equipmentData.push({
          equipment_type: type,
          equipment_name: name,
          equipment_quantity: quantity,
        });
      }
    });

    const projectDataString = localStorage.getItem("projectData");
    if (!projectDataString) {
      throw new Error("No project data found to update. Please select a project to edit first.");
    }

    const existingProjectData = JSON.parse(projectDataString);
    const projectID = existingProjectData.project_id;
    const projectCreator = existingProjectData.project_creator;

    const currentDateString = new Date().toISOString().split("T")[0];
    const currentDateTimestamp = Timestamp.fromDate(new Date());

    const cropDateOriginal = existingProjectData.crop_date;
    const fertilizerDateOriginal = existingProjectData.fertilizer_date;
    const equipmentDateOriginal = existingProjectData.equipment_date;

    const cropDate = isTimestampObject(cropDateOriginal)
      ? currentDateTimestamp
      : currentDateString;

    const fertilizerDate = isTimestampObject(fertilizerDateOriginal)
      ? currentDateTimestamp
      : currentDateString;

    const equipmentDate = isTimestampObject(equipmentDateOriginal)
      ? currentDateTimestamp
      : currentDateString;

    const projectData = {
      project_id: projectID,
      project_name: projectName,
      farm_president: farmPresidentName,
      farmer_id: farmerId,
      status: status,
      crop_name: cropName,
      barangay_name: barangayName,
      farm_land: farmlandName,
      farmland_id: farmlandId,
      crop_type_name: cropTypeName,
      crop_type_quantity: quantityCropType,
      crop_unit: cropUnit,
      start_date: startDate,
      end_date: endDate,
      fertilizer: fertilizerData,
      equipment: equipmentData,
      crop_date: cropDate,
      fertilizer_date: fertilizerDate,
      equipment_date: equipmentDate,
      date_created: existingProjectData.date_created,
      project_creator: projectCreator,
    };

    console.log("projectData before save:", projectData);

    // Crop Stock Update
    const originalCropQuantity = parseInt(existingProjectData.crop_type_quantity) || 0;
    const cropQuantityDiff = quantityCropType - originalCropQuantity;
    console.log("originalCropQuantity:", originalCropQuantity, "quantityCropType:", quantityCropType, "cropQuantityDiff:", cropQuantityDiff);
    if (cropQuantityDiff !== 0) {
      const cropQuery = query(
        collection(db, "tb_crop_stock"),
        where("crop_type_name", "==", cropTypeName)
      );
      const cropSnapshot = await getDocs(cropQuery);
      if (!cropSnapshot.empty) {
        const cropDoc = cropSnapshot.docs[0];
        const cropDocRef = cropDoc.ref;
        const cropData = cropDoc.data();
        const stocksArray = cropData.stocks || [];
        const stockIndex = stocksArray.findIndex(stock => stock.owned_by === projectCreator);

        if (stockIndex !== -1) {
          const currentStock = parseInt(stocksArray[stockIndex].current_stock) || 0;
          const newStock = currentStock - cropQuantityDiff;

          if (newStock < 0) {
            throw new Error(`Not enough stock for: ${cropTypeName}. Available stock is: ${currentStock}.`);
          }

          stocksArray[stockIndex].current_stock = newStock;
          await updateDoc(cropDocRef, { stocks: stocksArray });
        } else {
          throw new Error(`No stock entry found for '${cropTypeName}' owned by ${projectCreator}`);
        }
      } else {
        throw new Error(`Crop type '${cropTypeName}' not found in inventory`);
      }
    }

    // Fertilizer Stock Update
    const originalFertilizerMap = new Map(
      (existingProjectData.fertilizer || []).map(f => [`${f.fertilizer_type}:${f.fertilizer_name}`, f.fertilizer_quantity])
    );
    for (const newFert of fertilizerData) {
      const key = `${newFert.fertilizer_type}:${newFert.fertilizer_name}`;
      const originalQuantity = originalFertilizerMap.get(key) || 0;
      const fertQuantityDiff = newFert.fertilizer_quantity - originalQuantity;

      if (fertQuantityDiff !== 0) {
        const fertQuery = query(
          collection(db, "tb_fertilizer_stock"),
          where("fertilizer_type", "==", newFert.fertilizer_type),
          where("fertilizer_name", "==", newFert.fertilizer_name)
        );
        const fertSnapshot = await getDocs(fertQuery);
        if (!fertSnapshot.empty) {
          const fertDoc = fertSnapshot.docs[0];
          const fertDocRef = fertDoc.ref;
          const fertData = fertDoc.data();
          const stocksArray = fertData.stocks || [];
          const stockIndex = stocksArray.findIndex(stock => stock.owned_by === projectCreator);

          if (stockIndex !== -1) {
            const currentStock = parseInt(stocksArray[stockIndex].current_stock) || 0;
            const newStock = currentStock - fertQuantityDiff;

            if (newStock < 0) {
              throw new Error(`Not enough stock for: ${newFert.fertilizer_name}. Available stock is: ${currentStock}.`);
            }

            stocksArray[stockIndex].current_stock = newStock;
            await updateDoc(fertDocRef, { stocks: stocksArray });
          } else {
            throw new Error(`No stock entry found for '${newFert.fertilizer_name}' owned by ${projectCreator}`);
          }
        } else {
          throw new Error(`Fertilizer '${newFert.fertilizer_name}' not found in inventory`);
        }
      }
      originalFertilizerMap.delete(key);
    }
    for (const [key, originalQuantity] of originalFertilizerMap) {
      const [type, name] = key.split(":");
      const fertQuery = query(
        collection(db, "tb_fertilizer_stock"),
        where("fertilizer_type", "==", type),
        where("fertilizer_name", "==", name)
      );
      const fertSnapshot = await getDocs(fertQuery);
      if (!fertSnapshot.empty) {
        const fertDoc = fertSnapshot.docs[0];
        const fertDocRef = fertDoc.ref;
        const fertData = fertDoc.data();
        const stocksArray = fertData.stocks || [];
        const stockIndex = stocksArray.findIndex(stock => stock.owned_by === projectCreator);

        if (stockIndex !== -1) {
          const currentStock = parseInt(stocksArray[stockIndex].current_stock) || 0;
          stocksArray[stockIndex].current_stock = currentStock + originalQuantity;
          await updateDoc(fertDocRef, { stocks: stocksArray });
        }
      }
    }

    // Equipment Stock Update
    const originalEquipmentMap = new Map(
      (existingProjectData.equipment || []).map(e => [`${e.equipment_type}:${e.equipment_name}`, e.equipment_quantity])
    );
    for (const newEquip of equipmentData) {
      const key = `${newEquip.equipment_type}:${newEquip.equipment_name}`;
      const originalQuantity = originalEquipmentMap.get(key) || 0;
      const equipQuantityDiff = newEquip.equipment_quantity - originalQuantity;

      if (equipQuantityDiff !== 0) {
        const equipQuery = query(
          collection(db, "tb_equipment_stock"),
          where("equipment_type", "==", newEquip.equipment_type),
          where("equipment_name", "==", newEquip.equipment_name)
        );
        const equipSnapshot = await getDocs(equipQuery);
        if (!equipSnapshot.empty) {
          const equipDoc = equipSnapshot.docs[0];
          const equipDocRef = equipDoc.ref;
          const equipData = equipDoc.data();
          const stocksArray = equipData.stocks || [];
          const stockIndex = stocksArray.findIndex(stock => stock.owned_by === projectCreator);

          if (stockIndex !== -1) {
            const currentStock = parseInt(stocksArray[stockIndex].current_stock) || 0;
            const newStock = currentStock - equipQuantityDiff;

            if (newStock < 0) {
              throw new Error(`Not enough stock for: ${newEquip.equipment_name}. Available stock is: ${currentStock}.`);
            }

            stocksArray[stockIndex].current_stock = newStock;
            await updateDoc(equipDocRef, { stocks: stocksArray });
          } else {
            throw new Error(`No stock entry found for '${newEquip.equipment_name}' owned by ${projectCreator}`);
          }
        } else {
          throw new Error(`Equipment '${newEquip.equipment_name}' not found in inventory`);
        }
      }
      originalEquipmentMap.delete(key);
    }
    for (const [key, originalQuantity] of originalEquipmentMap) {
      const [type, name] = key.split(":");
      const equipQuery = query(
        collection(db, "tb_equipment_stock"),
        where("equipment_type", "==", type),
        where("equipment_name", "==", name)
      );
      const equipSnapshot = await getDocs(equipQuery);
      if (!equipSnapshot.empty) {
        const equipDoc = equipSnapshot.docs[0];
        const equipDocRef = equipDoc.ref;
        const equipData = equipDoc.data();
        const stocksArray = equipData.stocks || [];
        const stockIndex = stocksArray.findIndex(stock => stock.owned_by === projectCreator);

        if (stockIndex !== -1) {
          const currentStock = parseInt(stocksArray[stockIndex].current_stock) || 0;
          stocksArray[stockIndex].current_stock = currentStock + originalQuantity;
          await updateDoc(equipDocRef, { stocks: stocksArray });
        }
      }
    }

    // Update project document
    const projectQuery = query(
      collection(db, "tb_projects"),
      where("project_id", "==", projectID)
    );
    const querySnapshot = await getDocs(projectQuery);

    let projectDocRef;
    if (!querySnapshot.empty) {
      projectDocRef = querySnapshot.docs[0].ref;
    } else {
      throw new Error("Project not found in database.");
    }

    const description = `Updated project '${projectName}' for ${farmPresidentName} by ${projectCreator}`;
    await window.saveActivityLog("Update", description);

    await updateDoc(projectDocRef, projectData);
    console.log("Saved projectData to Firestore:", projectData);

    // Hide loading indicator and show success message
    toggleLoadingIndicator(false);
    showprojectUpdateMessage("Project saved successfully!", true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    resetForm();
  } catch (error) {
    console.error("SaveProject Error:", error);
    // Hide loading indicator and show error message
    toggleLoadingIndicator(false);
    showprojectUpdateMessage(error.message || "Something went wrong. Please try again.", false);
    cancelButton.disabled = false;
    saveButton.disabled = false;
  } finally {
    isSaving = false;
    // Ensure loading indicator is hidden in case of uncaught errors
    toggleLoadingIndicator(false);
  }
};

// Show update message
function showprojectUpdateMessage(message, success, isLoading = false) {
  const projectUpdateMessage = document.getElementById("project-update-message");
  if (!projectUpdateMessage) {
    console.error("project-update-message element not found in DOM");
    return;
  }
  const messageElement = projectUpdateMessage.querySelector("p");
  if (!messageElement) {
    console.error("No <p> element found inside project-update-message");
    return;
  }

  messageElement.textContent = message;
  projectUpdateMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  projectUpdateMessage.style.opacity = "1";
  projectUpdateMessage.style.display = "block";

  if (!isLoading) {
    setTimeout(() => {
      projectUpdateMessage.style.opacity = "0";
      setTimeout(() => {
        projectUpdateMessage.style.display = "none";
      }, 300);
    }, 500);
  }
}

// Event listeners
document.getElementById("assign-to").addEventListener("change", function () {
  loadBarangay(this.value);
});

document.getElementById("crops").addEventListener("change", function () {
  loadCropTypes(this.value);
});

document.getElementById("cancel-button").addEventListener("click", function () {
  window.location.href = "admin_projects_list.html";
});

document.getElementById("save-button").addEventListener("click", saveProject);

document.getElementById("start-date").addEventListener("change", function () {
  // No automatic disabling
});

document.getElementById("end-date").addEventListener("change", function () {
  // No automatic disabling
});

// Global stock maps
window.cropStockMap = {};
window.fertilizerStockMap = {};
window.equipmentStockMap = {};

// Initialize on page load
window.onload = async function () {
  console.log("Page loaded, initializing data...");
  await loadFarmPresidents();
  await loadCrops();
  await loadProjectData();
};