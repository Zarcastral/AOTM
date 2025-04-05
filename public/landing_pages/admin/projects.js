import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to show success panel
function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;

  document.body.appendChild(successMessage);

  // Fade in
  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.opacity = "1";
  }, 5);

  // Fade out after 4 seconds
  setTimeout(() => {
    successMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(successMessage);
    }, 400);
  }, 4000);
}

// Function to show error panel
function showErrorPanel(message) {
  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = message;

  document.body.appendChild(errorMessage);

  // Fade in
  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.opacity = "1";
  }, 5);

  // Fade out after 4 seconds
  setTimeout(() => {
    errorMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(errorMessage);
    }, 400);
  }, 4000);
}

window.loadFarmPresidents = async function () {
  const querySnapshot = await getDocs(
    query(
      collection(db, "tb_farmers"),
      where("user_type", "==", "Farm President")
    )
  );
  const assignToSelect = document.getElementById("assign-to");
  assignToSelect.innerHTML =
    '<option value="" selected disabled>Select Farm President</option>';
  querySnapshot.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().first_name;
    assignToSelect.appendChild(option);
  });
};

window.loadBarangay = async function (farmPresidentId) {
  if (!farmPresidentId) return;
  const docRef = doc(db, "tb_farmers", farmPresidentId);
  const docSnap = await getDoc(docRef);
  const barangayInput = document.getElementById("barangay");
  if (docSnap.exists()) {
    barangayInput.value = docSnap.data().barangay_name || "N/A";
    loadFarmland(barangayInput.value);
  } else {
    barangayInput.value = "";
  }
};

window.loadFarmland = async function (barangayName) {
  if (!barangayName) return;
  const querySnapshot = await getDocs(
    query(
      collection(db, "tb_farmland"),
      where("barangay_name", "==", barangayName)
    )
  );
  const farmlandSelect = document.getElementById("farmland");
  farmlandSelect.innerHTML =
    '<option value="" selected disabled>Select Farmland</option>';
  querySnapshot.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = doc.data().farmland_name;
    farmlandSelect.appendChild(option);
  });
};

window.loadCrops = async function () {
  const assignToSelect = document.getElementById("assign-to");
  const cropsSelect = document.getElementById("crops");

  if (!assignToSelect || !cropsSelect) return;

  const selectedFarmPresident = assignToSelect.value.trim();
  if (!selectedFarmPresident) return;

  const userType = sessionStorage.getItem("user_type");
  if (!userType) return;

  try {
    const querySnapshot = await getDocs(collection(db, "tb_crop_stock"));
    const uniqueCrops = new Set();

    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];
      const isOwnedByUser = stocksArray.some(
        (stock) => stock.owned_by === userType
      );

      if (
        isOwnedByUser &&
        cropData.crop_name &&
        cropData.crop_name.trim() !== ""
      ) {
        uniqueCrops.add(cropData.crop_name.trim());
      }
    });

    cropsSelect.innerHTML =
      '<option value="" selected disabled>Select Crop</option>';
    uniqueCrops.forEach((crop) => {
      const option = document.createElement("option");
      option.value = crop;
      option.textContent = crop;
      cropsSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading crops:", error);
  }
};

document
  .getElementById("assign-to")
  .addEventListener("change", window.loadCrops);

