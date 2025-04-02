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
let currentFarmerId = ""; // Variable to store the current user's farmer_id

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
          const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerId = farmerSnapshot.docs[0].data().farmer_id;
            currentFarmerId = farmerId; // Store farmer_id globally
            console.log("Authenticated user's farmer_id:", farmerId);
            resolve(user); // Resolve with user object if needed
          } else {
            console.error("Farmer record not found in tb_farmers collection.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer_id:", error);
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
  const closeHarvestBtn = document.getElementById("close-harvest-btn");

  // Close modal when "X" is clicked
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // Close modal when "Close" button in footer is clicked
  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // Close modal when clicking outside the modal content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  fetchHarvest();

  // Function to apply search filter
  function applyFilters() {
    const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();

    filteredHarvest = harvestList.filter(harvest => {
      const matchesSearch = searchQuery ? 
        (harvest.project_name?.toLowerCase().includes(searchQuery) || 
         harvest.farm_president?.toLowerCase().includes(searchQuery)) : true;

      return matchesSearch;
    });

    currentPage = 1;
    sortHarvestById();
    displayHarvest(filteredHarvest);
  }

  document.getElementById("harvest-search-bar").addEventListener("input", applyFilters);
});

// Real-time listener for tb_headfarmer_harvest subcollection
async function fetchHarvest() {
  try {
    const user = await getAuthenticatedUser();
    if (!currentFarmerId) {
      console.error("No farmer_id available for querying harvests.");
      return;
    }

    // Reference to tb_headfarmer_harvest subcollection
    const subCollectionRef = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");
    const harvestQuery = query(subCollectionRef, where("farmer_id", "==", currentFarmerId));

    onSnapshot(harvestQuery, async (snapshot) => {
      const harvestData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(harvest => typeof harvest.harvest_id === 'number' && !isNaN(harvest.harvest_id));

      await processExpiredRecords(harvestData);
      harvestList = harvestData.filter(harvest => !isExpired(harvest.harvest_date));
      filteredHarvest = [...harvestList];
      sortHarvestById();
      displayHarvest(filteredHarvest);
    }, (error) => {
      console.error("Error listening to tb_headfarmer_harvest:", error);
    });
  } catch (error) {
    console.error("Error fetching tb_headfarmer_harvest:", error);
  }
}

function isExpired(harvestDate) {
  if (!harvestDate) return false;
  const date = harvestDate.toDate ? harvestDate.toDate() : new Date(harvestDate);
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
  return date < sixMonthsAgo;
}

