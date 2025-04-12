import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    getDoc,
    setDoc,
    addDoc,
    Timestamp,
    updateDoc,
    query,
    where,
    getFirestore
} from "firebase/firestore";

import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);

const tableBody = document.getElementById("team_table_body");
const teamNameHeader = document.querySelector("h2.team-name");
const searchBar = document.getElementById("team-search-bar");
const prevPageBtn = document.getElementById("farmers-prev-page");
const nextPageBtn = document.getElementById("farmers-next-page");
const pageNumberSpan = document.getElementById("farmers-page-number");

let currentPage = 1;
const rowsPerPage = 5;
let farmerAccounts = [];
let currentTeamName = "";

async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userQuery = query(collection(db, "tb_farmers"), where("email", "==", user.email));
                    const userSnapshot = await getDocs(userQuery);

                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        resolve({ 
                            email: user.email, 
                            user_type: userData.user_type, 
                            farmer_id: userData.farmer_id,
                            barangay_name: userData.barangay_name 
                        });
                    } else {
                        console.error("User record not found in tb_farmers.");
                        reject("User record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching user from tb_farmers:", error);
                    reject(error);
                }
            } else {
                reject("No authenticated user.");
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    fetchFarmerAccounts();
    searchBar.addEventListener("input", () => fetchFarmerAccounts({ search: searchBar.value }));
});

async function fetchFarmerAccounts(filter = {}) {
    try {
        const currentUser = await getAuthenticatedUser();
        const currentFarmerId = currentUser.farmer_id;

        // Fetch team where current user's farmer_id matches lead_farmer_id
        const teamsQuery = query(
            collection(db, "tb_teams"),
            where("lead_farmer_id", "==", currentFarmerId)
        );
        const teamsSnapshot = await getDocs(teamsQuery);
        
        const teamFarmerIds = new Set();
        currentTeamName = "";

        if (teamsSnapshot.empty) {
            // No teams found where user is lead farmer
            currentTeamName = "Currently not a Farm Leader";
            farmerAccounts = [];
            
            // Check if user is a team member instead
            const allTeamsSnapshot = await getDocs(collection(db, "tb_teams"));
            allTeamsSnapshot.forEach((doc) => {
                const teamData = doc.data();
                if (teamData.farmer_name && Array.isArray(teamData.farmer_name)) {
                    const isMember = teamData.farmer_name.some(farmer => farmer.farmer_id === currentFarmerId);
                    if (isMember) {
                        currentTeamName = `Member of ${teamData.team_name || "Unnamed Team"}`;
                    }
                }
            });
        } else {
            // User is a lead farmer
            teamsSnapshot.forEach((doc) => {
                const teamData = doc.data();
                currentTeamName = teamData.team_name || "Unnamed Team";
                if (teamData.farmer_name && Array.isArray(teamData.farmer_name)) {
                    teamData.farmer_name.forEach(farmer => {
                        if (farmer.farmer_id) {
                            teamFarmerIds.add(farmer.farmer_id);
                        }
                    });
                }
            });
        }

        // Set the team name in the header
        if (teamNameHeader) {
            teamNameHeader.textContent = currentTeamName;
        }

        if (teamFarmerIds.size === 0) {
            farmerAccounts = [];
            updateTable();
            return;
        }

        // Fetch farmers matching the collected farmer_ids
        const querySnapshot = await getDocs(collection(db, "tb_farmers"));
        farmerAccounts = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (teamFarmerIds.has(data.farmer_id)) {
                const searchTerm = filter.search?.toLowerCase();
                const matchesSearch = searchTerm
                    ? `${data.first_name || ""} ${data.middle_name || ""} ${data.last_name || ""}`
                        .toLowerCase()
                        .includes(searchTerm) ||
                      (data.barangay_name || "").toLowerCase().includes(searchTerm) ||
                      (data.user_type || "").toLowerCase().includes(searchTerm)
                    : true;

                if (matchesSearch) {
                    farmerAccounts.push({ id: doc.id, ...data });
                }
            }
        });

        // Define hierarchy order
        const roleHierarchy = {
            "farm president": 1,
            "head farmer": 2,
            "farmers": 3
        };

        // Sort by hierarchy first, then by farmer_id
        farmerAccounts.sort((a, b) => {
            const roleA = (a.user_type || "").toLowerCase();
            const roleB = (b.user_type || "").toLowerCase();
            const hierarchyA = roleHierarchy[roleA] || 4;
            const hierarchyB = roleHierarchy[roleB] || 4;
            
            if (hierarchyA !== hierarchyB) {
                return hierarchyA - hierarchyB;
            }
            
            const farmerIdA = a.farmer_id || "";
            const farmerIdB = b.farmer_id || "";
            
            if (isNaN(farmerIdA) && isNaN(farmerIdB)) {
                return String(farmerIdA).localeCompare(String(farmerIdB), undefined, { numeric: true });
            }
            if (!isNaN(farmerIdA) && !isNaN(farmerIdB)) {
                return Number(farmerIdA) - Number(farmerIdB);
            }
            return isNaN(farmerIdA) ? 1 : -1;
        });

        const missingFarmerIds = farmerAccounts
            .filter(farmer => !farmer.farmer_id)
            .map(farmer => formatName(farmer.first_name, farmer.middle_name, farmer.last_name));
        
        if (missingFarmerIds.length > 0) {
            console.log("Farmer ID's are not retrieved for the following farmers: " + missingFarmerIds.join(", "));
        }

        updateTable();
    } catch (error) {
        console.error("Error Fetching Farmer Accounts:", error);
    }
}

