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

let harvestList = []; // Declare harvestsList globally for filtering
let currentPage = 1;
const rowsPerPage = 5;
let filteredHarvest = []; // Initialize filteredHarvests with an empty array
let selectedHarvest = [];
let currentUserName = ""; // Variable to store the current user's user_name

// Sort Harvests by date (latest to oldest)
function sortHarvestById() {
  filteredHarvest.sort((a, b) => {
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

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {


  const modal = document.getElementById("harvest-report-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn"); // New Close button in footer
  //const submitBtn = document.getElementById("submit-harvest-btn");

// Close modal when "X" is clicked
closeBtn.addEventListener("click", () => {
  modal.classList.remove("active");
});

// Close modal when "Close" button in footer is clicked (New)
closeHarvestBtn.addEventListener("click", () => {
  modal.classList.remove("active");
});

// Close modal when clicking outside the modal content
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("active");
  }
});

/* Placeholder for "Submit Harvest" button functionality
submitBtn.addEventListener("click", () => {
  alert("Submit Harvest functionality to be implemented.");
  modal.classList.remove("active");
});
*/




  fetchHarvest(); // Note: You had this twice; one is enough
  const cropData = await fetchCropData(); // Fetch and store crop data
  await fetchBarangayNames(); // Fetch barangay names

  // Function to apply combined filters
  function applyFilters() {
    const selectedCrop = document.querySelector(".crop_select").value.toLowerCase();
    const selectedCropType = document.querySelector(".crop-type-select").value.toLowerCase();
    const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
    const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();

    filteredHarvest = harvestList.filter(harvest => {
      // Crop filter
      const matchesCrop = selectedCrop
        ? harvest.crop_name?.toLowerCase() === selectedCrop
        : true;

      // Crop type filter
      const matchesCropType = selectedCropType
        ? harvest.crop_type?.toLowerCase() === selectedCropType
        : true;

      // Barangay filter
      const matchesBarangay = selectedBarangay
        ? harvest.barangay_name?.toLowerCase() === selectedBarangay
        : true;

      // Search filter (project name or farm president)
      const matchesSearch = searchQuery
        ? (harvest.project_name?.toLowerCase().includes(searchQuery) ||
           harvest.farm_president?.toLowerCase().includes(searchQuery))
        : true;

      // Return true only if all conditions are met
      return matchesCrop && matchesCropType && matchesBarangay && matchesSearch;
    });

    currentPage = 1; // Reset pagination
    sortHarvestById();
    displayHarvest(filteredHarvest); // Update table
  }

  // Event listener for crop selection
  document.querySelector(".crop_select").addEventListener("change", function () {
    const selectedCrop = this.value;
    populateCropTypeDropdown(cropData, selectedCrop); // Update crop type dropdown
    applyFilters(); // Apply combined filters
  });

  // Event listener for crop type selection
  document.querySelector(".crop-type-select").addEventListener("change", function () {
    applyFilters(); // Apply combined filters
  });

  // Event listener for barangay selection
  document.querySelector(".barangay_select").addEventListener("change", function () {
    applyFilters(); // Apply combined filters
  });

  // Event listener for search bar
  document.getElementById("harvest-search-bar").addEventListener("input", function () {
    applyFilters(); // Apply combined filters
  });
});

// Real-time listener for Harvest collection
async function fetchHarvest() {
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

    // Reference to tb_harvest_history_history collection
    const harvestCollection = collection(db, "tb_harvest_history");
    const harvestQuery = query(harvestCollection);

    // Listen for real-time updates
    onSnapshot(harvestQuery, async (snapshot) => {
      const harvestData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(harvest => {
          // Filter for documents with valid numeric harvest_id
          return typeof harvest.harvest_id === 'number' && !isNaN(harvest.harvest_id);
        });

      harvestList = harvestData;
      filteredHarvest = [...harvestList];
      sortHarvestById();            // Sort Harvest by date (latest to oldest)
      displayHarvest(filteredHarvest); // Update table display
    }, (error) => {
      console.error("Error listening to Harvest:", error);
    });
  } catch (error) {
    console.error("Error fetching Harvest:", error);
  }
}

