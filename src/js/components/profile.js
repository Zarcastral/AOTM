import { getAuth } from "firebase/auth";
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
  const auth = getAuth(app);

  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  if (!userType || !userEmail) return;

  const collectionName = ["Admin", "Supervisor"].includes(userType)
    ? "tb_users"
    : "tb_farmers";

  const userDocRef = await fetchUserData(db, collectionName, userEmail);

  document
    .getElementById("profile_picture")
    .addEventListener("change", handleFileSelect);

  document
    .getElementById("update-button")
    .addEventListener("click", async (e) => {
      e.preventDefault();
      await updateUserData(db, storage, userDocRef, auth);
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
    fillFormFields(userDoc.data());
    return userDoc.ref;
  } catch (error) {
    console.error("Error fetching user data:", error);
    displayError("Error loading user data.");
  }
}

/**
 * Populate form fields with user data and adjust Username/Farmer Id.
 */
function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    const field = document.getElementById(key);
    if (field) field.value = value;
  }

  const barangayField = document.getElementById("barangay");
  if (barangayField && data.barangay_name) {
    barangayField.value = data.barangay_name;
  }

  updateProfilePicture(data.user_picture, data.user_name);
  adjustUsernameField(data.user_type, data.user_name, data.farmer_id);
}

/**
 * Adjust the Username field to show either 'Username' or 'Farmer Id'
 */
function adjustUsernameField(userType, userName, farmerId) {
  const usernameLabel = document.querySelector("label[for='user_name']");
  const usernameField = document.getElementById("user_name");

  if (["Farmer", "Farm President", "Head Farmer"].includes(userType)) {
    usernameLabel.textContent = "Farmer Id";
    usernameField.value = farmerId || "N/A";
  } else {
    usernameLabel.textContent = "Username";
    usernameField.value = userName;
  }
}

/**
 * Update the user's profile picture or show a default one.
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
 * Handle file selection and preview the uploaded image.
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  const imgElement = document.getElementById("profile-picture");

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (imgElement.src = e.target.result);
    reader.readAsDataURL(file);
  }
}

/**
 * Update user data in Firestore, including the profile picture if changed.
 */
/**
 * Update user data in Firestore, including the profile picture if changed.
 */
async function updateUserData(db, storage, userDocRef, auth) {
  const updateButton = document.getElementById("update-button");

  try {
    // Disable the update button during the update process
    updateButton.disabled = true;
    updateButton.textContent = "Updating...";

    const user = auth.currentUser;
    if (!user) throw new Error("User is not authenticated!");

    const updatedData = {
      contact: document.getElementById("contact").value,
      email: document.getElementById("email").value,
    };

    const profilePictureInput = document.getElementById("profile_picture");
    if (profilePictureInput.files.length > 0) {
      updatedData.user_picture = await uploadProfilePicture(
        storage,
        user.uid,
        profilePictureInput.files[0]
      );
    }

    // Update Firestore record
    await updateDoc(userDocRef, updatedData);

    alert("Profile updated successfully!");

    // Fetch updated data to refresh barangay_name
    await fetchUserData(db, userDocRef.parent.id, updatedData.email);
  } catch (error) {
    console.error("Error updating user data:", error);
    displayError("Error updating profile. Please try again.");
  } finally {
    // Re-enable the update button after alert is confirmed
    updateButton.disabled = false;
    updateButton.textContent = "Update";
  }
}

/**
 * Upload the profile picture to Firebase Storage and return the download URL.
 */
async function uploadProfilePicture(storage, userId, file) {
  const fileRef = ref(storage, `profile_pictures/${userId}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/**
 * Display an error message to the user.
 */
function displayError(message) {
  const errorMessage = document.getElementById("error-message");
  if (errorMessage) errorMessage.textContent = message;
}
