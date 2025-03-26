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
let fertilizersList = [];
let filteredFertilizers = [];
let currentPage = 1;
const rowsPerPage = 5;
let currentFarmerData = {};

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchProjectNames();
  fetchFertilizers();
});

function sortFertilizersById() {
  filteredFertilizers.sort((a, b) => {
    const dateA = parseDate(a.fertilizerDate);
    const dateB = parseDate(b.fertilizerDate);
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

async function fetchFertilizers() {
  try {
    const farmerData = await getAuthenticatedFarmer();
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("farmer_id", "==", farmerData.farmer_id)
    );

    onSnapshot(projectsQuery, (snapshot) => {
      fertilizersList = [];
      snapshot.docs.forEach(doc => {
        const project = doc.data();
        const fertilizerArray = project.fertilizer || [];
        
        console.log(`Project ID: ${project.project_id}, Fertilizer Array:`, fertilizerArray); // Debug log
        
        fertilizerArray.forEach(fert => {
          fertilizersList.push({
            project_id: project.project_id || "Not specified",
            project_name: project.project_name || "Not specified",
            fertilizer_type: fert.fertilizer_type || "Not specified",
            fertilizer_name: fert.fertilizer_name || "Not specified",
            current_stock: fert.fertilizer_quantity || "0",
            unit: fert.fertilizer_unit || "units",
            fertilizerDate: project.fertilizer_date || null
          });
        });
      });

      console.log("Fertilizers List:", fertilizersList); // Debug log
      filteredFertilizers = [...fertilizersList];
      sortFertilizersById();
      displayFertilizers(filteredFertilizers);
    }, (error) => {
      console.error("Error listening to projects:", error);
    });
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
  }
}

function displayFertilizers(fertilizersList) {
  const tableBody = document.querySelector(".fertilizer_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .fertilizer_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedFertilizers = fertilizersList.slice(startIndex, endIndex);

  console.log("Paginated Fertilizers:", paginatedFertilizers); // Debug log

  if (paginatedFertilizers.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center; color: red;">No records found</td>
      </tr>
    `;
    return;
  }

  paginatedFertilizers.forEach((fertilizer) => {
    const row = document.createElement("tr");
    const dateAdded = fertilizer.fertilizerDate
      ? (fertilizer.fertilizerDate.toDate 
        ? fertilizer.fertilizerDate.toDate().toLocaleDateString() 
        : new Date(fertilizer.fertilizerDate).toLocaleDateString())
      : "Date not recorded";

    row.innerHTML = `
      <td>${fertilizer.project_id}</td>
      <td>${fertilizer.project_name}</td>
      <td>${fertilizer.fertilizer_name}</td>
      <td>${fertilizer.fertilizer_type}</td>
      <td>${dateAdded}</td>
      <td>${fertilizer.current_stock} ${fertilizer.unit}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredFertilizers.length / rowsPerPage) || 1;
  document.getElementById("fertilizer-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("fertilizer-prev-page").disabled = currentPage === 1;
  document.getElementById("fertilizer-next-page").disabled = currentPage >= Math.ceil(filteredFertilizers.length / rowsPerPage);
}

document.getElementById("fertilizer-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayFertilizers(filteredFertilizers);
  }
});

document.getElementById("fertilizer-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredFertilizers.length) {
    currentPage++;
    displayFertilizers(filteredFertilizers);
  }
});

async function fetchFertilizerNames() {
  const fertilizersCollection = collection(db, "tb_fertilizer_types");
  const fertilizersSnapshot = await getDocs(fertilizersCollection);
  const fertilizerNames = fertilizersSnapshot.docs.map(doc => doc.data().fertilizer_type_name);
  populateFertilizerDropdown(fertilizerNames);
}

function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");
  if (!fertilizerSelect) {
    console.error("Fertilizer dropdown not found!");
    return;
  }
  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach(fertilizerName => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
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
  const projectSelect = document.querySelector(".fert_project_select");
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

document.querySelector(".fertilizer_select").addEventListener("change", function () {
  const selectedFertilizer = this.value.toLowerCase();
  const selectedProject = document.querySelector(".fert_project_select").value.toLowerCase();
  
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    const matchesFertilizer = selectedFertilizer ? fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer : true;
    const matchesProject = selectedProject ? fertilizer.project_name?.toLowerCase() === selectedProject : true;
    return matchesFertilizer && matchesProject;
  });
  
  currentPage = 1;
  sortFertilizersById();
  displayFertilizers(filteredFertilizers);
});

document.querySelector(".fert_project_select").addEventListener("change", function () {
  const selectedProject = this.value.toLowerCase();
  const selectedFertilizer = document.querySelector(".fertilizer_select").value.toLowerCase();
  
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    const matchesProject = selectedProject ? fertilizer.project_name?.toLowerCase() === selectedProject : true;
    const matchesFertilizer = selectedFertilizer ? fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer : true;
    return matchesProject && matchesFertilizer;
  });
  
  currentPage = 1;
  sortFertilizersById();
  displayFertilizers(filteredFertilizers);
});

document.getElementById("fert-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();
  console.log("Search Query:", searchQuery); // Debug log to verify input
  
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    return (
      (fertilizer.project_id && fertilizer.project_id.toString().toLowerCase().includes(searchQuery)) ||
      (fertilizer.project_name && fertilizer.project_name.toLowerCase().includes(searchQuery)) ||
      (fertilizer.fertilizer_name && fertilizer.fertilizer_name.toLowerCase().includes(searchQuery)) ||
      (fertilizer.fertilizer_type && fertilizer.fertilizer_type.toLowerCase().includes(searchQuery))
    );
  });
  
  console.log("Filtered Fertilizers after search:", filteredFertilizers); // Debug log to verify filtering
  currentPage = 1;
  sortFertilizersById();
  displayFertilizers(filteredFertilizers);
});

function getFarmerFullName() {
  const middleInitial = currentFarmerData.middle_name 
    ? `${currentFarmerData.middle_name.charAt(0)}.`
    : "";
  return `${currentFarmerData.first_name} ${middleInitial} ${currentFarmerData.last_name}`.trim();
}