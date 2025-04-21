import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for authenticated user
let currentFarmerId = sessionStorage.getItem("farmer_id") || "";
let currentUserType = "";
let currentFirstName = "";
let currentMiddleName = "";
let currentLastName = "";

let equipmentsList = [];
let filteredEquipments = [];
let currentPage = 1;
const rowsPerPage = 5;

// Helper function to display success or error messages
function showMessage(type, text) {
  const messageElement = document.getElementById(`${type}-message`);
  if (!messageElement) {
    console.error(`Message element #${type}-message not found.`);
    return;
  }

  messageElement.textContent = text;
  messageElement.style.display = "block";
  messageElement.style.opacity = "1";

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    messageElement.style.opacity = "0";
    setTimeout(() => {
      messageElement.style.display = "none";
      messageElement.textContent = "";
    }, 300); // Match CSS transition duration
  }, 3000);
}

async function getAuthenticatedFarmer() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const farmerQuery = query(
            collection(db, "tb_farmers"),
            where("email", "==", user.email)
          );
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            currentFarmerId = farmerData.farmer_id;
            sessionStorage.setItem("farmer_id", String(farmerData.farmer_id));
            currentUserType = farmerData.user_type || "";
            currentFirstName = farmerData.first_name || "";
            currentMiddleName = farmerData.middle_name || "";
            currentLastName = farmerData.last_name || "";

            resolve({
              farmer_id: currentFarmerId,
              user_type: currentUserType,
              first_name: currentFirstName,
              middle_name: currentMiddleName,
              last_name: currentLastName,
            });
          } else {
            console.error("Farmer record not found.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated.");
        reject("User not authenticated.");
      }
    });
  });
}

