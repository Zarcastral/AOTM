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
  const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage
  if (!userType) return; // Exit if user_type is not set

  const querySnapshot = await getDocs(collection(db, "tb_crop_stock"));
  const cropsSelect = document.getElementById("crops");
  cropsSelect.innerHTML = '<option value="">Select Crop</option>';

  querySnapshot.forEach((doc) => {
    const cropData = doc.data();
    const stocksArray = cropData.stocks || []; // Ensure stocks array exists

    // Check if any object inside 'stocks' has 'owned_by' matching userType
    const isOwnedByUser = stocksArray.some(
      (stock) => stock.owned_by === userType
    );

    if (isOwnedByUser) {
      const option = document.createElement("option");
      option.value = cropData.crop_name;
      option.textContent = cropData.crop_name;
      cropsSelect.appendChild(option);
    }
  });
};

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

window.fetchFertilizerTypes = async function () {
  try {
    // Query Firestore for all fertilizer types
    const querySnapshot = await getDocs(collection(db, "tb_fertilizer_stock"));

    // Get the dropdown element
    const fertilizerCategorySelect = document.getElementById(
      "fertilizer-category"
    );

    // Clear previous options except the default one
    fertilizerCategorySelect.innerHTML =
      '<option value="">Select Fertilizer Type</option>';

    // Iterate through the query results
    querySnapshot.forEach((doc) => {
      const fertilizerData = doc.data();
      const fertilizerType = fertilizerData.fertilizer_type;

      // Add each fertilizer type as an option in the dropdown
      if (fertilizerType) {
        const option = document.createElement("option");
        option.value = fertilizerType;
        option.textContent = fertilizerType;
        fertilizerCategorySelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("🔥 Error fetching fertilizer types:", error);
    alert("Failed to fetch fertilizer types. Please try again.");
  }
};

window.loadFertilizerTypes = async function (selectedFertilizer) {
  if (!selectedFertilizer) return;

  const fertilizerTypeSelect = document.getElementById("fertilizer-category"); // Updated to correct ID
  fertilizerTypeSelect.innerHTML =
    '<option value="">Select Fertilizer Type</option>';

  let fertilizerStockMap = {}; // Store stock for each fertilizer type
  const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage

  try {
    // Query Firestore for fertilizer stock
    const querySnapshot = await getDocs(
      query(
        collection(db, "tb_fertilizer_stock"),
        where("fertilizer_name", "==", selectedFertilizer)
      )
    );

    if (querySnapshot.empty) {
      console.error(
        `⚠️ No stock records found for fertilizer: ${selectedFertilizer}`
      );
      return;
    }

    querySnapshot.forEach((doc) => {
      const fertilizerData = doc.data();
      const fertilizerTypeName = fertilizerData.fertilizer_type;

      // Ensure stocks is an array, otherwise use an empty array
      const stocksArray = Array.isArray(fertilizerData.stocks)
        ? fertilizerData.stocks
        : [];

      // Find stock entry that matches the logged-in user's userType
      const userStock = stocksArray.find(
        (stock) => stock.owned_by === userType
      );
      const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

      fertilizerStockMap[fertilizerTypeName] = currentStock; // Store stock

      const option = document.createElement("option");
      option.value = fertilizerTypeName;
      option.textContent = `${fertilizerTypeName} ${
        currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
      }`;
      fertilizerTypeSelect.appendChild(option);
    });

    // Attach event listener for stock display
    fertilizerTypeSelect.addEventListener("change", function () {
      const selectedFertilizerType = this.value;
      const maxStock = fertilizerStockMap[selectedFertilizerType] || 0;
      const quantityInput = document.getElementById("quantity-fertilizer-type");

      quantityInput.max = maxStock;
      quantityInput.value = ""; // Reset input when fertilizer type changes

      if (maxStock > 0) {
        quantityInput.placeholder = `Max: ${maxStock}`;
        quantityInput.disabled = false;
      } else {
        quantityInput.placeholder = "Out of stock";
        quantityInput.disabled = true;
      }
    });
  } catch (error) {
    console.error("🔥 Error loading fertilizers:", error);
  }
};

//EQUIPMENT
document
  .getElementById("open-equipment-popup")
  .addEventListener("click", function () {
    document.getElementById("equipment-popup").style.display = "flex";
  });

document
  .getElementById("close-equipment-popup")
  .addEventListener("click", function () {
    document.getElementById("equipment-popup").style.display = "none";
  });

async function loadEquipmentTypes() {
  const equipmentTypeSelect = document.getElementById("equipment-type-select");
  equipmentTypeSelect.innerHTML = `<option value="">Loading...</option>`;

  // Get session user type
  const sessionUserType = sessionStorage.getItem("user_type");
  console.log(`📌 Session User Type: ${sessionUserType}`); // ✅ Logs session user type

  try {
    const querySnapshot = await getDocs(collection(db, "tb_equipment_stock"));
    const equipmentTypes = new Set();

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Check if `stocks` exists and has at least one entry
      if (Array.isArray(data.stocks) && data.stocks.length > 0) {
        data.stocks.forEach((stockItem, index) => {
          if (stockItem.owned_by === sessionUserType) {
            console.log(
              `✅ Match Found! Doc ${doc.id} | Index ${index} | owned_by: ${stockItem.owned_by}`
            );

            if (data.equipment_type) {
              equipmentTypes.add(data.equipment_type);
            }
          }
        });
      }
    });

    // Populate dropdown
    equipmentTypeSelect.innerHTML = `<option value="">Select Type</option>`;
    equipmentTypes.forEach((type) => {
      equipmentTypeSelect.innerHTML += `<option value="${type}">${type}</option>`;
    });

    if (equipmentTypes.size === 0) {
      console.log("⚠️ No matching equipment types found.");
      equipmentTypeSelect.innerHTML = `<option value="">No Equipment Available</option>`;
    }
  } catch (error) {
    console.error("❌ Error fetching equipment types:", error);
    equipmentTypeSelect.innerHTML = `<option value="">Error Loading</option>`;
  }
}

// Event listener to store selected equipment_type
document
  .getElementById("equipment-type-select")
  .addEventListener("change", function () {
    const selectedEquipmentType = this.value;
    sessionStorage.setItem("selected_equipment_type", selectedEquipmentType);
    console.log(`✅ Stored selected equipment type: ${selectedEquipmentType}`);

    // After selecting equipment type, load equipment names
    loadEquipmentNames();
  });

// Function to retrieve selected equipment type
function getSelectedEquipmentType() {
  return sessionStorage.getItem("selected_equipment_type") || "";
}

// Function to load equipment names based on selected equipment type
async function loadEquipmentNames() {
  const equipmentNameSelect = document.getElementById("equipment-name-select");
  equipmentNameSelect.innerHTML = `<option value="">Loading...</option>`;

  // Get the selected equipment type
  const selectedEquipmentType = getSelectedEquipmentType();

  // Only proceed if an equipment type is selected
  if (!selectedEquipmentType) {
    equipmentNameSelect.innerHTML = `<option value="">Please select an equipment type first</option>`;
    return; // Exit the function if no equipment type is selected
  }

  console.log(`📌 Selected Equipment Type: ${selectedEquipmentType}`); // ✅ Logs the selected equipment type

  try {
    const querySnapshot = await getDocs(collection(db, "tb_equipment_stock"));
    let options = `<option value="">Select Equipment</option>`;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`📄 Fetched doc (${doc.id}):`, data); // ✅ Logs document data

      // If the equipment_type matches the selected equipment type, show the equipment_name
      if (
        data.equipment_type === selectedEquipmentType &&
        data.equipment_name
      ) {
        options += `<option value="${data.equipment_name}">${data.equipment_name}</option>`;
      }
    });

    // If no equipment is found for the selected type
    if (options === `<option value="">Select Equipment</option>`) {
      options = `<option value="">No Equipment Available</option>`;
    }

    equipmentNameSelect.innerHTML = options;
  } catch (error) {
    console.error("❌ Error fetching equipment names:", error);
    equipmentNameSelect.innerHTML = `<option value="">Error Loading</option>`;
  }
}

