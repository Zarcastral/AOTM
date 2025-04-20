import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  onSnapshot
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);

// Debounce utility to prevent multiple rapid calls
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Function to show success panel
function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;

  document.body.appendChild(successMessage);

  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.opacity = "1";
  }, 5);

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

  errorMessage.style.display = "block";
  setTimeout(() => {
    errorMessage.style.opacity = "1";
  }, 5);

  setTimeout(() => {
    errorMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(errorMessage);
    }, 400);
  }, 4000);
}

// Function to add low stock notification (shared for crops, fertilizers, equipment)
async function addLowStockNotification(
  itemName,
  stock,
  type,
  threshold,
  userType
) {
  try {
    if (!userType) {
      console.error("No user_type provided for notification.");
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(
      usersCollection,
      where("user_type", "==", userType)
    );
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error(`No users found with user_type: ${userType}`);
      return;
    }

    const notificationsRef = collection(db, "tb_notifications");
    const notificationPromises = [];

    userSnapshot.docs.forEach((userDoc) => {
      const userData = userDoc.data();
      const recipient = userData.user_name || "Unknown User";

      const notificationDoc = {
        recipient: recipient,
        type: "low_stock",
        title: "LOW STOCK ALERT",
        description: `${type} '${itemName}' stock is low: ${stock} remaining (below ${threshold}).`,
        item_name: itemName,
        timestamp: Timestamp.now(),
        read: false,
        notify: "no", // Always set to "no" when saving a notification
      };

      notificationPromises.push(addDoc(notificationsRef, notificationDoc));
    });

    await Promise.all(notificationPromises);
    console.log(
      `✅ Added low stock notifications for ${type}: ${itemName} to all ${userType} users with notify: "no"`
    );
  } catch (error) {
    console.error("Error adding low stock notifications:", error);
  }
}

const debouncedAddLowStockNotification = debounce(addLowStockNotification, 500);

