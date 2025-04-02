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

// ✅ Properly initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.loadFarmPresidents = async function () {
  const querySnapshot = await getDocs(
    query(
      collection(db, "tb_farmers"),
      where("user_type", "==", "Farm President")
    )
  );
  const assignToSelect = document.getElementById("assign-to");
  assignToSelect.innerHTML = '<option value="">Select Farm President</option>';
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
  farmlandSelect.innerHTML = '<option value="">Select Farmland</option>';
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

  const selectedFarmPresident = assignToSelect.value.trim(); // Get selected value
  if (!selectedFarmPresident) return; // Exit if no Farm President is selected

  const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage
  if (!userType) return; // Exit if user_type is not set

  try {
    const querySnapshot = await getDocs(collection(db, "tb_crop_stock"));
    const uniqueCrops = new Set(); // Set to store unique crop names
    
    querySnapshot.forEach((doc) => {
      const cropData = doc.data();
      const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];
      
      // Check if any object inside 'stocks' has 'owned_by' matching userType
      const isOwnedByUser = stocksArray.some(stock => stock.owned_by === userType);
      
      if (isOwnedByUser && cropData.crop_name && cropData.crop_name.trim() !== "") {
        uniqueCrops.add(cropData.crop_name.trim()); // Add unique crop names
      }
    });
    
    // Populate dropdown without redundant values
    cropsSelect.innerHTML = '<option value="">Select Crop</option>';
    uniqueCrops.forEach(crop => {
      const option = document.createElement("option");
      option.value = crop;
      option.textContent = crop;
      cropsSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading crops:", error);
  }
};

// Event listener to trigger loading crops when 'assign-to' changes
document.getElementById("assign-to").addEventListener("change", window.loadCrops);



window.loadCropTypes = async function (selectedCrop) {
  if (!selectedCrop) return;

  const cropTypeSelect = document.getElementById("crop-type");
  cropTypeSelect.innerHTML = '<option value="">Select Crop Type</option>';

  let cropStockMap = {}; // Store stock for each crop type
  const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage

  // Query Firestore for crop stock
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

    // Ensure stocks is an array, otherwise use an empty array
    const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];

    // Find stock entry that matches the logged-in user's userType
    const userStock = stocksArray.find((stock) => stock.owned_by === userType);
    const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

    cropStockMap[cropTypeName] = currentStock; // Store stock

    const option = document.createElement("option");
    option.value = cropTypeName;
    option.textContent = `${cropTypeName} ${
      currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
    }`;
    cropTypeSelect.appendChild(option);
  });

  // Attach event listener for stock display
  cropTypeSelect.addEventListener("change", function () {
    const selectedCropType = this.value;
    const maxStock = cropStockMap[selectedCropType] || 0;
    const quantityInput = document.getElementById("quantity-crop-type");

    quantityInput.max = maxStock;
    quantityInput.value = ""; // Reset input when crop type changes

    if (maxStock > 0) {
      quantityInput.placeholder = `Max: ${maxStock}`;
      quantityInput.disabled = false;
    } else {
      quantityInput.placeholder = "Out of stock";
      quantityInput.disabled = true;
    }
  });
};


// EQUIPMENT TRY
async function addEquipmentForm() {
  const container = document.getElementById("equipment-container");

  const div = document.createElement("div");
  div.classList.add("equipment__group");

  const equipmentTypes = await getEquipmentTypes();

  div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Equipment Type:</label>
          <select class="form__select1 equipment__type">
              <option value="">Select Equipment Type</option>
              ${equipmentTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
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
  const stockLabel = div.querySelector(".stock-label");

  equipmentTypeDropdown.addEventListener("change", function () {
      loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput, stockLabel);
  });
}




