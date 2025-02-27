import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

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
const selectedFarmers = new Map(); // Declare globally

// Get the logged-in user's barangay (for filtering) in lowercase
const loggedBarangay = sessionStorage.getItem("barangay_name")?.toLowerCase() || "";

// ********************************************************
// LOAD PROJECTS (filtered by barangay)
async function loadProjects() {
  const projectsRef = collection(db, "tb_projects");
  const querySnapshot = await getDocs(projectsRef);
  let projectsHTML = "";

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Only display projects that match the logged user's barangay
    if (data.barangay_name && data.barangay_name.toLowerCase() === loggedBarangay) {
      projectsHTML += 
      `<div class="project-item">
                <div class="project-details">
                    <div>
                        <p><strong>Project Name:</strong><br> ${data.project_name}</p>
                        <p><strong>Status:</strong><br> ${data.status}</p>
                    </div>
                    <div>
                        <p><strong>Start Date:</strong><br> ${data.start_date}</p>
                        <p><strong>Crop Name:</strong><br> ${data.crop_name}</p>
                    </div>
                    <div>
                        <p><strong>End Date:</strong><br> ${data.end_date}</p>
                        <p><strong>Crop Type:</strong><br> ${data.crop_type_name}</p>
                    </div>
                    <div>
                        <p><strong>Extend Date:</strong><br> ${data.extend_date || "N/A"}</p>
                        <p><strong>Equipment:</strong><br> ${data.equipment}</p>
                    </div>
                    <div>
                        <p><strong>Barangay:</strong><br> ${data.barangay_name}</p>
                        <p><strong>Farm President:</strong><br> ${data.farm_president}</p>
                    </div>
                </div>
            </div>`;
    }
  });
  document.getElementById("projects-content").innerHTML = projectsHTML;
}

// ********************************************************
// LOAD TEAMS (filtered by barangay)
async function loadTeams() {
  const loggedInBarangay = sessionStorage.getItem("barangay_name"); // Get the logged-in user's barangay
  if (!loggedInBarangay) {
    console.error("No barangay found for the logged-in user.");
    return;
  }

  const teamsRef = collection(db, "tb_teams");
  const querySnapshot = await getDocs(teamsRef);
  let teamsHTML = `
      <table>
          <thead>
              <tr>
                  <th>Team Name</th>
                  <th>Lead Farmer</th>
                  <th class="farmer-count">No. of Farmers</th>
              </tr>
          </thead>
          <tbody>`;

  querySnapshot.forEach((doc) => {
    const data = doc.data();

    // Filter teams based on barangay_name
    if (data.barangay_name === loggedInBarangay) {
      const farmerCount = data.farmer_name ? data.farmer_name.length : 0;

      teamsHTML += `
          <tr>
              <td>${data.team_name}</td>
              <td>${data.lead_farmer}</td>
              <td class="farmer-count">${farmerCount}</td>
          </tr>`;
    }
  });

  teamsHTML += `</tbody></table>`;
  document.getElementById("teams-content").innerHTML = teamsHTML;
}


// ********************************************************
// Update dashboard header with barangay name and load projects/teams
document.addEventListener("DOMContentLoaded", () => {
  loadProjects();
  loadTeams();

  // Update the header element with the logged user's barangay (original case)
  const storedBarangay = sessionStorage.getItem("barangay_name");
  if (storedBarangay) {
    const barangayNameElement = document.getElementById("barangay_name");
    if (barangayNameElement) {
      barangayNameElement.textContent = storedBarangay;
    }
  }
});

// ********************************************************
// Popup open/close functions
function openPopup() {
  document.getElementById("popup").style.display = "block";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".new-team-btn").addEventListener("click", openPopup);
  document.getElementById("closePopup").addEventListener("click", closePopup);
});

// ********************************************************
// LOAD HEAD FARMERS for the popup (filtered by barangay)
async function loadHeadFarmers() {
  const farmersRef = collection(db, "tb_farmers");
  const teamsRef = collection(db, "tb_teams");

  // Fetch all teams to get existing lead farmers
  const teamsSnapshot = await getDocs(teamsRef);
  const existingLeadFarmers = new Set();

  teamsSnapshot.forEach((doc) => {
    const teamData = doc.data();
    if (teamData.lead_farmer) {
      existingLeadFarmers.add(teamData.lead_farmer.toLowerCase());
    }
  });

  // Fetch all farmers
  const querySnapshot = await getDocs(farmersRef);
  const leadFarmerSelect = document.getElementById("leadFarmer");

  let optionsHTML = "<option value=''>Select Lead Farmer</option>"; // Default option

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Only include farmers from the logged user's barangay
    if (!data.barangay_name || data.barangay_name.toLowerCase() !== loggedBarangay) {
      return;
    }
    const fullName = `${data.last_name}, ${data.first_name} ${data.middle_name || ""}`.trim();
    const lowerFullName = fullName.toLowerCase();

    // Only include Head Farmers and Farm Presidents who are not already lead farmers
    if (
      (data.user_type === "Head Farmer" || data.user_type === "Farm President") &&
      !existingLeadFarmers.has(lowerFullName)
    ) {
      optionsHTML += `<option value="${fullName}">${fullName}</option>`;
    }
  });

  leadFarmerSelect.innerHTML = optionsHTML;
}

