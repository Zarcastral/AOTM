import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);

  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  if (!userType || !userEmail) return;

  if (["Admin", "Supervisor"].includes(userType)) {
    await fetchUserData(db, "tb_users", userEmail);
  } else if (["Farmer", "Farm President", "Head Farmer"].includes(userType)) {
    await fetchUserData(db, "tb_farmers", userEmail);
  }
});

/**
 * Fetch user data from Firestore and populate form fields.
 */
async function fetchUserData(db, collectionName, email) {
  try {
    const usersRef = collection(db, collectionName);
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      fillFormFields(userData);
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }
}

/**
 * Populate form fields with user data.
 */
function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    let fieldId = key;

    // Map Firestore field names to form element IDs
    if (key === "barangay_name") fieldId = "barangay";
    if (key === "user_type") fieldId = "user_type";

    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value;
    }
  }

  // Set the profile picture
  updateProfilePicture(data.user_picture, data.user_name);
}

/**
 * Set the user's profile picture with a fallback on error.
 */
function updateProfilePicture(imageUrl, userName) {
  const profilePictureField = document.getElementById("profile-picture");

  if (!profilePictureField) return;

  const defaultImage = "../../../images/default.jpg";

  profilePictureField.src = imageUrl || defaultImage;
  profilePictureField.alt = `${userName || "User"}'s Profile Picture`;

  // Handle broken images by falling back to a default image
  profilePictureField.addEventListener("error", () => {
    profilePictureField.src = defaultImage;
  });
}
