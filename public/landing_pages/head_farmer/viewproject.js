import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, orderBy, doc,
    getDoc, setDoc, updateDoc, runTransaction, addDoc, serverTimestamp
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

let globalProjectId = null; // Declare global variable for project_id

async function fetchProjectDetails() {
    let farmerId = sessionStorage.getItem("farmer_id"); // Retrieve farmer_id from session storage

    console.log("📌 Retrieved farmer_id from sessionStorage:", farmerId);

    if (!farmerId) {
        console.error("❌ No farmer_id found in sessionStorage.");
        return;
    }

    try {
        // Query Firestore for projects where lead_farmer_id matches the session farmer_id
        const projectsRef = collection(db, "tb_projects");
        const q = query(projectsRef, where("lead_farmer_id", "==", parseInt(farmerId, 10))); // Ensure comparison as integer
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const projectData = querySnapshot.docs[0].data();
            console.log("✅ Project Data Retrieved:", projectData);

            // Store project_id globally
            if (projectData.project_id) {
                globalProjectId = projectData.project_id;
                console.log("📌 Stored Global Project ID:", globalProjectId);
                displayFeedbacks(globalProjectId); // Pass project_id to displayFeedbacks
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
            console.error("❌ No projects found for this farmer_id.");
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
        let userEmail = sessionStorage.getItem("userEmail") /*|| sessionStorage.getItem("farmerEmail")*/;

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

//FEEDBACK POPUP
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




//FEEDBACK_ID
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


// SUBMIT FEEDBACK
window.submitFeedback = async function () {
    let concern = document.getElementById("feedbackType").value;
    let feedback = document.getElementById("feedbackMessage").value.trim();

    if (!feedback) {
        alert("Please enter a feedback message.");
        return;
    }

    // Ensure `globalProjectId` is set
    if (!globalProjectId) {
        alert("No project selected. Please refresh the page or select a project.");
        return;
    }

    // Retrieve user details from sessionStorage
    let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
    let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
    let submitted_by_picture = sessionStorage.getItem("userPicture") || "default-profile.png";

    // Get the next available feedback_id
    let feedback_id = await getNextFeedbackId();
    if (feedback_id === null) return; // Stop if there's an error

    // Create a timestamp
    let timestamp = serverTimestamp();

    // Prepare feedback data object
    let feedbackData = {
        feedback_id: feedback_id, // Auto-incrementing feedback ID
        project_id: globalProjectId,   // Use globally stored project ID
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
        await addDoc(collection(db, "tb_feedbacks"), feedbackData);

        // If Firestore operation succeeds, show success alert
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

        // Show failure alert **only if the Firestore operation fails**
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
    let noFeedbackMessage = document.querySelector("#feedbackList p");
    if (noFeedbackMessage && noFeedbackMessage.innerText.includes("No feedbacks available")) {
        noFeedbackMessage.remove();
    }

    // Insert the new feedback at the top of the list
    feedbackListContainer.prepend(feedbackItem);
}


//DISPLAY FEEDBACK
async function displayFeedbacks(projectId) {
    console.log(`📌 Fetching feedbacks for Project ID: ${projectId}`);

    const feedbackListContainer = document.getElementById("feedbackList");
    feedbackListContainer.innerHTML = "<p>Loading feedbacks...</p>";

    try {
        const feedbackRef = collection(db, "tb_feedbacks");
        const q = query(feedbackRef, where("project_id", "==", projectId));
        const querySnapshot = await getDocs(q);

        feedbackListContainer.innerHTML = ""; // Clear loading message

        let hasFeedback = false;
        let feedbackArray = [];

        querySnapshot.forEach((doc) => {
            feedbackArray.push(doc.data());
        });

        // Sort: Most recent first, Acknowledged feedbacks last
        feedbackArray.sort((a, b) => {
            if (a.status === "Acknowledged" && b.status !== "Acknowledged") return 1;
            if (b.status === "Acknowledged" && a.status !== "Acknowledged") return -1;
            return b.timestamp.toMillis() - a.timestamp.toMillis(); // Sort by most recent
        });

        feedbackArray.forEach((feedback) => {
            hasFeedback = true;

            let formattedTimestamp = "Unknown Date";
            if (feedback.timestamp) {
                if (feedback.timestamp.toDate) {
                    formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
                } else {
                    formattedTimestamp = new Date(feedback.timestamp).toLocaleString();
                }
            }

            // Set status color based on status value
            let statusColor = "black"; // Default color
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

        if (!hasFeedback) {
            feedbackListContainer.innerHTML = "<p>No feedbacks available for this project.</p>";
        }

    } catch (error) {
        console.error("🔥 Error fetching feedbacks:", error);
        feedbackListContainer.innerHTML = "<p>Error loading feedbacks.</p>";
    }
}



