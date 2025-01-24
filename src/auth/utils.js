// utils.js
// Centralized utility functions for reuse across the project

const userTypeRoutes = {
  Admin: "../../public/landing_pages/admin/admin_navbar.html",
  Supervisor: "../../public/landing_pages/supervisor.html",
  "Farm President": "../../public/farm-president-dashboard.html",
  "Head Farmer": "../../public/head-farmer-dashboard.html",
  Farmer: "../../public/landing_pages/farmer.html",
};

/**
 * Redirect the user based on their user type
 * @param {string} userType - The type of the user (e.g., Admin, Supervisor)
 */
export function redirectUser(userType) {
  const path = userTypeRoutes[userType];
  if (path) {
    window.location.href = path;
  } else {
    alert("Unknown user type.");
  }
}

/**
 * Show a loading indicator during async operations
 * @param {boolean} show - Whether to show or hide the loading indicator
 */
export function toggleLoadingIndicator(isLoading) {
  const loadingIndicator = document.getElementById("loading-indicator");

  if (loadingIndicator) {
    if (isLoading) {
      loadingIndicator.style.display = "flex"; // Show loading spinner
    } else {
      loadingIndicator.style.display = "none"; // Hide loading spinner
    }
  } else {
    console.error("Loading indicator not found");
  }
}

/**
 * Handle authentication error messages from Firebase
 * @param {string} code - Firebase error code
 * @returns {string} - User-friendly error message
 */
export function getAuthErrorMessage(code) {
  const errorMessages = {
    "auth/user-not-found": "No user found with this email address.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests":
      "Too many failed login attempts. Please try again later.",
    default: "An unexpected error occurred. Please try again.",
  };
  return errorMessages[code] || errorMessages.default;
}

// --- Example of adding loading indicator HTML dynamically ---
const loaderHtml = `
  <div id="loading-indicator" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;justify-content:center;align-items:center;">
    <div style="width:50px;height:50px;border:5px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
  </div>
  <style>
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
`;
document.body.insertAdjacentHTML("beforeend", loaderHtml);