window.loadCropTypes = async function (selectedCrop) {
  if (!selectedCrop) return;

  const cropTypeSelect = document.getElementById("crop-type");
  cropTypeSelect.innerHTML =
    '<option value="" selected disabled>Select Crop Type</option>';

  let cropStockMap = {};
  const userType = sessionStorage.getItem("user_type"); // Get the sessioned user_type (e.g., "Admin")

  if (!userType) {
    console.error("No user_type found in session storage.");
    return;
  }

  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, "tb_crop_stock"),
        where("crop_name", "==", selectedCrop)
      )
    );

    if (querySnapshot.empty) {
      console.error(`⚠️ No stock records found for crop: ${selectedCrop}`);
      return;
    }

    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      const cropTypeName = cropData.crop_type_name;
      const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];

      // Find the stock entry where owned_by matches the sessioned user_type
      const userStock = stocksArray.find(
        (stock) => stock.owned_by === userType
      );
      const currentStock = userStock
        ? parseInt(userStock.current_stock, 10) || 0
        : 0;

      // Store the stock value in the map for later use
      cropStockMap[cropTypeName] = currentStock;

      // Create the option with stock display
      const option = document.createElement("option");
      option.value = cropTypeName;
      option.textContent = `${cropTypeName} ${
        currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
      }`;
      cropTypeSelect.appendChild(option);
    });

    // Add event listener to update quantity input based on selected crop type
    cropTypeSelect.addEventListener("change", function () {
      const selectedCropType = this.value;
      const maxStock = cropStockMap[selectedCropType] || 0;
      const quantityInput = document.getElementById("quantity-crop-type");

      quantityInput.max = maxStock;
      quantityInput.value = "";

      if (maxStock > 0) {
        quantityInput.placeholder = `Max: ${maxStock}`;
        quantityInput.disabled = false;
      } else {
        quantityInput.placeholder = "Out of stock";
        quantityInput.disabled = true;
      }
    });
  } catch (error) {
    console.error("Error loading crop types:", error);
  }
};

async function addEquipmentForm() {
  const container = document.getElementById("equipment-container");
  const div = document.createElement("div");
  div.classList.add("equipment__group");

  const equipmentTypes = await getEquipmentTypes();

  div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Equipment Type:</label>
          <select class="form__select1 equipment__type">
              <option value="" selected disabled>Select Equipment Type</option>
              ${equipmentTypes
                .map((type) => `<option value="${type}">${type}</option>`)
                .join("")}
          </select>
      </div>
      <div class="form__group">
          <label class="form__label">Equipment Name:</label>
          <select class="form__select equipment__name">
              <option value="" selected disabled>Select Equipment Type First</option>
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

  equipmentTypeDropdown.addEventListener("change", function () {
    loadEquipmentNames(
      equipmentTypeDropdown,
      equipmentNameDropdown,
      quantityInput
    );
  });
}

async function getEquipmentTypes() {
  const userType = sessionStorage.getItem("user_type");
  if (!userType) {
    console.error("No user type found in session.");
    return [];
  }

  const querySnapshot = await getDocs(collection(db, "tb_equipment_stock"));
  const uniqueTypes = new Set();

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.stocks)) {
      const isOwnedByUser = data.stocks.some(
        (stock) => stock.owned_by === userType
      );
      if (isOwnedByUser) {
        uniqueTypes.add(data.equipment_type);
      }
    }
  });

  return Array.from(uniqueTypes);
}

async function loadEquipmentNames(
  equipmentTypeDropdown,
  equipmentNameDropdown,
  quantityInput
) {
  const selectedType = equipmentTypeDropdown.value;
  equipmentNameDropdown.innerHTML =
    '<option value="" selected disabled>Loading...</option>';
  equipmentNameDropdown.dataset.stock = "";
  quantityInput.placeholder = "Available Stock: -";

  if (!selectedType) {
    equipmentNameDropdown.innerHTML =
      '<option value="" selected disabled>Select Equipment Type First</option>';
    return;
  }

  const q = query(
    collection(db, "tb_equipment_stock"),
    where("equipment_type", "==", selectedType)
  );
  const querySnapshot = await getDocs(q);
  equipmentNameDropdown.innerHTML =
    '<option value="" selected disabled>Select Equipment Name</option>';

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = data.equipment_name;
    option.textContent = data.equipment_name;
    const firstStockEntry =
      data.stocks && data.stocks.length > 0 ? data.stocks[0] : null;
    const currentStock = firstStockEntry ? firstStockEntry.current_stock : 0;
    option.dataset.stock = currentStock;
    equipmentNameDropdown.appendChild(option);
  });

  equipmentNameDropdown.addEventListener("change", function () {
    const selectedOption =
      equipmentNameDropdown.options[equipmentNameDropdown.selectedIndex];
    const stock = selectedOption.dataset.stock || 0;
    quantityInput.placeholder = `Available Stock: ${stock}`;
    equipmentNameDropdown.dataset.stock = stock;
    quantityInput.value = "";
    quantityInput.setAttribute("max", stock);
  });

  quantityInput.addEventListener("input", function () {
    const maxStock = parseInt(equipmentNameDropdown.dataset.stock) || 0;
    if (parseInt(quantityInput.value) > maxStock) {
      quantityInput.value = maxStock;
    }
  });
}

