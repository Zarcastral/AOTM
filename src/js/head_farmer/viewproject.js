import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

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

// New function for "No project assigned yet" with distinct design
function showNoProjectPanel() {
  const noProjectMessage = document.createElement("div");
  noProjectMessage.className = "no-project-message";
  noProjectMessage.textContent = "No Project Assigned Yet.";

  document.body.appendChild(noProjectMessage);

  // Fade in
  noProjectMessage.style.display = "block";
  setTimeout(() => {
    noProjectMessage.style.opacity = "1";
  }, 5);

  // Fade out after 5 seconds (longer duration for emphasis)
  setTimeout(() => {
    noProjectMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(noProjectMessage);
    }, 400);
  }, 5000);
}

// Firebase Configuration
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

let globalProjectId = null;

async function fetchProjectDetails() {
  let farmerId = sessionStorage.getItem("farmer_id");
  if (!farmerId) {
    console.error("❌ No farmer_id found in sessionStorage.");
    showErrorPanel("No farmer ID found. Please log in again.");
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

      document.getElementById("projectName").textContent =
        projectData.project_name || "No Title";
      document.getElementById("status").textContent =
        projectData.status || "No Status";
      document.getElementById("startDate").textContent =
        projectData.start_date || "N/A";
      document.getElementById("endDate").textContent =
        projectData.end_date || "N/A";
      document.getElementById("extendedDate").textContent =
        projectData.extend_date || "--";
      document.getElementById("cropName").textContent =
        projectData.crop_name || "N/A";
      document.getElementById("cropType").textContent =
        projectData.crop_type_name || "N/A";
      document.getElementById("barangayName").textContent =
        projectData.barangay_name || "N/A";
      document.getElementById("farmPresident").textContent =
        projectData.farm_president || "N/A";
    } else {
      // Show no project panel instead of error panel
      showNoProjectPanel();
      // Clear feedback list and show no feedback message
      const feedbackListContainer = document.getElementById("feedbackList");
      feedbackListContainer.innerHTML =
        '<p class="feedback-list-empty">No feedbacks available.</p>';
    }
  } catch (error) {
    console.error("🔥 Error fetching project data:", error);
    showErrorPanel("Failed to fetch project details. Please try again.");
  }
}

async function fetchTeams() {
  const teamsTableBody = document.getElementById("teamsTableBody");
  teamsTableBody.innerHTML =
    "<tr><td colspan='6' style='text-align: center;'>Loading...</td></tr>";

  try {
    let farmerId = sessionStorage.getItem("farmer_id");
    if (!farmerId) {
      teamsTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align: center;'>User not logged in.</td></tr>";
      return;
    }

    const projectsRef = collection(db, "tb_projects");
    const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
    const querySnapshot = await getDocs(q);

    teamsTableBody.innerHTML = "";
    if (querySnapshot.empty) {
      teamsTableBody.innerHTML =
        "<tr><td colspan='6' style='text-align: center;'>No teams found.</td></tr>";
      return;
    }

    querySnapshot.forEach((doc) => {
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
      viewButton.addEventListener("click", () =>
        openPopup(teamName, leadFarmer, farmers)
      );
      teamsTableBody.appendChild(row);
    });
  } catch (error) {
    console.error("🔥 Error fetching teams:", error);
    teamsTableBody.innerHTML =
      "<tr><td colspan='6' style='text-align: center;'>Failed to load teams.</td></tr>";
  }
}

// Popup Functions
/*window.openPopup = function (teamName, leadFarmer, farmers) {
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
})*/

// Feedback Popup
window.openFeedbackPopup = function () {
  document.getElementById("feedbackPopup").style.display = "flex";
};

window.closeFeedbackPopup = function () {
  document.getElementById("feedbackPopup").style.display = "none";
};

