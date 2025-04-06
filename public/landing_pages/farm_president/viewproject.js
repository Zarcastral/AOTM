import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs,orderBy, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Function to fetch and display project details
async function fetchProjectDetails() {
    let projectId = sessionStorage.getItem("selectedProjectId");

    if (!projectId) {
        console.error("❌ No project ID found in sessionStorage.");
        return;
    }

    projectId = parseInt(projectId, 10);
    console.log("📌 Retrieved project_id (after conversion):", projectId, "Type:", typeof projectId);

    if (isNaN(projectId)) {
        console.error("⚠️ Invalid project ID (not a number).");
        return;
    }

    try {
        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("project_id", "==", projectId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const projectData = querySnapshot.docs[0].data();
            console.log("✅ Project Data Retrieved:", projectData);

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
            console.error("❌ Project not found in Firestore.");
        }
    } catch (error) {
        console.error("🔥 Error fetching project data:", error);
    }
}



function storeProjectIdAndRedirect(projectId, teamId) {
    sessionStorage.setItem("selected_project_id", projectId);
    window.location.href = `../../../landing_pages/head_farmer/headfarm_task.html?team_id=${teamId}`;
}

// Expose the function to the global scope
window.storeProjectIdAndRedirect = storeProjectIdAndRedirect;


// Fetch and display teams
async function fetchTeams() {
    const teamsTableBody = document.getElementById("teamsTableBody");
    teamsTableBody.innerHTML = "<tr><td colspan='4' style='text-align: center;'>Loading...</td></tr>";

    try {
        const projectId = sessionStorage.getItem("selectedProjectId");
        if (!projectId) {
            teamsTableBody.innerHTML = "<tr><td colspan='4'>No project selected.</td></tr>";
            return;
        }

        const querySnapshot = await getDocs(
            query(collection(db, "tb_projects"), 
            where("project_id", "==", parseInt(projectId))
        ));

        teamsTableBody.innerHTML = "";

        if (querySnapshot.empty) {
            teamsTableBody.innerHTML = "<tr><td colspan='4'>No teams found.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const project = doc.data();
            if (!project.team_id) return;

            const teamName = project.team_name || "Unknown Team";
            const leadFarmer = project.lead_farmer || "No Leader";
            const farmers = project.farmer_name || [];
            const teamId = project.team_id; // Assuming `team_id` exists in Firestore

            const row = document.createElement("tr");
            row.innerHTML = `
    <td>${teamName}</td>
    <td>${leadFarmer}</td>
    <td>${farmers.length}</td>
    <td>
        <button 
            class="view-btn" 
            onclick="storeProjectIdAndRedirect(sessionStorage.getItem('selectedProjectId'), '${teamId}')"
        >
            <img src="../../images/eye.png" alt="View" class="view-icon">
        </button>
    </td>
`;
teamsTableBody.appendChild(row);

        });

    } catch (error) {
        console.error("Error fetching teams:", error);
        teamsTableBody.innerHTML = "<tr><td colspan='4'>Failed to load teams.</td></tr>";
    }
}





document.addEventListener("DOMContentLoaded", function () {
    // Open the feedback popup
    window.openFeedbackPopup = function () {
        document.getElementById("feedbackPopup").style.display = "flex";
    };

    // Close the feedback popup
    window.closeFeedbackPopup = function () {
        document.getElementById("feedbackPopup").style.display = "none";
    };
});

async function getNextFeedbackId() {
    const counterRef = doc(db, "tb_id_counters", "feedback_id_counter");

    try {
        const counterSnap = await getDoc(counterRef);

        if (counterSnap.exists()) {
            const currentCount = counterSnap.data().count || 0;
            const newCount = currentCount + 1;

            // Update the counter in Firestore
            await updateDoc(counterRef, { count: newCount });

            return newCount;
        } else {
            // If the counter does not exist, create it with initial value 1
            await setDoc(counterRef, { count: 1 });
            return 1;
        }
    } catch (error) {
        console.error("Error fetching feedback ID counter:", error);
        alert("Error generating feedback ID.");
        return null;
    }
}