function removeEquipmentForm(button) {
  button.parentElement.remove();
}

window.addEquipmentForm = addEquipmentForm;
window.removeEquipmentForm = removeEquipmentForm;
document.addEventListener("DOMContentLoaded", addEquipmentForm);

async function addFertilizerForm() {
  const container = document.getElementById("fertilizer-container");
  const div = document.createElement("div");
  div.classList.add("fertilizer__group");

  const fertilizerTypes = await getFertilizerTypes();

  div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Fertilizer Type:</label>
          <select class="form__select1 fertilizer__type">
              <option value="" selected disabled>Select Fertilizer Type</option>
              ${fertilizerTypes
                .map((type) => `<option value="${type}">${type}</option>`)
                .join("")}
          </select>
      </div>
      <div class="form__group">
          <label class="form__label">Fertilizer Name:</label>
          <select class="form__select fertilizer__name">
              <option value="" selected disabled>Select Fertilizer Type First</option>
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

  fertilizerTypeDropdown.addEventListener("change", function () {
    loadFertilizerNames(
      fertilizerTypeDropdown,
      fertilizerNameDropdown,
      quantityInput
    );
  });
}

async function getFertilizerTypes() {
  const userType = sessionStorage.getItem("user_type");
  if (!userType) {
    console.error("No user type found in session.");
    return [];
  }

  const querySnapshot = await getDocs(collection(db, "tb_fertilizer_stock"));
  const uniqueTypes = new Set();

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.stocks)) {
      const isOwnedByUser = data.stocks.some(
        (stock) => stock.owned_by === userType
      );
      if (isOwnedByUser) {
        uniqueTypes.add(data.fertilizer_type);
      }
    }
  });

  return Array.from(uniqueTypes);
}

async function loadFertilizerNames(
  fertilizerTypeDropdown,
  fertilizerNameDropdown,
  quantityInput
) {
  const selectedType = fertilizerTypeDropdown.value;
  fertilizerNameDropdown.innerHTML =
    '<option value="" selected disabled>Loading...</option>';
  fertilizerNameDropdown.dataset.stock = "";
  quantityInput.placeholder = "Available Stock: -";

  if (!selectedType) {
    fertilizerNameDropdown.innerHTML =
      '<option value="" selected disabled>Select Fertilizer Type First</option>';
    return;
  }

  const q = query(
    collection(db, "tb_fertilizer_stock"),
    where("fertilizer_type", "==", selectedType)
  );
  const querySnapshot = await getDocs(q);
  fertilizerNameDropdown.innerHTML =
    '<option value="" selected disabled>Select Fertilizer Name</option>';

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = data.fertilizer_name;
    option.textContent = data.fertilizer_name;
    const firstStockEntry =
      data.stocks && data.stocks.length > 0 ? data.stocks[0] : null;
    const currentStock = firstStockEntry ? firstStockEntry.current_stock : 0;
    option.dataset.stock = currentStock;
    fertilizerNameDropdown.appendChild(option);
  });

  fertilizerNameDropdown.addEventListener("change", function () {
    const selectedOption =
      fertilizerNameDropdown.options[fertilizerNameDropdown.selectedIndex];
    const stock = selectedOption.dataset.stock || 0;
    quantityInput.placeholder = `Available Stock: ${stock}`;
    fertilizerNameDropdown.dataset.stock = stock;
    quantityInput.value = "";
    quantityInput.setAttribute("max", stock);
  });

  quantityInput.addEventListener("input", function () {
    const maxStock = parseInt(fertilizerNameDropdown.dataset.stock) || 0;
    if (parseInt(quantityInput.value) > maxStock) {
      quantityInput.value = maxStock;
    }
  });
}

function removeFertilizerForm(button) {
  button.parentElement.remove();
}

window.addFertilizerForm = addFertilizerForm;
window.removeFertilizerForm = removeFertilizerForm;
document.addEventListener("DOMContentLoaded", addFertilizerForm);

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

  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data().farmland_id;
  }

  return null;
};

