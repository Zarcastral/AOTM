// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0pdy75p4D21Nz1JyFKHQxVNyh60U8yVA",
  authDomain: "operation-and-task-management.firebaseapp.com",
  projectId: "operation-and-task-management",
  storageBucket: "operation-and-task-management.firebasestorage.app",
  messagingSenderId: "182897367112",
  appId: "1:182897367112:web:600d924a446ae220fba07d",
  measurementId: "G-C91Z5709N5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Reset password form
const resetForm = document.getElementById("reset-password-form");

resetForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;

  // Send password reset email
  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("Password reset email sent!");
      window.location.href = "index.html";
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert(`Error: ${errorMessage}`);
    });
});
