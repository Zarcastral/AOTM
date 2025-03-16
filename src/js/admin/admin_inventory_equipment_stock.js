import {
  collection,
  getDocs,
  getDoc,
  getFirestore,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
  addDoc,
  arrayRemove,
  doc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();
// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchEquipmentNames();
  fetchEquipments();
});

function capitalizeWords(str) {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

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


async function saveActivityLog(action) {
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
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      // Both have dates, sort by date (latest to oldest)
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      // Neither has dates, sort by Equipment_id (low to high)
      return a.equipment_id - b.equipment_id;
    } else {
      // One has a date, prioritize those with dates first
      return hasDateB - hasDateA;
    }
  });
}

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->

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
    const equipmentCategory = equipment.equipment_category || "Equipment Category not recorded";
    // Iterate through stocks array
    equipment.stocks.forEach((stock) => {
      const stock_date = stock.stock_date
        ? (stock.stock_date.toDate ? stock.stock_date.toDate().toLocaleDateString() : new Date(stock.stock_date).toLocaleDateString())
        : "Stock has not been updated";
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "Units";
      const owned_by = stock.owned_by || "Owner not Recorded";

    row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-equipment-id="${equipmentId}">
        </td>
        <td>${equipmentId}</td>
        <td>${equipmentName}</td>
        <td>${equipmentCategory}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>
          <button class="add-equip-stock-btn" id="add-equip-stock-btn" data-id="${equipment.equipmentId}">+ Add Stock</button>
        </td>
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



const deletemessage = document.getElementById("equip-bulk-message"); // delete message panel

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target;
  const row = checkbox.closest("tr");
  if (!row) return;

  const equipmentId = checkbox.getAttribute("data-equipment-id");

  if (checkbox.checked) {
    if (!selectedEquipments.includes(equipmentId)) {
      selectedEquipments.push(equipmentId);
    }
  } else {
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

// Attach event listener to checkboxes
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

    if (!equipmentId || equipmentId.trim() === "") {
      hasInvalidId = true;
      break;
    }

    try {
      const q = query(collection(db, "tb_equipment_stock"), where("equipment_id", "==", Number(equipmentId)));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        hasInvalidId = true;
        console.error(`ERROR: equipment ID ${equipmentId} does not exist in the database.`);
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
    deleteSelectedEquipments("ERROR: Equipment ID of one or more selected records are invalid", false);
  } else {
    document.getElementById("equip-bulk-panel").style.display = "block";
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-equip-delete").addEventListener("click", () => {
  document.getElementById("equip-bulk-panel").style.display = "none";
});

// Function to delete selected Equipments from tb_Equipment_stock's stocks array based on owned_by
async function deleteSelectedEquipments() {
  if (selectedEquipments.length === 0) {
    return;
  }

  try {
    // Get the current authenticated user's user_type
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "tb_users", user.uid));
    const userType = userDoc.data().user_type;  // Fetch user_type instead of user_name

    const stockCollection = collection(db, "tb_equipment_stock");
    let deletedEquipmentNames = [];

    for (const equipmentId of selectedEquipments) {
      const stockQuery = query(stockCollection, where("equipment_id", "==", Number(equipmentId)));
      const stockSnapshot = await getDocs(stockQuery);

      for (const docSnapshot of stockSnapshot.docs) {
        const stockData = docSnapshot.data();
        const docRef = doc(db, "tb_equipment_stock", docSnapshot.id);

        // Filter stocks to get only those matching the user_type -> owned_by
        const stocksToRemove = stockData.stocks.filter(stock => stock.owned_by === userType);

        if (stocksToRemove.length > 0) {
          for (const stock of stocksToRemove) {
            await updateDoc(docRef, {
              stocks: arrayRemove(stock)
            });
            deletedEquipmentNames.push(stock.equipment_name);
          }
        }
      }
    }

    console.log("Deleted Equipments:", deletedEquipmentNames);
    await saveActivityLog(`Deleted Equipments: ${deletedEquipmentNames.join(", ")}`);
    deleteSelectedEquipments("All selected Equipment records successfully deleted!", true);

    selectedEquipments = [];
    document.getElementById("equip-bulk-panel").style.display = "none";
    fetchEquipments();

  } catch (error) {
    console.error("Error deleting Equipments:", error);
    deleteSelectedEquipments("Error deleting Equipments!", false);
  }
}