async function getFarmerIdByName(farmPresidentName) {
  try {
    const farmersRef = collection(db, "tb_farmers");
    const farmersQuery = query(
      farmersRef,
      where("first_name", "==", farmPresidentName)
    );
    const farmersQuerySnapshot = await getDocs(farmersQuery);

    if (farmersQuerySnapshot.empty) {
      console.error(
        `❌ Farm President '${farmPresidentName}' not found in the database.`
      );
      return null;
    }

    const farmPresidentDoc = farmersQuerySnapshot.docs[0];
    const farmerId = farmPresidentDoc.data().farmer_id.toString();
    return farmerId;
  } catch (error) {
    console.error("❌ Error fetching farmer_id:", error);
    return null;
  }
}

window.saveProject = async function () {
  try {
    const userType = sessionStorage.getItem("user_type");
    const projectName = document.getElementById("project-name").value.trim();
    const assignToSelect = document.getElementById("assign-to");
    const farmPresidentName =
      assignToSelect.options[assignToSelect.selectedIndex].text;
    const status = document.getElementById("status").value;
    const cropName = document.getElementById("crops").value;
    const barangayName = document.getElementById("barangay").value.trim();
    const farmlandSelect = document.getElementById("farmland");
    const farmlandName =
      farmlandSelect.options[farmlandSelect.selectedIndex].text;
    const farmlandId = await getFarmlandId(farmlandName);
    const cropTypeName = document.getElementById("crop-type").value;
    const quantityCropType = parseInt(
      document.getElementById("quantity-crop-type").value.trim()
    );
    const cropUnit = document.getElementById("crop-unit").value.trim();
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    const farmerId = await getFarmerIdByName(farmPresidentName);
    if (farmerId === null) {
      showErrorPanel(
        `Farm President '${farmPresidentName}' not found. Please select a valid Farm President.`
      );
      return;
    }

    const fertilizerGroups = document.querySelectorAll(".fertilizer__group");
    let fertilizerData = [];
    fertilizerGroups.forEach((group) => {
      const type = group.querySelector(".fertilizer__type").value;
      const name = group.querySelector(".fertilizer__name").value;
      const quantity = group.querySelector(".fertilizer__quantity").value;
      if (type && name && quantity && quantity > 0) {
        fertilizerData.push({
          fertilizer_type: type,
          fertilizer_name: name,
          fertilizer_quantity: parseInt(quantity),
          fertilizer_unit: "kg",
        });
      }
    });

    const equipmentGroups = document.querySelectorAll(".equipment__group");
    let equipmentData = [];
    equipmentGroups.forEach((group) => {
      const type = group.querySelector(".equipment__type").value;
      const name = group.querySelector(".equipment__name").value;
      const quantity = group.querySelector(".equipment__quantity").value;
      if (type && name && quantity && quantity > 0) {
        equipmentData.push({
          equipment_type: type,
          equipment_name: name,
          equipment_quantity: parseInt(quantity),
        });
      }
    });

    let missingFields = [];
    if (!projectName) missingFields.push("Project Name");
    if (!farmPresidentName) missingFields.push("Farm President");
    if (!cropName) missingFields.push("Crop Name");
    if (!barangayName) missingFields.push("Barangay");
    if (!farmlandName) missingFields.push("Farmland");
    if (!cropTypeName) missingFields.push("Crop Type");
    if (isNaN(quantityCropType)) missingFields.push("Crop Quantity");
    if (!cropUnit) missingFields.push("Crop Unit");
    if (!startDate) missingFields.push("Start Date");
    if (!endDate) missingFields.push("End Date");

    if (missingFields.length > 0) {
      showErrorPanel(
        `Please fill out the following fields before saving:\n- ${missingFields.join(
          "\n- "
        )}`
      );
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) {
      showErrorPanel(
        "End Date cannot be earlier than Start Date. Please select a valid date range."
      );
      return;
    }

    const cropTypeRef = collection(db, "tb_crop_stock");
    const cropQuery = query(
      cropTypeRef,
      where("crop_type_name", "==", cropTypeName)
    );
    const cropQuerySnapshot = await getDocs(cropQuery);

    if (cropQuerySnapshot.empty) {
      showErrorPanel(`Crop type '${cropTypeName}' not found in inventory.`);
      return;
    }

    const cropDoc = cropQuerySnapshot.docs[0];
    const cropData = cropDoc.data();
    const currentCropStock = parseInt(cropData.current_stock);

    if (quantityCropType > currentCropStock) {
      showErrorPanel(
        `Not enough stock for '${cropTypeName}'. Available: ${currentCropStock}${cropUnit}, Required: ${quantityCropType}${cropUnit}.`
      );
      return;
    }

    const projectID = await getNextProjectID();
    const currentDateTime = new Date();

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
      crop_date: currentDateTime,
      fertilizer_date: currentDateTime,
      equipment_date: currentDateTime,
      date_created: currentDateTime,
      project_creator: userType,
    };

    await addDoc(collection(db, "tb_projects"), projectData);

    showSuccessPanel("Project saved successfully!");

    console.log("Fetching project details for project ID:", projectID);
    const projectDetails = await fetchProjectDetails(projectID);
    console.log("Project Details Retrieved:", projectDetails);

    await updateCropStockAfterAssignment(projectID);
    await saveCropStockAfterTeamAssign(projectID);
    await processFertilizerStockAfterUse(projectID);
    await fetchFertilizerStock(projectID);
    await processEquipmentStockAfterUse(projectID);
    await fetchEquipmentStock(projectID);

    resetForm();
  } catch (error) {
    console.error("Error saving project:", error);
    showErrorPanel("Failed to save project. Please try again.");
  }
};

