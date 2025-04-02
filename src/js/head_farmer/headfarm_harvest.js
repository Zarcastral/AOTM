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
  addDoc,
  increment,
  runTransaction
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
let isEditing = false;
let currentHarvestDocId = null;

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
          const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
          const farmerSnapshot = await getDocs(farmerQuery);
          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            const farmerId = farmerData.farmer_id;
            const userType = farmerData.user_type;
            console.log("Authenticated farmer's farmer_id:", farmerId, "user_type:", userType);
            resolve({ user, farmerId });
          } else {
            console.error("Farmer record not found in tb_farmers collection.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}

const harvestSuccessMessage = document.getElementById("harvest-success-message");

function showSuccessMessage(message, success = true) {
  harvestSuccessMessage.textContent = message;
  harvestSuccessMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  harvestSuccessMessage.style.opacity = '1';
  harvestSuccessMessage.style.display = 'block';

  return new Promise((resolve) => {
    setTimeout(() => {
      harvestSuccessMessage.style.opacity = '0';
      setTimeout(() => {
        harvestSuccessMessage.style.display = 'none';
        resolve();
      }, 300);
    }, 4000);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("harvest-report-modal");
  const modalHeader = document.querySelector("#harvest-report-modal .modal-header h2"); // Select the h2 in modal header
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const addHarvestBtn = document.getElementById("add-harvest"); // Assuming this exists outside the modal
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest"; // Reset modal header
    submitHarvestBtn.textContent = "Save"; // Reset submit button
  });

  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest"; // Reset modal header
    submitHarvestBtn.textContent = "Save"; // Reset submit button
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
      isEditing = false;
      modalHeader.textContent = "Add Harvest"; // Reset modal header
      submitHarvestBtn.textContent = "Save"; // Reset submit button
    }
  });

  // If addHarvestBtn exists in your full HTML, keep this; otherwise, you might need to adjust
  if (addHarvestBtn) {
    addHarvestBtn.addEventListener("click", async () => {
      await fetchProjectsAndTeams();
      openEmptyHarvestModal();
      isEditing = false;
      modalHeader.textContent = "Add Harvest"; // Set modal header for add
      submitHarvestBtn.textContent = "Save"; // Set submit button for add
    });
  }

  let isSaving = false;
  submitHarvestBtn.addEventListener("click", async () => {
    if (isSaving) return;
    isSaving = true;
    submitHarvestBtn.disabled = true;

    try {
      await saveHarvest();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      isSaving = false;
      submitHarvestBtn.disabled = false;
    }
  });

  fetchHarvest();

  function applyFilters() {
    const searchQuery = document.getElementById("harvest-search-bar").value.toLowerCase().trim();

    filteredHarvest = harvestList.filter(harvest => {
      const matchesSearch = searchQuery ? 
        (harvest.project_name?.toLowerCase().includes(searchQuery) || harvest.farm_president?.toLowerCase().includes(searchQuery)) : 
        true;
      return matchesSearch;
    });

    currentPage = 1;
    sortHarvestById();
    displayHarvest(filteredHarvest);
  }

  document.getElementById("harvest-search-bar").addEventListener("input", applyFilters);
});

async function fetchProjectsAndTeams() {
  try {
    const { farmerId } = await getAuthenticatedUser();

    const projectQuery = query(collection(db, "tb_projects"), where("lead_farmer_id", "==", farmerId));
    const projectSnapshot = await getDocs(projectQuery);
    projects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const teamCollection = collection(db, "tb_teams");
    const teamSnapshot = await getDocs(teamCollection);
    teams = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const projectSelect = document.getElementById("modal-project-name");
    projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.project_name;
      option.textContent = project.project_name;
      option.dataset.teamId = project.team_id || "";
      projectSelect.appendChild(option);
    });

    projectSelect.addEventListener("change", async () => {
      const selectedProjectName = projectSelect.value;
      const teamSelect = document.getElementById("modal-team");

      if (selectedProjectName === "") {
        teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
        document.getElementById("modal-farmers").value = "";
        document.getElementById("modal-farm-president").value = "";
      } else {
        const selectedProject = projects.find(p => p.project_name === selectedProjectName);
        const teamId = selectedProject ? selectedProject.team_id || "" : "";

        teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
        const matchingTeam = teams.find(team => team.team_id === teamId);
        if (matchingTeam) {
          const option = document.createElement("option");
          option.value = matchingTeam.team_name;
          option.textContent = matchingTeam.team_name;
          teamSelect.appendChild(option);
        }

        document.getElementById("modal-farmers").value = "";
        document.getElementById("modal-farm-president").value = "";
      }
    });

    const teamSelect = document.getElementById("modal-team");
    teamSelect.addEventListener("change", async () => {
      const selectedTeamName = teamSelect.value;

      if (selectedTeamName === "") {
        document.getElementById("modal-farmers").value = "";
        document.getElementById("modal-farm-president").value = "";
      } else {
        const selectedTeam = teams.find(t => t.team_name === selectedTeamName);

        if (selectedTeam) {
          const farmerNameArray = selectedTeam.farmer_name || [];
          const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
          document.getElementById("modal-farmers").value = farmerNames.join("\n");
          const leadFarmer = selectedTeam.lead_farmer || "N/A";
          document.getElementById("modal-farm-president").value = leadFarmer;
        }
      }
    });
  } catch (error) {
    console.error("Error fetching projects and teams:", error);
  }
}