// Confirm Deletion and Call Delete Function
document.getElementById("confirm-equip-delete").addEventListener("click", () => {
  deleteSelectedEquipments();
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

        const equipmentId = row.children[1].textContent.trim();

        try {
            const equipmentCollection = collection(db, "tb_equipment");
            const equipmentQuery = query(equipmentCollection, where("equipment_id", "==", Number(equipmentId)));
            const querySnapshot = await getDocs(equipmentQuery);

            let equipmentCategory = "No category was recorded";
            let equipmentName = "No name was recorded";
            let equipmentUnit = "No unit was recorded";

            if (!querySnapshot.empty) {
                const equipmentData = querySnapshot.docs[0].data();

                equipmentCategory = equipmentData.equipment_category?.trim() || "No category was recorded";
                equipmentName = equipmentData.equipment_name?.trim() || "No name was recorded";

                // Assign equipmentUnit based on equipmentCategory
                if (equipmentCategory.toLowerCase() === "tools") {
                    equipmentUnit = "tools";
                } else if (["machine", "machinery"].includes(equipmentCategory.toLowerCase())) {
                    equipmentUnit = "machineries";
                } else {
                    equipmentUnit = "No unit was recorded";
                }

                // Unit Dropdown Validation
                const unitDropdown = document.getElementById("equip_unit");
                unitDropdown.disabled = false; // Temporarily enable

                const unitOptions = Array.from(unitDropdown.options).map(opt => opt.value.toLowerCase());

                if (!equipmentUnit || equipmentUnit === "No unit was recorded") {
                    let invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
                    if (!invalidOption) {
                        invalidOption = new Option("Invalid Unit", "Invalid Unit");
                        unitDropdown.add(invalidOption);
                    }
                    unitDropdown.value = "Invalid Unit";
                } else {
                    if (unitOptions.includes(equipmentUnit.toLowerCase())) {
                        unitDropdown.value = equipmentUnit;
                    } else {
                        const invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
                        if (invalidOption) invalidOption.remove();

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
            saveBtn.dataset.equipmentId = equipmentId;
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

// <--------------------------------> FUNCTION TO SAVE <-------------------------------->
saveBtn.addEventListener("click", async function () {
  const equipmentId = saveBtn.dataset.equipmentId;
  const equipmentCategory = document.getElementById("equip_category").value;  // Still needed for activity log
  const equipmentName = document.getElementById("equip_name").value;           // Still needed for activity log
  const equipmentStock = document.getElementById("equip_stock").value;
  let unit = capitalizeWords(document.getElementById("equip_unit").value.trim());

  if (!unit || unit === "Invalid Unit") {
    unit = "No unit was recorded";
  }

  if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
    showEquipmentStockMessage("Please enter a valid Equipment stock quantity.", false);
    return;
  }

  try {
    // Get the authenticated user
    const user = await getAuthenticatedUser().catch((error) => {
      showEquipmentStockMessage(error, false);
      throw new Error(error);
    });

    // Fetch user_type from tb_users based on the authenticated email
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showEquipmentStockMessage("User not found in the database.", false);
      return;
    }

    // Get user_type from the fetched user document
    const userType = userSnapshot.docs[0].data().user_type;

    // Fetch Equipment data from tb_Equipment
    const equipmentsCollection = collection(db, "tb_equipment");
    const equipmentQuery = query(equipmentsCollection, where("equipment_id", "==", Number(equipmentId)));
    const querySnapshot = await getDocs(equipmentQuery);

    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      const existingStock = querySnapshot.docs[0].data().current_stock || 0;
      const newStock = existingStock + Number(equipmentStock);

      // Update stock in tb_equipment_types
      await updateDoc(docRef, {
        stock_date: Timestamp.now(),
        current_stock: newStock,
        unit: unit
      });

      // Check if record already exists in tb_equipment_stock for the same equipment_type_id
      const inventoryCollection = collection(db, "tb_equipment_stock");
      const inventoryQuery = query(inventoryCollection, where("equipment_id", "==", Number(equipmentId)));
      const inventorySnapshot = await getDocs(inventoryQuery);

      if (!inventorySnapshot.empty) {
        // Record exists, update the stocks array
        const inventoryDocRef = inventorySnapshot.docs[0].ref;
        const inventoryData = inventorySnapshot.docs[0].data();
        const stocks = inventoryData.stocks || [];

        // Check if owned_by already exists in the stocks array
        const userStockIndex = stocks.findIndex(stock => stock.owned_by === userType);

        if (userStockIndex !== -1) {
          // Update existing stock for this user_type
          stocks[userStockIndex].current_stock += Number(equipmentStock);
          stocks[userStockIndex].stock_date = Timestamp.now();
          stocks[userStockIndex].unit = unit;
        } else {
          // Add a new stock entry for this user_type
          stocks.push({
            owned_by: userType,
            current_stock: Number(equipmentStock),
            stock_date: Timestamp.now(),
            unit: unit
          });
        }

        // Update the document with the modified stocks array
        await updateDoc(inventoryDocRef, { stocks: stocks });
      } else {
        // Record does not exist, create a new document with stocks array
        await addDoc(inventoryCollection, {
          equipment_id: Number(equipmentId),
          stocks: [
            {
              owned_by: userType,
              current_stock: Number(equipmentStock),
              stock_date: Timestamp.now(),
              unit: unit
            }
          ]
        });
      }

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