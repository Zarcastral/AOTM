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
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
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
let authenticatedUser = null;

function sortHarvestByDate() {
  filteredHarvest.sort((a, b) => {
    const dateA = parseDate(a.harvest_date);
    const dateB = parseDate(b.harvest_date);
    return dateB - dateA; // Newest first
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
  harvestSuccessMessage.style.backgroundColor = success ? "#41A186" : "#f44336";
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

function restrictHarvestInput() {
  const totalHarvestInput = document.getElementById("modal-total-harvest");

  totalHarvestInput.addEventListener("input", (e) => {
    const input = e.target;
    let value = input.value;

    if (value.startsWith("-")) {
      value = value.replace("-", "");
    }

    if (value.includes(".")) {
      const [whole, decimal] = value.split(".");
      if (decimal.length > 3) {
        value = `${whole}.${decimal.slice(0, 3)}`;
      }
    }

    if (value !== input.value) {
      input.value = value || "";
    }

    if (parseFloat(value) < 0) {
      input.value = "";
    }
  });

  totalHarvestInput.addEventListener("paste", (e) => {
    const pastedData = e.clipboardData.getData("text");
    if (!/^\d*\.?\d{0,3}$/.test(pastedData) || parseFloat(pastedData) < 0) {
      e.preventDefault();
    }
  });

  // These attributes are already set in HTML, but we'll ensure they're applied
  totalHarvestInput.setAttribute("min", "0");
  totalHarvestInput.setAttribute("step", "0.001"); // Override HTML step="0.01" to match JS logic
}

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("harvest-report-modal");
  const modalHeader = document.querySelector("#harvest-report-modal .modal-header h2");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const addHarvestBtn = document.getElementById("add-harvest");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  try {
    authenticatedUser = await getAuthenticatedUser();
    console.log("Authenticated user stored:", authenticatedUser);
  } catch (error) {
    console.error("Initial authentication failed:", error);
    await showSuccessMessage("Authentication failed. Please log in.", false);
    return;
  }

  await fetchProjectsAndTeams();
  restrictHarvestInput(); // Initialize input restrictions

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest";
    submitHarvestBtn.textContent = "Save";
    resetModalFields();
  });

  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest";
    submitHarvestBtn.textContent = "Save";
    resetModalFields();
  });

  if (addHarvestBtn) {
    addHarvestBtn.addEventListener("click", () => {
      openModal(false);
    });
  }

  let isSaving = false;
  submitHarvestBtn.addEventListener("click", async () => {
    if (isSaving) return;
    isSaving = true;
    submitHarvestBtn.disabled = true;
    closeHarvestBtn.disabled = true;
    closeBtn.disabled = true;

    try {
      await saveHarvest();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      isSaving = false;
      submitHarvestBtn.disabled = false;
      closeHarvestBtn.disabled = false;
      closeBtn.disabled = false;
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
    sortHarvestByDate();
    displayHarvest(filteredHarvest);
  }

  document.getElementById("harvest-search-bar").addEventListener("input", applyFilters);
});

async function fetchProjectsAndTeams() {
  try {
    const { farmerId } = authenticatedUser;

    const projectQuery = query(collection(db, "tb_projects"), where("lead_farmer_id", "==", farmerId));
    const projectSnapshot = await getDocs(projectQuery);
    projects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const teamCollection = collection(db, "tb_teams");
    onSnapshot(teamCollection, (teamSnapshot) => {
      teams = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const selectedProjectName = document.getElementById("modal-project-name").value;
      if (selectedProjectName) {
        updateTeamDropdown(selectedProjectName);
      }
    }, (error) => {
      console.error("Error listening to teams:", error);
    });

    const projectSelect = document.getElementById("modal-project-name");
    projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
    projects.forEach(project => {
      const option = document.createElement("option");
      option.value = project.project_name;
      option.textContent = project.project_name;
      option.dataset.teamId = project.team_id || "";
      option.dataset.leadFarmerId = project.lead_farmer_id || "";
      projectSelect.appendChild(option);
    });

    projectSelect.addEventListener("change", async () => {
      const selectedProjectName = projectSelect.value;
      updateTeamDropdown(selectedProjectName);
    });

    const teamSelect = document.getElementById("modal-team");
    teamSelect.addEventListener("change", async () => {
      const selectedTeamId = teamSelect.value;
      const farmersInput = document.getElementById("modal-farmers");
      const farmPresidentInput = document.getElementById("modal-farm-president");

      if (selectedTeamId === "") {
        farmersInput.value = "";
        farmPresidentInput.value = "";
      } else {
        const selectedTeam = teams.find(t => t.team_id === selectedTeamId);
        if (selectedTeam) {
          const farmerNameArray = selectedTeam.farmer_name || [];
          const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
          farmersInput.value = farmerNames.join("\n");
          farmPresidentInput.value = selectedTeam.lead_farmer || "N/A";
        }
      }
    });
  } catch (error) {
    console.error("Error fetching projects and teams:", error);
  }
}

