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

let cropsList = [];
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = [];
let currentFarmerData = {};

// Sort crops by date (latest to oldest)
function sortCropsById() {
  filteredCrops.sort((a, b) => {
    const dateA = parseDate(a.cropDate);
    const dateB = parseDate(b.cropDate);
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

// Real-time listener for projects collection
async function fetchCrops() {
  try {
    const farmerData = await getAuthenticatedFarmer();
    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("farmer_id", "==", farmerData.farmer_id)
    );

    onSnapshot(projectsQuery, async (snapshot) => {
      const projectsData = snapshot.docs.map(doc => {
        const project = doc.data();
        return {
          project_id: project.project_id || "Not specified",
          project_name: project.project_name || "Not specified",
          crop_name: project.crop_name || "Not specified",
          crop_type_name: project.crop_type_name || "Not specified",
          cropDate: project.crop_date || null,
          crop_type_quantity: project.crop_type_quantity || "0",
          crop_unit: project.crop_unit || "",
          owned_by: farmerData.user_type
        };
      });

      console.log("Crops List:", projectsData); // Debug log
      cropsList = projectsData;
      filteredCrops = [...cropsList];
      sortCropsById();
      displayCrops(filteredCrops);
    }, (error) => {
      console.error("Error listening to projects:", error);
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}

// Display crops in the table
function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCrops = cropsList.slice(startIndex, endIndex);

  console.log("Paginated Crops:", paginatedCrops); // Debug log

  if (paginatedCrops.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center; color: red;">No records found</td>
      </tr>
    `;
    return;
  }

  paginatedCrops.forEach((crop) => {
    const row = document.createElement("tr");
    const cropDate = crop.cropDate
      ? (crop.cropDate.toDate
        ? crop.cropDate.toDate().toLocaleDateString()
        : new Date(crop.cropDate).toLocaleDateString())
      : "Date not recorded";

    row.innerHTML = `
      <td>${crop.project_id}</td>
      <td>${crop.project_name}</td>
      <td>${crop.crop_name}</td>
      <td>${crop.crop_type_name}</td>
      <td>${cropDate}</td>
      <td>${crop.crop_type_quantity} ${crop.crop_unit}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchProjectNames();
  fetchCrops();
});

// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredCrops.length / rowsPerPage) || 1;
  document.getElementById("crop-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("crop-prev-page").disabled = currentPage === 1;
  document.getElementById("crop-next-page").disabled = currentPage >= Math.ceil(filteredCrops.length / rowsPerPage);
}

// Event listeners for pagination
document.getElementById("crop-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayCrops(filteredCrops);
  }
});

document.getElementById("crop-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredCrops.length) {
    currentPage++;
    displayCrops(filteredCrops);
  }
});

// Fetch crop names for the crop dropdown
async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map(doc => doc.data().crop_name);

  populateCropDropdown(cropNames);
}

// Populate the crop dropdown with crop names
function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";
  cropSelect.innerHTML = firstOption;

  cropNames.forEach(cropName => {
    const option = document.createElement("option");
    option.textContent = cropName;
    cropSelect.appendChild(option);
  });
}

// Fetch project names for the project dropdown
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

// Populate the project dropdown with project names
function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".project_select");
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

// Filter crops based on crop dropdown selection
document.querySelector(".crop_select").addEventListener("change", function () {
  const selectedCrop = this.value.toLowerCase();
  const selectedProject = document.querySelector(".project_select").value.toLowerCase();
  
  filteredCrops = cropsList.filter(crop => {
    const matchesCrop = selectedCrop ? crop.crop_name?.toLowerCase() === selectedCrop : true;
    const matchesProject = selectedProject ? crop.project_name?.toLowerCase() === selectedProject : true;
    return matchesCrop && matchesProject;
  });
  
  currentPage = 1;
  sortCropsById();
  displayCrops(filteredCrops);
});

// Filter crops based on project dropdown selection
document.querySelector(".project_select").addEventListener("change", function () {
  const selectedProject = this.value.toLowerCase();
  const selectedCrop = document.querySelector(".crop_select").value.toLowerCase();
  
  filteredCrops = cropsList.filter(crop => {
    const matchesProject = selectedProject ? crop.project_name?.toLowerCase() === selectedProject : true;
    const matchesCrop = selectedCrop ? crop.crop_name?.toLowerCase() === selectedCrop : true;
    return matchesProject && matchesCrop;
  });
  
  currentPage = 1;
  sortCropsById();
  displayCrops(filteredCrops);
});

// Search bar event listener for real-time filtering
document.getElementById("crop-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();
  console.log("Search Query:", searchQuery); // Debug log to verify input
  
  filteredCrops = cropsList.filter(crop => {
    return (
      (crop.project_id && crop.project_id.toString().toLowerCase().includes(searchQuery)) ||
      (crop.project_name && crop.project_name.toLowerCase().includes(searchQuery)) ||
      (crop.crop_name && crop.crop_name.toLowerCase().includes(searchQuery)) ||
      (crop.crop_type_name && crop.crop_type_name.toLowerCase().includes(searchQuery))
    );
  });
  
  console.log("Filtered Crops after search:", filteredCrops); // Debug log to verify filtering
  currentPage = 1;
  sortCropsById();
  displayCrops(filteredCrops);
});

// Format farmer's name for logging
function getFarmerFullName() {
  const middleInitial = currentFarmerData.middle_name 
    ? `${currentFarmerData.middle_name.charAt(0)}.`
    : "";
  return `${currentFarmerData.first_name} ${middleInitial} ${currentFarmerData.last_name}`.trim();
}