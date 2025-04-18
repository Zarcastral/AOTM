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

import app from "../../config/firebase_config.js";
const db = getFirestore(app);

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

// Function to fetch and display project details
async function fetchProjectDetails() {
  let projectId = sessionStorage.getItem("selectedProjectId");

  if (!projectId) {
    console.error("❌ No project ID found in sessionStorage.");
    return;
  }

  projectId = parseInt(projectId, 10);
  console.log(
    "📌 Retrieved project_id (after conversion):",
    projectId,
    "Type:",
    typeof projectId
  );

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

      document.getElementById("projectName").textContent =
        projectData.project_name || "No Title";
      document.getElementById("status").textContent =
        projectData.status || "No Status";
      document.getElementById("startDate").textContent =
        projectData.start_date || "N/A";
      document.getElementById("endDate").textContent =
        projectData.end_date || "N/A";
      document.getElementById("extendedDate").textContent =
        projectData.extend_date || "N/A";
      document.getElementById("cropName").textContent =
        projectData.crop_name || "N/A";
      document.getElementById("cropType").textContent =
        projectData.crop_type_name || "N/A";
      document.getElementById("barangayName").textContent =
        projectData.barangay_name || "N/A";
      document.getElementById("farmPresident").textContent =
        projectData.farm_president || "N/A";
    } else {
      console.error("❌ Project not found in Firestore.");
    }
  } catch (error) {
    console.error("🔥 Error fetching project data:", error);
  }
}

function storeProjectIdAndRedirect(projectId, teamId) {
  sessionStorage.setItem("selected_project_id", projectId);
  window.location.href = `../../../public/landing_pages/head_farmer/headfarm_task.html?team_id=${teamId}`;
}

// Expose the function to the global scope
window.storeProjectIdAndRedirect = storeProjectIdAndRedirect;

