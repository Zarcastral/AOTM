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
  addEquipStock();
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
            const userData = userSnapshot.docs[0].data();
            resolve({ ...user, user_type: userData.user_type }); // ✅ Ensure user_type is returned
          } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user_type:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}
// <-----------------------ACTIVITY LOG CODE----------------------------->
/*
      ACTIVITY LOG RECORD FORMAT
      await saveActivityLog("Update", `Added ${cropStock} ${unit} of stock for ${cropTypeName} by ${userType}`);
      await saveActivityLog("Delete", `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`);
      await saveActivityLog("Create", `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`);
*/
async function saveActivityLog(action, description) {
  // Define allowed actions
  const allowedActions = ["Create", "Update", "Delete"];
  
  // Validate action
  if (!allowedActions.includes(action)) {
    console.error("Invalid action. Allowed actions are: create, update, delete.");
    return;
  }

  // Ensure description is provided
  if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
  }

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
        await addDoc(activityLogCollection, {
          activity_log_id: newCounter, // Use counter instead of a placeholder
          username: userName,
          user_type: userType,
          activity: action,
          activity_desc: description, // Add descriptive message
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

// <-----------------------ACTIVITY LOG CODE----------------------------->


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

        // Fetch related stock data from tb_equipment_stock based on equipment_category_id
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
              // Check if any stock has `current_stock` equal to 0
              userStockData.forEach(stock => {
                if (stock.current_stock === 0) {
                  stock.current_stock = `No available stock for ${userType}`;
                  stock.unit = ""; // Clear the unit if stock is 0
                }
              });

              equipment.stocks = userStockData;  // Save user-specific stock data as an array
            } else {
              // Stocks exist but not for the current user_type
              equipment.stocks = [{
                stock_date: null,
                current_stock: `Stock has not been updated yet for ${userType}`,
                unit: "",
                owned_by: `No stock record found for ${userType}`
              }];
            }
          } else {
            // `stocks` array is empty for all users
            equipment.stocks = [{
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          // No stock data found at all
          equipment.stocks = [{
            stock_date: null,
            current_stock: "Stock has not been updated yet",
            unit: "",
            owned_by: "No stock record found for any user type"
          }];
        }
        return equipment;
      }));

      equipmentsList = equipmentsData;
      filteredEquipments = [...equipmentsList];
      sortEquipmentsById();            // Sort Equipments by date (latest to oldest)
      displayEquipments(filteredEquipments); // Update table display
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
      const unit = stock.unit || "";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
      <td>${equipmentId}</td>
      <td>${equipmentName}</td>
      <td>${equipmentCategory}</td>
      <td>${stock_date}</td>
      <td>${currentStock} ${unit}</td>
      <td>${owned_by}</td>
      <td class="equip-action-btn">
        <button class="add-equip-stock-btn" data-id="${equipmentId}">+ Add Stock</button>
        <button class="delete-equip-stock-btn" data-id="${equipmentId}">Delete Stock</button>
      </td>
  `;

    tableBody.appendChild(row);
  });

});
  updatePagination();
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

// Initialize filtered list with the full equipment list
let currentFilteredList = [...equipmentsList];

// Combined filter function
function applyFilters() {
  const selectedEquipment = document.querySelector(".equipment_select").value.toLowerCase().trim();
  const searchQuery = document.getElementById("equip-search-bar").value.toLowerCase().trim();

  // Start with the full list as the base
  let filteredList = [...equipmentsList];

  // Apply dropdown filter if a selection is made
  if (selectedEquipment) {
    filteredList = filteredList.filter(equipment =>
      equipment.equipment_type_name?.toLowerCase() === selectedEquipment ||
      equipment.equipment_category?.toLowerCase() === selectedEquipment
    );
  }

  // Apply search filter on the dropdown-filtered list
  if (searchQuery) {
    filteredList = filteredList.filter(equipment =>
      equipment.equipment_name?.toLowerCase().includes(searchQuery) ||
      equipment.equipment_category?.toLowerCase().includes(searchQuery) ||
      equipment.equipment_category_id?.toString().includes(searchQuery)
    );
  }

  // Update the displayed list
  currentFilteredList = filteredList;
  currentPage = 1;  // Reset pagination
  sortEquipmentsById();
  displayEquipments(currentFilteredList);
}

// Event listeners
document.querySelector(".equipment_select").addEventListener("change", () => {
  applyFilters();
});

document.getElementById("equip-search-bar").addEventListener("input", () => {
  applyFilters();
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
const saveBtn = document.getElementById("equip-save-stock");
const equipmentStockPanel = document.getElementById("equip-stock-panel");
const equipmentOverlay = document.getElementById("equip-overlay");
const cancelBtn = document.getElementById("equip-cancel-stock");
const equipmentStockTitle = document.getElementById("equip-stock-title")
;
const deleteStockTitle = document.getElementById("equip-delete-stock-title");
const deleteStockBtn = document.getElementById("equip-delete-stock");
function addEquipStock() {
  document.querySelector(".equipment_table").addEventListener("click", async function (event) {
      if (event.target.classList.contains("add-equip-stock-btn") || event.target.classList.contains("delete-equip-stock-btn")) {
          const equipmentId = event.target.dataset.id; 
          const isDelete = event.target.classList.contains("delete-equip-stock-btn");

          try {
              const user = await getAuthenticatedUser();
              if (!user || !user.user_type) {
                  console.error("No authenticated user or user type found.");
                  return;
              }

              const userType = user.user_type.trim();

              let equipmentCategory = "No category was recorded";
              let equipmentName = "No name was recorded";
              let equipmentUnit = ""; 
              let currentStock = "No stock recorded"; 
              let stockUnit = ""; 

              const equipmentsCollection = collection(db, "tb_equipment");
              const equipmentQuery = query(equipmentsCollection, where("equipment_id", "==", Number(equipmentId)));
              const equipmentSnapshot = await getDocs(equipmentQuery);

              if (!equipmentSnapshot.empty) {
                  const equipmentData = equipmentSnapshot.docs[0].data();
                  equipmentName = equipmentData.equipment_name?.trim() || "No Equipment Name was recorded";
                  equipmentCategory = equipmentData.equipment_category?.trim() || "No Equipment Category was recorded";
                  equipmentUnit = equipmentData.unit?.trim() || "";
              }

              const stockCollection = collection(db, "tb_equipment_stock");
              const stockQuery = query(stockCollection, where("equipment_id", "==", Number(equipmentId)));
              const stockSnapshot = await getDocs(stockQuery);

              if (!stockSnapshot.empty) {
                  const stockData = stockSnapshot.docs[0].data();

                  if (stockData.stocks && Array.isArray(stockData.stocks)) {
                      const matchingStock = stockData.stocks.find(stock => stock.owned_by === userType);

                      if (matchingStock) {
                          currentStock = matchingStock.current_stock || "No stock recorded";
                          stockUnit = matchingStock.unit?.trim() || "";
                      }
                  }
              }

              document.getElementById("equip_name").value = equipmentName;
              document.getElementById("equip_type").value = equipmentCategory;
              document.getElementById("equip_unit_hidden").value = equipmentUnit;
              document.getElementById("current_equip_stock").value = currentStock + (stockUnit ? ` ${stockUnit}` : "");

              equipmentStockPanel.style.display = "block";
              equipmentOverlay.style.display = "block";

              saveBtn.dataset.equipmentId = equipmentId;
              deleteStockBtn.dataset.equipmentId = equipmentId;

              // Toggle between add and delete mode
              if (isDelete) {
                  equipmentStockTitle.style.display = "none";
                  deleteStockTitle.style.display = "block";
                  saveBtn.style.display = "none";
                  deleteStockBtn.style.display = "block";
              } else {
                  equipmentStockTitle.style.display = "block";
                  deleteStockTitle.style.display = "none";
                  saveBtn.style.display = "block";
                  deleteStockBtn.style.display = "none";
              }

          } catch (error) {
              console.error("Error fetching equipment details:", error);
          }
      }
  });

  // Close panel events
  cancelBtn.addEventListener("click", closeStockPanel);
  equipmentOverlay.addEventListener("click", closeStockPanel);

  // Flag to prevent multiple clicks
  let isSaving = false;
  let isDeleting = false;

  // Button event listeners
  saveBtn.addEventListener("click", async () => {
      if (isSaving) return;  // Prevent multiple clicks
      isSaving = true;
      saveBtn.disabled = true; // Disable button

      try {
          await saveStock(); // Call save function
      } catch (error) {
          console.error("Error saving stock:", error);
      } finally {
          isSaving = false;
          saveBtn.disabled = false; // Re-enable button
      }
  });

  deleteStockBtn.addEventListener("click", async () => {
      if (isDeleting) return;  // Prevent multiple clicks
      isDeleting = true;
      deleteStockBtn.disabled = true; // Disable button

      try {
          await deleteStock(); // Call delete function
      } catch (error) {
          console.error("Error deleting stock:", error);
      } finally {
          isDeleting = false;
          deleteStockBtn.disabled = false; // Re-enable button
      }
  });
}

function closeStockPanel() {
  equipmentStockPanel.style.display = "none";
  equipmentOverlay.style.display = "none";
  document.getElementById("equip_type").value = "";
  document.getElementById("equip_name").value = "";
  document.getElementById("equip_stock").value = "";
  document.getElementById("equip_unit_hidden").value = "";
  fetchEquipments();
}

async function saveStock() {
  const equipmentId = Number(saveBtn.dataset.equipmentId); // Ensure it's a number
  const equipmentCategory = document.getElementById("equip_type").value.trim();
  const equipmentName = document.getElementById("equip_name").value.trim();
  const equipmentStock = Number(document.getElementById("equip_stock").value);
  let unit = document.getElementById("equip_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "";
  }

  if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
      showEquipmentStockMessage("Please enter a valid Equipment stock quantity.", false);
      return;
  }

  try {
      // ✅ Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showEquipmentStockMessage("User not authenticated.", false);
          return;
      }

      // ✅ Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showEquipmentStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // ✅ Fetch stock from tb_equipment_stock by equipment_category_id
      const inventoryCollection = collection(db, "tb_equipment_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("equipment_id", "==", equipmentId)
      );
      const inventorySnapshot = await getDocs(inventoryQuery);

      if (!inventorySnapshot.empty) {
          // ✅ Existing document found, update stock
          const inventoryDocRef = inventorySnapshot.docs[0].ref;
          const inventoryData = inventorySnapshot.docs[0].data();
          const stocks = inventoryData.stocks || [];

          // ✅ Check if the userType already exists in the stocks array
          const userStockIndex = stocks.findIndex(stock => stock.owned_by === userType);

          if (userStockIndex !== -1) {
              // Update existing stock for this user_type
              stocks[userStockIndex].current_stock += equipmentStock;
              stocks[userStockIndex].stock_date = Timestamp.now();
              stocks[userStockIndex].unit = unit;
          } else {
              // Add a new stock entry for this user_type
              stocks.push({
                  owned_by: userType,
                  current_stock: equipmentStock,
                  stock_date: Timestamp.now(),
                  unit: unit
              });
          }

          // ✅ Update the document with the modified stocks array
          await updateDoc(inventoryDocRef, { 
              stocks: stocks,
              equipment_type: equipmentCategory // Ensure equipment_category is saved
          });

      } else {
          // ✅ Create a new document if it doesn't exist
          await addDoc(inventoryCollection, {
              equipment_id: equipmentId,
              equipment_name: equipmentName,
              equipment_type: equipmentCategory,
              stocks: [
                  {
                      owned_by: userType,
                      current_stock: equipmentStock,
                      stock_date: Timestamp.now(),
                      unit: unit
                  }
              ]
          });
      }

      // ✅ Save activity log
      await saveActivityLog("Update", `Added ${equipmentStock} ${unit} of stock for ${equipmentName} by ${userType}`);

      showEquipmentStockMessage("Equipment Stock has been added successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error saving Equipment stock:", error);
      showEquipmentStockMessage("An error occurred while saving Equipment stock.", false);
  }
}

async function deleteStock() {
  const equipmentId = Number(deleteStockBtn.dataset.equipmentId); // Ensure it's a number
  const equipmentCategory = document.getElementById("equip_type").value.trim();
  const equipmentName = document.getElementById("equip_name").value.trim();
  const equipmentStock = Number(document.getElementById("equip_stock").value);
  let unit = document.getElementById("equip_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "";
  }

  if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
      showEquipmentStockMessage("Please enter a valid Equipment stock quantity.", false);
      return;
  }

  try {
      // Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showEquipmentStockMessage("User not authenticated.", false);
          return;
      }

      // Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showEquipmentStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // Fetch stock from tb_equipment_stock by equipment_id
      const inventoryCollection = collection(db, "tb_equipment_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("equipment_id", "==", equipmentId)
      );
      const inventorySnapshot = await getDocs(inventoryQuery);

      if (inventorySnapshot.empty) {
          showEquipmentStockMessage("No stock record found to delete.", false);
          return;
      }

      // Extract the stocks array from the matching document
      const inventoryDocRef = inventorySnapshot.docs[0].ref;
      const inventoryData = inventorySnapshot.docs[0].data();
      let stocks = inventoryData.stocks || [];

      // Find the matching map with the authenticated user's user_type
      const userStockIndex = stocks.findIndex(stock => stock.owned_by === userType);

      if (userStockIndex === -1) {
          showEquipmentStockMessage("No stock entry found for this user type.", false);
          return;
      }

      // Retrieve the current_stock for this user
      const existingStock = stocks[userStockIndex].current_stock || 0;
      const newStock = existingStock - equipmentStock;

      if (newStock < 0) {
          showEquipmentStockMessage("Not enough stock available", false);
          return;
      }

      if (newStock === 0) {
          // If the current_stock reaches 0, remove the entire map
          stocks.splice(userStockIndex, 1);
      } else {
          // Otherwise, update the stock values
          stocks[userStockIndex].current_stock = newStock;
          stocks[userStockIndex].stock_date = Timestamp.now();
          stocks[userStockIndex].unit = unit;
      }

      // Save the updated document
      await updateDoc(inventoryDocRef, {
          stocks: stocks,
          equipment_type: equipmentCategory // Ensure equipment_type is saved
      });

      await saveActivityLog("Delete", `Deleted ${equipmentStock} ${unit} of stock for ${equipmentName} from ${userType} Inventory`);

      showEquipmentStockMessage("Equipment Stock has been deleted successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error deleting Equipment stock:", error);
      showEquipmentStockMessage("An error occurred while deleting Equipment stock.", false);
  }
}
