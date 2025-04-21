import { getAuth, onAuthStateChanged } from "firebase/auth";
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
let projectList = []; // Will store projects with precomputed progress
let isDev = process.env.NODE_ENV === "development"; // Toggle logs for dev only

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Capitalization utility
function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Formatting helpers
const formatProjectName = (name) => (name ? capitalizeWords(name) : "").trim();
const formatFarmPresident = (name) =>
  (name ? capitalizeWords(name) : "").trim();
const formatCrop = (name) => (name ? capitalizeWords(name) : "").trim();
const formatStatus = (status) => (status ? capitalizeWords(status) : "").trim();

// Initial fetch and authentication
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (isDev) console.log("User authenticated:", user.email);
    fetch_projects();
  } else {
    console.error("User not authenticated.");
  }
});

// Fetch projects and tasks in one go
async function fetch_projects(filter = {}) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const farmerDocRef = doc(db, "tb_farmers", user.uid);
    const farmerDocSnap = await getDoc(farmerDocRef);
    if (!farmerDocSnap.exists()) throw new Error("Farmer document not found");

    const farmerId = sessionStorage.getItem("farmer_id") || "";
    const projectSnapshot = await getDocs(collection(db, "tb_projects"));
    const taskSnapshot = await getDocs(collection(db, "tb_project_task"));

    // Build a map of tasks by project_id
    const taskMap = new Map();
    taskSnapshot.forEach((doc) => {
      const taskData = doc.data();
      const projectId = taskData.project_id;
      if (!taskMap.has(projectId)) taskMap.set(projectId, []);
      taskMap.get(projectId).push(taskData);
    });

    projectList = [];
    projectSnapshot.forEach((doc) => {
      const data = doc.data();
      const projectId = String(data.project_id || "");
      if ((data.farmer_id || "").toLowerCase() !== farmerId.toLowerCase())
        return;

      // Exclude projects with "Completed" or "Failed" status
      const status = (data.status || "").toLowerCase();
      if (["completed", "failed"].includes(status)) return;

      const tasks = taskMap.get(projectId) || [];
      const { totalSubtasks, completedSubtasks } =
        calculateProgressFromTasks(tasks);
      const progressPercentage =
        totalSubtasks > 0
          ? Math.round((completedSubtasks / totalSubtasks) * 100)
          : 0;

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
        projectList.push({
          project_id: projectId,
          progress: progressPercentage,
          ...data,
        });
      }
    });

    // Sort only once on initial fetch
    projectList.sort((a, b) => {
      const startA = a.start_date ? new Date(a.start_date) : new Date(0);
      const startB = b.start_date ? new Date(b.start_date) : new Date(0);
      return (
        startB - startA ||
        (b.end_date ? new Date(b.end_date) : 0) -
          (a.end_date ? new Date(a.end_date) : 0)
      );
    });

    if (isDev) console.log("Fetched projects:", projectList.length);
    currentPage = 1;
    updateTable();
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}


async function fetch_filtered_status() {
  try {
    const allowedStatuses = ["ongoing", "pending"];
    const projectSnapshot = await getDocs(collection(db, "tb_projects"));
    const filteredStatuses = new Set();

    projectSnapshot.forEach((doc) => {
      const status = (doc.data().status || "").toLowerCase();
      if (allowedStatuses.includes(status) && !filteredStatuses.has(status)) {
        filteredStatuses.add(status.toUpperCase());
      }
    });

    // Clear existing status options except the default "All" (if present)
    statusSelect.innerHTML = '<option value="">All</option>';

    // Add filtered statuses to the dropdown
    filteredStatuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });

    if (isDev) console.log("Filtered statuses:", [...filteredStatuses]);
  } catch (error) {
    console.error("Error fetching filtered statuses:", error);
  }
}


// Calculate progress from pre-fetched tasks
function calculateProgressFromTasks(tasks) {
  let totalSubtasks = 0;
  let completedSubtasks = 0;

  tasks.forEach((task) => {
    const subtasks = task.subtasks || [];
    totalSubtasks += subtasks.length;
    subtasks.forEach((subtask) => {
      const status = subtask?.status ? subtask.status.toLowerCase() : "pending";
      if (status === "completed") completedSubtasks++;
    });
  });

  return { totalSubtasks, completedSubtasks };
}

