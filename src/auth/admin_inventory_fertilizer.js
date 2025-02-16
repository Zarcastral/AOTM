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
let fertilizersList = []; // Declare fertilizersList globally for filtering
let filteredFertilizers = fertilizersList; // Declare a variable for filtered fertilizers
let currentPage = 1;
const rowsPerPage = 5;
let selectedFertilizers = [];
function sortFertilizersById() {
   filteredFertilizers.sort((a, b) => {
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
// Fetch fertilizers data (tb_fertilizer) from Firestore
async function fetchFertilizers() {
  console.log("Fetching fertilizers..."); // Debugging
  try {
    const fertilizersCollection = collection(db, "tb_fertilizer");
    const fertilizersSnapshot = await getDocs(fertilizersCollection);
    fertilizersList = fertilizersSnapshot.docs.map(doc => doc.data());

    console.log("fertilizers fetched:", fertilizersList); // Debugging
    filteredFertilizers = fertilizersList; // Initialize filtered list
    sortFertilizersById();
    displayFertilizers(filteredFertilizers);
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
  }
}

// Display fertilizers in the table with pagination
function displayFertilizers(fertilizersList) {
  const tableBody = document.querySelector(".fertilizer_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .fertilizer_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedFertilizers = fertilizersList.slice(startIndex, endIndex);

  if (paginatedFertilizers.length === 0) {
    // Show "No records found" if fertilizersList is empty
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

  // Render fertilizers list in the table
  paginatedFertilizers.forEach((fertilizer, index) => {
    const row = document.createElement("tr");

    const fertilizerName = fertilizer.fertilizer_name || "Fertilizer Name not recorded";
    const fertilizerId = fertilizer.fertilizer_id || "Fertilizer Id not recorded";
    const fertilizerType = fertilizer.fertilizer_category || "Fertilizer Category not recorded";
    const dateAdded = fertilizer.dateAdded
      ? (fertilizer.dateAdded.toDate ? fertilizer.dateAdded.toDate().toLocaleDateString() : new Date(fertilizer.dateAdded).toLocaleDateString())
      : "Date not recorded";
    const currentStock = fertilizer.current_stock || "0";
    const unit = fertilizer.unit || "units";

    row.innerHTML = `
        <td class="checkbox"><input type="checkbox"></td>
        <td>${fertilizerId}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizerType}</td>
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
  const totalPages = Math.ceil(filteredFertilizers.length / rowsPerPage) || 1;
  document.getElementById("fertilizer-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("fertilizer-prev-page").disabled = currentPage === 1;
  document.getElementById("fertilizer-next-page").disabled = currentPage >= Math.ceil(filteredFertilizers.length / rowsPerPage);
}

// Event listener for "Previous" button
document.getElementById("fertilizer-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayFertilizers(filteredFertilizers);
  }
});

// Event listener for "Next" button
document.getElementById("fertilizer-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredFertilizers.length) {
    currentPage++;
    displayFertilizers(filteredFertilizers);
  }
});

// Fetch fertilizer names for the dropdown
async function fetchFertilizerNames() {
  const fertilizersCollection = collection(db, "tb_fertilizer_types");
  const fertilizersSnapshot = await getDocs(fertilizersCollection);
  const fertilizerNames = fertilizersSnapshot.docs.map(doc => doc.data().fertilizer_type_name);

  populateFertilizerDropdown(fertilizerNames);
}

// Populate the fertilizer dropdown with fertilizer names
function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");
  if (!fertilizerSelect) {
    console.error("fertilizer dropdown not found!");
    return;
  }
  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach(fertilizerName => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}

// Event listener to filter fertilizers based on dropdown selection
document.querySelector(".fertilizer_select").addEventListener("change", function () {
  const selectedFertilizer = this.value.toLowerCase();
  // Filter fertilizers based on selected value
  filteredFertilizers = selectedFertilizer
    ? fertilizersList.filter(fertilizer => fertilizer.fertilizer_category?.toLowerCase() === selectedFertilizer)
    : fertilizersList; // If no selection, show all fertilizers

  currentPage = 1; // Reset to the first page when filter is applied
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered fertilizers
});

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchFertilizers();
});


// ---------------------------- fert BULK DELETE CODES ---------------------------- //
const deletemessage = document.getElementById("fert-bulk-message"); // delete message panel
// CHECKBOX
function handleCheckboxChange(event) {
  const row = event.target.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  const fertilizerTypeId = row.children[1]?.textContent.trim(); // Get fertilizer_type_name

  if (event.target.checked) {
    // Add to selected list if checked
    if (!selectedFertilizers.includes(fertilizerTypeId)) {
      selectedFertilizers.push(fertilizerTypeId);
    }
  } else {
    // Remove from list if unchecked
    selectedFertilizers = selectedFertilizers.filter(item => item !== fertilizerTypeId);
  }

  console.log("Selected Fertilizers:", selectedFertilizers);
  toggleBulkDeleteButton();
}
// Enable/Disable the Bulk Delete button
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("fert-bulk-delete");
  bulkDeleteButton.disabled = selectedFertilizers.length === 0;
}
// Attach event listener to checkboxes (after fertilizers are displayed)
function addCheckboxListeners() {
  document.querySelectorAll(".fertilizer_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}

// Trigger Bulk Delete Confirmation Panel
document.getElementById("fert-bulk-delete").addEventListener("click", () => {
  if (selectedFertilizers.length > 0) {
    document.getElementById("fert-bulk-panel").style.display = "block"; // Show confirmation panel
  } else {
    alert("No fertilizers selected for deletion."); // Prevent deletion if none are selected
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-fert-delete").addEventListener("click", () => {
  document.getElementById("fert-bulk-panel").style.display = "none";
});

// Function to delete selected fertilizers from Firestore
async function deleteSelectedFertilizers() {
  if (selectedFertilizers.length === 0) {
    return;
  }

  try {
    const fertilizersCollection = collection(db, "tb_fertilizer");

    // Loop through selected fertilizers and delete them
    for (const fertilizerTypeId of selectedFertilizers) {
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerTypeId)));
      const querySnapshot = await getDocs(fertilizerQuery);

      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, "tb_fertilizer", docSnapshot.id));
      });
    }

    console.log("Deleted fertilizers:", selectedFertilizers);
    // Show success message
    showDeleteMessage("All selected Fertilizer records successfully deleted!", true);

    // Clear selection and update the UI
    selectedFertilizers = [];
    document.getElementById("fert-bulk-panel").style.display = "none"; // Hide confirmation panel
    fetchFertilizers(); // Refresh the table

  } catch (error) {
    console.error("Error deleting fertilizers:", error);
    showDeleteMessage("Error deleting fertilizers!", false);
  }
}

// Confirm Deletion and Call Delete Function
document.getElementById("confirm-fert-delete").addEventListener("click", () => {
  deleteSelectedFertilizers();
});

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
const deleteMessage = document.getElementById("fert-bulk-message");

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
document.getElementById("fert-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();

  // Filter Fertilizers based on searchQuery, excluding stock and date fields
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    return (
      fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_category?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_type_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered Fertilizers
});