// Fetch and display teams
async function fetchTeams() {
  const teamsTableBody = document.getElementById("teamsTableBody");
  teamsTableBody.innerHTML =
    "<tr><td colspan='4' class='table-empty-message'>Loading...</td></tr>";

  try {
    const projectId = sessionStorage.getItem("selectedProjectId");
    if (!projectId) {
      teamsTableBody.innerHTML =
        "<tr><td colspan='4' class='table-empty-message'>No project selected.</td></tr>";
      return;
    }

    const querySnapshot = await getDocs(
      query(
        collection(db, "tb_projects"),
        where("project_id", "==", parseInt(projectId))
      )
    );

    teamsTableBody.innerHTML = "";

    if (querySnapshot.empty) {
      teamsTableBody.innerHTML =
        "<tr><td colspan='4' class='table-empty-message'>No team assigned yet.</td></tr>";
      return;
    }

    let hasTeams = false;

    querySnapshot.forEach((doc) => {
      const project = doc.data();
      if (!project.team_id) return;

      hasTeams = true;

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

    if (!hasTeams) {
      teamsTableBody.innerHTML =
        "<tr><td colspan='4' class='table-empty-message'>No team assigned yet.</td></tr>";
    }
  } catch (error) {
    console.error("Error fetching teams:", error);
    teamsTableBody.innerHTML =
      "<tr><td colspan='4' class='table-empty-message'>Failed to load teams.</td></tr>";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  window.openFeedbackPopup = function () {
    document.getElementById("feedbackPopup").style.display = "flex";
  };

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

      await updateDoc(counterRef, { count: newCount });

      return newCount;
    } else {
      await setDoc(counterRef, { count: 1 });
      return 1;
    }
  } catch (error) {
    console.error("Error fetching feedback ID counter:", error);
    showErrorPanel("Error generating feedback ID.");
    return null;
  }
}

// Function to submit feedback
window.submitFeedback = async function () {
  let concern = document.getElementById("feedbackType").value;
  let feedback = document.getElementById("feedbackMessage").value.trim();

  if (!feedback) {
    showErrorPanel("Please enter a feedback message.");
    return;
  }

  let barangay_name = sessionStorage.getItem("barangay_name") || "Unknown";
  let submitted_by = sessionStorage.getItem("userFullName") || "Anonymous";
  let submitted_by_picture =
    sessionStorage.getItem("userPicture") || "default-profile.png";

  let project_id =
    parseInt(sessionStorage.getItem("selectedProjectId"), 10) || 0;

  let feedback_id = await getNextFeedbackId();
  if (feedback_id === null) return;

  let timestamp = serverTimestamp();

  let feedbackData = {
    feedback_id: feedback_id,
    project_id: project_id,
    barangay_name: barangay_name,
    concern: concern,
    feedback: feedback,
    status: "Pending",
    submitted_by: submitted_by,
    submitted_by_picture: submitted_by_picture,
    timestamp: timestamp,
  };

  try {
    let docRef = await addDoc(collection(db, "tb_feedbacks"), feedbackData);

    showSuccessPanel("Feedback submitted successfully!");
    closeFeedbackPopup();

    document.getElementById("feedbackMessage").value = "";

    addFeedbackToUI({
      ...feedbackData,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error saving feedback:", error);
    alert("Failed to submit feedback. Please try again.");
  }
};

// Helper function to fetch lead_farmer_id for acknowledgment notification
async function getAcknowledgmentNotificationRecipient(projectId) {
  try {
    const projectRef = collection(db, "tb_projects");
    const projectQuery = query(
      projectRef,
      where("project_id", "==", projectId)
    );
    const projectSnapshot = await getDocs(projectQuery);

    if (!projectSnapshot.empty) {
      const projectData = projectSnapshot.docs[0].data();
      return {
        recipient: projectData.lead_farmer_id || null,
        projectDetails: {
          project_name: projectData.project_name || "Unknown Project",
          barangay_name: projectData.barangay_name || "Unknown Barangay",
        },
      };
    }
    return { recipient: null, projectDetails: {} };
  } catch (error) {
    console.error("Error fetching project lead_farmer_id:", error);
    return { recipient: null, projectDetails: {} };
  }
}

// Function to add feedback to the UI
function addFeedbackToUI(feedback) {
  const feedbackListContainer = document.getElementById("feedbackList");

  let formattedTimestamp = "Unknown Date";
  if (feedback.timestamp) {
    if (feedback.timestamp.toDate) {
      formattedTimestamp = feedback.timestamp.toDate().toLocaleString();
    } else {
      formattedTimestamp = new Date(feedback.timestamp).toLocaleString();
    }
  }

  let statusColor = feedback.status === "Pending" ? "#848a9c" : "#41a186";

  const feedbackItem = document.createElement("div");
  feedbackItem.classList.add("feedback-item");

  feedbackItem.innerHTML = `
          <img src="${
            feedback.submitted_by_picture || "default-profile.png"
          }" class="feedback-avatar" alt="User">
          <div class="feedback-content">
              <div class="feedback-header">
                  <div>
                      <span class="feedback-user">${
                        feedback.submitted_by
                      }</span>
                      <span class="feedback-team">(${
                        feedback.barangay_name
                      } - ${feedback.concern})</span>
                  </div>
                  <span class="timestamp">${formattedTimestamp}</span>
              </div>
              <p class="feedback-text">${feedback.feedback}</p>
              <div class="feedback-status-container">
                  <span class="feedback-status ${statusColor}">Report - ${
    feedback.status
  }</span>
                  ${
                    feedback.status === "Pending"
                      ? `<button class="acknowledge-btn" data-id="${
                          feedback.id || ""
                        }">
                          <img src="../../images/check.png" alt="Acknowledge" class="acknowledge-icon">
                         </button>`
                      : ""
                  }
              </div>
          </div>
      `;

  let noFeedbackMessage = document.querySelector(
    "#feedbackList .feedback-list-empty"
  );
  if (
    noFeedbackMessage &&
    noFeedbackMessage.innerText.includes("No feedbacks available")
  ) {
    noFeedbackMessage.remove();
  }

  feedbackListContainer.prepend(feedbackItem);

  const acknowledgeBtn = feedbackItem.querySelector(".acknowledge-btn");
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener("click", async (event) => {
      const feedbackId = event.target
        .closest(".acknowledge-btn")
        .getAttribute("data-id");
      await acknowledgeFeedback(feedbackId);
    });
  }
}

// Function to fetch and display feedbacks
async function displayFeedbacks() {
  let projectId = sessionStorage.getItem("selectedProjectId");

  if (!projectId) {
    console.error("❌ No project selected.");
    return;
  }

  projectId = parseInt(projectId, 10);
  console.log(
    "📌 Fetching feedbacks for project_id:",
    projectId,
    "Type:",
    typeof projectId
  );

  if (isNaN(projectId)) {
    console.error("⚠️ Invalid project ID (not a number).");
    return;
  }

  const feedbackListContainer = document.getElementById("feedbackList");
  feedbackListContainer.innerHTML =
    '<p class="feedback-list-empty">Loading feedbacks...</p>';

  try {
    const feedbackRef = collection(db, "tb_feedbacks");
    const feedbackQuery = query(
      feedbackRef,
      where("project_id", "==", projectId)
    );
    const querySnapshot = await getDocs(feedbackQuery);

    feedbackListContainer.innerHTML = "";

    if (querySnapshot.empty) {
      feedbackListContainer.innerHTML =
        '<p class="feedback-list-empty">No feedbacks available for this project.</p>';
      return;
    }

    let feedbackArray = [];

    querySnapshot.forEach((doc) => {
      let feedbackData = doc.data();
      feedbackData.id = doc.id;
      feedbackArray.push(feedbackData);
    });

    feedbackArray.sort((a, b) => {
      if (a.status === "Acknowledged" && b.status !== "Acknowledged") return 1;
      if (b.status === "Acknowledged" && a.status !== "Acknowledged") return -1;
      return b.timestamp.toMillis() - a.timestamp.toMillis();
    });

    feedbackArray.forEach((feedback) => {
      let formattedTimestamp = "Unknown Date";
      if (feedback.timestamp) {
        formattedTimestamp = feedback.timestamp.toDate
          ? feedback.timestamp.toDate().toLocaleString()
          : new Date(feedback.timestamp).toLocaleString();
      }

      let statusColor = feedback.status === "Pending" ? "gold" : "green";

      const feedbackItem = document.createElement("div");
      feedbackItem.classList.add("feedback-item");

      feedbackItem.innerHTML = `
                  <img src="${
                    feedback.submitted_by_picture || "default-profile.png"
                  }" class="feedback-avatar" alt="User">
                  <div class="feedback-content">
                      <div class="feedback-header">
                          <div>
                              <span class="feedback-user">${
                                feedback.submitted_by
                              }</span>
                              <span class="feedback-team">(${
                                feedback.barangay_name
                              } - ${feedback.concern})</span>
                          </div>
                          <span class="timestamp">${formattedTimestamp}</span>
                      </div>
                      <p class="feedback-text">${feedback.feedback}</p>
                      <div class="feedback-status-container">
                          <span class="feedback-status ${statusColor}">Report - ${
        feedback.status
      }</span>
                          ${
                            feedback.status === "Pending"
                              ? `<button class="acknowledge-btn" data-id="${feedback.id}">
                                  <img src="../../images/check.png" alt="Acknowledge" class="acknowledge-icon">
                                 </button>`
                              : ""
                          }
                      </div>
                  </div>
              `;

      feedbackListContainer.appendChild(feedbackItem);
    });

    document.querySelectorAll(".acknowledge-btn").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const feedbackId = event.target
          .closest(".acknowledge-btn")
          .getAttribute("data-id");
        await acknowledgeFeedback(feedbackId);
      });
    });
  } catch (error) {
    console.error("🔥 Error fetching feedbacks:", error);
    feedbackListContainer.innerHTML = "<p>Error loading feedbacks.</p>";
  }
}