async function getEquipmentTypes() {
  const userType = sessionStorage.getItem("user_type"); // Get logged-in user type from session

  if (!userType) {
      console.error("No user type found in session.");
      return [];
  }

  const querySnapshot = await getDocs(collection(db, "tb_equipment_stock"));
  const uniqueTypes = new Set();

  querySnapshot.forEach(doc => {
      const data = doc.data();
      
      // Check if the document has a "stocks" array
      if (Array.isArray(data.stocks)) {
          // Check if any object in "stocks" has owned_by equal to userType
          const isOwnedByUser = data.stocks.some(stock => stock.owned_by === userType);

          if (isOwnedByUser) {
              uniqueTypes.add(data.equipment_type); // Add equipment_type to the set
          }
      }
  });

  return Array.from(uniqueTypes);
}




async function loadEquipmentNames(equipmentTypeDropdown, equipmentNameDropdown, quantityInput) {
  const selectedType = equipmentTypeDropdown.value;
  equipmentNameDropdown.innerHTML = '<option value="">Loading...</option>';
  equipmentNameDropdown.dataset.stock = ""; // Reset stock data
  quantityInput.placeholder = "Available Stock: -"; // Reset placeholder

  if (!selectedType) {
      equipmentNameDropdown.innerHTML = '<option value="">Select Equipment Type First</option>';
      return;
  }

  const q = query(collection(db, "tb_equipment_stock"), where("equipment_type", "==", selectedType));
  const querySnapshot = await getDocs(q);
  equipmentNameDropdown.innerHTML = '<option value="">Select Equipment Name</option>';

  querySnapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = data.equipment_name;
      option.textContent = data.equipment_name;

      // Ensure stocks array exists and has data
      const firstStockEntry = data.stocks && data.stocks.length > 0 ? data.stocks[0] : null;
      const currentStock = firstStockEntry ? firstStockEntry.current_stock : 0; // Extract the correct value

      option.dataset.stock = currentStock; // Store stock value in the option
      equipmentNameDropdown.appendChild(option);
  });

  // Add event listener to update placeholder and limit input value
  equipmentNameDropdown.addEventListener("change", function() {
      const selectedOption = equipmentNameDropdown.options[equipmentNameDropdown.selectedIndex];
      const stock = selectedOption.dataset.stock || 0;

      quantityInput.placeholder = `Available Stock: ${stock}`; // Set placeholder
      equipmentNameDropdown.dataset.stock = stock;
      
      quantityInput.value = ""; // Reset input
      quantityInput.setAttribute("max", stock); // Set max limit
  });

  // Ensure input does not exceed available stock
  quantityInput.addEventListener("input", function() {
      const maxStock = parseInt(equipmentNameDropdown.dataset.stock) || 0;
      if (parseInt(quantityInput.value) > maxStock) {
          quantityInput.value = maxStock;
      }
  });
}



// Function to remove an equipment form entry
function removeEquipmentForm(button) {
  button.parentElement.remove();
}

// Ensure functions are globally accessible
window.addEquipmentForm = addEquipmentForm;
window.removeEquipmentForm = removeEquipmentForm;
document.addEventListener("DOMContentLoaded", addEquipmentForm);








