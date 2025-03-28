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
  doc,
  addDoc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

let harvestList = [];
let currentPage = 1;
const rowsPerPage = 5;
let filteredHarvest = [];
let selectedHarvest = [];
let currentUserName = "";
let projects = [];
let teams = [];

function sortHarvestById() {
  filteredHarvest.sort((a, b) => {
    const dateA = parseDate(a.dateAdded);
    const dateB = parseDate(b.dateAdded);
    return dateB - dateA;
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0);
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  return new Date(dateValue);
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
            resolve(user);
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

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("harvest-report-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const addHarvestBtn = document.getElementById("add-harvest");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  addHarvestBtn.addEventListener("click", async () => {
    await fetchProjectsAndTeams();
    openEmptyHarvestModal();
  });

  submitHarvestBtn.addEventListener("click", async () => {
    await saveHarvest();
    modal.classList.remove("active");
  });

  fetchHarvest();
  const cropData = await fetchCropData();
  await fetchBarangayNames();

  function applyFilters() {
    const selectedCrop = document.querySelector(".crop_select").value.toLowerCase();
    const selectedCropType = document.querySelector(".crop-type-select").value.toLowerCase();
    const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
    const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();

    filteredHarvest = harvestList.filter(harvest => {
      const matchesCrop = selectedCrop ? harvest.crop_name?.toLowerCase() === selectedCrop : true;
      const matchesCropType = selectedCropType ? harvest.crop_type?.toLowerCase() === selectedCropType : true;
      const matchesBarangay = selectedBarangay ? harvest.barangay_name?.toLowerCase() === selectedBarangay : true;
      const matchesSearch = searchQuery ? 
        (harvest.project_name?.toLowerCase().includes(searchQuery) || harvest.farm_president?.toLowerCase().includes(searchQuery)) : 
        true;
      return matchesCrop && matchesCropType && matchesBarangay && matchesSearch;
    });

    currentPage = 1;
    sortHarvestById();
    displayHarvest(filteredHarvest);
  }

  document.querySelector(".crop_select").addEventListener("change", function () {
    const selectedCrop = this.value;
    populateCropTypeDropdown(cropData, selectedCrop);
    applyFilters();
  });

  document.querySelector(".crop-type-select").addEventListener("change", applyFilters);
  document.querySelector(".barangay_select").addEventListener("change", applyFilters);
  document.getElementById("harvest-search-bar").addEventListener("input", applyFilters);
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

async function fetchHarvest() {
  try {
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    const harvestCollection = collection(db, "tb_harvest");
    const harvestQuery = query(harvestCollection);

    onSnapshot(harvestQuery, async (snapshot) => {
      const harvestData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(harvest => typeof harvest.harvest_id === 'number' && !isNaN(harvest.harvest_id));

      await processExpiredRecords(harvestData);
      harvestList = harvestData.filter(harvest => !isExpired(harvest.harvest_date));
      filteredHarvest = [...harvestList];
      sortHarvestById();
      displayHarvest(filteredHarvest);
    }, (error) => {
      console.error("Error listening to Harvest:", error);
    });
  } catch (error) {
    console.error("Error fetching Harvest:", error);
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
      const harvestDocRef = doc(db, "tb_harvest", harvest.id);
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
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `<td colspan="9" style="text-align: center;">No records found</td>`;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) noRecordsMessage.remove();

  paginatedHarvest.forEach((harvest) => {
    const row = document.createElement("tr");
    const harvestId = harvest.harvest_id || "N/A";
    const projectName = harvest.project_name || "N/A";
    const harvestDate = harvest.harvest_date
      ? (harvest.harvest_date.toDate ? harvest.harvest_date.toDate().toLocaleDateString() : new Date(harvest.harvest_date).toLocaleDateString())
      : "Stock has not been updated";
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
    const harvestQuery = query(collection(db, "tb_harvest"), where("harvest_id", "==", parseInt(harvestId)));
    const harvestSnapshot = await getDocs(harvestQuery);

    if (harvestSnapshot.empty) {
      console.error(`No harvest found with harvest_id: ${harvestId}`);
      alert("Harvest record not found.");
      return;
    }

    const harvestData = harvestSnapshot.docs[0].data();
    document.getElementById("modal-project-name").value = harvestData.project_name || "N/A";
    document.getElementById("modal-team").value = harvestData.team_name || "N/A";
    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops || "N/A";
    document.getElementById("modal-unit").value = harvestData.unit || "kg";
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";
    const farmers = harvestData.farmers_list || [];
    document.getElementById("modal-farmers").value = farmers.join("\n") || "N/A";

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    alert("Error loading harvest report.");
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

async function fetchCropData() {
  const cropCollection = collection(db, "tb_crop_types");
  const cropSnapshot = await getDocs(cropCollection);
  const cropData = cropSnapshot.docs.map(doc => doc.data());
  const cropNames = [...new Set(cropData.map(item => item.crop_name))];
  populateCropDropdown(cropNames);
  return cropData;
}

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
    option.value = cropName;
    cropSelect.appendChild(option);
  });
}

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

async function fetchBarangayNames() {
  const barangayCollection = collection(db, "tb_barangay");
  const barangaySnapshot = await getDocs(barangayCollection);
  const barangayNames = barangaySnapshot.docs.map(doc => doc.data().barangay_name);
  populateBarangayDropdown(barangayNames);
}

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