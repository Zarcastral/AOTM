
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, addDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD0pdy75p4D21Nz1JyFKHQxVNyh60U8yVA",
    authDomain: "operation-and-task-management.firebaseapp.com",
    projectId: "operation-and-task-management",
    storageBucket: "operation-and-task-management.firebasestorage.app",
    messagingSenderId: "182897367112",
    appId: "1:182897367112:web:600d924a446ae220fba07d",
    measurementId: "G-C91Z5709N5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const selectedFarmers = new Map(); // ✅ Declare globally

        async function loadProjects() {
            const projectsRef = collection(db, "tb_projects");
            const querySnapshot = await getDocs(projectsRef);
            let projectsHTML = "";

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                projectsHTML += `
                    <div class="project-item">
                        <h3>${data.project_name}</h3>
                        <p><strong>Status:</strong> ${data.status}</p>
                        <p><strong>Start Date:</strong> ${data.start_date}</p>
                        <p><strong>End Date:</strong> ${data.end_date}</p>
                        <p><strong>Crop Name:</strong> ${data.crop_name}</p>
                        <p><strong>Crop Type:</strong> ${data.crop_type_name}</p>
                        <p><strong>Equipment:</strong> ${data.equipment}</p>
                        <p><strong>Barangay:</strong> ${data.barangay_name}</p>
                        <p><strong>Farm President:</strong> ${data.farm_president}</p>
                    </div>
                `;
            });
            document.getElementById("projects-content").innerHTML = projectsHTML;
        }

        async function loadTeams() {
            const teamsRef = collection(db, "tb_teams");
            const querySnapshot = await getDocs(teamsRef);
            let teamsHTML = "<table class='team-table'><thead><tr><th>Team Name</th><th>Lead Farmer</th><th>No. of Farmers</th></tr></thead><tbody>";

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const farmerCount = data.farmer_name ? data.farmer_name.length : 0;
                teamsHTML += `
                    <tr>
                        <td>${data.team_name}</td>
                        <td>${data.lead_farmer}</td>
                        <td>${farmerCount}</td>
                    </tr>
                `;
            });0
            teamsHTML += "</tbody></table>";
            document.getElementById("teams-content").innerHTML = teamsHTML;
        }

        document.addEventListener("DOMContentLoaded", () => {
            loadProjects();
            loadTeams();
        });

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
        


        async function loadHeadFarmers() {
    const farmersRef = collection(db, "tb_farmers");
    const teamsRef = collection(db, "tb_teams");

    // Fetch all teams to get existing lead farmers
    const teamsSnapshot = await getDocs(teamsRef);
    const existingLeadFarmers = new Set();

    teamsSnapshot.forEach((doc) => {
        const teamData = doc.data();
        if (teamData.lead_farmer) {
            existingLeadFarmers.add(teamData.lead_farmer.toLowerCase()); // Store names in lowercase for comparison
        }
    });

    // Fetch all farmers
    const querySnapshot = await getDocs(farmersRef);
    const leadFarmerSelect = document.getElementById("leadFarmer");

    let optionsHTML = "<option value=''>Select Lead Farmer</option>"; // Default option

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const fullName = `${data.last_name}, ${data.first_name} ${data.middle_name || ""}`.trim();
        const lowerFullName = fullName.toLowerCase();

        // ✅ Only include Head Farmers and Farm Presidents who are NOT already lead farmers in tb_teams
        if ((data.user_type === "Head Farmer" || data.user_type === "Farm President") && !existingLeadFarmers.has(lowerFullName)) {
            optionsHTML += `<option value="${fullName}">${fullName}</option>`;
        }
    });

    leadFarmerSelect.innerHTML = optionsHTML;
}


async function searchFarmers() {
    const searchInput = document.getElementById("farmerSearch").value.toLowerCase().trim();
    const farmerBox = document.getElementById("farmerBox");
    farmerBox.innerHTML = "";

    if (searchInput.length === 0) return;

    // ✅ Fetch all teams to get assigned farmers & lead farmers
    const teamsQuerySnapshot = await getDocs(collection(db, "tb_teams"));
    const leadFarmersSet = new Set();
    const assignedFarmers = new Set();

    teamsQuerySnapshot.forEach(teamDoc => {
        const teamData = teamDoc.data();

        // ✅ Store lead farmers
        if (teamData.lead_farmer) {
            leadFarmersSet.add(teamData.lead_farmer.toLowerCase());
        }

        // ✅ Store assigned farmers (array)
        if (teamData.farmer_name && Array.isArray(teamData.farmer_name)) {
            teamData.farmer_name.forEach(name => assignedFarmers.add(name.toLowerCase()));
        }
    });

    // ✅ Fetch only farmers where `user_type` is "Farmer"
    const farmersQuerySnapshot = await getDocs(collection(db, "tb_farmers"));

    farmersQuerySnapshot.forEach(doc => {
        const farmer = doc.data();

        if (farmer.user_type !== "Farmer") return; // 🔥 Only process actual farmers

        const fullName = `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`.trim();
        const lowerFullName = fullName.toLowerCase();

        // ✅ Show only farmers who match the search, are not assigned, and are not selected
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
    // ✅ Prevent duplicate selections
    if (!selectedFarmers.has(id)) {
        selectedFarmers.set(id, `${farmer.last_name}, ${farmer.first_name} ${farmer.middle_name || ""}`);
    }
    updateSelectedFarmers();
    searchFarmers(); // Refresh search results
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

        // Save new team
        await addDoc(collection(db, "tb_teams"), {
            team_id: newTeamId,
            team_name: teamName,
            lead_farmer: leadFarmer,
            farmer_name: farmers
        });

        // Update counter
        await setDoc(counterRef, { count: newTeamId });

        alert("Team saved successfully!");
        // Clear all inputs
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
        // Get the current feedback_id from tb_id_counters
        const idCounterRef = doc(db, "tb_id_counters", "feedback_id_counter");
        const idCounterSnap = await getDoc(idCounterRef);

        let newFeedbackId = 1; // Default value if the document does not exist

        if (idCounterSnap.exists()) {
            newFeedbackId = idCounterSnap.data().count + 1;
        }

        // Save feedback to tb_feedbacks
        await addDoc(collection(db, "tb_feedbacks"), {
            feedback_id: newFeedbackId,
            concern: concern,
            status: status,
            feedback: feedback,
            timestamp: new Date()
        });

        // Update the feedback_id count in tb_id_counters
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
    let feedbackHTML = "<ul>";

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        feedbackHTML += `
            <li>
                <strong>${data.concern}</strong> - ${data.status} <br>
                ${data.feedback}
            </li>
            <hr>
        `;
    });

    feedbackHTML += "</ul>";
    document.getElementById("feedback-content").innerHTML = feedbackHTML;
}


// Load feedback on page load
document.addEventListener("DOMContentLoaded", loadFeedback);


// Load feedback when the page loads
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".add-feedback-btn").addEventListener("click", openFeedbackPopup);
    document.getElementById("closeFeedbackPopup").addEventListener("click", closeFeedbackPopup);
    document.getElementById("saveFeedbackBtn").addEventListener("click", saveFeedback);
});




// Attach the save function to the save button
document.getElementById("saveTeamBtn").addEventListener("click", saveTeam);


// ✅ Attach event listener to search input
document.getElementById("farmerSearch").addEventListener("input", searchFarmers);

// Ensure the dropdown is loaded when the popup opens
document.querySelector(".new-team-btn").addEventListener("click", () => {
    loadHeadFarmers();
    openPopup();
});
