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
    event.returnValue = "";
  }
}

function formatPhoneNumber(input) {
  let cleanInput = input.replace(/\D/g, "");
  if (!cleanInput) return "";
  if (!cleanInput.startsWith("09")) {
    cleanInput = "09" + cleanInput;
  }
  if (cleanInput.length > 11) {
    cleanInput = cleanInput.slice(0, 11);
  }
  return cleanInput;
}

function validatePhoneNumber(input) {
  const formatted = formatPhoneNumber(input);
  return {
    success: formatted.length === 11,
    value: formatted,
    message:
      formatted.length === 11
        ? "Valid number"
        : "Number must be exactly 11 digits starting with 09",
  };
}

function showChoicePopup(message, onYes, onCancel) {
  const backdrop = document.createElement("div");
  backdrop.className = "choice-backdrop";

  const popup = document.createElement("div");
  popup.className = "choice-popup";

  const msg = document.createElement("p");
  msg.textContent = message;
  popup.appendChild(msg);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "button-container";

  const yesBtn = document.createElement("button");
  yesBtn.textContent = "Yes";
  yesBtn.className = "yes-btn";
  yesBtn.addEventListener("click", () => {
    document.body.removeChild(popup);
    document.body.removeChild(backdrop);
    if (onYes) onYes();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "cancel-btn";
  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(popup);
    document.body.removeChild(backdrop);
    if (onCancel) onCancel();
  });

  buttonContainer.appendChild(yesBtn);
  buttonContainer.appendChild(cancelBtn);
  popup.appendChild(buttonContainer);

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);
}

function showAlertPopup(message) {
  const backdrop = document.createElement("div");
  backdrop.className = "choice-backdrop";

  const popup = document.createElement("div");
  popup.className = "choice-popup";

  const msg = document.createElement("p");
  msg.textContent = message;
  popup.appendChild(msg);

  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.className = "yes-btn";
  okBtn.style.width = "100%";
  okBtn.addEventListener("click", () => {
    document.body.removeChild(popup);
    document.body.removeChild(backdrop);
  });

  popup.appendChild(okBtn);
  document.body.appendChild(backdrop);
  document.body.appendChild(popup);
}

function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;

  document.body.appendChild(successMessage);

  // Fade in
  successMessage.style.display = "block";
  setTimeout(() => {
    successMessage.style.opacity = "1";
  }, 5); // Small delay to trigger transition

  // Fade out after 4 seconds and reload
  setTimeout(() => {
    successMessage.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(successMessage);
      window.location.reload(); // Retain original functionality
    }, 400); // Match transition duration
  }, 4000); // Display for 4 seconds, matching the activity log
}

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

  const formElements = document.querySelectorAll("input, select, textarea");

  formElements.forEach((element) => {
    if (element.id === "contact") {
      element.addEventListener("input", (e) => {
        const result = validatePhoneNumber(e.target.value);
        e.target.value = result.value;
        isFormDirty = true;
      });
    } else {
      element.addEventListener("change", () => {
        if (element.type === "file") {
          if (element.files.length > 0) {
            isFormDirty = true;
          }
        } else {
          isFormDirty = true;
        }
      });
    }
  });

  document.getElementById("close-button").addEventListener("click", (e) => {
    if (isFormDirty) {
      showChoicePopup(
        "You have unsaved changes. Are you sure you want to close?",
        () => {
          window.removeEventListener("beforeunload", warnUnsavedChanges);
          isFormDirty = false;
          window.history.back();
        },
        () => {
          e.preventDefault();
        }
      );
    } else {
      window.removeEventListener("beforeunload", warnUnsavedChanges);
      isFormDirty = false;
      window.history.back();
    }
  });

  document
    .getElementById("profile_picture")
    .addEventListener("change", handleFileSelect);
  document
    .getElementById("remove-file")
    .addEventListener("click", removeProfilePicture);

  const removeFileButton = document.getElementById("remove-file");
  const fileInput = document.getElementById("profile_picture");

  removeFileButton.style.display = "none";
  fileInput.addEventListener("change", handleFileSelect);
  removeFileButton.addEventListener("click", removeProfilePicture);

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

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  document
    .getElementById("update-button")
    .addEventListener("click", async (e) => {
      e.preventDefault();

      if (!isFormDirty) {
        showAlertPopup("No changes made to update.");
        return;
      }

      await updateUserData(db, storage, userDocRef, auth);
      isFormDirty = false;
    });
});

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

