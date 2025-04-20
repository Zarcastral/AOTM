import {
  collection,
  getDocs,
  getDoc,
  getFirestore,
  query,
  where,
  deleteDoc,
  updateDoc,
  Timestamp,
  onSnapshot,
  addDoc,
  arrayRemove,
  doc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// <-------------= ACTIVITY LOGGING START =---------------->
/*
      ACTIVITY LOG RECORD FORMAT
      await saveActivityLog("Update", );
      await saveActivityLog("Delete", );
      await saveActivityLog("Create", );
*/
async function saveActivityLog(action, description) {
  // Define allowed actions
  const allowedActions = ["Create", "Update", "Delete"];
  
  // Validate action
  if (!allowedActions.includes(action)) {
    console.error("Invalid action. Allowed actions are: create, update, delete.");
    return;
  }

  // Ensure description is provided
  if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
  }

  // Use onAuthStateChanged to wait for authentication status
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch authenticated user's data from tb_users collection
      const userDocRef = doc(db, "tb_users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error("User data not found in tb_users.");
        return;
      }

      const userData = userDocSnap.data();
      const userName = userData.user_name || "Unknown User";
      const userType = userData.user_type || "Unknown Type";

      const currentTimestamp = Timestamp.now().toDate();
      const date = currentTimestamp.toLocaleDateString("en-US");
      const time = currentTimestamp.toLocaleTimeString("en-US");

      const activityLogCollection = collection(db, "tb_activity_log");

      try {
        // Fetch and increment the activity_log_id_counter
        const counterDocRef = doc(db, "tb_id_counters", "activity_log_id_counter");
        const counterDocSnap = await getDoc(counterDocRef);

        if (!counterDocSnap.exists()) {
          console.error("Counter document not found.");
          return;
        }

        let currentCounter = counterDocSnap.data().value || 0;
        let newCounter = currentCounter + 1;

        // Update the counter in the database
        await updateDoc(counterDocRef, { value: newCounter });

        // Use the incremented counter as activity_log_id
        await addDoc(activityLogCollection, {
          activity_log_id: newCounter, // Use counter instead of a placeholder
          username: userName,
          user_type: userType,
          activity: action,
          activity_desc: description, // Add descriptive message
          date: date,
          time: time
        });

        console.log("Activity log saved successfully with ID:", newCounter);
      } catch (error) {
        console.error("Error saving activity log:", error);
      }
    } else {
      console.error("No authenticated user found.");
    }
  });
}
// <-------------= ACTIVITY LOGGING END =---------------->

// <-------------= GLOBAL VARIABLES START =---------------->
let projectsList = []; // Full list of projects
let filteredProjects = []; // Filtered list of projects
let currentPage = 1;
const rowsPerPage = 5;
let selectedProjects = [];
let originalProjectsList = [];
let selectedMonth = null;
let selectedYear = new Date().getFullYear(); // Default to current year
// <-------------= GLOBAL VARIABLES END =---------------->

// <-------------= FETCH AUTHENTICATED USER START =---------------->
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            resolve({ ...user, user_type: userData.user_type });
          } else {
            console.error("User record not found in tb_users collection.");
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user_type:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated. Please log in.");
        reject("User not authenticated.");
      }
    });
  });
}
// <-------------= FETCH AUTHENTICATED USER END =---------------->

