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

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchFertilizers();
  addFertStock();
});

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

let fertilizersList = []; // Declare fertilizersList globally for filtering
let filteredFertilizers = fertilizersList; // Declare a variable for filtered fertilizers
let currentPage = 1;
const rowsPerPage = 5;
let selectedFertilizers = [];

function sortFertilizersById() {
  filteredFertilizers.sort((a, b) => {
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      // Both have dates, sort by date (latest to oldest)
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      // Neither has dates, sort by fertilizer_id (low to high)
      return a.fertilizer_id - b.fertilizer_id;
    } else {
      // One has a date, prioritize those with dates first
      return hasDateB - hasDateA;
    }
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0); // Default to epoch if no date
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  
  return new Date(dateValue); // Convert string/ISO formats to Date
}

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
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

async function fetchFertilizers() {
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

    const fertilizersCollection = collection(db, "tb_fertilizer");
    const fertilizersQuery = query(fertilizersCollection);

    // Listen for real-time updates
    onSnapshot(fertilizersQuery, async (snapshot) => {
      const fertilizersData = await Promise.all(snapshot.docs.map(async (doc) => {
        const fertilizer = doc.data();
        const fertilizerId = fertilizer.fertilizer_id;

        // Fetch related stock data from tb_fertilizer_stock based on fertilizer_type_id
        const stockCollection = collection(db, "tb_fertilizer_stock");
        const stockQuery = query(stockCollection, where("fertilizer_id", "==", fertilizerId));
        const stockSnapshot = await getDocs(stockQuery);

        // Initialize stock array for this fertilizer
        fertilizer.stocks = [];

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

              fertilizer.stocks = userStockData;  // Save user-specific stock data as an array
            } else {
              // Stocks exist but not for the current user_type
              fertilizer.stocks = [{
                stock_date: null,
                current_stock: `Stock has not been updated yet for ${userType}`,
                unit: "",
                owned_by: `No stock record found for ${userType}`
              }];
            }
          } else {
            // `stocks` array is empty for all users
            fertilizer.stocks = [{
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          // No stock data found at all
          fertilizer.stocks = [{
            stock_date: null,
            current_stock: "Stock has not been updated yet",
            unit: "",
            owned_by: "No stock record found for any user type"
          }];
        }
        return fertilizer;
      }));

      fertilizersList = fertilizersData;
      filteredFertilizers = [...fertilizersList];
      sortFertilizersById();            // Sort Fertilizers by date (latest to oldest)
      displayFertilizers(filteredFertilizers); // Update table display
    }, (error) => {
      console.error("Error listening to Fertilizers:", error);
    });
  } catch (error) {
    console.error("Error fetching Fertilizers:", error);
  }
}

// Display Fertilizers in the table
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
    // Show "No records found" if FertilizersList is empty
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

  // Render Fertilizers list in the table
  paginatedFertilizers.forEach((fertilizer) => {
    const row = document.createElement("tr");
    const fertilizerId = fertilizer.fertilizer_id || "Fertilizer Id not recorded";
    const fertilizerName = fertilizer.fertilizer_name || "Fertilizer Name not recorded";
    const fertilizerType = fertilizer.fertilizer_type || "Fertilizer Category not recorded.";

    // Iterate through stocks array
    fertilizer.stocks.forEach((stock) => {
      const stock_date = stock.stock_date
        ? (stock.stock_date.toDate ? stock.stock_date.toDate().toLocaleDateString() : new Date(stock.stock_date).toLocaleDateString())
        : "Stock has not been updated";
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
        <td>${fertilizerId}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizerType}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td class="fert-action-btn">
          <button class="add-fert-stock-btn" data-id="${fertilizerId}">
            <img src="../../../public/images/Plus.png" alt="Action Icon" class="action-icon-add">
            <span>Add Stock</span>
          </button>
          <button class="delete-fert-stock-btn" data-id="${fertilizerId}">
            <img src="../../../public/images/Ekis.png" alt="Action Icon" class="action-icon-remove">
            <span>Delete Stock</span>
            </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  });
  updatePagination();
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
    ? fertilizersList.filter(fertilizer => fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer)
    : fertilizersList; // If no selection, show all fertilizers

  currentPage = 1; // Reset to the first page when filter is applied
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered fertilizers
});


// <------------------- PAGINATION ---------------------->
document.getElementById("fert-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();

  // Filter Fertilizers based on searchQuery, excluding stock and date fields
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    return (
      fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_type?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered Fertilizers
});
// <------------------ FUNCTION TO DISPLAY FERTILIZER STOCK MESSAGE ------------------------>
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
const saveBtn = document.getElementById("fert-save-stock");
const fertilizerStockPanel = document.getElementById("fert-stock-panel");
const fertilizerOverlay = document.getElementById("fert-overlay");
const cancelBtn = document.getElementById("fert-cancel-stock");
const fertilizerStockTitle = document.getElementById("fert-stock-title");
const deleteStockTitle = document.getElementById("fert-delete-stock-title");
const deleteStockBtn = document.getElementById("fert-delete-stock");