function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    const field = document.getElementById(key);
    if (field) {
      if (key === "contact" && value) {
        field.value = formatPhoneNumber(value);
      } else {
        field.value = value;
      }
    }
  }

  const barangayField = document.getElementById("barangay");
  if (barangayField && data.barangay_name) {
    barangayField.value = data.barangay_name;
  }

  updateProfilePicture(data.user_picture, data.user_name);
  adjustUsernameField(data.user_type, data.user_name, data.farmer_id);
}

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

function handleFileSelect(event) {
  const file = event.target.files[0];
  const imgElement = document.getElementById("profile-picture");
  const removeFileButton = document.getElementById("remove-file");

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (imgElement.src = e.target.result);
    reader.readAsDataURL(file);
    removeFileButton.style.display = "inline";
    isFormDirty = true;
  } else {
    removeFileButton.style.display = "none";
  }
}

import { getDoc } from "firebase/firestore";

async function removeProfilePicture() {
  const imgElement = document.getElementById("profile-picture");
  const removeFileBtn = document.getElementById("remove-file");
  const fileInput = document.getElementById("profile_picture");

  fileInput.value = "";

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

  removeFileBtn.style.display = "none";

  if (fileInput.value === "") {
    isFormDirty = false;
  }
}

async function updateUserData(db, storage, userDocRef, auth) {
  const updateButton = document.getElementById("update-button");

  try {
    updateButton.disabled = true;
    updateButton.textContent = "Updating...";

    const user = auth.currentUser;
    if (!user) throw new Error("User is not authenticated!");

    const contactInput = document.getElementById("contact");
    const contactValue = contactInput.value.trim();
    const contactValidation = validatePhoneNumber(contactValue);

    if (!contactValidation.success) {
      showAlertPopup(contactValidation.message);
      updateButton.disabled = false;
      updateButton.textContent = "Update";
      return;
    }

    if (!contactValue) {
      showAlertPopup("Contact number cannot be empty.");
      updateButton.disabled = false;
      updateButton.textContent = "Update";
      return;
    }

    const updatedData = {
      contact: contactValidation.value,
    };

    const profilePictureInput = document.getElementById("profile_picture");
    if (profilePictureInput.files.length > 0) {
      updatedData.user_picture = await uploadProfilePicture(
        storage,
        user.uid,
        profilePictureInput.files[0]
      );
    }

    return new Promise((resolve) => {
      showChoicePopup(
        "Are you sure you want to update your profile?",
        async () => {
          await updateDoc(userDocRef, updatedData);

          if (updatedData.user_picture) {
            sessionStorage.setItem("userPicture", updatedData.user_picture);
          }

          window.removeEventListener("beforeunload", warnUnsavedChanges);
          isFormDirty = false;

          showSuccessPanel("Profile updated successfully!");
          resolve();
        },
        () => {
          updateButton.disabled = false;
          updateButton.textContent = "Update";
          resolve();
        }
      );
    });
  } catch (error) {
    console.error("Error updating user data:", error);
    displayError("Error updating profile. Please try again.");
  } finally {
    updateButton.disabled = false;
    updateButton.textContent = "Update";
  }
}

async function uploadProfilePicture(storage, userId, file) {
  const fileRef = ref(storage, `profile_pictures/${userId}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

function displayError(message) {
  showAlertPopup(message);
  const errorMessage = document.getElementById("error-message");
  if (errorMessage) errorMessage.textContent = message;
}