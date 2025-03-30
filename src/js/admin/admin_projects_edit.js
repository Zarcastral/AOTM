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
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// Lock flag to prevent multiple saveProject executions
let isSaving = false;

// Default border color
const DEFAULT_BORDER_COLOR = "#ccc";

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
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

async function loadProjectData() {
  const projectDataString = localStorage.getItem("projectData");
  if (!projectDataString) return;

  try {
    const projectData = JSON.parse(projectDataString);
    
    document.getElementById("project-name").value = projectData.project_name || "";
    document.getElementById("status").value = projectData.status || "Pending";
    document.getElementById("barangay").value = projectData.barangay_name || "";
    
    // Handle start_date and end_date based on their original format
    document.getElementById("start-date").value = projectData.start_date instanceof Object 
      ? new Date(projectData.start_date.seconds * 1000).toISOString().split('T')[0]
      : projectData.start_date || "";
    document.getElementById("end-date").value = projectData.end_date instanceof Object 
      ? new Date(projectData.end_date.seconds * 1000).toISOString().split('T')[0]
      : projectData.end_date || "";
    
    await loadFarmPresidents(projectData.farmer_id);
    await loadCrops(projectData.crop_name);
    await loadCropTypes(projectData.crop_name, projectData.crop_type_name);
    
    document.getElementById("quantity-crop-type").value = projectData.crop_type_quantity || "";
    document.getElementById("crop-unit").value = projectData.crop_unit || "kg";
    
    if (projectData.fertilizer && projectData.fertilizer.length > 0) {
      const container = document.getElementById("fertilizer-container");
      container.innerHTML = "";
      for (const fert of projectData.fertilizer) {
        await addFertilizerForm(fert);
      }
    }
    
    if (projectData.equipment && projectData.equipment.length > 0) {
      const container = document.getElementById("equipment-container");
      container.innerHTML = "";
      for (const equip of projectData.equipment) {
        await addEquipmentForm(equip);
      }
    }
  } catch (error) {
    console.error("Error loading project data:", error);
  }
}

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

window.loadBarangay = async function (farmPresidentId) {
  const barangayInput = document.getElementById("barangay");
  const projectDataString = localStorage.getItem("projectData");
  const projectData = projectDataString ? JSON.parse(projectDataString) : {};
  const selectedFarmland = projectData.farm_land || null;

  if (!farmPresidentId) {
    barangayInput.value = "";
    await loadFarmland(""); // Clear farmland if no farm president
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

  updateSaveButtonState();
};

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
    quantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    updateSaveButtonState();
  });

  const quantityInput = document.getElementById("quantity-crop-type");
  quantityInput.addEventListener("input", function () {
    updateSaveButtonState();
  });

  if (selectedCropType) {
    cropTypeSelect.dispatchEvent(new Event("change"));
  }
};

window.addEquipmentForm = async function (equipData = null) {
  const container = document.getElementById("equipment-container");
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
    <button class="btn btn--remove" onclick="removeEquipmentForm(this)">Remove</button>
  `;

  container.appendChild(div);

  const equipmentTypeDropdown = div.querySelector(".equipment__type");
  const equipmentNameDropdown = div.querySelector(".equipment__name");
  const quantityInput = div.querySelector(".equipment__quantity");

  if (equipData) {
    equipmentTypeDropdown.value = equipData.equipment_type || "";
    await loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput);
    equipmentNameDropdown.value = equipData.equipment_name || "";
    quantityInput.value = equipData.equipment_quantity || "";
  }

  equipmentTypeDropdown.addEventListener("change", function () {
    loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput);
  });
};

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

async function loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput) {
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
    option.textContent = `${data.equipment_name} ${
      currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
    }`;
    equipmentNameDropdown.appendChild(option);
  });

  equipmentNameDropdown.addEventListener("change", function () {
    const selectedEquipment = this.value;
    const maxStock = window.equipmentStockMap[selectedEquipment] || 0;
    quantityInput.value = "";
    quantityInput.disabled = maxStock === 0;
    quantityInput.placeholder = maxStock > 0 ? `Max: ${maxStock}` : "Out of stock";
    quantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    updateSaveButtonState();
  });

  quantityInput.addEventListener("input", function () {
    updateSaveButtonState();
  });
}

window.addFertilizerForm = async function (fertData = null) {
  const container = document.getElementById("fertilizer-container");
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
    <button class="btn btn--remove" onclick="removeFertilizerForm(this)">Remove</button>
  `;

  container.appendChild(div);

  const fertilizerTypeDropdown = div.querySelector(".fertilizer__type");
  const fertilizerNameDropdown = div.querySelector(".fertilizer__name");
  const quantityInput = div.querySelector(".fertilizer__quantity");

  if (fertData) {
    fertilizerTypeDropdown.value = fertData.fertilizer_type || "";
    await loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput);
    fertilizerNameDropdown.value = fertData.fertilizer_name || "";
    quantityInput.value = fertData.fertilizer_quantity || "";
  }

  fertilizerTypeDropdown.addEventListener("change", function () {
    loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput);
  });
};

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