// Initialize the panel as hidden
fertilizerStockPanel.style.display = "none";
fertilizerOverlay.style.display = "none";

function addFertStock() {
    document.querySelector(".fertilizer_table").addEventListener("click", async function (event) {
        if (event.target.classList.contains("add-fert-stock-btn") || event.target.classList.contains("delete-fert-stock-btn") ||
            event.target.closest('.add-fert-stock-btn') || event.target.closest('.delete-fert-stock-btn')) {
            event.preventDefault(); // Prevent any default behavior
            
            // Get the button element (whether clicked directly or via child element)
            const button = event.target.closest('.add-fert-stock-btn') || event.target.closest('.delete-fert-stock-btn');
            const fertilizerId = button.dataset.id;
            const isDelete = button.classList.contains("delete-fert-stock-btn");

            try {
                const user = await getAuthenticatedUser();
                if (!user || !user.user_type) {
                    console.error("No authenticated user or user type found.");
                    return;
                }

                const userType = user.user_type.trim();

                // Find the row in the table corresponding to this fertilizerId
                const tableRows = document.querySelectorAll(".fertilizer_table table tbody tr");
                let rowData = null;
                
                tableRows.forEach(row => {
                    const rowFertId = row.cells[0].textContent.trim();
                    if (rowFertId === fertilizerId) {
                        rowData = row;
                    }
                });

                if (!rowData) {
                    console.error("Fertilizer not found in table");
                    return;
                }

                // Extract data from table row
                const fertilizerName = rowData.cells[1].textContent.trim() || "No name was recorded";
                const fertilizerType = rowData.cells[2].textContent.trim() || "No category was recorded";
                let currentStock = rowData.cells[4].textContent.trim() || "No stock recorded";
                
                // Split stock value and unit if present
                let stockUnit = "";
                const stockParts = currentStock.split(" ");
                if (stockParts.length > 1) {
                    currentStock = stockParts[0];
                    stockUnit = stockParts[1];
                }

                // Get unit from hidden field or table if available
                const fertilizerUnit = document.getElementById("fert_unit_hidden").value || stockUnit || "No unit was recorded";

                // Set form values
                document.getElementById("fert_name").value = fertilizerName;
                document.getElementById("fert_type").value = fertilizerType;
                document.getElementById("fert_unit_hidden").value = fertilizerUnit;
                document.getElementById("current_fert_stock").value = currentStock + (stockUnit ? ` ${stockUnit}` : "");
                document.getElementById("fert_stock").value = ""; // Reset input field

                // Set data attributes
                saveBtn.dataset.fertilizerId = fertilizerId;
                deleteStockBtn.dataset.fertilizerId = fertilizerId;

                // Show the panel and overlay
                fertilizerStockPanel.style.display = "block";
                fertilizerOverlay.style.display = "block";

                // Toggle between add and delete mode
                if (isDelete) {
                    fertilizerStockTitle.style.display = "none";
                    deleteStockTitle.style.display = "block";
                    saveBtn.style.display = "none";
                    deleteStockBtn.style.display = "block";
                } else {
                    fertilizerStockTitle.style.display = "block";
                    deleteStockTitle.style.display = "none";
                    saveBtn.style.display = "block";
                    deleteStockBtn.style.display = "none";
                }

            } catch (error) {
                console.error("Error fetching fertilizer details from table:", error);
            }
        }
    });

    // Close panel events
    cancelBtn.addEventListener("click", closeStockPanel);
    fertilizerOverlay.addEventListener("click", closeStockPanel);

    // Flag to prevent multiple clicks
    let isSaving = false;
    let isDeleting = false;

    // Save button handler
    saveBtn.addEventListener("click", async () => {
        if (isSaving) return;
        isSaving = true;
        saveBtn.disabled = true;

        try {
            await saveStock();
        } catch (error) {
            console.error("Error saving stock:", error);
        } finally {
            isSaving = false;
            saveBtn.disabled = false;
        }
    });

    // Delete button handler
    deleteStockBtn.addEventListener("click", async () => {
        if (isDeleting) return;
        isDeleting = true;
        deleteStockBtn.disabled = true;

        try {
            await deleteStock();
        } catch (error) {
            console.error("Error deleting stock:", error);
        } finally {
            isDeleting = false;
            deleteStockBtn.disabled = false;
        }
    });
}

