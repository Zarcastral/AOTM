import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../config/firebase_config.js"; // Firebase configuration
import { toggleLoadingIndicator } from "./loading.js"; // Import loading.js

const auth = getAuth(app);
const firestore = getFirestore(app);

const userTypeRoutes = {
  Admin: "../../public/landing_pages/admin/admin_navbar.html",
  Supervisor: "../../public/landing_pages/supervisor/supervisor_navbar.html",
  "Farm President":
    "../../public/landing_pages/farm_president/farmpres_navbar.html",
  "Head Farmer": "../../public/landing_pages/head_farmer/headfarm_nav.html",
  Farmer: "../../public/landing_pages/farmers/farmers_nav.html",
};

function redirectUser(userType) {
  const path = userTypeRoutes[userType];
  if (path) {
    window.location.href = path;
  } else {
    showErrorModal("Incorrect username or password."); // Generic message
  }
}

// Always show the same error message to prevent revealing valid emails
function showErrorModal() {
  let errorModal = document.getElementById("error-modal");

  if (!errorModal) {
    errorModal = document.createElement("div");
    errorModal.id = "error-modal";
    errorModal.style.cssText = `
      display:none;
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.5);
      z-index:9999;
      display:flex;
      justify-content:center;
      align-items:center;
    `;
    errorModal.innerHTML = `
      <div style="background-color:white;padding:20px;border-radius:10px;width:300px;text-align:center;">
        <h2 style="color:red;">Login Error</h2>
        <p>Incorrect username or password.</p>
        <button id="close-error-modal" style="padding:10px 20px;background-color:red;color:white;border:none;border-radius:5px;cursor:pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(errorModal);

    document
      .getElementById("close-error-modal")
      .addEventListener("click", () => {
        errorModal.style.display = "none";
      });
  }

  errorModal.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
  const errorModal = document.getElementById("error-modal");
  const loadingIndicator = document.getElementById("loading-indicator");

  if (errorModal) errorModal.style.display = "none";
  if (loadingIndicator) loadingIndicator.style.display = "none";

  const togglePasswordButton = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

  if (togglePasswordButton && passwordInput) {
    togglePasswordButton.addEventListener("click", () => {
      const type = passwordInput.type === "password" ? "text" : "password";
      passwordInput.type = type;

      const eyeIcon = togglePasswordButton.querySelector("i");
      eyeIcon.classList.toggle("fa-eye-slash", type === "text");
      eyeIcon.classList.toggle("fa-eye", type === "password");
    });
  }
});

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  toggleLoadingIndicator(true); // Show loading indicator

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    sessionStorage.setItem("userEmail", user.email);

    // First, try to fetch the user's data from tb_farmers
    const farmersRef = collection(firestore, "tb_farmers");
    const farmersQuery = query(farmersRef, where("email", "==", email));
    const farmersSnapshot = await getDocs(farmersQuery);

    if (!farmersSnapshot.empty) {
      const farmerData = farmersSnapshot.docs[0].data();
      if (farmerData.user_type) {
        // Store barangay, full name, and user picture
        sessionStorage.setItem("barangay_name", farmerData.barangay_name || "");
        const fullName = `${farmerData.first_name} ${farmerData.middle_name ? farmerData.middle_name + " " : ""}${farmerData.last_name}`.trim();
        sessionStorage.setItem("userFullName", fullName);
        sessionStorage.setItem("userPicture", farmerData.user_picture || "");
        redirectUser(farmerData.user_type);
        return;
      }
    }

    // If not found in tb_farmers, try tb_users
    const usersRef = collection(firestore, "tb_users");
    const usersQuery = query(usersRef, where("email", "==", email));
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userData = usersSnapshot.docs[0].data();
      if (userData.user_type) {
        sessionStorage.setItem("barangay_name", userData.barangay_name || "");
        sessionStorage.setItem("email", userData.email || "");
        const fullName = `${userData.first_name} ${userData.middle_name ? userData.middle_name + " " : ""}${userData.last_name}`.trim();
        sessionStorage.setItem("userFullName", fullName);
        sessionStorage.setItem("userPicture", userData.user_picture || "");
        redirectUser(userData.user_type);
        return;
      }
    }

    showErrorModal(); // Always show generic error
  } catch (error) {
    console.error("Login error:", error);
    showErrorModal(); // Always show generic error
  } finally {
    toggleLoadingIndicator(false); // Hide loading indicator
  }
});
