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

import app from "../config/firebase_config.js"; // Path to firebase_config.js

const auth = getAuth(app);
const firestore = getFirestore(app);

// Ensure loading indicator is hidden initially
document.addEventListener("DOMContentLoaded", () => {
  toggleLoadingIndicator(false);

  // Add event listener to toggle password visibility
  const togglePasswordButton = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

  togglePasswordButton.addEventListener("click", () => {
    // Toggle password visibility
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;

    // Toggle the eye icon (eye slash vs. eye)
    const eyeIcon = togglePasswordButton.querySelector("i");
    if (type === "password") {
      eyeIcon.classList.remove("fa-eye-slash");
      eyeIcon.classList.add("fa-eye");
    } else {
      eyeIcon.classList.remove("fa-eye");
      eyeIcon.classList.add("fa-eye-slash");
    }
  });
});

// Login logic
const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  toggleLoadingIndicator(true);

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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