async function loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput) {
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
    option.textContent = `${data.fertilizer_name} ${
      currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
    }`;
    fertilizerNameDropdown.appendChild(option);
  });

  fertilizerNameDropdown.addEventListener("change", function () {
    const selectedFertilizer = this.value;
    const maxStock = window.fertilizerStockMap[selectedFertilizer] || 0;
    quantityInput.value = "";
    quantityInput.disabled = maxStock === 0;
    quantityInput.placeholder = maxStock > 0 ? `Max: ${maxStock}` : "Out of stock";
    quantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    updateSaveButtonState();
  });

  quantityInput.addEventListener("input", function () {
    updateSaveButtonState();
  });
}

function removeFertilizerForm(button) {
  button.parentElement.remove();
  updateSaveButtonState();
}

function removeEquipmentForm(button) {
  button.parentElement.remove();
  updateSaveButtonState();
}

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

window.getFarmlandId = async function (farmlandName) {
  if (!farmlandName) return null;

  const q = query(
    collection(db, "tb_farmland"),
    where("farmland_name", "==", farmlandName)
  );
  const querySnapshot = await getDocs(q);

  return !querySnapshot.empty ? querySnapshot.docs[0].data().farmland_id : null;
};

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

function updateSaveButtonState() {
  const saveButton = document.getElementById("save-button");
  let allValid = true;

  // Validate Crop Quantity
  const cropType = document.getElementById("crop-type").value;
  const newCropQuantity = parseInt(document.getElementById("quantity-crop-type").value) || 0;
  const cropMaxStock = window.cropStockMap[cropType] || 0;
  const cropQuantityInput = document.getElementById("quantity-crop-type");

  if (cropType && newCropQuantity > 0) {
    if (newCropQuantity > cropMaxStock) {
      allValid = false;
      cropQuantityInput.style.border = "2px solid red";
      cropQuantityInput.title = `Requested ${newCropQuantity} exceeds available stock of ${cropMaxStock}`;
    } else {
      cropQuantityInput.style.border = "2px solid green";
      cropQuantityInput.title = "";
    }
  } else {
    cropQuantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    cropQuantityInput.title = "";
  }

  // Validate Fertilizer Quantities
  const fertilizerGroups = document.querySelectorAll(".fertilizer__group");
  fertilizerGroups.forEach((group) => {
    const name = group.querySelector(".fertilizer__name").value;
    const newQuantity = parseInt(group.querySelector(".fertilizer__quantity").value) || 0;
    const maxStock = window.fertilizerStockMap[name] || 0;
    const quantityInput = group.querySelector(".fertilizer__quantity");

    if (name && newQuantity > 0) {
      if (newQuantity > maxStock) {
        allValid = false;
        quantityInput.style.border = "2px solid red";
        quantityInput.title = `Requested ${newQuantity} exceeds available stock of ${maxStock}`;
      } else {
        quantityInput.style.border = "2px solid green";
        quantityInput.title = "";
      }
    } else {
      quantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
      quantityInput.title = "";
    }
  });

  // Validate Equipment Quantities
  const equipmentGroups = document.querySelectorAll(".equipment__group");
  equipmentGroups.forEach((group) => {
    const name = group.querySelector(".equipment__name").value;
    const newQuantity = parseInt(group.querySelector(".equipment__quantity").value) || 0;
    const maxStock = window.equipmentStockMap[name] || 0;
    const quantityInput = group.querySelector(".equipment__quantity");

    if (name && newQuantity > 0) {
      if (newQuantity > maxStock) {
        allValid = false;
        quantityInput.style.border = "2px solid red";
        quantityInput.title = `Requested ${newQuantity} exceeds available stock of ${maxStock}`;
      } else {
        quantityInput.style.border = "2px solid green";
        quantityInput.title = "";
      }
    } else {
      quantityInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
      quantityInput.title = "";
    }
  });

  // Validate Dates
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const startDateStr = startDateInput.value;
  const endDateStr = endDateInput.value;

  if (startDateStr && endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (endDate < startDate) {
      allValid = false;
      endDateInput.style.border = "2px solid red";
      endDateInput.title = "End date cannot be before start date";
    } else {
      endDateInput.style.border = "2px solid green";
      endDateInput.title = "";
    }
  } else {
    endDateInput.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    endDateInput.title = "";
  }

  // Validate Required Fields
  const requiredFields = [
    "project-name",
    "assign-to",
    "crops",
    "barangay",
    "farmland",
    "crop-type",
    "quantity-crop-type",
    "crop-unit",
    "start-date",
    "end-date",
  ];
  requiredFields.forEach((id) => {
    const value = document.getElementById(id).value.trim();
    if (!value || value === "") {
      allValid = false;
    }
  });

  saveButton.disabled = !allValid;
}

