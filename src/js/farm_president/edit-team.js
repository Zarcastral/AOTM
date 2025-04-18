import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    getDocs,
    query,
    deleteDoc,
    where
} from "firebase/firestore";

import app from "../../../src/config/firebase_config.js";
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('teamId');
let teamData = null;
let farmersList = [];
let currentFarmers = [];
let currentPage = 1;
const itemsPerPage = 5;
let isTeamAssigned = false;

// Function to show success panel
function showSuccessPanel(message) {
    const successMessage = document.createElement("div");
    successMessage.className = "success-message";
    successMessage.textContent = message;
  
    document.body.appendChild(successMessage);
  
    // Fade in
    successMessage.style.display = "block";
    setTimeout(() => {
      successMessage.style.opacity = "1";
    }, 5);
  
    // Fade out after 4 seconds
    setTimeout(() => {
      successMessage.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 400);
    }, 4000);
}
  
// Function to show error panel
function showErrorPanel(message) {
    const errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
    errorMessage.textContent = message;
  
    document.body.appendChild(errorMessage);
  
    // Fade in
    errorMessage.style.display = "block";
    setTimeout(() => {
      errorMessage.style.opacity = "1";
    }, 5);
  
    // Fade out after 4 seconds
    setTimeout(() => {
      errorMessage.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(errorMessage);
      }, 400);
    }, 4000);
}

