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
let harvestDocs = [];
let authData = null;

function sortHarvestByDate() {
  filteredHarvest.sort((a, b) => {
    const dateA = parseDate(a.harvest_date);
    const dateB = parseDate(b.harvest_date);
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

async function initializeAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const farmerQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
          const farmerSnapshot = await getDocs(farmerQuery);
          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            authData = {
              user,
              farmerId: farmerData.farmer_id,
              userType: farmerData.user_type
            };
            console.log("Initialized auth data:", authData);
            resolve(authData);
          } else {
            console.error("Farmer record not found in tb_farmers collection.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        authData = null;
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    }, (error) => {
      console.error("Auth state listener error:", error);
      reject(error);
    });
  });
}

async function getAuthData() {
  if (!authData) {
    await initializeAuth();
  }
  if (!authData) {
    throw new Error("Authentication data not available.");
  }
  return authData;
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

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("harvest-report-modal");
  const modalHeader = document.querySelector("#harvest-report-modal .modal-header h2");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const viewCloseBtn = document.getElementById("view-close-btn");
  const addHarvestBtn = document.getElementById("add-harvest");
  const saveHarvestBtn = document.getElementById("save-harvest-btn");
  const updateHarvestBtn = document.getElementById("update-harvest-btn");
  const submitHarvestBtn = document.getElementById("submit-harvest-btn");
  const submitHarvestModalBtn = document.getElementById("submit-harvest-modal-btn");

  try {
    await getAuthData();
    await fetchProjectsAndTeams();
    await fetchHarvestDocsForSubmit();
    fetchHarvest();
  } catch (error) {
    console.error("Initialization failed:", error);
    await showSuccessMessage("Failed to initialize application. Please log in again.", false);
    return;
  }

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest";
    saveHarvestBtn.style.display = "block";
    updateHarvestBtn.style.display = "none";
    resetModalFields();
    enableFormFields();
  });

  closeHarvestBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    isEditing = false;
    modalHeader.textContent = "Add Harvest";
    saveHarvestBtn.style.display = "block";
    updateHarvestBtn.style.display = "none";
    resetModalFields();
    enableFormFields();
  });

  viewCloseBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    enableFormFields();
  });

  if (addHarvestBtn) {
    addHarvestBtn.addEventListener("click", () => {
      openModal(false);
    });
  }

  let isSaving = false;

  saveHarvestBtn.addEventListener("click", async () => {
    if (isSaving) return; // Prevent multiple clicks
    isSaving = true;
    saveHarvestBtn.disabled = true;
    closeHarvestBtn.disabled = true;
    closeBtn.disabled = true;

    try {
      await addHarvest();
      await fetchProjectsAndTeams();
      await fetchHarvestDocsForSubmit();
    } catch (error) {
      console.error("Add failed:", error);
    } finally {
      isSaving = false;
      saveHarvestBtn.disabled = false;
      closeHarvestBtn.disabled = false;
      closeBtn.disabled = false;
    }
  });

  updateHarvestBtn.addEventListener("click", async () => {
    if (isSaving) return; // Prevent multiple clicks
    isSaving = true;
    updateHarvestBtn.disabled = true;
    closeHarvestBtn.disabled = true;
    closeBtn.disabled = true;

    try {
      await updateHarvest();
      await fetchProjectsAndTeams();
      await fetchHarvestDocsForSubmit();
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      isSaving = false;
      updateHarvestBtn.disabled = false;
      closeHarvestBtn.disabled = false;
      closeBtn.disabled = false;
    }
  });

  submitHarvestBtn.addEventListener("click", () => {
    openModal(false, null, false, true);
  });

  submitHarvestModalBtn.addEventListener("click", async () => {
    if (isSaving) return; // Prevent multiple clicks
    isSaving = true;
    submitHarvestModalBtn.disabled = true;
    closeHarvestBtn.disabled = true; // Disable cancel button during submission
    closeBtn.disabled = true;

    try {
      await submitHarvestToTbHarvest();
      await fetchProjectsAndTeams();
      await fetchHarvestDocsForSubmit();
    } catch (error) {
      console.error("Submit failed:", error);
    } finally {
      isSaving = false;
      submitHarvestModalBtn.disabled = false;
      closeHarvestBtn.disabled = false; // Re-enable cancel button after completion
      closeBtn.disabled = false;
    }
  });

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
    const { farmerId } = await getAuthData();

    // Query tb_project_history instead of tb_projects
    const projectQuery = query(
      collection(db, "tb_project_history"),
      where("farmer_id", "==", farmerId),
      where("status", "in", ["Complete", "Completed"])
    );

    onSnapshot(projectQuery, (projectSnapshot) => {
      projects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateProjectDropdown();
    }, (error) => {
      console.error("Error listening to project history:", error);
    });

    const teamCollection = collection(db, "tb_teams");
    const teamSnapshot = await getDocs(teamCollection);
    teams = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching projects and teams:", error);
  }
}