//FERTILIZER TRY
async function addFertilizerForm() {
  const container = document.getElementById("fertilizer-container");

  const div = document.createElement("div");
  div.classList.add("fertilizer__group");

  const fertilizerTypes = await getFertilizerTypes();

  div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Fertilizer Type:</label>
          <select class="form__select1 fertilizer__type">
              <option value="">Select Fertilizer Type</option>
              ${fertilizerTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
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

  fertilizerTypeDropdown.addEventListener("change", function () {
      loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput);
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

  querySnapshot.forEach(doc => {
      const data = doc.data();
      
      if (Array.isArray(data.stocks)) {
          const isOwnedByUser = data.stocks.some(stock => stock.owned_by === userType);

          if (isOwnedByUser) {
              uniqueTypes.add(data.fertilizer_type);
          }
      }
  });

  return Array.from(uniqueTypes);
}

async function loadFertilizerNames(fertilizerTypeDropdown, fertilizerNameDropdown, quantityInput) {
  const selectedType = fertilizerTypeDropdown.value;
  fertilizerNameDropdown.innerHTML = '<option value="">Loading...</option>';
  fertilizerNameDropdown.dataset.stock = ""; 
  quantityInput.placeholder = "Available Stock: -"; 

  if (!selectedType) {
      fertilizerNameDropdown.innerHTML = '<option value="">Select Fertilizer Type First</option>';
      return;
  }

  const q = query(collection(db, "tb_fertilizer_stock"), where("fertilizer_type", "==", selectedType));
  const querySnapshot = await getDocs(q);
  fertilizerNameDropdown.innerHTML = '<option value="">Select Fertilizer Name</option>';

  querySnapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = data.fertilizer_name;
      option.textContent = data.fertilizer_name;

      const firstStockEntry = data.stocks && data.stocks.length > 0 ? data.stocks[0] : null;
      const currentStock = firstStockEntry ? firstStockEntry.current_stock : 0;

      option.dataset.stock = currentStock;
      fertilizerNameDropdown.appendChild(option);
  });

  fertilizerNameDropdown.addEventListener("change", function() {
      const selectedOption = fertilizerNameDropdown.options[fertilizerNameDropdown.selectedIndex];
      const stock = selectedOption.dataset.stock || 0;

      quantityInput.placeholder = `Available Stock: ${stock}`;
      fertilizerNameDropdown.dataset.stock = stock;
      
      quantityInput.value = ""; 
      quantityInput.setAttribute("max", stock);
  });

  quantityInput.addEventListener("input", function() {
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

  let newProjectID = 1; // Default if document doesn't exist
  if (counterSnap.exists()) {
    newProjectID = counterSnap.data().count + 1;
  }

  // Update counter atomically
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
    return querySnapshot.docs[0].data().farmland_id; // Get the farmland_id
  }

  return null;
};

// ✅ Function to get farmer_id based on the selected Farm President's name
async function getFarmerIdByName(farmPresidentName) {
  try {
    const farmersRef = collection(db, "tb_farmers");
    const farmersQuery = query(farmersRef, where("first_name", "==", farmPresidentName));
    const farmersQuerySnapshot = await getDocs(farmersQuery);

    if (farmersQuerySnapshot.empty) {
      console.error(`❌ Farm President '${farmPresidentName}' not found in the database.`);
      return null;
    }

    const farmPresidentDoc = farmersQuerySnapshot.docs[0];
    const farmerId = farmPresidentDoc.data().farmer_id.toString(); // Convert to string
    return farmerId;
  } catch (error) {
    console.error("❌ Error fetching farmer_id:", error);
    return null;
  }
}

window.saveProject = async function () {
  try {
    // ✅ Get input values
    const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage

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
    const quantityCropType = parseInt(document.getElementById("quantity-crop-type").value.trim());
    const cropUnit = document.getElementById("crop-unit").value.trim();


    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // ✅ Get farmer_id for the selected Farm President
    const farmerId = await getFarmerIdByName(farmPresidentName);
    if (farmerId === null) {
      alert(`❌ Farm President '${farmPresidentName}' not found. Please select a valid Farm President.`);
      return;
    }


// ✅ Extract fertilizer data
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
      fertilizer_unit: "kg", // ✅ Added constant fertilizer unit
    });
  }
});



    // ✅ Extract equipment data
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


        


    // ✅ Check required fields
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
  alert(`⚠️ Please fill out the following fields before saving:\n- ${missingFields.join("\n- ")}`);
  return;
}


// ✅ Validate Date Range
const startDateObj = new Date(startDate);
const endDateObj = new Date(endDate);

