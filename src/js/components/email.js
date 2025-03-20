import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { toggleLoadingIndicator } from "../../auth/loading.js";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const userType = sessionStorage.getItem("user_type");

async function checkEmailExists(newEmail) {
  try {
    const collectionsToCheck = ["tb_users", "tb_farmers"];
    for (const collectionName of collectionsToCheck) {
      const userRef = collection(db, collectionName);
      const userQuery = query(userRef, where("email", "==", newEmail));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        console.log(`Email ${newEmail} already exists in ${collectionName}`);
        return true;
      }
    }
    console.log(`Email ${newEmail} is available`);
    return false;
  } catch (error) {
    console.error("Error checking email existence:", error.message);
    showAlertModal("Error", "Failed to check email availability: " + error.message);
    return true; // Assume it exists to prevent proceeding on error
  }
}

async function reauthenticateUser(currentPassword) {
  const user = auth.currentUser;
  if (!user) {
    showAlertModal("Error", "No user is signed in.");
    return false;
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
    console.log("Re-authentication successful for user:", user.email);
    return true;
  } catch (error) {
    console.error("Re-authentication failed:", error.message);
    showAlertModal("Authentication Error", "Incorrect password. Please try again.");
    return false;
  }
}

async function updateFirestoreEmail(oldEmail, newEmail) {
  try {
    let collectionName = "";
    if (userType === "Admin" || userType === "Supervisor") {
      collectionName = "tb_users";
    } else if (["Farmer", "Head Farmer", "Farm President"].includes(userType)) {
      collectionName = "tb_farmers";
    } else {
      console.error("Invalid user_type:", userType);
      showAlertModal("Error", "Unknown user type.");
      return false;
    }

    const userRef = collection(db, collectionName);
    const userQuery = query(userRef, where("email", "==", oldEmail));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.warn(`No user found in ${collectionName} with email ${oldEmail}`);
      showAlertModal("Error", "User not found in database.");
      return false;
    }

    for (const docSnap of userSnapshot.docs) {
      const userDocRef = doc(db, collectionName, docSnap.id);
      await updateDoc(userDocRef, { email: newEmail });
      console.log(`Email updated in ${collectionName} for ID: ${docSnap.id}`);
    }
    return true;
  } catch (error) {
    console.error("Firestore update failed:", error.message);
    showAlertModal("Error", "Failed to update email in database: " + error.message);
    return false;
  }
}

function logoutUser() {
  console.log("Logging out user...");
  window.parent.postMessage("closeIframe", "*");
  toggleLoadingIndicator(true);
  setTimeout(() => {
    sessionStorage.clear();
    window.top.location.href = "../../index.html";
  }, 2000); // Increased timeout to ensure loading indicator shows
}

function togglePassword() {
  const passwordInput = document.getElementById("currentPassword");
  const eyeIcon = document.querySelector(".eye-icon");
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.classList.remove("fa-eye");
    eyeIcon.classList.add("fa-eye-slash");
  } else {
    passwordInput.type = "password";
    eyeIcon.classList.remove("fa-eye-slash");
    eyeIcon.classList.add("fa-eye");
  }
}

function showAlertModal(title, message) {
  const alertModal = document.getElementById("alertModal");
  const alertTitle = document.getElementById("alertTitle");
  const alertMessage = document.getElementById("alertMessage");
  
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertModal.style.display = "flex";
}

function hideAlertModal() {
  const alertModal = document.getElementById("alertModal");
  alertModal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const confirmModal = document.getElementById("confirmModal");
  const modalEmail = document.getElementById("modalEmail");
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const alertOkBtn = document.getElementById("alertOkBtn");
  let formData = null;

  function showConfirmModal(email) {
    modalEmail.textContent = email;
    confirmModal.style.display = "flex";
    confirmBtn.disabled = false;
  }

  function hideConfirmModal() {
    confirmModal.style.display = "none";
    formData = null;
  }

  if (alertOkBtn) {
    alertOkBtn.addEventListener("click", hideAlertModal);
  }

  const updateEmailForm = document.getElementById("updateEmailForm");
  if (updateEmailForm) {
    updateEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById("currentPassword").value;
      const newEmail = document.getElementById("newEmail").value;
      const user = auth.currentUser;

      if (!user) {
        showAlertModal("Error", "No user is signed in.");
        return;
      }

      if (user.email === newEmail) {
        showAlertModal("Error", "New email cannot be the same as the current email.");
        return;
      }

      const emailExists = await checkEmailExists(newEmail);
      if (emailExists) {
        showAlertModal("Error", "This email is already in use. Please choose a different email.");
        return;
      }

      formData = { currentPassword, newEmail, oldEmail: user.email };
      showConfirmModal(newEmail);
    });
  } else {
    console.error("Update email form not found in the DOM.");
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (!formData || confirmBtn.disabled) return;

      confirmBtn.disabled = true;
      toggleLoadingIndicator(true); // Show loading indicator

      // Step 1: Reauthenticate
      const reauthenticated = await reauthenticateUser(formData.currentPassword);
      if (!reauthenticated) {
        hideConfirmModal();
        confirmBtn.disabled = false;
        toggleLoadingIndicator(false);
        return;
      }

      // Step 2: Update Firestore
      const firestoreUpdated = await updateFirestoreEmail(formData.oldEmail, formData.newEmail);
      if (!firestoreUpdated) {
        hideConfirmModal();
        confirmBtn.disabled = false;
        toggleLoadingIndicator(false);
        return;
      }

      // Step 3: Send verification email
      try {
        await verifyBeforeUpdateEmail(auth.currentUser, formData.newEmail);
        console.log("Verification email sent to:", formData.newEmail);
        showAlertModal(
          "Email Verification",
          "A verification email has been sent to your new email.\n\n"+ "Please verify it to complete the update.\n\n" +
            "You will be logged out now."
        );
        alertOkBtn.addEventListener("click", () => {
          logoutUser();
        }, { once: true });
      } catch (error) {
        console.error("Error sending verification email:", error.message);
        showAlertModal("Error", "Failed to send verification email: " + error.message);
        // Revert Firestore change if verification fails (optional rollback)
        await updateFirestoreEmail(formData.newEmail, formData.oldEmail);
        console.log("Reverted Firestore email to:", formData.oldEmail);
      } finally {
        hideConfirmModal();
        confirmBtn.disabled = false;
        toggleLoadingIndicator(false);
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", hideConfirmModal);
  }

  const eyeIcon = document.querySelector(".eye-icon");
  if (eyeIcon) {
    eyeIcon.addEventListener("click", togglePassword);
  } else {
    console.error("Eye icon not found in the DOM.");
  }
});