async function getNextHarvestId() {
  const counterRef = doc(db, "tb_id_counters", "harvest_id_counter");
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let newId;
    if (!counterDoc.exists()) {
      newId = 1;
      transaction.set(counterRef, { count: newId });
    } else {
      newId = (counterDoc.data().count || 0) + 1;
      transaction.update(counterRef, { count: increment(1) });
    }
    return newId;
  });
}

async function saveHarvest() {
  try {
    const projectName = document.getElementById("modal-project-name").value;
    const teamName = document.getElementById("modal-team").value;
    const totalHarvest = document.getElementById("modal-total-harvest").value;
    const unit = document.getElementById("modal-unit").value;
    const farmPresident = document.getElementById("modal-farm-president").value;
    const farmerNamesInput = document.getElementById("modal-farmers").value.split("\n").filter(farmer => farmer.trim() !== "");

    if (!projectName || !teamName || !totalHarvest || !farmPresident) {
      await showSuccessMessage("Please fill in all required fields", false);
      throw new Error("Missing required fields");
    }

    const selectedTeam = teams.find(t => t.team_name === teamName);
    const farmerNameArray = selectedTeam.farmer_name || [];
    const farmerNameData = farmerNameArray.filter(farmer => 
      farmerNamesInput.includes(farmer.farmer_name)
    );

    const selectedProject = projects.find(p => p.project_name === projectName);
    if (!selectedProject) {
      await showSuccessMessage("Selected project not found.", false);
      throw new Error("Selected project not found");
    }

    const harvestDate = new Date();
    const harvestData = {
      project_id: selectedProject.project_id || selectedProject.id || "N/A",
      project_name: projectName,
      project_creator: selectedProject.project_creator || "N/A",
      crop_name: selectedProject.crop_name || "N/A",
      crop_type_name: selectedProject.crop_type_name || "N/A",
      barangay_name: selectedProject.barangay_name || "N/A",
      team_name: teamName,
      total_harvested_crops: parseFloat(totalHarvest),
      unit: unit,
      farm_president: farmPresident,
      farmer_name: farmerNameData,
      lead_farmer: selectedTeam.lead_farmer || "N/A",
      harvest_date: harvestDate,
      dateAdded: new Date()
    };

    const headFarmerHarvestRef = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");

    if (isEditing && currentHarvestDocId) {
      await setDoc(doc(headFarmerHarvestRef, currentHarvestDocId), harvestData, { merge: true });
      await showSuccessMessage("Harvest updated successfully!");
    } else {
      const newHarvestId = await getNextHarvestId();
      harvestData.harvest_id = newHarvestId;
      await addDoc(headFarmerHarvestRef, harvestData);
      await showSuccessMessage("Harvest successfully created!");
    }

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.remove("active");
    isEditing = false;
    document.querySelector("#harvest-report-modal .modal-header h2").textContent = "Add Harvest"; // Reset header
    document.getElementById("submit-harvest-btn").textContent = "Save"; // Reset button

  } catch (error) {
    console.error("Error saving harvest:", error);
    throw error;
  }
}