window.resetForm = function () {
  document.getElementById("project-name").value = "";
  document.getElementById("assign-to").selectedIndex = 0;
  document.getElementById("status").value = "pending";
  document.getElementById("crops").selectedIndex = 0;
  document.getElementById("barangay").value = "";
  document.getElementById("farmland").innerHTML =
    '<option value="" selected disabled>Select Farmland</option>';
  document.getElementById("crop-type").innerHTML =
    '<option value="" selected disabled>Select Crop Type</option>';

  // Fully reset quantity-crop-type
  const quantityInput = document.getElementById("quantity-crop-type");
  quantityInput.value = "";
  quantityInput.max = ""; // Clear the max attribute
  quantityInput.placeholder = ""; // Clear the placeholder
  quantityInput.disabled = false; // Ensure it’s enabled by default

  document.getElementById("crop-unit").value = "Kg";
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  const equipmentContainer = document.getElementById("equipment-container");
  equipmentContainer.innerHTML = "";
  const fertilizerContainer = document.getElementById("fertilizer-container");
  fertilizerContainer.innerHTML = "";
  showSuccessPanel("Form has been reset successfully!");
};

document.getElementById("save-button").addEventListener("click", saveProject);

document.getElementById("assign-to").addEventListener("change", function () {
  loadBarangay(this.value);
});

document.getElementById("crops").addEventListener("change", function () {
  loadCropTypes(this.value);
});

document.getElementById("cancel-button").addEventListener("click", function () {
  window.location.href = "admin_projects_list.html";
});

window.onload = function () {
  loadFarmPresidents();
  loadCrops();
};

document
  .getElementById("quantity-crop-type")
  .addEventListener("input", function () {
    const maxStock = parseInt(this.max, 10);
    const currentValue = parseInt(this.value, 10);
    if (currentValue > maxStock) {
      showErrorPanel(`You cannot enter more than ${maxStock}`);
      this.value = maxStock;
    }
  });

async function fetchProjectDetails(projectID) {
  try {
    if (!projectID) {
      console.warn("No project ID provided.");
      return null;
    }
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", projectID)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      let projectData = null;
      querySnapshot.forEach((doc) => {
        projectData = doc.data();
      });
      if (projectData) {
        const filteredProjectData = {
          project_created_by: projectData.project_creator || "N/A",
          farmer_id: projectData.farmer_id || "N/A",
          crop_name: projectData.crop_name || "N/A",
          crop_type_name: projectData.crop_type_name || "N/A",
          crop_type_quantity: projectData.crop_type_quantity || 0,
          equipment: projectData.equipment || [],
          fertilizer: projectData.fertilizer || [],
        };
        console.log(
          "FertilizerData(tb_projects):",
          filteredProjectData.fertilizer
        );
        console.log(
          "EquipmentData(tb_projects):",
          filteredProjectData.equipment
        );
        console.log("Fetched Project Details:", filteredProjectData);
        return filteredProjectData;
      }
    }
    console.warn("No project found with project_id:", projectID);
    return null;
  } catch (error) {
    console.error("Error fetching project details:", error);
    return null;
  }
}

