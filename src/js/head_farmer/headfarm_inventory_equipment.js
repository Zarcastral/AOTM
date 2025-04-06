import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for authenticated user
let currentFarmerId = "";
let currentUserType = "";
let currentFirstName = "";
let currentMiddleName = "";
let currentLastName = "";

let equipmentsList = [];
let filteredEquipments = [];
let currentPage = 1;
const rowsPerPage = 5;

function sortEquipmentsByDate() {
  filteredEquipments.sort((a, b) => {
    const dateA = parseDate(a.stock_date || a.equipmentDate);
    const dateB = parseDate(b.stock_date || b.equipmentDate);
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
            // Store farmer details in global variables
            currentFarmerId = farmerData.farmer_id;
            currentUserType = farmerData.user_type;
            currentFirstName = farmerData.first_name;
            currentMiddleName = farmerData.middle_name;
            currentLastName = farmerData.last_name;

            resolve({
              farmer_id: currentFarmerId,
              user_type: currentUserType,
              first_name: currentFirstName,
              middle_name: currentMiddleName,
              last_name: currentLastName
            });
          } else {
            console.error("Farmer record not found.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated.");
        reject("User not authenticated.");
      }
    });
  });
}

async function fetchEquipments() {
  try {
    await getAuthenticatedFarmer();

    // Fetch Ongoing projects where lead_farmer_id matches current user's farmer_id
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );

    onSnapshot(projectsQuery, async (snapshot) => {
      const stockCollection = collection(db, "tb_equipment_stocks");

      const equipmentsData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const project = doc.data();
          const equipmentArray = project.equipment || [];

          // Process each equipment in the project
          const equipmentPromises = equipmentArray.map(async (equip) => {
            let stockData = {};

            // Fetch stock data from tb_equipment_stocks based on equipment_name
            const stockQuery = query(
              stockCollection,
              where("equipment_name", "==", equip.equipment_name)
            );
            const stockSnapshot = await getDocs(stockQuery);

            if (!stockSnapshot.empty) {
              const stockDoc = stockSnapshot.docs[0].data();
              const stockEntry = stockDoc.stocks.find(
                stock => stock.farmer_id === currentFarmerId
              );
              if (stockEntry) {
                stockData = {
                  stock_date: stockEntry.stock_date,
                  current_stock: stockEntry.current_stock,
                  unit: stockEntry.unit
                };
              }
            }

            return {
              project_id: project.project_id,
              project_name: project.project_name,
              equipment_type: equip.equipment_type,
              equipment_name: equip.equipment_name,
              equipmentDate: project.equipment_date || null,
              ...stockData,
              owned_by: currentUserType
            };
          });

          return Promise.all(equipmentPromises);
        })
      );

      // Flatten the array of arrays into a single array
      equipmentsList = equipmentsData.flat();
      filteredEquipments = [...equipmentsList];
      sortEquipmentsByDate();
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

  if (paginatedEquipments.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center;">You are not the Farm Leader for any Ongoing Projects</td>
      </tr>
    `;
    return;
  }

  paginatedEquipments.forEach((equipment) => {
    const row = document.createElement("tr");
    const date = equipment.stock_date || equipment.equipmentDate;
    const dateAdded = date
      ? (date.toDate ? date.toDate().toLocaleDateString() : new Date(date).toLocaleDateString())
      : "Not recorded";

    row.innerHTML = `
      <td>${equipment.project_id}</td>
      <td>${equipment.project_name}</td>
      <td>${equipment.equipment_name}</td>
      <td>${equipment.equipment_type}</td>
      <td>${dateAdded}</td>
      <td>${equipment.current_stock || "0"} ${equipment.unit || "Units"}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

document.addEventListener("DOMContentLoaded", () => {
  fetchEquipmentNames();
  fetchProjectNames();
  fetchEquipments();
});

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
  if (!equipmentSelect) return;
  const firstOption = equipmentSelect.querySelector("option")?.outerHTML || "";
  equipmentSelect.innerHTML = firstOption;

  equipmentNames.forEach(equipmentName => {
    const option = document.createElement("option");
    option.textContent = equipmentName;
    equipmentSelect.appendChild(option);
  });
}

async function fetchProjectNames() {
  const projectsQuery = query(
    collection(db, "tb_projects"),
    where("lead_farmer_id", "==", currentFarmerId),
    where("status", "==", "Ongoing")
  );
  const projectsSnapshot = await getDocs(projectsQuery);
  const projectNames = projectsSnapshot.docs.map(doc => doc.data().project_name);
  populateProjectDropdown(projectNames);
}

function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".equip_project_select");
  if (!projectSelect) return;
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
  sortEquipmentsByDate();
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
  sortEquipmentsByDate();
  displayEquipments(filteredEquipments);
});

document.getElementById("equip-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();
  
  filteredEquipments = equipmentsList.filter(equipment => {
    return (
      (equipment.project_id?.toString().toLowerCase().includes(searchQuery)) ||
      (equipment.project_name?.toLowerCase().includes(searchQuery)) ||
      (equipment.equipment_name?.toLowerCase().includes(searchQuery)) ||
      (equipment.equipment_type?.toLowerCase().includes(searchQuery))
    );
  });
  
  currentPage = 1;
  sortEquipmentsByDate();
  displayEquipments(filteredEquipments);
});

function getFarmerFullName() {
  const middleInitial = currentMiddleName 
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}