async function loadTeamData() {
    // Hide popup immediately to prevent flash
    //const addFarmerPopup = document.getElementById('addFarmerPopup');
    //if (addFarmerPopup) {
      //  addFarmerPopup.style.display = 'none';
    //}

    if (!teamId) {
        showErrorPanel('No team ID provided');
        window.location.href = 'team-list.html';
        return;
    }

    try {
        const q = query(collection(db, "tb_teams"), where("team_id", "==", parseInt(teamId)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const teamDoc = querySnapshot.docs[0];
            teamData = teamDoc.data();
            document.getElementById('teamNameHeader').textContent = `${teamData.team_name || 'Team Name'} (ID: ${teamId})`;
            currentFarmers = Array.isArray(teamData.farmer_name) ? teamData.farmer_name : [];
            await fetchFarmers();
            isTeamAssigned = await isTeamAssignedToProject(teamId);
            renderTable();
            updateButtonStates();
        } else {
            showErrorPanel('Team not found');
            window.location.href = 'team-list.html';
        }
    } catch (error) {
        console.error('Error loading team data:', error);
        showErrorPanel('Error loading team data. Please try again.');
    }
}

async function isTeamAssignedToProject(teamId) {
    try {
        const projectsQuery = query(collection(db, "tb_projects"), where("team_id", "==", parseInt(teamId)));
        const projectsSnapshot = await getDocs(projectsQuery);
        return !projectsSnapshot.empty;
    } catch (error) {
        console.error(`Error checking project assignment for team ${teamId}:`, error);
        return false;
    }
}

function updateButtonStates() {
    const addFarmerBtn = document.getElementById('addFarmerBtn');
    const deleteTeamBtn = document.getElementById('deleteTeamBtn');

    if (isTeamAssigned) {
        addFarmerBtn.disabled = true;
        addFarmerBtn.style.opacity = '0.5';
        addFarmerBtn.style.cursor = 'not-allowed';
        addFarmerBtn.title = 'Cannot add farmers while team is assigned to a project';

        if (deleteTeamBtn) {
            deleteTeamBtn.disabled = true;
            deleteTeamBtn.style.opacity = '0.5';
            deleteTeamBtn.style.cursor = 'not-allowed';
            deleteTeamBtn.title = 'Cannot delete team while assigned to a project';
        }
    } else {
        addFarmerBtn.disabled = false;
        addFarmerBtn.style.opacity = '1';
        addFarmerBtn.style.cursor = 'pointer';
        addFarmerBtn.title = '';

        if (deleteTeamBtn) {
            deleteTeamBtn.disabled = false;
            deleteTeamBtn.style.opacity = '1';
            deleteTeamBtn.style.cursor = 'pointer';
            deleteTeamBtn.title = '';
        }
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

        const teamsSnapshot = await getDocs(collection(db, "tb_teams"));
        const assignedFarmerNames = new Set();

        teamsSnapshot.forEach((teamDoc) => {
            const docTeamData = teamDoc.data();
            if (docTeamData.lead_farmer) {
                assignedFarmerNames.add(docTeamData.lead_farmer.trim().toLowerCase());
            }
            if (docTeamData.farmer_name && Array.isArray(docTeamData.farmer_name)) {
                docTeamData.farmer_name.forEach(farmerObj => {
                    if (farmerObj.farmer_name) {
                        assignedFarmerNames.add(farmerObj.farmer_name.trim().toLowerCase());
                    }
                });
            }
        });

        const q = query(
            collection(db, "tb_farmers"),
            where("barangay_name", "==", currentBarangay),
            where("user_type", "in", ["Farmer", "Head Farmer"])
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
                ${userRole === 'Head Farmer' ? '' : 
                  `<button class="action-btn" data-farmer-id="${farmer.farmer_id}" ${isTeamAssigned ? 'disabled' : ''} style="${isTeamAssigned ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Remove</button>`}
            </td>
        `;
        tbody.appendChild(row);
    });

    updatePagination(filteredFarmers.length);
    addRemoveEventListeners();

    const tableContainer = document.getElementById('teamTableBody').parentElement.parentElement;
    let deleteButton = document.getElementById('deleteTeamBtn');
    if (!deleteButton) {
        deleteButton = document.createElement('button');
        deleteButton.id = 'deleteTeamBtn';
        deleteButton.textContent = 'x Delete Team';
        
        deleteButton.style.marginLeft = '100px';
        deleteButton.style.color = '#AC415B';
        deleteButton.style.border = 'none';
        deleteButton.style.padding = '8px 18px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.borderRadius = '5px';
        deleteButton.style.fontSize = '16px';
        deleteButton.style.fontWeight = '500';
        deleteButton.style.fontFamily = 'Arial, sans-serif';
        tableContainer.insertAdjacentElement('afterend', deleteButton);
    }

    attachDeleteTeamListener();
    updateButtonStates();
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    currentPage = Math.min(currentPage, totalPages || 1);
    document.getElementById('pageInfo').textContent = `${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

async function deleteTeam() {
    const deleteTeamPopup = document.getElementById('deleteTeamPopup');
    const deleteTeamMessage = document.getElementById('deleteTeamMessage');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const closeDeletePopup = document.getElementById('closeDeletePopup');

    // Set the confirmation message
    deleteTeamMessage.textContent = `Are you sure you want to delete the team "${teamData.team_name}" (ID: ${teamId})? This action cannot be undone.`;

    // Show the popup
    deleteTeamPopup.style.display = 'flex';

    // Return a promise to handle the user's choice
    return new Promise((resolve) => {
        const handleCancel = () => {
            deleteTeamPopup.style.display = 'none';
            resolve(false); // User canceled
            // Clean up event listeners
            confirmDeleteBtn.removeEventListener('click', handleConfirm);
            cancelDeleteBtn.removeEventListener('click', handleCancel);
            closeDeletePopup.removeEventListener('click', handleCancel);
        };

        const handleConfirm = async () => {
            deleteTeamPopup.style.display = 'none';
            try {
                const q = query(collection(db, "tb_teams"), where("team_id", "==", parseInt(teamId)));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const teamDocRef = doc(db, "tb_teams", querySnapshot.docs[0].id);
                    await deleteDoc(teamDocRef); // Delete the team document
                    showSuccessPanel(`Team "${teamData.team_name}" (ID: ${teamId}) has been successfully deleted!`);
                    resolve(true); // Deletion successful
                    setTimeout(() => {
                        window.location.href = 'farmpres_farmer.html'; // Redirect after success
                    }, 2000); // Delay redirect to show success message
                } else {
                    throw new Error('Team not found');
                }
            } catch (error) {
                console.error('Error deleting team:', error);
                showErrorPanel('Error deleting team. Please try again.');
                resolve(false); // Deletion failed
            }
            // Clean up event listeners
            confirmDeleteBtn.removeEventListener('click', handleConfirm);
            cancelDeleteBtn.removeEventListener('click', handleCancel);
            closeDeletePopup.removeEventListener('click', handleCancel);
        };

        // Add event listeners
        confirmDeleteBtn.addEventListener('click', handleConfirm);
        cancelDeleteBtn.addEventListener('click', handleCancel);
        closeDeletePopup.addEventListener('click', handleCancel);
    });
}

function attachDeleteTeamListener() {
    const deleteButton = document.getElementById('deleteTeamBtn');
    if (deleteButton) {
        deleteButton.removeEventListener('click', deleteTeam);
        deleteButton.addEventListener('click', async () => {
            if (!isTeamAssigned) {
                await deleteTeam();
            }
        });
    }
}

function addRemoveEventListeners() {
    document.querySelectorAll('.action-btn').forEach(button => {
        button.removeEventListener('click', handleRemoveClick);
        if (!isTeamAssigned && !button.disabled) {
            button.addEventListener('click', handleRemoveClick);
        }
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
    showSuccessPanel(`Successfully removed ${farmer.farmer_name} from the team!`);
    await fetchFarmers();
    renderTable(document.getElementById('searchInput').value);
}

async function fetchFarmerByName(farmerName) {
    try {
        const nameParts = farmerName.split(',');
        if (nameParts.length < 2) {
            console.error(`Invalid farmer name format: ${farmerName}. Expected format: "last_name, first_name middle_name"`);
            return null;
        }

        const lastName = nameParts[0].trim();
        const firstAndMiddle = nameParts.slice(1).join(',').trim();
        const firstAndMiddleParts = firstAndMiddle ? firstAndMiddle.split(/\s+/) : [];

        let firstName = firstAndMiddleParts[0] || '';
        let middleName = firstAndMiddleParts.length > 1 ? firstAndMiddleParts.slice(1).join(' ') : '';

        console.log(`Searching tb_farmers for: last_name="${lastName}", first_name="${firstName}", barangay_name="${teamData.barangay_name}"`);

        let q = query(
            collection(db, "tb_farmers"),
            where("last_name", "==", lastName),
            where("barangay_name", "==", teamData.barangay_name)
        );
        let querySnapshot = await getDocs(q);

        let matches = [];
        if (!querySnapshot.empty) {
            matches = querySnapshot.docs.filter(doc => {
                const data = doc.data();
                const dbFirstName = data.first_name || '';
                const dbMiddleName = data.middle_name || '';
                const dbFullName = `${data.last_name}, ${dbFirstName}${dbMiddleName ? ' ' + dbMiddleName : ''}`.trim();
                const firstNameMatch = dbFirstName.toLowerCase() === firstName.toLowerCase();
                const fullNameMatch = dbFullName.toLowerCase() === farmerName.toLowerCase();
                const partialNameMatch = `${data.last_name}, ${dbFirstName}`.trim().toLowerCase() === farmerName.toLowerCase();
                return firstNameMatch && (fullNameMatch || partialNameMatch);
            });
        }

        if (matches.length === 0 && firstAndMiddleParts.length > 1) {
            firstName = firstAndMiddleParts.slice(0, -1).join(' ');
            middleName = firstAndMiddleParts[firstAndMiddleParts.length - 1];

            console.log(`Retrying with: last_name="${lastName}", first_name="${firstName}", barangay_name="${teamData.barangay_name}"`);

            q = query(
                collection(db, "tb_farmers"),
                where("last_name", "==", lastName),
                where("barangay_name", "==", teamData.barangay_name)
            );
            querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                matches = querySnapshot.docs.filter(doc => {
                    const data = doc.data();
                    const dbFirstName = data.first_name || '';
                    const dbMiddleName = data.middle_name || '';
                    const dbFullName = `${data.last_name}, ${dbFirstName}${dbMiddleName ? ' ' + dbMiddleName : ''}`.trim();
                    const firstNameMatch = dbFirstName.toLowerCase() === firstName.toLowerCase();
                    const fullNameMatch = dbFullName.toLowerCase() === farmerName.toLowerCase();
                    const partialNameMatch = `${data.last_name}, ${dbFirstName}`.trim().toLowerCase() === farmerName.toLowerCase();
                    return firstNameMatch && (fullNameMatch || partialNameMatch);
                });
            }
        }

        if (matches.length > 0) {
            const farmerData = matches[0].data();
            console.log(`Found match for ${farmerName}:`, farmerData);
            return {
                farmer_id: farmerData.farmer_id || '',
                farmer_name: `${farmerData.last_name}, ${farmerData.first_name}${farmerData.middle_name ? ' ' + farmerData.middle_name : ''}`.trim(),
                contact: farmerData.contact || ''
            };
        } else {
            console.log(`No farmers found in tb_farmers for ${farmerName} with last_name="${lastName}"`);
            console.log("Possible matches:", querySnapshot.docs.map(doc => doc.data()));
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
        showErrorPanel('Error updating team. Please try again.');
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
            resultsContainer.style.display = 'none';
        });
        resultsContainer.appendChild(div);
    });
}

function addFarmerToBox(farmer) {
    const farmerBox = document.getElementById('farmerBox');
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
        const farmerSearch = document.getElementById('farmerSearch');
        if (farmerSearch === document.activeElement || farmerSearch.value) {
            renderFarmerResults(farmerSearch.value);
        }
    });

    farmerDiv.appendChild(removeBtn);
    farmerBox.appendChild(farmerDiv);
    farmersList = farmersList.filter(f => f.id !== farmer.id);
    const farmerSearch = document.getElementById('farmerSearch');
    if (farmerSearch === document.activeElement || farmerSearch.value) {
        renderFarmerResults(farmerSearch.value);
    }
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
    const allFarmers = [
        { farmer_id: teamData.lead_farmer_id || 'lead_' + teamData.team_id, farmer_name: teamData.lead_farmer || 'No Lead Farmer' },
        ...currentFarmers
    ];
    const filteredFarmers = allFarmers.filter(farmer => 
        farmer.farmer_name.toLowerCase().includes(document.getElementById('searchInput').value.toLowerCase())
    );
    const totalPages = Math.ceil(filteredFarmers.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable(document.getElementById('searchInput').value);
    }
});

