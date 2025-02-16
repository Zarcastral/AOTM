import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  deleteDoc,
  doc
} from "firebase/firestore";

import app from "../config/firebase_config.js";

const db = getFirestore(app);
let equipmentsList = []; // Declare equipmentsList globally for filtering
let filteredEquipments = equipmentsList; // Declare a variable for filtered equipments
let currentPage = 1;
const rowsPerPage = 5;
let selectedEquipments = [];
function sortEquipmentsById() {
  filteredEquipments.sort((a, b) => {
    const dateA = parseDate(a.dateAdded);
    const dateB = parseDate(b.dateAdded);
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
  console.log("Fetching equipments..."); // Debugging
  try {
    const equipmentsCollection = collection(db, "tb_equipment");
    const equipmentsSnapshot = await getDocs(equipmentsCollection);
    equipmentsList = equipmentsSnapshot.docs.map(doc => doc.data());

    console.log("equipments fetched:", equipmentsList); // Debugging
    filteredEquipments = equipmentsList; // Initialize filtered list
    sortEquipmentsById();
    displayEquipments(filteredEquipments);
  } catch (error) {
    console.error("Error fetching equipments:", error);
  }
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
    const dateAdded = equipment.dateAdded
      ? (equipment.dateAdded.toDate ? equipment.dateAdded.toDate().toLocaleDateString() : new Date(equipment.dateAdded).toLocaleDateString())
      : "Date not recorded";
    const currentStock = equipment.current_stock || "0";
    const unit = equipment.unit || "units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${equipmentId}</td>
        <td>${equipmentName}</td>
        <td>${equipmentType}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
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
// CHECKBOX
function handleCheckboxChange(event) {
  const row = event.target.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  const equipmentTypeId = row.children[1]?.textContent.trim(); // Get equipment_type_name

  if (event.target.checked) {
    // Add to selected list if checked
    if (!selectedEquipments.includes(equipmentTypeId)) {
      selectedEquipments.push(equipmentTypeId);
    }
  } else {
    // Remove from list if unchecked
    selectedEquipments = selectedEquipments.filter(item => item !== equipmentTypeId);
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

// Trigger Bulk Delete Confirmation Panel
document.getElementById("equip-bulk-delete").addEventListener("click", () => {
  if (selectedEquipments.length > 0) {
    document.getElementById("equip-bulk-panel").style.display = "block"; // Show confirmation panel
  } else {
    alert("No Equipments selected for deletion."); // Prevent deletion if none are selected
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
