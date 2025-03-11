import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  deleteDoc,
  onSnapshot,
  doc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

let equipmentsList = []; // Declare equipmentsList globally for filtering
let filteredEquipments = equipmentsList; // Declare a variable for filtered equipments
let currentPage = 1;
const rowsPerPage = 5;
let selectedEquipments = [];
let currentUserName = ""; // Variable to store the current user's user_name

async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userName = userSnapshot.docs[0].data().user_name;
            console.log("Authenticated user's user_name:", userName);
            resolve(user); // Resolve with user object if needed
          } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user_name:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}


// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchEquipmentNames();
  fetchEquipments();
});
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
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    // Get user_type from the fetched user document
    const userType = userSnapshot.docs[0].data().user_type;

    const equipmentsCollection = collection(db, "tb_equipment");
    const equipmentsQuery = query(equipmentsCollection);

    // Listen for real-time updates
    onSnapshot(equipmentsQuery, async (snapshot) => {
      const equipmentsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const equipment = doc.data();
        const equipmentId = equipment.equipment_id;

        // Check if equipmentId is defined
        if (equipmentId) {
          const stockCollection = collection(db, "tb_equipment_stock");
          const stockQuery = query(stockCollection, where("equipment_id", "==", equipmentId));
          const stockSnapshot = await getDocs(stockQuery);

          // Initialize stock array for this equipment
          equipment.stocks = [];

          if (!stockSnapshot.empty) {
            const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
              const stockData = stockDoc.data();
              return stockData.stocks || []; // Access the nested stocks array if available
            });
          
            if (stockDataArray.length > 0) {
              // Filter stock data for the authenticated user based on user_type
              const userStockData = stockDataArray.filter(stock => stock.owned_by === userType);
          
              if (userStockData.length > 0) {
                equipment.stocks = userStockData;  // Save user-specific stock data as an array
              } else {
                // Stocks exist but not for the current user_type
                equipment.stocks = [{
                  stock_date: null,
                  current_stock: "",
                  unit: "Stock has not been updated yet",
                  owned_by: "No stock record found for the current user type"
                }];
              }
            } else {
              // `stocks` array is empty for all users
              equipment.stocks = [{
                stock_date: null,
                current_stock: "",
                unit: "Stock has not been updated yet",
                owned_by: "No stock record found for any user type"
              }];
            }
          } else {
            // No stock data found at all
            equipment.stocks = [{
              stock_date: null,
              current_stock: "",
              unit: "Stock has not been updated yet",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          console.error("equipment_id is undefined for:", equipment.equipment_name);
          // Skip this equipment if equipment_id is missing
          return null;
        }

        return equipment;
      }));

      // Filter out null results if any equipment was skipped
      const validEquipmentsData = equipmentsData.filter(equip => equip !== null);

      equipmentsList = validEquipmentsData;
      filteredEquipments = [...equipmentsList];
      sortEquipmentsById();                  // Sort Equipments by date (latest to oldest)
      displayEquipments(filteredEquipments);  // Update table display
    }, (error) => {
      console.error("Error listening to Equipments:", error);
    });
  } catch (error) {
    console.error("Error fetching Equipments:", error);
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
      ? equipment.dateAdded.toDate
        ? equipment.dateAdded.toDate().toLocaleDateString()
        : new Date(equipment.dateAdded).toLocaleDateString()
      : "Date not recorded";
    equipment.stocks.forEach((stock) => {
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "Units";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
          <td class="checkbox">
              <input type="checkbox" data-equipment-id="${equipmentId}">
          </td>
          <td>${equipmentId}</td>
          <td>${equipmentName}</td>
          <td>${equipmentType}</td>
          <td>${dateAdded}</td>
          <td>${currentStock} ${unit}</td>
          <td>${owned_by}</td>
      `;
    tableBody.appendChild(row);
  });
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
  let hasStocks = false;  // Flag to track if stocks exist

  for (const checkbox of selectedCheckboxes) {
      const equipmentId = checkbox.getAttribute("data-equipment-id");

      // Validate equipmentId (null, undefined, or empty string)
      if (!equipmentId || equipmentId.trim() === "") {
          hasInvalidId = true;
          break;
      }

      /* Check if the equipmentType_id exists in the database */
      try {
          const q = query(collection(db, "tb_equipment"), where("equipment_id", "==", Number(equipmentId)));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              hasInvalidId = true;
              console.error(`ERROR: equipment ID ${equipmentId} does not exist in the database.`);
              break;
          }

          // Check if there are stocks for this equipment_type_id by querying tb_equipment_stock
          const stockQuery = query(collection(db, "tb_equipment_stock"), where("equipment_id", "==", Number(equipmentId)));
          const stockSnapshot = await getDocs(stockQuery);

          if (!stockSnapshot.empty) {
              for (const stockDoc of stockSnapshot.docs) {
                  const stocksArray = stockDoc.data().stocks;
                  if (Array.isArray(stocksArray) && stocksArray.length > 0) {
                      hasStocks = true;
                      console.error(`ERROR: equipment ID ${equipmentId} has stocks and cannot be deleted.`);
                      break;
                  }
              }
          }

          if (hasStocks) break;  // Stop further checks if stocks are found

          selectedEquipmentIds.push(equipmentId);
      } catch (error) {
          console.error("Error fetching equipment records or stocks:", error);
          hasInvalidId = true;
          break;
      }
  }

  if (hasInvalidId) {
      showDeleteMessage("ERROR: Equipment ID of one or more selected records are invalid", false);
  } else if (hasStocks) {
      showDeleteMessage("ERROR: One or more selected Equipments have existing stocks", false);
  } else {
      document.getElementById("equip-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-equip-delete").addEventListener("click", () => {
  document.getElementById("equip-bulk-panel").style.display = "none";
});

// Function to delete selected Equipments from both tb_Equipment_types and tb_Equipment_stock in Firestore
async function deleteSelectedEquipments() {
  if (selectedEquipments.length === 0) {
    return;
  }

  try {
    const equipmentsCollection = collection(db, "tb_equipment");
    const stocksCollection = collection(db, "tb_equipment_stock");
    const batch = writeBatch(db);  // Create a batch for efficient deletions

    for (const equipmentId of selectedEquipments) {
      // Delete from tb_Equipment_types
      const equipmentQuery = query(equipmentsCollection, where("equipment_id", "==", Number(equipmentId)));
      const equipmentSnapshot = await getDocs(equipmentQuery);

      if (!equipmentSnapshot.empty) {
        for (const docSnapshot of equipmentSnapshot.docs) {
          console.log("Deleting document ID from tb_equipment:", docSnapshot.id);
          batch.delete(doc(db, "tb_equipment", docSnapshot.id));  // Add to batch
        }
      } else {
        console.error(`ERROR: Equipment ID ${equipmentId} does not exist in tb_equipment.`);
      }

      // Delete from tb_equipment_stock
      const stockQuery = query(stocksCollection, where("equipment_id", "==", Number(equipmentId)));
      const stockSnapshot = await getDocs(stockQuery);

      if (!stockSnapshot.empty) {
        for (const stockDoc of stockSnapshot.docs) {
          console.log("Deleting document ID from tb_equipment_stock:", stockDoc.id);
          batch.delete(doc(db, "tb_equipment_stock", stockDoc.id));  // Add to batch
        }
      } else {
        console.warn(`WARNING: No matching stocks found for Equipment ID ${equipmentId} in tb_equipment_stock.`);
      }
    }

    // Commit all deletions in a batch
    await batch.commit();
    console.log("Deleted equips and Stocks:", selectedEquipments);
    showDeleteMessage("All selected Equipment records and their stocks successfully deleted!", true);
    selectedEquipments = [];  // Clear selection AFTER successful deletion
    document.getElementById("equip-bulk-panel").style.display = "none";
    fetchEquipments();  // Refresh the table

  } catch (error) {
    console.error("Error deleting Equipments or stocks:", error);
    showDeleteMessage("Error deleting Equipments or stocks!", false);
  }
}

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