function closeStockPanel() {
  fertilizerStockPanel.style.display = "none";
  fertilizerOverlay.style.display = "none";
  document.getElementById("fert_type").value = "";
  document.getElementById("fert_name").value = "";
  document.getElementById("fert_stock").value = "";
  document.getElementById("fert_unit_hidden").value = "";
  fetchFertilizers();
}

async function saveStock() {
  const fertilizerId = Number(saveBtn.dataset.fertilizerId); // Ensure it's a number
  const fertilizerType = document.getElementById("fert_type").value.trim();
  const fertilizerName = document.getElementById("fert_name").value.trim();
  const fertilizerStock = Number(document.getElementById("fert_stock").value);
  let unit = document.getElementById("fert_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
  }

  if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
      showFertilizerStockMessage("Please enter a valid Fertilizer stock quantity.", false);
      return;
  }

  try {
      // ✅ Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showFertilizerStockMessage("User not authenticated.", false);
          return;
      }

      // ✅ Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showFertilizerStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // ✅ Fetch stock from tb_Fertilizer_stock by Fertilizer_type_id
      const inventoryCollection = collection(db, "tb_fertilizer_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("fertilizer_id", "==", fertilizerId)
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
              stocks[userStockIndex].current_stock += fertilizerStock;
              stocks[userStockIndex].stock_date = Timestamp.now();
              stocks[userStockIndex].unit = unit;
          } else {
              // Add a new stock entry for this user_type
              stocks.push({
                  owned_by: userType,
                  current_stock: fertilizerStock,
                  stock_date: Timestamp.now(),
                  unit: unit
              });
          }

          // ✅ Update the document with the modified stocks array
          await updateDoc(inventoryDocRef, { 
              stocks: stocks,
              fertilizer_type: fertilizerType // Ensure fertilizer_type is saved
          });

      } else {
          // ✅ Create a new document if it doesn't exist
          await addDoc(inventoryCollection, {
              fertilizer_id: fertilizerId,
              fertilizer_name: fertilizerName,
              fertilizer_type: fertilizerType,
              stocks: [
                  {
                      owned_by: userType,
                      current_stock: fertilizerStock,
                      stock_date: Timestamp.now(),
                      unit: unit
                  }
              ]
          });
      }

      // ✅ Save activity log
      await saveActivityLog("Update", `Added ${fertilizerStock} ${unit} of stock for ${fertilizerName} by ${userType}`);

      showFertilizerStockMessage("Fertilizer Stock has been added successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error saving Fertilizer stock:", error);
      showFertilizerStockMessage("An error occurred while saving Fertilizer stock.", false);
  }
}

async function deleteStock() {
  const fertilizerId = Number(deleteStockBtn.dataset.fertilizerId); // Ensure it's a number
  const fertilizerType = document.getElementById("fert_type").value.trim();
  const fertilizerName = document.getElementById("fert_name").value.trim();
  const fertilizerStock = Number(document.getElementById("fert_stock").value);
  let unit = document.getElementById("fert_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
  }

  if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
      showFertilizerStockMessage("Please enter a valid Fertilizer stock quantity.", false);
      return;
  }

  try {
      // Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showFertilizerStockMessage("User not authenticated.", false);
          return;
      }

      // Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showFertilizerStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // Fetch stock from tb_fertilizer_stock by fertilizer_id
      const inventoryCollection = collection(db, "tb_fertilizer_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("fertilizer_id", "==", fertilizerId)
      );
      const inventorySnapshot = await getDocs(inventoryQuery);

      if (inventorySnapshot.empty) {
          showFertilizerStockMessage("No stock record found to delete.", false);
          return;
      }

      // Extract the stocks array from the matching document
      const inventoryDocRef = inventorySnapshot.docs[0].ref;
      const inventoryData = inventorySnapshot.docs[0].data();
      let stocks = inventoryData.stocks || [];

      // Find the matching map with the authenticated user's user_type
      const userStockIndex = stocks.findIndex(stock => stock.owned_by === userType);

      if (userStockIndex === -1) {
          showFertilizerStockMessage("No stock entry found for this user type.", false);
          return;
      }

      // Retrieve the current_stock for this user
      const existingStock = stocks[userStockIndex].current_stock || 0;
      const newStock = existingStock - fertilizerStock;

      if (newStock < 0) {
          showFertilizerStockMessage("Not enough stock available", false);
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
          fertilizer_type: fertilizerType // Ensure fertilizer_type is saved
      });

      await saveActivityLog("Delete", `Deleted ${fertilizerStock} ${unit} of stock for ${fertilizerName} from ${userType} Inventory`);

      showFertilizerStockMessage("Fertilizer Stock has been deleted successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error deleting Fertilizer stock:", error);
      showFertilizerStockMessage("An error occurred while deleting Fertilizer stock.", false);
  }
}
