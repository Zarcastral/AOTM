import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs,orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
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

async function fetchProjectDetails() {
    let userEmail = sessionStorage.getItem("userEmail") || sessionStorage.getItem("farmerEmail");

    console.log("📌 Retrieved user email from sessionStorage:", userEmail);

    if (!userEmail) {
        console.error("❌ No email found in sessionStorage.");
        return;
    }

    try {
        // Query Firestore for projects where lead_farmer_email matches the session email
        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("lead_farmer_email", "==", userEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const projectData = querySnapshot.docs[0].data();
            console.log("✅ Project Data Retrieved:", projectData);

            // Log project_id to console
            if (projectData.project_id) {
                console.log("📌 Project ID:", projectData.project_id);
            } else {
                console.warn("⚠️ Project ID not found in the document.");
            }

            // Populate project details in HTML
            document.getElementById("projectName").textContent = projectData.project_name || "No Title";
            document.getElementById("status").textContent = projectData.status || "No Status";
            document.getElementById("startDate").textContent = projectData.start_date || "N/A";
            document.getElementById("endDate").textContent = projectData.end_date || "N/A";
            document.getElementById("cropName").textContent = projectData.crop_name || "N/A";
            document.getElementById("cropType").textContent = projectData.crop_type_name || "N/A";
            document.getElementById("equipment").textContent = projectData.equipment || "N/A";
            document.getElementById("barangayName").textContent = projectData.barangay_name || "N/A";
            document.getElementById("farmPresident").textContent = projectData.farm_president || "N/A";
        } else {
            console.error("❌ No projects found for this email.");
        }
    } catch (error) {
        console.error("🔥 Error fetching project data:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchProjectDetails();
});



// Fetch and display teams
async function fetchTeams() {
    const teamsTableBody = document.getElementById("teamsTableBody");
    teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>Loading...</td></tr>";

    try {
        // Retrieve logged-in user's email from sessionStorage
        let userEmail = sessionStorage.getItem("userEmail") || sessionStorage.getItem("farmerEmail");

        if (!userEmail) {
            console.error("❌ No email found in sessionStorage.");
            teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>User not logged in.</td></tr>";
            return;
        }

        const projectsRef = collection(db, "tb_projects");

        // Query projects where the user is the lead farmer or part of the team
        const q = query(
            projectsRef,
            where("lead_farmer_email", "==", userEmail) // Ensure this field exists in Firestore
        );

        const querySnapshot = await getDocs(q);

        teamsTableBody.innerHTML = ""; // Clear loading message

        if (querySnapshot.empty) {
            teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>No teams found.</td></tr>";
            return;
        }

        let hasTeam = false;

        querySnapshot.forEach(doc => {
            const project = doc.data();

            if (!project.team_id) {
                return; // Skip projects without a team_id
            }

            hasTeam = true; // Mark that at least one team exists

            const teamName = project.team_name || "Unknown Team";
            const leadFarmer = project.lead_farmer || "No Leader";

            // ✅ Correctly fetch farmer_name array and check its type
            let farmers = project.farmer_name || [];

            if (!Array.isArray(farmers)) {
                console.warn(`⚠️ farmer_name is not an array for project: ${teamName}`, farmers);
                farmers = []; // Ensure it's an array
            }

            console.log(`📌 Team: ${teamName}, Farmers Count: ${farmers.length}`, farmers); // Debugging Log

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${teamName}</td>
                <td>${leadFarmer}</td>
                <td>${farmers.length}</td> <!-- Correctly count farmers -->
                <td><button class="view-btn">👁️ View</button></td>
            `;

            // Attach event listener to the button
            const viewButton = row.querySelector(".view-btn");
            viewButton.addEventListener("click", () => openPopup(teamName, leadFarmer, farmers));

            teamsTableBody.appendChild(row);
        });

        // If no teams were found for the user
        if (!hasTeam) {
            teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>No teams found for this user.</td></tr>";
        }

    } catch (error) {
        console.error("🔥 Error fetching teams:", error);
        teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>Failed to load teams.</td></tr>";
    }
}

// Fetch teams when the page loads
document.addEventListener("DOMContentLoaded", () => {
    fetchTeams();
});






 //Attach the function globally so HTML can access it
window.openPopup = function (teamName, leadFarmer, farmers) {
    const popup = document.getElementById("viewTeamPopup");
    
    document.getElementById("popupTeamName").textContent = teamName;
    document.getElementById("popupLeadFarmer").textContent = leadFarmer;

    const farmerList = document.getElementById("popupFarmerList");
    farmerList.innerHTML = ""; // Clear previous list

    if (farmers.length > 0) {
        farmers.forEach(farmer => {
            const listItem = document.createElement("li");
            listItem.textContent = farmer;
            farmerList.appendChild(listItem);
        });
    } else {
        farmerList.innerHTML = "<li>No farmers assigned</li>";
    }

    popup.style.display = "flex";
    console.log("✅ Popup opened for:", teamName);
};

// Close Popup Function
window.closePopup = function () {
    document.getElementById("viewTeamPopup").style.display = "none";
};

// Attach event to the X button
document.getElementById("closePopup").addEventListener("click", closePopup);

// Close Popup if Clicking Outside of the Content
window.addEventListener("click", (event) => {
    const popup = document.getElementById("viewTeamPopup");
    if (event.target === popup) {
        closePopup();
    }
});






async function displayFeedbacks() {
    console.log("📌 Fetching all feedbacks...");

    const feedbackListContainer = document.getElementById("feedbackList");
    feedbackListContainer.innerHTML = "<p>Loading feedbacks...</p>";

    try {
        // Fetch all feedbacks
        const feedbackRef = collection(db, "tb_feedbacks");
        const querySnapshot = await getDocs(feedbackRef);

        feedbackListContainer.innerHTML = ""; // Clear loading message

        let hasFeedback = false;

        querySnapshot.forEach((doc) => {
            const feedback = doc.data();
            hasFeedback = true;

            // Convert timestamp correctly
            let formattedTimestamp = "Unknown Date";
            if (feedback.timestamp) {
                if (feedback.timestamp.toDate) {
                    formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
                } else {
                    formattedTimestamp = new Date(feedback.timestamp).toLocaleString();
                }
            }

            const feedbackItem = document.createElement("div");
            feedbackItem.classList.add("feedback-item");

            feedbackItem.innerHTML = `
                <img src="${feedback.submitted_by_picture || 'default-profile.png'}" class="feedback-avatar" alt="User">
                <div class="feedback-content">
                    <div class="feedback-header">
                        <span class="feedback-user">${feedback.submitted_by}</span>
                        <span class="timestamp">${formattedTimestamp}</span>
                    </div>
                    <p class="feedback-text"><strong>Concern:</strong> ${feedback.concern}</p>
                    <p class="feedback-text"><strong>Feedback:</strong> ${feedback.feedback}</p>
                    <p class="feedback-status">Status: ${feedback.status}</p>
                </div>
            `;

            feedbackListContainer.appendChild(feedbackItem);
        });

        // If no feedbacks were found
        if (!hasFeedback) {
            feedbackListContainer.innerHTML = "<p>No feedbacks available.</p>";
        }

    } catch (error) {
        console.error("🔥 Error fetching feedbacks:", error);
        feedbackListContainer.innerHTML = "<p>Error loading feedbacks.</p>";
    }
}

// Load feedbacks when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    await displayFeedbacks();
});