function updateTeamDropdown(selectedProjectName) {
  const teamSelect = document.getElementById("modal-team");
  const farmersInput = document.getElementById("modal-farmers");
  const farmPresidentInput = document.getElementById("modal-farm-president");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  if (selectedProjectName === "") {
    teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
    farmersInput.value = "";
    farmPresidentInput.value = "";
    submitHarvestBtn.disabled = true;
  } else {
    const selectedProject = projects.find(p => p.project_name === selectedProjectName);
    const teamId = selectedProject ? selectedProject.team_id || "" : "";
    console.log("Selected project team_id:", teamId);

    teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
    if (teamId) {
      const teamIdStr = String(teamId);
      const matchingTeam = teams.find(team => String(team.team_id) === teamIdStr);
      if (matchingTeam) {
        const option = document.createElement("option");
        option.value = matchingTeam.team_id;
        option.textContent = matchingTeam.team_name;
        teamSelect.appendChild(option);
        teamSelect.value = matchingTeam.team_id;
        console.log("Team dropdown set to:", { team_id: matchingTeam.team_id, team_name: matchingTeam.team_name });

        const farmerNameArray = matchingTeam.farmer_name || [];
        const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
        farmersInput.value = farmerNames.join("\n");
        farmPresidentInput.value = matchingTeam.lead_farmer || "N/A";
        submitHarvestBtn.disabled = false;
      } else {
        console.log("No matching team found in teams array for team_id:", teamId);
        const teamQuery = query(collection(db, "tb_teams"), where("team_id", "==", teamId));
        getDocs(teamQuery).then(teamSnapshot => {
          if (teamSnapshot.empty) {
            console.log("Team not found in tb_teams for team_id:", teamId);
            showSuccessMessage("The selected project's team does not exist. Please update the project.", false);
            submitHarvestBtn.disabled = true;
          } else {
            const teamData = teamSnapshot.docs[0].data();
            const option = document.createElement("option");
            option.value = teamData.team_id;
            option.textContent = teamData.team_name;
            teamSelect.appendChild(option);
            teamSelect.value = teamData.team_id;

            const farmerNameArray = teamData.farmer_name || [];
            const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
            farmersInput.value = farmerNames.join("\n");
            farmPresidentInput.value = teamData.lead_farmer || "N/A";
            submitHarvestBtn.disabled = false;
          }
        }).catch(error => {
          console.error("Error querying tb_teams:", error);
          showSuccessMessage("Error loading team data.", false);
          submitHarvestBtn.disabled = true;
        });
      }
    } else {
      farmersInput.value = "";
      farmPresidentInput.value = "";
      submitHarvestBtn.disabled = true;
    }
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
    const teamId = document.getElementById("modal-team").value;
    const totalHarvest = document.getElementById("modal-total-harvest").value;
    const unit = document.getElementById("modal-unit").value;
    const farmPresident = document.getElementById("modal-farm-president").value;
    const farmerNamesInput = document.getElementById("modal-farmers").value.split("\n").filter(farmer => farmer.trim() !== "");

    console.log("Modal inputs:", { projectName, teamId, totalHarvest, unit, farmPresident, farmerNamesInput });

    if (!projectName || !teamId || !totalHarvest || !farmPresident) {
      await showSuccessMessage("Please fill in all required fields", false);
      throw new Error("Missing required fields");
    }

    const teamIdStr = String(teamId);
    let selectedTeam = teams.find(t => String(t.team_id) === teamIdStr);
    if (!selectedTeam) {
      console.log("Team not found in teams array, querying tb_teams directly for team_id:", teamId);
      const teamQuery = query(collection(db, "tb_teams"), where("team_id", "==", teamId));
      const teamSnapshot = await getDocs(teamQuery);
      if (teamSnapshot.empty) {
        await showSuccessMessage("Selected team not found.", false);
        throw new Error("Team not found");
      }
      selectedTeam = teamSnapshot.docs[0].data();
    }
    console.log("Selected team:", selectedTeam);

    const farmerNameArray = selectedTeam.farmer_name || [];
    const farmerNameData = farmerNameArray.filter(farmer => 
      farmerNamesInput.includes(farmer.farmer_name)
    );

    const selectedProject = projects.find(p => p.project_name === projectName);
    if (!selectedProject) {
      await showSuccessMessage("Selected project not found.", false);
      throw new Error("Selected project not found");
    }

    const currentUserFarmerId = authenticatedUser.farmerId;
    console.log("Current user farmerId:", currentUserFarmerId);

    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");

    if (!isEditing) {
      const projectId = selectedProject.project_id || selectedProject.id;
      console.log("Checking for duplicates with project_id:", projectId);

      const projectHarvestQuery = query(
        harvestCollection,
        where("project_id", "==", projectId)
      );
      const projectHarvestSnapshot = await getDocs(projectHarvestQuery);
      console.log("Found", projectHarvestSnapshot.size, "documents with matching project_id");

      if (!projectHarvestSnapshot.empty) {
        for (const doc of projectHarvestSnapshot.docs) {
          const harvestData = doc.data();
          console.log("Checking document:", {
            id: doc.id,
            project_id: harvestData.project_id,
            lead_farmer_id: harvestData.lead_farmer_id,
            team_id: harvestData.team_id
          });

          if (String(harvestData.lead_farmer_id) === String(currentUserFarmerId) && 
              String(harvestData.team_id) === teamIdStr) {
            console.log("Duplicate found:", doc.id);
            await showSuccessMessage("Harvest report already exists for the team of this project", false);
            throw new Error("Duplicate harvest report for this team and project");
          }
        }
        console.log("No duplicates found after checking lead_farmer_id and team_id");
      } else {
        console.log("No existing harvest records found for this project_id");
      }
    }

    if (isEditing && currentHarvestDocId) {
      const existingHarvestQuery = query(
        harvestCollection,
        where("project_id", "==", selectedProject.project_id || selectedProject.id),
        where("team_id", "==", teamId),
        where("lead_farmer_id", "==", selectedProject.lead_farmer_id),
        where("farm_pres_id", "==", selectedProject.farmer_id || "N/A")
      );
      const existingHarvestSnapshot = await getDocs(existingHarvestQuery);
      if (!existingHarvestSnapshot.empty) {
        const existingDocId = existingHarvestSnapshot.docs[0].id;
        if (existingDocId !== currentHarvestDocId) {
          await showSuccessMessage("Another harvest report already exists for this project and team.", false);
          throw new Error("Duplicate harvest report");
        }
      }
    }

    let landArea = "N/A";
    if (selectedProject.farmland_id) {
      const farmlandQuery = query(collection(db, "tb_farmland"), where("farmland_id", "==", selectedProject.farmland_id));
      const farmlandSnapshot = await getDocs(farmlandQuery);
      if (!farmlandSnapshot.empty) {
        landArea = farmlandSnapshot.docs[0].data().land_area || "N/A";
      }
    }

    const harvestDate = new Date();
    const harvestData = {
      project_id: selectedProject.project_id || selectedProject.id || "N/A",
      project_name: projectName,
      project_creator: selectedProject.project_creator || "N/A",
      crop_name: selectedProject.crop_name || "N/A",
      crop_type_name: selectedProject.crop_type_name || "N/A",
      barangay_name: selectedProject.barangay_name || "N/A",
      team_id: teamId,
      team_name: selectedTeam.team_name,
      total_harvested_crops: parseFloat(totalHarvest),
      unit: unit,
      farm_president: selectedProject.farm_president,
      farmer_name: farmerNameData,
      lead_farmer: selectedTeam.lead_farmer || "N/A",
      lead_farmer_id: selectedProject.lead_farmer_id || "N/A",
      harvest_date: harvestDate,
      dateAdded: new Date(),
      farmland_id: selectedProject.farmland_id || "N/A",
      land_area: landArea,
      start_date: selectedProject.start_date || "N/A",
      end_date: selectedProject.end_date || "N/A",
      farm_pres_id: selectedProject.farmer_id || "N/A"
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
    document.querySelector("#harvest-report-modal .modal-header h2").textContent = "Add Harvest";
    document.getElementById("submit-harvest-btn").textContent = "Save";
    resetModalFields();

  } catch (error) {
    console.error("Error saving harvest:", error);
    throw error;
  }
}

async function fetchHarvest() {
  try {
    const { user } = authenticatedUser;
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
      sortHarvestByDate();
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
    const totalHarvestKg = harvest.total_harvested_crops || 0;
    const totalHarvestMt = (totalHarvestKg / 1000).toFixed(3);
    const unit = "Mt";

    row.innerHTML = `
      <td>${projectName}</td>
      <td>${harvestDate}</td>
      <td>${leadFarmer}</td>
      <td>${barangayName}</td>
      <td>${cropName}</td>
      <td>${cropTypeName}</td>
      <td>${totalHarvestMt} ${unit}</td>
      <td>
        <button class="action-btn view-btn" data-id="${harvestId}" title="View">
          <img src="../../images/editBig.png" alt="View">
        </button>
      </td>
    `;
    tableBody.appendChild(row);

    const viewBtn = row.querySelector(".view-btn");
    viewBtn.addEventListener("click", async () => {
      await openModal(true, harvestId);
    });
  });
  updatePagination();
}