if (endDateObj < startDateObj) {
  alert("❌ End Date cannot be earlier than Start Date. Please select a valid date range.");
  return;
}

    // 🔍 Fetch current stock of the selected crop type from Firestore
    const cropTypeRef = collection(db, "tb_crop_stock");
    const cropQuery = query(cropTypeRef, where("crop_type_name", "==", cropTypeName));
    const cropQuerySnapshot = await getDocs(cropQuery);

    if (cropQuerySnapshot.empty) {
      alert(`❌ Crop type '${cropTypeName}' not found in inventory.`);
      return;
    }

    const cropDoc = cropQuerySnapshot.docs[0];
    const cropData = cropDoc.data();
    const currentCropStock = parseInt(cropData.current_stock);

    // ✅ Check if there is enough crop stock
    if (quantityCropType > currentCropStock) {
      alert(`⚠️ Not enough stock for '${cropTypeName}'. Available: ${currentCropStock}${cropUnit}, Required: ${quantityCropType}${cropUnit}.`);
      return;
    }


    // ✅ Generate a new project ID AFTER validation
    const projectID = await getNextProjectID();

    // ✅ Get current date and time
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
      project_creator: userType, // ✅ Save userType in the project data
    };

    // ✅ Save project data to Firestore
    await addDoc(collection(db, "tb_projects"), projectData);


    alert("✅ Project saved successfully!");

    console.log("Fetching project details for project ID:", projectID);
    const projectDetails = await fetchProjectDetails(projectID);
    console.log("Project Details Retrieved:", projectDetails);

    //CROP
    await updateCropStockAfterAssignment(projectID);
    await saveCropStockAfterTeamAssign(projectID);

    //FERT
    await processFertilizerStockAfterUse(projectID);
    await fetchFertilizerStock(projectID);

    //EQUI
    await processEquipmentStockAfterUse(projectID);
    await fetchEquipmentStock(projectID);
    


    resetForm();
  } catch (error) {
    console.error("❌ Error saving project:", error);
    alert("Failed to save project. Please try again.");
  }
};



// PAMBURA - Reset form fields
window.resetForm = function () {
  document.getElementById("project-name").value = "";
  document.getElementById("assign-to").selectedIndex = 0;
  document.getElementById("status").value = "pending";
  document.getElementById("crops").selectedIndex = 0;
  document.getElementById("barangay").value = ""; // Keeps its value based on farm president
  document.getElementById("farmland").innerHTML =
    '<option value="">Select Farmland</option>';
  document.getElementById("crop-type").innerHTML =
    '<option value="">Select Crop Type</option>';
  document.getElementById("quantity-crop-type").value = "";
  document.getElementById("crop-unit").value = ""; // Clears the crop unit field

  
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";

  // ✅ Clear all dynamically added equipment groups
  const equipmentContainer = document.getElementById("equipment-container");
  equipmentContainer.innerHTML = ""; // Removes all equipment elements


    // ✅ Clear all dynamically added fertilizer groups
    const fertilizerContainer = document.getElementById("fertilizer-container");
    fertilizerContainer.innerHTML = ""; // Removes all fertilizer elements

  alert("🧹 Form has been reset successfully!");
};



document.getElementById("save-button").addEventListener("click", saveProject);

// Event listeners for select elements
document.getElementById("assign-to").addEventListener("change", function () {
  loadBarangay(this.value);
});

document.getElementById("crops").addEventListener("change", function () {
  loadCropTypes(this.value);
});

