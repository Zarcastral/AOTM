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

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchFertilizers();
});

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
    filteredFertilizers = fertilizersList;
    sortFertilizersById();
    displayFertilizers(filteredFertilizers);
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
  }
}

function displayFertilizers(fertilizersList) {
  const tableBody = document.querySelector(".fertilizer_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .fertilizer_table");
    return;
  }

  tableBody.innerHTML = "";
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
        <td class="checkbox">
            <input type="checkbox" data-fertilizer-id="${fertilizerId}">
        </td>
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

// ---------------------------- FERTILIZER BULK DELETE CODES ---------------------------- //
const deletemessage = document.getElementById("fert-bulk-message");

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target; // The checkbox that triggered the event
  const row = checkbox.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  // Get fertilizer ID from the data attribute
  const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

  if (checkbox.checked) {
    // Add to selected list if checked
    if (!selectedFertilizers.includes(fertilizerId)) {
      selectedFertilizers.push(fertilizerId);
    }
  } else {
    // Remove from list if unchecked
    selectedFertilizers = selectedFertilizers.filter(item => item !== fertilizerId);
  }

  console.log("Selected Fertilizers:", selectedFertilizers);
  toggleBulkDeleteButton();
}


// BULK DELETE TOGGLE 
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("fert-bulk-delete");
  bulkDeleteButton.disabled = selectedFertilizers.length === 0;
}
function addCheckboxListeners() {
  document.querySelectorAll(".fertilizer_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}

// BULK DELETE CONFIRM/CANCEL BUTTON CODE
document.getElementById("confirm-fert-delete").addEventListener("click", () => {
  deleteSelectedFertilizers();
});

document.getElementById("cancel-fert-delete").addEventListener("click", () => {
  document.getElementById("fert-bulk-panel").style.display = "none";
});

// <------------- BULK DELETE BUTTON CODE ---------------> //
document.getElementById("fert-bulk-delete").addEventListener("click", async () => {
  const selectedCheckboxes = document.querySelectorAll(".fertilizer_table input[type='checkbox']:checked");

  let selectedFertilizerIds = [];
  let hasInvalidId = false;

  for (const checkbox of selectedCheckboxes) {
      const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

      // Validate fertilizerId (null, undefined, or empty string)
      if (!fertilizerId || fertilizerId.trim() === "") {
          hasInvalidId = true;
          break;
      }

      /* Check if the fertilizer_id exists in the database */
      try {
          const q = query(collection(db, "tb_fertilizers"), where("fertilizer_id", "==", Number(fertilizerId)));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              hasInvalidId = true;
              console.error(`ERROR: Fertilizer ID ${fertilizerId} does not exist in the database.`);
              break;
          }

          selectedFertilizerIds.push(fertilizerId);
      } catch (error) {
          console.error("Error fetching fertilizer records:", error);
          hasInvalidId = true;
          break;
      }
  }

  if (hasInvalidId) {
      showDeleteMessage("ERROR: Fertilizier ID of one or more selected records are invalid", false);
  } else {
      document.getElementById("fert-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// FUNCTION FOR DELETING THE SELECTED FERTILIZERS
async function deleteSelectedFertilizers() {
  if (selectedFertilizers.length === 0) {
    return;
  }

  try {
    const fertilizersCollection = collection(db, "tb_fertilizer");

    // Loops through selected fertilizers and delete them
    for (const fertilizerTypeId of selectedFertilizers) {
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerTypeId)));
      const querySnapshot = await getDocs(fertilizerQuery);

      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, "tb_fertilizer", docSnapshot.id));
      });
    }

    console.log("Deleted fertilizers:", selectedFertilizers);
    showDeleteMessage("All selected Fertilizer records successfully deleted!", true);
    selectedFertilizers = [];

    document.getElementById("fert-bulk-panel").style.display = "none";
    fetchFertilizers();
  } catch (error) {
    console.error("Error deleting fertilizers:", error);
    showDeleteMessage("Error deleting fertilizers!", false);
  }
}

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