// Helper function to fetch notification recipients and project details
async function getFeedbackNotificationRecipients(projectId) {
  const recipients = new Set();
  let projectDetails = {
    project_name: "Unknown Project",
    barangay_name: "Unknown Barangay",
  };

  try {
    // Fetch the farmer_id, project_name, and barangay_name from tb_projects
    const projectRef = collection(db, "tb_projects");
    const projectQuery = query(
      projectRef,
      where("project_id", "==", projectId)
    );
    const projectSnapshot = await getDocs(projectQuery);

    if (!projectSnapshot.empty) {
      const projectData = projectSnapshot.docs[0].data();
      if (projectData.farmer_id) {
        recipients.add(projectData.farmer_id);
      }
      projectDetails = {
        project_name: projectData.project_name || "Unknown Project",
        barangay_name: projectData.barangay_name || "Unknown Barangay",
      };
    }

    // Fetch Admin and Supervisor users' user_name from tb_users
    const usersRef = collection(db, "tb_users");
    const usersQuery = query(
      usersRef,
      where("user_type", "in", ["Admin", "Supervisor"])
    );
    const usersSnapshot = await getDocs(usersQuery);

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.user_name) {
        recipients.add(userData.user_name);
      }
    });

    return { recipients: Array.from(recipients), projectDetails };
  } catch (error) {
    console.error(
      "Error fetching notification recipients or project details:",
      error
    );
    return { recipients: [], projectDetails };
  }
}

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

  if (!globalProjectId) {
    showErrorPanel(
      "No project selected. Please refresh the page or select a project."
    );
    return;
  }

  let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
  let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
  let submitted_by_picture =
    sessionStorage.getItem("userPicture") || "default-profile.png";

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
    timestamp: serverTimestamp(),
  };

  try {
    // Save feedback
    await addDoc(collection(db, "tb_feedbacks"), feedbackData);

    // Fetch recipients and project details for notifications
    const { recipients, projectDetails } =
      await getFeedbackNotificationRecipients(globalProjectId);

    // Create notifications for each recipient
    const notificationPromises = recipients.map((recipient) =>
      addDoc(collection(db, "tb_notifications"), {
        description: `A new feedback has been submitted for project name: ${projectDetails.project_name} in ${projectDetails.barangay_name}: ${concern}`,
        project_id: Number(globalProjectId),
        read: false,
        recipient: recipient,
        timestamp: serverTimestamp(),
        title: "NEW FEEDBACK SUBMITTED",
        type: "feedback",
      })
    );

    // Execute all notification creations
    await Promise.all(notificationPromises);

    // Update UI and show success
    showSuccessPanel("Feedback submitted successfully!");
    closeFeedbackPopup();
    document.getElementById("feedbackMessage").value = "";
    addFeedbackToUI({ ...feedbackData, timestamp: new Date() });
  } catch (error) {
    console.error("Error saving feedback or sending notifications:", error);
    showErrorPanel("Failed to submit feedback. Please try again.");
  }
};

function addFeedbackToUI(feedback) {
  const feedbackListContainer = document.getElementById("feedbackList");
  let formattedTimestamp = feedback.timestamp.toLocaleString();

  const feedbackItem = document.createElement("div");
  feedbackItem.classList.add("feedback-item");
  feedbackItem.innerHTML = `
        <img src="${
          feedback.submitted_by_picture || "default-profile.png"
        }" class="feedback-avatar" alt="User">
        <div class="feedback-content"> <!-- Changed from feedback-content3 to feedback-content -->
            <div class="feedback-header">
                <span class="feedback-user">${feedback.submitted_by} • ${
    feedback.concern
  } (${feedback.barangay_name})</span>
                <span class="timestamp">${formattedTimestamp}</span>
            </div>
            <div class="feedback-header1">
             <p class="feedback-text">${feedback.feedback}</p>
             <p class="feedback-status">Status: ${feedback.status}</p>
            </div>
        </div>
    `;

  let noFeedbackMessage = document.querySelector(
    "#feedbackList .feedback-list-empty"
  );
  if (noFeedbackMessage) {
    noFeedbackMessage.remove();
  }

  feedbackListContainer.prepend(feedbackItem);
}

async function displayFeedbacks(projectId) {
  const feedbackListContainer = document.getElementById("feedbackList");
  feedbackListContainer.innerHTML =
    '<p class="feedback-list-empty">Loading feedbacks...</p>';

  try {
    const feedbackRef = collection(db, "tb_feedbacks");
    const q = query(feedbackRef, where("project_id", "==", projectId));
    const querySnapshot = await getDocs(q);

    feedbackListContainer.innerHTML = "";
    let feedbackArray = [];

    querySnapshot.forEach((doc) => {
      feedbackArray.push(doc.data());
    });

    feedbackArray.sort(
      (a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()
    );

    if (feedbackArray.length === 0) {
      feedbackListContainer.innerHTML =
        '<p class="feedback-list-empty">No feedbacks available for this project.</p>';
      return;
    }

    feedbackArray.forEach((feedback) => {
      let formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
      let statusColor = feedback.status === "Pending" ? "#848a9c" : "#41a186";

      const feedbackItem = document.createElement("div");
      feedbackItem.classList.add("feedback-item");
      feedbackItem.innerHTML = `
                <img src="${
                  feedback.submitted_by_picture || "default-profile.png"
                }" class="feedback-avatar" alt="User">
                <div class="feedback-content">
                    <div class="feedback-header3">
                        <span class="feedback-user">${
                          feedback.submitted_by
                        } • ${feedback.concern} (${
        feedback.barangay_name
      })</span>
                        <span class="timestamp">${formattedTimestamp}</span>
                    </div>
                    <div class="feedback-header1">
                     <p class="feedback-text">${feedback.feedback}</p>
                     <p class="feedback-status" style="color: ${statusColor};">Status: ${
        feedback.status
      }</p>
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