// Display Harvest in the table
function displayHarvest(harvestList) {
  const tableBody = document.querySelector(".harvest_history_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .harvest_history_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHarvest = harvestList.slice(startIndex, endIndex);

  if (paginatedHarvest.length === 0) {
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="9" style="text-align: center;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedHarvest.forEach((harvest) => {
    const row = document.createElement("tr");

    const harvestId = harvest.harvest_id || "N/A";
    const projectName = harvest.project_name || "N/A";
    const harvestDate = harvest.harvest_date
      ? (harvest.harvest_date.toDate ? harvest.harvest_date.toDate().toLocaleDateString() : new Date(harvest.harvest_date).toLocaleDateString())
      : "N/A";
    const assignedTo = harvest.farm_president || "N/A";
    const barangayName = harvest.barangay_name || "N/A";
    const cropName = harvest.crop_name || "N/A";
    const cropType = harvest.crop_type || "N/A";
    const totalHarvest = harvest.total_harvested_crops || "N/A";
    const unit = harvest.unit || "N/A";
    row.innerHTML = `
      <td>${harvestId}</td>
      <td>${projectName}</td>
      <td>${harvestDate}</td>
      <td>${assignedTo}</td>
      <td>${barangayName}</td>
      <td>${cropName}</td>
      <td>${cropType}</td>
      <td>${totalHarvest} ${unit}</td>
      <td>
        <button class="action-btn view-btn" data-id="${harvestId}" title="View">
          <img src="/images/eye.png" alt="View">
        </button>
      </td>
    `;
    tableBody.appendChild(row);
    
    // Add event listener to the view button
    const viewBtn = row.querySelector(".view-btn");
    viewBtn.addEventListener("click", async () => {
      await openHarvestReportModal(harvestId);
    });
  });
  updatePagination();
}
// Function to fetch harvest data and open the modal
async function openHarvestReportModal(harvestId) {
  try {
    // Query tb_harvest_history for the record with matching harvest_id
    const harvestQuery = query(collection(db, "tb_harvest_history"), where("harvest_id", "==", parseInt(harvestId)));
    const harvestSnapshot = await getDocs(harvestQuery);

    if (harvestSnapshot.empty) {
      console.error(`No harvest found with harvest_id: ${harvestId}`);
      alert("Harvest record not found.");
      return;
    }

    // Get the first matching document
    const harvestData = harvestSnapshot.docs[0].data();

    // Populate the modal fields
    document.getElementById("modal-project-name").value = harvestData.project_name || "N/A";
    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops || "N/A";
    document.getElementById("modal-unit").value = harvestData.unit || "kg";
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";
    document.getElementById("modal-barangay").value = harvestData.barangay_name || "N/A";
    document.getElementById("modal-crop-type").value = harvestData.crop_type || "N/A";
    document.getElementById("modal-crop").value = harvestData.crop_name || "N/A";

    // Fetch the farmer_list array from the harvest document
    const farmers = harvestData.farmers_list || []; // Use farmer_list instead of farmers
    document.getElementById("modal-farmers").value = farmers.join("\n") || "N/A";

    // Show the modal
    const modal = document.getElementById("harvest-report-modal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    alert("Error loading harvest report.");
  }
}
// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredHarvest.length / rowsPerPage) || 1;
  document.getElementById("harvest-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("harvest-prev-page").disabled = currentPage === 1;
  document.getElementById("harvest-next-page").disabled = currentPage >= Math.ceil(filteredHarvest.length / rowsPerPage);
}

// Event listener for "Previous" button
document.getElementById("harvest-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayHarvest(filteredHarvest);
  }
});

// Event listener for "Next" button
document.getElementById("harvest-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredHarvest.length) {
    currentPage++;
    displayHarvest(filteredHarvest);
  }
});

async function fetchCropData() {
  const cropCollection = collection(db, "tb_crop_types");
  const cropSnapshot = await getDocs(cropCollection);
  const cropData = cropSnapshot.docs.map(doc => doc.data()); // Store full data for filtering

  const cropNames = [...new Set(cropData.map(item => item.crop_name))]; // Unique crop names
  populateCropDropdown(cropNames);
  return cropData; // Return full data for later use in crop type filtering
}

// Populate the crop dropdown with crop names
function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";
  cropSelect.innerHTML = firstOption;

  cropNames.forEach(cropName => {
    const option = document.createElement("option");
    option.textContent = cropName;
    option.value = cropName; // Set value for easier filtering
    cropSelect.appendChild(option);
  });
}

// Populate the crop type dropdown based on selected crop
function populateCropTypeDropdown(cropData, selectedCrop) {
  const cropTypeSelect = document.querySelector(".crop-type-select");
  if (!cropTypeSelect) {
    console.error("Crop type dropdown not found!");
    return;
  }
  const firstOption = cropTypeSelect.querySelector("option")?.outerHTML || "";
  cropTypeSelect.innerHTML = firstOption;

  if (selectedCrop) {
    const cropTypes = cropData
      .filter(item => item.crop_name === selectedCrop)
      .map(item => item.crop_type_name);
    cropTypes.forEach(cropType => {
      const option = document.createElement("option");
      option.textContent = cropType;
      option.value = cropType;
      cropTypeSelect.appendChild(option);
    });
  }
}

// Fetch barangay names from tb_barangay
async function fetchBarangayNames() {
  const barangayCollection = collection(db, "tb_barangay");
  const barangaySnapshot = await getDocs(barangayCollection);
  const barangayNames = barangaySnapshot.docs.map(doc => doc.data().barangay_name);

  populateBarangayDropdown(barangayNames);
}

// Populate the barangay dropdown with barangay names
function populateBarangayDropdown(barangayNames) {
  const barangaySelect = document.querySelector(".barangay_select");
  if (!barangaySelect) {
    console.error("Barangay dropdown not found!");
    return;
  }
  const firstOption = barangaySelect.querySelector("option")?.outerHTML || "";
  barangaySelect.innerHTML = firstOption;

  barangayNames.forEach(barangayName => {
    const option = document.createElement("option");
    option.textContent = barangayName;
    option.value = barangayName;
    barangaySelect.appendChild(option);
  });
}