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

import app from "../../config/firebase_config.js";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();
const db = getFirestore(app);

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
    const dateA = parseDate(a.date_created);
    const dateB = parseDate(b.date_created);
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

// Authenticate user and fetch crops
onAuthStateChanged(auth, async (user) => {
  if (user.email) {
    try {
      const farmersCollection = collection(db, "tb_farmers");
      const farmerQuery = query(farmersCollection, where("email", "==", user.email));
      const farmerSnapshot = await getDocs(farmerQuery);

      if (!farmerSnapshot.empty) {
        console.log("Authenticated user:", user.email);
        fetchCrops(user.email);
      } else {
        console.error("User is not a farmer.");
      }
    } catch (error) {
      console.error("Error authenticating user:", error);
    }
  } else {
    console.log("No user is signed in.");
  }
});

// Fetch crops data based on authenticated user's email
function fetchCrops(userEmail) {
  const projectsCollection = collection(db, "tb_projects");
  const projectsQuery = query(projectsCollection, where("email", "==", userEmail));

  onSnapshot(projectsQuery, (snapshot) => {
    cropsList = snapshot.docs.map(doc => ({
      project_id: doc.data().project_id || "N/A",
      project_name: doc.data().project_name || "N/A",
      crop_name: doc.data().crop_name || "N/A",
      crop_type_name: doc.data().crop_type_name || "N/A",
      date_created: doc.data().date_added || "N/A",
      quantity_crop_type: doc.data().quantity_crop_type || "N/A",
      crop_unit: doc.data().crop_unit || "No Unit Record" // Add this line to handle unit
    }));

    filteredCrops = [...cropsList];
    sortCropsById();          // Sort crops by date (latest to oldest)
    displayCrops(filteredCrops); // Update table display
  }, (error) => {
    console.error("Error listening to projects:", error);
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
  paginatedCrops.forEach((crop) => {
    const row = document.createElement("tr");

    const projectId = crop.project_id || "N/A";
    const projectName = crop.project_name || "N/A";
    const cropName = crop.crop_name || "N/A";
    const cropType = crop.crop_type_name || "N/A";
    const date_created = crop.date_created
      ? (crop.date_created.toDate ? crop.date_created.toDate().toLocaleDateString() : new Date(crop.date_created).toLocaleDateString())
      : "Date not recorded";
    const quantityCropType = crop.quantity_crop_type || "0";
    const crop_unit = crop.crop_unit || "No Recorded Unit";
    row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-crop-id="${projectId}">
        </td>
        <td>${projectId}</td>
        <td>${projectName}</td>
        <td>${cropType}</td>
        <td>${cropName}</td>
        <td>${date_created}</td>
        <td>${quantityCropType} ${crop_unit}</td>
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
      showDeleteMessage("ERROR: crop ID of one or more selected records are invalid", false);
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

    for (const cropTypeId of selectedCrops) {
      const cropQuery = query(cropsCollection, where("crop_type_id", "==", Number(cropTypeId)));
      const querySnapshot = await getDocs(cropQuery);

      if (!querySnapshot.empty) {
        for (const docSnapshot of querySnapshot.docs) {
          console.log("Deleting document ID:", docSnapshot.id);
          await deleteDoc(doc(db, "tb_crop_types", docSnapshot.id));
        }
      } else {
        console.error(`ERROR: Crop ID ${cropTypeId} does not exist.`);
      }
    }

    console.log("Deleted Crops:", selectedCrops);
    showDeleteMessage("All selected Crop records successfully deleted!", true);
    selectedCrops = [];  // Clear selection AFTER successful deletion
    document.getElementById("crop-bulk-panel").style.display = "none";
    fetchCrops();  // Refresh the table

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
      crop.project_name?.toLowerCase().includes(searchQuery) ||
      crop.crop_name?.toLowerCase().includes(searchQuery) ||
      crop.crop_type_name?.toLowerCase().includes(searchQuery) ||
      crop.crop_type_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortCropsById();
  displayCrops(filteredCrops); // Update the table with filtered crops
});
