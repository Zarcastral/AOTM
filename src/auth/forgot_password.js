// Import Firebase modules
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

// Import utility functions
import { toggleLoadingIndicator } from "../auth/utils.js"; // Adjust the path as needed

// Firebase configuration from firebase_config.js
import app from "../config/firebase_config.js";

// Initialize Firebase app and get Firebase services
const auth = getAuth(app);

// Reset password form
const resetForm = document.getElementById("reset-password-form");

resetForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;

  // Show loading indicator
  toggleLoadingIndicator(true);

  // Send password reset email
  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("Password reset email sent!");
      window.location.href = "index.html"; // Redirect to login page
    })
    .catch((error) => {
      const errorMessage = error.message;
      alert(`Error: ${errorMessage}`);
    })
    .finally(() => {
      // Hide loading indicator after operation
      toggleLoadingIndicator(false);
    });
});