function resetInputColors() {
  const inputs = document.querySelectorAll(".form__input, #start-date, #end-date");
  inputs.forEach((input) => {
    input.style.border = `2px solid ${DEFAULT_BORDER_COLOR}`;
    input.title = "";
  });
}

// Helper function to check if a value is a Firestore Timestamp object
function isTimestampObject(value) {
  return value && typeof value === "object" && "seconds" in value && "nanoseconds" in value;
}

window.saveProject = async function () {
  if (isSaving) {
    showprojectUpdateMessage("Save operation is already in progress. Please wait.", false);
    return;
  }

  isSaving = true;

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
      if (type && name && quantity > 0) {
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
      if (type && name && quantity > 0) {
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

    // Preserve original date format for each field
    const currentDateTimestamp = Timestamp.fromDate(new Date());
    const currentDateString = new Date().toISOString().split("T")[0];

    const cropDate = isTimestampObject(existingProjectData.crop_date)
      ? currentDateTimestamp
      : currentDateString;

    const fertilizerDate = isTimestampObject(existingProjectData.fertilizer_date)
      ? currentDateTimestamp
      : currentDateString;

    const equipmentDate = isTimestampObject(existingProjectData.equipment_date)
      ? currentDateTimestamp
      : currentDateString;

    const dateCreated = isTimestampObject(existingProjectData.date_created)
      ? existingProjectData.date_created
      : existingProjectData.date_created;

    const startDateValue = isTimestampObject(existingProjectData.start_date)
      ? Timestamp.fromDate(new Date(startDate))
      : startDate;

    const endDateValue = isTimestampObject(existingProjectData.end_date)
      ? Timestamp.fromDate(new Date(endDate))
      : endDate;

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
      start_date: startDateValue,
      end_date: endDateValue,
      fertilizer: fertilizerData,
      equipment: equipmentData,
      crop_date: cropDate,
      fertilizer_date: fertilizerDate,
      equipment_date: equipmentDate,
      date_created: dateCreated,
      project_creator: projectCreator,
    };

    // Validate Crop Quantity Against Inventory
    const cropQuery = query(
      collection(db, "tb_crop_stock"),
      where("crop_type_name", "==", cropTypeName)
    );
    const cropSnapshot = await getDocs(cropQuery);
    if (!cropSnapshot.empty) {
      const cropDoc = cropSnapshot.docs[0];
      const cropStocks = cropDoc.data().stocks || [];
      const stockEntry = cropStocks.find(stock => stock.owned_by === projectCreator);
      const currentStock = stockEntry ? parseInt(stockEntry.current_stock) : 0;
      if (quantityCropType > currentStock) {
        throw new Error(`Requested ${quantityCropType} of '${cropTypeName}' exceeds available stock of ${currentStock}.`);
      }
    } else {
      throw new Error(`Crop type '${cropTypeName}' not found in inventory.`);
    }

    // Validate Fertilizer Quantities Against Inventory
    for (const newFert of fertilizerData) {
      const fertQuery = query(
        collection(db, "tb_fertilizer_stock"),
        where("fertilizer_name", "==", newFert.fertilizer_name),
        where("fertilizer_type", "==", newFert.fertilizer_type)
      );
      const fertSnapshot = await getDocs(fertQuery);
      if (!fertSnapshot.empty) {
        const fertDoc = fertSnapshot.docs[0];
        const fertStocks = fertDoc.data().stocks || [];
        const stockEntry = fertStocks.find(stock => stock.owned_by === projectCreator);
        const currentStock = stockEntry ? parseInt(stockEntry.current_stock) : 0;
        if (newFert.fertilizer_quantity > currentStock) {
          throw new Error(`Requested ${newFert.fertilizer_quantity} of '${newFert.fertilizer_name}' exceeds available stock of ${currentStock}.`);
        }
      } else {
        throw new Error(`Fertilizer '${newFert.fertilizer_name}' not found in inventory.`);
      }
    }

    // Validate Equipment Quantities Against Inventory
    for (const newEquip of equipmentData) {
      const equipQuery = query(
        collection(db, "tb_equipment_stock"),
        where("equipment_name", "==", newEquip.equipment_name),
        where("equipment_type", "==", newEquip.equipment_type)
      );
      const equipSnapshot = await getDocs(equipQuery);
      if (!equipSnapshot.empty) {
        const equipDoc = equipSnapshot.docs[0];
        const equipStocks = equipDoc.data().stocks || [];
        const stockEntry = equipStocks.find(stock => stock.owned_by === projectCreator);
        const currentStock = stockEntry ? parseInt(stockEntry.current_stock) : 0;
        if (newEquip.equipment_quantity > currentStock) {
          throw new Error(`Requested ${newEquip.equipment_quantity} of '${newEquip.equipment_name}' exceeds available stock of ${currentStock}.`);
        }
      } else {
        throw new Error(`Equipment '${newEquip.equipment_name}' not found in inventory.`);
      }
    }

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

    showprojectUpdateMessage("Project saved successfully!", true);
    resetInputColors();
    resetForm();
  } catch (error) {
    console.error("Error updating project:", error);
    showprojectUpdateMessage(error.message || "Something went wrong. Please try again.", false);
  } finally {
    isSaving = false;
  }
};

