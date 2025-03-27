import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  onSnapshot,
  doc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";

const db = getFirestore(app);
let equipmentsList = [];
let filteredEquipments = [];
let currentPage = 1;
const rowsPerPage = 5;
let currentFarmerData = {};

document.addEventListener("DOMContentLoaded", () => {
  fetchEquipmentNames();
  fetchProjectNames();
  fetchEquipments();
});

function sortEquipmentsById() {
  filteredEquipments.sort((a, b) => {
    const dateA = parseDate(a.equipmentDate);
    const dateB = parseDate(b.equipmentDate);
    return dateB - dateA; // Sort latest to oldest
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0);
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  return new Date(dateValue);
}

async function getAuthenticatedFarmer() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const farmerQuery = query(
            collection(db, "tb_farmers"),
            where("email", "==", user.email)
          );
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            currentFarmerData = {
              farmer_id: farmerData.farmer_id,
              user_type: farmerData.user_type,
              first_name: farmerData.first_name,
              middle_name: farmerData.middle_name,
              last_name: farmerData.last_name
            };
            resolve(currentFarmerData);
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

async function fetchEquipments() {
  try {
    const farmerData = await getAuthenticatedFarmer();
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("farmer_id", "==", farmerData.farmer_id)
    );

    onSnapshot(projectsQuery, (snapshot) => {
      equipmentsList = [];
      snapshot.docs.forEach(doc => {
        const project = doc.data();
        const equipmentArray = project.equipment || [];
        
        console.log(`Project ID: ${project.project_id}, Equipment Array:`, equipmentArray); // Debug log
        
        equipmentArray.forEach(equip => {
          equipmentsList.push({
            project_id: project.project_id || "Not specified",
            project_name: project.project_name || "Not specified",
            equipment_type: equip.equipment_type || "Not specified",
            equipment_name: equip.equipment_name || "Not specified", // Assumed at project level
            current_stock: equip.equipment_quantity || "0",
            unit: "Units", // Default value
            equipmentDate: project.equipment_date || null
          });
        });
      });

      console.log("Equipments List:", equipmentsList); // Debug log
      filteredEquipments = [...equipmentsList];
      sortEquipmentsById();
      displayEquipments(filteredEquipments);
    }, (error) => {
      console.error("Error listening to projects:", error);
    });
  } catch (error) {
    console.error("Error fetching equipments:", error);
  }
}

function displayEquipments(equipmentsList) {
  const tableBody = document.querySelector(".equipment_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .equipment_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedEquipments = equipmentsList.slice(startIndex, endIndex);

  console.log("Paginated Equipments:", paginatedEquipments); // Debug log

  if (paginatedEquipments.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center; color: red;">No records found</td>
      </tr>
    `;
    return;
  }

  paginatedEquipments.forEach((equipment) => {
    const row = document.createElement("tr");
    const dateAdded = equipment.equipmentDate
      ? (equipment.equipmentDate.toDate 
        ? equipment.equipmentDate.toDate().toLocaleDateString() 
        : new Date(equipment.equipmentDate).toLocaleDateString())
      : "Date not recorded";

    row.innerHTML = `
      <td>${equipment.project_id}</td>
      <td>${equipment.project_name}</td>
      <td>${equipment.equipment_name}</td>
      <td>${equipment.equipment_type}</td>
      <td>${dateAdded}</td>
      <td>${equipment.current_stock} ${equipment.unit}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredEquipments.length / rowsPerPage) || 1;
  document.getElementById("equipment-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("equipment-prev-page").disabled = currentPage === 1;
  document.getElementById("equipment-next-page").disabled = currentPage >= Math.ceil(filteredEquipments.length / rowsPerPage);
}

document.getElementById("equipment-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayEquipments(filteredEquipments);
  }
});

document.getElementById("equipment-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredEquipments.length) {
    currentPage++;
    displayEquipments(filteredEquipments);
  }
});

