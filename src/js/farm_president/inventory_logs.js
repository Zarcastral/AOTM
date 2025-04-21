import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Global variable for authenticated farmer ID
let currentFarmerId = "";
let logsList = [];
let filteredLogs = [];
let currentPage = 1;
const rowsPerPage = 5;

// Fetch authenticated farmer's ID from tb_farmers
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
            currentFarmerId = farmerData.farmer_id;
            resolve(currentFarmerId);
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

// Fetch logs from tb_inventory_log for the current farmer
async function fetchLogs() {
  try {
    await getAuthenticatedFarmer();
    const projectId = sessionStorage.getItem("projectId"); // Get sessioned project_id
    const logsQuery = query(
      collection(db, "tb_inventory_log"),
      where("farmer_id", "==", currentFarmerId),
      ...(projectId ? [where("project_id", "==", projectId)] : []) // Filter by project_id if present
    );
    const logsSnapshot = await getDocs(logsQuery);

    logsList = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    filteredLogs = [...logsList];
    sortLogsByDate();
    displayLogs(filteredLogs);
  } catch (error) {
    console.error("Error fetching logs:", error);
  }
}

// Sort logs by timestamp (newest first)
function sortLogsByDate() {
  filteredLogs.sort((a, b) => {
    const dateA = a.timestamp?.toDate
      ? a.timestamp.toDate()
      : new Date(a.timestamp);
    const dateB = b.timestamp?.toDate
      ? b.timestamp.toDate()
      : new Date(b.timestamp);
    return dateB - dateA;
  });
}

// Display logs in the table
function displayLogs(logs) {
  const tableBody = document.querySelector(".log_table table tbody");
  if (!tableBody) {
    console.error("Table body not found.");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  if (paginatedLogs.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center;">No inventory logs found</td>
      </tr>
    `;
    return;
  }

  paginatedLogs.forEach((log) => {
    const row = document.createElement("tr");
    const formattedDate = log.timestamp
      ? log.timestamp.toDate
        ? log.timestamp.toDate().toLocaleDateString()
        : new Date(log.timestamp).toLocaleDateString()
      : "N/A";

    row.innerHTML = `
      <td>${log.project_id || "N/A"}</td>
      <td>${log.resource_name || "N/A"}</td>
      <td>${log.quantity_used || "N/A"}</td>
      <td>${log.status || "N/A"}</td>
      <td>${log.details || "N/A"}</td>
      <td>${formattedDate}</td>
    `;
    tableBody.appendChild(row);
  });
  updatePagination();
}

// Update pagination controls
function updatePagination() {
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
  document.getElementById(
    "log-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  document.getElementById("log-prev-page").disabled = currentPage === 1;
  document.getElementById("log-next-page").disabled = currentPage >= totalPages;
}

// Back button logic
async function configureBackButton() {
  const backContainer = document.querySelector(".back");
  const backLink = document.querySelector(".back-link");
  if (!backContainer || !backLink) {
    console.warn("Back container or link not found in the DOM.");
    return;
  }

  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const projectId = sessionStorage.getItem("projectId"); // Use sessioned project_id

  console.log("userType:", userType);
  console.log("farmerId:", farmerId);
  console.log("projectId:", projectId);

  if (!projectId) {
    console.error("No project_id found in sessionStorage.");
    backContainer.style.display = "none";
    return;
  }

  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(
      projectsRef,
      where("project_id", "==", projectId) // Use string project_id
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("Project not found in tb_projects.");
      backContainer.style.display = "none";
      return;
    }

    const projectData = querySnapshot.docs[0].data();
    const leadFarmerId = projectData.lead_farmer_id;

    console.log("leadFarmerId:", leadFarmerId);

    const isLeadFarmer = farmerId && String(leadFarmerId) === String(farmerId);
    console.log("isLeadFarmer:", isLeadFarmer);

    // Define user types and their respective redirect paths
    const navigationPaths = {
      Admin: "../../../../landing_pages/admin/viewproject.html",
      Supervisor: "../../../../landing_pages/admin/viewproject.html",
      "Farm President":
        "../../../landing_pages/farm_president/viewproject.html",
    };

    const canNavigateBack = Object.keys(navigationPaths).includes(userType);
    console.log("canNavigateBack:", canNavigateBack);

    if (isLeadFarmer && userType === "Head Farmer") {
      backContainer.style.display = "none";
      backContainer.classList.remove("visible");
      console.log("Back button hidden: Head Farmer is lead farmer.");
    } else if (canNavigateBack) {
      backContainer.style.display = "block";
      backContainer.classList.add("visible");
      console.log("Back button visible: User is allowed to navigate back.");

      backLink.addEventListener("click", (event) => {
        event.preventDefault();
        sessionStorage.setItem("selectedProjectId", projectId);
        const redirectPath = navigationPaths[userType];
        window.location.href = redirectPath;
        console.log(`Navigating to ${redirectPath}`);
      });
    } else {
      backContainer.style.display = "none";
      backContainer.classList.remove("visible");
      console.log(
        "Back button hidden: User type not allowed to navigate back."
      );
    }
  } catch (error) {
    console.error("Error fetching project data for back button:", error);
    backContainer.style.display = "none";
    backContainer.classList.remove("visible");
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchLogs();
  configureBackButton();

  // Previous page button
  const prevPageButton = document.getElementById("log-prev-page");
  if (prevPageButton) {
    prevPageButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        displayLogs(filteredLogs);
      }
    });
  } else {
    console.error("Previous page button not found.");
  }

  // Next page button
  const nextPageButton = document.getElementById("log-next-page");
  if (nextPageButton) {
    nextPageButton.addEventListener("click", () => {
      if (currentPage * rowsPerPage < filteredLogs.length) {
        currentPage++;
        displayLogs(filteredLogs);
      }
    });
  } else {
    console.error("Next page button not found.");
  }

  // Search bar input
  const searchBar = document.getElementById("log-search-bar");
  if (searchBar) {
    searchBar.addEventListener("input", () => {
      const searchQuery = searchBar.value.toLowerCase().trim();
      const selectedResourceType =
        document.querySelector(".resource_select")?.value;

      filteredLogs = logsList.filter((log) => {
        const matchesSearch =
          log.project_id?.toString().toLowerCase().includes(searchQuery) ||
          log.resource_name?.toLowerCase().includes(searchQuery) ||
          log.status?.toLowerCase().includes(searchQuery);
        const matchesResourceType = selectedResourceType
          ? log.resource_type === selectedResourceType
          : true;
        return matchesSearch && matchesResourceType;
      });

      currentPage = 1;
      sortLogsByDate();
      displayLogs(filteredLogs);
    });
  } else {
    console.error("Search bar not found.");
  }

  // Resource type dropdown
  const resourceSelect = document.querySelector(".resource_select");
  if (resourceSelect) {
    resourceSelect.addEventListener("change", () => {
      const selectedResourceType = resourceSelect.value;
      const searchQuery =
        document.getElementById("log-search-bar")?.value.toLowerCase().trim() ||
        "";

      filteredLogs = logsList.filter((log) => {
        const matchesSearch =
          log.project_id?.toString().toLowerCase().includes(searchQuery) ||
          log.resource_name?.toLowerCase().includes(searchQuery) ||
          log.status?.toLowerCase().includes(searchQuery);
        const matchesResourceType = selectedResourceType
          ? log.resource_type === selectedResourceType
          : true;
        return matchesSearch && matchesResourceType;
      });

      currentPage = 1;
      sortLogsByDate();
      displayLogs(filteredLogs);
    });
  } else {
    console.error("Resource select dropdown not found.");
  }
});
