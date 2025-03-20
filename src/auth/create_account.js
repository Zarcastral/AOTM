import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import app from "../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const usernameError = document.getElementById("usernameError");
const farmerIdError = document.getElementById("farmerIdError");
const emailInput = document.getElementById("email");
const emailError = document.getElementById("emailError");

// Form Elements
const form = document.getElementById("createAccountForm");
const userTypeSelect = document.getElementById("user_type");
const barangaySelect = document.getElementById("barangay");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const profilePictureInput = document.getElementById("profilePicture");
const profilePictureLabel = document.getElementById("profilePictureLabel");
const removeFileBtn = document.getElementById("remove-file");
const submitsButton = form.querySelector(".submit-btn");

// Role-based Fields
const adminFields = document.getElementById("adminFields");
const farmerFields = document.getElementById("farmerFields");
const usernameInput = document.getElementById("userName");
const farmerIdInput = document.getElementById("farmer_id");

// Error Popup Elements
const errorPopup = document.getElementById("errorPopup");
const popupMessage = document.getElementById("popupMessage");
const closePopup = document.getElementById("closePopup");

// Password Validation UI
const passwordChecks = {
  lowercaseCheck: /[a-z]/,
  uppercaseCheck: /[A-Z]/,
  numberCheck: /\d/,
  lengthCheck: /.{8,}/,
};

// Function to validate the form and control the submit button
function validateForm() {
  const userType = userTypeSelect.value;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const birthday = document.getElementById("birthday").value.trim();
  const sex = document.getElementById("sex").value;
  const barangay = barangaySelect.value;
  const profilePicture = profilePictureInput.files[0];
  const profilePictureError = document.getElementById("profilePictureError");

  let isValid = true;

  if (
    !userType ||
    !email ||
    !password ||
    !confirmPassword ||
    !firstName ||
    !lastName ||
    !contact ||
    !birthday ||
    !sex ||
    !barangay ||
    !profilePicture
  ) {
    isValid = false;
  }

  // Profile picture feedback
  if (!profilePicture) {
    profilePictureError.textContent = "❌ Please upload a profile picture.";
    profilePictureError.style.color = "red";
  } else {
    profilePictureError.textContent = "✅ Profile picture uploaded.";
    profilePictureError.style.color = "green";
  }

  submitsButton.disabled = !isValid;
}

// Function to update the file input label and "×" button visibility
function updateProfilePictureUI() {
  const file = profilePictureInput.files[0];
  if (file) {
    profilePictureLabel.textContent = file.name; // Show the file name
    removeFileBtn.style.display = "inline-block"; // Show the "×" button
  } else {
    profilePictureLabel.textContent = "Choose File"; // Reset label
    removeFileBtn.style.display = "none"; // Hide the "×" button
  }
  validateForm(); // Trigger form validation
}

// Event listener for file input change
profilePictureInput.addEventListener("change", updateProfilePictureUI);

// Event listener for the "×" button
removeFileBtn.addEventListener("click", () => {
  profilePictureInput.value = ""; // Clear the file input
  updateProfilePictureUI(); // Update the UI
});

const updatePasswordValidation = () => {
  Object.entries(passwordChecks).forEach(([id, regex]) => {
    document.getElementById(id).style.color = regex.test(passwordInput.value)
      ? "green"
      : "red";
  });
};

passwordInput.addEventListener("input", updatePasswordValidation);

// Fetch User Roles
const fetchUserRoles = async () => {
  userTypeSelect.innerHTML = `<option value="">Loading...</option>`;
  try {
    const rolesQuery = await getDocs(collection(db, "tb_user_type"));
    userTypeSelect.innerHTML = `<option value="">Select User Type</option>`;
    rolesQuery.forEach((doc) => {
      const user_type = doc.data().user_type;
      userTypeSelect.innerHTML += `<option value="${user_type}">${user_type}</option>`;
    });
  } catch (error) {
    console.error("Error fetching user user_types:", error);
  }
};

const contactInput = document.getElementById("contact");
const contactError = document.getElementById("contactError");

// Contact Number Validation
const validateContactNumber = () => {
  const contactValue = contactInput.value.trim();
  const contactRegex = /^09\d{9}$/; // Regex: Starts with '09' followed by 9 digits (Total: 11 digits)

  if (!contactRegex.test(contactValue)) {
    contactError.textContent =
      "❌ Contact number must be exactly 11 digits and start with '09'.";
    contactError.style.color = "red";
    return false;
  }

  contactError.textContent = "✅ Valid contact number.";
  contactError.style.color = "green";
  return true;
};

// Add event listener for real-time validation
contactInput.addEventListener("input", validateContactNumber);