async function openModal(isViewOrEdit = false, harvestId = null) {
  const modal = document.getElementById("harvest-report-modal");
  const modalHeader = document.querySelector("#harvest-report-modal .modal-header h2");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");

  if (isViewOrEdit && harvestId) {
    const currentUserFarmerId = authenticatedUser.farmerId;
    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");
    const harvestQuery = query(harvestCollection, where("harvest_id", "==", parseInt(harvestId)));
    const harvestSnapshot = await getDocs(harvestQuery);

    if (!harvestSnapshot.empty) {
      const harvestData = harvestSnapshot.docs[0].data();
      if (harvestData.lead_farmer_id !== currentUserFarmerId) {
        await showSuccessMessage("You are not authorized to edit this Harvest Record", false);
        return;
      }
    }

    await populateHarvestData(harvestId);
    modalHeader.textContent = "Edit Harvest";
    submitHarvestBtn.textContent = "Update";
    isEditing = true;
  } else {
    resetModalFields();
    modalHeader.textContent = "Add Harvest";
    submitHarvestBtn.textContent = "Save";
    isEditing = false;
  }

  modal.classList.add("active");
}

async function populateHarvestData(harvestId) {
  try {
    const harvestQuery = query(
      collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest"),
      where("harvest_id", "==", parseInt(harvestId))
    );
    const harvestSnapshot = await getDocs(harvestQuery);

    if (harvestSnapshot.empty) {
      console.error(`No harvest found with harvest_id: ${harvestId}`);
      await showSuccessMessage("Harvest record not found.", false);
      return;
    }

    const harvestData = harvestSnapshot.docs[0].data();
    currentHarvestDocId = harvestSnapshot.docs[0].id;

    const projectSelect = document.getElementById("modal-project-name");
    projectSelect.value = harvestData.project_name || "";
    console.log("Project set to:", projectSelect.value);

    const teamSelect = document.getElementById("modal-team");
    teamSelect.innerHTML = '<option value="" selected>Select Team</option>';

    const selectedProject = projects.find(p => p.project_name === harvestData.project_name);
    if (!selectedProject) {
      console.error("Selected project not found in projects array:", harvestData.project_name);
      await showSuccessMessage("Project data not found for this harvest.", false);
      return;
    }

    const projectTeamId = selectedProject.team_id || "";
    console.log("Project team_id:", projectTeamId, "Harvest team_id:", harvestData.team_id);

    const matchingTeam = teams.find(team => String(team.team_id) === String(harvestData.team_id));
    if (matchingTeam) {
      const option = document.createElement("option");
      option.value = matchingTeam.team_id;
      option.textContent = matchingTeam.team_name;
      teamSelect.appendChild(option);
      teamSelect.value = matchingTeam.team_id;
      console.log("Team set to:", { id: matchingTeam.team_id, name: matchingTeam.team_name });
    } else {
      console.error("No matching team found for team_id:", harvestData.team_id);
      await showSuccessMessage("Team data not found for this harvest.", false);
    }

    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops || "N/A";
    document.getElementById("modal-unit").value = harvestData.unit || "Kg";
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";

    const farmerNameArray = harvestData.farmer_name || [];
    const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
    document.getElementById("modal-farmers").value = farmerNames.join("\n") || "N/A";

    document.getElementById("modal-crop-name") && 
      (document.getElementById("modal-crop-name").value = harvestData.crop_name || "N/A");
    document.getElementById("modal-crop-type-name") && 
      (document.getElementById("modal-crop-type-name").value = harvestData.crop_type_name || "N/A");
    document.getElementById("modal-barangay-name") && 
      (document.getElementById("modal-barangay-name").value = harvestData.barangay_name || "N/A");

  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    await showSuccessMessage("Error loading harvest report.", false);
  }
}

function resetModalFields() {
  const projectSelect = document.getElementById("modal-project-name");
  const teamSelect = document.getElementById("modal-team");
  projectSelect.value = "";
  teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
  document.getElementById("modal-total-harvest").value = "";
  document.getElementById("modal-unit").value = "Kg";
  document.getElementById("modal-farm-president").value = "";
  document.getElementById("modal-farmers").value = "";
  document.getElementById("modal-crop-name") && (document.getElementById("modal-crop-name").value = "");
  document.getElementById("modal-crop-type-name") && (document.getElementById("modal-crop-type-name").value = "");
  document.getElementById("modal-barangay-name") && (document.getElementById("modal-barangay-name").value = "");
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