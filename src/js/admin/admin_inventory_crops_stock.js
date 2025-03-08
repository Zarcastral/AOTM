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
  fetchCropNames();
  fetchCrops();
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

let cropsList = []; // Declare cropsList globally for filtering
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = []; // Initialize filteredCrops with an empty array
let selectedCrops = [];
// USE THIS TO SORT FOR CROP ID ASCENDING ORDER
/*function sortCropsById() {
  filteredCrops.sort((a, b) => Number(a.crop_type_id || 0) - Number(b.crop_type_id || 0));
}*/

// DIS ONE IS FOR DATES FROM LATEST TO OLDEST
// Function to sort crops by stock_date from latest to oldest
function sortCropsById() {
  filteredCrops.sort((a, b) => {
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      // Both have dates, sort by date (latest to oldest)
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      // Neither has dates, sort by crop_type_id (low to high)
      return a.crop_type_id - b.crop_type_id;
    } else {
      // One has a date, prioritize those with dates first
      return hasDateB - hasDateA;
    }
  });
}


// Function to convert Firestore Timestamp or date string to JavaScript Date object
function parseDate(dateValue) {
  if (!dateValue) return new Date(0); // Default to epoch if no date

  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate(); // Convert Firestore Timestamp to Date
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

// Fetch crops data from Firestore
async function fetchCrops() {
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

    const cropsCollection = collection(db, "tb_crop_types");
    const cropsQuery = query(cropsCollection);

    // Listen for real-time updates
    onSnapshot(cropsQuery, async (snapshot) => {
      const cropsData = await Promise.all(snapshot.docs.map(async (doc) => {
        const crop = doc.data();
        const cropTypeId = crop.crop_type_id;

        // Fetch related stock data from tb_crop_stock based on crop_type_id
        const stockCollection = collection(db, "tb_crop_stock");
        const stockQuery = query(stockCollection, where("crop_type_id", "==", cropTypeId));
        const stockSnapshot = await getDocs(stockQuery);

        // Initialize stock array for this crop
        crop.stocks = [];

        if (!stockSnapshot.empty) {
          // Extract stock data as arrays
          const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
            const stockData = stockDoc.data();
            return stockData.stocks || []; // Access the nested stocks array if available
          });

          // Filter stock data for the authenticated user
          const userStockData = stockDataArray.filter(stock => stock.owned_by === userName);

          if (userStockData.length > 0) {
            crop.stocks = userStockData;  // Save user-specific stock data as an array
          } else {
            // No stock for the authenticated user
            crop.stocks = [{
              stock_date: null,
              current_stock: "",
              unit: "Stock has not been updated yet",
              owned_by: "No stock record found for the current user"
            }];
          }
        } else {
          // No stock data found at all
          crop.stocks = [{
            stock_date: null,
            current_stock: "",
            unit: "Stock has not been updated yet",
            owned_by: "No stock record found for any user"
          }];
        }

        return crop;
      }));

      cropsList = cropsData;
      filteredCrops = [...cropsList];
      sortCropsById();            // Sort crops by date (latest to oldest)
      displayCrops(filteredCrops); // Update table display
    }, (error) => {
      console.error("Error listening to crops:", error);
    });
  } catch (error) {
    console.error("Error fetching crops:", error);
  }
}


// Display crops in the table
function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = ""; // Clear existing rows
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCrops = cropsList.slice(startIndex, endIndex);

  if (paginatedCrops.length === 0) {
    // Show "No records found" if CropsList is empty
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

  // Render crops list in the table
  paginatedCrops.forEach((crop) => {
    const row = document.createElement("tr");
    const cropTypeId = crop.crop_type_id || "Crop Type Id not recorded";
    const cropName = crop.crop_name || "Crop Name not recorded";
    const cropType = crop.crop_type_name || "Crop Category not recorded.";

    // Iterate through stocks array
    crop.stocks.forEach((stock) => {
      const stock_date = stock.stock_date
        ? (stock.stock_date.toDate ? stock.stock_date.toDate().toLocaleDateString() : new Date(stock.stock_date).toLocaleDateString())
        : "Stock has not been updated";
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "Units";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-crop-id="${cropTypeId}">
        </td>
        <td>${cropTypeId}</td>
        <td>${cropType}</td>
        <td>${cropName}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td>
          <button class="add-crop-stock-btn" id="add-crop-stock-btn" data-id="${cropTypeId}">+ Add Stock</button>
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
  const totalPages = Math.ceil(filteredCrops.length / rowsPerPage) || 1;
  document.getElementById("crop-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("crop-prev-page").disabled = currentPage === 1;
  document.getElementById("crop-next-page").disabled = currentPage >= Math.ceil(filteredCrops.length / rowsPerPage);
}

// Event listener for "Previous" button
document.getElementById("crop-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayCrops(filteredCrops);
  }
});

// Event listener for "Next" button
document.getElementById("crop-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredCrops.length) {
    currentPage++;
    displayCrops(filteredCrops);
  }
});

// Fetch crop names for the dropdown
async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map(doc => doc.data().crop_name);

  populateCropDropdown(cropNames);
}

