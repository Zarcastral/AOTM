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

let fertilizersList = [];
let filteredFertilizers = [];
let currentPage = 1;
const rowsPerPage = 5;

function sortFertilizersByDate() {
  filteredFertilizers.sort((a, b) => {
    const dateA = parseDate(a.stock_date || a.fertilizerDate);
    const dateB = parseDate(b.stock_date || b.fertilizerDate);
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

async function fetchFertilizers() {
  try {
    await getAuthenticatedFarmer();

    // Fetch Ongoing projects where farmer_id AND lead_farmer_id match current user
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("farmer_id", "==", currentFarmerId),
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );

    onSnapshot(projectsQuery, async (snapshot) => {
      const stockCollection = collection(db, "tb_fertilizer_stocks");

      const fertilizersData = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const project = doc.data();
          const fertilizerArray = project.fertilizer || [];
          
          // Process each fertilizer in the project
          const fertilizerPromises = fertilizerArray.map(async (fert) => {
            let stockData = {};

            // Fetch stock data from tb_fertilizer_stocks based on fertilizer_name
            const stockQuery = query(
              stockCollection,
              where("fertilizer_name", "==", fert.fertilizer_name)
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
              fertilizer_type: fert.fertilizer_type,
              fertilizer_name: fert.fertilizer_name,
              fertilizerDate: project.fertilizer_date || null,
              ...stockData,
              owned_by: currentUserType
            };
          });

          return Promise.all(fertilizerPromises);
        })
      );

      // Flatten the array of arrays into a single array
      fertilizersList = fertilizersData.flat();
      filteredFertilizers = [...fertilizersList];
      sortFertilizersByDate();
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

  if (paginatedFertilizers.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center; ">You are not the Farm Leader for any Ongoing Projects</td>
      </tr>
    `;
    return;
  }

  paginatedFertilizers.forEach((fertilizer) => {
    const row = document.createElement("tr");
    const date = fertilizer.stock_date || fertilizer.fertilizerDate;
    const dateAdded = date
      ? (date.toDate ? date.toDate().toLocaleDateString() : new Date(date).toLocaleDateString())
      : "Not recorded";

    row.innerHTML = `
      <td>${fertilizer.project_id}</td>
      <td>${fertilizer.project_name}</td>
      <td>${fertilizer.fertilizer_name}</td>
      <td>${fertilizer.fertilizer_type}</td>
      <td>${dateAdded}</td>
      <td>${fertilizer.current_stock || "0"} ${fertilizer.unit || "units"}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchProjectNames();
  fetchFertilizers();
});

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
  if (!fertilizerSelect) return;
  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach(fertilizerName => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}

async function fetchProjectNames() {
  const projectsQuery = query(
    collection(db, "tb_projects"),
    where("farmer_id", "==", currentFarmerId),
    where("lead_farmer_id", "==", currentFarmerId),
    where("status", "==", "Ongoing")
  );
  const projectsSnapshot = await getDocs(projectsQuery);
  const projectNames = projectsSnapshot.docs.map(doc => doc.data().project_name);
  populateProjectDropdown(projectNames);
}

function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".fert_project_select");
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

document.querySelector(".fertilizer_select").addEventListener("change", function () {
  const selectedFertilizer = this.value.toLowerCase();
  const selectedProject = document.querySelector(".fert_project_select").value.toLowerCase();
  
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    const matchesFertilizer = selectedFertilizer ? fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer : true;
    const matchesProject = selectedProject ? fertilizer.project_name?.toLowerCase() === selectedProject : true;
    return matchesFertilizer && matchesProject;
  });
  
  currentPage = 1;
  sortFertilizersByDate();
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
  sortFertilizersByDate();
  displayFertilizers(filteredFertilizers);
});

document.getElementById("fert-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();
  
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    return (
      (fertilizer.project_id?.toString().toLowerCase().includes(searchQuery)) ||
      (fertilizer.project_name?.toLowerCase().includes(searchQuery)) ||
      (fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery)) ||
      (fertilizer.fertilizer_type?.toLowerCase().includes(searchQuery))
    );
  });
  
  currentPage = 1;
  sortFertilizersByDate();
  displayFertilizers(filteredFertilizers);
});

function getFarmerFullName() {
  const middleInitial = currentMiddleName 
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}