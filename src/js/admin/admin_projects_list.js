import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
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

const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
const deleteMessage = document.getElementById("delete-message");
let selectedRowId = null;

const extendDatePanel = document.createElement("div");
extendDatePanel.id = "extend-date-panel";
extendDatePanel.style.display = "none";
extendDatePanel.style.position = "fixed";
extendDatePanel.style.top = "50%";
extendDatePanel.style.left = "50%";
extendDatePanel.style.transform = "translate(-50%, -50%)";
extendDatePanel.style.backgroundColor = "white";
extendDatePanel.style.padding = "20px";
extendDatePanel.style.borderRadius = "10px";
extendDatePanel.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
extendDatePanel.style.zIndex = "1000";
document.body.appendChild(extendDatePanel);

let selectedExtendProjectId = null;

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(
            collection(db, "tb_users"),
            where("email", "==", user.email)
          );
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            resolve(userData.user_type);
          } else {
            reject("User record not found.");
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject("User not authenticated.");
      }
    });
  });
}

let currentPage = 1;
const rowsPerPage = 5;
let projectList = [];

async function fetch_projects(filter = {}) {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_projects"));
    projectList = [];
    let projectIdList = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const projectId = String(data.project_id || "");
      projectIdList.push(projectId);

      const searchTerm = filter.search?.toLowerCase();
      const matchesSearch = searchTerm
        ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
          `${data.farm_president || ""}`.toLowerCase().includes(searchTerm) ||
          (data.start_date || "").includes(searchTerm) ||
          (data.end_date || "").includes(searchTerm) ||
          (data.crop_type_name || "").toLowerCase().includes(searchTerm) ||
          (data.status || "").toLowerCase().includes(searchTerm)
        : true;

      const matchesStatus = filter.status
        ? (data.status || "pending").toLowerCase() ===
          filter.status.toLowerCase()
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

    currentPage = 1;
    await updateTable();
    updatePagination();
  } catch (error) {
    console.error("Error Fetching Projects:", error);
  }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name) {
  return project_name ? capitalizeWords(project_name) : "";
}

function formatFarmPresident(farm_president) {
  return farm_president ? capitalizeWords(farm_president) : "";
}

function formatCrop(crop_type_name) {
  return crop_type_name ? capitalizeWords(crop_type_name) : "";
}

function formatStatus(status) {
  return status ? capitalizeWords(status) : "Pending"; // Default to "Pending" if status is missing
}

// <------------------ FUNCTION TO LOG PROJECT DETAILS TO CONSOLE ------------------------>
async function logProjectDetails() {
  console.log("----- PROJECT DETAILS -----");
  for (const [index, project] of projectList.entries()) {
    const progress = await calculateProjectProgress(project.project_id);
    console.log(`Project #${index + 1}:`, {
      ID: project.project_id,
      Name: project.project_name,
      President: project.farm_president,
      Dates: `${project.start_date} - ${project.end_date}`,
      Crop: project.crop_type_name,
      Status: project.status || "Pending", // Default to "Pending" in logs
      Progress: `${progress}%`,
    });
  }
  console.log("---------------------------");
}