// Populate the crop dropdown with crop names
function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  cropSelect.innerHTML = firstOption;

  cropNames.forEach(cropName => {
    const option = document.createElement("option");
    option.textContent = cropName;
    cropSelect.appendChild(option);
  });
}
// ---------------------------- PAGINATION CODE ---------------------------- //
// Event listener to filter crops based on dropdown selection
document.querySelector(".crop_select").addEventListener("change", function () {
  const selectedCrop = this.value.toLowerCase();
  // Filter crops based on selected value
  filteredCrops = selectedCrop
    ? cropsList.filter(crop => crop.crop_name?.toLowerCase() === selectedCrop)
    : cropsList; // If no selection, show all crops

  currentPage = 1; // Reset to the first page when filter is applied
  sortCropsById();
  displayCrops(filteredCrops); // Update the table with filtered crops
});




// ---------------------------- CROP BULK DELETE CODES ---------------------------- //
const deletemessage = document.getElementById("crop-bulk-message"); // delete message panel

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target;
  const row = checkbox.closest("tr");
  if (!row) return;

  const cropTypeId = checkbox.getAttribute("data-crop-id");

  if (checkbox.checked) {
    if (!selectedCrops.includes(cropTypeId)) {
      selectedCrops.push(cropTypeId);
    }
  } else {
    selectedCrops = selectedCrops.filter(item => item !== cropTypeId);
  }

  console.log("Selected Crops:", selectedCrops);
  toggleBulkDeleteButton();
}

// Enable/Disable the Bulk Delete button
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("crop-bulk-delete");
  bulkDeleteButton.disabled = selectedCrops.length === 0;
}

// Attach event listener to checkboxes
function addCheckboxListeners() {
  document.querySelectorAll(".crop_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}

// <------------- BULK DELETE BUTTON CODE ---------------> //
document.getElementById("crop-bulk-delete").addEventListener("click", async () => {
  const selectedCheckboxes = document.querySelectorAll(".crop_table input[type='checkbox']:checked");

  let selectedCropTypeIds = [];
  let hasInvalidId = false;

  for (const checkbox of selectedCheckboxes) {
    const cropTypeId = checkbox.getAttribute("data-crop-id");

    if (!cropTypeId || cropTypeId.trim() === "") {
      hasInvalidId = true;
      break;
    }

    try {
      const q = query(collection(db, "tb_crop_stock"), where("crop_type_id", "==", Number(cropTypeId)));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        hasInvalidId = true;
        console.error(`ERROR: Crop ID ${cropTypeId} does not exist in the database.`);
        break;
      }

      selectedCropTypeIds.push(cropTypeId);
    } catch (error) {
      console.error("Error fetching crop records:", error);
      hasInvalidId = true;
      break;
    }
  }

  if (hasInvalidId) {
    showDeleteMessage("ERROR: Crop ID of one or more selected records are invalid", false);
  } else {
    document.getElementById("crop-bulk-panel").style.display = "block";
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-crop-delete").addEventListener("click", () => {
  document.getElementById("crop-bulk-panel").style.display = "none";
});

// Function to delete selected crops from tb_crop_stock's stocks array based on owned_by
async function deleteSelectedCrops() {
  if (selectedCrops.length === 0) {
    return;
  }

  try {
    // Get the current authenticated user's user_name
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "tb_users", user.uid));
    const userName = userDoc.data().user_name;

    const stockCollection = collection(db, "tb_crop_stock");
    let deletedCropNames = [];

    for (const cropTypeId of selectedCrops) {
      const stockQuery = query(stockCollection, where("crop_type_id", "==", Number(cropTypeId)));
      const stockSnapshot = await getDocs(stockQuery);

      for (const docSnapshot of stockSnapshot.docs) {
        const stockData = docSnapshot.data();
        const docRef = doc(db, "tb_crop_stock", docSnapshot.id);

        // Filter stocks to get only those matching the user_name
        const stocksToRemove = stockData.stocks.filter(stock => stock.owned_by === userName);

        if (stocksToRemove.length > 0) {
          for (const stock of stocksToRemove) {
            await updateDoc(docRef, {
              stocks: arrayRemove(stock)
            });
            deletedCropNames.push(stock.crop_name);
          }
        }
      }
    }

    console.log("Deleted Crops:", deletedCropNames);
    await saveActivityLog(`Deleted Crops: ${deletedCropNames.join(", ")}`);
    showDeleteMessage("All selected Crop records successfully deleted!", true);

    selectedCrops = [];
    document.getElementById("crop-bulk-panel").style.display = "none";
    fetchCrops();

  } catch (error) {
    console.error("Error deleting crops:", error);
    showDeleteMessage("Error deleting crops!", false);
  }
}

