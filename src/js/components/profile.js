import {
  collection,
  getDocs, doc, updateDoc,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
const storage = getStorage(app);

import app from "../../config/firebase_config.js"; // Ensure the correct Firebase config path

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);
  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  console.log("Session User Type:", userType);
  console.log("Session Email:", userEmail);

  if (!userType || !userEmail) {
    console.error("⚠️ Missing user session data. Ensure login sets these values.");
    return;
  }

  // Fetch and set barangay options
  await fetchBarangays(db);

  // Fetch user data from the appropriate Firestore collection
  if (["Admin", "Supervisor"].includes(userType)) {
    await fetchUserData(db, "tb_users", userEmail);
  } else if (["Farmer", "Farm President", "Head Farmer"].includes(userType)) {
    await fetchFarmerData(db, "tb_farmers", userEmail);
  } else {
    console.error("⚠️ Unknown user type.");
  }

  // Handle Profile Picture Selection & Removal
  setupProfilePictureHandler();
});

/**
 * Fetch all barangays from `tb_barangay` and populate the select dropdown.
 */
async function fetchBarangays(db) {
  try {
    const barangaySelect = document.getElementById("barangay");
    barangaySelect.innerHTML = `<option value="">Select Barangay</option>`; // Reset dropdown

    const barangayRef = collection(db, "tb_barangay");
    const querySnapshot = await getDocs(barangayRef);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = data.barangay_name;
      option.textContent = data.barangay_name;
      barangaySelect.appendChild(option);
    });

    console.log("✅ Barangay list loaded.");
  } catch (error) {
    console.error("❌ Error fetching barangays:", error);
  }
}

/**
 * Fetch user data from `tb_users` and populate form fields.
 */
async function fetchUserData(db, collectionName, email) {
  try {
    const usersRef = collection(db, collectionName);
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error("⚠️ No user record found.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log("User Data:", userData);
      fillFormFields(userData);
    });
  } catch (error) {
    console.error("❌ Error fetching user data:", error);
  }
}

/**
 * Fetch farmer data from `tb_farmers`, replace username with Farmer ID, and populate form fields.
 */
async function fetchFarmerData(db, collectionName, email) {
  try {
    const farmersRef = collection(db, collectionName);
    const q = query(farmersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error("⚠️ No farmer record found.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const farmerData = doc.data();
      console.log("Farmer Data:", farmerData);

      replaceUsernameWithFarmerId(farmerData.farmer_id);
      fillFormFields(farmerData);
    });
  } catch (error) {
    console.error("❌ Error fetching farmer data:", error);
  }
}

/**
 * Populates form fields dynamically based on fetched data.
 */
function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    let fieldId = key;

    // Map Firestore keys to form field IDs
    if (key === "barangay_name") fieldId = "barangay";
    if (key === "user_type") fieldId = "user_type";

    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value;

      // Select correct barangay in dropdown
      if (fieldId === "barangay") {
        const barangayOptions = field.options;
        for (let i = 0; i < barangayOptions.length; i++) {
          if (barangayOptions[i].value === value) {
            field.selectedIndex = i;
            break;
          }
        }
      }
    }
  }

  // Handle user profile picture if the field exists
  const userPictureField = document.getElementById("profile-picture");
  if (userPictureField && data.user_picture) {
    userPictureField.src = data.user_picture; // Assuming an `img` element
  }
}

/**
 * Replaces the username input with a readonly Farmer ID field.
 */
function replaceUsernameWithFarmerId(farmerId) {
  const usernameField = document.getElementById("user_name");
  if (!usernameField) {
    console.error("⚠️ Username field not found.");
    return;
  }

  usernameField.value = farmerId;
  usernameField.disabled = true;
}

/**
 * Handles profile picture selection and removal.
 */
function setupProfilePictureHandler() {
  const fileInput = document.getElementById("profile_picture");
  const removeButton = document.getElementById("remove-file");

  fileInput.addEventListener("change", async function () {
    if (fileInput.files.length > 0) {
      console.log("✅ File selected:", fileInput.files[0].name);
      removeButton.style.display = "inline"; // Show remove button

      // Upload the file and get the download URL
      const userId = sessionStorage.getItem("userEmail"); // Assuming email is the unique ID
      try {
        const profileUrl = await uploadProfilePicture(fileInput.files[0], userId);
        sessionStorage.setItem("profile_picture", profileUrl); // Store it temporarily
        console.log("✅ Profile picture uploaded:", profileUrl);
      } catch (error) {
        console.error("❌ Failed to upload profile picture:", error);
      }
    }
  });

  removeButton.addEventListener("click", function () {
    fileInput.value = ""; // Clear file input
    removeButton.style.display = "none"; // Hide remove button
    sessionStorage.removeItem("profile_picture"); // Remove temp storage
    console.log("🗑️ File selection cleared.");
  });
}


async function uploadProfilePicture(file, userId) {
  try {
    const storageRef = ref(storage, `profile_pictures/${userId}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("❌ Error uploading profile picture:", error);
    throw error;
  }
}

async function updateUserProfile(userId, updatedData) {
  try {
    const userRef = doc(db, "tb_users", userId);
    await updateDoc(userRef, updatedData);
    console.log("✅ Profile updated successfully!");
    alert("✅ Profile updated successfully!");
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    alert("❌ Failed to update profile.");
  }
}

document.getElementById("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault(); // Prevent default form submission

  const userId = sessionStorage.getItem("userEmail"); // Assuming email is used as ID
  const profileUrl = sessionStorage.getItem("profile_picture") || ""; // Get uploaded URL

  // Collect updated user details
  const updatedData = {
    full_name: document.getElementById("full_name").value,
    contact_number: document.getElementById("contact_number").value,
    barangay_name: document.getElementById("barangay").value,
    user_picture: profileUrl, // Update profile picture URL
  };

  try {
    await updateUserProfile(userId, updatedData);
  } catch (error) {
    console.error("❌ Profile update failed:", error);
  }
});