async function fetchCropStockByOwner(project_created_by, crop_type_name) {
  console.log("Fetching crop stock for project creator:", project_created_by);
  try {
    const cropStockQuery = query(collection(db, "tb_crop_stock"));
    const cropStockSnapshot = await getDocs(cropStockQuery);
    let foundStock = null;
    cropStockSnapshot.forEach((doc) => {
      const cropStockData = doc.data();
      const matchingStock = cropStockData.stocks.find(
        (stock) => stock.owned_by === project_created_by
      );
      if (matchingStock && cropStockData.crop_type_name === crop_type_name) {
        foundStock = {
          crop_name: cropStockData.crop_name || "N/A",
          crop_type_id: cropStockData.crop_type_id || "N/A",
          crop_type_name: cropStockData.crop_type_name || "N/A",
          unit: cropStockData.unit || "N/A",
          stocks: cropStockData.stocks.map((stock) => ({
            current_stock: stock.current_stock || 0,
            owned_by: stock.owned_by || "N/A",
            stock_date: stock.stock_date || "N/A",
          })),
        };
      }
    });
    if (foundStock) {
      console.log("Fetched Crop Stock:", foundStock);
    } else {
      console.log(
        "No crop stock found for project creator:",
        project_created_by
      );
    }
    return foundStock;
  } catch (error) {
    console.error("Error fetching crop stock:", error);
    return null;
  }
}