const projectUpdateMessage = document.getElementById("project-update-message");

function showprojectUpdateMessage(message, success) {
  projectUpdateMessage.querySelector("p").textContent = message;
  projectUpdateMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  projectUpdateMessage.style.opacity = "1";
  projectUpdateMessage.style.display = "block";

  setTimeout(() => {
    projectUpdateMessage.style.opacity = "0";
    setTimeout(() => {
      projectUpdateMessage.style.display = "none";
    }, 300);
  }, 4000);
}

window.resetForm = function () {
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
  }, 4300);
};

// Event listeners
document.getElementById("assign-to").addEventListener("change", function () {
  loadBarangay(this.value);
  updateSaveButtonState();
});

document.getElementById("crops").addEventListener("change", function () {
  loadCropTypes(this.value);
  updateSaveButtonState();
});

document.getElementById("cancel-button").addEventListener("click", function () {
  window.location.href = "admin_projects_list.html";
});

document.getElementById("save-button").addEventListener("click", saveProject);

document.getElementById("start-date").addEventListener("change", function () {
  updateSaveButtonState();
});

document.getElementById("end-date").addEventListener("change", function () {
  updateSaveButtonState();
});

// Global stock maps
window.cropStockMap = {};
window.fertilizerStockMap = {};
window.equipmentStockMap = {};

window.onload = async function () {
  await loadFarmPresidents();
  await loadCrops();
  await loadProjectData();
  updateSaveButtonState();
};