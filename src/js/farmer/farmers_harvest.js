import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
    deleteDoc,
    writeBatch,
    getDoc,
    setDoc,
    onSnapshot,
    doc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

// Global variables for farmer details
let currentFarmerId = null;
let currentUserType = null;
let currentFirstName = null;
let currentMiddleName = null;
let currentLastName = null;

// Pagination variables
let currentPage = 1;
const rowsPerPage = 5;
let filteredData = [];

// Function to get authenticated farmer details
async function getAuthenticatedFarmer() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Get user's email and convert to lowercase
                    const userEmailLower = user.email ? user.email.toLowerCase() : null;
                    if (!userEmailLower) {
                        console.error("User email is not available.");
                        reject("User email is not available.");
                        return;
                    }

                    // Fetch all farmers and find a match case-insensitively
                    const farmerCollection = collection(db, "tb_farmers");
                    const farmerSnapshot = await getDocs(farmerCollection);
                    let matchingDoc = null;

                    farmerSnapshot.forEach((doc) => {
                        const data = doc.data();
                        if (data.email && typeof data.email === 'string' && 
                            data.email.toLowerCase() === userEmailLower) {
                            matchingDoc = doc;
                        }
                    });

                    if (matchingDoc) {
                        const farmerData = matchingDoc.data();
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
                        console.error("Farmer record not found for email:", userEmailLower);
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

// Function to fetch harvest data
async function fetchHarvestData() {
    try {
        const farmer = await getAuthenticatedFarmer();
        const harvestCollection = collection(db, "tb_validatedharvest");
        const harvestSnapshot = await getDocs(harvestCollection);
        const harvestList = [];

        harvestSnapshot.forEach((doc) => {
            const data = doc.data();
            const farmerNameArray = Array.isArray(data.farmer_name) ? data.farmer_name : [];

            // Check if currentFarmerId matches any farmer_id in farmer_name array
            const isFarmerIncluded = farmerNameArray.some((farmerEntry) => {
                // Check if farmerEntry is an object and has a farmer_id field
                if (farmerEntry && typeof farmerEntry === 'object') {
                    // If farmer_id is a direct field
                    if ('farmer_id' in farmerEntry) {
                        return farmerEntry.farmer_id === currentFarmerId;
                    }
                    // If farmer_id is nested within another object
                    return Object.values(farmerEntry).some(nestedValue => 
                        nestedValue && typeof nestedValue === 'object' && nestedValue.farmer_id === currentFarmerId
                    );
                }
                return false;
            });

            if (isFarmerIncluded) {
                harvestList.push({
                    id: data.project_id || "N/A",
                    name: data.project_name || "N/A",
                    date: data.harvest_date || null,
                    lead_farmer: data.lead_farmer || "N/A",
                    barangay: data.barangay_name || "N/A",
                    crop_name: data.crop_name || "N/A",
                    crop_type: data.crop_type_name || "N/A",
                    total_harvested: data.total_harvested_crops || "0",
                    unit: data.unit || "kg",
                });
            }
        });

        return harvestList;
    } catch (error) {
        console.error("Error fetching harvest data:", error);
        return [];
    }
}

// Function to display data in a table
function displayTable(dataList, tableSelector) {
    const tableBody = document.querySelector(`${tableSelector} table tbody`);
    if (!tableBody) {
        console.error(`Table body not found at selector: ${tableSelector}`);
        return;
    }

    tableBody.innerHTML = "";
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = dataList.slice(startIndex, endIndex);

    if (paginatedData.length === 0) {
        tableBody.innerHTML = `
            <tr class="no-records-message">
                <td colspan="8" style="text-align: center;">No records found</td>
            </tr>
        `;
        updatePagination();
        return;
    }

    paginatedData.forEach((harvest) => {
        const row = document.createElement("tr");

        // Format date
        const formattedDate = harvest.date
            ? harvest.date.toDate
                ? harvest.date.toDate().toLocaleDateString()
                : new Date(harvest.date).toLocaleDateString()
            : "N/A";

        row.innerHTML = `
            <td>${harvest.name}</td>
            <td>${formattedDate}</td>
            <td>${harvest.lead_farmer}</td>
            <td>${harvest.barangay}</td>
            <td>${harvest.crop_name}</td>
            <td>${harvest.crop_type}</td>
            <td>${harvest.total_harvested} ${harvest.unit}</td>
        `;
        tableBody.appendChild(row);
    });

    updatePagination();
}

// Function to update pagination display
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    const pageNumberElement = document.getElementById("page-number");
    if (pageNumberElement) {
        pageNumberElement.textContent = `${currentPage} of ${totalPages}`;
    }
    updatePaginationButtons();
}

// Function to enable/disable pagination buttons
function updatePaginationButtons() {
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    if (prevButton) {
        prevButton.disabled = currentPage === 1;
    }
    if (nextButton) {
        nextButton.disabled = currentPage >= Math.ceil(filteredData.length / rowsPerPage);
    }
}

// Initialize table and pagination
async function initializeTable(tableSelector) {
    filteredData = await fetchHarvestData();
    sortDataByDate();
    displayTable(filteredData, tableSelector);

    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                displayTable(filteredData, tableSelector);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            if (currentPage * rowsPerPage < filteredData.length) {
                currentPage++;
                displayTable(filteredData, tableSelector);
            }
        });
    }
}

// Sort data by date (latest to oldest)
function sortDataByDate() {
    filteredData.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateB - dateA;
    });
}

// Helper function to parse dates
function parseDate(dateValue) {
    if (!dateValue) return new Date(0);
    if (dateValue.toDate) return dateValue.toDate();
    return new Date(dateValue);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeTable(".table-container");
});