window.loadFertilizers = async function () {
  const selectedType = document.getElementById("fertilizer-category").value;
  const fertilizerSelect = document.getElementById("fertilizer-type");
  const userType = sessionStorage.getItem("user_type"); // Get user_type from session storage

  // Clear previous options except the default one
  fertilizerSelect.innerHTML =
    '<option value="">Select Fertilizer Name</option>';

  if (!selectedType) return; // If no type is selected, exit function

  try {
    // Query Firestore for all fertilizers with the selected fertilizer_type
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_type", "==", selectedType)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`⚠️ No fertilizers found for type: ${selectedType}`);
      return;
    }

    let fertilizerStockMap = {}; // Store stock for each fertilizer

    // Process each fertilizer record
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const fertilizerName = data.fertilizer_name;

      // Ensure stocks is an array, otherwise use an empty array
      const stocksArray = Array.isArray(data.stocks) ? data.stocks : [];

      // Find stock entry that matches the logged-in user's userType
      const userStock = stocksArray.find(
        (stock) => stock.owned_by === userType
      );
      const currentStock = userStock ? parseInt(userStock.current_stock) : 0;

      // Store the stock for the fertilizer name (accumulate if multiple records exist)
      if (fertilizerStockMap[fertilizerName]) {
        fertilizerStockMap[fertilizerName] += currentStock;
      } else {
        fertilizerStockMap[fertilizerName] = currentStock;
      }
    });

    // Populate the dropdown with all fertilizers of the selected type
    Object.entries(fertilizerStockMap).forEach(([name, stock]) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = `${name} ${
        stock === 0 ? "(Out of Stock)" : `(Stock: ${stock})`
      }`;
      fertilizerSelect.appendChild(option);
    });

    // Attach event listener for stock validation
    fertilizerSelect.addEventListener("change", function () {
      const selectedFertilizer = this.value;
      const maxStock = fertilizerStockMap[selectedFertilizer] || 0;
      const quantityInput = document.getElementById("quantity-fertilizer-type");

      quantityInput.max = maxStock;
      quantityInput.value = ""; // Reset input when fertilizer changes

      if (maxStock > 0) {
        quantityInput.placeholder = `Max: ${maxStock}`;
        quantityInput.disabled = false;
      } else {
        quantityInput.placeholder = "Out of stock";
        quantityInput.disabled = true;
      }

      // Auto-correct input if it exceeds max stock
      quantityInput.addEventListener("input", function () {
        const currentValue = parseInt(this.value, 10) || 0;
        if (currentValue > maxStock) {
          alert(`⚠️ You cannot enter more than ${maxStock} units.`);
          this.value = maxStock; // Auto-correct to max stock
        }
      });
    });
  } catch (error) {
    console.error("🔥 Error fetching fertilizers:", error);
  }
};

