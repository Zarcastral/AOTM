
import { getFirestore, collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDoc }
 from "firebase/firestore";

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

import app from "../../config/firebase_config.js";
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
            document.getElementById("extendedDate").textContent = projectData.extend_date || "N/A";
            document.getElementById("cropName").textContent = projectData.crop_name || "N/A";
            document.getElementById("cropType").textContent = projectData.crop_type_name || "N/A";
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
            where("project_id", "==", parseInt(projectId)))
        );

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
            const teamId = project.team_id;

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

    let projectId = parseInt(sessionStorage.getItem("selectedProjectId"), 10);
    if (!projectId) {
        showErrorPanel("No project selected. Please refresh the page or select a project.");
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
    feedbackListContainer.innerHTML = '<p class="feedback-list-empty">Loading feedbacks...</p>';

    try {
        const feedbackRef = collection(db, "tb_feedbacks");
        const q = query(feedbackRef, where("project_id", "==", projectId));
        const querySnapshot = await getDocs(q);

        feedbackListContainer.innerHTML = "";
        let feedbackArray = [];

        querySnapshot.forEach((doc) => {
            feedbackArray.push(doc.data());
        });

        feedbackArray.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

        if (feedbackArray.length === 0) {
            feedbackListContainer.innerHTML = '<p class="feedback-list-empty">No feedbacks available for this project.</p>';
            return;
        }

        feedbackArray.forEach((feedback) => {
            let formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
            let statusColor = feedback.status === "Pending" ? "#848a9c" : "#41a186";

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
document.addEventListener("DOMContentLoaded", () => {
    fetchProjectDetails();
    fetchTeams();
    displayFeedbacks();
});