// <-------------= FETCH PROJECTS START =---------------->
async function fetchProjects() {
  try {
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;
    const projectsCollection = collection(db, "tb_projects");
    const projectHistoryCollection = collection(db, "tb_project_history");
    const projectsQuery = query(projectsCollection);
    const projectHistoryQuery = query(projectHistoryCollection);

    // Combine listeners for both collections
    const unsubscribeProjects = onSnapshot(projectsQuery, async (projectsSnapshot) => {
      const unsubscribeHistory = onSnapshot(projectHistoryQuery, async (historySnapshot) => {
        // Step 1: Collect unique farmland_ids from both collections as numbers
        const farmlandIds = new Set();
        
        // Process tb_projects
        projectsSnapshot.docs.forEach(docSnapshot => {
          const project = docSnapshot.data();
          if (project.farmland_id !== undefined && project.farmland_id !== null) {
            farmlandIds.add(Number(project.farmland_id)); // Ensure it's a number
          }
        });

        // Process tb_project_history
        historySnapshot.docs.forEach(docSnapshot => {
          const project = docSnapshot.data();
          if (project.farmland_id !== undefined && project.farmland_id !== null) {
            farmlandIds.add(Number(project.farmland_id)); // Ensure it's a number
          }
        });

        console.log("Unique farmland_ids from projects and history:", Array.from(farmlandIds));

        // Step 2: Fetch relevant farmland documents
        let farmlandMap = new Map();
        if (farmlandIds.size > 0) {
          const farmlandIdsArray = Array.from(farmlandIds);
          const batchSize = 10; // Firestore 'in' query limit
          const batches = [];
          for (let i = 0; i < farmlandIdsArray.length; i += batchSize) {
            const batch = farmlandIdsArray.slice(i, i + batchSize);
            batches.push(batch);
          }

          const farmlandCollection = collection(db, "tb_farmland");
          const farmlandPromises = batches.map(batch => {
            const farmlandQuery = query(farmlandCollection, where("farmland_id", "in", batch));
            return getDocs(farmlandQuery);
          });

          const farmlandSnapshots = await Promise.all(farmlandPromises);
          farmlandSnapshots.forEach(snapshot => {
            console.log("Farmland documents fetched in batch:", snapshot.docs.length);
            snapshot.forEach(doc => {
              const data = doc.data();
              const farmlandId = Number(data.farmland_id); // Ensure it's a number
              farmlandMap.set(farmlandId, data.land_area || "N/A");
              console.log(`Farmland ID: ${farmlandId}, Land Area: ${data.land_area || "N/A"}`);
            });
          });
        } else {
          console.log("No farmland_ids found in projects or history.");
        }

        // Step 2.5: Fetch task counts from tb_project_task
        const taskCollection = collection(db, "tb_project_task");
        const taskSnapshot = await getDocs(taskCollection);
        const taskCountMap = new Map();
        
        // Count tasks per project_id (project_id in tb_project_task is a string)
        taskSnapshot.docs.forEach(taskDoc => {
          const taskData = taskDoc.data();
          const projectId = taskData.project_id; // String in tb_project_task
          if (projectId !== undefined && projectId !== null) {
            const currentCount = taskCountMap.get(projectId) || 0;
            taskCountMap.set(projectId, currentCount + 1);
          }
        });

        console.log("Task counts per project:", Object.fromEntries(taskCountMap));

        // Step 3: Process projects from both collections
        projectsList = [];

        // Process tb_projects
        projectsSnapshot.docs.forEach((docSnapshot) => {
          const project = docSnapshot.data();
          project.id = docSnapshot.id;
          project.source = "tb_projects"; // Add source for debugging

          // Log project farmland_id for debugging
          console.log(`Project ID: ${project.project_id}, Farmland ID: ${project.farmland_id}, Source: {tb_projects}`);

          // Get land_area using farmland_id
          if (project.farmland_id !== undefined && project.farmland_id !== null) {
            const farmlandId = Number(project.farmland_id); // Ensure it's a number
            const landArea = farmlandMap.get(farmlandId);
            project.land_area = landArea !== undefined ? landArea : "N/A";
            console.log(`Farmland ID ${farmlandId} lookup result: ${project.land_area}`);
          } else {
            project.land_area = "N/A";
            console.log(`No farmland_id for Project ID: ${project.project_id}`);
          }

          // Add task count to project (convert project_id to string for lookup)
          const projectId = String(project.project_id); // Convert number to string to match tb_project_task
          project.task_count = taskCountMap.get(projectId) || 0;
          console.log(`Project ID: ${projectId}, Task Count: ${project.task_count}`);

          // Extract equipment names from the equipment array
          if (project.equipment && Array.isArray(project.equipment) && project.equipment.length > 0) {
            const equipmentNames = project.equipment
              .map((equip) => equip.equipment_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.equipment.every(e => !e.equipment_name));
            project.equipment = equipmentNames.length > 0 ? equipmentNames.join("<br>") : "N/A";
          } else {
            project.equipment = "N/A";
          }

          // Extract fertilizer names from the fertilizer array
          if (project.fertilizer && Array.isArray(project.fertilizer) && project.fertilizer.length > 0) {
            const fertilizerNames = project.fertilizer
              .map((fert) => fert.fertilizer_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.fertilizer.every(f => !f.fertilizer_name));
            project.fertilizer = fertilizerNames.length > 0 ? fertilizerNames.join("<br>") : "N/A";
          } else {
            project.fertilizer = "N/A";
          }

          // Extract farmer names from the farmer_name array
          if (project.farmer_name && Array.isArray(project.farmer_name) && project.farmer_name.length > 0) {
            const farmerNames = project.farmer_name
              .map((farmer) => farmer.farmer_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.farmer_name.every(f => !f.farmer_name));
            project.farmer_name = farmerNames.length > 0 ? farmerNames.join("<br>") : "N/A";
          } else {
            project.farmer_name = "N/A";
          }

          projectsList.push(project);
        });

        // Process tb_project_history
        historySnapshot.docs.forEach((docSnapshot) => {
          const project = docSnapshot.data();
          project.id = docSnapshot.id;
          project.source = "tb_project_history"; // Add source for debugging

          // Log project farmland_id for debugging
          console.log(`Project ID: ${project.project_id}, Farmland ID: ${project.farmland_id}, Source: tb_project_history`);

          // Get land_area using farmland_id
          if (project.farmland_id !== undefined && project.farmland_id !== null) {
            const farmlandId = Number(project.farmland_id); // Ensure it's a number
            const landArea = farmlandMap.get(farmlandId);
            project.land_area = landArea !== undefined ? landArea : "N/A";
            console.log(`Farmland ID ${farmlandId} lookup result: ${project.land_area}`);
          } else {
            project.land_area = "N/A";
            console.log(`No farmland_id for Project ID: ${project.project_id}`);
          }

          // Add task count to project (convert project_id to string for lookup)
          const projectId = String(project.project_id); // Convert number to string to match tb_project_task
          project.task_count = taskCountMap.get(projectId) || 0;
          console.log(`Project ID: ${projectId}, Task Count: ${project.task_count}`);

          // Extract equipment names from the equipment array
          if (project.equipment && Array.isArray(project.equipment) && project.equipment.length > 0) {
            const equipmentNames = project.equipment
              .map((equip) => equip.equipment_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.equipment.every(e => !e.equipment_name));
            project.equipment = equipmentNames.length > 0 ? equipmentNames.join("<br>") : "N/A";
          } else {
            project.equipment = "N/A";
          }

          // Extract fertilizer names from the fertilizer array
          if (project.fertilizer && Array.isArray(project.fertilizer) && project.fertilizer.length > 0) {
            const fertilizerNames = project.fertilizer
              .map((fert) => fert.fertilizer_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.fertilizer.every(f => !f.fertilizer_name));
            project.fertilizer = fertilizerNames.length > 0 ? fertilizerNames.join("<br>") : "N/A";
          } else {
            project.fertilizer = "N/A";
          }

          // Extract farmer names from the farmer_name array
          if (project.farmer_name && Array.isArray(project.farmer_name) && project.farmer_name.length > 0) {
            const farmerNames = project.farmer_name
              .map((farmer) => farmer.farmer_name || "Unknown")
              .filter((name) => name !== "Unknown" || project.farmer_name.every(f => !f.farmer_name));
            project.farmer_name = farmerNames.length > 0 ? farmerNames.join("<br>") : "N/A";
          } else {
            project.farmer_name = "N/A";
          }

          projectsList.push(project);
        });

        originalProjectsList = projectsList;
        filterProjects();
      }, (error) => {
        console.error("Error listening to Project History:", error);
      });
    }, (error) => {
      console.error("Error listening to Projects:", error);
    });
  } catch (error) {
    console.error("Error fetching Projects:", error);
  }
}
// <-------------= FETCH PROJECTS END =---------------->

