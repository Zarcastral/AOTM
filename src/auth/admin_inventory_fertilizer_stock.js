import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
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
    const dateA = parseDate(a.stock_date);
    const dateB = parseDate(b.stock_date);
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
  const fertilizersCollection = collection(db, "tb_fertilizer");
  const fertilizersQuery = query(fertilizersCollection);

  // Listen for real-time updates
  onSnapshot(fertilizersQuery, (snapshot) => {
    fertilizersList = snapshot.docs.map(doc => doc.data());
    filteredFertilizers = [...fertilizersList];
    sortFertilizersById();          // Sort Fertilizers by date (latest to oldest)
    displayFertilizers(filteredFertilizers); // Update table display
  }, (error) => {
    console.error("Error listening to Fertilizers:", error);
  });
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
    const fertilizerType = fertilizer.fertilizer_type_name || "Fertilizer Category not recorded";
    const stock_date = fertilizer.stock_date
      ? (fertilizer.stock_date.toDate ? fertilizer.stock_date.toDate().toLocaleDateString() : new Date(fertilizer.stock_date).toLocaleDateString())
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
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>
          <button class="add-fert-stock-btn" id="add-fert-btn" data-id="${fertilizer.fertilizerId}">+ Add Stock</button>
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
    ? fertilizersList.filter(fertilizer => fertilizer.fertilizer_type_name?.toLowerCase() === selectedFertilizer)
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
          const q = query(collection(db, "tb_fertilizer"), where("fertilizer_id", "==", Number(fertilizerId)));
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
    for (const fertilizerId of selectedFertilizers) {
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerId)));
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
      fertilizer.fertilizer_type_name?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_type_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered Fertilizers
});
// <------------------ FUNCTION TO DISPLAY fertment STOCK MESSAGE ------------------------>
const fertilizerStockMessage = document.getElementById("fert-stock-message");

function showFertilizerStockMessage(message, success) {
  fertilizerStockMessage.textContent = message;
  fertilizerStockMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  fertilizerStockMessage.style.opacity = '1';
  fertilizerStockMessage.style.display = 'block';

  setTimeout(() => {
    fertilizerStockMessage.style.opacity = '0';
    setTimeout(() => {
      fertilizerStockMessage.style.display = 'none';
    }, 300);
  }, 4000);
}
// <------------------ FUNCTION TO DISPLAY ADD STOCK FLOATING PANEL ------------------------>

document.addEventListener("DOMContentLoaded", () => {
  const fertilizerStockPanel = document.getElementById("fert-stock-panel");
  const fertilizerOverlay = document.getElementById("fert-overlay");
  const cancelBtn = document.getElementById("fert-cancel-stock");
  const saveBtn = document.getElementById("fert-save-stock");

  document.querySelector(".fertilizer_table").addEventListener("click", async function (event) {
    if (event.target.classList.contains("add-fert-stock-btn")) {
      const row = event.target.closest("tr");
      if (!row) return;

      const fertilizerId = row.children[1].textContent.trim();

      try {
        const fertilizerCollection = collection(db, "tb_fertilizer");
        const fertilizerQuery = query(fertilizerCollection, where("fertilizer_id", "==", Number(fertilizerId)));
        const querySnapshot = await getDocs(fertilizerQuery);

        let fertilizerTypeName = "No category was recorded";
        let fertilizerName = "No name was recorded";
        let fertilizerUnit = "No unit was recorded";

        if (!querySnapshot.empty) {
          const fertilizerData = querySnapshot.docs[0].data();

          fertilizerTypeName = fertilizerData.fertilizer_type_name?.trim() || "No category was recorded";
          fertilizerName = fertilizerData.fertilizer_name?.trim() || "No name was recorded";
          fertilizerUnit = fertilizerData.unit?.trim() || "No unit was recorded";

          // Unit Dropdown Validation
          const unitDropdown = document.getElementById("fert_unit");
          unitDropdown.disabled = false; // Temporarily enable

          const unitOptions = Array.from(unitDropdown.options).map(opt => opt.value.toLowerCase());

          if (!fertilizerUnit || fertilizerUnit === "No unit was recorded") {
            // Ensure the dropdown has "Invalid Unit"
            let invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
            if (!invalidOption) {
              invalidOption = new Option("Invalid Unit", "Invalid Unit");
              unitDropdown.add(invalidOption);
            }
            unitDropdown.value = "Invalid Unit";
          } else {
            // Check if the unit exists in the dropdown
            if (unitOptions.includes(fertilizerUnit.toLowerCase())) {
              unitDropdown.value = fertilizerUnit;
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
        document.getElementById("fert_category").value = fertilizerTypeName;
        document.getElementById("fert_name").value = fertilizerName;
        document.getElementById("fert_unit_hidden").value = fertilizerUnit;

        fertilizerStockPanel.style.display = "block";
        fertilizerOverlay.style.display = "block";
        saveBtn.dataset.fertilizerId = fertilizerId;
      } catch (error) {
        console.error("Error fetching fertilizer details:", error);
      }
    }
  });

  function closeStockPanel() {
    fertilizerStockPanel.style.display = "none";
    fertilizerOverlay.style.display = "none";
    document.getElementById("fert_category").value = "";
    document.getElementById("fert_name").value = "";
    document.getElementById("fert_stock").value = "";
    document.getElementById("fert_unit_hidden").value = "";
    fetchFertilizers();
  }

  cancelBtn.addEventListener("click", closeStockPanel);
  fertilizerOverlay.addEventListener("click", closeStockPanel);

  saveBtn.addEventListener("click", async function () {
    const fertilizerId = saveBtn.dataset.fertilizerId;
    const fertilizerTypeName = document.getElementById("fert_category").value;
    const fertilizerName = document.getElementById("fert_name").value;
    const fertilizerStock = document.getElementById("fert_stock").value;
    const unit = document.getElementById("fert_unit").value;

    if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
    }
    
    if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
      showFertilizerStockMessage("Please enter a valid fertilizer stock quantity.", false);
      return;
    }

    try {
      const fertilizersCollection = collection(db, "tb_fertilizer");
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerId)));
      const querySnapshot = await getDocs(fertilizerQuery);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingStock = querySnapshot.docs[0].data().current_stock || 0;
        const newStock = existingStock + Number(fertilizerStock);

        await updateDoc(docRef, {
          stock_date: Timestamp.now(),
          fertilizer_name: fertilizerName,
          fertilizerTypeName: fertilizerTypeName,
          current_stock: newStock,
          unit: unit
        });

        showFertilizerStockMessage("Fertilizer Stock has been added successfully!", true);
        closeStockPanel();
      } else {
        showFertilizerStockMessage("ERROR: Invalid Fertilizer Name unable to save data", false);
      }
    } catch (error) {
      console.error("Error updating Fertilizer stock:", error);
      showFertilizerStockMessage("An error occurred while updating Fertilizer stock.", false);
    }
  });
});