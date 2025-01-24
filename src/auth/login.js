// In login.js, import Firebase services using npm package
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import {
  getAuthErrorMessage,
  redirectUser,
  toggleLoadingIndicator,
} from "./utils.js";

// Firebase configuration from firebase_config.js
import app from "../config/firebase_config.js"; // Path to firebase_config.js

// Initialize Firebase app and get Firebase services
const auth = getAuth(app);
const firestore = getFirestore(app);

// Ensure loading indicator is hidden initially
document.addEventListener("DOMContentLoaded", () => {
  toggleLoadingIndicator(false);
});

// Check if the user is already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`Already logged in: ${user.email}`);
    sessionStorage.setItem("userEmail", user.email);
  }
});

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  toggleLoadingIndicator(true);

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Sign in with Firebase Authentication
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      sessionStorage.setItem("userEmail", user.email);

      const usersRef = collection(firestore, "tb_users");
      const q = query(usersRef, where("email", "==", email));

      return getDocs(q);
    })
    .then((querySnapshot) => {
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        redirectUser(userData.user_type); // Redirect user based on their user type
      } else {
        alert("User data not found.");
      }
    })
    .catch((error) => {
      alert(`Login failed: ${getAuthErrorMessage(error.code)}`);
    })
    .finally(() => {
      toggleLoadingIndicator(false);
    });
});