function capitalizeWords(str) {
    return str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatBarangay(barangay) {
    const formattedBarangay = barangay ? capitalizeWords(barangay) : "";
    return `${formattedBarangay}`.trim();
}

function formatUserType(user_type) {
    const formattedUserType = user_type ? capitalizeWords(user_type) : "";
    return `${formattedUserType}`.trim();
}

function formatName(firstName, middleName, lastName) {
    function getMiddleInitial(middle) {
        return middle ? middle.charAt(0).toUpperCase() + "." : "";
    }

    const formattedFirstName = firstName ? capitalizeWords(firstName) : "";
    const formattedMiddleName = getMiddleInitial(middleName);
    const formattedLastName = lastName ? capitalizeWords(lastName) : "";

    return `${formattedFirstName} ${formattedMiddleName} ${formattedLastName}`.trim();
}

function updateTable() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = currentPage * rowsPerPage;
    const pageData = farmerAccounts.slice(start, end);

    tableBody.innerHTML = "";

    if (pageData.length === 0 && farmerAccounts.length > 0) {
        currentPage = Math.max(1, Math.ceil(farmerAccounts.length / rowsPerPage));
        updateTable();
        return;
    } else if (farmerAccounts.length === 0) {
        tableBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center;">No record found</td>
        </tr>`;
    }

    pageData.forEach((data) => {
        const row = document.createElement("tr");
        const formattedName = formatName(data.first_name, data.middle_name, data.last_name);
        const formattedBarangay = formatBarangay(data.barangay_name);
        const formattedUserType = formatUserType(data.user_type);
        row.innerHTML = `
            <td>${currentTeamName || "Team name not recorded"}</td>
            <td>${formattedName || "User's name not recorded"}</td>
            <td>${formattedUserType || "User's role not recorded"}</td>
            <td>${formattedBarangay || "Barangay not recorded"}</td>
            <td>${data.contact || "Contact not recorded"}</td>
        `;
        tableBody.appendChild(row);
    });
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage) || 1;
    pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage) || 1;
    
    if (direction === "prev" && currentPage > 1) {
        currentPage--;
    } else if (direction === "next" && currentPage < totalPages) {
        currentPage++;
    }
    
    updateTable();
}

prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));