async function fetchHarvest() {
  try {
    const { user } = await getAuthenticatedUser();
    const farmersCollection = collection(db, "tb_farmers");
    const farmerQuery = query(farmersCollection, where("email", "==", user.email));
    const farmerSnapshot = await getDocs(farmerQuery);

    if (farmerSnapshot.empty) {
      console.error("Farmer not found in the database.");
      return;
    }

    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");
    const harvestQuery = query(harvestCollection);

    onSnapshot(harvestQuery, (snapshot) => {
      harvestList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(harvest => typeof harvest.harvest_id === 'number' && !isNaN(harvest.harvest_id));
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
    const leadFarmer = harvest.lead_farmer || "N/A";
    const barangayName = harvest.barangay_name || "N/A";
    const cropName = harvest.crop_name || "N/A";
    const cropTypeName = harvest.crop_type_name || "N/A";
    const totalHarvest = harvest.total_harvested_crops || "N/A";
    const unit = harvest.unit || "N/A";

    row.innerHTML = `
      <td>${harvestId}</td>
      <td>${projectName}</td>
      <td>${harvestDate}</td>
      <td>${leadFarmer}</td>
      <td>${barangayName}</td>
      <td>${cropName}</td>
      <td>${cropTypeName}</td>
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
      document.querySelector("#harvest-report-modal .modal-header h2").textContent = "Edit Harvest"; // Change modal header
      document.getElementById("submit-harvest-btn").textContent = "Update"; // Change submit button
      isEditing = true;
    });
  });
  updatePagination();
}

async function openHarvestReportModal(harvestId) {
  try {
    const harvestQuery = query(collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest"), where("harvest_id", "==", parseInt(harvestId)));
    const harvestSnapshot = await getDocs(harvestQuery);

    if (harvestSnapshot.empty) {
      console.error(`No harvest found with harvest_id: ${harvestId}`);
      await showSuccessMessage("Harvest record not found.", false);
      return;
    }

    const harvestData = harvestSnapshot.docs[0].data();
    currentHarvestDocId = harvestSnapshot.docs[0].id;

    const projectSelect = document.getElementById("modal-project-name");
    projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.project_name;
      option.textContent = project.project_name;
      option.dataset.teamId = project.team_id || "";
      if (project.project_name === harvestData.project_name) {
        option.selected = true;
      }
      projectSelect.appendChild(option);
    });

    const teamSelect = document.getElementById("modal-team");
    teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
    const selectedProject = projects.find(p => p.project_name === harvestData.project_name);
    const teamId = selectedProject ? selectedProject.team_id || "" : "";
    const matchingTeam = teams.find(team => team.team_id === teamId);
    if (matchingTeam) {
      const option = document.createElement("option");
      option.value = matchingTeam.team_name;
      option.textContent = matchingTeam.team_name;
      if (matchingTeam.team_name === harvestData.team_name) {
        option.selected = true;
      }
      teamSelect.appendChild(option);
    }

    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops || "N/A";
    document.getElementById("modal-unit").value = harvestData.unit || "kg";
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";
    const farmerNameArray = harvestData.farmer_name || [];
    const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
    document.getElementById("modal-farmers").value = farmerNames.join("\n") || "N/A";
    document.getElementById("modal-crop-name") && (document.getElementById("modal-crop-name").value = harvestData.crop_name || "N/A");
    document.getElementById("modal-crop-type-name") && (document.getElementById("modal-crop-type-name").value = harvestData.crop_type_name || "N/A");
    document.getElementById("modal-barangay-name") && (document.getElementById("modal-barangay-name").value = harvestData.barangay_name || "N/A");

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    await showSuccessMessage("Error loading harvest report.", false);
  }
}

async function openEmptyHarvestModal() {
  try {
    const projectSelect = document.getElementById("modal-project-name");
    const teamSelect = document.getElementById("modal-team");
    document.getElementById("modal-total-harvest").value = "";
    document.getElementById("modal-unit").value = "kg";
    document.getElementById("modal-farm-president").value = "";
    document.getElementById("modal-farmers").value = "";
    document.getElementById("modal-crop-name") && (document.getElementById("modal-crop-name").value = "");
    document.getElementById("modal-crop-type-name") && (document.getElementById("modal-crop-type-name").value = "");
    document.getElementById("modal-barangay-name") && (document.getElementById("modal-barangay-name").value = "");

    projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.project_name;
      option.textContent = project.project_name;
      option.dataset.teamId = project.team_id || "";
      projectSelect.appendChild(option);
    });

    teamSelect.innerHTML = '<option value="" selected>Select Team</option>';

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error opening empty harvest modal:", error);
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