// <-------------= FETCH BARANGAY NAMES START =---------------->
async function fetchBarangayNames() {
  const barangaysCollection = collection(db, "tb_barangay");
  const barangaysSnapshot = await getDocs(barangaysCollection);
  const barangayNames = barangaysSnapshot.docs.map(doc => doc.data().barangay_name);

  populateBarangayDropdown(barangayNames);
}
// <-------------= FETCH BARANGAY NAMES END =---------------->

// <-------------= POPULATE BARANGAY DROPDOWN START =---------------->
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
// <-------------= POPULATE BARANGAY DROPDOWN END =---------------->

// <-------------= FETCH CROP TYPE NAMES START =---------------->
async function fetchCropTypeNames() {
  const cropTypesCollection = collection(db, "tb_crop_types");
  const cropTypesSnapshot = await getDocs(cropTypesCollection);
  const cropTypeNames = cropTypesSnapshot.docs.map(doc => doc.data().crop_type_name);

  populateCropTypeDropdown(cropTypeNames);
}
// <-------------= FETCH CROP TYPE NAMES END =---------------->

// <-------------= POPULATE CROP TYPE DROPDOWN START =---------------->
function populateCropTypeDropdown(cropTypeNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop type dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";

  cropSelect.innerHTML = firstOption;

  cropTypeNames.forEach(cropTypeName => {
    const option = document.createElement("option");
    option.textContent = cropTypeName;
    option.value = cropTypeName;
    cropSelect.appendChild(option);
  });
}
// <-------------= POPULATE CROP TYPE DROPDOWN END =---------------->

