import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Function to show success panel
function showSuccessPanel(message) {
    const successMessage = document.createElement("div");
    successMessage.className = "success-message";
    successMessage.textContent = message;

    document.body.appendChild(successMessage);

    successMessage.style.display = "block";
    setTimeout(() => {
        successMessage.style.opacity = "1";
    }, 5);

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

    errorMessage.style.display = "block";
    setTimeout(() => {
        errorMessage.style.opacity = "1";
    }, 5);

    setTimeout(() => {
        errorMessage.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(errorMessage);
        }, 400);
    }, 4000);
}

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
    let farmerId = sessionStorage.getItem("farmer_id");
    if (!farmerId) {
        console.error("❌ No farmer ID found in sessionStorage.");
        return null;
    }

    console.log("📌 Retrieved farmer_id from sessionStorage:", farmerId, "Type:", typeof farmerId);

    if (farmerId.trim() === "") {
        console.error("⚠️ Invalid farmer ID (empty or whitespace).");
        return null;
    }

    try {
        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const projectData = querySnapshot.docs[0].data();
            console.log("✅ Project Data Retrieved for lead_farmer_id:", projectData);

            // Ensure project_id exists and convert to integer
            if (!projectData.project_id && projectData.project_id !== 0) {
                console.error("❌ Project data missing project_id:", projectData);
                return null;
            }

            const projectId = parseInt(projectData.project_id, 10);
            if (isNaN(projectId)) {
                console.error("❌ Invalid project_id (not a number):", projectData.project_id);
                return null;
            }

            document.getElementById("projectName").textContent = projectData.project_name || "No Title";
            document.getElementById("status").textContent = projectData.status || "No Status";
            document.getElementById("startDate").textContent = projectData.start_date || "N/A";
            document.getElementById("endDate").textContent = projectData.end_date || "N/A";
            document.getElementById("cropName").textContent = projectData.crop_name || "N/A";
            document.getElementById("cropType").textContent = projectData.crop_type_name || "N/A";
            document.getElementById("equipment").textContent = projectData.equipment || "N/A";
            document.getElementById("barangayName").textContent = projectData.barangay_name || "N/A";
            document.getElementById("farmPresident").textContent = projectData.farm_president || "N/A";

            console.log("📌 Returning project_id as integer:", projectId);
            return projectId; // Return project_id as integer
        } else {
            console.error("❌ No project found with lead_farmer_id:", farmerId);
            return null;
        }
    } catch (error) {
        console.error("🔥 Error fetching project data for lead_farmer_id:", error);
        return null;
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
        const farmerId = sessionStorage.getItem("farmer_id");
        if (!farmerId) {
            teamsTableBody.innerHTML = "<tr><td colspan='4'>No farmer selected.</td></tr>";
            return;
        }

        // Keep farmerId as a string, no parseInt
        console.log("📌 Fetching teams for farmer_id:", farmerId, "Type:", typeof farmerId);

        const querySnapshot = await getDocs(
            query(collection(db, "tb_projects"), 
            where("lead_farmer_id", "==", farmerId))
        );

        teamsTableBody.innerHTML = "";

        if (querySnapshot.empty) {
            teamsTableBody.innerHTML = "<tr><td colspan='4'>No teams found for this farmer.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const project = doc.data();
            if (!project.team_id) return;

            const teamName = project.team_name || "Unknown Team";
            const leadFarmer = project.lead_farmer || "No Leader";
            const farmers = project.farmer_name || [];
            const teamId = project.team_id;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${teamName}</td>
                <td>${leadFarmer}</td>
                <td>${farmers.length}</td>
                <td>
                    <button 
                        class="view-btn" 
                        onclick="storeProjectIdAndRedirect('${project.project_id}', '${teamId}')"
                    >
                        <img src="../../images/eye.png" alt="View" class="view-icon">
                    </button>
                </td>
            `;
            teamsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching teams for farmer_id:", error);
        teamsTableBody.innerHTML = "<tr><td colspan='4'>Failed to load teams.</td></tr>";
    }
}

// Feedback Popup Functions (Copied from Second Code)
window.openFeedbackPopup = function () {
    document.getElementById("feedbackPopup").style.display = "flex";
};

window.closeFeedbackPopup = function () {
    document.getElementById("feedbackPopup").style.display = "none";
};

async function getNextFeedbackId() {
    const counterRef = doc(db, "tb_id_counters", "feedback_id_counter");
    try {
        const counterSnap = await getDoc(counterRef);
        if (counterSnap.exists()) {
            const currentCount = counterSnap.data().count || 0;
            const newCount = currentCount + 1;
            await updateDoc(counterRef, { count: newCount });
            return newCount;
        } else {
            await setDoc(counterRef, { count: 1 });
            return 1;
        }
    } catch (error) {
        console.error("Error fetching feedback ID counter:", error);
        return null;
    }
}

window.submitFeedback = async function () {
    let concern = document.getElementById("feedbackType").value;
    let feedback = document.getElementById("feedbackMessage").value.trim();

    if (!feedback) {
        showErrorPanel("Please enter a feedback message.");
        return;
    }

    const projectId = await fetchProjectDetails(); // Use fetchProjectDetails instead
    if (!projectId && projectId !== 0) {
        showErrorPanel("No project found for this farmer.");
        return;
    }

    let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
    let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
    let submitted_by_picture = sessionStorage.getItem("userPicture") || "default-profile.png";

    let feedback_id = await getNextFeedbackId();
    if (feedback_id === null) return;

    let feedbackData = {
        feedback_id: feedback_id,
        project_id: projectId,
        barangay_name: barangay_name,
        concern: concern,
        feedback: feedback,
        status: "Pending",
        submitted_by: submitted_by,
        submitted_by_picture: submitted_by_picture,
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "tb_feedbacks"), feedbackData);
        showSuccessPanel("Feedback submitted successfully!");
        closeFeedbackPopup();
        document.getElementById("feedbackMessage").value = "";
        addFeedbackToUI({ ...feedbackData, timestamp: new Date() });
        await displayFeedbacks(projectId); // Refresh feedbacks
    } catch (error) {
        console.error("Error saving feedback:", error);
        showErrorPanel("Failed to submit feedback. Please try again.");
    }
};

// Feedback UI Function (Copied from Second Code)
function addFeedbackToUI(feedback) {
    const feedbackListContainer = document.getElementById("feedbackList");
    let formattedTimestamp = feedback.timestamp.toLocaleString();

    const feedbackItem = document.createElement("div");
    feedbackItem.classList.add("feedback-item");
    feedbackItem.innerHTML = `
        <img src="${feedback.submitted_by_picture || 'default-profile.png'}" class="feedback-avatar" alt="User">
        <div class="feedback-content">
            <div class="feedback-header">
                <span class="feedback-user">${feedback.submitted_by} • ${feedback.concern} (${feedback.barangay_name})</span>
                <span class="timestamp">${formattedTimestamp}</span>
            </div>
            <p class="feedback-text">${feedback.feedback}</p>
            <p class="feedback-status">Status: ${feedback.status}</p>
        </div>
    `;

    let noFeedbackMessage = document.querySelector("#feedbackList .feedback-list-empty");
    if (noFeedbackMessage) {
        noFeedbackMessage.remove();
    }

    feedbackListContainer.prepend(feedbackItem);
}

// Display Feedbacks (Copied from Second Code)
async function displayFeedbacks(projectId) {
    const feedbackListContainer = document.getElementById("feedbackList");
    feedbackListContainer.innerHTML = '<p class="feedback-list-empty">Loading feedbacks...</p>';
    if (!projectId && projectId !== 0) {
        console.error("❌ No project ID retrieved for this farmer.");
        feedbackListContainer.innerHTML = '<p class="feedback-list-empty">No project found for this farmer.</p>';
        return;
    }

    console.log("📌 Fetching all feedbacks, filtering for project_id:", projectId, "Type:", typeof projectId);

    try {
        // Fetch all feedbacks from tb_feedbacks
        const feedbackRef = collection(db, "tb_feedbacks");
        const querySnapshot = await getDocs(feedbackRef);

        feedbackListContainer.innerHTML = "";
        let feedbackArray = [];

        // Filter feedbacks where project_id matches the provided projectId (integer comparison)
        querySnapshot.forEach((doc) => {
            const feedback = doc.data();
            const feedbackProjectId = parseInt(feedback.project_id, 10); // Convert to integer if stored as string
            if (feedbackProjectId === projectId) {
                feedbackArray.push(feedback);
            }
        });

        // Sort by timestamp (newest first)
        feedbackArray.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

        if (feedbackArray.length === 0) {
            feedbackListContainer.innerHTML = '<p class="feedback-list-empty">No feedbacks available for this project.</p>';
            return;
        }

        // Display filtered feedbacks
        feedbackArray.forEach((feedback) => {
            let formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
            let statusColor = feedback.status === "Pending" ? "gold" : "green";

            const feedbackItem = document.createElement("div");
            feedbackItem.classList.add("feedback-item");
            feedbackItem.innerHTML = `
                <img src="${feedback.submitted_by_picture || 'default-profile.png'}" class="feedback-avatar" alt="User">
                <div class="feedback-content">
                    <div class="feedback-header">
                        <span class="feedback-user">${feedback.submitted_by} • ${feedback.concern} (${feedback.barangay_name})</span>
                        <span class="timestamp">${formattedTimestamp}</span>
                    </div>
                    <div class="feedback-header1">
                        <p class="feedback-text">${feedback.feedback}</p>
                        <p class="feedback-status" style="color: ${statusColor};">Status: ${feedback.status}</p>
                    </div>
                </div>
            `;
            feedbackListContainer.appendChild(feedbackItem);
        });
    } catch (error) {
        console.error("🔥 Error fetching feedbacks:", error);
        feedbackListContainer.innerHTML = "<p>Error loading feedbacks.</p>";
    }
}

// Load project details, teams, and feedbacks when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Starting DOMContentLoaded...");
    if (!sessionStorage.getItem("farmer_id")) {
        console.log("Setting default farmer_id for testing...");
        sessionStorage.setItem("farmer_id", "2"); // Replace with your test value
    }
    const projectId = await fetchProjectDetails();
    console.log("Project ID returned from fetchProjectDetails:", projectId);
    if (projectId || projectId === 0) {
        console.log("Calling displayFeedbacks with projectId:", projectId);
        await displayFeedbacks(projectId);
        await fetchTeams();
    } else {
        console.log("No project_id returned; skipping displayFeedbacks.");
        const feedbackListContainer = document.getElementById("feedbackList");
        if (feedbackListContainer) {
            feedbackListContainer.innerHTML = '<p class="feedback-list-empty">No project found for this farmer.</p>';
        }
        await fetchTeams();
    }
});