// Function to submit feedback
// Function to submit feedback
window.submitFeedback = async function () {
    let concern = document.getElementById("feedbackType").value;
    let feedback = document.getElementById("feedbackMessage").value.trim();

    if (!feedback) {
        alert("Please enter a feedback message.");
        return;
    }

    // Retrieve user details from sessionStorage
    let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
    let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
    let submitted_by_picture = sessionStorage.getItem("userPicture") || "default-profile.png";

    // Retrieve and convert project_id to an integer
    let project_id = parseInt(sessionStorage.getItem("selectedProjectId"), 10) || 0;

    // Get the next available feedback_id
    let feedback_id = await getNextFeedbackId();
    if (feedback_id === null) return; // Stop if there's an error

    // Create a timestamp
    let timestamp = serverTimestamp();

    // Prepare feedback data object
    let feedbackData = {
        feedback_id: feedback_id, // Auto-incrementing feedback ID
        project_id: project_id,   // Ensure project ID is stored as an integer
        barangay_name: barangay_name,
        concern: concern,
        feedback: feedback,
        status: "Pending",
        submitted_by: submitted_by,
        submitted_by_picture: submitted_by_picture,
        timestamp: timestamp
    };

    try {
        // Save feedback to Firestore
        let docRef = await addDoc(collection(db, "tb_feedbacks"), feedbackData);

        alert("Feedback submitted successfully!");
        closeFeedbackPopup(); // Close the popup

        // Clear textarea after submitting
        document.getElementById("feedbackMessage").value = "";

        // Manually append feedback to the feedback list (without refreshing the page)
        addFeedbackToUI({
            ...feedbackData,
            timestamp: new Date() // Use local timestamp for immediate UI update
        });

    } catch (error) {
        console.error("Error saving feedback:", error);
        alert("Failed to submit feedback. Please try again.");
    }
};

//convert
function addFeedbackToUI(feedback) {
    const feedbackListContainer = document.getElementById("feedbackList");

    // Convert timestamp correctly
    let formattedTimestamp = "Unknown Date";
    if (feedback.timestamp) {
        if (feedback.timestamp.toDate) {
            // Firestore Timestamp object
            formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
        } else {
            // If already a JS Date object or a string
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

    // If there are no feedbacks yet, remove the "No feedbacks available" message
    let noFeedbackMessage = document.querySelector("#feedbackList .feedback-list-empty");
if (noFeedbackMessage) {
    noFeedbackMessage.remove();
}

    // Insert the new feedback at the top of the list
    feedbackListContainer.prepend(feedbackItem);
}




// Function to append submitted feedback to UI immediately
// Function to fetch and display feedbacks
async function displayFeedbacks() {
    let projectId = sessionStorage.getItem("selectedProjectId");

    if (!projectId) {
        console.error("❌ No project selected.");
        return;
    }

    projectId = parseInt(projectId, 10);
    console.log("📌 Fetching feedbacks for project_id:", projectId, "Type:", typeof projectId);

    if (isNaN(projectId)) {
        console.error("⚠️ Invalid project ID (not a number).");
        return;
    }

    const feedbackListContainer = document.getElementById("feedbackList");
    feedbackListContainer.innerHTML = "<p>Loading feedbacks...</p>";

    try {
        const feedbackRef = collection(db, "tb_feedbacks");
        const feedbackQuery = query(feedbackRef, where("project_id", "==", projectId));
        const querySnapshot = await getDocs(feedbackQuery);

        feedbackListContainer.innerHTML = ""; // Clear loading message

        if (querySnapshot.empty) {
            feedbackListContainer.innerHTML = '<p class="feedback-list-empty">No feedbacks available for this project.</p>';
            return;
        }

        let feedbackArray = [];

        querySnapshot.forEach((doc) => {
            feedbackArray.push(doc.data());
        });

        // Sort feedbacks: Most recent first, "Acknowledged" at the bottom
        feedbackArray.sort((a, b) => {
            if (a.status === "Acknowledged" && b.status !== "Acknowledged") return 1;
            if (b.status === "Acknowledged" && a.status !== "Acknowledged") return -1;
            return b.timestamp.toMillis() - a.timestamp.toMillis(); // Most recent first
        });

        feedbackArray.forEach((feedback) => {
            let formattedTimestamp = "Unknown Date";
            if (feedback.timestamp) {
                formattedTimestamp = feedback.timestamp.toDate
                    ? feedback.timestamp.toDate().toLocaleString()
                    : new Date(feedback.timestamp).toLocaleString();
            }

            // Set status color
            let statusColor = "black";
            if (feedback.status === "Pending") {
                statusColor = "gold"; // Yellow for Pending
            } else if (feedback.status === "Acknowledged") {
                statusColor = "green"; // Green for Acknowledged
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
                    <p class="feedback-status" style="color: ${statusColor};"><strong>Status:</strong> ${feedback.status}</p>
                </div>
            `;

            feedbackListContainer.appendChild(feedbackItem);
        });

    } catch (error) {
        console.error("🔥 Error fetching feedbacks:", error);
        feedbackListContainer.innerHTML = "<p>Error loading feedbacks.</p>";
    }
}

// Load project details and teams when the page loads
document.addEventListener("DOMContentLoaded", () => {
    fetchProjectDetails();
    fetchTeams();
    displayFeedbacks();
});