// <-------------= PARSE DATES START =---------------->
function parseDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }

  return new Date(dateValue);
}
// <-------------= PARSE DATES END =---------------->

// <-------------= SORT PROJECTS BY STATUS AND DATE START =---------------->
function sortProjectsById() {
  filteredProjects.sort((a, b) => {
    // Define status priority (lower number = higher priority)
    const statusPriority = {
      "Completed": 0,
      "Ongoing": 1,
      "Pending": 2,
      "Failed": 3
    };

    // Get status values, defaulting to a low-priority value if not found
    const statusA = a.status || "Pending"; // Default to Pending if status is missing
    const statusB = b.status || "Pending";
    const priorityA = statusPriority[statusA] !== undefined ? statusPriority[statusA] : 4; // Default to 4 if status not in map
    const priorityB = statusPriority[statusB] !== undefined ? statusPriority[statusB] : 4;

    // Compare statuses first
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Sort by status priority
    }

    // If statuses are the same, sort by date
    const startDateA = a.start_date ? parseDate(a.start_date) : null;
    const endDateA = a.end_date ? parseDate(a.end_date) : null;
    const startDateB = b.start_date ? parseDate(b.start_date) : null;
    const endDateB = b.end_date ? parseDate(b.end_date) : null;

    const latestDateA = endDateA || startDateA;
    const latestDateB = endDateB || startDateB;

    if (latestDateA && latestDateB) {
      return latestDateB - latestDateA; // Latest date first
    } else if (!latestDateA && !latestDateB) {
      return a.project_id - b.project_id; // Fallback to project_id if no dates
    } else {
      return latestDateB ? 1 : -1; // Handle cases where one date is missing
    }
  });
}
// <-------------= SORT PROJECTS BY STATUS AND DATE END =---------------->

