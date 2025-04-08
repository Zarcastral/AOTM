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
            const currentTeamFarmerIds = new Set(
                (teamData.farmer_name || []).map(farmer => String(farmer.farmer_id))
            );
    
            // Step 1: Include the lead farmer from teamData
            let leadFarmerContact = teamData.lead_farmer_contact || '';
            if (!leadFarmerContact && teamData.lead_farmer_id) {
                const leadFarmerQuery = query(
                    collection(db, "tb_farmers"),
                    where("farmer_id", "==", teamData.lead_farmer_id)
                );
                const leadFarmerSnap = await getDocs(leadFarmerQuery);
                if (!leadFarmerSnap.empty) {
                    leadFarmerContact = leadFarmerSnap.docs[0].data().contact || '';
                }
            }
    
            const leadFarmer = {
                id: teamData.lead_farmer_id || 'lead_' + teamData.team_id,
                farmer_id: teamData.lead_farmer_id || '',
                farmer_name: teamData.lead_farmer || 'No Lead Farmer',
                contact: leadFarmerContact,
                barangay_name: currentBarangay,
                user_type: "Head Farmer"
            };
    
            // Step 2: Include farmers from the current team's farmer_name array
            const currentTeamFarmers = (teamData.farmer_name || []).map(farmer => ({
                id: farmer.farmer_id,
                farmer_id: farmer.farmer_id,
                farmer_name: farmer.farmer_name,
                contact: farmer.contact || '',
                barangay_name: currentBarangay,
                user_type: "Farmer"
            }));
    
            // Step 3: Fetch all teams to determine excluded farmer_ids (excluding current team)
            const teamsSnapshot = await getDocs(collection(db, "tb_teams"));
            const excludedFarmerIds = new Set();
    
            teamsSnapshot.forEach((teamDoc) => {
                const docTeamData = teamDoc.data();
                const urlParams = new URLSearchParams(window.location.search);
                const teamId = parseInt(urlParams.get('teamId'));
                if (docTeamData.team_id !== teamId && docTeamData.farmer_name && Array.isArray(docTeamData.farmer_name)) {
                    docTeamData.farmer_name.forEach(farmerObj => {
                        if (farmerObj.farmer_id) {
                            excludedFarmerIds.add(String(farmerObj.farmer_id));
                        }
                    });
                }
            });
    
            // Step 4: Fetch ALL farmers from tb_farmers in the barangay, not just unassigned
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
    
            // Step 5: Combine lead farmer, current team farmers, and all farmers (excluding those already in farmerBox)
            const farmerBoxNames = new Set(
                Array.from(document.getElementById('farmerBox').getElementsByClassName('farmer-item'))
                    .map(item => item.firstChild.textContent.trim())
            );
            farmersList = [leadFarmer, ...currentTeamFarmers, ...allFarmers]
                .filter(farmer => !farmerBoxNames.has(farmer.farmer_name) && farmer.farmer_id !== leadFarmer.farmer_id);
    
            console.log("Fetched farmers with lead farmer and contacts:", farmersList);
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
                    <button class="action-btn" data-farmer-id="${farmer.farmer_id}">Remove</button>
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
        button.addEventListener('click', async (e) => {
            const farmerId = e.target.dataset.farmerId;
            currentFarmers = currentFarmers.filter(farmer => farmer.farmer_id !== farmerId);
            await updateTeamInFirestore();
            renderTable(document.getElementById('searchInput').value);
        });
    });
}

/*async function fetchFarmerByName(farmerName) {
    try {
        const [lastName, firstAndMiddle] = farmerName.split(', ');
        const firstName = firstAndMiddle ? firstAndMiddle.split(' ')[0] : '';
        const middleName = firstAndMiddle ? firstAndMiddle.split(' ')[1] || '' : '';
        
        const q = query(
            collection(db, "tb_farmers"),
            where("last_name", "==", lastName),
            where("first_name", "==", firstName)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const farmerData = querySnapshot.docs[0].data();
            return {
                farmer_id: farmerData.farmer_id || '',
                farmer_name: `${farmerData.last_name}, ${farmerData.first_name} ${farmerData.middle_name || ''}`.trim(),
                contact: farmerData.contact || ''
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching farmer by name ${farmerName}:`, error);
        return null;
    }
}*/


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
        });
        resultsContainer.appendChild(div);
    });
}

function addFarmerToBox(farmer) {
    const farmerBox = document.getElementById('farmerBox');
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

document.getElementById('farmerSearch').addEventListener('input', (e) => {
    renderFarmerResults(e.target.value);
});

document.getElementById('saveFarmerBtn').addEventListener('click', async () => {
    const farmerBox = document.getElementById('farmerBox');
    const newFarmers = Array.from(farmerBox.getElementsByClassName('farmer-item'))
        .map(item => {
            const farmerName = item.firstChild.textContent.trim();
            // Try to find the farmer in farmersList or teamData.farmer_name
            let farmer = farmersList.find(f => f.farmer_name.trim().toLowerCase() === farmerName.trim().toLowerCase()) || 
                         teamData.farmer_name.find(f => f.farmer_name.trim().toLowerCase() === farmerName.trim().toLowerCase());
            
            if (!farmer) {
                console.warn(`Farmer not found for name: ${farmerName}`);
                // Attempt to fetch from tb_farmers as a fallback
                return fetchFarmerByName(farmerName).then(fetchedFarmer => {
                    if (fetchedFarmer) {
                        return fetchedFarmer;
                    }
                    return {
                        farmer_id: '', // Will be filtered out
                        farmer_name: farmerName,
                        contact: ''
                    };
                });
            }
            return Promise.resolve({
                farmer_id: farmer.farmer_id || '',
                farmer_name: farmer.farmer_name,
                contact: farmer.contact || ''
            });
        });

    // Wait for all promises to resolve
    const resolvedFarmers = await Promise.all(newFarmers);
    const validFarmers = resolvedFarmers.filter(farmer => farmer.farmer_id !== '');

    if (validFarmers.length === 0) {
        alert('No valid farmers selected to add.');
        return;
    }

    currentFarmers = [...currentFarmers, ...validFarmers];
    await updateTeamInFirestore();
    renderTable();
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
    await fetchFarmers();
});

document.addEventListener('DOMContentLoaded', loadTeamData);