import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    getDoc,  // Added
    updateDoc,  // Added
    increment,  // Added
    addDoc  // Added
  } from "firebase/firestore";
  
// Firebase Config
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


async function loadTeamList() {
  const teamPanel = document.getElementById("team-panel").querySelector("tbody");
  teamPanel.innerHTML = ""; // Clear previous list

  const barangayName = sessionStorage.getItem("barangay_name");

  try {
    const teamsSnapshot = await getDocs(collection(db, "tb_teams"));
    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();

      if (teamData.barangay_name === barangayName) {
        const row = document.createElement("tr");

        const teamNameCell = document.createElement("td");
        teamNameCell.textContent = teamData.team_name || "N/A";
        row.appendChild(teamNameCell);

        const leadFarmerCell = document.createElement("td");
        leadFarmerCell.textContent = teamData.lead_farmer || "N/A";
        row.appendChild(leadFarmerCell);

        const membersCount = teamData.farmer_name ? teamData.farmer_name.length : 0;
        const membersCell = document.createElement("td");
        membersCell.textContent = membersCount;
        row.appendChild(membersCell);

        const actionCell = document.createElement("td");
        const editLink = document.createElement("a");
        // Modified to point to a new page with team ID as parameter
        editLink.href = `edit-team.html?teamId=${doc.id}`;
        const editImg = document.createElement("img");
        editImg.src = "../../images/image 27.png";
        editImg.alt = "Edit";
        editImg.classList.add("edit-img");
        editLink.appendChild(editImg);
        actionCell.appendChild(editLink);
        row.appendChild(actionCell);
        teamPanel.appendChild(row);
      }
    });
  } catch (error) {
    console.error("Error loading team list:", error);
  }
}


document.addEventListener("DOMContentLoaded", function () {
  const teamData = JSON.parse(sessionStorage.getItem("teamData"));
  if (teamData) {
    document.getElementById("editTeamName").value = teamData.team_name || "";
    document.getElementById("editLeadFarmer").value = teamData.lead_farmer || "";
    
    // Populate farmers if needed (assuming you have the farmer data in teamData)
    const farmerBox = document.getElementById("editFarmerBox");
    if (teamData.farmer_name) {
      teamData.farmer_name.forEach(farmer => {
        const farmerDiv = document.createElement("div");
        farmerDiv.textContent = farmer || "N/A";
        farmerBox.appendChild(farmerDiv);
      });
    }
  }
});




document.addEventListener("DOMContentLoaded", async () => {
  await fetchFarmers(); // still needed
  loadTeamList();       // call our new function instead
});


// Retrieve barangay name from session storage
const loggedBarangay = (sessionStorage.getItem("barangay_name") || "").toLowerCase();
console.log("Logged Barangay:", loggedBarangay);

// Account Panel Toggle
const accountIcon = document.getElementById("account-icon");
const accountPanel = document.getElementById("account-panel");
const accountFrame = document.getElementById("account-frame");



document.addEventListener("click", (event) => {
  if (!accountPanel.contains(event.target) && !accountIcon.contains(event.target)) {
    accountPanel.classList.remove("active");
    accountFrame.src = "";
  }
});

// Pop-up functionality
const popup = document.getElementById("popup");
const addTeamBtn = document.getElementById("addTeamBtn");
const closePopup = document.getElementById("closePopup");

addTeamBtn.addEventListener("click", (event) => {
  event.preventDefault();
  popup.style.display = "block";
  loadHeadFarmers();
});

closePopup.addEventListener("click", () => {
  popup.style.display = "none";
});

// Load Head Farmers
async function loadHeadFarmers() {
  const farmersRef = collection(db, "tb_farmers");
  const teamsRef = collection(db, "tb_teams");

  try {
    const teamsSnapshot = await getDocs(teamsRef);
    const existingLeadFarmers = new Set();

    teamsSnapshot.forEach((doc) => {
      const teamData = doc.data();
      if (teamData.lead_farmer) {
        existingLeadFarmers.add(teamData.lead_farmer.toLowerCase());
      }
    });

    const querySnapshot = await getDocs(farmersRef);
    const leadFarmerSelect = document.getElementById("leadFarmer");

    let optionsHTML = "<option value=''>Select Lead Farmer</option>";

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.barangay_name || data.barangay_name.toLowerCase() !== loggedBarangay) return;
      const fullName = `${data.last_name}, ${data.first_name} ${data.middle_name || ""}`.trim();
      const lowerFullName = fullName.toLowerCase();

      if ((data.user_type === "Head Farmer" || data.user_type === "Farm President") && !existingLeadFarmers.has(lowerFullName)) {
        optionsHTML += `<option value="${fullName}">${fullName}</option>`;
      }
    });

    leadFarmerSelect.innerHTML = optionsHTML;
  } catch (error) {
    console.error("Error loading head farmers:", error);
  }
}