async function processExpiredRecords(harvestData) {
  const batch = writeBatch(db);
  const historyCollection = collection(db, "tb_harvest_history");

  for (const harvest of harvestData) {
    if (isExpired(harvest.harvest_date)) {
      const historyDocRef = doc(historyCollection, harvest.id);
      batch.set(historyDocRef, harvest);
      const harvestDocRef = doc(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest", harvest.id);
      batch.delete(harvestDocRef);
      console.log(`Moving harvest ${harvest.id} to history (expired)`);
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error("Error processing expired records:", error);
  }
}

function displayHarvest(harvestList) {
  const tableBody = document.querySelector(".harvest_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .harvest_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedHarvest = harvestList.slice(startIndex, endIndex);

  if (paginatedHarvest.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No records found</td></tr>`;
    return;
  }

  paginatedHarvest.forEach((harvest) => {
    const row = document.createElement("tr");
    const harvestId = harvest.harvest_id || "N/A";
    const projectName = harvest.project_name || "N/A";
    const harvestDate = harvest.harvest_date ? 
      (harvest.harvest_date.toDate ? harvest.harvest_date.toDate().toLocaleDateString() : new Date(harvest.harvest_date).toLocaleDateString()) : 
      "Stock has not been updated";
    const totalHarvest = harvest.total_harvested_crops || "N/A";
    const unit = harvest.unit || "N/A";

    row.innerHTML = `
      <td>${harvestId}</td>
      <td>${projectName}</td>
      <td>"Team Name"</td>
      <td>"Lead Farmer"</td>
      <td>${harvestDate}</td>
      <td>${totalHarvest} ${unit}</td>
      <td>
        <button class="action-btn view-btn" data-id="${harvestId}" title="View">
          <img src="../../images/eye.png" alt="View">
        </button>
      </td>
    `;
    tableBody.appendChild(row);

    const viewBtn = row.querySelector(".view-btn");
    viewBtn.addEventListener("click", async () => {
      await openHarvestReportModal(harvestId);
    });
  });
  updatePagination();
}

async function openHarvestReportModal(harvestId) {
  try {
    const harvestQuery = query(
      collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest"),
      where("harvest_id", "==", parseInt(harvestId)),
      where("farmer_id", "==", currentFarmerId)
    );
    const harvestSnapshot = await getDocs(harvestQuery);

    if (harvestSnapshot.empty) {
      console.error(`No harvest found with harvest_id: ${harvestId} for farmer_id: ${currentFarmerId}`);
      alert("Harvest record not found.");
      return;
    }

    const harvestData = harvestSnapshot.docs[0].data();

    // Safely assign values with fallbacks for missing fields
    document.getElementById("modal-project-name").value = harvestData.project_name || "N/A";
    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops || "N/A";
    document.getElementById("modal-unit").value = harvestData.unit || "kg"; // Default to "kg" if missing
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";
    document.getElementById("modal-barangay").value = harvestData.barangay_name || "N/A";
    document.getElementById("modal-crop-type").value = harvestData.crop_type || "N/A";
    document.getElementById("modal-crop").value = harvestData.crop_name || "N/A";
    const farmers = harvestData.farmers_list || [];
    document.getElementById("modal-farmers").value = Array.isArray(farmers) ? farmers.join("\n") : "N/A";

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    alert("Error loading harvest report: " + error.message); // Improved error message
  }
}

function updatePagination() {
  const totalPages = Math.ceil(filteredHarvest.length / rowsPerPage) || 1;
  document.getElementById("harvest-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("harvest-prev-page").disabled = currentPage === 1;
  document.getElementById("harvest-next-page").disabled = currentPage >= Math.ceil(filteredHarvest.length / rowsPerPage);
}

document.getElementById("harvest-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayHarvest(filteredHarvest);
  }
});

document.getElementById("harvest-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredHarvest.length) {
    currentPage++;
    displayHarvest(filteredHarvest);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("harvest-report-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const addHarvestBtn = document.getElementById("add-harvest");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  // Close modal when "X" is clicked
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // Close modal when "Close" button in footer is clicked
  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // Close modal when clicking outside the modal content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  // Open modal when "Add Harvest" button is clicked
  addHarvestBtn.addEventListener("click", async () => {
    await fetchProjectsAndTeams();
    openEmptyHarvestModal();
  });

  // Close modal after submitting harvest data
  submitHarvestBtn.addEventListener("click", async () => {
    await saveHarvest();
    modal.classList.remove("active");
  });
});

async function fetchProjectsAndTeams() {
  try {
    // Fetch projects
    const projectCollection = collection(db, "tb_projects");
    const projectSnapshot = await getDocs(projectCollection);
    projects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch teams (assuming teams are stored in a collection named tb_teams)
    const teamCollection = collection(db, "tb_teams");
    const teamSnapshot = await getDocs(teamCollection);
    teams = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Populate dropdowns
    const projectSelect = document.getElementById("modal-project-name");
    projectSelect.innerHTML = '<option value="" disabled selected>Select Project</option>';
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.project_name;
      option.textContent = project.project_name;
      projectSelect.appendChild(option);
    });

    const teamSelect = document.getElementById("modal-team");
    teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
    teams.forEach(team => {
      const option = document.createElement("option");
      option.value = team.team_name;
      option.textContent = team.team_name;
      teamSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching projects and teams:", error);
  }
}

function openEmptyHarvestModal() {
  document.getElementById("modal-project-name").value = "";
  document.getElementById("modal-team").value = "";
  document.getElementById("modal-total-harvest").value = "";
  document.getElementById("modal-unit").value = "kg";
  document.getElementById("modal-farm-president").value = "";
  document.getElementById("modal-farmers").value = "";

  const modal = document.getElementById("harvest-report-modal");
  modal.classList.add("active");
}

async function saveHarvest() {
  try {
    const projectName = document.getElementById("modal-project-name").value;
    const teamName = document.getElementById("modal-team").value;
    const totalHarvest = document.getElementById("modal-total-harvest").value;
    const unit = document.getElementById("modal-unit").value;
    const farmPresident = document.getElementById("modal-farm-president").value;
    const farmers = document.getElementById("modal-farmers").value.split("\n").filter(farmer => farmer.trim() !== "");

    if (!projectName || !teamName || !totalHarvest || !farmPresident) {
      alert("Please fill in all required fields.");
      return;
    }

    const harvestData = {
      project_name: projectName,
      team_name: teamName,
      total_harvested_crops: parseFloat(totalHarvest),
      unit: unit,
      farm_president: farmPresident,
      farmers_list: farmers,
      harvest_date: new Date(),
      harvest_id: harvestList.length + 1,
      dateAdded: new Date()
    };

    await addDoc(collection(db, "tb_harvest"), harvestData);
    alert("Harvest added successfully!");
  } catch (error) {
    console.error("Error saving harvest:", error);
    alert("Error saving harvest.");
  }
}