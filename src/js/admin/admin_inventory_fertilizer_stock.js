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
});

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
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        reject("User not authenticated. Please log in.");
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

    // Get user_name from the fetched user document
    const userName = userSnapshot.docs[0].data().user_name;

    const fertilizersCollection = collection(db, "tb_fertilizer");
    const fertilizersQuery = query(fertilizersCollection);

    // Listen for real-time updates
    onSnapshot(fertilizersQuery, async (snapshot) => {
      const fertilizersData = await Promise.all(snapshot.docs.map(async (doc) => {
        const fertilizer = doc.data();
        const fertilizerId = fertilizer.fertilizer_id;

        // Fetch related stock data from tb_fertilizer_stock based on fertilizer_id
        const stockCollection = collection(db, "tb_fertilizer_stock");
        const stockQuery = query(stockCollection, where("fertilizer_id", "==", fertilizerId));
        const stockSnapshot = await getDocs(stockQuery);

        // Initialize stock array for this fertilizer
        fertilizer.stocks = [];

        if (!stockSnapshot.empty) {
          // Extract stock data as arrays
          const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
            const stockData = stockDoc.data();
            return stockData.stocks || []; // Access the nested stocks array if available
          });

          // Filter stock data for the authenticated user
          const userStockData = stockDataArray.filter(stock => stock.owned_by === userName);

          if (userStockData.length > 0) {
            fertilizer.stocks = userStockData;  // Save user-specific stock data as an array
          } else {
            // No stock for the authenticated user
            fertilizer.stocks = [{
              stock_date: null,
              current_stock: "",
              unit: "Stock has not been updated yet",
              owned_by: "No stock record found for the current user"
            }];
          }
        } else {
          // No stock data found at all
          fertilizer.stocks = [{
            stock_date: null,
            current_stock: "",
            unit: "Stock has not been updated yet",
            owned_by: "No stock record found for any user"
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
    const fertilizerType = fertilizer.fertilizer_type_name || "Fertilizer Category not recorded.";

    // Iterate through stocks array
    fertilizer.stocks.forEach((stock) => {
      const stock_date = stock.stock_date
        ? (stock.stock_date.toDate ? stock.stock_date.toDate().toLocaleDateString() : new Date(stock.stock_date).toLocaleDateString())
        : "Stock has not been updated";
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "Units";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-fertilizer-id="${fertilizerId}">
        </td>
        <td>${fertilizerId}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizerType}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td>
          <button class="add-fert-stock-btn" id="add-fert-stock-btn" data-id="${fertilizerId}">+ Add Stock</button>
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
const deletemessage = document.getElementById("fert-bulk-message"); // delete message panel

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target;
  const row = checkbox.closest("tr");
  if (!row) return;

  const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

  if (checkbox.checked) {
    if (!selectedFertilizers.includes(fertilizerId)) {
      selectedFertilizers.push(fertilizerId);
    }
  } else {
    selectedFertilizers = selectedFertilizers.filter(item => item !== fertilizerId);
  }

  console.log("Selected Fertilizers:", selectedFertilizers);
  toggleBulkDeleteButton();
}

// Enable/Disable the Bulk Delete button
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("fert-bulk-delete");
  bulkDeleteButton.disabled = selectedFertilizers.length === 0;
}

// Attach event listener to checkboxes
function addCheckboxListeners() {
  document.querySelectorAll(".fertilizer_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}

// <------------- BULK DELETE BUTTON CODE ---------------> //
document.getElementById("fert-bulk-delete").addEventListener("click", async () => {
  const selectedCheckboxes = document.querySelectorAll(".fertilizer_table input[type='checkbox']:checked");

  let selectedfertilizerIds = [];
  let hasInvalidId = false;

  for (const checkbox of selectedCheckboxes) {
    const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

    if (!fertilizerId || fertilizerId.trim() === "") {
      hasInvalidId = true;
      break;
    }

    try {
      const q = query(collection(db, "tb_fertilizer_stock"), where("fertilizer_id", "==", Number(fertilizerId)));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        hasInvalidId = true;
        console.error(`ERROR: Fertilizer ID ${fertilizerId} does not exist in the database.`);
        break;
      }

      selectedfertilizerIds.push(fertilizerId);
    } catch (error) {
      console.error("Error fetching Fertilizer records:", error);
      hasInvalidId = true;
      break;
    }
  }

  if (hasInvalidId) {
    showDeleteMessage("ERROR: Fertilizer ID of one or more selected records are invalid", false);
  } else {
    document.getElementById("fert-bulk-panel").style.display = "block";
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-fert-delete").addEventListener("click", () => {
  document.getElementById("fert-bulk-panel").style.display = "none";
});

// Function to delete selected Fertilizers from tb_Fertilizer_stock's stocks array based on owned_by
async function deleteSelectedFertilizers() {
  if (selectedFertilizers.length === 0) {
    return;
  }

  try {
    // Get the current authenticated user's user_name
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "tb_users", user.uid));
    const userName = userDoc.data().user_name;

    const stockCollection = collection(db, "tb_fertilizer_stock");
    let deletedFertilizerNames = [];

    for (const fertilizerId of selectedFertilizers) {
      const stockQuery = query(stockCollection, where("fertilizer_id", "==", Number(fertilizerId)));
      const stockSnapshot = await getDocs(stockQuery);

      for (const docSnapshot of stockSnapshot.docs) {
        const stockData = docSnapshot.data();
        const docRef = doc(db, "tb_fertilizer_stock", docSnapshot.id);

        // Filter stocks to get only those matching the user_name
        const stocksToRemove = stockData.stocks.filter(stock => stock.owned_by === userName);

        if (stocksToRemove.length > 0) {
          for (const stock of stocksToRemove) {
            await updateDoc(docRef, {
              stocks: arrayRemove(stock)
            });
            deletedFertilizerNames.push(stock.fertilizer_name);
          }
        }
      }
    }

    console.log("Deleted Fertilizers:", deletedFertilizerNames);
    await saveActivityLog(`Deleted Fertilizers: ${deletedFertilizerNames.join(", ")}`);
    showDeleteMessage("All selected Fertilizer records successfully deleted!", true);

    selectedFertilizers = [];
    document.getElementById("fert-bulk-panel").style.display = "none";
    fetchFertilizers();

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
      fertilizer.fertilizer_type_name?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_id?.toString().includes(searchQuery) // Ensure ID is searchable
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

// <--------------------------------> FUNCTION TO SAVE <-------------------------------->
  saveBtn.addEventListener("click", async function () {
    const fertilizerId = saveBtn.dataset.fertilizerId;
    const fertilizerTypeName = document.getElementById("fert_category").value;  // Still needed for activity log
    const fertilizerName = document.getElementById("fert_name").value;           // Still needed for activity log
    const fertilizerStock = document.getElementById("fert_stock").value;
    let unit = document.getElementById("fert_unit").value;

    if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
    }

    if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
      showFertilizerStockMessage("Please enter a valid Fertilizer stock quantity.", false);
      return;
    }

    try {
      // Get the authenticated user
      const user = await getAuthenticatedUser().catch((error) => {
        showFertilizerStockMessage(error, false);
        throw new Error(error);
      });

      // Fetch user_name from tb_users based on the authenticated email
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showFertilizerStockMessage("User not found in the database.", false);
        return;
      }

      // Get user_name from the fetched user document
      const userName = userSnapshot.docs[0].data().user_name;

      // Fetch Fertilizer data from tb_Fertilizer
      const fertilizersCollection = collection(db, "tb_fertilizer");
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerId)));
      const querySnapshot = await getDocs(fertilizerQuery);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingStock = querySnapshot.docs[0].data().current_stock || 0;
        const newStock = existingStock + Number(fertilizerStock);

        // Update stock in tb_fertilizer_types
        await updateDoc(docRef, {
          stock_date: Timestamp.now(),
          current_stock: newStock,
          unit: unit
        });

        // Check if record already exists in tb_fertilizer_stock for the same fertilizer_type_id
        const inventoryCollection = collection(db, "tb_fertilizer_stock");
        const inventoryQuery = query(inventoryCollection, where("fertilizer_id", "==", Number(fertilizerId)));
        const inventorySnapshot = await getDocs(inventoryQuery);

        if (!inventorySnapshot.empty) {
          // Record exists, update the stocks array
          const inventoryDocRef = inventorySnapshot.docs[0].ref;
          const inventoryData = inventorySnapshot.docs[0].data();
          const stocks = inventoryData.stocks || [];

          // Check if owned_by already exists in the stocks array
          const userStockIndex = stocks.findIndex(stock => stock.owned_by === userName);

          if (userStockIndex !== -1) {
            // Update existing stock for this user
            stocks[userStockIndex].current_stock += Number(fertilizerStock);
            stocks[userStockIndex].stock_date = Timestamp.now();
            stocks[userStockIndex].unit = unit;
          } else {
            // Add a new stock entry for this user
            stocks.push({
              owned_by: userName,
              current_stock: Number(fertilizerStock),
              stock_date: Timestamp.now(),
              unit: unit
            });
          }

          // Update the document with the modified stocks array
          await updateDoc(inventoryDocRef, { stocks: stocks });
        } else {
          // Record does not exist, create a new document with stocks array
          await addDoc(inventoryCollection, {
            fertilizer_id: Number(fertilizerId),
            stocks: [
              {
                owned_by: userName,
                current_stock: Number(fertilizerStock),
                stock_date: Timestamp.now(),
                unit: unit
              }
            ]
          });
        }

        await saveActivityLog(`Added Fertilizer Stock for ${fertilizerTypeName} with quantity of ${fertilizerStock}`);
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