async function updateCropStockAfterAssignment(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.project_created_by) {
      console.warn("No project creator found, cannot update stock.");
      return;
    }
    const cropStockData = await fetchCropStockByOwner(
      projectData.project_created_by,
      projectData.crop_type_name
    );
    if (
      !cropStockData ||
      !cropStockData.stocks ||
      cropStockData.stocks.length === 0
    ) {
      console.warn("No crop stock found for the project creator.");
      return;
    }
    const crop_name = cropStockData.crop_name;
    const requiredQuantity = projectData.crop_type_quantity;
    console.log(
      `Required quantity for project (${crop_name}): ${requiredQuantity}`
    );
    let updatedStocks = [];
    for (let stock of cropStockData.stocks) {
      if (stock.owned_by === projectData.project_created_by) {
        let updatedStockValue = stock.current_stock - requiredQuantity;
        if (updatedStockValue < 0) {
          console.warn(
            `Not enough stock for ${crop_name}! Current: ${stock.current_stock}, Required: ${requiredQuantity}`
          );
          return;
        }
        console.log(
          `Updating stock for ${stock.owned_by}. New Stock for ${crop_name}: ${updatedStockValue}`
        );
        updatedStocks.push({
          ...stock,
          current_stock: updatedStockValue,
        });
        const cropStockQuery = query(
          collection(db, "tb_crop_stocks"),
          where("crop_name", "==", crop_name)
        );
        const cropStockSnapshot = await getDocs(cropStockQuery);
        if (!cropStockSnapshot.empty) {
          cropStockSnapshot.forEach(async (doc) => {
            const cropStockRef = doc.ref;
            await updateDoc(cropStockRef, { stocks: updatedStocks });
          });
          console.log(`Stock updated successfully for ${crop_name}!`);
        } else {
          console.warn(
            `Crop stock document not found in the database for ${crop_name}.`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error updating crop stock:", error);
  }
}

async function saveCropStockAfterTeamAssign(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.crop_name) {
      console.warn("Missing crop_name, cannot save crop stock.");
      return false;
    }
    const { crop_name, crop_type_quantity, project_created_by } = projectData;
    const stock_date = new Date().toISOString();
    const cropStockQuery = query(
      collection(db, "tb_crop_stock"),
      where("crop_name", "==", crop_name)
    );
    const cropStockSnapshot = await getDocs(cropStockQuery);
    if (!cropStockSnapshot.empty) {
      const updatePromises = cropStockSnapshot.docs.map(async (doc) => {
        const cropStockRef = doc.ref;
        const existingData = doc.data();
        let updatedStocks = existingData.stocks || [];
        let stockDeducted = false;
        updatedStocks = updatedStocks.map((stock) => {
          if (
            stock.owned_by === project_created_by &&
            stock.current_stock >= crop_type_quantity
          ) {
            stock.current_stock -= crop_type_quantity;
            stockDeducted = true;
          }
          return stock;
        });
        if (!stockDeducted) {
          console.warn(`No available stock to deduct for ${crop_name}`);
          return;
        }
        return updateDoc(cropStockRef, { stocks: updatedStocks });
      });
      await Promise.all(updatePromises);
      console.log(`✅ Stock updated for ${crop_name}.`);
      return true;
    } else {
      console.warn(
        `❌ No crop stock found for ${crop_name}. Stock will not be deducted.`
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Error updating crop stock:", error);
    return false;
  }
}

async function fetchFertilizerStock(project_id) {
  try {
    const projectDetails = await fetchProjectDetails(project_id);
    if (
      !projectDetails ||
      !projectDetails.fertilizer ||
      projectDetails.fertilizer.length === 0
    ) {
      console.warn("No fertilizer data found for this project.");
      return;
    }
    const fertilizerNames = projectDetails.fertilizer.map(
      (fert) => fert.fertilizer_name
    );
    const projectCreator = projectDetails.project_created_by;
    console.log("Fertilizer Names to Search:", fertilizerNames);
    console.log("Filtering by Owner:", projectCreator);
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_name", "in", fertilizerNames)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn("No matching fertilizer stocks found.");
      return;
    }
    const filteredFertilizerStockList = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const matchingStocks = data.stocks.filter(
        (stock) => stock.owned_by === projectCreator
      );
      if (matchingStocks.length > 0) {
        filteredFertilizerStockList.push({
          id: doc.id,
          ...data,
          stocks: matchingStocks,
        });
      }
    });
    if (filteredFertilizerStockList.length === 0) {
      console.warn("No fertilizer stock found for the specified owner.");
      return;
    }
    console.log(
      "FertilizerData(tb_fertilizer_stock)",
      filteredFertilizerStockList
    );
  } catch (error) {
    console.error("Error fetching fertilizer stock:", error);
  }
}

async function processFertilizerStockAfterUse(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.fertilizer ||
      projectData.fertilizer.length === 0
    ) {
      console.warn("No fertilizer data found for this project.");
      return;
    }
    const stock_date = new Date().toISOString();
    const projectCreator = projectData.project_created_by;
    const fertilizerMap = new Map();
    projectData.fertilizer.forEach((fert) => {
      fertilizerMap.set(fert.fertilizer_name, fert.fertilizer_quantity || 0);
    });
    console.log("Fertilizer Map:", fertilizerMap);
    console.log("Processing for Owner:", projectCreator);
    const fertilizerNames = Array.from(fertilizerMap.keys());
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_name", "in", fertilizerNames)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn(
        "❌ No matching fertilizer stocks found. Stock will not be deducted."
      );
      return;
    }
    const updatePromises = [];
    querySnapshot.forEach(async (docSnapshot) => {
      const docRef = doc(db, "tb_fertilizer_stock", docSnapshot.id);
      const data = docSnapshot.data();
      console.log("Fertilizer data from db:", data);
      const docFertilizerName = data.fertilizer_name;
      const deductedFor = new Set();
      data.stocks.forEach((stock) => {
        if (stock.owned_by === projectCreator) {
          const fertilizerName = stock.fertilizer_name || docFertilizerName;
          if (!fertilizerName) {
            console.warn("Missing fertilizer name in stock:", stock);
            return;
          }
          if (!deductedFor.has(fertilizerName)) {
            const usedQuantity = fertilizerMap.get(fertilizerName) || 0;
            if (stock.current_stock >= usedQuantity) {
              const newStock = Math.max(stock.current_stock - usedQuantity, 0);
              console.log(
                `Deducting for ${fertilizerName}: ${stock.current_stock} - ${usedQuantity} = ${newStock}`
              );
              stock.current_stock = newStock;
              deductedFor.add(fertilizerName);
            } else {
              console.warn(
                `Not enough stock for ${fertilizerName} (current: ${stock.current_stock}). Skipping deduction.`
              );
              return;
            }
          }
        }
      });
      updatePromises.push(updateDoc(docRef, { stocks: data.stocks }));
    });
    await Promise.all(updatePromises);
    console.log("✅ Fertilizer stock update process completed successfully.");
  } catch (error) {
    console.error("❌ Error processing fertilizer stock:", error);
  }
}