document.getElementById('closePopup').addEventListener('click', () => {
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
});

const farmerSearch = document.getElementById('farmerSearch');
const searchResults = document.getElementById('searchResults');
let isSearchFocused = false;

farmerSearch.addEventListener('focus', () => {
    isSearchFocused = true;
    renderFarmerResults(farmerSearch.value);
    searchResults.style.display = 'block';
});

farmerSearch.addEventListener('blur', () => {
    isSearchFocused = false;
});

farmerSearch.addEventListener('input', (e) => {
    renderFarmerResults(e.target.value);
    searchResults.style.display = 'block';
});

document.addEventListener('click', (e) => {
    if (!isSearchFocused && !searchResults.contains(e.target) && !farmerSearch.contains(e.target)) {
        searchResults.style.display = 'none';
    }
});

document.getElementById('addFarmerBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (e.target.disabled) {
        return;
    }
    document.getElementById('addFarmerPopup').style.display = 'block';
});

document.getElementById('closePopup').addEventListener('click', () => {
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
    searchResults.style.display = 'none';
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
                    const fetchedFarmer = await fetchFarmerByName(farmerName);
                    if (fetchedFarmer) {
                        farmer = fetchedFarmer;
                    } else {
                        console.error(`Farmer ${farmerName} not found in tb_farmers; skipping.`);
                        return null;
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
        showErrorPanel('No valid farmers selected to add.');
        return;
    }

    currentFarmers = [...currentFarmers, ...validFarmers];
    await updateTeamInFirestore();
    
    showSuccessPanel(`Successfully added ${validFarmers.length} new member${validFarmers.length > 1 ? 's' : ''} to the team!`);
    
    renderTable();
    document.getElementById('addFarmerPopup').style.display = 'none';
    document.getElementById('farmerBox').innerHTML = '';
    document.getElementById('farmerSearch').value = '';
    document.getElementById('searchResults').innerHTML = '';
    searchResults.style.display = 'none';
    await fetchFarmers();
});

document.addEventListener('DOMContentLoaded', () => {
    const addFarmerPopup = document.getElementById('addFarmerPopup');
    if (addFarmerPopup) {
        addFarmerPopup.style.display = 'none';
    }
    const deleteTeamPopup = document.getElementById('deleteTeamPopup');
    if (deleteTeamPopup) {
        deleteTeamPopup.style.display = 'none';
    }
    loadTeamData();
});