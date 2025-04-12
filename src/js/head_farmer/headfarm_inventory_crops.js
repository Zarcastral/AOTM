import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for authenticated user
let currentFarmerId = "";
let currentUserType = "";
let currentFirstName = "";
let currentMiddleName = "";
let currentLastName = "";

let cropsList = [];
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = [];

function sortCropsByDate() {
  filteredCrops.sort((a, b) => {
    const dateA = parseDate(a.stock_date || a.cropDate);
    const dateB = parseDate(b.stock_date || b.cropDate);
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
              last_name: currentLastName,
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

async function fetchCrops() {
  try {
    await getAuthenticatedFarmer();

    // Fetch Ongoing projects where lead_farmer_id matches current user's farmer_id
    const projectsCollection = collection(db, "tb_projects");
    const ongoingQuery = query(
      projectsCollection,
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );

    onSnapshot(
      ongoingQuery,
      async (snapshot) => {
        const stockCollection = collection(db, "tb_crop_stock");

        const projectsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const project = doc.data();
            let stockData = {};

            // Fetch stock data for matching crop_type_name
            const stockQuery = query(
              stockCollection,
              where("crop_type_name", "==", project.crop_type_name)
            );
            const stockSnapshot = await getDocs(stockQuery);

            if (!stockSnapshot.empty) {
              const stockDoc = stockSnapshot.docs[0].data();
              const stockEntry = stockDoc.stocks.find(
                (stock) => stock.farmer_id === currentFarmerId
              );
              if (stockEntry) {
                stockData = {
                  stock_date: stockEntry.stock_date,
                  current_stock: stockEntry.current_stock,
                  unit: stockEntry.unit,
                };
              }
            }

            return {
              project_id: project.project_id,
              project_name: project.project_name,
              crop_type_name: project.crop_type_name,
              crop_name: project.crop_name,
              cropDate: project.crop_date || null,
              ...stockData,
              owned_by: currentUserType,
            };
          })
        );

        cropsList = projectsData;
        filteredCrops = [...cropsList];
        sortCropsByDate();
        displayCrops(filteredCrops);
      },
      (error) => {
        console.error("Error listening to projects:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found.");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCrops = cropsList.slice(startIndex, endIndex);

  if (paginatedCrops.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="5" style="text-align: center;">You are not the Farm Leader for any Ongoing Projects</td>
      </tr>
    `;
    return;
  }

  paginatedCrops.forEach((crop) => {
    const row = document.createElement("tr");
    const date = crop.stock_date || crop.cropDate;
    const formattedDate = date
      ? date.toDate
        ? date.toDate().toLocaleDateString()
        : new Date(date).toLocaleDateString()
      : "Not recorded";

    row.innerHTML = `
      <td>${crop.project_id}</td>
      <td>${crop.crop_name}</td>
      <td>${crop.crop_type_name}</td>
      <td>${formattedDate}</td>
      <td>${crop.current_stock || "0"} ${crop.unit || ""}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchProjectNames();
  fetchCrops();
});

function updatePagination() {
  const totalPages = Math.ceil(filteredCrops.length / rowsPerPage) || 1;
  document.getElementById(
    "crop-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("crop-prev-page").disabled = currentPage === 1;
  document.getElementById("crop-next-page").disabled =
    currentPage >= Math.ceil(filteredCrops.length / rowsPerPage);
}

document.getElementById("crop-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayCrops(filteredCrops);
  }
});

document.getElementById("crop-next-page").addEventListener("click", () => {
  if (currentPage * rowsPerPage < filteredCrops.length) {
    currentPage++;
    displayCrops(filteredCrops);
  }
});

async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map((doc) => doc.data().crop_name);
  populateCropDropdown(cropNames);
}

function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) return;
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";
  cropSelect.innerHTML = firstOption;

  cropNames.forEach((cropName) => {
    const option = document.createElement("option");
    option.textContent = cropName;
    cropSelect.appendChild(option);
  });
}

async function fetchProjectNames() {
  const projectsQuery = query(
    collection(db, "tb_projects"),
    where("lead_farmer_id", "==", currentFarmerId),
    where("status", "==", "Ongoing")
  );
  const projectsSnapshot = await getDocs(projectsQuery);
  const projectNames = projectsSnapshot.docs.map(
    (doc) => doc.data().project_name
  );
  populateProjectDropdown(projectNames);
}

function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".project_select");
  if (!projectSelect) return;
  const firstOption = projectSelect.querySelector("option")?.outerHTML || "";
  projectSelect.innerHTML = firstOption;

  const uniqueProjectNames = [...new Set(projectNames)].sort();
  uniqueProjectNames.forEach((projectName) => {
    const option = document.createElement("option");
    option.textContent = projectName;
    projectSelect.appendChild(option);
  });
}

document.querySelector(".crop_select").addEventListener("change", function () {
  const selectedCrop = this.value.toLowerCase();
  const selectedProject = document
    .querySelector(".project_select")
    .value.toLowerCase();

  filteredCrops = cropsList.filter((crop) => {
    const matchesCrop = selectedCrop
      ? crop.crop_name?.toLowerCase() === selectedCrop
      : true;
    const matchesProject = selectedProject
      ? crop.project_name?.toLowerCase() === selectedProject
      : true;
    return matchesCrop && matchesProject;
  });

  currentPage = 1;
  sortCropsByDate();
  displayCrops(filteredCrops);
});

document
  .querySelector(".project_select")
  .addEventListener("change", function () {
    const selectedProject = this.value.toLowerCase();
    const selectedCrop = document
      .querySelector(".crop_select")
      .value.toLowerCase();

    filteredCrops = cropsList.filter((crop) => {
      const matchesProject = selectedProject
        ? crop.project_name?.toLowerCase() === selectedProject
        : true;
      const matchesCrop = selectedCrop
        ? crop.crop_name?.toLowerCase() === selectedCrop
        : true;
      return matchesProject && matchesCrop;
    });

    currentPage = 1;
    sortCropsByDate();
    displayCrops(filteredCrops);
  });

document
  .getElementById("crop-search-bar")
  .addEventListener("input", function () {
    const searchQuery = this.value.toLowerCase().trim();

    filteredCrops = cropsList.filter((crop) => {
      return (
        crop.project_id?.toString().toLowerCase().includes(searchQuery) ||
        crop.project_name?.toLowerCase().includes(searchQuery) ||
        crop.crop_name?.toLowerCase().includes(searchQuery) ||
        crop.crop_type_name?.toLowerCase().includes(searchQuery)
      );
    });

    currentPage = 1;
    sortCropsByDate();
    displayCrops(filteredCrops);
  });

function getFarmerFullName() {
  const middleInitial = currentMiddleName
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}
