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
    console.log("Loaded projectData from localStorage:", projectData); // Debug: Check raw data
    
    document.getElementById("project-name").value = projectData.project_name || "";
    document.getElementById("status").value = projectData.status || "Pending";
    document.getElementById("barangay").value = projectData.barangay_name || "";
    document.getElementById("start-date").value = projectData.start_date || "";
    document.getElementById("end-date").value = projectData.end_date || "";
    
    await loadFarmPresidents(projectData.farmer_id);
    await loadCrops(projectData.crop_name);
    await loadCropTypes(projectData.crop_name, projectData.crop_type_name);
    
    const quantityInput = document.getElementById("quantity-crop-type");
    quantityInput.value = projectData.crop_type_quantity || ""; // Set as-is
    console.log("Setting quantity-crop-type to:", projectData.crop_type_quantity); // Debug: Confirm value
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
  });

  const quantityInput = document.getElementById("quantity-crop-type");
  quantityInput.addEventListener("input", function () {
    // No automatic disabling here
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
  });

  quantityInput.addEventListener("input", function () {
    // No automatic disabling here
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
  });

  quantityInput.addEventListener("input", function () {
    // No automatic disabling here
  });
}

function removeFertilizerForm(button) {
  button.parentElement.remove();
}

function removeEquipmentForm(button) {
  button.parentElement.remove();
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
  saveButton.disabled = false; // Always enabled, no validation here
}

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
  }, 4300);
}

// Helper function to check if a value is a Firestore Timestamp object from localStorage
function isTimestampObject(value) {
  return value && typeof value === "object" && "seconds" in value && "nanoseconds" in value;
}

window.saveProject = async function () {
  if (isSaving) {
    showprojectUpdateMessage("Save operation is already in progress. Please wait.", false);
    return;
  }

  isSaving = true;
  const cancelButton = document.getElementById("cancel-button");
  const saveButton = document.getElementById("save-button");
  cancelButton.disabled = true;
  saveButton.disabled = true; // Disable during save

  // Show "Saving..." popup with a 1-second minimum delay
  showprojectUpdateMessage("Project is saving...", true, true);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay

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

    console.log("quantityCropType before validation:", quantityCropType); // Debug: Check input value

    // Validate required dropdowns and fields
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
      if (type && name && quantity >= 0) { // Allow 0 for removal
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
      if (type && name && quantity >= 0) { // Allow 0 for removal
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
      crop_type_quantity: quantityCropType, // Ensure integer
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

    console.log("projectData before save:", projectData); // Debug: Confirm quantity before saving

    // --- Stock Adjustment Logic ---
    // 1. Crop Stock Update
    const originalCropQuantity = parseInt(existingProjectData.crop_type_quantity) || 0;
    const cropQuantityDiff = quantityCropType - originalCropQuantity;
    console.log("originalCropQuantity:", originalCropQuantity, "quantityCropType:", quantityCropType, "cropQuantityDiff:", cropQuantityDiff); // Debug
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
          const newStock = currentStock - cropQuantityDiff; // Negative diff = take, Positive diff = give
          console.log("currentStock:", currentStock, "newStock:", newStock); // Debug
          
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

    // 2. Fertilizer Stock Update
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
      originalFertilizerMap.delete(key); // Remove processed items
    }
    // Handle removed fertilizers (give stock back)
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

    // 3. Equipment Stock Update
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
      originalEquipmentMap.delete(key); // Remove processed items
    }
    // Handle removed equipment (give stock back)
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
    console.log("Saved projectData to Firestore:", projectData); // Debug: Confirm saved data

    showprojectUpdateMessage("Project saved successfully!", true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    resetForm();
  } catch (error) {
    console.error("SaveProject Error:", error); // Debug log
    showprojectUpdateMessage(error.message || "Something went wrong. Please try again.", false); // Error popup
    cancelButton.disabled = false; // Re-enable cancel button
    saveButton.disabled = false; // Re-enable save button
  } finally {
    isSaving = false;
  }
};

// Message display function
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
  projectUpdateMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336"; // Green for success, red for error
  projectUpdateMessage.style.opacity = "1";
  projectUpdateMessage.style.display = "block";

  if (!isLoading) {
    setTimeout(() => {
      projectUpdateMessage.style.opacity = "0";
      setTimeout(() => {
        projectUpdateMessage.style.display = "none";
      }, 300);
    }, 4000);
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
  // No automatic disabling here
});

document.getElementById("end-date").addEventListener("change", function () {
  // No automatic disabling here
});

// Global stock maps
window.cropStockMap = {};
window.fertilizerStockMap = {};
window.equipmentStockMap = {};

window.onload = async function () {
  await loadFarmPresidents();
  await loadCrops();
  await loadProjectData();
};