async function fetchEquipmentNames() {
  const equipmentsCollection = collection(db, "tb_equipment_types");
  const equipmentsSnapshot = await getDocs(equipmentsCollection);
  const equipmentNames = equipmentsSnapshot.docs.map(doc => doc.data().equipment_type_name);
  populateEquipmentDropdown(equipmentNames);
}

function populateEquipmentDropdown(equipmentNames) {
  const equipmentSelect = document.querySelector(".equipment_select");
  if (!equipmentSelect) {
    console.error("Equipment dropdown not found!");
    return;
  }
  const firstOption = equipmentSelect.querySelector("option")?.outerHTML || "";
  equipmentSelect.innerHTML = firstOption;

  equipmentNames.forEach(equipmentName => {
    const option = document.createElement("option");
    option.textContent = equipmentName;
    equipmentSelect.appendChild(option);
  });
}

async function fetchProjectNames() {
  try {
    const farmerData = await getAuthenticatedFarmer();
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("farmer_id", "==", farmerData.farmer_id)
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    const projectNames = projectsSnapshot.docs.map(doc => doc.data().project_name);

    populateProjectDropdown(projectNames);
  } catch (error) {
    console.error("Error fetching project names:", error);
  }
}

function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".equip_project_select");
  if (!projectSelect) {
    console.error("Project dropdown not found!");
    return;
  }
  const firstOption = projectSelect.querySelector("option")?.outerHTML || "";
  projectSelect.innerHTML = firstOption;

  const uniqueProjectNames = [...new Set(projectNames)].sort();
  uniqueProjectNames.forEach(projectName => {
    const option = document.createElement("option");
    option.textContent = projectName;
    projectSelect.appendChild(option);
  });
}

document.querySelector(".equipment_select").addEventListener("change", function () {
  const selectedEquipment = this.value.toLowerCase();
  const selectedProject = document.querySelector(".equip_project_select").value.toLowerCase();
  
  filteredEquipments = equipmentsList.filter(equipment => {
    const matchesEquipment = selectedEquipment ? equipment.equipment_type?.toLowerCase() === selectedEquipment : true;
    const matchesProject = selectedProject ? equipment.project_name?.toLowerCase() === selectedProject : true;
    return matchesEquipment && matchesProject;
  });
  
  currentPage = 1;
  sortEquipmentsById();
  displayEquipments(filteredEquipments);
});

document.querySelector(".equip_project_select").addEventListener("change", function () {
  const selectedProject = this.value.toLowerCase();
  const selectedEquipment = document.querySelector(".equipment_select").value.toLowerCase();
  
  filteredEquipments = equipmentsList.filter(equipment => {
    const matchesProject = selectedProject ? equipment.project_name?.toLowerCase() === selectedProject : true;
    const matchesEquipment = selectedEquipment ? equipment.equipment_type?.toLowerCase() === selectedEquipment : true;
    return matchesEquipment && matchesProject;
  });
  
  currentPage = 1;
  sortEquipmentsById();
  displayEquipments(filteredEquipments);
});

document.getElementById("equip-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();
  console.log("Search Query:", searchQuery); // Debug log to verify input
  
  filteredEquipments = equipmentsList.filter(equipment => {
    return (
      (equipment.project_id && equipment.project_id.toString().toLowerCase().includes(searchQuery)) ||
      (equipment.project_name && equipment.project_name.toLowerCase().includes(searchQuery)) ||
      (equipment.equipment_name && equipment.equipment_name.toLowerCase().includes(searchQuery)) ||
      (equipment.equipment_type && equipment.equipment_type.toLowerCase().includes(searchQuery))
    );
  });
  
  console.log("Filtered Equipments after search:", filteredEquipments); // Debug log to verify filtering
  currentPage = 1;
  sortEquipmentsById();
  displayEquipments(filteredEquipments);
});

function getFarmerFullName() {
  const middleInitial = currentFarmerData.middle_name 
    ? `${currentFarmerData.middle_name.charAt(0)}.`
    : "";
  return `${currentFarmerData.first_name} ${middleInitial} ${currentFarmerData.last_name}`.trim();
}