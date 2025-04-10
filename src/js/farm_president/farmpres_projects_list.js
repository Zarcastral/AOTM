import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
const auth = getAuth();

const tableBody = document.getElementById("table_body");
const statusSelect = document.getElementById("status_select");
const searchBar = document.getElementById("search-bar");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
const editFormContainer = document.createElement("div");
editFormContainer.id = "edit-form-container";
editFormContainer.style.display = "none";
document.body.appendChild(editFormContainer);

let globalLeadFarmerId = null;

let currentPage = 1;
const rowsPerPage = 5;
let projectList = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is authenticated:", user.email);
    fetch_projects(); // Run this ONLY after authentication is confirmed
  } else {
    console.error("User not authenticated.");
    // Redirect to login page or prompt for sign-in
  }
});

async function fetch_projects(filter = {}) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated.");
      return;
    }

    const farmerDocRef = doc(db, "tb_farmers", user.uid);
    const farmerDocSnap = await getDoc(farmerDocRef);

    if (!farmerDocSnap.exists()) {
      console.error("Farmer document not found.");
      return;
    }

    const farmerData = farmerDocSnap.data();
    const farmerId = sessionStorage.getItem("farmer_id") || "";

    const querySnapshot = await getDocs(collection(db, "tb_projects"));

    projectList = [];
    let projectIdList = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const projectId = String(data.project_id || "");

      // Still apply the farmer_id filter
      if ((data.farmer_id || "").toLowerCase() !== farmerId.toLowerCase()) {
        return;
      }

      projectIdList.push(projectId);

      const searchTerm = filter.search?.toLowerCase();
      const matchesSearch = searchTerm
        ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
          `${data.email || ""}`.toLowerCase().includes(searchTerm) ||
          (data.start_date || "").includes(searchTerm) ||
          (data.end_date || "").includes(searchTerm) ||
          (data.crop_type_name || "").toLowerCase().includes(searchTerm) ||
          (data.status || "").toLowerCase().includes(searchTerm)
        : true;

      const matchesStatus = filter.status
        ? (data.status || "").toLowerCase() === filter.status.toLowerCase()
        : true;

      if (matchesSearch && matchesStatus) {
        projectList.push({ project_id: projectId, ...data });
      }
    });

    projectList.sort((a, b) => {
      const startA = a.start_date ? new Date(a.start_date) : new Date(0);
      const startB = b.start_date ? new Date(b.start_date) : new Date(0);
      const endA = a.end_date ? new Date(a.end_date) : new Date(0);
      const endB = b.end_date ? new Date(b.end_date) : new Date(0);

      if (startB - startA !== 0) {
        return startB - startA;
      }
      return endB - endA;
    });

    console.log("Project IDs:", projectIdList);
    currentPage = 1;
    await updateTable();
    updatePagination();

    // Optional optimization: Pre-calculate progress during fetch
    /*
    projectList = [];
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const projectId = String(data.project_id || "");
      if ((data.farmer_id || "").toLowerCase() !== farmerId.toLowerCase()) continue;
      const progress = await calculateProjectProgress(projectId);
      projectList.push({ project_id: projectId, progress, ...data });
    }
    */
  } catch (error) {
    console.error("Error Fetching Projects:", error);
  }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name) {
  const formattedProjectName = project_name
    ? capitalizeWords(project_name)
    : "";
  return `${formattedProjectName}`.trim();
}
function formatFarmPresident(farm_president) {
  const formattedFarmPresident = farm_president
    ? capitalizeWords(farm_president)
    : "";
  return `${formattedFarmPresident}`.trim();
}
function formatCrop(crop_type_name) {
  const formattedCrop = crop_type_name ? capitalizeWords(crop_type_name) : "";
  return `${formattedCrop}`.trim();
}
function formatStatus(status) {
  const formattedStatus = status ? capitalizeWords(status) : "";
  return `${formattedStatus}`.trim();
}