// ********************************************************
// SEARCH FARMERS (for adding to a team, filtered by barangay)
async function searchFarmers() {
  const searchInput = document.getElementById("farmerSearch").value.toLowerCase().trim();
  const farmerBox = document.getElementById("farmerBox");
  farmerBox.innerHTML = "";

  if (searchInput.length === 0) return;

  // Fetch all teams to get assigned farmers & lead farmers
  const teamsQuerySnapshot = await getDocs(collection(db, "tb_teams"));
  const leadFarmersSet = new Set();
  const assignedFarmers = new Set();

  teamsQuerySnapshot.forEach((teamDoc) => {
    const teamData = teamDoc.data();

    if (teamData.lead_farmer) {
      leadFarmersSet.add(teamData.lead_farmer.toLowerCase());
    }

    if (teamData.farmer_name && Array.isArray(teamData.farmer_name)) {
      teamData.farmer_name.forEach((name) => assignedFarmers.add(name.toLowerCase()));
    }
  });

  // Fetch only farmers where user_type is "Farmer" and that belong to the logged user's barangay
  const farmersQuerySnapshot = await getDocs(collection(db, "tb_farmers"));

  farmersQuerySnapshot.forEach((doc) => {
    const farmer = doc.data();

    if (
      farmer.user_type !== "Farmer" ||
      !farmer.barangay_name ||
      farmer.barangay_name.toLowerCase() !== loggedBarangay
    ) {
      return;
    }

    const fullName = `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`.trim();
    const lowerFullName = fullName.toLowerCase();

    // Show only farmers who match the search, are not assigned, and are not selected
    if (
      lowerFullName.includes(searchInput) &&
      !assignedFarmers.has(lowerFullName) &&
      !leadFarmersSet.has(lowerFullName) &&
      !selectedFarmers.has(doc.id)
    ) {
      const div = document.createElement("div");
      div.textContent = fullName;
      div.classList.add("farmer-item");
      div.setAttribute("data-id", doc.id);
      div.onclick = () => selectFarmer(doc.id, farmer);
      farmerBox.appendChild(div);
    }
  });
}

function selectFarmer(id, farmer) {
  if (!selectedFarmers.has(id)) {
    selectedFarmers.set(id, `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`);
  }
  updateSelectedFarmers();
  searchFarmers();
}

function removeFarmer(id) {
  selectedFarmers.delete(id);
  updateSelectedFarmers();
  searchFarmers();
}

function updateSelectedFarmers() {
  const selectedFarmersBox = document.getElementById("selectedFarmers");
  selectedFarmersBox.innerHTML = "";

  selectedFarmers.forEach((name, id) => {
    const div = document.createElement("div");
    div.classList.add("selected-farmer-item");
    div.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "X";
    removeBtn.classList.add("remove-btn");
    removeBtn.onclick = () => removeFarmer(id);

    div.appendChild(removeBtn);
    selectedFarmersBox.appendChild(div);
  });
}

// ********************************************************
// SAVE TEAM (and include the logged user's barangay)
async function saveTeam() {
  const teamName = document.getElementById("teamName").value.trim();
  const leadFarmer = document.getElementById("leadFarmer").options[document.getElementById("leadFarmer").selectedIndex].text;
  const farmers = Array.from(selectedFarmers.values());

  if (!teamName || !leadFarmer || farmers.length === 0) {
    alert("Please fill in all fields and select at least one farmer.");
    return;
  }

  try {
    const counterRef = doc(db, "tb_id_counters", "teams_id_counter");
    const counterSnap = await getDoc(counterRef);
    let newTeamId = 1;

    if (counterSnap.exists()) {
      newTeamId = counterSnap.data().count + 1;
    }

    await addDoc(collection(db, "tb_teams"), {
      team_id: newTeamId,
      team_name: teamName,
      lead_farmer: leadFarmer,
      farmer_name: farmers,
      barangay_name: sessionStorage.getItem("barangay_name") || ""
    });

    await setDoc(counterRef, { count: newTeamId });

    alert("Team saved successfully!");
    clearForm();
    closePopup();
    loadTeams();
  } catch (error) {
    console.error("Error saving team:", error);
    alert("Failed to save team.");
  }
}