// <-------------= FILTER PROJECTS START =---------------->
function filterProjects() {
  const searchQuery = document.getElementById("projects-search-bar").value.toLowerCase().trim();
  const selectedBarangay = document.querySelector(".barangay_select").value.toLowerCase();
  const selectedCropType = document.querySelector(".crop_select").value.toLowerCase();
  const selectedStatus = document.querySelector(".status_select").value.toLowerCase();

  // Start with the full projects list
  filteredProjects = [...originalProjectsList];

  // Apply search query filter
  if (searchQuery) {
    filteredProjects = filteredProjects.filter(project => {
      return (
        project.project_name?.toLowerCase().includes(searchQuery) ||
        project.project_type?.toLowerCase().includes(searchQuery) ||
        project.project_id?.toString().includes(searchQuery)
      );
    });
  }

  // Apply barangay filter (only if a barangay is selected)
  if (selectedBarangay) {
    filteredProjects = filteredProjects.filter(project => project.barangay_name?.toLowerCase() === selectedBarangay);
  }

  // Apply crop type filter (only if a crop type is selected)
  if (selectedCropType) {
    filteredProjects = filteredProjects.filter(project => project.crop_type_name?.toLowerCase() === selectedCropType);
  }

  // Apply status filter (only if a status is selected)
  if (selectedStatus) {
    filteredProjects = filteredProjects.filter(project => project.status?.toLowerCase() === selectedStatus);
  }

  // Apply month/year filter (if applicable)
  if (selectedMonth) {
    filteredProjects = filteredProjects.filter(project => {
      const startDate = project.start_date ? parseDate(project.start_date) : null;
      const endDate = project.end_date ? parseDate(project.end_date) : null;

      const startMonth = startDate ? startDate.getMonth() + 1 : null;
      const startYear = startDate ? startDate.getFullYear() : null;
      const endMonth = endDate ? endDate.getMonth() + 1 : null;
      const endYear = endDate ? endDate.getFullYear() : null;

      return (
        (startMonth === selectedMonth && startYear === selectedYear) ||
        (endMonth === selectedMonth && endYear === selectedYear)
      );
    });
  }

  // Reset pagination and update the table
  currentPage = 1;
  sortProjectsById();
  displayProjects(filteredProjects);
}
// <-------------= FILTER PROJECTS END =---------------->

// <-------------= FILTER PROJECTS BY MONTH START =---------------->
function filterProjectsByMonth() {
  filterProjects();
}
// <-------------= FILTER PROJECTS BY MONTH END =---------------->

// <-------------= CLEAR MONTH FILTER START =---------------->
function clearMonthFilter() {
  selectedMonth = null;
  selectedYear = new Date().getFullYear();
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  calendarIcon.style.filter = 'none';
  document.querySelectorAll('#month-picker .month-btn').forEach(btn => {
    btn.style.backgroundColor = 'transparent';
  });
  const yearDisplay = document.getElementById('year-display');
  if (yearDisplay) {
    yearDisplay.textContent = selectedYear;
  }
  filterProjects();
}
// <-------------= CLEAR MONTH FILTER END =---------------->

// <-------------= SHOW MONTH PICKER START =---------------->
function showMonthPicker() {
  const calendarIcon = document.querySelector('.calendar-btn-icon');
  const monthPicker = document.getElementById('month-picker');
  const yearDisplay = document.getElementById('year-display');
  
  if (yearDisplay) {
    yearDisplay.textContent = selectedYear;
  }

  monthPicker.style.position = 'absolute';
  monthPicker.style.top = `${calendarIcon.offsetHeight + 5}px`;
  monthPicker.style.right = '0px';
  monthPicker.style.left = 'auto';

  monthPicker.style.display = monthPicker.style.display === 'none' ? 'block' : 'none';
}
// <-------------= SHOW MONTH PICKER END =---------------->

