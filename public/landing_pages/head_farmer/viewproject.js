import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, orderBy, doc,
    getDoc, setDoc, updateDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let globalProjectId = null;

async function fetchProjectDetails() {
    let farmerId = sessionStorage.getItem("farmer_id");
    if (!farmerId) {
        console.error("❌ No farmer_id found in sessionStorage.");
        return;
    }

    try {
        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const projectData = querySnapshot.docs[0].data();
            globalProjectId = projectData.project_id;
            displayFeedbacks(globalProjectId);

            document.getElementById("projectName").textContent = projectData.project_name || "No Title";
            document.getElementById("status").textContent = projectData.status || "No Status";
            document.getElementById("startDate").textContent = projectData.start_date || "N/A";
            document.getElementById("endDate").textContent = projectData.end_date || "N/A";
            document.getElementById("extendedDate").textContent = projectData.extended_date || "--";
            document.getElementById("cropName").textContent = projectData.crop_name || "N/A";
            document.getElementById("cropType").textContent = projectData.crop_type_name || "N/A";
            document.getElementById("equipment").textContent = projectData.equipment || "N/A";
            document.getElementById("barangayName").textContent = projectData.barangay_name || "N/A";
            document.getElementById("farmPresident").textContent = projectData.farm_president || "N/A";
        }
    } catch (error) {
        console.error("🔥 Error fetching project data:", error);
    }
}

async function fetchTeams() {
    const teamsTableBody = document.getElementById("teamsTableBody");
    teamsTableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>Loading...</td></tr>";

    try {
        let farmerId = sessionStorage.getItem("farmer_id");
        if (!farmerId) {
            teamsTableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>User not logged in.</td></tr>";
            return;
        }

        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        teamsTableBody.innerHTML = "";
        if (querySnapshot.empty) {
            teamsTableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No teams found.</td></tr>";
            return;
        }

        querySnapshot.forEach(doc => {
            const project = doc.data();
            if (!project.team_id) return;

            const teamName = project.team_name || "Unknown Team";
            const leadFarmer = project.lead_farmer || "No Leader";
            let farmers = project.farmer_name || [];
            if (!Array.isArray(farmers)) farmers = [];

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${teamName}</td>
                <td>${leadFarmer}</td>
                <td>${farmers.length}</td>
                <td><img src="../../images/eye.png" class="action-btn" alt="View"></td>
            `;

            const viewButton = row.querySelector(".action-btn");
            viewButton.addEventListener("click", () => openPopup(teamName, leadFarmer, farmers));
            teamsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("🔥 Error fetching teams:", error);
        teamsTableBody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>Failed to load teams.</td></tr>";
    }
}

// Popup Functions
window.openPopup = function (teamName, leadFarmer, farmers) {
    const popup = document.getElementById("viewTeamPopup");
    document.getElementById("popupTeamName").textContent = teamName;
    document.getElementById("popupLeadFarmer").textContent = leadFarmer;

    const farmerList = document.getElementById("popupFarmerList");
    farmerList.innerHTML = "";
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
};

window.closePopup = function () {
    document.getElementById("viewTeamPopup").style.display = "none";
};

document.getElementById("closePopup").addEventListener("click", closePopup);
window.addEventListener("click", (event) => {
    const popup = document.getElementById("viewTeamPopup");
    if (event.target === popup) closePopup();
});

// Feedback Popup
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
        alert("Please enter a feedback message.");
        return;
    }

    if (!globalProjectId) {
        alert("No project selected. Please refresh the page or select a project.");
        return;
    }

    let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
    let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
    let submitted_by_picture = sessionStorage.getItem("userPicture") || "default-profile.png";

    let feedback_id = await getNextFeedbackId();
    if (feedback_id === null) return;

    let feedbackData = {
        feedback_id: feedback_id,
        project_id: globalProjectId,
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
        alert("Feedback submitted successfully!");
        closeFeedbackPopup();
        document.getElementById("feedbackMessage").value = "";
        addFeedbackToUI({ ...feedbackData, timestamp: new Date() });
    } catch (error) {
        console.error("Error saving feedback:", error);
        alert("Failed to submit feedback. Please try again.");
    }
};

function addFeedbackToUI(feedback) {
    const feedbackListContainer = document.getElementById("feedbackList");
    let formattedTimestamp = feedback.timestamp.toLocaleString();

    const feedbackItem = document.createElement("div");
    feedbackItem.classList.add("feedback-item");
    feedbackItem.innerHTML = `
        <img src="${feedback.submitted_by_picture || 'default-profile.png'}" class="feedback-avatar" alt="User">
        <div class="feedback-content3">
            <div class="feedback-header">
                <span class="feedback-user">${feedback.submitted_by} • ${feedback.concern} (${feedback.barangay_name})</span>
                <span class="timestamp">${formattedTimestamp}</span>
            </div>
            <div class="feedback-header1">
             <p class="feedback-text">${feedback.feedback}</p>
             <p class="feedback-status">Status: ${feedback.status}</p>
            </div>
        </div>
    `;

    let noFeedbackMessage = document.querySelector("#feedbackList p");
    if (noFeedbackMessage && noFeedbackMessage.innerText.includes("No feedbacks available")) {
        noFeedbackMessage.remove();
    }

    feedbackListContainer.prepend(feedbackItem);
}

async function displayFeedbacks(projectId) {
    const feedbackListContainer = document.getElementById("feedbackList");
    feedbackListContainer.innerHTML = "<p>Loading feedbacks...</p>";

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
            feedbackListContainer.innerHTML = "<p>No feedbacks available for this project.</p>";
            return;
        }

        feedbackArray.forEach((feedback) => {
            let formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
            let statusColor = feedback.status === "Pending" ? "gold" : "green";

            const feedbackItem = document.createElement("div");
            feedbackItem.classList.add("feedback-item");
            feedbackItem.innerHTML = `
                <img src="${feedback.submitted_by_picture || 'default-profile.png'}" class="feedback-avatar" alt="User">
                <div class="feedback-content">
                    <div class="feedback-header3">
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

document.addEventListener("DOMContentLoaded", () => {
    fetchProjectDetails();
    fetchTeams();
});