async function fetchEquipments() {
  try {
    await getAuthenticatedFarmer();

    const stockCollection = collection(db, "tb_equipment_stock");

    // Listen to tb_equipment_stock changes
    onSnapshot(
      stockCollection,
      async (snapshot) => {
        const equipmentsData = [];

        for (const doc of snapshot.docs) {
          const stockData = doc.data();
          const equipmentName =
            stockData.equipment_name?.trim() || "Unknown Equipment";
          const equipmentType =
            stockData.equipment_type?.trim() || "Unknown Type";
          const stocks = stockData.stocks || [];

          // Find stock entry for currentFarmerId
          const stockEntry = stocks.find(
            (stock) => stock.farmer_id === currentFarmerId
          );

          if (stockEntry) {
            if (equipmentType === "Unknown Type") {
              console.warn(
                `Missing equipment_type for equipment_name: "${equipmentName}" in tb_equipment_stock`
              );
            }

            equipmentsData.push({
              equipment_name: equipmentName,
              equipment_type: equipmentType,
              current_stock: stockEntry.current_stock ?? 0,
              unit: stockEntry.unit ?? "Units",
              owned_by: currentUserType,
            });
          }
        }

        equipmentsList = equipmentsData;
        filteredEquipments = [...equipmentsList];
        displayEquipments(filteredEquipments);
      },
      (error) => {
        console.error("Error listening to equipment stock:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching equipments:", error);
  }
}

function displayEquipments(equipmentsList) {
  const tableBody = document.querySelector(".equipment_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .equipment_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedEquipments = equipmentsList.slice(startIndex, endIndex);

  if (paginatedEquipments.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="4" style="text-align: center;">No equipment stock found for this farmer</td>
      </tr>
    `;
    return;
  }

  paginatedEquipments.forEach((equipment) => {
    const row = document.createElement("tr");
    const currentStock = parseFloat(equipment.current_stock) || 0;
    const unit = equipment.unit || "Units";
    const isDisabled = currentStock === 0 ? "disabled" : "";

    row.innerHTML = `
      <td>${equipment.equipment_name}</td>
      <td>${equipment.equipment_type}</td>
      <td>${currentStock} ${unit}</td>
      <td>
        <span class="use-resource-wrapper ${isDisabled}" 
              data-equipment-name="${encodeURIComponent(
                equipment.equipment_name
              )}" 
              data-stock="${currentStock}" 
              data-unit="${unit}">
          <img src="/images/use.png" alt="Use Resource" 
               class="use-resource-icon ${isDisabled}" 
               ${
                 isDisabled
                   ? 'aria-disabled="true" title="Resource unavailable (zero stock)"'
                   : ""
               }>
        </span>
      </td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();

  // Add event listeners to non-disabled icons
  const icons = document.querySelectorAll(
    ".equipment_table .use-resource-icon:not(.disabled)"
  );
  icons.forEach((icon) => {
    icon.removeEventListener("click", handleEquipmentIconClick); // Prevent duplicates
    icon.addEventListener("click", handleEquipmentIconClick);
  });
}

function handleEquipmentIconClick(event) {
  const wrapper = event.target.closest(".use-resource-wrapper");
  const equipmentName = decodeURIComponent(wrapper.dataset.equipmentName);
  const currentStock = parseFloat(wrapper.dataset.stock) || 0;
  const unit = wrapper.dataset.unit;
  console.log("Equipment icon clicked:", {
    equipmentName,
    currentStock,
    unit,
  });
  if (currentStock > 0) {
    openResourcePanel(equipmentName, currentStock, unit);
  }
}

function openResourcePanel(equipmentName, currentStock, unit) {
  const panel = document.getElementById("use-resource-panel");
  const resourceNameDisplay = document.getElementById("resource-type-display");
  const maxQuantityDisplay = document.getElementById("max-quantity");
  const quantityInput = document.getElementById("quantity-input");
  const statusSelect = document.getElementById("usage-type");
  const detailsContainer = document.getElementById("details-container");
  const detailsInput = document.getElementById("usage-details");

  console.log("Opening equipment resource panel with:", {
    equipmentName,
    currentStock,
    unit,
  });

  if (
    !panel ||
    !resourceNameDisplay ||
    !maxQuantityDisplay ||
    !quantityInput ||
    !statusSelect ||
    !detailsContainer ||
    !detailsInput
  ) {
    console.error("Required DOM elements for use-resource-panel not found.");
    showMessage(
      "error",
      "Resource panel elements not found. Please check the HTML."
    );
    return;
  }

  const displayName = equipmentName || "Unknown Equipment";
  console.log("Setting resource-type-display to:", displayName);

  try {
    resourceNameDisplay.value = displayName;
    resourceNameDisplay.dispatchEvent(new Event("input"));
    console.log(
      "resource-type-display value after setting:",
      resourceNameDisplay.value
    );
  } catch (error) {
    console.error("Error setting resource-type-display:", error);
    showMessage(
      "error",
      "Error setting resource name. Please check the console."
    );
    return;
  }

  maxQuantityDisplay.textContent = `${currentStock} ${unit}`;
  quantityInput.value = "";
  quantityInput.max = currentStock;
  quantityInput.min = 0;
  statusSelect.innerHTML = `
    <option value="">Select Status</option>
    <option value="Used">Used</option>
    <option value="Damaged">Damaged</option>
    <option value="Missing">Missing</option>
  `;
  detailsInput.value = "";
  detailsContainer.style.display = "none";

  panel.classList.add("active");

  // Clone inputs to reset event listeners
  const newQuantityInput = quantityInput.cloneNode(true);
  quantityInput.parentNode.replaceChild(newQuantityInput, quantityInput);
  const newStatusSelect = statusSelect.cloneNode(true);
  statusSelect.parentNode.replaceChild(newStatusSelect, statusSelect);

  // Real-time quantity validation
  newQuantityInput.addEventListener("input", () => {
    const value = parseFloat(newQuantityInput.value);
    if (isNaN(value)) {
      newQuantityInput.value = "";
    } else if (value > currentStock) {
      newQuantityInput.value = currentStock;
      showMessage("error", `Quantity cannot exceed ${currentStock} ${unit}.`);
    } else if (value < 0) {
      newQuantityInput.value = 0;
      showMessage("error", "Quantity cannot be negative.");
    }
  });

  // Handle status change to toggle details field
  newStatusSelect.addEventListener("change", () => {
    if (newStatusSelect.value === "Used") {
      detailsContainer.style.display = "none";
      detailsInput.value = ""; // Clear details when Used is selected
    } else {
      detailsContainer.style.display = "block";
    }
  });

  // One-click prevention for save button
  let isSaving = false;
  const saveButton = document.getElementById("save-resource");
  saveButton.disabled = false;
  const handleSaveClick = async () => {
    if (isSaving) {
      console.log("Save operation already in progress, ignoring click");
      return;
    }
    isSaving = true;
    saveButton.disabled = true;
    console.log("Save button clicked, processing...");

    try {
      const quantity = newQuantityInput.value.trim();
      const status = newStatusSelect.value;
      const details = detailsInput.value.trim();
      let sessionedProjectId = sessionStorage.getItem("projectId"); // Get sessioned project_id

      // Use "General" if no project_id is found
      if (!sessionedProjectId) {
        console.warn("No project_id found in sessionStorage, using 'General'");
        sessionedProjectId = "General";
      }

      // Validate quantity
      const parsedQuantity = parseFloat(quantity);
      if (
        isNaN(parsedQuantity) ||
        parsedQuantity > currentStock ||
        parsedQuantity <= 0
      ) {
        showMessage(
          "error",
          "Please enter a valid quantity within stock limits."
        );
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      // Validate status
      if (!status) {
        showMessage("error", "Please select a status.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      // Validate details for Damaged or Missing
      if ((status === "Damaged" || status === "Missing") && !details) {
        showMessage(
          "error",
          "Details field cannot be empty for Damaged or Missing."
        );
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      // If status is Used, details are optional
      const finalDetails = status === "Used" ? details || "" : details;

      // Only update stock for Damaged or Missing statuses
      if (status === "Damaged" || status === "Missing") {
        const stockQuery = query(
          collection(db, "tb_equipment_stock"),
          where("equipment_name", "==", equipmentName)
        );
        const stockSnapshot = await getDocs(stockQuery);
        if (stockSnapshot.empty) {
          console.error("No stock found for equipment:", equipmentName);
          showMessage("error", "No stock found for this equipment.");
          isSaving = false;
          saveButton.disabled = false;
          return;
        }

        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockEntry = stockData.stocks.find(
          (stock) => stock.farmer_id === currentFarmerId
        );
        if (!stockEntry) {
          console.error("No stock entry found for farmer:", currentFarmerId);
          showMessage("error", "No stock entry found for this farmer.");
          isSaving = false;
          saveButton.disabled = false;
          return;
        }

        stockEntry.current_stock =
          (stockEntry.current_stock || 0) - parsedQuantity;
        await updateDoc(doc(db, "tb_equipment_stock", stockDoc.id), {
          stocks: stockData.stocks,
        });
      }

      await addDoc(collection(db, "tb_inventory_log"), {
        project_id: sessionedProjectId, // Use sessioned project_id or "General"
        resource_name: equipmentName,
        quantity_used: parsedQuantity,
        unit: unit,
        resource_type: "Equipment",
        status: status,
        details: finalDetails,
        farmer_id: currentFarmerId,
        timestamp: new Date(),
      });

      console.log("Equipment usage saved successfully");
      showMessage("success", "Equipment usage saved successfully!");
      closeResourcePanel();
      fetchEquipments();
    } catch (error) {
      console.error("Error saving inventory log:", error);
      showMessage("error", "Failed to save inventory log.");
      isSaving = false;
      saveButton.disabled = false;
    }
  };

  saveButton.removeEventListener("click", handleSaveClick);
  saveButton.addEventListener("click", handleSaveClick);

  const cancelButton = document.getElementById("cancel-resource");
  const newCancelButton = cancelButton.cloneNode(true);
  cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
  newCancelButton.addEventListener("click", closeResourcePanel);

  const closeButton = document.getElementById("close-resource-panel");
  const newCloseButton = closeButton.cloneNode(true);
  closeButton.parentNode.replaceChild(newCloseButton, closeButton);
  newCloseButton.addEventListener("click", closeResourcePanel);
}

function closeResourcePanel() {
  const panel = document.getElementById("use-resource-panel");
  const resourceNameDisplay = document.getElementById("resource-type-display");
  if (panel) {
    panel.classList.remove("active");
  }
  if (resourceNameDisplay) {
    resourceNameDisplay.value = "";
    resourceNameDisplay.dispatchEvent(new Event("input"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Initial currentFarmerId from session:", currentFarmerId);
  fetchEquipmentNames();
  fetchEquipments();
});

function updatePagination() {
  const totalPages = Math.ceil(filteredEquipments.length / rowsPerPage) || 1;
  document.getElementById(
    "equipment-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("equipment-prev-page").disabled = currentPage === 1;
  document.getElementById("equipment-next-page").disabled =
    currentPage >= Math.ceil(filteredEquipments.length / rowsPerPage);
}

document.getElementById("equipment-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayEquipments(filteredEquipments);
  }
});

document.getElementById("equipment-next-page").addEventListener("click", () => {
  if (currentPage * rowsPerPage < filteredEquipments.length) {
    currentPage++;
    displayEquipments(filteredEquipments);
  }
});

async function fetchEquipmentNames() {
  try {
    await getAuthenticatedFarmer();
    const stockCollection = collection(db, "tb_equipment_stock");
    const stockSnapshot = await getDocs(stockCollection);

    const equipmentTypes = new Set();
    stockSnapshot.docs.forEach((doc) => {
      const stockData = doc.data();
      const stocks = stockData.stocks || [];
      const hasFarmer = stocks.some(
        (stock) => stock.farmer_id === currentFarmerId
      );
      if (hasFarmer) {
        const equipmentType = stockData.equipment_type?.trim();
        if (equipmentType && equipmentType !== "Unknown Type") {
          equipmentTypes.add(equipmentType);
        }
      }
    });

    const equipmentTypeArray = [...equipmentTypes].sort();
    populateEquipmentDropdown(equipmentTypeArray);
  } catch (error) {
    console.error("Error fetching equipment types:", error);
  }
}

function populateEquipmentDropdown(equipmentTypes) {
  const equipmentSelect = document.querySelector(".equipment_select");
  if (!equipmentSelect) return;
  const firstOption =
    equipmentSelect.querySelector("option")?.outerHTML ||
    '<option value="">Equipment Type</option>';
  equipmentSelect.innerHTML = firstOption;

  equipmentTypes.forEach((equipmentType) => {
    const option = document.createElement("option");
    option.textContent = equipmentType;
    option.value = equipmentType;
    equipmentSelect.appendChild(option);
  });
}

document
  .querySelector(".equipment_select")
  .addEventListener("change", function () {
    const selectedEquipment = this.value.toLowerCase();

    filteredEquipments = equipmentsList.filter((equipment) => {
      return selectedEquipment
        ? equipment.equipment_type?.toLowerCase() === selectedEquipment
        : true;
    });

    currentPage = 1;
    displayEquipments(filteredEquipments);
  });

document
  .getElementById("equip-search-bar")
  .addEventListener("input", function () {
    const searchQuery = this.value.toLowerCase().trim();

    filteredEquipments = equipmentsList.filter((equipment) => {
      return (
        equipment.equipment_name?.toLowerCase().includes(searchQuery) ||
        equipment.equipment_type?.toLowerCase().includes(searchQuery)
      );
    });

    currentPage = 1;
    displayEquipments(filteredEquipments);
  });

function getFarmerFullName() {
  const middleInitial = currentMiddleName
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}
