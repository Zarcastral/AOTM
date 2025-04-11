import {
    collection,
    getDocs,
    query,
    where,
    getFirestore,
    setDoc,
    doc,
    deleteDoc
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();
const tableBody = document.getElementById("table_body");
const barangaySelect = document.getElementById("barangay-select");
const searchBar = document.getElementById("search-bar");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
                    const userSnapshot = await getDocs(userQuery);

                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        console.log("Authenticated user data:", userData);
                        resolve(userData.user_type);
                    } else {
                        console.error("User record not found in tb_users collection.");
                        reject("User record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching user_name:", error);
                    reject(error);
                }
            } else {
                console.error("User not authenticated. Please log in.");
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
        // Get current user's user_type
        const currentUserType = await getAuthenticatedUser();
        
        // Query tb_project_history where project_creator matches current user's user_type
        const projectsQuery = query(
            collection(db, "tb_project_history"),
            where("project_creator", "==", currentUserType)
        );
        const querySnapshot = await getDocs(projectsQuery);
        
        projectList = [];
        let projectIdList = [];

        // Check for Pending or Ongoing projects at page load and move them to tb_projects
        for (const document of querySnapshot.docs) {
            const data = document.data();
            const projectId = String(data.project_id || "");
            const status = (data.status || "").toLowerCase();

            // If status is Pending or Ongoing, move to tb_projects
            if (status === "pending" || status === "ongoing") {
                const projectRef = doc(db, "tb_projects", document.id);
                await setDoc(projectRef, data); // Move entire document
                await deleteDoc(document.ref); // Delete from tb_project_history
                console.log(`Moved project ${projectId} with status ${status} to tb_projects`);
                continue; // Skip adding to projectList
            }

            // Process remaining projects for display
            const searchTerm = filter.search?.toLowerCase();
            const matchesSearch = searchTerm
                ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
                `${data.farm_president || ""}`.toLowerCase().includes(searchTerm) ||
                `${data.lead_farmer || ""}`.toLowerCase().includes(searchTerm) ||
                (data.start_date || "").includes(searchTerm) ||
                (data.end_date || "").includes(searchTerm) ||
                (data.crop_name || "").toLowerCase().includes(searchTerm) ||
                (data.crop_type_name || "").toLowerCase().includes(searchTerm) ||
                (data.status || "").toLowerCase().includes(searchTerm)
                : true;

            const matchesBarangay = filter.barangay
                ? (data.barangay_name || "").toLowerCase() === filter.barangay.toLowerCase()
                : true;

            if (matchesSearch && matchesBarangay) {
                projectIdList.push(projectId);
                projectList.push({ project_id: projectId, ...data });
            }
        }

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

        console.log("Project IDs:", projectIdList);

        currentPage = 1;
        updateTable();
        updatePagination();
    } catch (error) {
        console.error("Error Fetching Project History:", error);
    }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name){
    const formattedProjectName = project_name ? capitalizeWords(project_name): "";
    return `${formattedProjectName}`.trim();
}
function formatFarmPresident(farm_president){
    const formattedFarmPresident = farm_president ? capitalizeWords(farm_president): "";
    return `${formattedFarmPresident}`.trim();
}
function formatLeadFarmer(lead_farmer){
    const formattedLeadFarmer = lead_farmer ? capitalizeWords(lead_farmer): "";
    return `${formattedLeadFarmer}`.trim();
}
function formatCrop(crop_name){
    const formattedCrop = crop_name ? capitalizeWords(crop_name): "";
    return `${formattedCrop}`.trim();
}
function formatCropType(crop_type_name){
    const formattedCropType = crop_type_name ? capitalizeWords(crop_type_name): "";
    return `${formattedCropType}`.trim();
}
function formatStatus(status){
    const formattedStatus = status ? capitalizeWords(status): "";
    return `${formattedStatus}`.trim();
}

// <------------------ FUNCTION TO LOG PROJECT DETAILS TO CONSOLE ------------------------>
function logProjectDetails() {
    console.log("----- PROJECT DETAILS -----");
    projectList.forEach((project, index) => {
        console.log(`Project #${index + 1}:`, {
            ID: project.project_id,
            Name: project.project_name,
            FarmPresident: project.farm_president,
            LeadFarmer: project.lead_farmer,
            Dates: `${project.start_date} - ${project.end_date}`,
            Crop: project.crop_name,
            CropType: project.crop_type_name,
            Status: project.status
        });
    });
    console.log("---------------------------");
}

logProjectDetails();

//  <------------- TABLE DISPLAY AND UPDATE ------------->
function updateTable() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = projectList.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8">No records found.</td></tr>`;
    }

    pageData.forEach((data) => {
        const row = document.createElement("tr");
        const formattedProjectName = formatProjectName(data.project_name);
        const formattedFarmPresident = formatFarmPresident(data.farm_president);
        const formattedLeadFarmer = formatLeadFarmer(data.lead_farmer);
        const formattedCrop = formatCrop(data.crop_name);
        const formattedCropType = formatCropType(data.crop_type_name);
        const formattedStatus = formatStatus(data.status);
        
        row.innerHTML = `
            <td>${formattedProjectName || "Project Name not recorded"}</td>
            <td>${formattedFarmPresident || "Farm President not recorded"}</td>
            <td>${formattedLeadFarmer || "Lead Farmer not recorded"}</td>
            <td>${data.start_date || "Start Date not recorded"}</td>
            <td>${data.end_date || "End Date not recorded"}</td>
            <td>${formattedCrop || "Crop not recorded"}</td>
            <td>${formattedCropType || "Crop Type not recorded"}</td>
            <td>${formattedStatus || "Status not recorded"}</td>
        `;
        tableBody.appendChild(row);
    });

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

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", () => {
    fetch_projects({
        search: searchBar.value,
        barangay: barangaySelect.value,
    });
});

barangaySelect.addEventListener("change", () => {
    fetch_projects({
        search: searchBar.value,
        barangay: barangaySelect.value,
    });
});

// <----------------------- BARANGAY DROP DOWN CODE ----------------------->
async function fetch_barangays() {
    try {
        const querySnapshot = await getDocs(collection(db, "tb_barangay"));

        let addedBarangays = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let barangayName = data.barangay_name || "";
            
            if (!barangayName || barangayName.trim() === "") {
                return;
            }

            barangayName = barangayName.charAt(0).toUpperCase() + barangayName.slice(1).toLowerCase();

            if (!addedBarangays.includes(barangayName)) {
                addedBarangays.push(barangayName);

                const option = document.createElement("option");
                option.value = barangayName;
                option.textContent = barangayName;
                barangaySelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error Fetching Barangays:", error);
    }
}

fetch_projects();
fetch_barangays();