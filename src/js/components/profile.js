import {
  collection,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import app from "../../config/firebase_config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);
  const storage = getStorage(app);

  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  if (!userType || !userEmail) return;

  const collectionName = ["Admin", "Supervisor"].includes(userType)
    ? "tb_users"
    : "tb_farmers";

  const userDocRef = await fetchUserData(db, collectionName, userEmail);

  const updateButton = document.getElementById("update-button");
  updateButton.addEventListener("click", async (e) => {
    e.preventDefault();
    await updateUserData(db, storage, userDocRef);
  });

  document
    .getElementById("close-button")
    .addEventListener("click", () => window.history.back());
});

/**
 * Fetch user data from Firestore and populate form fields.
 */
async function fetchUserData(db, collectionName, email) {
  try {
    const usersRef = collection(db, collectionName);
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("User not found");
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    fillFormFields(userData);

    return userDoc.ref; // Return the reference for updates
  } catch (error) {
    console.error("Error fetching user data:", error);
    displayError("Error loading user data.");
  }
}

/**
 * Populate form fields with user data, including barangay_name.
 */
function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    const field = document.getElementById(key);
    if (field) field.value = value;
  }

  // Display barangay_name
  const barangayField = document.getElementById("barangay");
  if (barangayField && data.barangay_name) {
    barangayField.value = data.barangay_name;
  }

  updateProfilePicture(data.user_picture, data.user_name);
}

/**
 * Set the user's profile picture with fallback on error.
 */
function updateProfilePicture(imageUrl, userName) {
  const profilePictureField = document.getElementById("profile-picture");

  if (!profilePictureField) return;

  const defaultImage = "../../../images/default.jpg";
  profilePictureField.src = imageUrl || defaultImage;
  profilePictureField.alt = `${userName || "User"}'s Profile Picture`;

  profilePictureField.addEventListener("error", () => {
    profilePictureField.src = defaultImage;
  });
}

/**
 * Update the user data in Firestore.
 */
async function updateUserData(db, storage, userDocRef) {
  try {
    const updatedData = {
      contact: document.getElementById("contact").value,
      email: document.getElementById("email").value,
    };

    const profilePictureInput = document.getElementById("profile_picture");
    if (profilePictureInput.files.length > 0) {
      const imageUrl = await uploadProfilePicture(
        storage,
        userDocRef.id,
        profilePictureInput.files[0]
      );
      updatedData.user_picture = imageUrl;
    }

    // Update Firestore record
    await updateDoc(userDocRef, updatedData);

    alert("Profile updated successfully!");

    // Fetch updated data to refresh barangay_name
    await fetchUserData(db, userDocRef.parent.id, updatedData.email);
  } catch (error) {
    console.error("Error updating user data:", error);
    displayError("Error updating profile. Please try again.");
  }
}

/**
 * Upload the profile picture to Firebase Storage.
 */
async function uploadProfilePicture(storage, userId, file) {
  const fileRef = ref(storage, `profile_pictures/${userId}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

/**
 * Display an error message to the user.
 */
function displayError(message) {
  const errorMessage = document.getElementById("error-message");
  if (errorMessage) errorMessage.textContent = message;
}
