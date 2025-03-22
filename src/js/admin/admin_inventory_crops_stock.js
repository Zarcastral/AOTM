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
  addCropStock();
});
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

    // Get user_type from the fetched user document
    const userType = userSnapshot.docs[0].data().user_type;

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

              crop.stocks = userStockData;  // Save user-specific stock data as an array
            } else {
              // Stocks exist but not for the current user_type
              crop.stocks = [{
                stock_date: null,
                current_stock: `Stock has not been updated yet for ${userType}`,
                unit: "",
                owned_by: `No stock record found for ${userType}`
              }];
            }
          } else {
            // `stocks` array is empty for all users
            crop.stocks = [{
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          // No stock data found at all
          crop.stocks = [{
            stock_date: null,
            current_stock: "Stock has not been updated yet",
            unit: "",
            owned_by: "No stock record found for any user type"
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
      const unit = stock.unit || "";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
        <td>${cropTypeId}</td>
        <td>${cropType}</td>
        <td>${cropName}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td class="crop-action-btn">
          <button class="add-crop-stock-btn" id="add-crop-stock-btn" data-id="${cropTypeId}">
            <img src="../../../public/images/Plus.png" alt="Action Icon" class="action-icon-add">
            <span>Add Stock</span>
          </button>
          <button class="delete-crop-stock-btn" id="delete-crop-stock-btn" data-id="${cropTypeId}">
            <img src="../../../public/images/Ekis.png" alt="Action Icon" class="action-icon-remove">
            <span>Remove Stock</span>
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

// <------------------ FUNCTION TO DISPLAY CROP STOCK MESSAGE ------------------------>
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

// <------------------ FUNCTION TO DISPLAY ADD STOCK FLOATING PANEL ------------------------> //
const saveBtn = document.getElementById("crop-save-stock");
const cropStockPanel = document.getElementById("crop-stock-panel");
const cropOverlay = document.getElementById("crop-overlay");
const cancelBtn = document.getElementById("crop-cancel-stock");
const cropStockTitle = document.getElementById("crop-stock-title");
const deleteStockTitle = document.getElementById("crop-delete-stock-title");
const deleteStockBtn = document.getElementById("crop-delete-stock");

function addCropStock() {
  document.querySelector(".crop_table").addEventListener("click", async function (event) {
      if (event.target.classList.contains("add-crop-stock-btn") || event.target.classList.contains("delete-crop-stock-btn")) {
          const cropTypeId = event.target.dataset.id; 
          const isDelete = event.target.classList.contains("delete-crop-stock-btn");

          try {
              const user = await getAuthenticatedUser();
              if (!user || !user.user_type) {
                  console.error("No authenticated user or user type found.");
                  return;
              }

              const userType = user.user_type.trim();

              let cropTypeName = "No category was recorded";
              let cropName = "No name was recorded";
              let cropUnit = "No unit was recorded"; 
              let currentStock = "No stock recorded"; 
              let stockUnit = ""; 

              const cropsCollection = collection(db, "tb_crop_types");
              const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
              const cropSnapshot = await getDocs(cropQuery);

              if (!cropSnapshot.empty) {
                  const cropData = cropSnapshot.docs[0].data();
                  cropName = cropData.crop_name?.trim() || "No name was recorded";
                  cropTypeName = cropData.crop_type_name?.trim() || "No category was recorded";
                  cropUnit = cropData.unit?.trim() || "No unit was recorded";
              }

              const stockCollection = collection(db, "tb_crop_stock");
              const stockQuery = query(stockCollection, where("crop_type_id", "==", Number(cropTypeId)));
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

              document.getElementById("crops").value = cropTypeName;
              document.getElementById("crop_name").value = cropName;
              document.getElementById("crop_unit_hidden").value = cropUnit;
              document.getElementById("current_crop_stock").value = currentStock + (stockUnit ? ` ${stockUnit}` : "");

              cropStockPanel.style.display = "block";
              cropOverlay.style.display = "block";

              saveBtn.dataset.cropTypeId = cropTypeId;
              deleteStockBtn.dataset.cropTypeId = cropTypeId;

              // Toggle between add and delete mode
              if (isDelete) {
                  cropStockTitle.style.display = "none";
                  deleteStockTitle.style.display = "block";
                  saveBtn.style.display = "none";
                  deleteStockBtn.style.display = "block";
              } else {
                  cropStockTitle.style.display = "block";
                  deleteStockTitle.style.display = "none";
                  saveBtn.style.display = "block";
                  deleteStockBtn.style.display = "none";
              }

          } catch (error) {
              console.error("Error fetching crop details:", error);
          }
      }
  });

  // Close panel events
  cancelBtn.addEventListener("click", closeStockPanel);
  cropOverlay.addEventListener("click", closeStockPanel);

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
  cropStockPanel.style.display = "none";
  cropOverlay.style.display = "none";
  document.getElementById("crops").value = "";
  document.getElementById("crop_name").value = "";
  document.getElementById("crop_stock").value = "";
  document.getElementById("crop_unit_hidden").value = "";
  fetchCrops();
}


async function saveStock() {
  const cropTypeId = Number(saveBtn.dataset.cropTypeId); // Ensure it's a number
  const cropTypeName = document.getElementById("crops").value.trim();
  const cropName = document.getElementById("crop_name").value.trim();
  const cropStock = Number(document.getElementById("crop_stock").value);
  let unit = document.getElementById("crop_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
  }

  if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
      showCropStockMessage("Please enter a valid crop stock quantity.", false);
      return;
  }

  try {
      // ✅ Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showCropStockMessage("User not authenticated.", false);
          return;
      }

      // ✅ Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showCropStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // ✅ Fetch stock from tb_crop_stock by crop_type_id
      const inventoryCollection = collection(db, "tb_crop_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("crop_type_id", "==", cropTypeId)
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
              stocks[userStockIndex].current_stock += cropStock;
              stocks[userStockIndex].stock_date = Timestamp.now();
              stocks[userStockIndex].unit = unit;
          } else {
              // Add a new stock entry for this user_type
              stocks.push({
                  owned_by: userType,
                  current_stock: cropStock,
                  stock_date: Timestamp.now(),
                  unit: unit
              });
          }

          // ✅ Update the document with the modified stocks array
          await updateDoc(inventoryDocRef, { 
              stocks: stocks,
              crop_name: cropName,
              crop_type_name: cropTypeName // Ensure crop_type_name is saved
          });

      } else {
          // ✅ Create a new document if it doesn't exist
          await addDoc(inventoryCollection, {
              crop_type_id: cropTypeId,
              crop_name: cropName,
              crop_type_name: cropTypeName,
              stocks: [
                  {
                      owned_by: userType,
                      current_stock: cropStock,
                      stock_date: Timestamp.now(),
                      unit: unit
                  }
              ]
          });
      }

      // ✅ Save activity log
      await saveActivityLog("Update", `Added ${cropStock} ${unit} of stock for ${cropTypeName} by ${userType}`);
      showCropStockMessage("Crop Stock has been added successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error saving crop stock:", error);
      showCropStockMessage("An error occurred while saving crop stock.", false);
  }
}


async function deleteStock() {
  const cropTypeId = Number(deleteStockBtn.dataset.cropTypeId); // Ensure it's a number
  const cropTypeName = document.getElementById("crops").value.trim();
  const cropName = document.getElementById("crop_name").value.trim();
  const cropStock = Number(document.getElementById("crop_stock").value);
  let unit = document.getElementById("crop_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
  }

  if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
      showCropStockMessage("Please enter a valid crop stock quantity.", false);
      return;
  }

  try {
      // ✅ Get authenticated user
      const user = await getAuthenticatedUser();
      if (!user) {
          showCropStockMessage("User not authenticated.", false);
          return;
      }

      // ✅ Fetch user_type from tb_users
      const usersCollection = collection(db, "tb_users");
      const userQuery = query(usersCollection, where("email", "==", user.email));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
          showCropStockMessage("User not found in the database.", false);
          return;
      }

      const userType = userSnapshot.docs[0].data().user_type;

      // ✅ Fetch stock from tb_crop_stock by crop_type_id
      const inventoryCollection = collection(db, "tb_crop_stock");
      const inventoryQuery = query(
          inventoryCollection, 
          where("crop_type_id", "==", cropTypeId)
      );
      const inventorySnapshot = await getDocs(inventoryQuery);

      if (inventorySnapshot.empty) {
          showCropStockMessage("No stock record found to delete.", false);
          return;
      }

      // ✅ Extract the stocks array from the matching document
      const inventoryDocRef = inventorySnapshot.docs[0].ref;
      const inventoryData = inventorySnapshot.docs[0].data();
      let stocks = inventoryData.stocks || [];

      // ✅ Find the matching map with the authenticated user's user_type
      const userStockIndex = stocks.findIndex(stock => stock.owned_by === userType);

      if (userStockIndex === -1) {
          showCropStockMessage("No stock entry found for this user type.", false);
          return;
      }

      // ✅ Retrieve the current_stock for this user
      const existingStock = stocks[userStockIndex].current_stock || 0;
      const newStock = existingStock - cropStock;

      if (newStock < 0) {
          showCropStockMessage("Not enough stock available", false);
          return;
      }

      if (newStock === 0) {
          // ✅ If the current_stock reaches 0, remove the entire map
          stocks.splice(userStockIndex, 1);
      } else {
          // ✅ Otherwise, update the stock values
          stocks[userStockIndex].current_stock = newStock;
          stocks[userStockIndex].stock_date = Timestamp.now();
          stocks[userStockIndex].unit = unit;
      }

      // ✅ Save the updated document
      await updateDoc(inventoryDocRef, {
          stocks: stocks,
          crop_name: cropName,
          crop_type_name: cropTypeName // Ensure crop_type_name is saved
      });

      await saveActivityLog("Delete", `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`);
      showCropStockMessage("Crop Stock has been Deleted successfully!", true);
      closeStockPanel();

  } catch (error) {
      console.error("Error deleting crop stock:", error);
      showCropStockMessage("An error occurred while deleting crop stock.", false);
  }
}

