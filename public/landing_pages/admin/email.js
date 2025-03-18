import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  updateEmail,
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
import app from "../../../src/config/firebase_config.js"; // Import Firebase config

const auth = getAuth(app);
const db = getFirestore(app);

// Get user_type from session storage
const userType = sessionStorage.getItem("user_type");

// Function to re-authenticate user
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

// Function to update email in Firestore **before** sending verification email
async function updateFirestoreEmail(oldEmail, newEmail) {
  try {
    let collectionName = "";

    // Determine collection based on user_type
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
      userSnapshot.forEach(async (docSnap) => {
        const userDocRef = doc(db, collectionName, docSnap.id);
        await updateDoc(userDocRef, { email: newEmail });
        console.log(`Email updated in ${collectionName}.`);
        alert(`Your email has been successfully updated in ${collectionName}.`);
      });
      return true;
    } else {
      console.warn(
        `No user found in ${collectionName} with email ${oldEmail}.`
      );
      return false;
    }
  } catch (error) {
    console.error("Error updating Firestore email:", error.message);
    alert("Error updating Firestore email: " + error.message);
    return false;
  }
}

// Event listener for form submission
document
  .getElementById("updateEmailForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("currentPassword").value;
    const newEmail = document.getElementById("newEmail").value;
    const user = auth.currentUser;

    if (!user) {
      alert("No user is signed in.");
      return;
    }

    const oldEmail = user.email;

    // Step 1: Re-authenticate user
    const reauthenticated = await reauthenticateUser(currentPassword);
    if (!reauthenticated) return;

    // Step 2: Update Firestore email **before** changing it in Firebase Auth
    const firestoreUpdated = await updateFirestoreEmail(oldEmail, newEmail);
    if (!firestoreUpdated) {
      alert("Failed to update email in Firestore. Please try again.");
      return;
    }

    try {
      // Step 3: Send verification email
      await verifyBeforeUpdateEmail(user, newEmail);
      console.log("Verification email sent!");
      alert(
        "A verification email has been sent to your new email. Please check your inbox and confirm it."
      );

      // Step 4: Update email in Firebase Authentication
      await updateEmail(user, newEmail);
      console.log("Email successfully updated in Firebase Authentication!");
    } catch (error) {
      console.error("Error updating email:", error.message);
      alert("Error: " + error.message);
    }
  });
