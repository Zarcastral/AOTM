import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  getFirestore,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
  doc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const db = getFirestore(app);

async function saveActivityLog(action) {
  const auth = getAuth();

  // Use onAuthStateChanged to wait for authentication status
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch authenticated user's data from tb_users collection
      const userDocRef = doc(db, "tb_users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error("User data not found in tb_users.");
        return;
      }

      const userData = userDocSnap.data();
      const userName = userData.user_name || "Unknown User";
      const userType = userData.user_type || "Unknown Type";

      const currentTimestamp = Timestamp.now().toDate();
      const date = currentTimestamp.toLocaleDateString("en-US");
      const time = currentTimestamp.toLocaleTimeString("en-US");

      const activityLogCollection = collection(db, "tb_activity_log");

      try {
        // Fetch and increment the activity_log_id_counter
        const counterDocRef = doc(db, "tb_id_counters", "activity_log_id_counter");
        const counterDocSnap = await getDoc(counterDocRef);

        if (!counterDocSnap.exists()) {
          console.error("Counter document not found.");
          return;
        }

        let currentCounter = counterDocSnap.data().value || 0;
        let newCounter = currentCounter + 1;

        // Update the counter in the database
        await updateDoc(counterDocRef, { value: newCounter });

        // Use the incremented counter as activity_log_id
        const docRef = await addDoc(activityLogCollection, {
          activity_log_id: newCounter, // Use counter instead of a placeholder
          username: userName,
          user_type: userType,
          activity: action,
          date: date,
          time: time
        });

        console.log("Activity log saved successfully with ID:", newCounter);
      } catch (error) {
        console.error("Error saving activity log:", error);
      }
    } else {
      console.error("No authenticated user found.");
    }
  });
}
let equipmentsList = []; // Declare equipmentsList globally for filtering
let filteredEquipments = equipmentsList; // Declare a variable for filtered equipments
let currentPage = 1;
const rowsPerPage = 5;
let selectedEquipments = [];
function sortEquipmentsById() {
  filteredEquipments.sort((a, b) => {
    const dateA = parseDate(a.stock_date);
    const dateB = parseDate(b.stock_date);
    return dateB - dateA; // Sort latest to oldest
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0); // Default to epoch if no date
  
  // If Firestore Timestamp object, convert it
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  
  return new Date(dateValue); // Convert string/ISO formats to Date
}
// Fetch equipments data (tb_equipment) from Firestore
async function fetchEquipments() {
  const equipmentsCollection = collection(db, "tb_equipment");
  const equipmentsQuery = query(equipmentsCollection);

  // Listen for real-time updates
  onSnapshot(equipmentsQuery, (snapshot) => {
    equipmentsList = snapshot.docs.map(doc => doc.data());
    filteredEquipments = [...equipmentsList];
    sortEquipmentsById();          // Sort Equipments by date (latest to oldest)
    displayEquipments(filteredEquipments); // Update table display
  }, (error) => {
    console.error("Error listening to Equipments:", error);
  });
}

// Display equipments in the table with pagination
function displayEquipments(equipmentsList) {
  const tableBody = document.querySelector(".equipment_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .equipment_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedEquipments = equipmentsList.slice(startIndex, endIndex);

  if (paginatedEquipments.length === 0) {
    // Show "No records found" if equipmentsList is empty
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

  // Render equipments list in the table
  paginatedEquipments.forEach((equipment) => {
    const row = document.createElement("tr");

    const equipmentName = equipment.equipment_name || "Equipment Name not recorded";
    const equipmentId = equipment.equipment_id || "Equipment Id not recorded";
    const equipmentType = equipment.equipment_category || "Equipment Category not recorded";
    const stock_date = equipment.stock_date
      ? (equipment.stock_date.toDate ? equipment.stock_date.toDate().toLocaleDateString() : new Date(equipment.stock_date).toLocaleDateString())
      : "Date not recorded";
    const currentStock = equipment.current_stock || "0";
    const unit = equipment.unit || "units";

    row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-equipment-id="${equipmentId}">
        </td>
        <td>${equipmentId}</td>
        <td>${equipmentName}</td>
        <td>${equipmentType}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>
          <button class="add-equip-stock-btn" id="add-equip-stock-btn" data-id="${equipment.cropTypeId}">+ Add Stock</button>
        </td>
    `;

    tableBody.appendChild(row);
  });
  addCheckboxListeners();
  updatePagination();
  toggleBulkDeleteButton();

}

// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredEquipments.length / rowsPerPage) || 1;
  document.getElementById("equipment-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("equipment-prev-page").disabled = currentPage === 1;
  document.getElementById("equipment-next-page").disabled = currentPage >= Math.ceil(filteredEquipments.length / rowsPerPage);
}

// Event listener for "Previous" button
document.getElementById("equipment-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayEquipments(filteredEquipments);
  }
});

// Event listener for "Next" button
document.getElementById("equipment-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredEquipments.length) {
    currentPage++;
    displayEquipments(filteredEquipments);
  }
});

// Fetch Equipment names for the dropdown
async function fetchEquipmentNames() {
  const equipmentsCollection = collection(db, "tb_equipment_types");
  const equipmentsSnapshot = await getDocs(equipmentsCollection);
  const equipmentNames = equipmentsSnapshot.docs.map(doc => doc.data().equipment_type_name);

  populateEquipmentDropdown(equipmentNames);
}

// Populate the equipment dropdown with equipment names
function populateEquipmentDropdown(equipmentNames) {
  const equipmentSelect = document.querySelector(".equipment_select");
  if (!equipmentSelect) {
    console.error("equipment dropdown not found!");
    return;
  }
  const firstOption = equipmentSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  equipmentSelect.innerHTML = firstOption;

  equipmentNames.forEach(equipmentName => {
    const option = document.createElement("option");
    option.textContent = equipmentName;
    equipmentSelect.appendChild(option);
  });
}

// Event listener to filter equipments based on dropdown selection
document.querySelector(".equipment_select").addEventListener("change", function () {
  const selectedEquipment = this.value.toLowerCase();
  // Filter Equipments based on selected value
  filteredEquipments = selectedEquipment
    ? equipmentsList.filter(equipment => equipment.equipment_category?.toLowerCase() === selectedEquipment)
    : equipmentsList; // If no selection, show all equipments

  currentPage = 1; // Reset to the first page when filter is applied
  sortEquipmentsById();
  displayEquipments(filteredEquipments); // Update the table with filtered Equipments
});

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchEquipmentNames();
  fetchEquipments();
});

// ---------------------------- equip BULK DELETE CODES ---------------------------- //
const deletemessage = document.getElementById("equip-bulk-message"); // delete message panel

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target; // The checkbox that triggered the event
  const row = checkbox.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  // Get equipmentType ID from the data attribute
  const equipmentId = checkbox.getAttribute("data-equipment-id");

  if (checkbox.checked) {
    // Add to selected list if checked
    if (!selectedEquipments.includes(equipmentId)) {
      selectedEquipments.push(equipmentId);
    }
  } else {
    // Remove from list if unchecked
    selectedEquipments = selectedEquipments.filter(item => item !== equipmentId);
  }

  console.log("Selected Equipments:", selectedEquipments);
  toggleBulkDeleteButton();
}


// Enable/Disable the Bulk Delete button
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("equip-bulk-delete");
  bulkDeleteButton.disabled = selectedEquipments.length === 0;
}
// Attach event listener to checkboxes (after equipments are displayed)
function addCheckboxListeners() {
  document.querySelectorAll(".equipment_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}
// <------------- BULK DELETE BUTTON CODE ---------------> //
document.getElementById("equip-bulk-delete").addEventListener("click", async () => {
  const selectedCheckboxes = document.querySelectorAll(".equipment_table input[type='checkbox']:checked");

  let selectedEquipmentIds = [];
  let hasInvalidId = false;

  for (const checkbox of selectedCheckboxes) {
      const equipmentId = checkbox.getAttribute("data-equipment-id");

      // Validate equipmentId (null, undefined, or empty string)
      if (!equipmentId || equipmentId.trim() === "") {
          hasInvalidId = true;
          break;
      }

      /* Check if the equipment_id exists in the database */
      try {
          const q = query(collection(db, "tb_equipment"), where("equipment_id", "==", Number(equipmentId)));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              hasInvalidId = true;
              console.error(`ERROR: Equipment ID ${equipmentId} does not exist in the database.`);
              break;
          }

          selectedEquipmentIds.push(equipmentId);
      } catch (error) {
          console.error("Error fetching Equipment records:", error);
          hasInvalidId = true;
          break;
      }
  }

  if (hasInvalidId) {
      showDeleteMessage("ERROR: Equipment ID of one or more selected records are invalid", false);
  } else {
      document.getElementById("equip-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-equip-delete").addEventListener("click", () => {
  document.getElementById("equip-bulk-panel").style.display = "none";
});

// Function to delete selected Equipments from Firestore
async function deleteSelectedEquipments() {
  if (selectedEquipments.length === 0) {
    return;
  }

  try {
    const equipmentsCollection = collection(db, "tb_equipment");

    // Loop through selected equipments and delete them
    for (const equipmentTypeId of selectedEquipments) {
      const equipmentQuery = query(equipmentsCollection, where("equipment_id", "==", Number(equipmentTypeId)));
      const querySnapshot = await getDocs(equipmentQuery);

      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, "tb_equipment", docSnapshot.id));
      });
    }

    console.log("Deleted equipments:", selectedEquipments);
    // Show success message
    await saveActivityLog(`Deleted Equipments: ${equipmentName.join(", ")}`);
    showDeleteMessage("All selected Equipment records successfully deleted!", true);

    // Clear selection and update the UI
    selectedEquipments = [];
    document.getElementById("equip-bulk-panel").style.display = "none"; // Hide confirmation panel
    fetchEquipments(); // Refresh the table

  } catch (error) {
    console.error("Error deleting equipments:", error);
    showDeleteMessage("Error deleting equipments!", false);
  }
}

// Confirm Deletion and Call Delete Function
document.getElementById("confirm-equip-delete").addEventListener("click", () => {
  deleteSelectedEquipments();
});

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
const deleteMessage = document.getElementById("equip-bulk-message");

function showDeleteMessage(message, success) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.opacity = '1';
  deleteMessage.style.display = 'block';

  setTimeout(() => {
    deleteMessage.style.opacity = '0';
    setTimeout(() => {
      deleteMessage.style.display = 'none';
    }, 300);
  }, 4000);
}

// Search bar event listener for real-time filtering
document.getElementById("equip-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();

  // Filter Equipments based on searchQuery, excluding stock and date fields
  filteredEquipments = equipmentsList.filter(equipment => {
    return (
      equipment.equipment_name?.toLowerCase().includes(searchQuery) ||
      equipment.equipment_category?.toLowerCase().includes(searchQuery) ||
      equipment.equipment_type_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortEquipmentsById();
  displayEquipments(filteredEquipments); // Update the table with filtered Equipments
});

// <------------------ FUNCTION TO DISPLAY equipment STOCK MESSAGE ------------------------>
const equipmentStockMessage = document.getElementById("equip-stock-message");

function showEquipmentStockMessage(message, success) {
  equipmentStockMessage.textContent = message;
  equipmentStockMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  equipmentStockMessage.style.opacity = '1';
  equipmentStockMessage.style.display = 'block';

  setTimeout(() => {
    equipmentStockMessage.style.opacity = '0';
    setTimeout(() => {
      equipmentStockMessage.style.display = 'none';
    }, 300);
  }, 4000);
}

// <------------------ FUNCTION TO DISPLAY ADD STOCK FLOATING PANEL ------------------------>
document.addEventListener("DOMContentLoaded", () => {
  const equipmentStockPanel = document.getElementById("equip-stock-panel");
  const equipmentOverlay = document.getElementById("equip-overlay");
  const cancelBtn = document.getElementById("equip-cancel-stock");
  const saveBtn = document.getElementById("equip-save-stock");

  document.querySelector(".equipment_table").addEventListener("click", async function (event) {
    if (event.target.classList.contains("add-equip-stock-btn")) {
      const row = event.target.closest("tr");
      if (!row) return;

      const equipmentTypeId = row.children[1].textContent.trim();

      try {
        const equipmentCollection = collection(db, "tb_equipment");
        const equipmentQuery = query(equipmentCollection, where("equipment_id", "==", Number(equipmentTypeId)));
        const querySnapshot = await getDocs(equipmentQuery);

        let equipmentCategory = "No category was recorded";
        let equipmentName = "No name was recorded";
        let equipmentUnit = "No unit was recorded";

        if (!querySnapshot.empty) {
          const equipmentData = querySnapshot.docs[0].data();

          equipmentCategory = equipmentData.equipment_category?.trim() || "No category was recorded";
          equipmentName = equipmentData.equipment_name?.trim() || "No name was recorded";
          equipmentUnit = equipmentData.unit?.trim() || "No unit was recorded";

          // Unit Dropdown Validation
          const unitDropdown = document.getElementById("equip_unit");
          unitDropdown.disabled = false; // Temporarily enable

          const unitOptions = Array.from(unitDropdown.options).map(opt => opt.value.toLowerCase());

          if (!equipmentUnit || equipmentUnit === "No unit was recorded") {
            // Ensure the dropdown has "Invalid Unit"
            let invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
            if (!invalidOption) {
              invalidOption = new Option("Invalid Unit", "Invalid Unit");
              unitDropdown.add(invalidOption);
            }
            unitDropdown.value = "Invalid Unit";
          } else {
            // Check if the unit exists in the dropdown
            if (unitOptions.includes(equipmentUnit.toLowerCase())) {
              unitDropdown.value = equipmentUnit;
            } else {
              // Remove existing "Invalid Unit" option if any
              const invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
              if (invalidOption) invalidOption.remove();
          
              // Add "Invalid Unit" option and select it
              const invalidOptionElement = new Option("Invalid Unit", "Invalid Unit");
              unitDropdown.add(invalidOptionElement);
              unitDropdown.value = "Invalid Unit";
            }
          }          

          unitDropdown.disabled = true; // Disable it again
        }

        // Assign values to the inputs
        document.getElementById("equip_category").value = equipmentCategory;
        document.getElementById("equip_name").value = equipmentName;
        document.getElementById("equip_unit_hidden").value = equipmentUnit;

        // Display the floating panel
        equipmentStockPanel.style.display = "block";
        equipmentOverlay.style.display = "block";
        saveBtn.dataset.equipmentTypeId = equipmentTypeId;
      } catch (error) {
        console.error("Error fetching equipment details:", error);
      }
    }
  });

  function closeStockPanel() {
    equipmentStockPanel.style.display = "none";
    equipmentOverlay.style.display = "none";
    document.getElementById("equip_category").value = "";
    document.getElementById("equip_name").value = "";
    document.getElementById("equip_stock").value = "";
    document.getElementById("equip_unit_hidden").value = "";
    fetchEquipments();
  }

  cancelBtn.addEventListener("click", closeStockPanel);
  equipmentOverlay.addEventListener("click", closeStockPanel);

  saveBtn.addEventListener("click", async function () {
    const equipmentTypeId = saveBtn.dataset.equipmentTypeId;
    const equipmentCategory = document.getElementById("equip_category").value;
    const equipmentName = document.getElementById("equip_name").value;
    const equipmentStock = document.getElementById("equip_stock").value;
    const unitDropdown = document.getElementById("equip_unit");
    let unit = unitDropdown.value.trim();

    if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
    }

    document.getElementById("equip_unit_hidden").value = unit;

    if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
      showEquipmentStockMessage("Please enter a valid equipment stock quantity.", false);
      return;
    }

    try {
      const equipmentsCollection = collection(db, "tb_equipment");
      const equipmentQuery = query(equipmentsCollection, where("equipment_id", "==", Number(equipmentTypeId)));
      const querySnapshot = await getDocs(equipmentQuery);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingStock = querySnapshot.docs[0].data().current_stock || 0;
        const newStock = existingStock + Number(equipmentStock);

        await updateDoc(docRef, {
          stock_date: Timestamp.now(),
          equipment_name: equipmentName,
          equipmentcategory: equipmentCategory,
          current_stock: newStock,
          unit: unit
        });
        await saveActivityLog(`Added Equipment Stock for ${equipmentName} with quantity of ${equipmentStock}`);
        showEquipmentStockMessage("Equipment Stock has been added successfully!", true);
        closeStockPanel();
      } else {
        showEquipmentStockMessage("ERROR: Invalid Equipment Name unable to save data", false);
      }
    } catch (error) {
      console.error("Error updating Equipment stock:", error);
      showEquipmentStockMessage("An error occurred while updating Equipment stock.", false);
    }
  });
});