// Function to check and notify fertilizer stock
async function checkAndNotifyFertilizerStock(projectID, userType) {
  try {
    const projectDetails = await fetchProjectDetails(projectID);
    if (
      !projectDetails ||
      !projectDetails.fertilizer ||
      projectDetails.fertilizer.length === 0
    ) {
      console.log(
        "No fertilizers in project, skipping fertilizer notification check."
      );
      return;
    }

    const fertilizerNames = projectDetails.fertilizer.map(
      (f) => f.fertilizer_name
    );
    const fertilizerStockQuery = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_name", "in", fertilizerNames.slice(0, 10)) // Firestore 'in' query limit
    );
    const fertilizerStockSnapshot = await getDocs(fertilizerStockQuery);

    if (fertilizerStockSnapshot.empty) {
      console.log("No fertilizer stock found for project fertilizers.");
      return;
    }

    const notificationsRef = collection(db, "tb_notifications");
    for (const doc of fertilizerStockSnapshot.docs) {
      const fertilizerData = doc.data();
      const fertilizerName = fertilizerData.fertilizer_name;
      const userStock = fertilizerData.stocks.find(
        (s) => s.owned_by === userType
      );
      const currentStock = userStock
        ? parseInt(userStock.current_stock, 10)
        : 0;

      if (currentStock < 100) {
        const threshold = 100;

        // Check for existing notifications with notify: "no"
        const qNo = query(
          notificationsRef,
          where("type", "==", "low_stock"),
          where("item_name", "==", fertilizerName),
          where("read", "==", false),
          where("notify", "==", "no")
        );
        const existingNoSnapshot = await getDocs(qNo);

        if (!existingNoSnapshot.empty) {
          console.log(
            `Notification for ${fertilizerName} already exists with notify: "no", skipping.`
          );
          continue;
        }

        // Check for existing notifications with notify: "yes"
        const qYes = query(
          notificationsRef,
          where("type", "==", "low_stock"),
          where("item_name", "==", fertilizerName),
          where("read", "==", false),
          where("notify", "==", "yes")
        );
        const existingYesSnapshot = await getDocs(qYes);

        if (!existingYesSnapshot.empty) {
          // Save new notification with notify: "no"
          await debouncedAddLowStockNotification(
            fertilizerName,
            currentStock,
            "Fertilizer",
            threshold,
            userType
          );

          // Update existing notifications to notify: "no"
          const updateNotifyPromises = existingYesSnapshot.docs.map(
            (notifyDoc) => updateDoc(notifyDoc.ref, { notify: "no" })
          );
          await Promise.all(updateNotifyPromises);
          console.log(
            `Updated existing notifications for ${fertilizerName} to notify: "no".`
          );
        } else {
          // No existing notification, save one with notify: "no"
          await debouncedAddLowStockNotification(
            fertilizerName,
            currentStock,
            "Fertilizer",
            threshold,
            userType
          );
          console.log(
            `Saved new notification for ${fertilizerName} with notify: "no".`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error checking and notifying fertilizer stock:", error);
  }
}

// Function to check and notify equipment stock
async function checkAndNotifyEquipmentStock(projectID, userType) {
  try {
    const projectDetails = await fetchProjectDetails(projectID);
    if (
      !projectDetails ||
      !projectDetails.equipment ||
      projectDetails.equipment.length === 0
    ) {
      console.log(
        "No equipment in project, skipping equipment notification check."
      );
      return;
    }

    const equipmentNames = projectDetails.equipment.map(
      (e) => e.equipment_name
    );
    const equipmentStockQuery = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_name", "in", equipmentNames.slice(0, 10)) // Firestore 'in' query limit
    );
    const equipmentStockSnapshot = await getDocs(equipmentStockQuery);

    if (equipmentStockSnapshot.empty) {
      console.log("No equipment stock found for project equipment.");
      return;
    }

    const notificationsRef = collection(db, "tb_notifications");
    for (const doc of equipmentStockSnapshot.docs) {
      const equipmentData = doc.data();
      const equipmentName = equipmentData.equipment_name;
      const userStock = equipmentData.stocks.find(
        (s) => s.owned_by === userType
      );
      const currentStock = userStock
        ? parseInt(userStock.current_stock, 10)
        : 0;

      if (currentStock < 100) {
        const threshold = 100;

        // Check for existing notifications with notify: "no"
        const qNo = query(
          notificationsRef,
          where("type", "==", "low_stock"),
          where("item_name", "==", equipmentName),
          where("read", "==", false),
          where("notify", "==", "no")
        );
        const existingNoSnapshot = await getDocs(qNo);

        if (!existingNoSnapshot.empty) {
          console.log(
            `Notification for ${equipmentName} already exists with notify: "no", skipping.`
          );
          continue;
        }

        // Check for existing notifications with notify: "yes"
        const qYes = query(
          notificationsRef,
          where("type", "==", "low_stock"),
          where("item_name", "==", equipmentName),
          where("read", "==", false),
          where("notify", "==", "yes")
        );
        const existingYesSnapshot = await getDocs(qYes);

        if (!existingYesSnapshot.empty) {
          // Save new notification with notify: "no"
          await debouncedAddLowStockNotification(
            equipmentName,
            currentStock,
            "Equipment",
            threshold,
            userType
          );

          // Update existing notifications to notify: "no"
          const updateNotifyPromises = existingYesSnapshot.docs.map(
            (notifyDoc) => updateDoc(notifyDoc.ref, { notify: "no" })
          );
          await Promise.all(updateNotifyPromises);
          console.log(
            `Updated existing notifications for ${equipmentName} to notify: "no".`
          );
        } else {
          // No existing notification, save one with notify: "no"
          await debouncedAddLowStockNotification(
            equipmentName,
            currentStock,
            "Equipment",
            threshold,
            userType
          );
          console.log(
            `Saved new notification for ${equipmentName} with notify: "no".`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error checking and notifying equipment stock:", error);
  }
}

window.loadFarmPresidents = async function () {
  try {
    const assignToSelect = document.getElementById("assign-to");
    if (!assignToSelect) throw new Error("assign-to element not found");

    // Initial placeholder
    assignToSelect.innerHTML =
      '<option value="" selected disabled>Select Farm President</option>';

    const q = query(
      collection(db, "tb_farmers"),
      where("user_type", "==", "Farm President")
    );

    // Use onSnapshot for real-time updates
    onSnapshot(q, (querySnapshot) => {
      assignToSelect.innerHTML =
        '<option value="" selected disabled>Select Farm President</option>';
      querySnapshot.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().first_name || "Unnamed";
        assignToSelect.appendChild(option);
      });
    }, (error) => {
      console.error("Error listening to farm presidents:", error);
      showErrorPanel("Failed to load farm presidents.");
    });
  } catch (error) {
    console.error("Error setting up farm presidents listener:", error);
    showErrorPanel("Failed to load farm presidents.");
  }
};

window.loadBarangay = async function (farmPresidentId) {
  if (!farmPresidentId) return;
  try {
    const docRef = doc(db, "tb_farmers", farmPresidentId);
    const docSnap = await getDoc(docRef);
    const barangayInput = document.getElementById("barangay");
    if (!barangayInput) throw new Error("barangay element not found");
    if (docSnap.exists()) {
      barangayInput.value = docSnap.data().barangay_name || "N/A";
      await loadFarmland(barangayInput.value);
    } else {
      barangayInput.value = "";
    }
  } catch (error) {
    console.error("Error loading barangay:", error);
  }
};

window.loadFarmland = async function (barangayName) {
  if (!barangayName) return;

  try {
    const farmlandSelect = document.getElementById("farmland");
    if (!farmlandSelect) throw new Error("farmland element not found");

    // Initial placeholder
    farmlandSelect.innerHTML =
      '<option value="" selected disabled>Select Farmland</option>';

    const q = query(
      collection(db, "tb_farmland"),
      where("barangay_name", "==", barangayName)
    );

    // Use onSnapshot for real-time updates
    onSnapshot(q, (querySnapshot) => {
      farmlandSelect.innerHTML =
        '<option value="" selected disabled>Select Farmland</option>';
      querySnapshot.forEach((doc) => {
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().farmland_name || "Unnamed";
        farmlandSelect.appendChild(option);
      });
    }, (error) => {
      console.error("Error listening to farmlands:", error);
      showErrorPanel("Failed to load farmlands.");
    });
  } catch (error) {
    console.error("Error setting up farmlands listener:", error);
    showErrorPanel("Failed to load farmlands.");
  }
};

window.loadCrops = async function () {
  const assignToSelect = document.getElementById("assign-to");
  const cropsSelect = document.getElementById("crops");

  if (!assignToSelect || !cropsSelect) {
    console.error("Missing DOM elements: assign-to or crops");
    return;
  }

  const selectedFarmPresident = assignToSelect.value.trim();
  if (!selectedFarmPresident) {
    cropsSelect.innerHTML =
      '<option value="" selected disabled>Select Crop</option>';
    return;
  }

  const userType = sessionStorage.getItem("user_type");
  if (!userType) {
    console.error("No user_type in session storage");
    cropsSelect.innerHTML =
      '<option value="" selected disabled>Select Crop</option>';
    return;
  }

  try {
    // Use onSnapshot to listen for real-time updates
    onSnapshot(collection(db, "tb_crop_stock"), (querySnapshot) => {
      const uniqueCrops = new Set();

      querySnapshot.forEach((doc) => {
        const cropData = doc.data();
        const stocksArray = Array.isArray(cropData.stocks)
          ? cropData.stocks
          : [];
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
    }, (error) => {
      console.error("Error listening to crops:", error);
      showErrorPanel("Failed to load crops.");
    });
  } catch (error) {
    console.error("Error setting up crops listener:", error);
    showErrorPanel("Failed to load crops.");
  }
};

document
  .getElementById("assign-to")
  ?.addEventListener("change", window.loadCrops);

  window.loadCropTypes = async function (selectedCrop) {
    if (!selectedCrop) return;
  
    const cropTypeSelect = document.getElementById("crop-type");
    if (!cropTypeSelect) {
      console.error("crop-type element not found");
      return;
    }
  
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user_type found in session storage.");
      cropTypeSelect.innerHTML =
        '<option value="" selected disabled>Select Crop Type</option>';
      return;
    }
  
    try {
      const q = query(
        collection(db, "tb_crop_stock"),
        where("crop_name", "==", selectedCrop)
      );
  
      // Use onSnapshot for real-time updates
      onSnapshot(q, (querySnapshot) => {
        if (querySnapshot.empty) {
          console.error(`⚠️ No stock records found for crop: ${selectedCrop}`);
          cropTypeSelect.innerHTML =
            '<option value="" selected disabled>No Crop Types Available</option>';
          return;
        }
  
        let cropStockMap = {};
        cropTypeSelect.innerHTML =
          '<option value="" selected disabled>Select Crop Type</option>';
  
        querySnapshot.forEach((doc) => {
          const cropData = doc.data();
          const cropTypeName = cropData.crop_type_name;
          const stocksArray = Array.isArray(cropData.stocks)
            ? cropData.stocks
            : [];
  
          const userStock = stocksArray.find(
            (stock) => stock.owned_by === userType
          );
          const currentStock = userStock
            ? parseInt(userStock.current_stock, 10) || 0
            : 0;
  
          cropStockMap[cropTypeName] = currentStock;
  
          const option = document.createElement("option");
          option.value = cropTypeName;
          option.textContent = `${cropTypeName} ${
            currentStock === 0 ? "(Out of Stock)" : `(Stock: ${currentStock})`
          }`;
          cropTypeSelect.appendChild(option);
        });
  
        // Update the quantity input based on the selected crop type
        const quantityInput = document.getElementById("quantity-crop-type");
        if (!quantityInput) return;
  
        const updateQuantityInput = () => {
          const selectedCropType = cropTypeSelect.value;
          const maxStock = cropStockMap[selectedCropType] || 0;
          quantityInput.max = maxStock;
          quantityInput.value = "";
  
          if (maxStock > 0) {
            quantityInput.placeholder = `Max: ${maxStock}`;
            quantityInput.disabled = false;
          } else {
            quantityInput.placeholder = "Out of stock";
            quantityInput.disabled = true;
          }
        };
  
        // Update quantity input when crop type changes
        cropTypeSelect.removeEventListener("change", updateQuantityInput);
        cropTypeSelect.addEventListener("change", updateQuantityInput);
  
        // Trigger initial update if a crop type is already selected
        if (cropTypeSelect.value) {
          updateQuantityInput();
        }
      }, (error) => {
        console.error("Error listening to crop types:", error);
        showErrorPanel("Failed to load crop types.");
      });
    } catch (error) {
      console.error("Error setting up crop types listener:", error);
      showErrorPanel("Failed to load crop types.");
    }
  };

// Function to check if a fertilizer with the same type and name already exists
function isFertilizerDuplicate(container, type, name, currentDropdown) {
  const existingGroups = container.querySelectorAll(".fertilizer__group");
  for (const group of existingGroups) {
    const existingType = group.querySelector(".fertilizer__type")?.value;
    const existingName = group.querySelector(".fertilizer__name")?.value;
    const existingDropdown = group.querySelector(".fertilizer__name");
    // Skip the current dropdown being checked
    if (
      existingType === type &&
      existingName === name &&
      existingDropdown !== currentDropdown
    ) {
      return true;
    }
  }
  return false;
}

// Function to check if an equipment with the same type and name already exists
function isEquipmentDuplicate(container, type, name, currentDropdown) {
  const existingGroups = container.querySelectorAll(".equipment__group");
  for (const group of existingGroups) {
    const existingType = group.querySelector(".equipment__type")?.value;
    const existingName = group.querySelector(".equipment__name")?.value;
    const existingDropdown = group.querySelector(".equipment__name");
    // Skip the current dropdown being checked
    if (
      existingType === type &&
      existingName === name &&
      existingDropdown !== currentDropdown
    ) {
      return true;
    }
  }
  return false;
}

async function addEquipmentForm() {
  const container = document.getElementById("equipment-container");
  if (!container) {
    console.error("equipment-container not found");
    return;
  }

  const div = document.createElement("div");
  div.classList.add("equipment__group");

  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user type found in session.");
      return;
    }

    div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Equipment Type:</label>
          <select class="form__select1 equipment__type">
              <option value="" selected disabled>Select Equipment Type</option>
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

    // Use onSnapshot to populate equipment types in real-time
    onSnapshot(collection(db, "tb_equipment_stock"), (querySnapshot) => {
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

      equipmentTypeDropdown.innerHTML =
        '<option value="" selected disabled>Select Equipment Type</option>';
      uniqueTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        equipmentTypeDropdown.appendChild(option);
      });
    }, (error) => {
      console.error("Error listening to equipment types:", error);
      showErrorPanel("Failed to load equipment types.");
    });

    equipmentTypeDropdown.addEventListener("change", function () {
      loadEquipmentNames(
        equipmentTypeDropdown,
        equipmentNameDropdown,
        quantityInput
      );
    });

    equipmentNameDropdown.addEventListener("change", function () {
      const selectedType = equipmentTypeDropdown.value;
      const selectedName = equipmentNameDropdown.value;
      if (selectedType && selectedName) {
        if (
          isEquipmentDuplicate(
            container,
            selectedType,
            selectedName,
            equipmentNameDropdown
          )
        ) {
          showErrorPanel(
            `Equipment with type '${selectedType}' and name '${selectedName}' is already selected. Please choose a different combination.`
          );
          equipmentNameDropdown.value = "";
          quantityInput.placeholder = "Available Stock: -";
          quantityInput.value = "";
        }
      }
    });
  } catch (error) {
    console.error("Error adding equipment form:", error);
    showErrorPanel("Failed to add equipment form.");
  }
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

  try {
    const q = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_type", "==", selectedType)
    );

    // Use onSnapshot for real-time updates
    onSnapshot(q, (querySnapshot) => {
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

      // Update quantity input when equipment name changes
      const updateQuantityInput = () => {
        const selectedOption =
          equipmentNameDropdown.options[equipmentNameDropdown.selectedIndex];
        const stock = selectedOption?.dataset.stock || 0;
        quantityInput.placeholder = `Available Stock: ${stock}`;
        equipmentNameDropdown.dataset.stock = stock;
        quantityInput.value = "";
        quantityInput.setAttribute("max", stock);
      };

      equipmentNameDropdown.removeEventListener("change", updateQuantityInput);
      equipmentNameDropdown.addEventListener("change", updateQuantityInput);

      // Trigger initial update if an equipment name is already selected
      if (equipmentNameDropdown.value) {
        updateQuantityInput();
      }

      // Validate quantity input
      quantityInput.removeEventListener("input", validateQuantityInput);
      quantityInput.addEventListener("input", validateQuantityInput);

      function validateQuantityInput() {
        const maxStock = parseInt(equipmentNameDropdown.dataset.stock) || 0;
        if (parseInt(quantityInput.value) > maxStock) {
          quantityInput.value = maxStock;
          showErrorPanel(`Cannot exceed available stock of ${maxStock}.`);
        }
      }
    }, (error) => {
      console.error("Error listening to equipment names:", error);
      showErrorPanel("Failed to load equipment names.");
    });
  } catch (error) {
    console.error("Error setting up equipment names listener:", error);
    showErrorPanel("Failed to load equipment names.");
  }
}