// Function to clear all inputs
function clearForm() {
  document.getElementById("teamName").value = "";
  document.getElementById("leadFarmer").selectedIndex = 0;
  document.getElementById("farmerSearch").value = "";
  document.getElementById("farmerBox").innerHTML = "";
  document.getElementById("selectedFarmers").innerHTML = "";
  selectedFarmers.clear();
}

// ********************************************************
// FEEDBACK POPUP & SAVE FUNCTIONS
function openFeedbackPopup() {
  document.getElementById("feedbackPopup").style.display = "block";
}

function closeFeedbackPopup() {
  document.getElementById("feedbackPopup").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".add-feedback-btn").addEventListener("click", openFeedbackPopup);
  document.getElementById("closeFeedbackPopup").addEventListener("click", closeFeedbackPopup);
  document.getElementById("saveFeedbackBtn").addEventListener("click", saveFeedback);
});

async function saveFeedback() {
  const concern = document.getElementById("feedbackType").value;
  const status = document.getElementById("feedbackStatus").value;
  const feedback = document.getElementById("feedbackMessage").value.trim();

  if (!feedback) {
    alert("Please enter a message.");
    return;
  }

  try {
    const idCounterRef = doc(db, "tb_id_counters", "feedback_id_counter");
    const idCounterSnap = await getDoc(idCounterRef);
    let newFeedbackId = 1;
    if (idCounterSnap.exists()) {
      newFeedbackId = idCounterSnap.data().count + 1;
    }

    // Get user details from sessionStorage
    const userFullName = sessionStorage.getItem("userFullName") || "";
    const userPicture = sessionStorage.getItem("userPicture") || "";
    const barangayName = sessionStorage.getItem("barangay_name") || "Unknown"; // Get barangay name

    await addDoc(collection(db, "tb_feedbacks"), {
      feedback_id: newFeedbackId,
      concern: concern,
      status: status,
      feedback: feedback,
      submitted_by: userFullName,
      submitted_by_picture: userPicture,
      barangay_name: barangayName, // Store barangay name
      timestamp: new Date(),
    });

    await setDoc(idCounterRef, { count: newFeedbackId });

    alert("Feedback submitted successfully!");

    // Clear form inputs
    document.getElementById("feedbackType").selectedIndex = 0;
    document.getElementById("feedbackStatus").selectedIndex = 0;
    document.getElementById("feedbackMessage").value = "";

    closeFeedbackPopup();
    loadFeedback(); // Refresh feedback log
  } catch (error) {
    console.error("Error saving feedback:", error);
    alert("Failed to submit feedback.");
  }
}


async function loadFeedback() {
  const feedbackRef = collection(db, "tb_feedbacks");
  const querySnapshot = await getDocs(feedbackRef);

  const loggedInBarangay = sessionStorage.getItem("barangay_name") || "";

  let feedbackHTML = "<ul>";

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    console.log("Feedback Data:", data); // Debug: log each feedback document

    // Display only feedback that matches the logged-in user's barangay
    if (data.barangay_name === loggedInBarangay) {
      feedbackHTML += `
        <div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom: 4px solid #f0f0f0;">
          ${
            data.submitted_by_picture && data.submitted_by_picture.trim() !== ""
              ? `<img src="${data.submitted_by_picture}" alt="User Picture" style="width:50px;height:50px;border-radius:50%;">`
              : `<div style="width:50px;height:50px;border-radius:50%;background:#ccc;"></div>`
          }
          <div>
            <strong>${data.concern}</strong> - ${data.status} <br>
            ${data.feedback} <br>
            <em>Submitted by: ${data.submitted_by || "Anonymous"}</em>
          </div>
        </div>
      `;
    }
  });

  feedbackHTML += "</ul>";
  document.getElementById("feedback-content").innerHTML = feedbackHTML;
}



// Load feedback on page load
document.addEventListener("DOMContentLoaded", loadFeedback);

// Also attach feedback event listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".add-feedback-btn").addEventListener("click", openFeedbackPopup);
  document.getElementById("closeFeedbackPopup").addEventListener("click", closeFeedbackPopup);
  document.getElementById("saveFeedbackBtn").addEventListener("click", saveFeedback);
});

// Attach the save function to the save button
document.getElementById("saveTeamBtn").addEventListener("click", saveTeam);

// Attach event listener to search input
document.getElementById("farmerSearch").addEventListener("input", searchFarmers);

// Ensure the dropdown is loaded when the popup opens
document.querySelector(".new-team-btn").addEventListener("click", () => {
  loadHeadFarmers();
  openPopup();
});