async function fetchEquipmentStock(project_id) {
  try {
    const projectDetails = await fetchProjectDetails(project_id);
    if (
      !projectDetails ||
      !projectDetails.equipment ||
      projectDetails.equipment.length === 0
    ) {
      console.warn("No equipment data found for this project.");
      return;
    }
    const equipmentNames = projectDetails.equipment.map(
      (equi) => equi.equipment_name
    );
    const projectCreator = projectDetails.project_created_by;
    console.log("Equipment Names to Search:", equipmentNames);
    console.log("Filtering by Owner:", projectCreator);
    const q = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_name", "in", equipmentNames)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn("No matching equipment stocks found.");
      return;
    }
    const filteredEquipmentStockList = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const matchingStocks = data.stocks.filter(
        (stock) => stock.owned_by === projectCreator
      );
      if (matchingStocks.length > 0) {
        filteredEquipmentStockList.push({
          id: doc.id,
          ...data,
          stocks: matchingStocks,
        });
      }
    });
    if (filteredEquipmentStockList.length === 0) {
      console.warn("No equipment stock found for the specified owner.");
      return;
    }
    console.log(
      "EquipmentData(tb_equipment_stock)",
      filteredEquipmentStockList
    );
  } catch (error) {
    console.error("Error fetching equipment stock:", error);
  }
}

async function processEquipmentStockAfterUse(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.equipment ||
      projectData.equipment.length === 0
    ) {
      console.warn("No equipment data found for this project.");
      return;
    }
    const stock_date = new Date().toISOString();
    const projectCreator = projectData.project_created_by;
    const equipmentMap = new Map();
    projectData.equipment.forEach((equi) => {
      equipmentMap.set(equi.equipment_name, equi.equipment_quantity || 0);
    });
    console.log("Equipment Map:", equipmentMap);
    console.log("Processing for Owner:", projectCreator);
    const equipmentNames = Array.from(equipmentMap.keys());
    const q = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_name", "in", equipmentNames)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.warn(
        "❌ No matching equipment stocks found. Stock will not be deducted."
      );
      return;
    }
    const updatePromises = [];
    querySnapshot.forEach(async (docSnapshot) => {
      const docRef = doc(db, "tb_equipment_stock", docSnapshot.id);
      const data = docSnapshot.data();
      console.log("Equipment data from db:", data);
      const docEquipmentName = data.equipment_name;
      const deductedFor = new Set();
      data.stocks.forEach((stock) => {
        if (stock.owned_by === projectCreator) {
          const equipmentName = stock.equipment_name || docEquipmentName;
          if (!equipmentName) {
            console.warn("Missing equipment name in stock:", stock);
            return;
          }
          if (!deductedFor.has(equipmentName)) {
            const usedQuantity = equipmentMap.get(equipmentName) || 0;
            if (stock.current_stock >= usedQuantity) {
              const newStock = Math.max(stock.current_stock - usedQuantity, 0);
              console.log(
                `Deducting for ${equipmentName}: ${stock.current_stock} - ${usedQuantity} = ${newStock}`
              );
              stock.current_stock = newStock;
              deductedFor.add(equipmentName);
            } else {
              console.warn(
                `Not enough stock for ${equipmentName} (current: ${stock.current_stock}). Skipping deduction.`
              );
              return;
            }
          }
        }
      });
      updatePromises.push(updateDoc(docRef, { stocks: data.stocks }));
    });
    await Promise.all(updatePromises);
    console.log("✅ Equipment stock update process completed successfully.");
  } catch (error) {
    console.error("❌ Error processing equipment stock:", error);
  }
}
