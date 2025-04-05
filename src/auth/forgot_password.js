import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import app from "../config/firebase_config.js";

const auth = getAuth(app);

// Ensure DOM is ready before attaching event listeners
document.addEventListener("DOMContentLoaded", () => {
  const resetForm = document.getElementById("reset-password-form");

  if (!resetForm) {
    console.error("Reset password form not found!");
    return;
  }

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();

    if (!email) {
      showMessage("Please enter an email address.", false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      showMessage("Password reset email sent! Check your inbox.", true);
      setTimeout(() => {
        window.location.href = "/index.html"; // Adjust path if needed
      }, 2000); // Delay redirect for user to see message
    } catch (error) {
      console.error("Error sending password reset email:", error);
      const errorMessage =
        error.code === "auth/user-not-found"
          ? "No account found with this email."
          : "An error occurred. Please try again.";
      showMessage(errorMessage, false);
    }
  });
});

// Utility function to show success/error messages
function showMessage(message, isSuccess) {
  let messageBox = document.getElementById("message-box");

  if (!messageBox) {
    messageBox = document.createElement("div");
    messageBox.id = "message-box";
    messageBox.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 15px;
      border-radius: 5px;
      color: white;
      z-index: 1000;
      transition: opacity 0.5s;
    `;
    document.body.appendChild(messageBox);
  }

  messageBox.textContent = message;
  messageBox.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
  messageBox.style.opacity = "1";

  setTimeout(() => {
    messageBox.style.opacity = "0";
    setTimeout(() => {
      messageBox.remove();
    }, 500);
  }, 3000); // Hide after 3 seconds
}
