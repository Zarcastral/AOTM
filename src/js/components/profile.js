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

let isFormDirty = false;

function warnUnsavedChanges(event) {
  if (isFormDirty) {
    event.preventDefault();
    event.returnValue = ""; // Show browser warning
  }
}

// ✅ Attach the event on page load
window.addEventListener("beforeunload", warnUnsavedChanges);

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

  // ✅ Track form changes
  let isFormDirty = false;
  const formElements = document.querySelectorAll("input, select");

  formElements.forEach((element) => {
    element.addEventListener("change", () => {
      if (element.type === "file") {
        // ✅ Only mark as dirty if a new file is selected
        if (element.files.length > 0) {
          isFormDirty = true;
        }
      } else {
        isFormDirty = true;
      }
    });
  });

  // ✅ Handle Close button with confirmation
  document.getElementById("close-button").addEventListener("click", (e) => {
    if (isFormDirty) {
      const confirmClose = confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmClose) {
        e.preventDefault();
        return;
      }
    }

    // ✅ Ensure warning is removed before navigating
    window.removeEventListener("beforeunload", warnUnsavedChanges);
    isFormDirty = false; // ✅ Mark as clean when closing
    window.history.back();
  });

  // ✅ Handle Profile Picture Changes
  document
    .getElementById("profile_picture")
    .addEventListener("change", handleFileSelect);
  document
    .getElementById("remove-file")
    .addEventListener("click", removeProfilePicture);

  // ✅ Hide "Remove" button initially
  const removeFileButton = document.getElementById("remove-file");
  const fileInput = document.getElementById("profile_picture");

  removeFileButton.style.display = "none"; // Hide initially
  fileInput.addEventListener("change", handleFileSelect);
  removeFileButton.addEventListener("click", removeProfilePicture);

  // ✅ Image Zoom Functionality
  const profilePicture = document.getElementById("profile-picture");
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-image");
  const closeModal = document.querySelector(".close");

  if (profilePicture) {
    profilePicture.addEventListener("click", () => {
      if (!profilePicture.src || profilePicture.src.includes("default.jpg"))
        return;
      modal.style.display = "block";
      modalImg.src = profilePicture.src;
    });
  }

  if (closeModal) {
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  // ✅ Close modal when clicking outside the image
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // ✅ Handle Update button click
  document
    .getElementById("update-button")
    .addEventListener("click", async (e) => {
      e.preventDefault();
      await updateUserData(db, storage, userDocRef, auth);
      isFormDirty = false; // ✅ Reset after saving
    });
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

  document.getElementById("remove-file").style.display = imageUrl
    ? "inline"
    : "none";

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
  const removeFileButton = document.getElementById("remove-file");

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (imgElement.src = e.target.result);
    reader.readAsDataURL(file);
    removeFileButton.style.display = "inline"; // Show remove button
  } else {
    removeFileButton.style.display = "none"; // Hide if no file selected
  }
}

/**
 * Remove selected profile picture and reset to default.
 */
import { getDoc } from "firebase/firestore";

async function removeProfilePicture() {
  const imgElement = document.getElementById("profile-picture");
  const removeFileBtn = document.getElementById("remove-file");
  const fileInput = document.getElementById("profile_picture");

  // Clear the file input
  fileInput.value = "";

  // Refetch user data to get the original profile picture
  const userEmail = sessionStorage.getItem("userEmail");
  const userType = sessionStorage.getItem("user_type");
  const db = getFirestore(app);
  const collectionName = ["Admin", "Supervisor"].includes(userType)
    ? "tb_users"
    : "tb_farmers";

  try {
    const userDocRef = await fetchUserData(db, collectionName, userEmail);
    const userSnapshot = await getDoc(userDocRef);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      const originalImage =
        userData.user_picture || "../../../images/default.jpg";

      imgElement.src = originalImage;

      // ✅ Compare the restored image with the original
      if (fileInput.value === "" && imgElement.src === originalImage) {
        isFormDirty = false;
      }
    } else {
      imgElement.src = "../../../images/default.jpg";
    }
  } catch (error) {
    console.error("Error refetching user picture:", error);
    imgElement.src = "../../../images/default.jpg";
  }

  // Hide the remove button
  removeFileBtn.style.display = "none";

  // ✅ Manually reset form change tracking if unchanged
  if (fileInput.value === "") {
    isFormDirty = false;
  }
}

/**
 * Update user data in Firestore, including the profile picture if changed.
 */
async function updateUserData(db, storage, userDocRef, auth) {
  const updateButton = document.getElementById("update-button");

  try {
    updateButton.disabled = true; // ✅ Disable the button immediately
    updateButton.textContent = "Updating...";

    const user = auth.currentUser;
    if (!user) throw new Error("User is not authenticated!");

    const contactInput = document.getElementById("contact");
    const contactValue = contactInput.value.trim();

    // ✅ Prevent updating if contact is empty or null
    if (!contactValue) {
      alert("Contact number cannot be empty.");
      updateButton.disabled = false; // ✅ Re-enable the button if validation fails
      updateButton.textContent = "Update";
      return;
    }

    const updatedData = {
      contact: contactValue,
    };

    const profilePictureInput = document.getElementById("profile_picture");
    if (profilePictureInput.files.length > 0) {
      updatedData.user_picture = await uploadProfilePicture(
        storage,
        user.uid,
        profilePictureInput.files[0]
      );
    }

    // ✅ Confirm before updating
    if (!confirm("Are you sure you want to update your profile?")) {
      updateButton.disabled = false; // ✅ Re-enable if user cancels
      updateButton.textContent = "Update";
      return;
    }

    // ✅ Update Firestore
    await updateDoc(userDocRef, updatedData);

    // ✅ Store image in sessionStorage only if updated
    if (updatedData.user_picture) {
      sessionStorage.setItem("userPicture", updatedData.user_picture);
    }

    // ✅ Remove unsaved changes warning before reload
    window.removeEventListener("beforeunload", warnUnsavedChanges);
    isFormDirty = false;

    alert("Profile updated successfully!");

    // ✅ Reload safely
    window.location.reload();
  } catch (error) {
    console.error("Error updating user data:", error);
    displayError("Error updating profile. Please try again.");
  } finally {
    updateButton.disabled = false; // ✅ Ensure re-enabling in case of error
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
  alert(message); // Show an alert for critical errors
  const errorMessage = document.getElementById("error-message");
  if (errorMessage) errorMessage.textContent = message;
}
