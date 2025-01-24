// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Import utility functions
import {
  getAuthErrorMessage,
  redirectUser,
  toggleLoadingIndicator,
} from "./utils.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0pdy75p4D21Nz1JyFKHQxVNyh60U8yVA",
  authDomain: "operation-and-task-management.firebaseapp.com",
  projectId: "operation-and-task-management",
  storageBucket: "operation-and-task-management.appspot.com",
  messagingSenderId: "182897367112",
  appId: "1:182897367112:web:600d924a446ae220fba07d",
  measurementId: "G-C91Z5709N5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Ensure loading indicator is hidden initially
document.addEventListener("DOMContentLoaded", () => {
  toggleLoadingIndicator(false); // Hide spinner on load
});

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`Already logged in: ${user.email}`);
    sessionStorage.setItem("userEmail", user.email);
  }
});

// Handle login form submission
const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault(); // Prevent page reload

  // Show loading indicator
  toggleLoadingIndicator(true);

  // Get email and password values from the form
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Authenticate with Firebase
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user; // The authenticated user
      console.log(`Welcome ${user.email}`);

      // Save the user's email to sessionStorage
      sessionStorage.setItem("userEmail", user.email);

      // Access Firestore and check the user data
      const usersRef = collection(firestore, "tb_users");
      const q = query(usersRef, where("email", "==", email));

      return getDocs(q);
    })
    .then((querySnapshot) => {
      // Check if any documents match the email
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data(); // Get the first matching document
        const userType = userData.user_type; // Get the user type

        // Redirect the user based on their user_type
        redirectUser(userType);
      } else {
        // If no user data found for this email in Firestore
        console.log("No data found for this user.");
        alert("User data not found.");
      }
    })
    .catch((error) => {
      // Handle errors from Firebase authentication
      const errorMessage = getAuthErrorMessage(error.code);
      alert(`Login failed: ${errorMessage}`);
    })
    .finally(() => {
      // Hide loading indicator after operation
      toggleLoadingIndicator(false);
    });
});