function removeEquipmentForm(button) {
  button.parentElement.remove();
}

window.addEquipmentForm = addEquipmentForm;
window.removeEquipmentForm = removeEquipmentForm;
document.addEventListener("DOMContentLoaded", addEquipmentForm);

async function addFertilizerForm() {
  const container = document.getElementById("fertilizer-container");
  if (!container) {
    console.error("fertilizer-container not found");
    return;
  }

  const div = document.createElement("div");
  div.classList.add("fertilizer__group");

  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user type found in session.");
      return;
    }

    div.innerHTML = `
      <div class="form__group">
          <label class="form__label">Fertilizer Type:</label>
          <select class="form__select1 fertilizer__type">
              <option value="" selected disabled>Select Fertilizer Type</option>
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

    // Use onSnapshot to populate fertilizer types in real-time
    onSnapshot(collection(db, "tb_fertilizer_stock"), (querySnapshot) => {
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

      fertilizerTypeDropdown.innerHTML =
        '<option value="" selected disabled>Select Fertilizer Type</option>';
      uniqueTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        fertilizerTypeDropdown.appendChild(option);
      });
    }, (error) => {
      console.error("Error listening to fertilizer types:", error);
      showErrorPanel("Failed to load fertilizer types.");
    });

    fertilizerTypeDropdown.addEventListener("change", function () {
      loadFertilizerNames(
        fertilizerTypeDropdown,
        fertilizerNameDropdown,
        quantityInput
      );
    });

    fertilizerNameDropdown.addEventListener("change", function () {
      const selectedType = fertilizerTypeDropdown.value;
      const selectedName = fertilizerNameDropdown.value;
      if (selectedType && selectedName) {
        if (
          isFertilizerDuplicate(
            container,
            selectedType,
            selectedName,
            fertilizerNameDropdown
          )
        ) {
          showErrorPanel(
            `Fertilizer with type '${selectedType}' and name '${selectedName}' is already selected. Please choose a different combination.`
          );
          fertilizerNameDropdown.value = "";
          quantityInput.placeholder = "Available Stock: -";
          quantityInput.value = "";
        }
      }
    });
  } catch (error) {
    console.error("Error adding fertilizer form:", error);
    showErrorPanel("Failed to add fertilizer form.");
  }
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

  try {
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_type", "==", selectedType)
    );

    // Use onSnapshot for real-time updates
    onSnapshot(q, (querySnapshot) => {
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

      // Update quantity input when fertilizer name changes
      const updateQuantityInput = () => {
        const selectedOption =
          fertilizerNameDropdown.options[fertilizerNameDropdown.selectedIndex];
        const stock = selectedOption?.dataset.stock || 0;
        quantityInput.placeholder = `Available Stock: ${stock}`;
        fertilizerNameDropdown.dataset.stock = stock;
        quantityInput.value = "";
        quantityInput.setAttribute("max", stock);
      };

      fertilizerNameDropdown.removeEventListener("change", updateQuantityInput);
      fertilizerNameDropdown.addEventListener("change", updateQuantityInput);

      // Trigger initial update if a fertilizer name is already selected
      if (fertilizerNameDropdown.value) {
        updateQuantityInput();
      }

      // Validate quantity input
      quantityInput.removeEventListener("input", validateQuantityInput);
      quantityInput.addEventListener("input", validateQuantityInput);

      function validateQuantityInput() {
        const maxStock = parseInt(fertilizerNameDropdown.dataset.stock) || 0;
        if (parseInt(quantityInput.value) > maxStock) {
          quantityInput.value = maxStock;
          showErrorPanel(`Cannot exceed available stock of ${maxStock}.`);
        }
      }
    }, (error) => {
      console.error("Error listening to fertilizer names:", error);
      showErrorPanel("Failed to load fertilizer names.");
    });
  } catch (error) {
    console.error("Error setting up fertilizer names listener:", error);
    showErrorPanel("Failed to load fertilizer names.");
  }
}

function removeFertilizerForm(button) {
  button.parentElement.remove();
}

window.addFertilizerForm = addFertilizerForm;
window.removeFertilizerForm = removeFertilizerForm;
document.addEventListener("DOMContentLoaded", addFertilizerForm);

window.getNextProjectID = async function () {
  try {
    const counterRef = doc(db, "tb_id_counters", "projects_id_counter");
    const counterSnap = await getDoc(counterRef);

    let newProjectID = 1;
    if (counterSnap.exists()) {
      newProjectID = counterSnap.data().count + 1;
    }

    await setDoc(counterRef, { count: newProjectID }, { merge: true });
    return newProjectID;
  } catch (error) {
    console.error("Error getting next project ID:", error);
    return null;
  }
};

window.getFarmlandId = async function (farmlandName) {
  if (!farmlandName) return null;

  try {
    const q = query(
      collection(db, "tb_farmland"),
      where("farmland_name", "==", farmlandName)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data().farmland_id;
    }
    return null;
  } catch (error) {
    console.error("Error getting farmland ID:", error);
    return null;
  }
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
    return farmPresidentDoc.data().farmer_id.toString();
  } catch (error) {
    console.error("❌ Error fetching farmer_id:", error);
    return null;
  }
}

window.saveProject = async function () {
  const saveButton = document.getElementById("save-button");
  if (!saveButton) {
    console.error("Save button not found in DOM.");
    return;
  }

  saveButton.disabled = true;

  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) throw new Error("No user_type in session storage");

    const projectName = document.getElementById("project-name")?.value.trim();
    const assignToSelect = document.getElementById("assign-to");
    const farmPresidentName =
      assignToSelect?.options[assignToSelect.selectedIndex]?.text;
    const status = document.getElementById("status")?.value;
    const cropName = document.getElementById("crops")?.value;
    const barangayName = document.getElementById("barangay")?.value.trim();
    const farmlandSelect = document.getElementById("farmland");
    const farmlandName =
      farmlandSelect?.options[farmlandSelect.selectedIndex]?.text;
    const farmlandId = await getFarmlandId(farmlandName);
    const cropTypeName = document.getElementById("crop-type")?.value;
    const quantityCropType = parseInt(
      document.getElementById("quantity-crop-type")?.value.trim()
    );
    const cropUnit = document.getElementById("crop-unit")?.value.trim();
    const startDate = document.getElementById("start-date")?.value;
    const endDate = document.getElementById("end-date")?.value;

    const farmerId = await getFarmerIdByName(farmPresidentName);
    if (!farmerId) {
      showErrorPanel(
        `Farm President '${farmPresidentName}' not found. Please select a valid Farm President.`
      );
      saveButton.disabled = false;
      return;
    }

    // Validate start date: should not be in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for comparison
    const startDateObj = new Date(startDate);
    if (startDateObj < today) {
      showErrorPanel(
        "Start Date cannot be in the past. Please select today or a future date."
      );
      saveButton.disabled = false;
      return;
    }

    const fertilizerGroups = document.querySelectorAll(".fertilizer__group");
    let fertilizerData = [];
    fertilizerGroups.forEach((group) => {
      const type = group.querySelector(".fertilizer__type")?.value;
      const name = group.querySelector(".fertilizer__name")?.value;
      const quantity = group.querySelector(".fertilizer__quantity")?.value;
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
      const type = group.querySelector(".equipment__type")?.value;
      const name = group.querySelector(".equipment__name")?.value;
      const quantity = group.querySelector(".equipment__quantity")?.value;
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
      saveButton.disabled = false;
      return;
    }

    const endDateObj = new Date(endDate);
    if (endDateObj < startDateObj) {
      showErrorPanel(
        "End Date cannot be earlier than Start Date. Please select a valid date range."
      );
      saveButton.disabled = false;
      return;
    }

    const cropTypeRef = collection(db, "tb_crop_stock");
    const cropQuery = query(
      cropTypeRef,
      where("crop_name", "==", cropName),
      where("crop_type_name", "==", cropTypeName)
    );
    const cropQuerySnapshot = await getDocs(cropQuery);

    if (cropQuerySnapshot.empty) {
      showErrorPanel(
        `Crop type '${cropTypeName}' not found in inventory for '${cropName}'.`
      );
      saveButton.disabled = false;
      return;
    }

    const cropDoc = cropQuerySnapshot.docs[0];
    const cropData = cropDoc.data();
    const stocksArray = Array.isArray(cropData.stocks) ? cropData.stocks : [];
    const userStock = stocksArray.find((stock) => stock.owned_by === userType);
    const currentCropStock = userStock ? parseInt(userStock.current_stock) : 0;

    if (quantityCropType > currentCropStock) {
      showErrorPanel(
        `Not enough stock for '${cropTypeName}'. Available: ${currentCropStock}${cropUnit}, Required: ${quantityCropType}${cropUnit}.`
      );
      saveButton.disabled = false;
      return;
    }

    const projectID = await getNextProjectID();
    if (!projectID) throw new Error("Failed to generate project ID");

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

    // Save to tb_projects
    await addDoc(collection(db, "tb_projects"), projectData);
    showSuccessPanel("Project saved successfully!");

    // Update stock once after saving project
    await saveCropStockAfterTeamAssign(projectID);
    await processFertilizerStockAfterUse(projectID);
    await processEquipmentStockAfterUse(projectID);

    window.location.href = "admin_projects_list.html";

    // Add notification for successful project creation
    const notificationData = {
      description: `Project ${projectID} is created for you to manage, Please assign a team lead for this project`,
      project_id: projectID,
      read: false,
      recipient: farmerId,
      timestamp: Timestamp.now(),
      title: "NEW PROJECT",
      type: "",
    };

    await addDoc(collection(db, "tb_notifications"), notificationData);
    console.log(
      `✅ Notification added for project ${projectID} to farmer ${farmerId}`
    );

    // Existing notification logic for low stock
    const projectDetails = await fetchProjectDetails(projectID);
    if (projectDetails) {
      const { crop_type_name, project_created_by, crop_name } = projectDetails;
      const cropStockQuery = query(
        collection(db, "tb_crop_stock"),
        where("crop_name", "==", crop_name),
        where("crop_type_name", "==", crop_type_name)
      );
      const cropStockSnapshot = await getDocs(cropStockQuery);

      if (!cropStockSnapshot.empty) {
        const doc = cropStockSnapshot.docs[0];
        const existingData = doc.data();
        const userStock = existingData.stocks.find(
          (stock) => stock.owned_by === project_created_by
        );
        const newStock = userStock ? userStock.current_stock : null;

        if (newStock !== null && newStock < 100) {
          const threshold = 100;
          const notificationsRef = collection(db, "tb_notifications");

          const qNo = query(
            notificationsRef,
            where("type", "==", "low_stock"),
            where("item_name", "==", crop_type_name),
            where("read", "==", false),
            where("notify", "==", "no")
          );
          const existingNoSnapshot = await getDocs(qNo);

          if (!existingNoSnapshot.empty) {
            console.log(
              `Notification for ${crop_type_name} already exists with notify: "no", skipping.`
            );
          } else {
            const qYes = query(
              notificationsRef,
              where("type", "==", "low_stock"),
              where("item_name", "==", crop_type_name),
              where("read", "==", false),
              where("notify", "==", "yes")
            );
            const existingYesSnapshot = await getDocs(qYes);

            if (!existingYesSnapshot.empty) {
              await debouncedAddLowStockNotification(
                crop_type_name,
                newStock,
                "Crop",
                threshold,
                project_created_by
              );

              const updateNotifyPromises = existingYesSnapshot.docs.map(
                (notifyDoc) => updateDoc(notifyDoc.ref, { notify: "no" })
              );
              await Promise.all(updateNotifyPromises);
              console.log(
                `Updated existing notifications for ${crop_type_name} to notify: "no".`
              );
            } else {
              await debouncedAddLowStockNotification(
                crop_type_name,
                newStock,
                "Crop",
                threshold,
                project_created_by
              );
              console.log(
                `Saved new notification for ${crop_type_name} with notify: "no".`
              );
            }
          }
        }
      }
    }

    // Check and notify for fertilizer and equipment stock
    await checkAndNotifyFertilizerStock(projectID, userType);
    await checkAndNotifyEquipmentStock(projectID, userType);

    // Fetch updated stocks (optional, for logging)
    await fetchFertilizerStock(projectID);
    await fetchEquipmentStock(projectID);
  } catch (error) {
    console.error("Error saving project:", error);
    showErrorPanel("Failed to save project. Please try again.");
    saveButton.disabled = false;
  }
};

window.resetForm = function () {
  try {
    document.getElementById("project-name").value = "";
    document.getElementById("assign-to").selectedIndex = 0;
    document.getElementById("status").value = "Pending";
    document.getElementById("crops").selectedIndex = 0;
    document.getElementById("barangay").value = "";
    document.getElementById("farmland").innerHTML =
      '<option value="" selected disabled>Select Farmland</option>';
    document.getElementById("crop-type").innerHTML =
      '<option value="" selected disabled>Select Crop Type</option>';

    const quantityInput = document.getElementById("quantity-crop-type");
    quantityInput.value = "";
    quantityInput.max = "";
    quantityInput.placeholder = "";
    quantityInput.disabled = false;

    document.getElementById("crop-unit").value = "Kg";
    document.getElementById("start-date").value = "";
    document.getElementById("end-date").value = "";
    const equipmentContainer = document.getElementById("equipment-container");
    equipmentContainer.innerHTML = "";
    const fertilizerContainer = document.getElementById("fertilizer-container");
    fertilizerContainer.innerHTML = "";
    //showSuccessPanel("Form has been reset successfully!");
  } catch (error) {
    console.error("Error resetting form:", error);
  }
};

document.getElementById("save-button")?.addEventListener("click", saveProject);

document.getElementById("assign-to")?.addEventListener("change", function () {
  loadBarangay(this.value);
});

document.getElementById("crops")?.addEventListener("change", function () {
  loadCropTypes(this.value);
});

document
  .getElementById("cancel-button")
  ?.addEventListener("click", function () {
    window.location.href = "admin_projects_list.html";
  });

window.onload = function () {
  loadFarmPresidents();
  loadCrops();
};

document
  .getElementById("quantity-crop-type")
  ?.addEventListener("input", function () {
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

// Deprecated function - stock deduction moved to saveCropStockAfterTeamAssign
async function updateCropStockAfterAssignment(project_id) {
  console.log(
    "updateCropStockAfterAssignment is deprecated; stock deduction handled in saveCropStockAfterTeamAssign."
  );
  return;
}

async function saveCropStockAfterTeamAssign(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.crop_name || !projectData.crop_type_name) {
      console.warn(
        "Missing crop_name or crop_type_name, cannot save crop stock."
      );
      return false;
    }
    const {
      crop_name,
      crop_type_name,
      crop_type_quantity,
      project_created_by,
    } = projectData;
    const stock_date = new Date().toISOString();

    // Query tb_crop_stock with both crop_name and crop_type_name
    const cropStockQuery = query(
      collection(db, "tb_crop_stock"),
      where("crop_name", "==", crop_name),
      where("crop_type_name", "==", crop_type_name)
    );
    const cropStockSnapshot = await getDocs(cropStockQuery);

    if (!cropStockSnapshot.empty) {
      const updatePromises = cropStockSnapshot.docs.map(async (doc) => {
        const cropStockRef = doc.ref;
        const existingData = doc.data();
        let updatedStocks = existingData.stocks || [];
        let stockDeducted = false;

        // Deduct stock only for the specific crop_type_name and owned_by
        updatedStocks = updatedStocks.map((stock) => {
          if (
            stock.owned_by === project_created_by &&
            stock.current_stock >= crop_type_quantity
          ) {
            stock.current_stock -= crop_type_quantity;
            stock.stock_date = stock_date;
            stockDeducted = true;
          }
          return stock;
        });

        if (!stockDeducted) {
          console.warn(
            `No available stock to deduct for ${crop_type_name} under ${crop_name}`
          );
          return;
        }

        // Update stock in Firestore
        await updateDoc(cropStockRef, { stocks: updatedStocks });
      });

      await Promise.all(updatePromises);
      console.log(`✅ Stock updated for ${crop_type_name} under ${crop_name}.`);
      return true;
    } else {
      console.warn(
        `❌ No crop stock found for ${crop_type_name} under ${crop_name}. Stock will not be deducted.`
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
      where("fertilizer_name", "in", fertilizerNames.slice(0, 10)) // Limit to 10 due to Firestore 'in' query limit
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
    const fertilizerNames = Array.from(fertilizerMap.keys()).slice(0, 10); // Limit to 10
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
    querySnapshot.forEach((docSnapshot) => {
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
      where("equipment_name", "in", equipmentNames.slice(0, 10)) // Limit to 10
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
    const equipmentNames = Array.from(equipmentMap.keys()).slice(0, 10); // Limit to 10
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
    querySnapshot.forEach((docSnapshot) => {
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