// Fetch Barangays
const fetchBarangayList = async () => {
  try {
    const barangayQuery = await getDocs(collection(db, "tb_barangay"));
    barangaySelect.innerHTML = `<option value="">Select Barangay</option>`;
    barangayQuery.forEach((doc) => {
      const barangay_name = doc.data().barangay_name;
      barangaySelect.innerHTML += `<option value="${barangay_name}">${barangay_name}</option>`;
    });
  } catch (error) {
    console.error("Error fetching barangays:", error);
  }
};

// Dynamic Form Update
export function updateFormFields() {
  const userType = userTypeSelect.value;

  adminFields.classList.add("hidden");
  farmerFields.classList.add("hidden");

  if (userType === "Admin" || userType === "Supervisor") {
    adminFields.classList.remove("hidden");
    farmerIdInput.required = false;
    usernameInput.required = true;
  } else if (
    userType === "Farmer" ||
    userType === "Farm President" ||
    userType === "Head Farmer"
  ) {
    farmerFields.classList.remove("hidden");
    farmerIdInput.required = true;
    usernameInput.required = false;
  }
}

userTypeSelect.addEventListener("change", updateFormFields);

// Show Error Popup
const showError = (message) => {
  popupMessage.textContent = message;
  errorPopup.classList.remove("hidden");
};

closePopup.addEventListener("click", () => {
  errorPopup.classList.add("hidden");
});