let farmersList = [];

// Get the current user's barangay from sessionStorage
const currentBarangay = sessionStorage.getItem("barangay_name");

// Fetch farmers from Firestore (Filtered by barangay)
async function fetchFarmers() {
  try {
    if (!currentBarangay) {
      console.error("Barangay name not found in sessionStorage.");
      return;
    }

    // Step 1: Fetch all farmer_ids from tb_teams to exclude them
    const teamsSnapshot = await getDocs(collection(db, "tb_teams"));
    const excludedFarmerIds = new Set();

    teamsSnapshot.forEach((teamDoc) => {
      const teamData = teamDoc.data();
      if (teamData.farmer_name && Array.isArray(teamData.farmer_name)) {
        teamData.farmer_name.forEach(farmerObj => {
          if (farmerObj.farmer_id) {
            excludedFarmerIds.add(farmerObj.farmer_id); // Add to exclusion list
          }
        });
      }
    });

    // Step 2: Fetch farmers from tb_farmers who are NOT in tb_teams
    const q = query(
      collection(db, "tb_farmers"),
      where("user_type", "==", "Farmer"),
      where("barangay_name", "==", currentBarangay)
    );

    const querySnapshot = await getDocs(q);
    farmersList = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(farmer => !excludedFarmerIds.has(String(farmer.farmer_id))); // Exclude farmers already in a team

    console.log("Filtered Farmers Loaded:", farmersList);
  } catch (error) {
    console.error("Error fetching farmers:", error);
  }
}


// Function to search farmers and display suggestions below search bar
// Function to render farmers in search result box
function renderFarmerResults(searchValue = "") {
  let resultsContainer = document.getElementById("searchResults");
  const searchInput = document.getElementById("farmerSearch");

  if (!resultsContainer) {
    resultsContainer = document.createElement("div");
    resultsContainer.id = "searchResults";
    resultsContainer.classList.add("search-results");
    searchInput.parentNode.appendChild(resultsContainer); // Attach to same container as input
  }

  resultsContainer.innerHTML = ""; // Clear previous results

  const filteredFarmers = farmersList.filter(farmer =>
    (`${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`).toLowerCase().includes(searchValue.toLowerCase())
  );

  if (filteredFarmers.length === 0) {
    resultsContainer.innerHTML = `<div class="no-results">No matching farmers found</div>`;
    return;
  }

  filteredFarmers.forEach(farmer => {
    const div = document.createElement("div");
    div.classList.add("search-item");
    div.textContent = `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`;
    div.dataset.id = farmer.id;

    div.addEventListener("click", function () {
      addFarmerToBox(farmer);
      resultsContainer.innerHTML = ""; // Clear search results after selection
    });

    resultsContainer.appendChild(div);
  });

  // Positioning
  resultsContainer.style.position = "absolute";
  resultsContainer.style.width = searchInput.offsetWidth + "px";
  resultsContainer.style.top = searchInput.offsetTop + searchInput.offsetHeight + "px";
  resultsContainer.style.left = searchInput.offsetLeft + "px";
}

// Listen to input for live filtering
document.getElementById("farmerSearch").addEventListener("input", function () {
  renderFarmerResults(this.value.trim());
});


// Function to add a selected farmer to the farmerBox
function addFarmerToBox(farmer) {
  const farmerBox = document.getElementById("farmerBox");
  const farmerDiv = document.createElement("div");
  farmerDiv.classList.add("farmer-item");
  farmerDiv.textContent = `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ''}`;

  const removeBtn = document.createElement("button");
  removeBtn.textContent = " X ";
  removeBtn.classList.add("remove-btn");
  removeBtn.addEventListener("click", function () {
    farmerDiv.remove();
    farmersList.push(farmer); // Re-add farmer to the search list
  });

  farmerDiv.appendChild(removeBtn);
  farmerBox.appendChild(farmerDiv);

  // Remove the selected farmer from the list to prevent duplicates
  farmersList = farmersList.filter(f => f.id !== farmer.id);
}

// Hide search results when clicking outside
document.addEventListener("click", function (event) {
  const searchBox = document.getElementById("farmerSearch");
  const resultsContainer = document.getElementById("searchResults");

  if (resultsContainer && event.target !== searchBox && !resultsContainer.contains(event.target)) {
    resultsContainer.innerHTML = ""; // Clear results
  }
});