document.getElementById("cancel-button").addEventListener("click", function () {
  window.location.href = "admin_projects_list.html"; // Redirect to the homepage or previous page
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
      alert(`⚠️ You cannot enter more than ${maxStock}`);
      this.value = maxStock; // Auto-correct to max stock
    }
  });









  // FETCH PROJECT DETAILS
  async function fetchProjectDetails(projectID) {
    try {
        if (!projectID) {
            console.warn("No project ID provided.");
            return null;
        }
  
        // Query Firestore using the provided project_id
        const q = query(collection(db, "tb_projects"), where("project_id", "==", projectID));
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
                    fertilizer: projectData.fertilizer || []
                };
  
                console.log("FertilizerData(tb_projects):", filteredProjectData.fertilizer);
                console.log("EquipmentData(tb_projects):", filteredProjectData.equipment);
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
  

//--------------------------- C R O P S   S T O C K ---------------------------------
//CROP STOCK
async function fetchCropStockByOwner(project_created_by, crop_type_name) {  // Change function parameter
  console.log("Fetching crop stock for project creator:", project_created_by);
  
  try {
      const cropStockQuery = query(collection(db, "tb_crop_stock"));
      const cropStockSnapshot = await getDocs(cropStockQuery);

      let foundStock = null;

      cropStockSnapshot.forEach((doc) => {
          const cropStockData = doc.data();
          
          const matchingStock = cropStockData.stocks.find(stock => stock.owned_by === project_created_by);  // Change variable

          if (matchingStock && cropStockData.crop_type_name === crop_type_name) {
              foundStock = {
                  crop_name: cropStockData.crop_name || "N/A",
                  crop_type_id: cropStockData.crop_type_id || "N/A",
                  crop_type_name: cropStockData.crop_type_name || "N/A",
                  unit: cropStockData.unit || "N/A",
                  stocks: cropStockData.stocks.map(stock => ({
                      current_stock: stock.current_stock || 0,
                      owned_by: stock.owned_by || "N/A",
                      stock_date: stock.stock_date || "N/A"
                  }))
              };
          }
      });

      if (foundStock) {
          console.log("Fetched Crop Stock:", foundStock);
      } else {
          console.log("No crop stock found for project creator:", project_created_by);
      }

      return foundStock;
  } catch (error) {
      console.error("Error fetching crop stock:", error);
      return null;
  }
}

//DITO SYA MAGBABAWAS NG STOCK HA
async function updateCropStockAfterAssignment(project_id) {
  try {
      // Fetch project details using the passed project_id
      const projectData = await fetchProjectDetails(project_id);
      if (!projectData || !projectData.project_created_by) {
          console.warn("No project creator found, cannot update stock.");
          return;
      }

      // Fetch crop stock for the project creator
      const cropStockData = await fetchCropStockByOwner(projectData.project_created_by, projectData.crop_type_name);
      if (!cropStockData || !cropStockData.stocks || cropStockData.stocks.length === 0) {
          console.warn("No crop stock found for the project creator.");
          return;
      }

      // Extract crop_name from the fetched stock data
      const crop_name = cropStockData.crop_name;

      const requiredQuantity = projectData.crop_type_quantity;
      console.log(`Required quantity for project (${crop_name}): ${requiredQuantity}`);

      let updatedStocks = [];

      for (let stock of cropStockData.stocks) {
          if (stock.owned_by === projectData.project_created_by) {
              let updatedStockValue = stock.current_stock - requiredQuantity;
              if (updatedStockValue < 0) {
                  console.warn(`Not enough stock for ${crop_name}! Current: ${stock.current_stock}, Required: ${requiredQuantity}`);
                  return;
              }

              console.log(`Updating stock for ${stock.owned_by}. New Stock for ${crop_name}: ${updatedStockValue}`);

              updatedStocks.push({
                  ...stock,
                  current_stock: updatedStockValue
              });

              // Update Firestore
              const cropStockQuery = query(collection(db, "tb_crop_stocks"), 
                                           where("crop_name", "==", crop_name));
              const cropStockSnapshot = await getDocs(cropStockQuery);

              if (!cropStockSnapshot.empty) {
                  cropStockSnapshot.forEach(async (doc) => {
                      const cropStockRef = doc.ref;
                      await updateDoc(cropStockRef, { stocks: updatedStocks });
                  });
                  console.log(`Stock updated successfully for ${crop_name}!`);
              } else {
                  console.warn(`Crop stock document not found in the database for ${crop_name}.`);
              }
          }
      }
  } catch (error) {
      console.error("Error updating crop stock:", error);
  }
}


//CROP SAVING
async function saveCropStockAfterTeamAssign(project_id) {
  try {
      const projectData = await fetchProjectDetails(project_id);
      if (!projectData || !projectData.crop_name) {
          console.warn("Missing crop_name, cannot save crop stock.");
          return;
      }

      const { crop_name, crop_type_quantity } = projectData;
      const stock_date = new Date().toISOString(); 

     

      const cropStockQuery = query(collection(db, "tb_crop_stock"), where("crop_name", "==", crop_name));
      const cropStockSnapshot = await getDocs(cropStockQuery);

      if (!cropStockSnapshot.empty) {
          const updatePromises = cropStockSnapshot.docs.map(async (doc) => {
              const cropStockRef = doc.ref;
              const existingData = doc.data();
              let updatedStocks = existingData.stocks || [];

              let stockDeducted = false;
              updatedStocks = updatedStocks.map(stock => {
                  if (stock.owned_by === projectData.project_created_by && !stockDeducted) {
                      if (stock.current_stock >= crop_type_quantity) {
                          stock.current_stock -= crop_type_quantity;
                          stockDeducted = true;
                      } else {
                          console.warn(`Not enough stock for ${crop_name}!`);
                          return stock;
                      }
                  }
                  return stock;
              });

              if (!stockDeducted) {
                  console.warn(`No available stock to deduct for ${crop_name}`);
                  return;
              }

              updatedStocks.push({
                  current_stock: crop_type_quantity,
                  stock_date: stock_date,
                  unit: "kg"
              });

              return updateDoc(cropStockRef, { stocks: updatedStocks });
          });

          await Promise.all(updatePromises);
          console.log(`✅ Stock updated for ${crop_name}.`);
      } else {
          console.warn(`❌ No crop stock found for ${crop_name}. Creating a new entry.`);

          await addDoc(collection(db, "tb_crop_stock"), {
              crop_name: crop_name,
              stocks: [
                  {
                      current_stock: crop_type_quantity,
                      stock_date: stock_date,
                      unit: "kg",
                      //farmer_id: farmer_id
                  }
              ]
          });

          console.log(`✅ New crop stock entry created for ${crop_name}.`);
      }
  } catch (error) {
      console.error("❌ Error saving crop stock:", error);
  }
}





//--------------------------- F E R T I L I Z E R   S T O C K ---------------------------------

// FETCH FERTILIZER STOCK
async function fetchFertilizerStock(project_id) {
  try {
      // Fetch project details
      const projectDetails = await fetchProjectDetails(project_id);
      if (!projectDetails || !projectDetails.fertilizer || projectDetails.fertilizer.length === 0) {
          console.warn("No fertilizer data found for this project.");
          return;
      }

      const fertilizerNames = projectDetails.fertilizer.map(fert => fert.fertilizer_name);
      const projectCreator = projectDetails.project_created_by; // Get project creator

      console.log("Fertilizer Names to Search:", fertilizerNames);
      console.log("Filtering by Owner:", projectCreator);

      // Query tb_fertilizer_stock for matching fertilizer names
      const q = query(
          collection(db, "tb_fertilizer_stock"),
          where("fertilizer_name", "in", fertilizerNames)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          console.warn("No matching fertilizer stocks found.");
          return;
      }

      // Store filtered fertilizer stock data
      const filteredFertilizerStockList = [];
      querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Check if any stock entry has the matching owned_by value
          const matchingStocks = data.stocks.filter(stock => stock.owned_by === projectCreator);

          if (matchingStocks.length > 0) {
              filteredFertilizerStockList.push({
                  id: doc.id, // Include document ID
                  ...data, // Include all document fields
                  stocks: matchingStocks // Only include stocks that match project_creator
              });
          }
      });

      if (filteredFertilizerStockList.length === 0) {
          console.warn("No fertilizer stock found for the specified owner.");
          return;
      }

      console.log("FertilizerData(tb_fertilizer_stock)",filteredFertilizerStockList);
  } catch (error) {
      console.error("Error fetching fertilizer stock:", error);
  }
}