// Confirm Deletion and Call Delete Function
document.getElementById("confirm-crop-delete").addEventListener("click", () => {
  deleteSelectedCrops();
});

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
const deleteMessage = document.getElementById("crop-bulk-message");

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
document.getElementById("crop-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();

  // Filter crops based on searchQuery, excluding stock and date fields
  filteredCrops = cropsList.filter(crop => {
    return (
      crop.crop_name?.toLowerCase().includes(searchQuery) ||
      crop.crop_type_name?.toLowerCase().includes(searchQuery) ||
      crop.crop_type_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortCropsById();
  displayCrops(filteredCrops); // Update the table with filtered crops
});

// <------------------ FUNCTION TO DISPLAY crop STOCK MESSAGE ------------------------>
const cropStockMessage = document.getElementById("crop-stock-message");

function showCropStockMessage(message, success) {
  cropStockMessage.textContent = message;
  cropStockMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  cropStockMessage.style.opacity = '1';
  cropStockMessage.style.display = 'block';

  setTimeout(() => {
    cropStockMessage.style.opacity = '0';
    setTimeout(() => {
      cropStockMessage.style.display = 'none';
    }, 300);
  }, 4000);
}

// <------------------ FUNCTION TO DISPLAY ADD STOCK FLOATING PANEL ------------------------>

document.addEventListener("DOMContentLoaded", () => {
  const cropStockPanel = document.getElementById("crop-stock-panel");
  const cropOverlay = document.getElementById("crop-overlay");
  const cancelBtn = document.getElementById("crop-cancel-stock");
  const saveBtn = document.getElementById("crop-save-stock");

  document.querySelector(".crop_table").addEventListener("click", async function (event) {
    if (event.target.classList.contains("add-crop-stock-btn")) {
      const row = event.target.closest("tr");
      if (!row) return;

      const cropTypeId = row.children[1].textContent.trim();

      try {
        const cropsCollection = collection(db, "tb_crop_types");
        const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
        const querySnapshot = await getDocs(cropQuery);

        let cropTypeName = "No category was recorded";
        let cropName = "No name was recorded";
        let cropUnit = "No unit was recorded";

        if (!querySnapshot.empty) {
          const cropData = querySnapshot.docs[0].data();

          cropName = cropData.crop_name?.trim() || "No name was recorded";
          cropTypeName = cropData.crop_type_name?.trim() || "No category was recorded";
          cropUnit = cropData.unit?.trim() || "No unit was recorded";

          // Unit Dropdown Validation
          const unitDropdown = document.getElementById("crop_unit");
          unitDropdown.disabled = false; // Temporarily enable

          const unitOptions = Array.from(unitDropdown.options).map(opt => opt.value.toLowerCase());

          if (!cropUnit || cropUnit === "No unit was recorded") {
            // Ensure the dropdown has "Invalid Unit"
            let invalidOption = unitDropdown.querySelector("option[value='Invalid Unit']");
            if (!invalidOption) {
              invalidOption = new Option("Invalid Unit", "Invalid Unit");
              unitDropdown.add(invalidOption);
            }
            unitDropdown.value = "Invalid Unit";
          } else {
            // Check if the unit exists in the dropdown
            if (unitOptions.includes(cropUnit.toLowerCase())) {
              unitDropdown.value = cropUnit;
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
        document.getElementById("crops").value = cropName;
        document.getElementById("crop_name").value = cropTypeName;
        document.getElementById("crop_unit_hidden").value = cropUnit;

        cropStockPanel.style.display = "block";
        cropOverlay.style.display = "block";
        saveBtn.dataset.cropTypeId = cropTypeId;
      } catch (error) {
        console.error("Error fetching crop details:", error);
      }
    }
  });

  function closeStockPanel() {
    cropStockPanel.style.display = "none";
    cropOverlay.style.display = "none";
    document.getElementById("crops").value = "";
    document.getElementById("crop_name").value = "";
    document.getElementById("crop_stock").value = "";
    document.getElementById("crop_unit_hidden").value = "";
    fetchCrops();
  }

  cancelBtn.addEventListener("click", closeStockPanel);
  cropOverlay.addEventListener("click", closeStockPanel); 

// <--------------------------------> FUNCTION TO SAVE <-------------------------------->
  saveBtn.addEventListener("click", async function () {
    const cropTypeId = saveBtn.dataset.cropTypeId;
    const cropTypeName = document.getElementById("crop_name").value;  // Still needed for activity log
    const cropName = document.getElementById("crops").value;           // Still needed for activity log
    const cropStock = document.getElementById("crop_stock").value;
    let unit = document.getElementById("crop_unit").value;

    if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
    }

    if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
      showCropStockMessage("Please enter a valid crop stock quantity.", false);
      return;
    }

    try {
      // Get the authenticated user
      const user = await getAuthenticatedUser().catch((error) => {
        showCropStockMessage(error, false);
        throw new Error(error);
      });

      // Fetch user_name from tb_users based on the authenticated email
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showCropStockMessage("User not found in the database.", false);
        return;
      }

      // Get user_name from the fetched user document
      const userName = userSnapshot.docs[0].data().user_name;

      // Fetch crop data from tb_crop_types
      const cropsCollection = collection(db, "tb_crop_types");
      const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
      const querySnapshot = await getDocs(cropQuery);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingStock = querySnapshot.docs[0].data().current_stock || 0;
        const newStock = existingStock + Number(cropStock);

        // Update stock in tb_crop_types
        await updateDoc(docRef, {
          stock_date: Timestamp.now(),
          current_stock: newStock,
          unit: unit
        });

        // Check if record already exists in tb_crop_stock for the same crop_type_id
        const inventoryCollection = collection(db, "tb_crop_stock");
        const inventoryQuery = query(inventoryCollection, where("crop_type_id", "==", Number(cropTypeId)));
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
            stocks[userStockIndex].current_stock += Number(cropStock);
            stocks[userStockIndex].stock_date = Timestamp.now();
            stocks[userStockIndex].unit = unit;
          } else {
            // Add a new stock entry for this user
            stocks.push({
              owned_by: userName,
              current_stock: Number(cropStock),
              stock_date: Timestamp.now(),
              unit: unit
            });
          }

          // Update the document with the modified stocks array
          await updateDoc(inventoryDocRef, { stocks: stocks });
        } else {
          // Record does not exist, create a new document with stocks array
          await addDoc(inventoryCollection, {
            crop_type_id: Number(cropTypeId),
            stocks: [
              {
                owned_by: userName,
                current_stock: Number(cropStock),
                stock_date: Timestamp.now(),
                unit: unit
              }
            ]
          });
        }

        await saveActivityLog(`Added Crop Stock for ${cropTypeName} with quantity of ${cropStock}`);
        showCropStockMessage("Crop Stock has been added successfully!", true);
        closeStockPanel();
      } else {
        showCropStockMessage("ERROR: Invalid Crop Name unable to save data", false);
      }
    } catch (error) {
      console.error("Error updating crop stock:", error);
      showCropStockMessage("An error occurred while updating crop stock.", false);
    }
  });
});