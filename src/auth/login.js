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
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Separate session storage keys for different tables
    let userType = "";
    let barangayName = "";
    let userFullName = "";
    let userPicture = "";
    let farmerId = ""; // Store farmer_id
    let sessionEmailKey = ""; // Separate session keys for tb_users and tb_farmers

    // Check in tb_farmers first
    const farmersRef = collection(firestore, "tb_farmers");
    const farmersQuery = query(farmersRef, where("email", "==", email));
    const farmersSnapshot = await getDocs(farmersQuery);

    if (!farmersSnapshot.empty) {
      const farmerData = farmersSnapshot.docs[0].data();
      userType = farmerData.user_type;
      barangayName = farmerData.barangay_name || "";
      userFullName = `${farmerData.first_name} ${
        farmerData.middle_name ? farmerData.middle_name + " " : ""
      }${farmerData.last_name}`.trim();
      userPicture = farmerData.user_picture || "";
      farmerId = farmerData.farmer_id || ""; // Store farmer_id
      sessionEmailKey = "farmerEmail"; // Unique session key for tb_farmers

      sessionStorage.setItem("farmerEmail", email);
      sessionStorage.setItem("user_type", userType);
      sessionStorage.setItem("barangay_name", barangayName);
      sessionStorage.setItem("userFullName", userFullName);
      sessionStorage.setItem("userPicture", userPicture);
      sessionStorage.setItem("farmer_id", farmerId); // Store farmer_id in session

      redirectUser(userType);
      return;
    }

    // If not found in tb_farmers, check in tb_users
    const usersRef = collection(firestore, "tb_users");
    const usersQuery = query(usersRef, where("email", "==", email));
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userData = usersSnapshot.docs[0].data();
      userType = userData.user_type;
      barangayName = userData.barangay_name || "";
      userFullName = `${userData.first_name} ${
        userData.middle_name ? userData.middle_name + " " : ""
      }${userData.last_name}`.trim();
      userPicture = userData.user_picture || "";
      sessionEmailKey = "userEmail"; // Unique session key for tb_users

      sessionStorage.setItem("userEmail", email);
      sessionStorage.setItem("user_type", userType);
      sessionStorage.setItem("barangay_name", barangayName);
      sessionStorage.setItem("userFullName", userFullName);
      sessionStorage.setItem("userPicture", userPicture);

      redirectUser(userType);
      return;
    }

    showErrorModal(); // Show generic error if email is not found in either table
  } catch (error) {
    console.error("Login error:", error);
    showErrorModal();
  } finally {
    toggleLoadingIndicator(false); // Hide loading indicator
  }
});