function updateProjectDropdown() {
  const projectSelect = document.getElementById("modal-project-name");
  const currentValue = projectSelect.value;
  projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
  projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.project_name;
    option.textContent = project.project_name;
    option.dataset.teamId = project.team_id || "";
    projectSelect.appendChild(option);
  });
  if (currentValue && projects.some(p => p.project_name === currentValue)) {
    projectSelect.value = currentValue;
  }
}

async function fetchHarvestDocsForSubmit() {
  try {
    const { farmerId } = await getAuthData();
    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");
    const harvestQuery = query(harvestCollection, where("farm_pres_id", "==", farmerId));

    onSnapshot(harvestQuery, (harvestSnapshot) => {
      harvestDocs = harvestSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, (error) => {
      console.error("Error listening to harvest docs:", error);
    });
  } catch (error) {
    console.error("Error fetching harvest docs for submit:", error);
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

async function addHarvest() {
  try {
    const projectName = document.getElementById("modal-project-name").value;
    const teamName = document.getElementById("modal-team").value;
    const totalHarvest = document.getElementById("modal-total-harvest").value;
    const unit = document.getElementById("modal-unit").value;
    const farmPresident = document.getElementById("modal-farm-president").value;
    const farmerNamesInput = document.getElementById("modal-farmers").value.split("\n").filter(farmer => farmer.trim() !== "");

    if (!totalHarvest || isNaN(totalHarvest) || parseFloat(totalHarvest) < 0) {
      await showSuccessMessage("Please enter a valid quantity for the total harvest", false);
      throw new Error("Invalid total harvest value");
    }

    if (!projectName || !teamName || !farmPresident) {
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

    if (selectedProject.status !== "Complete" && selectedProject.status !== "Completed") {
      await showSuccessMessage("Only projects with 'Complete' or 'Completed' status can be selected.", false);
      throw new Error("Invalid project status");
    }

    const teamId = selectedProject.team_id || "";
    const projectId = selectedProject.project_id || selectedProject.id || "N/A";
    const { farmerId } = await getAuthData();
    const projectLeadFarmerId = selectedProject.lead_farmer_id || "N/A";

    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");

    const farmPresDuplicateQuery = query(
      harvestCollection,
      where("lead_farmer_id", "==", farmerId),
      where("team_id", "==", teamId),
      where("project_id", "==", projectId)
    );
    const farmPresDuplicateSnapshot = await getDocs(farmPresDuplicateQuery);

    if (!farmPresDuplicateSnapshot.empty) {
      await showSuccessMessage("You have already created a harvest report as the lead farmer for this team in this project.", false);
      throw new Error("Duplicate harvest detected for farm president as lead farmer");
    }

    const leadFarmerDuplicateQuery = query(
      harvestCollection,
      where("lead_farmer_id", "==", projectLeadFarmerId),
      where("project_id", "==", projectId)
    );
    const leadFarmerDuplicateSnapshot = await getDocs(leadFarmerDuplicateQuery);

    if (!leadFarmerDuplicateSnapshot.empty) {
      const leadFarmerName = selectedTeam.lead_farmer || "Unknown Lead Farmer";
      await showSuccessMessage(
        `A Harvest Report already exists for the Selected Team of Lead Farmer ${leadFarmerName}`,
        false
      );
      throw new Error("Duplicate harvest detected");
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
      project_id: projectId,
      project_name: projectName,
      project_creator: selectedProject.project_creator || "N/A", // Already present, ensuring it's included
      crop_name: selectedProject.crop_name || "N/A",
      crop_type_name: selectedProject.crop_type_name || "N/A",
      barangay_name: selectedProject.barangay_name || "N/A",
      team_name: teamName,
      team_id: teamId,
      total_harvested_crops: parseFloat(totalHarvest),
      unit: unit,
      farm_president: selectedProject.farm_president,
      farmer_name: farmerNameData,
      lead_farmer: selectedTeam.lead_farmer || "N/A",
      farm_pres_id: farmerId,
      lead_farmer_id: projectLeadFarmerId,
      harvest_date: harvestDate,
      dateAdded: new Date(),
      farmland_id: selectedProject.farmland_id || "N/A",
      land_area: landArea,
      start_date: selectedProject.start_date || "N/A",
      end_date: selectedProject.end_date || "N/A",
      project_status: selectedProject.status
    };

    const newHarvestId = await getNextHarvestId();
    harvestData.harvest_id = newHarvestId;
    await addDoc(harvestCollection, harvestData);
    await showSuccessMessage("Harvest Report has been successfully created!");

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.remove("active");
    isEditing = false;
    document.getElementById("save-harvest-btn").style.display = "block";
    document.getElementById("update-harvest-btn").style.display = "none";
    resetModalFields();
    enableFormFields();

  } catch (error) {
    console.error("Error adding harvest:", error);
    throw error;
  }
}

async function updateHarvest() {
  try {
    const projectName = document.getElementById("modal-project-name").value;
    const teamName = document.getElementById("modal-team").value;
    const totalHarvest = document.getElementById("modal-total-harvest").value;
    const unit = document.getElementById("modal-unit").value;
    const farmPresident = document.getElementById("modal-farm-president").value;
    const farmerNamesInput = document.getElementById("modal-farmers").value.split("\n").filter(farmer => farmer.trim() !== "");

    if (!totalHarvest || isNaN(totalHarvest) || parseFloat(totalHarvest) < 0) {
      await showSuccessMessage("Please enter a valid positive number for total harvest", false);
      throw new Error("Invalid total harvest value");
    }

    if (!projectName || !teamName || !farmPresident) {
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

    // Add status validation for editing
    if (selectedProject.status !== "Complete" && selectedProject.status !== "Completed") {
      await showSuccessMessage("Only projects with 'Complete' or 'Completed' status can be selected.", false);
      throw new Error("Invalid project status");
    }

    const teamId = selectedProject.team_id || "";
    const projectId = selectedProject.project_id || selectedProject.id || "N/A";
    const { farmerId } = await getAuthData();
    const projectLeadFarmerId = selectedProject.lead_farmer_id || "N/A";

    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");

    const originalDocRef = doc(harvestCollection, currentHarvestDocId);
    const originalDocSnapshot = await getDoc(originalDocRef);
    if (!originalDocSnapshot.exists()) {
      await showSuccessMessage("Original harvest record not found.", false);
      throw new Error("Original harvest record not found");
    }

    const originalData = originalDocSnapshot.data();
    const originalTeamId = originalData.team_id || "";

    if (teamId !== originalTeamId && teamId !== "") {
      const farmPresDuplicateQuery = query(
        harvestCollection,
        where("lead_farmer_id", "==", farmerId),
        where("team_id", "==", teamId),
        where("project_id", "==", projectId)
      );
      const farmPresDuplicateSnapshot = await getDocs(farmPresDuplicateQuery);

      if (!farmPresDuplicateSnapshot.empty) {
        const isSameDoc = farmPresDuplicateSnapshot.docs.some(doc => doc.id === currentHarvestDocId);
        if (!isSameDoc) {
          await showSuccessMessage("You have already created a harvest report as the lead farmer for this team in this project.", false);
          throw new Error("Duplicate harvest detected for farm president as lead farmer");
        }
      }

      const leadFarmerDuplicateQuery = query(
        harvestCollection,
        where("lead_farmer_id", "==", projectLeadFarmerId),
        where("project_id", "==", projectId)
      );
      const leadFarmerDuplicateSnapshot = await getDocs(leadFarmerDuplicateQuery);

      if (!leadFarmerDuplicateSnapshot.empty) {
        const isSameDoc = leadFarmerDuplicateSnapshot.docs.some(doc => doc.id === currentHarvestDocId);
        if (!isSameDoc) {
          const leadFarmerName = selectedTeam.lead_farmer || "Unknown Lead Farmer";
          await showSuccessMessage(
            `Lead Farmer ${leadFarmerName} already made a Harvest Report for this project`,
            false
          );
          throw new Error("Duplicate harvest detected for head farmer");
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
      project_id: projectId,
      project_name: projectName,
      project_creator: selectedProject.project_creator || "N/A",
      crop_name: selectedProject.crop_name || "N/A",
      crop_type_name: selectedProject.crop_type_name || "N/A",
      barangay_name: selectedProject.barangay_name || "N/A",
      team_name: teamName,
      team_id: teamId,
      total_harvested_crops: parseFloat(totalHarvest),
      unit: unit,
      farm_president: selectedProject.farm_president,
      farmer_name: farmerNameData,
      lead_farmer: selectedTeam.lead_farmer || "N/A",
      farm_pres_id: farmerId,
      lead_farmer_id: projectLeadFarmerId,
      harvest_date: harvestDate,
      dateAdded: new Date(),
      farmland_id: selectedProject.farmland_id || "N/A",
      land_area: landArea,
      start_date: selectedProject.start_date || "N/A",
      end_date: selectedProject.end_date || "N/A",
      project_status: selectedProject.status // Added project status to harvest data
    };

    await setDoc(doc(harvestCollection, currentHarvestDocId), harvestData, { merge: true });
    await showSuccessMessage("Harvest Report updated successfully!");

    const modal = document.getElementById("harvest-report-modal");
    modal.classList.remove("active");
    isEditing = false;
    document.getElementById("save-harvest-btn").style.display = "block";
    document.getElementById("update-harvest-btn").style.display = "none";
    resetModalFields();
    enableFormFields();

  } catch (error) {
    console.error("Error updating harvest:", error);
    throw error;
  }
}

async function submitHarvestToTbHarvest() {
  let validatedHarvestRef = null;
  try {
    const projectName = document.getElementById("modal-project-name").value;
    const teamName = document.getElementById("modal-team").value;

    if (!projectName || !teamName) {
      await showSuccessMessage("Please select a project and team to submit.", false);
      return;
    }

    const matchingHarvest = harvestDocs.find(h => h.project_name === projectName && h.team_name === teamName);
    if (!matchingHarvest) {
      await showSuccessMessage("No harvest report found for the selected project and team.", false);
      return;
    }

    const harvestData = matchingHarvest;
    currentHarvestDocId = harvestData.id;

    const collectionsToCheck = [
      collection(db, "tb_harvest"),
      collection(db, "tb_validatedharvest")
    ];

    for (const coll of collectionsToCheck) {
      const duplicateQuery = query(
        coll,
        where("farm_pres_id", "==", harvestData.farm_pres_id || "N/A"),
        where("project_id", "==", harvestData.project_id || "N/A"),
        where("lead_farmer_id", "==", harvestData.lead_farmer_id || "N/A"),
        where("team_id", "==", harvestData.team_id || "N/A")
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);

      if (!duplicateSnapshot.empty) {
        const isSameDoc = duplicateSnapshot.docs.some(doc => doc.id === currentHarvestDocId);
        if (!isSameDoc) {
          showConfirmationPopup(harvestData);
          return;
        }
      }
    }

    const validatedHarvestCollection = collection(db, "tb_validatedharvest");
    const validatedHarvestData = {
      project_id: harvestData.project_id || "N/A",
      project_name: harvestData.project_name || "N/A",
      project_creator: harvestData.project_creator || "N/A", // Added project_creator here
      farm_pres_id: harvestData.farm_pres_id || "N/A",
      lead_farmer_id: harvestData.lead_farmer_id || "N/A",
      team_id: harvestData.team_id || "N/A",
      total_harvested_crops: harvestData.total_harvested_crops || 0,
      harvest_date: harvestData.harvest_date || new Date(),
      crop_type_name: harvestData.crop_type_name || "N/A",
      crop_name: harvestData.crop_name || "N/A",
      harvest_id: harvestData.harvest_id,
      validated_date: new Date()
    };

    validatedHarvestRef = await addDoc(validatedHarvestCollection, validatedHarvestData);
    const validatedDocSnapshot = await getDoc(validatedHarvestRef);
    if (!validatedDocSnapshot.exists()) {
      await showSuccessMessage("Failed to submit validated harvest data.", false);
      throw new Error("Validated harvest document not found after submission");
    }

    const tbHarvestCollection = collection(db, "tb_harvest");
    const newHarvestRef = await addDoc(tbHarvestCollection, {
      ...harvestData,
      submitted_date: new Date(),
      original_doc_id: currentHarvestDocId
    });

    const newDocSnapshot = await getDoc(newHarvestRef);
    if (!newDocSnapshot.exists()) {
      await showSuccessMessage("Failed to submit harvest: Could not verify new document.", false);
      throw new Error("New document not found after submission");
    }

    const originalDocRef = doc(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest", currentHarvestDocId);
    await deleteDoc(originalDocRef);

    await showSuccessMessage("Harvest Report successfully submitted and validated!");
    const modal = document.getElementById("harvest-report-modal");
    modal.classList.remove("active");
    enableFormFields();
    await fetchHarvest();

  } catch (error) {
    console.error("Error submitting harvest:", error);
    if (validatedHarvestRef) {
      try {
        await deleteDoc(validatedHarvestRef);
        console.log(`Rolled back: Deleted document ${validatedHarvestRef.id} from tb_validatedharvest due to error`);
        await showSuccessMessage("Submission failed, rolled back validated data.", false);
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
        await showSuccessMessage("Submission failed and rollback unsuccessful. Please contact support.", false);
      }
    } else {
      await showSuccessMessage(`Error submitting harvest: ${error.message}`, false);
    }
  }
}

function showConfirmationPopup(harvestData) {
  const confirmationPanel = document.getElementById("confirmation-panel");
  const message = confirmationPanel.querySelector("p");
  const cancelBtn = document.getElementById("cancel-delete");
  const confirmBtn = document.getElementById("confirm-delete");

  message.textContent = `A harvest report for this team in this project already exists, please proceed to delete this duplicate harvest record`;
  confirmationPanel.style.display = "flex";

  cancelBtn.onclick = async () => {
    confirmationPanel.style.display = "none";
    markRowAsDuplicate(harvestData.id);
    const modal = document.getElementById("harvest-report-modal");
    modal.classList.remove("active");
  };

  confirmBtn.onclick = async () => {
    try {
      const originalDocRef = doc(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest", currentHarvestDocId);
      await deleteDoc(originalDocRef);

      // Close both the confirmation panel and the modal
      confirmationPanel.style.display = "none";
      const modal = document.getElementById("harvest-report-modal");
      modal.classList.remove("active");

      // Show success message
      await showSuccessMessage("Duplicate Harvest successfully deleted!");
      
      // Refresh the harvest list
      await fetchHarvest();
    } catch (error) {
      console.error("Error deleting duplicate harvest:", error);
      await showSuccessMessage("Failed to delete duplicate harvest.", false);
    }
  };
}

function markRowAsDuplicate(docId) {
  const row = document.querySelector(`tr[data-doc-id="${docId}"]`);
  if (row) {
    row.classList.add("duplicate-row");
  } else {
    const harvestIndex = harvestList.findIndex(h => h.id === docId);
    if (harvestIndex !== -1) {
      harvestList[harvestIndex].isDuplicate = true;
      displayHarvest(filteredHarvest);
    }
  }
}

async function fetchHarvest() {
  try {
    const { farmerId } = await getAuthData();
    
    const harvestCollection = collection(db, "tb_harvest", "headfarmer_harvest_data", "tb_headfarmer_harvest");
    const harvestQuery = query(
      harvestCollection,
      where("farm_pres_id", "==", farmerId)
    );

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
    row.setAttribute("data-doc-id", harvest.id);
    if (harvest.isDuplicate) row.classList.add("duplicate-row");

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
        <button class="action-btn edit-btn" data-id="${harvestId}" title="Edit">
          <img src="../../images/editBig.png" alt="Edit">
        </button>
        <button class="action-btn view-btn" data-id="${harvestId}" title="View">
          <img src="../../images/Eye.png" alt="View">
        </button>
      </td>
    `;
    tableBody.appendChild(row);

    const editBtn = row.querySelector(".edit-btn");
    const viewBtn = row.querySelector(".view-btn");
    
    editBtn.addEventListener("click", async () => {
      await openModal(true, harvestId);
    });
    
    viewBtn.addEventListener("click", async () => {
      await openModal(true, harvestId, true);
    });
  });
  updatePagination();
}

async function openModal(isViewOrEdit = false, harvestId = null, isViewOnly = false, isSubmitMode = false) {
  const modal = document.getElementById("harvest-report-modal");
  const modalHeader = document.querySelector("#harvest-report-modal .modal-header h2");
  const saveHarvestBtn = document.getElementById("save-harvest-btn");
  const updateHarvestBtn = document.getElementById("update-harvest-btn");
  const submitHarvestModalBtn = document.getElementById("submit-harvest-modal-btn");
  const closeHarvestBtn = document.getElementById("close-harvest-btn");
  const viewCloseBtn = document.getElementById("view-close-btn");

  const projectSelect = document.getElementById("modal-project-name");
  const teamSelect = document.getElementById("modal-team");
  const newProjectSelect = projectSelect.cloneNode(true);
  const newTeamSelect = teamSelect.cloneNode(true);
  projectSelect.parentNode.replaceChild(newProjectSelect, projectSelect);
  teamSelect.parentNode.replaceChild(newTeamSelect, teamSelect);

  let previousProject = "";

  // Set up the modal content first
  if (isViewOrEdit && harvestId) {
    await populateHarvestData(harvestId);
    previousProject = document.getElementById("modal-project-name").value;
    if (isViewOnly) {
      modalHeader.textContent = "View Harvest";
      saveHarvestBtn.style.display = "none";
      updateHarvestBtn.style.display = "none";
      submitHarvestModalBtn.style.display = "none";
      closeHarvestBtn.style.display = "none";
      viewCloseBtn.style.display = "block";
      disableFormFields();
    } else {
      modalHeader.textContent = "Edit Harvest";
      saveHarvestBtn.style.display = "none";
      updateHarvestBtn.style.display = "block";
      submitHarvestModalBtn.style.display = "none";
      closeHarvestBtn.style.display = "block";
      viewCloseBtn.style.display = "none";
      enableFormFields();
      newProjectSelect.addEventListener("change", (e) => {
        const selectedProjectName = e.target.value;
        if (previousProject && previousProject !== selectedProjectName) {
          resetNonEditableFields();
          newTeamSelect.innerHTML = '<option value="" selected>Select Team</option>';
        }
        previousProject = selectedProjectName;
        if (selectedProjectName) {
          const selectedProject = projects.find(p => p.project_name === selectedProjectName);
          const teamId = selectedProject ? selectedProject.team_id || "" : "";
          const matchingTeam = teams.find(team => team.team_id === teamId);
          if (matchingTeam) {
            const option = document.createElement("option");
            option.value = matchingTeam.team_name;
            option.textContent = matchingTeam.team_name;
            newTeamSelect.appendChild(option);
          }
        }
      });

      newTeamSelect.addEventListener("change", () => {
        const selectedTeamName = newTeamSelect.value;
        if (selectedTeamName) {
          const selectedTeam = teams.find(t => t.team_name === selectedTeamName);
          if (selectedTeam) {
            const farmerNames = selectedTeam.farmer_name?.map(f => f.farmer_name || "") || [];
            document.getElementById("modal-farmers").value = farmerNames.join("\n") || "";
            document.getElementById("modal-farm-president").value = selectedTeam.lead_farmer || "";
          }
        } else {
          resetNonEditableFields();
        }
      });
    }
  } else if (isSubmitMode) {
    modalHeader.textContent = "Harvest Report";
    saveHarvestBtn.style.display = "none";
    updateHarvestBtn.style.display = "none";
    submitHarvestModalBtn.style.display = "block";
    closeHarvestBtn.style.display = "block";
    viewCloseBtn.style.display = "none";
    resetModalFields();
    populateSubmitModeDropdowns();
    disableNonEditableFieldsForSubmit();

    newProjectSelect.addEventListener("change", async (e) => {
      const selectedProjectName = e.target.value;
      if (previousProject && previousProject !== selectedProjectName) {
        resetNonEditableFields();
        newTeamSelect.innerHTML = '<option value="" selected>Select Team</option>';
      }
      previousProject = selectedProjectName;
      await populateTeamsForSubmit(selectedProjectName);
    });

    newTeamSelect.addEventListener("change", async () => {
      const selectedTeamName = newTeamSelect.value;
      if (selectedTeamName) {
        await populateFieldsForSubmit(selectedTeamName);
      } else {
        resetNonEditableFields();
      }
    });
  } else {
    resetModalFields();
    modalHeader.textContent = "Add Harvest";
    saveHarvestBtn.style.display = "block";
    updateHarvestBtn.style.display = "none";
    submitHarvestModalBtn.style.display = "none";
    closeHarvestBtn.style.display = "block";
    viewCloseBtn.style.display = "none";
    enableFormFields();
    populateAddModeDropdowns();

    newProjectSelect.addEventListener("change", (e) => {
      const selectedProjectName = e.target.value;
      if (previousProject && previousProject !== selectedProjectName) {
        resetNonEditableFields();
        newTeamSelect.innerHTML = '<option value="" selected>Select Team</option>';
      }
      previousProject = selectedProjectName;
      if (selectedProjectName) {
        const selectedProject = projects.find(p => p.project_name === selectedProjectName);
        const teamId = selectedProject ? selectedProject.team_id || "" : "";
        const matchingTeam = teams.find(team => team.team_id === teamId);
        if (matchingTeam) {
          const option = document.createElement("option");
          option.value = matchingTeam.team_name;
          option.textContent = matchingTeam.team_name;
          newTeamSelect.appendChild(option);
        }
      }
    });

    newTeamSelect.addEventListener("change", () => {
      const selectedTeamName = newTeamSelect.value;
      if (selectedTeamName) {
        const selectedTeam = teams.find(t => t.team_name === selectedTeamName);
        if (selectedTeam) {
          const farmerNames = selectedTeam.farmer_name?.map(f => f.farmer_name || "") || [];
          document.getElementById("modal-farmers").value = farmerNames.join("\n") || "";
          document.getElementById("modal-farm-president").value = selectedTeam.lead_farmer || "";
        }
      } else {
        resetNonEditableFields();
      }
    });
  }

  // Show the modal first
  modal.classList.add("active");

  // Reset scroll position after the modal is visible and content is loaded
  const modalBody = document.querySelector("#harvest-report-modal .modal-body");
  if (modalBody) {
    // Use setTimeout to ensure the DOM is fully updated
    setTimeout(() => {
      modalBody.scrollTop = 0;
      console.log("Scroll reset to top for modal-body"); // Debugging
    }, 0);
  } else {
    console.warn("Modal body not found; scroll reset skipped.");
  }
}

async function populateHarvestData(harvestId) {
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

    document.getElementById("modal-project-name").value = harvestData.project_name || "";
    
    const teamSelect = document.getElementById("modal-team");
    teamSelect.innerHTML = '<option value="">Select Team</option>';
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

    document.getElementById("modal-total-harvest").value = harvestData.total_harvested_crops?.toString() || "";
    document.getElementById("modal-unit").value = harvestData.unit || "Kg";
    document.getElementById("modal-farm-president").value = harvestData.farm_president || "N/A";
    const farmerNameArray = harvestData.farmer_name || [];
    const farmerNames = farmerNameArray.map(farmer => farmer.farmer_name || "");
    document.getElementById("modal-farmers").value = farmerNames.join("\n") || "N/A";
  } catch (error) {
    console.error("Error fetching harvest data for modal:", error);
    await showSuccessMessage("Error loading harvest report.", false);
  }
}

function populateAddModeDropdowns() {
  const projectSelect = document.getElementById("modal-project-name");
  projectSelect.innerHTML = '<option value="">Select Project</option>';
  projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.project_name;
    option.textContent = project.project_name;
    option.dataset.teamId = project.team_id || "";
    projectSelect.appendChild(option);
  });

  const teamSelect = document.getElementById("modal-team");
  teamSelect.innerHTML = '<option value="">Select Team</option>';
}

function populateSubmitModeDropdowns() {
  const projectSelect = document.getElementById("modal-project-name");
  projectSelect.innerHTML = '<option value="" selected>Select Project</option>';
  const uniqueProjects = [...new Set(harvestDocs.map(h => h.project_name))];
  uniqueProjects.forEach(projectName => {
    const option = document.createElement("option");
    option.value = projectName;
    option.textContent = projectName;
    projectSelect.appendChild(option);
  });

  const teamSelect = document.getElementById("modal-team");
  teamSelect.innerHTML = '<option value="" selected>Select Team</option>';
}

async function populateTeamsForSubmit(projectName) {
  const teamSelect = document.getElementById("modal-team");
  teamSelect.innerHTML = '<option value="" selected>Select Team</option>';

  const matchingHarvests = harvestDocs.filter(h => h.project_name === projectName);
  const uniqueTeams = [...new Set(matchingHarvests.map(h => h.team_name))];
  uniqueTeams.forEach(teamName => {
    const option = document.createElement("option");
    option.value = teamName;
    option.textContent = teamName;
    teamSelect.appendChild(option);
  });
}

async function populateFieldsForSubmit(teamName) {
  const projectName = document.getElementById("modal-project-name").value;
  const harvest = harvestDocs.find(h => h.project_name === projectName && h.team_name === teamName);

  if (harvest) {
    document.getElementById("modal-total-harvest").value = harvest.total_harvested_crops?.toString() || "";
    document.getElementById("modal-unit").value = harvest.unit || "Kg";
    document.getElementById("modal-farm-president").value = harvest.farm_president || "N/A";
    const farmerNames = harvest.farmer_name?.map(f => f.farmer_name || "") || [];
    document.getElementById("modal-farmers").value = farmerNames.join("\n") || "N/A";
    currentHarvestDocId = harvest.id;
  } else {
    resetNonEditableFields();
  }
}

function resetModalFields() {
  const projectSelect = document.getElementById("modal-project-name");
  const teamSelect = document.getElementById("modal-team");
  projectSelect.selectedIndex = 0;
  teamSelect.selectedIndex = 0;
  resetNonEditableFields();
}

function resetNonEditableFields() {
  document.getElementById("modal-total-harvest").value = "";
  document.getElementById("modal-unit").value = "Kg";
  document.getElementById("modal-farm-president").value = "";
  document.getElementById("modal-farmers").value = "";
}

function disableFormFields() {
  const fields = [
    "modal-project-name",
    "modal-team",
    "modal-total-harvest",
    "modal-unit",
    "modal-farm-president",
    "modal-farmers"
  ];
  fields.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = true;
      element.classList.add("disabled-field");
    }
  });
}

function enableFormFields() {
  const fields = [
    "modal-project-name",
    "modal-team",
    "modal-total-harvest",
    "modal-unit",
    "modal-farm-president",
    "modal-farmers"
  ];
  fields.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = false;
      element.classList.remove("disabled-field");
    }
  });
}

function disableNonEditableFieldsForSubmit() {
  const fields = [
    "modal-total-harvest",
    "modal-unit",
    "modal-farm-president",
    "modal-farmers"
  ];
  fields.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = true;
      element.classList.add("disabled-field");
    }
  });
  ["modal-project-name", "modal-team"].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.disabled = false;
      element.classList.remove("disabled-field");
    }
  });
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

  totalHarvestInput.setAttribute("min", "0");
  totalHarvestInput.setAttribute("step", "0.001");
}

document.addEventListener("DOMContentLoaded", () => {
  restrictHarvestInput();
});