//  <------------- TABLE DISPLAY AND UPDATE ------------->
async function updateTable() {
  console.log("updateTable called, currentPage:", currentPage);
  const start = (currentPage - 1) * rowsPerPage;
  const end = currentPage * rowsPerPage;
  const pageData = projectList.slice(start, end);

  tableBody.innerHTML = "";

  if (pageData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8">No records found.</td></tr>`;
    return;
  }

  for (const data of pageData) {
    const row = document.createElement("tr");
    const formattedProjectName = formatProjectName(data.project_name);
    const formattedFarmPresident = formatFarmPresident(data.farm_president);
    const formattedCrop = formatCrop(data.crop_type_name);
    const formattedStatus = formatStatus(data.status);

    // Calculate progress dynamically based on subtasks
    const progressPercentage = await calculateProjectProgress(data.project_id);

    row.innerHTML = `
      <td>${formattedProjectName || "Project Name not recorded"}</td>
      <td>${formattedFarmPresident || "Farm President not recorded"}</td>
      <td>${data.start_date || "Start Date not recorded"}</td>
      <td>${data.end_date || "End Date not recorded"}</td>
      <td>${formattedCrop || "Crop not recorded"}</td>
      <td>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${progressPercentage}%;">${progressPercentage}%</div>
        </div>
      </td>
      <td>${formattedStatus || "Status not recorded"}</td>
      <td>
        <button class="action-btn edit-btn" data-id="${
          data.project_id
        }" title="Edit">
          <img src="../../images/edit.png" alt="Edit">
        </button>
        <button class="action-btn view-btn" data-id="${
          data.project_id
        }" title="View">
          <img src="../../images/eye.png" alt="View">
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  }

  updatePagination();
}

// Function to calculate progress based on subtasks in tb_project_task
async function calculateProjectProgress(project_id) {
  try {
    // Ensure project_id is a string to match tb_project_task
    const projectIdStr = String(project_id);
    const q = query(
      collection(db, "tb_project_task"),
      where("project_id", "==", projectIdStr)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`No tasks found for project_id: ${projectIdStr}`);
      return 0;
    }

    let totalSubtasks = 0;
    let completedSubtasks = 0;

    querySnapshot.forEach((doc) => {
      const taskData = doc.data();
      const subtasks = taskData.subtasks || [];
      totalSubtasks += subtasks.length;

      subtasks.forEach((subtask) => {
        // If subtask or status is missing, treat as "Pending"
        const status =
          subtask && subtask.status ? subtask.status.toLowerCase() : "pending";
        if (status === "completed") {
          completedSubtasks++;
        }
      });
    });

    const progressPercentage =
      totalSubtasks > 0
        ? Math.round((completedSubtasks / totalSubtasks) * 100)
        : 0;

    console.log(
      `Project ID: ${projectIdStr} - Total Subtasks: ${totalSubtasks}, Completed: ${completedSubtasks}, Progress: ${progressPercentage}%`
    );
    return progressPercentage;
  } catch (error) {
    console.error(
      `Error calculating progress for project_id ${project_id}:`,
      error
    );
    return 0;
  }
}

function updatePagination() {
  const totalPages = Math.ceil(projectList.length / rowsPerPage) || 1;
  pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

async function changePage(direction) {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  if (direction === "prev" && currentPage > 1) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages) {
    currentPage++;
  }
  await updateTable(); // This already calls updatePagination()
}

// Debounce function to prevent multiple rapid clicks
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener(
  "click",
  debounce(() => {
    console.log("Prev button clicked, calling changePage");
    changePage("prev");
  }, 300)
);
nextPageBtn.addEventListener(
  "click",
  debounce(() => {
    console.log("Next button clicked, calling changePage");
    changePage("next");
  }, 300)
);

// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const project_id = target.getAttribute("data-id");
  console.log("Clicked Edit Button - Project ID:", project_id); // Debugging

  if (target.classList.contains("edit-btn")) {
    teamAssign(project_id);
  } else if (target.classList.contains("view-btn")) {
    viewProject(project_id);
  } else if (target.classList.contains("delete-btn")) {
    deleteUserAccount(project_id);
  }
});

//FETCH PROJECT DETAILS
async function fetchProjectDetails(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      let projectData = null;
      querySnapshot.forEach((doc) => {
        projectData = doc.data();
      });

      if (projectData) {
        const filteredProjectData = {
          project_created_by: projectData.project_creator || "N/A",
          farmer_id: projectData.farmer_id || "N/A",
          crop_name: projectData.crop_name || "N/A",
          crop_type_name: projectData.crop_type_name || "N/A",
          crop_type_quantity: projectData.crop_type_quantity || 0,
          equipment: projectData.equipment || [],
          fertilizer: projectData.fertilizer || [],
        };

        console.log(
          "FertilizerData(tb_projects)",
          filteredProjectData.fertilizer
        ); // ✅ Added console log
        console.log(
          "EquipmentData(tb_projects)",
          filteredProjectData.equipment
        );
        console.log("Fetched Project Details:", filteredProjectData);

        return filteredProjectData;
      }
    }

    console.warn("No project found with the given project_id:", project_id);
    return null;
  } catch (error) {
    console.error("Error fetching project details:", error);
    return null;
  }
}

//CROP
async function addStockToCropStock(project_id) {
  try {
    // 1. Get the project details and validate
    const projectDetails = await fetchProjectDetails(project_id);
    if (!projectDetails || !globalLeadFarmerId) {
      console.warn("Missing project details or globalLeadFarmerId");
      return false;
    }

    // 2. Find the matching crop stock document
    const cropStockDoc = await findCropStockByProject(project_id);
    if (!cropStockDoc) {
      console.warn("No matching crop stock document found");
      return false;
    }

    // 3. Prepare the new stock record
    const newStock = {
      current_stock: projectDetails.crop_type_quantity || 0,
      farmer_id: globalLeadFarmerId,
      stock_date: new Date().toISOString(), // Current timestamp in ISO format
    };

    // 4. Update the document (assuming you have the document ID from findCropStockByProject)
    const docRef = doc(db, "tb_crop_stock", cropStockDoc.id); // Note: You'll need to modify findCropStockByProject to return the document ID
    await updateDoc(docRef, {
      stocks: arrayUnion(newStock),
      current_stock: increment(projectDetails.crop_type_quantity || 0), // Update the top-level current_stock
    });

    console.log("Successfully added new stock record");
    return true;
  } catch (error) {
    console.error("Error adding stock record:", error);
    return false;
  }
}
async function findCropStockByProject(project_id) {
  try {
    const projectDetails = await fetchProjectDetails(project_id);

    if (
      !projectDetails ||
      !projectDetails.crop_type_name ||
      !projectDetails.project_created_by
    ) {
      console.warn("Missing required project details");
      return null;
    }

    const { crop_type_name, project_created_by } = projectDetails;
    const q = query(
      collection(db, "tb_crop_stock"),
      where("crop_type_name", "==", crop_type_name)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      for (const doc of querySnapshot.docs) {
        const cropStockData = doc.data();
        const stockArray = cropStockData.stocks || cropStockData.stocks;

        if (stockArray?.length > 0) {
          const firstStock = stockArray[0];
          if (firstStock.owned_by === project_created_by) {
            return {
              id: doc.id, // Include document ID for updating
              ...cropStockData,
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

//FERTILIZER
async function saveFertilizerStockAfterUse(project_id) {
  try {
    // 1. Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.fertilizer ||
      projectData.fertilizer.length === 0
    ) {
      console.warn("No fertilizer data found for this project.");
      return;
    }

    // 2. Get the project creator (owner)
    const project_owner = projectData.project_created_by;
    if (!project_owner) {
      console.error("Project owner not found");
      return;
    }

    const stock_date = new Date().toISOString();
    const updatePromises = [];

    // 3. Process each fertilizer in the project
    for (const fert of projectData.fertilizer) {
      // Find documents with matching fertilizer_name
      const fertilizerQuery = query(
        collection(db, "tb_fertilizer_stock"),
        where("fertilizer_name", "==", fert.fertilizer_name)
      );
      const snapshot = await getDocs(fertilizerQuery);

      // Check each matching document
      for (const docSnapshot of snapshot.docs) {
        const docData = docSnapshot.data();
        const stocks = docData.stocks || [];

        // Find if any stock entry has matching owned_by
        const hasMatchingOwner = stocks.some(
          (stock) => stock.owned_by === project_owner
        );

        if (hasMatchingOwner) {
          // Add new stock entry
          updatePromises.push(
            updateDoc(docSnapshot.ref, {
              stocks: arrayUnion({
                current_stock: fert.fertilizer_quantity,
                stock_date: stock_date,
                unit: "kg",
                farmer_id: globalLeadFarmerId, // Using global ID for who recorded this
              }),
            })
          );
          break; // Only update the first matching document
        }
      }
    }

    await Promise.all(updatePromises);
    console.log("✅ Fertilizer usage successfully recorded.");
  } catch (error) {
    console.error("❌ Error saving fertilizer stock:", error);
  }
}

//EQUIPMENT
async function saveEquipmentStockAfterUse(project_id) {
  try {
    // 1. Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.equipment ||
      projectData.equipment.length === 0
    ) {
      console.warn("No equipment data found for this project.");
      return;
    }

    // 2. Get the project creator (owner)
    const project_owner = projectData.project_created_by;
    if (!project_owner) {
      console.error("Project owner not found");
      return;
    }

    const stock_date = new Date().toISOString();
    const lead_farmer_id = globalLeadFarmerId;
    const updatePromises = [];

    // 3. Process each equipment in the project
    for (const equip of projectData.equipment) {
      // Find documents with matching equipment_name
      const equipmentQuery = query(
        collection(db, "tb_equipment_stock"),
        where("equipment_name", "==", equip.equipment_name)
      );
      const snapshot = await getDocs(equipmentQuery);

      // Check each matching document
      for (const docSnapshot of snapshot.docs) {
        const docData = docSnapshot.data();
        const stocks = docData.stocks || [];

        // Find if any stock entry has matching owned_by
        const hasMatchingOwner = stocks.some(
          (stock) => stock.owned_by === project_owner
        );

        if (hasMatchingOwner) {
          // Add new usage record
          updatePromises.push(
            updateDoc(docSnapshot.ref, {
              stocks: arrayUnion({
                current_stock: equip.equipment_quantity,
                stock_date: stock_date,
                unit: "unit", // Changed from "kg" to "unit" for equipment
                farmer_id: lead_farmer_id,
                action: "used", // Optional: track usage type
              }),
            })
          );
          break; // Only update the first matching document
        }
      }
    }

    await Promise.all(updatePromises);
    console.log("✅ Equipment usage successfully recorded.");
  } catch (error) {
    console.error("❌ Error saving equipment stock:", error);
  }
}

//CROP STOCK
async function fetchCropStockByOwner(project_created_by, crop_type_name) {
  // Change function parameter
  console.log("Fetching crop stock for project creator:", project_created_by);

  try {
    const cropStockQuery = query(collection(db, "tb_crop_stock"));
    const cropStockSnapshot = await getDocs(cropStockQuery);

    let foundStock = null;

    cropStockSnapshot.forEach((doc) => {
      const cropStockData = doc.data();

      const matchingStock = cropStockData.stocks.find(
        (stock) => stock.owned_by === project_created_by
      ); // Change variable

      if (matchingStock && cropStockData.crop_type_name === crop_type_name) {
        foundStock = {
          crop_name: cropStockData.crop_name || "N/A",
          crop_type_id: cropStockData.crop_type_id || "N/A",
          crop_type_name: cropStockData.crop_type_name || "N/A",
          unit: cropStockData.unit || "N/A",
          stocks: cropStockData.stocks.map((stock) => ({
            current_stock: stock.current_stock || 0,
            owned_by: stock.owned_by || "N/A",
            stock_date: stock.stock_date || "N/A",
          })),
        };
      }
    });

    if (foundStock) {
      console.log("Fetched Crop Stock:", foundStock);
    } else {
      console.log(
        "No crop stock found for project creator:",
        project_created_by
      );
    }

    return foundStock;
  } catch (error) {
    console.error("Error fetching crop stock:", error);
    return null;
  }
}

//TB PROJECT TASK ASSIGNING
async function fetchProjectTasks(project_id) {
  try {
    // Fetch project details
    const projectDetails = await fetchProjectDetails(project_id);
    if (!projectDetails) {
      console.warn("No project details found.");
      return null;
    }

    const { project_created_by, crop_type_name } = projectDetails;

    // Fetch crop stock details
    const cropStock = await fetchCropStockByOwner(
      project_created_by,
      crop_type_name
    );
    if (!cropStock) {
      console.warn("No crop stock details found.");
      return null;
    }

    const { crop_name } = cropStock;

    // Fetch matching tasks from tb_task_list
    const taskQuery = query(
      collection(db, "tb_task_list"),
      where("crop_type_name", "==", crop_type_name)
    );
    const taskSnapshot = await getDocs(taskQuery);

    if (taskSnapshot.empty) {
      console.warn("No matching task found in tb_task_list.");
      return null;
    }

    // Fetch and increment project_task_id from tb_id_counters
    const idCounterRef = doc(db, "tb_id_counters", "project_task_id_counter");
    const idCounterSnap = await getDoc(idCounterRef);

    if (!idCounterSnap.exists()) {
      console.error("ID counter document not found.");
      return null;
    }

    let project_task_id = idCounterSnap.data().count || 1;

    const finalDataArray = [];

    // Loop through each task and create a separate record
    for (const taskDoc of taskSnapshot.docs) {
      const taskData = taskDoc.data();
      const task_name = taskData.task_name || "N/A";
      const subtasks = taskData.subtasks || [];

      const finalData = {
        project_id,
        crop_name,
        crop_type_name,
        project_task_id, // Auto-incremented ID
        task_name, // Solo field
        subtasks, // Array of subtasks
        task_status: "Pending", // Default status
      };

      finalDataArray.push(finalData);

      // Increment the project_task_id for the next task
      project_task_id++;
    }

    // Update the counter with the new value
    await updateDoc(idCounterRef, { count: project_task_id });

    console.log("Fetched Project Tasks:", finalDataArray);
    return finalDataArray; // Returns an array of records
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    return null;
  }
}

//CHECKS IF A PROJECT ALREADY HAS A TEAM
async function checkProjectTeam(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      let projectData = null;
      querySnapshot.forEach((doc) => {
        projectData = doc.data();
      });

      if (projectData && projectData.team_id) {
        showDeleteMessage(
          `This project already has a team assigned: Team ID ${projectData.team_id}.`
        );
        return false; // Prevents the popup from opening
      }
    }
    return true; // Allows the popup to open
  } catch (error) {
    console.error("Error checking project team:", error);
    return false;
  }
}

//TEAM ASSIGN
async function teamAssign(project_id) {
  const canProceed = await checkProjectTeam(project_id);
  if (!canProceed) return; // Stop execution if a team is already assigned

  const panel = document.getElementById("team-assign-confirmation-panel");
  if (!panel) {
    console.error("Error: Confirmation panel not found!");
    return;
  }
  panel.style.display = "flex";

  // Fetch and log project details
  const projectData = await fetchProjectDetails(project_id);
  if (!projectData) {
    console.error("Error: Failed to fetch project details.");
    return;
  }
  console.log("Project Details:", projectData);

  // Fetch and log crop stock data separately
  if (projectData.project_creator && projectData.crop_type_name) {
    const cropStock = await fetchCropStockByOwner(
      projectData.project_creator,
      projectData.crop_type_name
    );
    console.log(
      "Crop Stock by Owner:",
      cropStock ? cropStock : "No stock found."
    );
  } else {
    console.warn(
      "Missing project creator or crop type name, skipping crop stock fetch."
    );
  }

  try {
    const userBarangay = sessionStorage.getItem("barangay_name");

    // Fetch all active projects in the barangay
    const projectQuery = query(
      collection(db, "tb_projects"),
      where("barangay_name", "==", userBarangay)
    );
    const projectSnapshot = await getDocs(projectQuery);
    const assignedTeamIds = new Set();

    projectSnapshot.forEach((doc) => {
      const projectData = doc.data();
      if (projectData.team_id) {
        assignedTeamIds.add(parseInt(projectData.team_id, 10));
      }
    });

    console.log("Assigned Team IDs:", Array.from(assignedTeamIds));

    // Fetch available teams
    const teamQuery = query(
      collection(db, "tb_teams"),
      where("barangay_name", "==", userBarangay)
    );
    const teamSnapshot = await getDocs(teamQuery);

    let displayedTeamIds = [];
    let teamListHtml = `
            <div class="team-assign-box">
    <h4 style="font-weight: normal;">Available Teams:</h4>
    <div class="team-list-container">
        `;

    teamSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamId = parseInt(teamData.team_id, 10);

      console.log(
        `Checking team: ${teamId} (Is assigned? ${assignedTeamIds.has(teamId)})`
      );

      if (assignedTeamIds.has(teamId)) return; // Skip already assigned teams

      displayedTeamIds.push(teamId);
      const teamName = teamData.team_name;
      const leadFarmer = teamData.lead_farmer;
      const leadFarmerId = String(teamData.lead_farmer_id); // Ensure it's a string
      const totalFarmers = teamData.farmer_name
        ? teamData.farmer_name.length
        : 0;

      teamListHtml += `
                <div class="team-item" 
                     data-team-id="${teamId}" 
                     data-team-name="${teamName}" 
                     data-lead-farmer="${leadFarmer}" 
                     data-lead-farmer-id="${leadFarmerId}"  
                     data-farmers='${JSON.stringify(
                       teamData.farmer_name || []
                     )}'>
                    <strong>${teamName}</strong><br>
                    Lead: ${leadFarmer}<br>
                    Total Farmers: ${totalFarmers}
                </div>
            `;
    });

    console.log("Displayed Team IDs (After Filtering):", displayedTeamIds);

    teamListHtml += "</div></div>";
    document.getElementById("team-assign-list").innerHTML = teamListHtml;
  } catch (error) {
    console.error("Error fetching team data:", error);
  }

  let selectedTeam = null;

  // Event delegation for selecting a team
  document
    .getElementById("team-assign-list")
    .addEventListener("click", function (event) {
      let selectedElement = event.target.closest(".team-item");
      if (!selectedElement) return;

      document.querySelectorAll(".team-item").forEach((item) => {
        item.style.backgroundColor = "";
        item.style.color = "";
      });

      selectedElement.style.backgroundColor = "#318a71";
      selectedElement.style.color = "white";

      // Store selected team details
      selectedTeam = {
        team_id: parseInt(selectedElement.getAttribute("data-team-id"), 10),
        team_name: selectedElement.getAttribute("data-team-name"),
        lead_farmer: selectedElement.getAttribute("data-lead-farmer"),
        lead_farmer_id: selectedElement.getAttribute("data-lead-farmer-id"),
        farmer_name: JSON.parse(selectedElement.getAttribute("data-farmers")),
      };

      // Set the global lead farmer ID
      globalLeadFarmerId = selectedTeam.lead_farmer_id;
      console.log("Global Lead Farmer ID Set:", globalLeadFarmerId);
    });

  // Ensure confirm button exists before adding event listener
  setTimeout(() => {
    const confirmBtn = document.getElementById("confirm-team-assign");
    if (confirmBtn) {
      confirmBtn.onclick = async function () {
        if (!selectedTeam) {
          showDeleteMessage("Please select a team first.");
          return;
        }

        try {
          const q = query(
            collection(db, "tb_projects"),
            where("project_id", "==", Number(project_id))
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            querySnapshot.forEach(async (doc) => {
              const projectRef = doc.ref;
              const currentDate = new Date().toISOString(); // Get current date

              // Update project with team assignment
              await updateDoc(projectRef, {
                team_id: selectedTeam.team_id,
                team_name: selectedTeam.team_name,
                lead_farmer: selectedTeam.lead_farmer,
                lead_farmer_id: selectedTeam.lead_farmer_id,
                farmer_name: selectedTeam.farmer_name,
                crop_date: currentDate,
                fertilizer_date: currentDate,
                equipment_date: currentDate,
                status: "Ongoing",
              });

              // Save to localStorage
              localStorage.setItem(
                "projectData",
                JSON.stringify({
                  ...doc.data(),
                  team_id: selectedTeam.team_id,
                  team_name: selectedTeam.team_name,
                  lead_farmer: selectedTeam.lead_farmer,
                  lead_farmer_id: selectedTeam.lead_farmer_id,
                  farmer_name: selectedTeam.farmer_name,
                  crop_date: currentDate,
                  fertilizer_date: currentDate,
                  equipment_date: currentDate,
                  status: "Ongoing",
                })
              );

              // Save project tasks
              const projectTasks = await fetchProjectTasks(project_id);
              if (projectTasks && projectTasks.length > 0) {
                for (const task of projectTasks) {
                  await addDoc(collection(db, "tb_project_task"), task);
                }
                console.log(
                  "Successfully saved project task data:",
                  projectTasks
                );
              } else {
                console.warn("Failed to fetch project tasks, skipping save.");
              }

              // Update stocks
              await addStockToCropStock(project_id);
              await saveFertilizerStockAfterUse(project_id);
              await saveEquipmentStockAfterUse(project_id);

              // Add notification for lead farmer
              const notificationData = {
                description: `Project ${project_id} is assigned for you to manage`,
                project_id: Number(project_id),
                read: false,
                recipient: selectedTeam.lead_farmer_id,
                timestamp: serverTimestamp(),
                title: "NEW PROJECT ASSIGNED",
                type: "",
              };

              await addDoc(
                collection(db, "tb_notifications"),
                notificationData
              );
              console.log(
                `✅ Notification added for project ${project_id} to lead farmer ${selectedTeam.lead_farmer_id}`
              );

              // Show success message and redirect
              showDeleteMessage(
                `Team "${selectedTeam.team_name}" has been successfully assigned! Project status updated to Ongoing.`
              );
              window.location.href = "farmpres_project.html";
            });
          } else {
            showDeleteMessage("No matching project found. Unable to proceed.");
          }
        } catch (error) {
          console.error("Error updating project with team assignment:", error);
          showDeleteMessage(
            "An error occurred while assigning the team. Please try again."
          );
        }

        panel.style.display = "none";
      };
    } else {
      console.error("Error: Confirm button (confirm-team-assign) not found!");
    }
  }, 100);

  // Function to reset selection and close the popup
  function resetTeamSelection() {
    const panel = document.getElementById("team-assign-confirmation-panel");
    if (panel) {
      panel.style.display = "none"; // Hide the popup
    }
    selectedTeam = null;
  }

  // Cancel button event listener
  setTimeout(() => {
    const cancelTeamAssign = document.getElementById("cancel-team-assign");
    if (cancelTeamAssign)
      cancelTeamAssign.addEventListener("click", resetTeamSelection);
  }, 100);
}

// <------------- VIEW BUTTON CODE ------------->
/*async function viewUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const projectData = doc.data();
                localStorage.setItem("projectData", JSON.stringify(projectData));
                window.location.href = "admin_users_view.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.log("Error fetching user data for view:", error);
    }
}*/

function viewProject(projectId) {
  sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10)); // Convert to integer
  window.location.href =
    "../../../public/landing_pages/farm_president/viewproject.html"; // Redirect to viewproject.html
}

// <------------- DELETE BUTTON EVENT LISTENER ------------->
async function deleteUserAccount(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      confirmationPanel.style.display = "flex";
      editFormContainer.style.pointerEvents = "none";
    } else {
      showDeleteMessage(
        "No project_id is found, Unable to proceed with the deleting the record",
        false
      );
    }
  } catch (error) {
    console.log("Error deleting User Account:", error);
  }
}

// <------------- DELETE ROW AND TABLE REFRESH CODE ------------->
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;
const deleteMessage = document.getElementById("delete-message");

confirmDeleteButton.addEventListener("click", async () => {
  if (selectedRowId) {
    try {
      const userDocRef = doc(db, "tb_projects", selectedRowId);
      await deleteDoc(userDocRef);
      console.log("Record deleted successfully!");

      fetch_projects();

      deleteMessage.style.display = "block";
      setTimeout(() => {
        deleteMessage.style.opacity = "1";
        setTimeout(() => {
          deleteMessage.style.opacity = "0";
          setTimeout(() => {
            deleteMessage.style.display = "none";
          }, 300);
        }, 3000);
      }, 0);
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  }

  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

cancelDeleteButton.addEventListener("click", () => {
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", async () => {
  await fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

statusSelect.addEventListener("change", async () => {
  await fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

// Removed redundant event listeners here since they're defined above with debounce

// <----------------------- STATUS DROP DOWN CODE ----------------------->
async function fetch_status() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_projects"));

    let addedStatus = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let statusName = data.status ? data.status.toUpperCase() : "";

      // Case-insensitive check by converting all stored values to uppercase
      if (!addedStatus.includes(statusName)) {
        addedStatus.push(statusName);

        const option = document.createElement("option");
        option.value = statusName;
        option.textContent = statusName;
        statusSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error Fetching Status:", error);
  }
}

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE and ERROR MESSAGES ------------------------>
function showDeleteMessage(message, success) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.opacity = "1";
  deleteMessage.style.display = "block";

  setTimeout(() => {
    deleteMessage.style.opacity = "0";
    setTimeout(() => {
      deleteMessage.style.display = "none";
    }, 400);
  }, 4000);
}

fetch_status();
