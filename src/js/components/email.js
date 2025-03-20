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

async function reauthenticateUser(currentPassword) {
  const user = auth.currentUser;
  if (!user) {
    alert("No user is signed in.");
    return false;
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
    console.log("Re-authentication successful!");
    return true;
  } catch (error) {
    console.error("Re-authentication failed:", error.message);
    alert("Re-authentication failed. Please check your password.");
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
      alert("Error: Unknown user type.");
      return false;
    }

    const userRef = collection(db, collectionName);
    const userQuery = query(userRef, where("email", "==", oldEmail));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      for (const docSnap of userSnapshot.docs) {
        const userDocRef = doc(db, collectionName, docSnap.id);
        await updateDoc(userDocRef, { email: newEmail });
        console.log(`Email updated in ${collectionName}.`);
      }
      return true;
    } else {
      console.warn(`No user found in ${collectionName} with email ${oldEmail}.`);
      alert("No matching user found in Firestore.");
      return false;
    }
  } catch (error) {
    console.error("Error updating Firestore email:", error.message);
    alert("Error updating Firestore email: " + error.message);
    return false;
  }
}

function logoutUser() {
  window.parent.postMessage("closeIframe", "*");
  setTimeout(() => {
    toggleLoadingIndicator(true);
    setTimeout(() => {
      sessionStorage.clear();
      window.top.location.href = "../../index.html";
    }, 1500);
  }, 500);
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

document.addEventListener("DOMContentLoaded", () => {
  const confirmModal = document.getElementById("confirmModal");
  const modalEmail = document.getElementById("modalEmail");
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  let formData = null;

  function showConfirmModal(email) {
    modalEmail.textContent = email;
    confirmModal.style.display = "flex";
  }

  function hideConfirmModal() {
    confirmModal.style.display = "none";
    formData = null;
  }

  const updateEmailForm = document.getElementById("updateEmailForm");
  if (updateEmailForm) {
    updateEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById("currentPassword").value;
      const newEmail = document.getElementById("newEmail").value;
      const user = auth.currentUser;

      if (!user) {
        alert("No user is signed in.");
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
      if (!formData) return;

      const reauthenticated = await reauthenticateUser(formData.currentPassword);
      if (!reauthenticated) {
        hideConfirmModal();
        return;
      }

      const firestoreUpdated = await updateFirestoreEmail(formData.oldEmail, formData.newEmail);
      if (!firestoreUpdated) {
        alert("Failed to update email in Firestore. Please try again.");
        hideConfirmModal();
        return;
      }

      try {
        await verifyBeforeUpdateEmail(auth.currentUser, formData.newEmail);
        console.log("Verification email sent!");
        alert(
          "A verification email has been sent to your new email. Please check your inbox and confirm it.\n\n" +
            "Once you verify your new email, you can log in using it.\n\n" +
            "You will now be logged out."
        );
        logoutUser();
      } catch (error) {
        console.error("Error sending verification email:", error.message);
        alert("Error: " + error.message);
      } finally {
        hideConfirmModal();
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