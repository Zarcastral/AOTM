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
  doc
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const db = getFirestore(app);

async function saveActivityLog(action) {
  const auth = getAuth();

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
function sortCropsById() {
  filteredCrops.sort((a, b) => {
    const dateA = parseDate(a.stock_date);
    const dateB = parseDate(b.stock_date);
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

// Fetch crops data from Firestore
async function fetchCrops() {
  const cropsCollection = collection(db, "tb_crop_types");
  const cropsQuery = query(cropsCollection);

  // Listen for real-time updates
  onSnapshot(cropsQuery, (snapshot) => {
    cropsList = snapshot.docs.map(doc => doc.data());
    filteredCrops = [...cropsList];
    sortCropsById();          // Sort crops by date (latest to oldest)
    displayCrops(filteredCrops); // Update table display
  }, (error) => {
    console.error("Error listening to crops:", error);
  });
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
  paginatedCrops.forEach((crop, index) => {
    const row = document.createElement("tr");

    const cropTypeId = crop.crop_type_id || "Crop Type Id not recorded";
    const cropName = crop.crop_name || "Crop Name not recorded";
    const cropType = crop.crop_type_name || "Crop Category not recorded.";
    const stock_date = crop.stock_date
      ? (crop.stock_date.toDate ? crop.stock_date.toDate().toLocaleDateString() : new Date(crop.stock_date).toLocaleDateString())
      : "Stock has not been updated";
    const currentStock = crop.current_stock || "0";
    const unit = crop.unit || "Units";

    row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-crop-id="${cropTypeId}">
        </td>
        <td>${cropTypeId}</td>
        <td>${cropType}</td>
        <td>${cropName}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>
          <button class="add-crop-stock-btn" id="add-crop-stock-btn" data-id="${crop.cropTypeId}">+ Add Stock</button>
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

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchCrops();
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
      document.getElementById("crop-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-crop-delete").addEventListener("click", () => {
  document.getElementById("crop-bulk-panel").style.display = "none";
});

// Function to delete selected crops from Firestore
async function deleteSelectedCrops() {
  if (selectedCrops.length === 0) {
    return;
  }

  try {
    const cropsCollection = collection(db, "tb_crop_types");
    let deletedCropNames = [];  // Array to store deleted crop names

    // Loop through selected crops and delete them
    for (const cropTypeId of selectedCrops) {
      const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
      const querySnapshot = await getDocs(cropQuery);

      for (const docSnapshot of querySnapshot.docs) {
        const cropData = docSnapshot.data();
        deletedCropNames.push(cropData.crop_type_name);  // Save crop name to array
        await deleteDoc(doc(db, "tb_crop_types", docSnapshot.id));
      }
    }

    console.log("Deleted Crops:", deletedCropNames);
    await saveActivityLog(`Deleted Crops: ${deletedCropNames.join(", ")}`);  // Log crop names instead of IDs
    showDeleteMessage("All selected Crop records successfully deleted!", true);

    // Clear selection and update the UI
    selectedCrops = [];
    document.getElementById("crop-bulk-panel").style.display = "none"; // Hide confirmation panel
    fetchCrops(); // Refresh the table

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

  saveBtn.addEventListener("click", async function () {
    const cropTypeId = saveBtn.dataset.cropTypeId;
    const cropTypeName = document.getElementById("crop_name").value;
    const cropName = document.getElementById("crops").value;
    const cropStock = document.getElementById("crop_stock").value;
    const unit = document.getElementById("crop_unit").value;
    
    if (!unit || unit === "Invalid Unit") {
      unit = "No unit was recorded";
    }
    
    if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
      showCropStockMessage("Please enter a valid crop stock quantity.", false);
      return;
    }

    try {
      const cropsCollection = collection(db, "tb_crop_types");
      const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
      const querySnapshot = await getDocs(cropQuery);

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const existingStock = querySnapshot.docs[0].data().current_stock || 0;
        const newStock = existingStock + Number(cropStock);

        await updateDoc(docRef, {
          stock_date: Timestamp.now(),
          crop_name: cropName,
          crop_type_name: cropTypeName,
          current_stock: newStock,
          unit: unit
        });  
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