async function processFertilizerStockAfterUse(project_id) {
  try {
    // Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.fertilizer || projectData.fertilizer.length === 0) {
      console.warn("No fertilizer data found for this project.");
      return;
    }
    
    const stock_date = new Date().toISOString();
    const projectCreator = projectData.project_created_by;
    
    // Build a map: fertilizer name => quantity to deduct
    const fertilizerMap = new Map();
    projectData.fertilizer.forEach(fert => {
      fertilizerMap.set(fert.fertilizer_name, fert.fertilizer_quantity || 0);
    });
    
    console.log("Fertilizer Map:", fertilizerMap);
    console.log("Processing for Owner:", projectCreator);
    
    // Query fertilizer stock for matching fertilizer names
    const fertilizerNames = Array.from(fertilizerMap.keys());
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_name", "in", fertilizerNames)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.warn("No matching fertilizer stocks found. Creating new entries.");
      
      // Create new entries for each fertilizer from project data
      const insertPromises = projectData.fertilizer.map(fert => 
        addDoc(collection(db, "tb_fertilizer_stock"), {
          fertilizer_name: fert.fertilizer_name,
          stocks: [{
            current_stock: fert.fertilizer_quantity, // initial stock used
            stock_date: stock_date,
            unit: "kg"
          }]
        })
      );
      await Promise.all(insertPromises);
      console.log("✅ New fertilizer stock entries created.");
      return;
    }
    
    // Process each matching fertilizer stock document
    const updatePromises = [];
    
    querySnapshot.forEach(async (docSnapshot) => {
      const docRef = doc(db, "tb_fertilizer_stock", docSnapshot.id);
      const data = docSnapshot.data();
      
      console.log("Fertilizer data from db:", data);
      // Use document-level fertilizer_name as fallback
      const docFertilizerName = data.fertilizer_name;
      
      // Flag to ensure we deduct only once per document for each fertilizer
      const deductedFor = new Set();
      
      // Process each stock entry owned by the project creator
      data.stocks.forEach(stock => {
        if (stock.owned_by === projectCreator) {
          // Use the stock's fertilizer_name or fallback to document-level name
          const fertilizerName = stock.fertilizer_name || docFertilizerName;
          if (!fertilizerName) {
            console.warn("Missing fertilizer name in stock:", stock);
            return;
          }
          // If we haven't deducted for this fertilizer in this document...
          if (!deductedFor.has(fertilizerName)) {
            const usedQuantity = fertilizerMap.get(fertilizerName) || 0;
            if (stock.current_stock >= usedQuantity) {
              const newStock = Math.max(stock.current_stock - usedQuantity, 0);
              console.log(`Deducting for ${fertilizerName}: ${stock.current_stock} - ${usedQuantity} = ${newStock}`);
              stock.current_stock = newStock;
              deductedFor.add(fertilizerName);
            } else {
              console.warn(`Not enough stock for ${fertilizerName} (current: ${stock.current_stock}). Skipping deduction.`);
              return;
            }
          }
        }
      });
      
      // After deduction, add a new entry to log the used quantity.
      // (This simulates the "save after use" part.)
      // We add one new record per fertilizer that we deducted in this document.
      deductedFor.forEach(fertilizerName => {
        const usedQuantity = fertilizerMap.get(fertilizerName) || 0;
        data.stocks.push({
          current_stock: usedQuantity, // this new entry represents the used amount
          stock_date: stock_date,
          unit: "kg",
          // Optionally, you can record additional info here (e.g., a reference to the project)
        });
      });
      
      updatePromises.push(updateDoc(docRef, { stocks: data.stocks }));
    });
    
    await Promise.all(updatePromises);
    console.log("✅ Combined fertilizer stock process completed successfully.");
  } catch (error) {
    console.error("❌ Error processing fertilizer stock:", error);
  }
}