// Function to update feedback status to "Acknowledged"
window.acknowledgeFeedback = async function (feedbackId) {
  try {
    const userFullName =
      sessionStorage.getItem("userFullName") || "Unknown User";
    const userType = sessionStorage.getItem("user_type") || "Unknown Type";

    // Update feedback status in tb_feedbacks
    const feedbackRef = doc(db, "tb_feedbacks", feedbackId);
    await updateDoc(feedbackRef, {
      status: "Acknowledged",
      acknowledged_by: userFullName,
      acknowledged_by_user_type: userType,
    });

    // Fetch feedback data to get project_id
    const feedbackSnap = await getDoc(feedbackRef);
    if (!feedbackSnap.exists()) {
      throw new Error("Feedback not found");
    }
    const feedbackData = feedbackSnap.data();
    const projectId = feedbackData.project_id;

    // Fetch lead_farmer_id as the recipient
    const { recipient, projectDetails } =
      await getAcknowledgmentNotificationRecipient(projectId);

    if (recipient) {
      // Create notification for the lead_farmer_id
      await addDoc(collection(db, "tb_notifications"), {
        description: `Your request is acknowledged by ${userType} for project: ${projectDetails.project_name} in ${projectDetails.barangay_name}`,
        project_id: Number(projectId),
        read: false,
        recipient: recipient,
        timestamp: serverTimestamp(),
        title: "FEEDBACK ACKNOWLEDGED",
        type: "feedback_acknowledgment",
      });
    } else {
      console.warn("No lead_farmer_id found for project_id:", projectId);
    }

    showSuccessPanel("Feedback acknowledged successfully!");
    displayFeedbacks();
  } catch (error) {
    console.error("🔥 Error updating feedback status:", error);
    showErrorPanel("Failed to acknowledge feedback. Please try again.");
  }
};

// Load project details and teams when the page loads
document.addEventListener("DOMContentLoaded", () => {
  fetchProjectDetails();
  fetchTeams();
  displayFeedbacks();
});