// <-------------= DISPLAY PROJECTS IN TABLE START =---------------->
function displayProjects(projectsList) {
  const tableBody = document.querySelector(".projects_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .projects_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedProjects = projectsList.slice(startIndex, endIndex);

  if (paginatedProjects.length === 0) {
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="14" style="text-align: center; color: red;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedProjects.forEach((project) => {
    const row = document.createElement("tr");
    const projectId = project.project_id || "project Id not recorded";
    const projectName = project.project_name || "project Name not recorded";
    const projectStatus = project.status || "N/A";
    const projectFarmPres = project.farm_president || "N/A";
    const projectBarangay = project.barangay_name || "N/A";
    const projectCategory = project.crop_name || "N/A";
    const projectCropType = project.crop_type_name || "N/A";
    const projectEquipment = project.equipment || "N/A";
    const projectStart = project.start_date || "N/A";
    const projectEnd = project.end_date || "N/A";
    const equipmentList = Array.isArray(project.equipment) ? project.equipment.join("<br>") : (project.equipment || "N/A");
    const fertilizerList = Array.isArray(project.fertilizer) ? project.fertilizer.join("<br>") : (project.fertilizer || "N/A");
    const farmersName = Array.isArray(project.farmer_name) ? project.farmer_name.join("<br>") : (project.farmer_name || "N/A");
    const leadFarmer = project.lead_farmer || "N/A";
    const landArea = project.land_area || "N/A";
    const taskCount = project.task_count !== undefined ? project.task_count : "N/A";

    row.innerHTML = `
      <td>${projectId}</td>
      <td>${projectName}</td>
      <td>${taskCount}</td>
      <td>${projectStatus}</td>
      <td>${projectFarmPres}</td>
      <td>${leadFarmer}</td>
      <td>${farmersName}</td>
      <td>${projectBarangay}</td>
      <td>${landArea}</td>
      <td>${projectCategory}</td>
      <td>${projectCropType}</td>
      <td>${equipmentList}</td>
      <td>${fertilizerList}</td>
      <td>${projectStart} <br> ${projectEnd}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}
// <-------------= DISPLAY PROJECTS IN TABLE END =---------------->

// <-------------= UPDATE PAGINATION DISPLAY START =---------------->
function updatePagination() {
  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage) || 1;
  document.getElementById("projects-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}
// <-------------= UPDATE PAGINATION DISPLAY END =---------------->

// <-------------= UPDATE PAGINATION BUTTONS START =---------------->
function updatePaginationButtons() {
  document.getElementById("projects-prev-page").disabled = currentPage === 1;
  document.getElementById("projects-next-page").disabled = currentPage >= Math.ceil(filteredProjects.length / rowsPerPage);
}
// <-------------= UPDATE PAGINATION BUTTONS END =---------------->

// <-------------= EVENT LISTENERS START =---------------->
document.addEventListener('DOMContentLoaded', () => {
  fetchBarangayNames();
  fetchCropTypeNames();
  fetchProjects();

  const calendarIcon = document.querySelector('.calendar-btn-icon');
  if (calendarIcon) {
    calendarIcon.addEventListener('click', showMonthPicker);
  }

  document.addEventListener('click', (event) => {
    const monthPicker = document.getElementById('month-picker');
    const calendarIcon = document.querySelector('.calendar-btn-icon');
    if (monthPicker && !monthPicker.contains(event.target) && !calendarIcon.contains(event.target)) {
      monthPicker.style.display = 'none';
    }
  });

  document.getElementById('prev-year').addEventListener('click', () => {
    selectedYear--;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjectsByMonth();
  });

  document.getElementById('next-year').addEventListener('click', () => {
    selectedYear++;
    document.getElementById('year-display').textContent = selectedYear;
    filterProjectsByMonth();
  });

  document.querySelectorAll('.month-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      selectedMonth = index + 1;
      filterProjectsByMonth();
      document.querySelectorAll('.month-btn').forEach(b => b.style.backgroundColor = 'transparent');
      btn.style.backgroundColor = '#41A186';
      document.getElementById('month-picker').style.display = 'none';
      document.querySelector('.calendar-btn-icon').style.filter = 'brightness(0.5)';
    });
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    clearMonthFilter();
    document.getElementById('month-picker').style.display = 'none';
  });

  // Add event listeners for filters
  document.getElementById("projects-search-bar").addEventListener("input", filterProjects);
  document.querySelector(".barangay_select").addEventListener("change", filterProjects);
  document.querySelector(".crop_select").addEventListener("change", filterProjects);
  document.querySelector(".status_select").addEventListener("change", filterProjects);

  // Pagination event listeners
  document.getElementById("projects-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayProjects(filteredProjects);
    }
  });

  document.getElementById("projects-next-page").addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredProjects.length) {
      currentPage++;
      displayProjects(filteredProjects);
    }
  });
});

document.getElementById("download-btn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf; // Ensure this includes the full jsPDF with image support
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Get the authenticated user's data
  const user = await getAuthenticatedUser();
  const usersCollection = collection(db, "tb_users");
  const userQuery = query(usersCollection, where("email", "==", user.email));
  const userSnapshot = await getDocs(userQuery);
  const userData = userSnapshot.docs[0].data();

  // Construct the full name: First Name Middle Initial. Last Name
  const firstName = userData.first_name || "Unknown";
  const middleName = userData.middle_name ? `${userData.middle_name.charAt(0)}.` : "";
  const lastName = userData.last_name || "User";
  const fullName = `${firstName} ${middleName} ${lastName}`.trim();
  const userTypePrint = userData.user_type || "Unknown";

  // Get the current date (date only)
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Prepare table data from the full filteredProjects array
  const tableData = filteredProjects.map((project, index) => {
    const projectId = project.project_id || "project Id not recorded";
    const projectName = project.project_name || "project Name not recorded";
    const projectStatus = project.status || "N/A";
    const projectFarmPres = project.farm_president || "N/A";
    const projectBarangay = project.barangay_name || "N/A";
    const projectCategory = project.crop_name || "N/A";
    const projectCropType = project.crop_type_name || "N/A";
    const projectEquipment = project.equipment || "N/A";
    const projectStart = project.start_date || "N/A";
    const projectEnd = project.end_date || "N/A";
    const equipmentList = Array.isArray(project.equipment) ? project.equipment.join("<br>") : (project.equipment || "N/A");
    const fertilizerList = Array.isArray(project.fertilizer) ? project.fertilizer.join("<br>") : (project.fertilizer || "N/A");
    const farmersName = Array.isArray(project.farmer_name) ? project.farmer_name.join("<br>") : (project.farmer_name || "N/A");
    const leadFarmer = project.lead_farmer || "N/A";
    const landArea = project.land_area || "N/A";
    const taskCount = project.task_count !== undefined ? project.task_count : "N/A";

    return [
      projectId, // No.
      projectName,
      taskCount.toString(), // No. of Task (converted to string for PDF)
      projectStatus,
      projectFarmPres,
      leadFarmer, // Lead Farmer/s
      farmersName, // Farmers
      projectBarangay,
      landArea, // Land Area
      projectCategory,
      projectCropType,
      fertilizerList, // Fertilizer
      equipmentList,
      `${projectStart}\n${projectEnd}`, // Duration
    ];
  });

  const columns = [
    "No.", "Project Name", "No. of Task", "Status", "Farm President", "Lead Farmer/s",
    "Farmers", "Barangay", "Land Area", "Category", "Crop Type", "Fertilizer", "Equipment", "Duration",
  ];

  const columnWidths = [10, 25, 15, 15, 20, 25, 30, 20, 15, 25, 15, 20, 25, 20];
  const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

  // Header container
  const addHeader = (doc) => {
    const headerImg = "/images/BarasHeader.png";
    const headerImgWidth = 60;
    const headerImgHeight = 40;
    try {
      doc.addImage(headerImg, "PNG", (pageWidth - headerImgWidth) / 2, 5, headerImgWidth, headerImgHeight);
    } catch (e) {
      console.error("Error adding header image:", e);
    }

    doc.setLineWidth(0.4);
    doc.setDrawColor(51, 51, 51);
    doc.line(10, 45, pageWidth - 10, 45);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("FOR", 20, 60);
    doc.text(":", 42, 60);
    doc.text("FROM", 20, 70);
    doc.text(":", 42, 70);
    doc.text(fullName, 50, 70); // User's full name after "FROM:"
    doc.text("DATE", 20, 80);
    doc.text(":", 42, 80);
    doc.text(currentDate, 50, 80); // Current date only after "DATE:"
    doc.text("SUBJECT", 20, 90);
    doc.text(":", 42, 90);
    doc.text("Project Report", 50, 90); // "Project Report" after "SUBJECT:"

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("AGRICULTURAL PRODUCTION DATA 2025", pageWidth / 2, 100, { align: "center" });
  };

  // Body container (table and bottom line)
  const addBody = (doc, data) => {
    const tableEndY = data.cursor.y + 35; // Bottom line 35mm below table
    if (tableEndY < pageHeight - 30) { // Ensure it fits above footer
      doc.setLineWidth(0.4);
      doc.setDrawColor(51, 51, 51);
      doc.line(10, tableEndY, pageWidth - 10, tableEndY);
    }
  };

  // Footer container
  const addFooter = (doc, data) => {
    const footerImg = "/images/BarasFooter.png";
    const footerImgWidth = 140;
    const footerImgHeight = 15;
    try {
      doc.addImage(footerImg, "PNG", (pageWidth - footerImgWidth) / 2, pageHeight - 30, footerImgWidth, footerImgHeight);
    } catch (e) {
      console.error("Error adding footer image:", e);
    }

    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 10, pageHeight - 10, { align: "right" });
  };

  // Pagination logic with table content limit
  const maxTableHeight = pageHeight - 65; // 65mm reserved (30mm footer + 35mm for bottom line)
  const rowHeightEstimate = 10; // Increased to 10mm to account for potential wrapping
  const baseRowsPerPage = Math.floor((maxTableHeight - 105) / rowHeightEstimate); // 105 is startY
  const rowsPerPage = baseRowsPerPage; // No extra rows, just base to ensure fit
  let currentPage = 0;

  while (currentPage * rowsPerPage < tableData.length) {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
    const pageData = tableData.slice(startIndex, endIndex);

    if (currentPage > 0) {
      doc.addPage();
    }

    addHeader(doc);

    doc.autoTable({
      startY: 105,
      head: [columns],
      body: pageData,
      theme: "grid",
      margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
      styles: {
        fontSize: 5,
        cellPadding: 1,
        overflow: "linebreak",
        font: "helvetica",
        textColor: [51, 51, 51],
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [65, 161, 134],
        fontSize: 7,
        font: "helvetica",
        fontStyle: "bold",
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      columnStyles: Object.fromEntries(columns.map((_, i) => [i, { cellWidth: columnWidths[i] }])),
      didDrawPage: (data) => {
        addBody(doc, data);
        addFooter(doc, data);
      },
    });

    currentPage++;
  }

  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const previewPanel = document.getElementById("pdf-preview-panel");
  const previewContainer = document.getElementById("pdf-preview-container");

  previewContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%"></iframe>`;
  previewPanel.style.display = "flex";
  document.body.classList.add("preview-active");

  document.getElementById("preview-cancel-btn").onclick = () => {
    previewPanel.style.display = "none";
    document.body.classList.remove("preview-active");
    URL.revokeObjectURL(pdfUrl);
  };

  document.getElementById("preview-done-btn").onclick = async () => {
      doc.save(`Project_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      await saveActivityLog("Create", `Project Report downloaded by ${userTypePrint} ${fullName} `);
      previewPanel.style.display = "none";
      document.body.classList.remove("preview-active");
      URL.revokeObjectURL(pdfUrl);
    };
});
// <-------------= EVENT LISTENERS END =---------------->