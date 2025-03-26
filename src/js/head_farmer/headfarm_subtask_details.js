// Import Firebase Firestore functions
import { getFirestore } from "firebase/firestore";
import app from "../../config/firebase_config.js";

// Initialize Firestore
const db = getFirestore(app);

// Function to initialize the subtask details page
export function initializeSubtaskDetailsPage() {
  document.addEventListener("DOMContentLoaded", () => {
    // Retrieve data from sessionStorage
    const subtaskName =
      sessionStorage.getItem("subtask_name") || "Unnamed Subtask";
    const projectTaskId = sessionStorage.getItem("project_task_id");
    const subtaskIndex = sessionStorage.getItem("subtask_index");

    // Debug log to verify retrieval
    console.log("Retrieved from sessionStorage:", {
      subtaskName,
      projectTaskId,
      subtaskIndex,
    });

    // Update the task name in the HTML
    const taskNameElement = document.getElementById("taskName");
    if (taskNameElement) {
      taskNameElement.textContent = subtaskName;
    } else {
      console.error("Element with ID 'taskName' not found.");
    }

    // Back button navigation
    const backButton = document.querySelector(".back-btn");
    if (backButton) {
      backButton.addEventListener("click", () => {
        window.location.href = "headfarm_subtask.html";
      });
    }

    // Navigate to headfarm_attendance.html when the eye icon is clicked
    const eyeIcons = document.querySelectorAll(".action-icons img[alt='View']");
    eyeIcons.forEach((eyeIcon) => {
      eyeIcon.addEventListener("click", () => {
        window.location.href = "headfarm_attendance.html";
      });
    });
  });
}

// Call the initialization function
initializeSubtaskDetailsPage();
