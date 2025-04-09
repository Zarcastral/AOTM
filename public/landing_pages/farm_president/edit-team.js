import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('docId');    // Firestore document ID
    const teamId = urlParams.get('teamId');  // Custom team_id
    let teamData = null;
    let farmersList = [];
    let currentFarmers = [];
    let currentPage = 1;
    const itemsPerPage = 5;

    async function loadTeamData() {
        const urlParams = new URLSearchParams(window.location.search);
        const teamId = urlParams.get('teamId');
    
        if (!teamId) {
            alert('No team ID provided');
            window.location.href = 'team-list.html';
            return;
        }
    
        try {
            // Query tb_teams where team_id matches the provided teamId
            const q = query(collection(db, "tb_teams"), where("team_id", "==", parseInt(teamId)));
            const querySnapshot = await getDocs(q);
    
            if (!querySnapshot.empty) {
                // Assuming team_id is unique, take the first matching document
                const teamDoc = querySnapshot.docs[0];
                teamData = teamDoc.data();
                document.getElementById('teamNameHeader').textContent = `${teamData.team_name || 'Team Name'} (ID: ${teamId})`;
                currentFarmers = Array.isArray(teamData.farmer_name) ? teamData.farmer_name : [];
                await fetchFarmers();
                renderTable();
            } else {
                alert('Team not found');
                window.location.href = 'team-list.html';
            }
        } catch (error) {
            console.error('Error loading team data:', error);
            alert('Error loading team data. Please try again.');
        }
    }

    async function fetchFarmers() {
        try {
            if (!teamData || !teamData.barangay_name) {
                console.error("Team data or barangay name not available.");
                farmersList = [];
                return;
            }
    
            const currentBarangay = teamData.barangay_name;
    
            // Step 1: Fetch all teams to collect all assigned farmer names
            const teamsSnapshot = await getDocs(collection(db, "tb_teams"));
            const assignedFarmerNames = new Set();
    
            teamsSnapshot.forEach((teamDoc) => {
                const docTeamData = teamDoc.data();
                // Add lead farmer name if present
                if (docTeamData.lead_farmer) {
                    assignedFarmerNames.add(docTeamData.lead_farmer.trim().toLowerCase());
                }
                // Add all farmer names from farmer_name array
                if (docTeamData.farmer_name && Array.isArray(docTeamData.farmer_name)) {
                    docTeamData.farmer_name.forEach(farmerObj => {
                        if (farmerObj.farmer_name) {
                            assignedFarmerNames.add(farmerObj.farmer_name.trim().toLowerCase());
                        }
                    });
                }
            });
    
            // Step 2: Fetch all farmers from tb_farmers in the current barangay
            const q = query(
                collection(db, "tb_farmers"),
                where("barangay_name", "==", currentBarangay),
                where("user_type", "in", ["Farmer", "Head Farmer"]) // Include both types
            );
    
            const querySnapshot = await getDocs(q);
            const allFarmers = querySnapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const farmerName = `${data.last_name}, ${data.first_name} ${data.middle_name || ''}`.trim();
                    return {
                        id: doc.id,
                        farmer_id: data.farmer_id,
                        farmer_name: farmerName,
                        contact: data.contact || '',
                        barangay_name: data.barangay_name,
                        user_type: data.user_type
                    };
                });
    
            // Step 3: Filter out farmers already assigned to any team
            farmersList = allFarmers.filter(farmer => 
                !assignedFarmerNames.has(farmer.farmer_name.trim().toLowerCase())
            );
    
            console.log("Fetched available farmers:", farmersList);
        } catch (error) {
            console.error("Error fetching farmers:", error);
            farmersList = [];
        }
    }
    
    function renderTable(searchTerm = '') {
        const tbody = document.getElementById('teamTableBody');
        tbody.innerHTML = '';
    
        const leadFarmerEntry = {
            farmer_id: teamData.lead_farmer_id || 'lead_' + teamData.team_id,
            farmer_name: teamData.lead_farmer || 'No Lead Farmer',
            contact: teamData.lead_farmer_contact || farmersList.find(f => f.farmer_name === teamData.lead_farmer)?.contact || 'No contact'
        };
        const allFarmers = [leadFarmerEntry, ...currentFarmers];
    
        const filteredFarmers = allFarmers.filter(farmer => 
            farmer.farmer_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedFarmers = filteredFarmers.slice(start, end);
    
        paginatedFarmers.forEach((farmer, index) => {
            const row = document.createElement('tr');
            const userRole = farmer.farmer_name === teamData.lead_farmer ? 'Head Farmer' : 'Farmer';
            const contact = farmer.contact || 'No contact';
            row.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${farmer.farmer_name}</td>
                <td>${userRole}</td>
                <td>${contact}</td>
                <td>
                    ${userRole === 'Head Farmer' ? '' : `<button class="action-btn" data-farmer-id="${farmer.farmer_id}">Remove</button>`}
                </td>
            `;
            tbody.appendChild(row);
        });
    
        updatePagination(filteredFarmers.length);
        addRemoveEventListeners();
    }

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    currentPage = Math.min(currentPage, totalPages || 1);
    document.getElementById('pageInfo').textContent = `${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function addRemoveEventListeners() {
    document.querySelectorAll('.action-btn').forEach(button => {
        button.removeEventListener('click', handleRemoveClick);
        button.addEventListener('click', handleRemoveClick);
    });
}

async function handleRemoveClick(e) {
    const farmerId = e.target.dataset.farmerId;
    const farmer = currentFarmers.find(f => f.farmer_id === farmerId);
    if (!farmer) {
        console.error(`Farmer with ID ${farmerId} not found in currentFarmers`);
        return;
    }
    currentFarmers = currentFarmers.filter(f => f.farmer_id !== farmerId);
    await updateTeamInFirestore();
    alert(`Successfully removed ${farmer.farmer_name} from the team!`);
    await fetchFarmers(); // Refresh farmersList to include the removed farmer
    renderTable(document.getElementById('searchInput').value);
}



async function fetchFarmerByName(farmerName) {
    try {
        const [lastName, firstAndMiddle] = farmerName.split(', ');
        const nameParts = firstAndMiddle ? firstAndMiddle.trim().split(' ') : [];
        const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : firstAndMiddle.trim(); // "Mary Loi"
        const middleName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''; // "Yves"

        console.log(`Searching tb_farmers for: last_name="${lastName}", first_name="${firstName}", barangay_name="${teamData.barangay_name}"`);

        const q = query(
            collection(db, "tb_farmers"),
            where("last_name", "==", lastName.trim()),
            where("first_name", "==", firstName.trim()),
            where("barangay_name", "==", teamData.barangay_name)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const matches = querySnapshot.docs.filter(doc => {
                const data = doc.data();
                const fullName = `${data.last_name}, ${data.first_name}${data.middle_name ? ' ' + data.middle_name : ''}`.trim();
                return fullName.toLowerCase() === farmerName.toLowerCase();
            });

            if (matches.length > 0) {
                const farmerData = matches[0].data();
                console.log(`Found match for ${farmerName}:`, farmerData);
                return {
                    farmer_id: farmerData.farmer_id || '',
                    farmer_name: `${farmerData.last_name}, ${farmerData.first_name}${farmerData.middle_name ? ' ' + farmerData.middle_name : ''}`.trim(),
                    contact: farmerData.contact || ''
                };
            } else {
                console.log(`Found ${querySnapshot.docs.length} farmers with last_name="${lastName}" and first_name="${firstName}", but none matched full name "${farmerName}"`);
                console.log("Possible matches:", querySnapshot.docs.map(doc => doc.data()));
                return null;
            }
        } else {
            console.log(`No farmers found in tb_farmers for ${farmerName} with last_name="${lastName}" and first_name="${firstName}"`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching farmer by name ${farmerName}:`, error);
        return null;
    }
}


async function updateTeamInFirestore() {
    const urlParams = new URLSearchParams(window.location.search);
    const teamId = urlParams.get('teamId');
    try {
        const q = query(collection(db, "tb_teams"), where("team_id", "==", parseInt(teamId)));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const teamDocRef = doc(db, "tb_teams", querySnapshot.docs[0].id);
            await updateDoc(teamDocRef, { farmer_name: currentFarmers });
        } else {
            throw new Error('Team not found');
        }
    } catch (error) {
        console.error('Error updating team:', error);
        alert('Error updating team. Please try again.');
    }
}

function renderFarmerResults(searchValue = '') {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    const filteredFarmers = farmersList.filter(farmer =>
        farmer.farmer_name.toLowerCase().includes(searchValue.toLowerCase())
    );

    if (filteredFarmers.length === 0) {
        resultsContainer.innerHTML = '<div class="search-item">No matching farmers found</div>';
        return;
    }

    filteredFarmers.forEach(farmer => {
        const div = document.createElement('div');
        div.classList.add('search-item');
        div.textContent = farmer.farmer_name;
        div.dataset.id = farmer.id;
        div.addEventListener('click', () => {
            addFarmerToBox(farmer);
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none'; // Hide after selection
        });
        resultsContainer.appendChild(div);
    });
}


function addFarmerToBox(farmer) {
    const farmerBox = document.getElementById('farmerBox');
    // Verify farmer is still in farmersList to prevent stale data
    if (!farmersList.some(f => f.farmer_name === farmer.farmer_name)) {
        console.warn(`Farmer ${farmer.farmer_name} is no longer available; skipping addition.`);
        return;
    }

    const farmerDiv = document.createElement('div');
    farmerDiv.classList.add('farmer-item');
    farmerDiv.textContent = farmer.farmer_name;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.classList.add('remove-btn');
    removeBtn.addEventListener('click', () => {
        farmerDiv.remove();
        farmersList.push(farmer);
    });

    farmerDiv.appendChild(removeBtn);
    farmerBox.appendChild(farmerDiv);
    farmersList = farmersList.filter(f => f.id !== farmer.id);
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    renderTable(e.target.value);
});

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable(document.getElementById('searchInput').value);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(currentFarmers.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable(document.getElementById('searchInput').value);
    }
});

document.getElementById('addFarmerBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('addFarmerPopup').style.display = 'flex';
});

document.getElementById('closePopup').addEventListener('click', () => {
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
});

const farmerSearch = document.getElementById('farmerSearch');
const searchResults = document.getElementById('searchResults');

// Show all farmers when the search bar is focused
farmerSearch.addEventListener('focus', () => {
    renderFarmerResults(''); // Empty string shows all farmers
    searchResults.style.display = 'block'; // Ensure results are visible
});

// Filter farmers as the user types
farmerSearch.addEventListener('input', (e) => {
    renderFarmerResults(e.target.value);
    searchResults.style.display = 'block'; // Keep results visible while typing
});

// Hide results when clicking outside
document.addEventListener('click', (e) => {
    if (!farmerSearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none'; // Hide results when clicking outside
    }
});

document.getElementById('saveFarmerBtn').addEventListener('click', async () => {
    const farmerBox = document.getElementById('farmerBox');
    const newFarmers = await Promise.all(
        Array.from(farmerBox.getElementsByClassName('farmer-item'))
            .map(async (item) => {
                const farmerName = item.firstChild.textContent.trim();
                let farmer = farmersList.find(f => f.farmer_name.trim().toLowerCase() === farmerName.trim().toLowerCase()) || 
                             teamData.farmer_name.find(f => f.farmer_name.trim().toLowerCase() === farmerName.trim().toLowerCase());
                
                if (!farmer) {
                    console.warn(`Farmer not found in initial lists for name: ${farmerName}`);
                    // Fallback: Fetch from tb_farmers
                    const fetchedFarmer = await fetchFarmerByName(farmerName);
                    if (fetchedFarmer) {
                        farmer = fetchedFarmer;
                    } else {
                        console.error(`Farmer ${farmerName} not found in tb_farmers; skipping.`);
                        return null; // Skip this farmer
                    }
                }
                
                return {
                    farmer_id: farmer.farmer_id || '',
                    farmer_name: farmer.farmer_name,
                    contact: farmer.contact || ''
                };
            })
    );

    const validFarmers = newFarmers.filter(farmer => farmer !== null && farmer.farmer_id !== '');
    
    if (validFarmers.length === 0) {
        alert('No valid farmers selected to add.');
        return;
    }

    currentFarmers = [...currentFarmers, ...validFarmers];
    await updateTeamInFirestore();
    
    // Add alert for successful addition
    alert(`Successfully added ${validFarmers.length} new member${validFarmers.length > 1 ? 's' : ''} to the team!`);
    
    renderTable();
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
    await fetchFarmers();
});

document.addEventListener('DOMContentLoaded', loadTeamData);