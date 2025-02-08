import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../config/firebase_config.js"; // Firebase configuration

const auth = getAuth(app);
const firestore = getFirestore(app);

// User type to redirect mapping
const userTypeRoutes = {
  Admin: "../../public/landing_pages/admin/admin_navbar.html",
  Supervisor: "../../public/landing_pages/supervisor/supervisor_navbar.html",
  "Farm President":
    "../../public/landing_pages/farm_president/farmpres_navbar.html",
  "Head Farmer": "../../public/landing_pages/head_farmer/headfarm_nav.html",
  Farmer: "../../public/landing_pages/farmers/farmers_nav.html",
};

// Redirect user based on their role
function redirectUser(userType) {
  const path = userTypeRoutes[userType];
  if (path) {
    window.location.href = path;
  } else {
    alert("Unknown user type.");
  }
}

// Display or hide the loading indicator
function toggleLoadingIndicator(isLoading) {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = isLoading ? "flex" : "none";
  } else {
    console.error("Loading indicator not found");
  }
}

// Firebase authentication error handler
function getAuthErrorMessage(code) {
  const errorMessages = {
    "auth/user-not-found": "No user found with this email address.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests":
      "Too many failed login attempts. Please try again later.",
    default: "An unexpected error occurred. Please try again.",
  };
  return errorMessages[code] || errorMessages.default;
}

// Ensure loading indicator is hidden initially
document.addEventListener("DOMContentLoaded", () => {
  toggleLoadingIndicator(false);

  // Password visibility toggle
  const togglePasswordButton = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

  togglePasswordButton.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;

    // Toggle eye icon
    const eyeIcon = togglePasswordButton.querySelector("i");
    eyeIcon.classList.toggle("fa-eye-slash", type === "text");
    eyeIcon.classList.toggle("fa-eye", type === "password");
  });
});

// Login form event listener
const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleLoadingIndicator(true);

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    console.log("Authenticating user...");
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    sessionStorage.setItem("userEmail", user.email);

    console.log("Checking Firestore for user data...");

    // Step 1: Check in tb_farmers
    const farmersRef = collection(firestore, "tb_farmers");
    const farmersQuery = query(farmersRef, where("email", "==", email));
    const farmersSnapshot = await getDocs(farmersQuery);

    if (!farmersSnapshot.empty) {
      const farmerData = farmersSnapshot.docs[0].data();
      console.log("User found in tb_farmers:", farmerData);
      if (farmerData.user_type) {
        redirectUser(farmerData.user_type);
        return;
      }
    }

    // Step 2: Check in tb_users
    console.log("User not found in tb_farmers. Checking tb_users...");
    const usersRef = collection(firestore, "tb_users");
    const usersQuery = query(usersRef, where("email", "==", email));
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userData = usersSnapshot.docs[0].data();
      console.log("User found in tb_users:", userData);
      if (userData.user_type) {
        redirectUser(userData.user_type);
        return;
      }
    }

    // If user is not found in both collections
    alert("User data not found.");
  } catch (error) {
    alert(`Login failed: ${getAuthErrorMessage(error.code)}`);
  } finally {
    toggleLoadingIndicator(false);
  }
});

// Add loading indicator dynamically
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
