// Import Firebase modules
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

// Firebase configuration from firebase_config.js
import app from "../config/firebase_config.js";

// Initialize Firebase app and get Firebase services
const auth = getAuth(app);

// Reset password form
const resetForm = document.getElementById("reset-password-form");

resetForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;

  // Send password reset email
  sendPasswordResetEmail(auth, email)
    .then(() => {
      // Successfully sent password reset email
      alert("Password reset email sent!");

      // Redirect to login page after successful email send
      window.location.href = "index.html";
    })
    .catch((error) => {
      const errorMessage = error.message;
      alert(`Error: ${errorMessage}`);
    });
});