document.addEventListener("click", function (e) {
  const resultsContainer = document.getElementById("searchResults");
  const searchBox = document.getElementById("farmerSearch");
  if (resultsContainer && !resultsContainer.contains(e.target) && e.target !== searchBox) {
    resultsContainer.innerHTML = "";
  }
});


// Load farmers on page load
document.addEventListener("DOMContentLoaded", async () => {
  await fetchFarmers();
  const searchInput = document.getElementById("farmerSearch");

searchInput.addEventListener("input", function () {
  renderFarmerResults(this.value.trim());
});

// Show full list on click (even if empty)
searchInput.addEventListener("click", function () {
  renderFarmerResults(); // shows all by default
});

  renderFarmerResults(); // Ensure farmers are loaded before searching
});

// Function to get the next auto-incrementing team_id
async function getNextTeamId() {
    const counterRef = doc(db, "tb_id_counters", "teams_id_counter");
  
    try {
      const counterSnap = await getDoc(counterRef);
  
      if (counterSnap.exists()) {
        const currentCount = counterSnap.data().count || 0;
        await updateDoc(counterRef, { count: increment(1) }); // Increment the counter
        return currentCount + 1;
      } else {
        await setDoc(counterRef, { count: 1 }); // Create document if it doesn't exist
        return 1;
      }
    } catch (error) {
      console.error("Error getting next team ID:", error);
      return null;
    }
  }
  
  
  async function saveTeam() {
    const teamName = document.getElementById("teamName").value.trim();
    const leadFarmer = document.getElementById("leadFarmer").value.trim();
    const farmerBox = document.getElementById("farmerBox");

    // Extract all farmer names from the farmerBox
    const farmerNames = Array.from(farmerBox.getElementsByClassName("farmer-item"))
        .map(item => item.firstChild.textContent.trim());

    if (!teamName || !leadFarmer || farmerNames.length === 0) {
        alert("Please fill in all fields and select at least one farmer.");
        return;
    }

    const teamId = await getNextTeamId();
    if (teamId === null) {
        alert("Error generating team ID. Please try again.");
        return;
    }

    try {
        const farmersRef = collection(db, "tb_farmers");
        const querySnapshot = await getDocs(farmersRef);

        let leadFarmerId = null;
        let farmersData = [];

        querySnapshot.forEach((doc) => {
            const farmerData = doc.data();
            const reconstructedFullName = `${farmerData.last_name}, ${farmerData.first_name} ${farmerData.middle_name ? farmerData.middle_name : ""}`.trim();

            // Check for Lead Farmer ID
            if (reconstructedFullName.toLowerCase() === leadFarmer.toLowerCase()) {
                leadFarmerId = String(farmerData.farmer_id);
            }

            // Check for Selected Farmers
            if (farmerNames.includes(reconstructedFullName)) {
                farmersData.push({
                    farmer_id: String(farmerData.farmer_id),
                    farmer_name: reconstructedFullName
                });
            }
        });

        if (!leadFarmerId) {
            alert(`Lead farmer '${leadFarmer}' not found or has an invalid farmer_id.`);
            return;
        }

        console.log("Lead Farmer ID:", leadFarmerId);
        console.log("Farmers Data:", farmersData);

        const teamData = {
            team_id: teamId,
            team_name: teamName,
            lead_farmer: leadFarmer,
            lead_farmer_id: leadFarmerId,
            farmer_name: farmersData, // Updated to store farmer_id and farmer_name
            barangay_name: loggedBarangay.charAt(0).toUpperCase() + loggedBarangay.slice(1)
        };

        await addDoc(collection(db, "tb_teams"), teamData);
        alert("Team successfully created!");
        clearTeamInputs();
        popup.style.display = "none";
        loadTeamList(); // Refresh team list dynamically
        await fetchFarmers();
renderFarmerResults(); // optional to immediately show updated results

    } catch (error) {
        console.error("Error saving team:", error);
        alert("Failed to save team. Please try again.");
    }
}


// ✨ Function to clear all inputs
function clearTeamInputs() {
  document.getElementById("teamName").value = "";
  document.getElementById("leadFarmer").value = "";
  document.getElementById("farmerSearch").value = "";
  document.getElementById("farmerBox").innerHTML = ""; // clear selected farmers
  document.getElementById("searchResults").innerHTML = ""; // clear suggestion list if visible
}

  
  // Attach event listener to Save button
  document.getElementById("saveTeamBtn").addEventListener("click", saveTeam);

  accountIcon.addEventListener("click", () => {
    accountPanel.classList.toggle("active");
    accountFrame.src = accountPanel.classList.contains("active") ? "logout.html" : "";
  });