document
  .getElementById("fertilizer-category")
  .addEventListener("change", (e) => loadFertilizers(e.target.value));

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

window.saveProject = async function () {
  try {
    // Get input values
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

    const fertilizerType = document.getElementById("fertilizer-type").value;
    const quantityFertilizerType = parseInt(
      document.getElementById("quantity-fertilizer-type").value.trim()
    );
    const fertilizerUnit = document
      .getElementById("fertilizer-unit")
      .value.trim();

    const equipment = document.getElementById("equipment").value;
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // ✅ Check if required fields are empty
    if (
      !projectName ||
      !farmPresidentName ||
      !cropName ||
      !barangayName ||
      !farmlandName ||
      !cropTypeName ||
      isNaN(quantityCropType) ||
      !cropUnit ||
      !fertilizerType ||
      isNaN(quantityFertilizerType) ||
      !fertilizerUnit ||
      !equipment ||
      !startDate ||
      !endDate
    ) {
      alert("⚠️ Please fill out all required fields before saving.");
      return;
    }

    // 🔍 Fetch current stock of the selected crop type from tb_crop_stock
    const cropTypeRef = collection(db, "tb_crop_stock");
    const cropQuery = query(
      cropTypeRef,
      where("crop_type_name", "==", cropTypeName)
    );
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
      alert(
        `⚠️ Not enough stock for '${cropTypeName}'. Available: ${currentCropStock}${cropUnit}, Required: ${quantityCropType}${cropUnit}.`
      );
      return;
    }

    // 🔍 Fetch current stock of the selected fertilizer from tb_fertilizer
    const fertilizerRef = collection(db, "tb_fertilizer");
    const fertilizerQuery = query(
      fertilizerRef,
      where("fertilizer_name", "==", fertilizerType)
    );
    const fertilizerQuerySnapshot = await getDocs(fertilizerQuery);

    if (fertilizerQuerySnapshot.empty) {
      alert(`❌ Fertilizer '${fertilizerType}' not found in inventory.`);
      return;
    }

    const fertilizerDoc = fertilizerQuerySnapshot.docs[0];
    const fertilizerData = fertilizerDoc.data();
    const currentFertilizerStock = parseInt(fertilizerData.current_stock);

    // ✅ Check if there is enough fertilizer stock
    if (quantityFertilizerType > currentFertilizerStock) {
      alert(
        `⚠️ Not enough stock for '${fertilizerType}'. Available: ${currentFertilizerStock}${fertilizerUnit}, Required: ${quantityFertilizerType}${fertilizerUnit}.`
      );
      return;
    }

    // Fetch the email of the selected farm president from tb_farmers collection using first_name
    const farmersRef = collection(db, "tb_farmers");
    const farmersQuery = query(
      farmersRef,
      where("first_name", "==", farmPresidentName)
    );
    const farmersQuerySnapshot = await getDocs(farmersQuery);

    if (farmersQuerySnapshot.empty) {
      alert(
        `❌ Farm President '${farmPresidentName}' not found in the database.`
      );
      return;
    }

    const farmPresidentDoc = farmersQuerySnapshot.docs[0];
    const farmPresidentEmail = farmPresidentDoc.data().email;

    // Generate a new project ID
    const projectID = await getNextProjectID();

    // Create project data object
    const projectData = {
      project_id: projectID,
      project_name: projectName,
      farm_president: farmPresidentName,
      status: status,
      crop_name: cropName,
      barangay_name: barangayName,
      farm_land: farmlandName,
      farmland_id: farmlandId,
      crop_type_name: cropTypeName,
      quantity_crop_type: quantityCropType, // Stored as an integer
      crop_unit: cropUnit, // Stored separately
      fertilizer_type: fertilizerType,
      quantity_fertilizer_type: quantityFertilizerType, // Stored as an integer
      fertilizer_unit: fertilizerUnit, // Stored separately
      equipment: equipment,
      equipment_category: equipmentCategory, // ✅ New field added
      start_date: startDate,
      end_date: endDate,
      date_created: new Date(),
      email: farmPresidentEmail, // Use the email of the selected farm president
    };

    // ✅ Save project data to Firestore
    await addDoc(collection(db, "tb_projects"), projectData);

    // ✅ Update the stock in tb_crop_stock
    const newCropStock = currentCropStock - quantityCropType;
    await updateDoc(doc(db, "tb_crop_stock", cropDoc.id), {
      current_stock: newCropStock,
    });

    // ✅ Update the stock in tb_fertilizer
    const newFertilizerStock = currentFertilizerStock - quantityFertilizerType;
    await updateDoc(doc(db, "tb_fertilizer", fertilizerDoc.id), {
      current_stock: newFertilizerStock,
    });

    alert("✅ Project saved successfully! Crop, Fertilizer stock updated.");
    resetForm();
  } catch (error) {
    console.error("❌ Error saving project: ", error);
    alert("Failed to save project. Please try again.");
  }
};

//PAMBURA
window.resetForm = function () {
  document.getElementById("project-name").value = "";
  document.getElementById("assign-to").selectedIndex = 0;
  document.getElementById("status").value = "pending";
  document.getElementById("crops").selectedIndex = 0;
  document.getElementById("barangay").value = "";
  document.getElementById("farmland").innerHTML =
    '<option value="">Select Farmland</option>';
  document.getElementById("crop-type").innerHTML =
    '<option value="">Select Crop Type</option>';
  document.getElementById("quantity-crop-type").value = "";
  document.getElementById("fertilizer-type").selectedIndex = 0;
  document.getElementById("quantity-fertilizer-type").value = "";
  document.getElementById("equipment").selectedIndex = 0;
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
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
  fetchFertilizerTypes(); // Fetch all fertilizer types
  loadFertilizers();
  loadEquipmentTypes();
  loadEquipmentNames();
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