//--------------------------- E Q U I P M E N T   S T O C K ---------------------------------

// FETCH EQUIPMENT STOCK
async function fetchEquipmentStock(project_id) {
  try {
      // Fetch project details
      const projectDetails = await fetchProjectDetails(project_id);
      if (!projectDetails || !projectDetails.equipment || projectDetails.equipment.length === 0) {
          console.warn("No equipment data found for this project.");
          return;
      }

      const equipmentNames = projectDetails.equipment.map(equi => equi.equipment_name);
      const projectCreator = projectDetails.project_created_by; // Get project creator

      console.log("Equipment Names to Search:", equipmentNames);
      console.log("Filtering by Owner:", projectCreator);

      // Query tb_equipment_stock for matching equipment names
      const q = query(
          collection(db, "tb_equipment_stock"),
          where("equipment_name", "in", equipmentNames)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          console.warn("No matching equipment stocks found.");
          return;
      }

      // Store filtered equipment stock data
      const filteredEquipmentStockList = [];
      querySnapshot.forEach((doc) => {
          const data = doc.data();

          // Check if any stock entry has the matching owned_by value
          const matchingStocks = data.stocks.filter(stock => stock.owned_by === projectCreator);

          if (matchingStocks.length > 0) {
              filteredEquipmentStockList.push({
                  id: doc.id, // Include document ID
                  ...data, // Include all document fields
                  stocks: matchingStocks // Only include stocks that match project_creator
              });
          }
      });

      if (filteredEquipmentStockList.length === 0) {
          console.warn("No equipment stock found for the specified owner.");
          return;
      }

      console.log("EquipmentData(tb_equipment_stock)",filteredEquipmentStockList);
  } catch (error) {
      console.error("Error fetching equipment stock:", error);
  }
}