// Upload Profile Picture to Firebase Storage
const uploadProfilePicture = async (file, userId) => {
  const storageRef = ref(storage, `profile_pictures/${userId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

const confirmPasswordError = document.getElementById("confirmPasswordError");
const passwordMatchMessage = document.getElementById("passwordMatchMessage");

const validateConfirmPassword = () => {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword === "") {
    confirmPasswordError.style.display = "none";
    passwordMatchMessage.style.display = "none";
    confirmPasswordInput.setCustomValidity("");
  } else if (password !== confirmPassword) {
    confirmPasswordError.style.display = "block";
    passwordMatchMessage.style.display = "none";
    confirmPasswordInput.setCustomValidity("Passwords do not match");
  } else {
    confirmPasswordError.style.display = "none";
    passwordMatchMessage.style.display = "block";
    confirmPasswordInput.setCustomValidity("");
  }

  validateForm();
};

passwordInput.addEventListener("input", validateConfirmPassword);
confirmPasswordInput.addEventListener("input", validateConfirmPassword);

// Debounce function to delay execution
function debounce(func, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailFormat(email) {
  if (!email || typeof email !== "string") {
    emailError.textContent = "";
    return false;
  }

  if (email.trim() === "") {
    emailError.textContent = "";
    return false;
  }

  if (!emailRegex.test(email)) {
    emailError.textContent = "❌ Invalid email format.";
    emailError.style.color = "red";
    return false;
  }

  emailError.textContent = "";
  return true;
}

async function checkEmailExists(email) {
  if (email.trim() === "") {
    emailError.textContent = "";
    return;
  }

  try {
    const userQuery = query(
      collection(db, "tb_users"),
      where("email", "==", email)
    );
    const querySnapshot = await getDocs(userQuery);

    if (!querySnapshot.empty) {
      emailError.textContent = "❌ Email is already in use.";
      emailError.style.color = "red";
    } else {
      emailError.textContent = "✅ Email is available to use.";
      emailError.style.color = "green";
    }
  } catch (error) {
    console.error("Error checking email:", error);
    emailError.textContent = "❌ Error checking email.";
    emailError.style.color = "red";
  }
}

let emailCheckTimeout;

emailInput.addEventListener("input", () => {
  clearTimeout(emailCheckTimeout);

  const email = emailInput.value.trim();

  if (email === "") {
    emailError.textContent = "";
    validateForm();
    return;
  }

  emailCheckTimeout = setTimeout(async () => {
    if (validateEmailFormat(email)) {
      await checkEmailExists(email);
    }
  }, 500);
});

const checkUsernameExists = debounce(async () => {
  const username = usernameInput.value.trim();

  if (!username) {
    usernameError.textContent = "";
    validateForm();
    return;
  }

  try {
    const usernameQuery = query(
      collection(db, "tb_users"),
      where("user_name", "==", username)
    );
    const querySnapshot = await getDocs(usernameQuery);

    if (!querySnapshot.empty) {
      usernameError.textContent = "❌ Username is already taken.";
      usernameError.style.color = "red";
    } else {
      usernameError.textContent = "✅ Username is available.";
      usernameError.style.color = "green";
    }
  } catch (error) {
    console.error("Error checking username:", error);
    usernameError.textContent = "Error checking username.";
    usernameError.style.color = "red";
  }

  validateForm();
}, 500);

usernameInput.addEventListener("input", checkUsernameExists);

const checkFarmerIdExists = debounce(async () => {
  const farmerId = farmerIdInput.value.trim();

  if (!farmerId) {
    farmerIdError.textContent = "";
    validateForm();
    return;
  }

  try {
    const farmerQuery = query(
      collection(db, "tb_farmers"),
      where("farmer_id", "==", farmerId)
    );
    const querySnapshot = await getDocs(farmerQuery);

    if (!querySnapshot.empty) {
      farmerIdError.textContent = "❌ Farmer ID is already in use.";
      farmerIdError.style.color = "red";
    } else {
      farmerIdError.textContent = "✅ Farmer ID is available.";
      farmerIdError.style.color = "green";
    }
  } catch (error) {
    console.error("Error checking Farmer ID:", error);
    farmerIdError.textContent = "Error checking Farmer ID.";
    farmerIdError.style.color = "red";
  }

  validateForm();
}, 500);

farmerIdInput.addEventListener("input", checkFarmerIdExists);

// Form Submission
if (!form.dataset.listenerAdded) {
  form.dataset.listenerAdded = "true";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("Form submission triggered");

    submitsButton.disabled = true;

    const userType = userTypeSelect.value;
    const email = document.getElementById("email").value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const firstName = document.getElementById("firstName").value;
    const middleName = document.getElementById("middleName").value;
    const lastName = document.getElementById("lastName").value;
    const contact = contactInput.value.trim();

    if (!validateContactNumber()) {
      submitsButton.disabled = false;
      return showError(
        "Invalid contact number. It must be exactly 11 digits and start with '09'."
      );
    }

    const birthday = document.getElementById("birthday").value;
    const sex = document.getElementById("sex").value;
    const barangay_name = barangaySelect.value;
    const profilePicture = profilePictureInput.files[0];

    let username = "";
    let farmerId = "";

    if (userType === "Admin" || userType === "Supervisor") {
      username = usernameInput.value.trim();
      if (!username) {
        submitsButton.disabled = false;
        return showError("Username is required for Admins and Supervisors.");
      }
      if (usernameError.textContent.includes("❌")) {
        submitsButton.disabled = false;
        return showError("Username is already taken. Please choose another.");
      }
    } else {
      farmerId = farmerIdInput.value.trim();
      if (!farmerId) {
        submitsButton.disabled = false;
        return showError(
          "Farmer ID is required for Farmers, Farm Presidents, and Head Farmers."
        );
      }
    }

    if (password !== confirmPassword) {
      submitsButton.disabled = false;
      return showError("Passwords do not match.");
    }

    try {
      console.log("Checking for existing user...");
      const userQuery = query(
        collection(db, "tb_users"),
        where("email", "==", email)
      );
      const querySnapshot = await getDocs(userQuery);

      if (!querySnapshot.empty) {
        submitsButton.disabled = false;
        return showError("Email is already registered.");
      }

      console.log("Creating user in Firebase Auth...");
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("User created with UID:", userCredential.user.uid);

      let profilePictureUrl = "";
      if (profilePicture) {
        console.log("Uploading profile picture...");
        profilePictureUrl = await uploadProfilePicture(
          profilePicture,
          userCredential.user.uid
        );
        console.log("Profile picture uploaded:", profilePictureUrl);
      }

      const userData = {
        user_picture: profilePictureUrl,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        contact,
        email,
        birthday,
        sex,
        user_type: userType,
        barangay_name: barangay_name,
      };

      if (userType === "Admin" || userType === "Supervisor") {
        userData.user_name = username;
        await setDoc(doc(db, "tb_users", userCredential.user.uid), userData);
      } else {
        userData.farmer_id = farmerId;
        await setDoc(doc(db, "tb_farmers", userCredential.user.uid), userData);
      }

      console.log("Account created successfully!");
      alert("Account created successfully!");

      // Reset form and UI
      form.reset();
      updateProfilePictureUI(); // Reset profile picture UI (label and "×" button)
      usernameError.textContent = "";
      farmerIdError.textContent = "";
      emailError.textContent = "";
      confirmPasswordError.style.display = "none";
      passwordMatchMessage.style.display = "none";
      contactError.textContent = ""; // Clear the "Valid contact number" message
      document.getElementById("profilePictureError").textContent = ""; // Clear the "Profile picture uploaded" message

      // Reset password validation indicators
      Object.entries(passwordChecks).forEach(([id]) => {
        document.getElementById(id).style.color = "";
      });

      submitsButton.disabled = true;
    } catch (error) {
      console.error("Error creating account:", error);
      showError(error.message);
      submitsButton.disabled = false; // Re-enable on error
    }
  });
}

// Add event listeners to trigger validation
emailInput.addEventListener("input", validateForm);
usernameInput.addEventListener("input", validateForm);
farmerIdInput.addEventListener("input", validateForm);
passwordInput.addEventListener("input", validateForm);
confirmPasswordInput.addEventListener("input", validateForm);
userTypeSelect.addEventListener("change", validateForm);
barangaySelect.addEventListener("change", validateForm);
profilePictureInput.addEventListener("change", validateForm);
contactInput.addEventListener("input", validateForm);

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchUserRoles();
  fetchBarangayList();
  updateProfilePictureUI(); // Initialize the file input UI
  validateForm(); // Set initial button state
});