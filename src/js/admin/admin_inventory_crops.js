import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  deleteDoc,
  writeBatch,
  getDoc,
  setDoc,
  onSnapshot,
  doc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

let cropsList = []; // Declare cropsList globally for filtering
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = []; // Initialize filteredCrops with an empty array
let selectedCrops = [];
let currentUserName = ""; // Variable to store the current user's user_name

// Sort crops by date (latest to oldest)
function sortCropsById() {
  filteredCrops.sort((a, b) => {
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


// Real-time listener for crops collection
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
              crop.stocks = userStockData;  // Save user-specific stock data as an array
            } else {
              // Stocks exist but not for the current user_type
              crop.stocks = [{
                stock_date: null,
                current_stock: "",
                unit: "Stock has not been updated yet",
                owned_by: "No stock record found for the current user type"
              }];
            }
          } else {
            // `stocks` array is empty for all users
            crop.stocks = [{
              stock_date: null,
              current_stock: "",
              unit: "Stock has not been updated yet",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          // No stock data found at all
          crop.stocks = [{
            stock_date: null,
            current_stock: "",
            unit: "Stock has not been updated yet",
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


// Display crops in the table
function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCrops = cropsList.slice(startIndex, endIndex);

  if (paginatedCrops.length === 0) {
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="6" style="text-align: center; color: red;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedCrops.forEach((crop) => {
    const row = document.createElement("tr");

    const cropTypeId = crop.crop_type_id || "Crop Type Id not recorded";
    const cropName = crop.crop_name || "Crop Name not recorded";
    const cropType = crop.crop_type_name || "Crop Category not recorded.";
    const dateAdded = crop.dateAdded
      ? crop.dateAdded.toDate
        ? crop.dateAdded.toDate().toLocaleDateString()
        : new Date(crop.dateAdded).toLocaleDateString()
      : "Date not recorded";
      crop.stocks.forEach((stock) => {
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
// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchCrops();
});

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
  const checkbox = event.target; // The checkbox that triggered the event
  const row = checkbox.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  // Get cropType ID from the data attribute
  const cropTypeId = checkbox.getAttribute("data-crop-id");

  if (checkbox.checked) {
    // Add to selected list if checked
    if (!selectedCrops.includes(cropTypeId)) {
      selectedCrops.push(cropTypeId);
    }
  } else {
    // Remove from list if unchecked
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

// Attach event listener to checkboxes (after crops are displayed)
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
  let hasStocks = false;  // Flag to track if stocks exist

  for (const checkbox of selectedCheckboxes) {
      const cropTypeId = checkbox.getAttribute("data-crop-id");

      // Validate cropTypeId (null, undefined, or empty string)
      if (!cropTypeId || cropTypeId.trim() === "") {
          hasInvalidId = true;
          break;
      }

      /* Check if the cropType_id exists in the database */
      try {
          const q = query(collection(db, "tb_crop_types"), where("crop_type_id", "==", Number(cropTypeId)));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              hasInvalidId = true;
              console.error(`ERROR: Crop ID ${cropTypeId} does not exist in the database.`);
              break;
          }

          // Check if there are stocks for this crop_type_id by querying tb_crop_stock
          const stockQuery = query(collection(db, "tb_crop_stock"), where("crop_type_id", "==", Number(cropTypeId)));
          const stockSnapshot = await getDocs(stockQuery);

          if (!stockSnapshot.empty) {
              for (const stockDoc of stockSnapshot.docs) {
                  const stocksArray = stockDoc.data().stocks;
                  if (Array.isArray(stocksArray) && stocksArray.length > 0) {
                      hasStocks = true;
                      console.error(`ERROR: Crop ID ${cropTypeId} has stocks and cannot be deleted.`);
                      break;
                  }
              }
          }

          if (hasStocks) break;  // Stop further checks if stocks are found

          selectedCropTypeIds.push(cropTypeId);
      } catch (error) {
          console.error("Error fetching crop records or stocks:", error);
          hasInvalidId = true;
          break;
      }
  }

  if (hasInvalidId) {
      showDeleteMessage("ERROR: Crop ID of one or more selected records are invalid", false);
  } else if (hasStocks) {
      showDeleteMessage("ERROR: One or more selected crops have existing stocks", false);
  } else {
      document.getElementById("crop-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-crop-delete").addEventListener("click", () => {
  document.getElementById("crop-bulk-panel").style.display = "none";
});

// Function to archive and delete documents from a given collection while managing archive_id_counter
async function archiveAndDelete(collectionName, matchField, valuesToDelete) {
  if (valuesToDelete.length === 0) {
    console.warn("No items selected for deletion.");
    return;
  }

  try {
    const mainCollection = collection(db, collectionName);
    const archiveCollection = collection(db, "tb_archive");
    const counterDocRef = doc(db, "tb_id_counters", "archive_id_counter"); // Reference for the counter document
    let hasArchived = false; // Flag to check if at least one document was archived

    // Get authenticated user details
    const user = await getAuthenticatedUser();
    const userEmail = user.email;

    // Fetch user details from tb_users collection
    const userQuery = query(collection(db, "tb_users"), where("email", "==", userEmail));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User record not found in tb_users collection.");
      return;
    }

    const userData = userSnapshot.docs[0].data();
    const userName = userData.user_name;
    const userType = userData.user_type;

    // Check if archive_id_counter exists, if not create it with a starting value of 0
    const counterDocSnap = await getDoc(counterDocRef);
    let archiveCounter = counterDocSnap.exists() ? counterDocSnap.data().counter : 0;

    // Ensure archiveCounter is a number
    if (isNaN(archiveCounter)) {
      archiveCounter = 0;
    }

    for (const value of valuesToDelete) {
      const querySnapshot = await getDocs(query(mainCollection, where(matchField, "==", Number(value))));

      if (!querySnapshot.empty) {
        for (const docSnapshot of querySnapshot.docs) {
          archiveCounter++; // Increment counter for each archived record
          const data = docSnapshot.data();
          const archiveId = archiveCounter; // Assign unique archive ID

          const now = new Date();
          const archiveDate = now.toISOString().split('T')[0]; // Store archive date
          const hours = now.getHours();
          const minutes = now.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const archiveTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`; // Store archive time in 12-hour format

          const archivedData = {
            ...data,
            archive_id: archiveId, // Assign archive ID inside the archived document
            document_type: data.stocks ? "Inventory Stock" : "Inventory", // Check for stocks array
            archive_date: archiveDate, // Store archive date
            archive_time: archiveTime, // Store archive time
            archived_by: {
              user_name: userName,
              user_type: userType
            }
          };

          // Create a new document in tb_archive with the assigned archive_id
          const archiveRef = doc(archiveCollection);
          await setDoc(archiveRef, archivedData);

          // Delete the original document after archiving
          await deleteDoc(doc(db, collectionName, docSnapshot.id));

          console.log(`Archived and deleted document ID from ${collectionName}:`, docSnapshot.id);
          hasArchived = true;
        }
      }
    }

    // If at least one document was archived, update the archive_id_counter
    if (hasArchived) {
      await setDoc(counterDocRef, { counter: archiveCounter }, { merge: true }); // Create/update counter doc
    } else {
      console.warn(`WARNING: No records found in ${collectionName} for deletion.`);
    }

    const messageType = collectionName.includes("stock") ? "Inventory Stock" : "Inventory";
    console.log(`Processing complete for ${messageType}:`, valuesToDelete);
    showDeleteMessage(`Records from ${messageType} have been processed!`, true);
  } catch (error) {
    console.error(`Error archiving or deleting records from ${collectionName}:`, error);
    const messageType = collectionName.includes("stock") ? "Inventory Stock" : "Inventory";
    showDeleteMessage(`Error processing records from ${messageType}!`, false);
  }
}

// Function to archive and delete selected crops from both tb_crop_types and tb_crop_stock
async function deleteSelectedCrops() {
  if (selectedCrops.length === 0) {
    console.warn("No crops selected for deletion.");
    return;
  }

  try {
    let atLeastOneArchived = false; // Track if any record was archived

    // Archive and delete from tb_crop_types
    await archiveAndDelete("tb_crop_types", "crop_type_id", selectedCrops).then(() => {
      atLeastOneArchived = true;
    });

    // Archive and delete from tb_crop_stock (only if it exists)
    await archiveAndDelete("tb_crop_stock", "crop_type_id", selectedCrops).then(() => {
      atLeastOneArchived = true;
    });

    if (atLeastOneArchived) {
      console.log("Archived and deleted crops:", selectedCrops);
      showDeleteMessage("All selected Crop records and their stocks successfully archived and deleted!", true);
    } else {
      showDeleteMessage("No matching crop records found for deletion!", false);
    }

    selectedCrops = []; // Clear selection AFTER successful deletion
    document.getElementById("crop-bulk-panel").style.display = "none";
    fetchCrops(); // Refresh the table
  } catch (error) {
    console.error("Error archiving or deleting crops:", error);
    showDeleteMessage("Error archiving or deleting crops!", false);
  }
}

// Confirm Deletion and Call Delete Function
document.getElementById("confirm-crop-delete").addEventListener("click", () => {
  deleteSelectedCrops();
});


// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
const deleteMessage = document.getElementById("crop-bulk-message");
const messageQueue = [];
let isProcessingQueue = false;

function showDeleteMessage(message, success) {
  messageQueue.push({ message, success });
  processQueue();
}

function processQueue() {
  if (isProcessingQueue || messageQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  const { message, success } = messageQueue.shift();

  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.opacity = '1';
  deleteMessage.style.display = 'block';

  setTimeout(() => {
    deleteMessage.style.opacity = '0';
    setTimeout(() => {
      deleteMessage.style.display = 'none';
      isProcessingQueue = false;
      processQueue(); // Process the next message in the queue
    }, 300);
  }, 2000);
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