async function processEquipmentStockAfterUse(project_id) {
  try {
    // Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.equipment || projectData.equipment.length === 0) {
      console.warn("No equipment data found for this project.");
      return;
    }
    
    const stock_date = new Date().toISOString();
    const projectCreator = projectData.project_created_by;
    
    // Build a map: equipment name => quantity to deduct
    const equipmentMap = new Map();
    projectData.equipment.forEach(equi => {
      equipmentMap.set(equi.equipment_name, equi.equipment_quantity || 0);
    });
    
    console.log("Equipment Map:", equipmentMap);
    console.log("Processing for Owner:", projectCreator);
    
    // Query equipment stock for matching equipment names
    const equipmentNames = Array.from(equipmentMap.keys());
    const q = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_name", "in", equipmentNames)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.warn("No matching equipment stocks found. Creating new entries.");
      
      // Create new entries for each equipment from project data
      const insertPromises = projectData.equipment.map(fert => 
        addDoc(collection(db, "tb_equipment_stock"), {
          equipment_name: fert.equipment_name,
          stocks: [{
            current_stock: equi.equipment_quantity, // initial stock used
            stock_date: stock_date,
            unit: "kg"
          }]
        })
      );
      await Promise.all(insertPromises);
      console.log("✅ New equipment stock entries created.");
      return;
    }
    
    // Process each matching equipment stock document
    const updatePromises = [];
    
    querySnapshot.forEach(async (docSnapshot) => {
      const docRef = doc(db, "tb_equipment_stock", docSnapshot.id);
      const data = docSnapshot.data();
      
      console.log("equipment data from db:", data);
      // Use document-level equipment_name as fallback
      const docEquipmentName = data.equipment_name;
      
      // Flag to ensure we deduct only once per document for each equipment
      const deductedFor = new Set();
      
      // Process each stock entry owned by the project creator
      data.stocks.forEach(stock => {
        if (stock.owned_by === projectCreator) {
          // Use the stock's equipment_name or fallback to document-level name
          const equipmentName = stock.equipment_name || docEquipmentName;
          if (!equipmentName) {
            console.warn("Missing equipment name in stock:", stock);
            return;
          }
          // If we haven't deducted for this equipment in this document...
          if (!deductedFor.has(equipmentName)) {
            const usedQuantity = equipmentMap.get(equipmentName) || 0;
            if (stock.current_stock >= usedQuantity) {
              const newStock = Math.max(stock.current_stock - usedQuantity, 0);
              console.log(`Deducting for ${equipmentName}: ${stock.current_stock} - ${usedQuantity} = ${newStock}`);
              stock.current_stock = newStock;
              deductedFor.add(equipmentName);
            } else {
              console.warn(`Not enough stock for ${equipmentName} (current: ${stock.current_stock}). Skipping deduction.`);
              return;
            }
          }
        }
      });
      
      // After deduction, add a new entry to log the used quantity.
      // (This simulates the "save after use" part.)
      // We add one new record per equipment that we deducted in this document.
      deductedFor.forEach(equipmentName => {
        const usedQuantity = equipmentMap.get(equipmentName) || 0;
        data.stocks.push({
          current_stock: usedQuantity, // this new entry represents the used amount
          stock_date: stock_date,
          unit: "kg",
          // Optionally, you can record additional info here (e.g., a reference to the project)
        });
      });
      
      updatePromises.push(updateDoc(docRef, { stocks: data.stocks }));
    });
    
    await Promise.all(updatePromises);
    console.log("✅ Combined equipment stock process completed successfully.");
  } catch (error) {
    console.error("❌ Error processing equipment stock:", error);
  }
}