// Batch DOM updates for table
function updateTable() {
  const start = (currentPage - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, projectList.length);
  const pageData = projectList.slice(start, end);

  if (isDev)
    console.log("updateTable, page:", currentPage, "rows:", pageData.length);

  let tableHTML = "";
  if (pageData.length === 0) {
    tableHTML = `<tr><td colspan="8">No records found.</td></tr>`;
  } else {
    tableHTML = pageData
      .map((data) => {
        const formattedProjectName = formatProjectName(data.project_name);
        const formattedFarmPresident = formatFarmPresident(data.farm_president);
        const formattedCrop = formatCrop(data.crop_type_name);
        const formattedStatus = formatStatus(data.status);

        return `
          <tr>
            <td>${formattedProjectName || "Project Name not recorded"}</td>
            <td>${formattedFarmPresident || "Farm President not recorded"}</td>
            <td>${data.start_date || "Start Date not recorded"}</td>
            <td>${data.end_date || "End Date not recorded"}</td>
            <td>${formattedCrop || "Crop not recorded"}</td>
            <td>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${data.progress}%;">${
          data.progress
        }%</div>
              </div>
            </td>
            <td>${formattedStatus || "Status not recorded"}</td>
            <td>
              <button class="action-btn edit-btn" data-id="${
                data.project_id
              }" title="Select Team">
                <img src="/images/team-icon.png" alt="Select Team">
              </button>
              <button class="action-btn view-btn" data-id="${
                data.project_id
              }" title="View">
                <img src="/images/eye.png" alt="View">
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  tableBody.innerHTML = tableHTML;
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(projectList.length / rowsPerPage) || 1;
  pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

async function changePage(direction) {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  if (direction === "prev" && currentPage > 1) currentPage--;
  else if (direction === "next" && currentPage < totalPages) currentPage++;
  updateTable();
}

// Event listeners with debounce
prevPageBtn.addEventListener(
  "click",
  debounce(() => changePage("prev"), 300)
);
nextPageBtn.addEventListener(
  "click",
  debounce(() => changePage("next"), 300)
);
searchBar.addEventListener(
  "input",
  debounce(
    () =>
      fetch_projects({ search: searchBar.value, status: statusSelect.value }),
    500
  )
);
statusSelect.addEventListener(
  "change",
  debounce(
    () =>
      fetch_projects({ search: searchBar.value, status: statusSelect.value }),
    300
  )
);

// Action column event listener
tableBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const project_id = target.getAttribute("data-id");
  if (target.classList.contains("edit-btn")) teamAssign(project_id);
  else if (target.classList.contains("view-btn")) viewProject(project_id);
  else if (target.classList.contains("delete-btn"))
    deleteUserAccount(project_id);
});

// Fetch project details (unchanged but simplified logging)
async function fetchProjectDetails(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const projectData = querySnapshot.docs[0].data();
    const filteredProjectData = {
      project_created_by: projectData.project_creator || "N/A",
      farmer_id: projectData.farmer_id || "N/A",
      crop_name: projectData.crop_name || "N/A",
      crop_type_name: projectData.crop_type_name || "N/A",
      crop_type_quantity: projectData.crop_type_quantity || 0,
      equipment: projectData.equipment || [],
      fertilizer: projectData.fertilizer || [],
    };

    if (isDev) console.log("Fetched Project Details:", filteredProjectData);
    return filteredProjectData;
  } catch (error) {
    console.error("Error fetching project details:", error);
    return null;
  }
}

// Team assignment (simplified, removed redundant logs)
async function teamAssign(project_id) {
  const canProceed = await checkProjectTeam(project_id);
  if (!canProceed) return;

  const panel = document.getElementById("team-assign-confirmation-panel");
  if (!panel) return;
  panel.style.display = "flex";

  const projectData = await fetchProjectDetails(project_id);
  if (!projectData) return;

  try {
    const userBarangay = sessionStorage.getItem("barangay_name");
    const projectQuery = query(
      collection(db, "tb_projects"),
      where("barangay_name", "==", userBarangay)
    );
    const projectSnapshot = await getDocs(projectQuery);
    // Only include team_ids from projects that are NOT "Completed" or "Failed"
    const assignedTeamIds = new Set(
      projectSnapshot.docs
        .filter((doc) => {
          const status = (doc.data().status || "").toLowerCase();
          return !["completed", "failed"].includes(status);
        })
        .map((doc) => parseInt(doc.data().team_id, 10))
        .filter(Boolean)
    );

    const teamQuery = query(
      collection(db, "tb_teams"),
      where("barangay_name", "==", userBarangay)
    );
    const teamSnapshot = await getDocs(teamQuery);

    let teamListHtml = `<div class="team-assign-box"><h4 style="font-weight: normal;">Available Teams:</h4><div class="team-list-container">`;
    if (teamSnapshot.empty) {
      teamListHtml = `<div class="team-assign-box"><h4 style="font-weight: normal;">No available teams found.</h4></div>`;
    } else {
      teamSnapshot.forEach((doc) => {
        const teamData = doc.data();
        const teamId = parseInt(teamData.team_id, 10);
        if (assignedTeamIds.has(teamId)) return;

        teamListHtml += `
          <div class="team-item" 
               data-team-id="${teamId}" 
               data-team-name="${teamData.team_name}" 
               data-lead-farmer="${teamData.lead_farmer}" 
               data-lead-farmer-id="${teamData.lead_farmer_id}"  
               data-farmers='${JSON.stringify(teamData.farmer_name || [])}'>
            <strong>${teamData.team_name}</strong><br>
            Lead: ${teamData.lead_farmer}<br>
            Total Farmers: ${teamData.farmer_name?.length || 0}
          </div>
        `;
      });
      teamListHtml += "</div></div>";
    }
    document.getElementById("team-assign-list").innerHTML = teamListHtml;
  } catch (error) {
    console.error("Error fetching team data:", error);
    showDeleteMessage("Error loading teams. Please try again.");
  }

  let selectedTeam = null;
  document
    .getElementById("team-assign-list")
    .addEventListener("click", function (event) {
      const selectedElement = event.target.closest(".team-item");
      if (!selectedElement) return;

      document.querySelectorAll(".team-item").forEach((item) => {
        item.style.backgroundColor = "";
        item.style.color = "";
      });
      selectedElement.style.backgroundColor = "#318a71";
      selectedElement.style.color = "white";

      selectedTeam = {
        team_id: parseInt(selectedElement.getAttribute("data-team-id"), 10),
        team_name: selectedElement.getAttribute("data-team-name"),
        lead_farmer: selectedElement.getAttribute("data-lead-farmer"),
        lead_farmer_id: selectedElement.getAttribute("data-lead-farmer-id"),
        farmer_name: JSON.parse(selectedElement.getAttribute("data-farmers")),
      };
      globalLeadFarmerId = selectedTeam.lead_farmer_id;
    });

  setTimeout(() => {
    const confirmBtn = document.getElementById("confirm-team-assign");
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        if (!selectedTeam)
          return showDeleteMessage("Please select a team first.");
        try {
          const q = query(
            collection(db, "tb_projects"),
            where("project_id", "==", Number(project_id))
          );
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty)
            return showDeleteMessage("No matching project found.");

          const projectRef = querySnapshot.docs[0].ref;
          const currentDate = new Date().toISOString();
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

          // Prepare notifications for all farmers in farmer_name array
          const notificationPromises = [];

          // Notification for the lead farmer
          notificationPromises.push(
            addDoc(collection(db, "tb_notifications"), {
              description: `Project ${project_id} is assigned for you to manage`,
              project_id: Number(project_id),
              read: false,
              recipient: selectedTeam.lead_farmer_id,
              timestamp: serverTimestamp(),
              title: "NEW PROJECT ASSIGNED",
              type: "",
            })
          );

          // Notifications for each farmer in farmer_name array
          selectedTeam.farmer_name.forEach((farmer) => {
            if (
              farmer.farmer_id &&
              farmer.farmer_id !== selectedTeam.lead_farmer_id
            ) {
              notificationPromises.push(
                addDoc(collection(db, "tb_notifications"), {
                  description: `A new project (${project_id}) has been assigned to your team: ${selectedTeam.team_name}`,
                  project_id: Number(project_id),
                  read: false,
                  recipient: farmer.farmer_id,
                  timestamp: serverTimestamp(),
                  title: "NEW TEAM PROJECT",
                  type: "",
                })
              );
            }
          });

          // Execute all updates and notifications
          await Promise.all([
            addStockToCropStock(project_id),
            saveFertilizerStockAfterUse(project_id),
            saveEquipmentStockAfterUse(project_id),
            (async () => {
              const projectTasks = await fetchProjectTasks(project_id);
              if (projectTasks)
                await Promise.all(
                  projectTasks.map((task) =>
                    addDoc(collection(db, "tb_project_task"), task)
                  )
                );
            })(),
            ...notificationPromises,
          ]);

          showDeleteMessage(
            `Team "${selectedTeam.team_name}" assigned! Project status: Ongoing.`
          );
          window.location.href = "farmpres_project.html";
        } catch (error) {
          console.error("Error in team assignment:", error);
          showDeleteMessage("Error assigning team. Please try again.");
        }
        panel.style.display = "none";
      };
    }
  }, 100);

  setTimeout(() => {
    const cancelBtn = document.getElementById("cancel-team-assign");
    if (cancelBtn)
      cancelBtn.addEventListener("click", () => (panel.style.display = "none"));
  }, 100);
}

// Other functions (simplified, unchanged logic)
async function checkProjectTeam(project_id) {
  const q = query(
    collection(db, "tb_projects"),
    where("project_id", "==", Number(project_id))
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty && snapshot.docs[0].data().team_id) {
    showDeleteMessage(
      `This project already has a team: Team ID ${
        snapshot.docs[0].data().team_id
      }.`
    );
    return false;
  }
  return true;
}

async function addStockToCropStock(project_id) {
  const projectDetails = await fetchProjectDetails(project_id);
  if (!projectDetails || !globalLeadFarmerId) return false;

  const cropStockDoc = await findCropStockByProject(project_id);
  if (!cropStockDoc) return false;

  const docRef = doc(db, "tb_crop_stock", cropStockDoc.id);
  await updateDoc(docRef, {
    stocks: arrayUnion({
      current_stock: projectDetails.crop_type_quantity || 0,
      farmer_id: globalLeadFarmerId,
      stock_date: new Date().toISOString(),
    }),
    current_stock: increment(projectDetails.crop_type_quantity || 0),
  });
  return true;
}

async function findCropStockByProject(project_id) {
  const projectDetails = await fetchProjectDetails(project_id);
  if (!projectDetails?.crop_type_name || !projectDetails?.project_created_by)
    return null;

  const q = query(
    collection(db, "tb_crop_stock"),
    where("crop_type_name", "==", projectDetails.crop_type_name)
  );
  const snapshot = await getDocs(q);
  return (
    snapshot.docs.find(
      (doc) =>
        doc.data().stocks?.[0]?.owned_by === projectDetails.project_created_by
    ) || null
  );
}

async function saveFertilizerStockAfterUse(project_id) {
  const projectData = await fetchProjectDetails(project_id);
  if (!projectData?.fertilizer?.length || !projectData.project_created_by)
    return;

  const stock_date = new Date().toISOString();
  const updates = projectData.fertilizer.map(async (fert) => {
    const q = query(
      collection(db, "tb_fertilizer_stock"),
      where("fertilizer_name", "==", fert.fertilizer_name)
    );
    const snapshot = await getDocs(q);
    const docRef = snapshot.docs.find((doc) =>
      doc
        .data()
        .stocks.some((s) => s.owned_by === projectData.project_created_by)
    )?.ref;
    if (docRef) {
      await updateDoc(docRef, {
        stocks: arrayUnion({
          current_stock: fert.fertilizer_quantity,
          stock_date,
          unit: "kg",
          farmer_id: globalLeadFarmerId,
        }),
      });
    }
  });
  await Promise.all(updates);
}

async function saveEquipmentStockAfterUse(project_id) {
  const projectData = await fetchProjectDetails(project_id);
  if (!projectData?.equipment?.length || !projectData.project_created_by)
    return;

  const stock_date = new Date().toISOString();
  const updates = projectData.equipment.map(async (equip) => {
    const q = query(
      collection(db, "tb_equipment_stock"),
      where("equipment_name", "==", equip.equipment_name)
    );
    const snapshot = await getDocs(q);
    const docRef = snapshot.docs.find((doc) =>
      doc
        .data()
        .stocks.some((s) => s.owned_by === projectData.project_created_by)
    )?.ref;
    if (docRef) {
      await updateDoc(docRef, {
        stocks: arrayUnion({
          current_stock: equip.equipment_quantity,
          stock_date,
          unit: "unit",
          farmer_id: globalLeadFarmerId,
          action: "used",
        }),
      });
    }
  });
  await Promise.all(updates);
}

async function fetchProjectTasks(project_id) {
  const projectDetails = await fetchProjectDetails(project_id);
  if (!projectDetails) return null;

  const cropStock = await fetchCropStockByOwner(
    projectDetails.project_created_by,
    projectDetails.crop_type_name
  );
  if (!cropStock) return null;

  const taskQuery = query(
    collection(db, "tb_task_list"),
    where("crop_type_name", "==", projectDetails.crop_type_name)
  );
  const taskSnapshot = await getDocs(taskQuery);
  if (taskSnapshot.empty) return null;

  const idCounterRef = doc(db, "tb_id_counters", "project_task_id_counter");
  const idCounterSnap = await getDoc(idCounterRef);
  let project_task_id = idCounterSnap.exists()
    ? idCounterSnap.data().count || 1
    : 1;

  const finalDataArray = taskSnapshot.docs.map((doc) => {
    const taskData = doc.data();
    return {
      project_id,
      crop_name: cropStock.crop_name,
      crop_type_name: projectDetails.crop_type_name,
      project_task_id: project_task_id++,
      task_name: taskData.task_name || "N/A",
      subtasks: taskData.subtasks || [],
      task_status: "Pending",
    };
  });

  await updateDoc(idCounterRef, { count: project_task_id });
  return finalDataArray;
}

async function fetchCropStockByOwner(project_created_by, crop_type_name) {
  const q = query(collection(db, "tb_crop_stock"));
  const snapshot = await getDocs(q);
  const doc = snapshot.docs.find(
    (d) =>
      d.data().stocks?.some((s) => s.owned_by === project_created_by) &&
      d.data().crop_type_name === crop_type_name
  );
  return doc
    ? { crop_name: doc.data().crop_name || "N/A", ...doc.data() }
    : null;
}

function viewProject(projectId) {
  sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10));
  window.location.href =
    "../../../landing_pages/farm_president/viewproject.html";
}

async function deleteUserAccount(project_id) {
  const q = query(
    collection(db, "tb_projects"),
    where("project_id", "==", Number(project_id))
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return showDeleteMessage("No project found.", false);

  confirmationPanel.style.display = "flex";
  editFormContainer.style.pointerEvents = "none";
}

const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
const deleteMessage = document.getElementById("delete-message");

confirmDeleteButton.addEventListener("click", async () => {
  const q = query(
    collection(db, "tb_projects"),
    where("project_id", "==", Number(selectedRowId))
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  await deleteDoc(snapshot.docs[0].ref);
  fetch_projects();
  showDeleteMessage("Record deleted successfully!", true);
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

cancelDeleteButton.addEventListener("click", () => {
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

async function fetch_status() {
  const snapshot = await getDocs(collection(db, "tb_projects"));
  const addedStatus = new Set();
  snapshot.forEach((doc) => {
    const status = doc.data().status?.toUpperCase();
    if (status && !addedStatus.has(status)) {
      addedStatus.add(status);
      const option = document.createElement("option");
      option.value = option.textContent = status;
      statusSelect.appendChild(option);
    }
  });
}

function showDeleteMessage(message, success = true) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.display = "block";
  deleteMessage.style.opacity = "1";
  setTimeout(() => {
    deleteMessage.style.opacity = "0";
    setTimeout(() => (deleteMessage.style.display = "none"), 400);
  }, 4000);
}

fetch_filtered_status();