// <------------- FUNCTION TO CALCULATE PROJECT PROGRESS ------------->
async function calculateProjectProgress(project_id) {
  try {
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

// <------------- TABLE DISPLAY AND UPDATE ------------->
async function updateTable() {
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

    const progressPercentage = await calculateProjectProgress(data.project_id);

    const extendButton =
      (data.status || "pending").toLowerCase() === "ongoing"
        ? `<button class="action-btn extend-btn" data-id="${data.project_id}" title="Extend Date">+ Extend Date</button>`
        : "";

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
            <td>${formattedStatus}</td>
            <td>
                <button class="action-btn view-btn" data-id="${
                  data.project_id
                }" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
                <button class="action-btn edit-btn" data-id="${
                  data.project_id
                }" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn delete-btn" data-id="${
                  data.project_id
                }" title="Delete">
                    <img src="../../images/delete.png" alt="Delete">
                </button>
                ${extendButton}
            </td>
        `;
    tableBody.appendChild(row);
  }

  updatePagination();
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

function changePage(direction) {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  if (direction === "prev" && currentPage > 1) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages) {
    currentPage++;
  }
  updateTable();
  updatePagination();
}

prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const project_id = target.getAttribute("data-id");

  if (target.classList.contains("edit-btn")) {
    editUserAccount(project_id);
  } else if (target.classList.contains("view-btn")) {
    viewUserAccount(project_id);
  } else if (target.classList.contains("delete-btn")) {
    deleteProjects(project_id);
  } else if (target.classList.contains("extend-btn")) {
    showExtendDatePanel(project_id);
  }
});

// <------------- EXTEND DATE PANEL AND HANDLER ------------->
async function showExtendDatePanel(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const projectData = querySnapshot.docs[0].data();
      selectedExtendProjectId = project_id;

      if (projectData.extend_date) {
        extendDatePanel.innerHTML = `
                    <h3>Extend Project Date</h3>
                    <p>Start Date: ${projectData.start_date || "Not set"}</p>
                    <p>Current End Date: ${
                      projectData.end_date || "Not set"
                    }</p>
                    <p>Extended Date: ${projectData.extend_date}</p>
                    <p style="color: red;">This project has already been extended once. No further extensions allowed.</p>
                    <div style="margin-top: 20px;">
                        <button id="close-extend">Close</button>
                    </div>
                `;
        extendDatePanel.style.display = "block";
        document.body.style.overflow = "hidden";

        document
          .getElementById("close-extend")
          .addEventListener("click", () => {
            extendDatePanel.style.display = "none";
            document.body.style.overflow = "auto";
            selectedExtendProjectId = null;
          });
      } else {
        extendDatePanel.innerHTML = `
                    <h3>Extend Project Date</h3>
                    <p>Start Date: ${projectData.start_date || "Not set"}</p>
                    <p>Current End Date: ${
                      projectData.end_date || "Not set"
                    }</p>
                    <label for="extend-date-input">New Extension Date:</label>
                    <input type="date" id="extend-date-input">
                    <div id="extend-error" style="color: red; display: none;"></div>
                    <div style="margin-top: 20px;">
                        <button id="cancel-extend">Cancel</button>
                        </div>
                        <button id="confirm-extend">Confirm</button>
                      
                `;

        extendDatePanel.style.display = "block";
        document.body.style.overflow = "hidden";

        document
          .getElementById("confirm-extend")
          .addEventListener("click", () => handleExtendDate(projectData));
        document
          .getElementById("cancel-extend")
          .addEventListener("click", () => {
            extendDatePanel.style.display = "none";
            document.body.style.overflow = "auto";
            selectedExtendProjectId = null;
          });
      }
    }
  } catch (error) {
    console.error("Error showing extend date panel:", error);
    showDeleteMessage("Error loading project data.", false);
  }
}

async function handleExtendDate(projectData) {
  const extendDateInput = document.getElementById("extend-date-input").value;
  const errorDiv = document.getElementById("extend-error");

  if (!extendDateInput) {
    errorDiv.textContent = "Please select a new end date.";
    errorDiv.style.display = "block";
    return;
  }

  const currentEndDate = new Date(projectData.end_date);
  const newEndDate = new Date(extendDateInput);

  if (newEndDate <= currentEndDate) {
    errorDiv.textContent =
      "New end date must be later than the current end date.";
    errorDiv.style.display = "block";
    return;
  }

  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(selectedExtendProjectId))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      const latestData = querySnapshot.docs[0].data();

      if (latestData.extend_date) {
        showDeleteMessage(
          "This project has already been extended once.",
          false
        );
        extendDatePanel.style.display = "none";
        document.body.style.overflow = "auto";
        selectedExtendProjectId = null;
        return;
      }

      await updateDoc(docRef, {
        extend_date: extendDateInput,
      });

      extendDatePanel.style.display = "none";
      document.body.style.overflow = "auto";
      showDeleteMessage("Project extension date added successfully!", true);
      fetch_projects();
      selectedExtendProjectId = null;
    }
  } catch (error) {
    console.error("Error adding extension date:", error);
    showDeleteMessage("Error updating project extension date.", false);
  }
}

// <------------- EDIT BUTTON CODE ------------->
async function editUserAccount(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const projectData = doc.data();
        if ((projectData.status || "pending").toLowerCase() === "ongoing") {
          showDeleteMessage(
            "Editing is not allowed for ongoing projects.",
            false
          );
          return;
        }
        localStorage.setItem("projectData", JSON.stringify(projectData));
        window.location.href = "admin_projects_edit.html";
      });
    } else {
      showDeleteMessage("No matching record found.", false);
    }
  } catch (error) {
    console.error("Error fetching user data for edit:", error);
  }
}

// <------------- VIEW BUTTON CODE ------------->
function viewUserAccount(projectId) {
  sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10));
  window.location.href = "viewproject.html";
}

// <------------- DELETE PROJECTS FUNCTION ------------->
async function deleteProjects(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnapshot = querySnapshot.docs[0];
      const docRef = docSnapshot.ref;
      const projectData = docSnapshot.data();
      const status = (projectData.status || "pending").toLowerCase();

      if (status === "ongoing") {
        showDeleteMessage(
          "Project cannot be deleted because it is already ongoing.",
          false
        );
        return;
      } else if (status === "pending") {
        selectedRowId = docRef.id;
        confirmationPanel.style.display = "flex";
        editFormContainer.style.pointerEvents = "none";
      } else {
        showDeleteMessage(
          "Deletion not allowed for this project status.",
          false
        );
      }
    } else {
      showDeleteMessage("No project found.", false);
    }
  } catch (error) {
    console.error("Error finding project:", error);
    showDeleteMessage("Error finding project.", false);
  }
}

// <------------- DELETE CONFIRMATION HANDLER ------------->
confirmDeleteButton.addEventListener("click", async () => {
  if (!selectedRowId) return;

  try {
    const projectDocRef = doc(db, "tb_projects", selectedRowId);
    const projectSnapshot = await getDoc(projectDocRef);

    if (!projectSnapshot.exists()) {
      showDeleteMessage("Project not found.", false);
      return;
    }

    const projectData = projectSnapshot.data();
    const projectCreator = projectData.project_creator?.toLowerCase();

    if ((projectData.status || "pending").toLowerCase() !== "pending") {
      showDeleteMessage(
        "Project cannot be deleted because it is not in 'Pending' status.",
        false
      );
      return;
    }

    let cropUpdated = false;
    let allFertilizersUpdated = true;
    let allEquipmentUpdated = true;

    if (projectData.crop_type_name && projectData.crop_type_quantity) {
      const cropStockQuery = query(
        collection(db, "tb_crop_stock"),
        where("crop_type_name", "==", projectData.crop_type_name)
      );
      const cropStockSnapshot = await getDocs(cropStockQuery);

      if (!cropStockSnapshot.empty) {
        const cropStockDoc = cropStockSnapshot.docs[0];
        const cropStockRef = doc(db, "tb_crop_stock", cropStockDoc.id);
        let stockArray = cropStockDoc.data().stocks || [];
        const userStockIndex = stockArray.findIndex(
          (stock) => stock.owned_by?.toLowerCase() === projectCreator
        );

        if (userStockIndex !== -1) {
          stockArray[userStockIndex].current_stock +=
            projectData.crop_type_quantity;
        } else {
          stockArray.push({
            owned_by: projectCreator,
            current_stock: projectData.crop_type_quantity,
          });
        }
        await updateDoc(cropStockRef, { stocks: stockArray });
        cropUpdated = true;
      } else {
        throw new Error(
          `Crop stock for ${projectData.crop_type_name} not found`
        );
      }
    } else {
      cropUpdated = true;
    }

    if (
      projectData.fertilizer &&
      Array.isArray(projectData.fertilizer) &&
      projectData.fertilizer.length > 0
    ) {
      for (const fertilizer of projectData.fertilizer) {
        if (!fertilizer.fertilizer_name || !fertilizer.fertilizer_quantity)
          continue;

        const fertilizerStockQuery = query(
          collection(db, "tb_fertilizer_stock"),
          where("fertilizer_name", "==", fertilizer.fertilizer_name)
        );
        const fertilizerStockSnapshot = await getDocs(fertilizerStockQuery);

        if (!fertilizerStockSnapshot.empty) {
          const fertilizerStockDoc = fertilizerStockSnapshot.docs[0];
          const fertilizerStockRef = doc(
            db,
            "tb_fertilizer_stock",
            fertilizerStockDoc.id
          );
          let stockArray = fertilizerStockDoc.data().stocks || [];
          const userStockIndex = stockArray.findIndex(
            (stock) => stock.owned_by?.toLowerCase() === projectCreator
          );

          if (userStockIndex !== -1) {
            stockArray[userStockIndex].current_stock +=
              fertilizer.fertilizer_quantity;
          } else {
            stockArray.push({
              owned_by: projectCreator,
              current_stock: fertilizer.fertilizer_quantity,
            });
          }
          await updateDoc(fertilizerStockRef, { stocks: stockArray });
        } else {
          allFertilizersUpdated = false;
          throw new Error(
            `Fertilizer stock for ${fertilizer.fertilizer_name} not found`
          );
        }
      }
    } else {
      allFertilizersUpdated = true;
    }

    if (
      projectData.equipment &&
      Array.isArray(projectData.equipment) &&
      projectData.equipment.length > 0
    ) {
      for (const equipment of projectData.equipment) {
        if (!equipment.equipment_name || !equipment.equipment_quantity)
          continue;

        const equipmentStockQuery = query(
          collection(db, "tb_equipment_stock"),
          where("equipment_name", "==", equipment.equipment_name)
        );
        const equipmentStockSnapshot = await getDocs(equipmentStockQuery);

        if (!equipmentStockSnapshot.empty) {
          const equipmentStockDoc = equipmentStockSnapshot.docs[0];
          const equipmentStockRef = doc(
            db,
            "tb_equipment_stock",
            equipmentStockDoc.id
          );
          let stockArray = equipmentStockDoc.data().stocks || [];
          const userStockIndex = stockArray.findIndex(
            (stock) => stock.owned_by?.toLowerCase() === projectCreator
          );

          if (userStockIndex !== -1) {
            stockArray[userStockIndex].current_stock +=
              equipment.equipment_quantity;
          } else {
            stockArray.push({
              owned_by: projectCreator,
              current_stock: equipment.equipment_quantity,
            });
          }
          await updateDoc(equipmentStockRef, { stocks: stockArray });
        } else {
          allEquipmentUpdated = false;
          throw new Error(
            `Equipment stock for ${equipment.equipment_name} not found`
          );
        }
      }
    } else {
      allEquipmentUpdated = true;
    }

    if (cropUpdated && allFertilizersUpdated && allEquipmentUpdated) {
      await deleteDoc(projectDocRef);
      showDeleteMessage(
        "Project Record has been successfully deleted and stock has been restored!",
        true
      );
      fetch_projects();
    } else {
      showDeleteMessage("Stock update failed. Project not deleted.", false);
    }
  } catch (error) {
    console.error("Error deleting record:", error);
    showDeleteMessage(`Error: ${error.message}`, false);
  }

  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
  selectedRowId = null;
});

cancelDeleteButton.addEventListener("click", () => {
  confirmationPanel.style.display = "none";
  editFormContainer.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
  selectedRowId = null;
});

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", () => {
  fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

statusSelect.addEventListener("change", () => {
  fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

// <----------------------- STATUS DROP DOWN CODE ----------------------->
async function fetch_status() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_projects"));
    let addedStatus = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let statusName = data.status || "Pending"; // Default to "Pending" if status is missing
      if (!statusName || statusName.trim() === "") statusName = "Pending";

      statusName =
        statusName.charAt(0).toUpperCase() + statusName.slice(1).toLowerCase();
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

// <------------------ FUNCTION TO DISPLAY DELETE MESSAGE ------------------------>
function showDeleteMessage(message, success) {
  deleteMessage.querySelector("p").textContent = message;
  deleteMessage.style.backgroundColor = success ? "#41A186" : "#f44336";
  deleteMessage.style.opacity = "1";
  deleteMessage.style.display = "block";

  setTimeout(() => {
    deleteMessage.style.opacity = "0";
    setTimeout(() => {
      deleteMessage.style.display = "none";
    }, 400);
  }, 4000);
}

// <------------- REAL-TIME LISTENER FOR MOVING COMPLETED PROJECTS ------------->
function setupProjectHistoryListener() {
  const projectsCollection = collection(db, "tb_projects");
  const historyCollection = collection(db, "tb_project_history");

  onSnapshot(projectsCollection, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const projectData = change.doc.data();
      const projectId = change.doc.id;

      // Treat missing or empty status as "Pending"
      const status = (projectData.status || "pending").toLowerCase();

      if (status === "completed") {
        try {
          await setDoc(doc(historyCollection, projectId), {
            ...projectData,
            moved_to_history_timestamp: new Date().toISOString(),
          });
          await deleteDoc(doc(db, "tb_projects", projectId));
          fetch_projects();
        } catch (error) {
          console.error("Error moving completed project to history:", error);
        }
      }
    });
  });
}

// <------------- INITIALIZATION ------------->
document.addEventListener("DOMContentLoaded", () => {
  const successMessage = localStorage.getItem("successMessage");
  if (successMessage) {
    showDeleteMessage(successMessage, true);
    localStorage.removeItem("successMessage");
  }
  setupProjectHistoryListener();
  fetch_projects().then(() => logProjectDetails());
});

fetch_status();
