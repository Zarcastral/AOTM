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
const form = document.getElementById("createAccountForm");
const userTypeSelect = document.getElementById("user_type");
const barangaySelect = document.getElementById("barangay");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const profilePictureInput = document.getElementById("profilePicture");
const removeFileBtn = document.getElementById("remove-file");
const submitsButton = form.querySelector(".submit-btn");
const adminFields = document.getElementById("adminFields");
const farmerFields = document.getElementById("farmerFields");
const usernameInput = document.getElementById("userName");
const farmerIdInput = document.getElementById("farmer_id");
const errorPopup = document.getElementById("errorPopup");
const popupMessage = document.getElementById("popupMessage");
const closePopup = document.getElementById("closePopup");
const contactInput = document.getElementById("contact");
const contactError = document.getElementById("contactError");

function showSuccessPanel(message) {
  const successMessage = document.createElement("div");
  successMessage.className = "success-message";
  successMessage.textContent = message;
  document.body.appendChild(successMessage);
  successMessage.style.display = "block";
  setTimeout(() => (successMessage.style.opacity = "1"), 5);
  setTimeout(() => {
    successMessage.style.opacity = "0";
    setTimeout(() => document.body.removeChild(successMessage), 400);
  }, 4000);
}

function showErrorPanel(message) {
  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent = message;
  document.body.appendChild(errorMessage);
  errorMessage.style.display = "block";
  setTimeout(() => (errorMessage.style.opacity = "1"), 5);
  setTimeout(() => {
    errorMessage.style.opacity = "0";
    setTimeout(() => document.body.removeChild(errorMessage), 400);
  }, 4000);
}

const passwordChecks = {
  lowercaseCheck: /[a-z]/,
  uppercaseCheck: /[A-Z]/,
  numberCheck: /\d/,
  lengthCheck: /.{8,}/,
};

function validateForm() {
  const userType = userTypeSelect.value;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  const firstName = document.getElementById("firstName")?.value.trim() || "";
  const lastName = document.getElementById("lastName")?.value.trim() || "";
  const contact = contactInput.value.trim();
  const birthday = document.getElementById("birthday")?.value || "";
  const sex = document.getElementById("sex")?.value || "";
  const barangay = barangaySelect.value;
  const profilePicture = profilePictureInput.files[0];
  const username = usernameInput.value.trim();
  const farmerId = farmerIdInput.value.trim();

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

  if (userType === "Admin" || userType === "Supervisor") {
    if (!username) isValid = false;
  } else if (
    userType === "Farmer" ||
    userType === "Farm President" ||
    userType === "Head Farmer"
  ) {
    if (!farmerId) isValid = false;
  }

  if (
    emailError.textContent.includes("❌") ||
    !emailError.textContent.includes("✅")
  )
    isValid = false;
  if (
    (usernameError.textContent.includes("❌") ||
      !usernameError.textContent.includes("✅")) &&
    username
  )
    isValid = false;
  if (
    (farmerIdError.textContent.includes("❌") ||
      !farmerIdError.textContent.includes("✅")) &&
    farmerId
  )
    isValid = false;
  if (
    contactError.textContent.includes("❌") ||
    !contactError.textContent.includes("✅")
  )
    isValid = false;

  if (!Object.values(passwordChecks).every((regex) => regex.test(password)))
    isValid = false;
  if (password !== confirmPassword) isValid = false;

  submitsButton.disabled = !isValid;
  return isValid;
}

function updateProfilePictureUI() {
  const file = profilePictureInput.files[0];
  const profilePictureError = document.getElementById("profilePictureError");

  if (file) {
    removeFileBtn.style.display = "inline-block";
    profilePictureError.textContent = "✅ Profile picture uploaded.";
    profilePictureError.style.color = "green";
  } else {
    removeFileBtn.style.display = "none";
    profilePictureError.textContent = profilePictureError.textContent.includes(
      "❌"
    )
      ? "❌ Please upload a profile picture."
      : "";
  }
  validateForm();
}

profilePictureInput.addEventListener("change", updateProfilePictureUI);

removeFileBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  profilePictureInput.value = "";
  const profilePictureError = document.getElementById("profilePictureError");
  profilePictureError.textContent = "❌ Please upload a profile picture.";
  profilePictureError.style.color = "red";
  updateProfilePictureUI();
  profilePictureInput.focus();
});

const updatePasswordValidation = () => {
  Object.entries(passwordChecks).forEach(([id, regex]) => {
    document.getElementById(id).style.color = regex.test(passwordInput.value)
      ? "green"
      : "red";
  });
  validateForm();
};

passwordInput.addEventListener("input", updatePasswordValidation);

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
    console.error("Error fetching user types:", error);
  }
  validateForm();
};

const validateContactNumber = () => {
  const contactValue = contactInput.value.trim();
  const contactRegex = /^09\d{9}$/;

  if (!contactRegex.test(contactValue)) {
    contactError.textContent =
      "❌ Contact number must be 11 digits starting with '09'.";
    contactError.style.color = "red";
  } else {
    contactError.textContent = "✅ Valid contact number.";
    contactError.style.color = "green";
  }
  validateForm();
};

contactInput.addEventListener("input", validateContactNumber);

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
  validateForm();
};

export function updateFormFields() {
  const userType = userTypeSelect.value;
  usernameInput.value = "";
  farmerIdInput.value = "";
  usernameError.textContent = "";
  farmerIdError.textContent = "";
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
  validateForm();
}

userTypeSelect.addEventListener("change", updateFormFields);

const showError = (message) => {
  popupMessage.textContent = message;
  errorPopup.classList.remove("hidden");
};

closePopup.addEventListener("click", () => {
  errorPopup.classList.add("hidden");
});

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

function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailFormat(email) {
  if (!email || typeof email !== "string" || email.trim() === "") {
    emailError.textContent = "";
    return false;
  }
  if (!emailRegex.test(email)) {
    emailError.textContent = "❌ Invalid email format.";
    emailError.style.color = "red";
    return false;
  }
  return true;
}

async function checkEmailExists(email) {
  if (!email || email.trim() === "") {
    emailError.textContent = "";
    return;
  }
  try {
    const userQuery = query(
      collection(db, "tb_users"),
      where("email", "==", email)
    );
    const farmerQuery = query(
      collection(db, "tb_farmers"),
      where("email", "==", email)
    );
    const [userSnapshot, farmerSnapshot] = await Promise.all([
      getDocs(userQuery),
      getDocs(farmerQuery),
    ]);

    if (!userSnapshot.empty || !farmerSnapshot.empty) {
      emailError.textContent = "❌ Email is already in use.";
      emailError.style.color = "red";
    } else {
      emailError.textContent = "✅ Email is available to use.";
      emailError.style.color = "green";
    }
  } catch (error) {
    console.error("Error checking email:", error);
    emailError.textContent = "❌ Error checking email availability.";
    emailError.style.color = "red";
  }
  validateForm();
}

emailInput.addEventListener(
  "input",
  debounce(async () => {
    const email = emailInput.value.trim();
    if (email && validateEmailFormat(email)) {
      await checkEmailExists(email);
    }
  }, 500)
);

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

    usernameError.textContent = querySnapshot.empty
      ? "✅ Username is available."
      : "❌ Username is already taken.";
    usernameError.style.color = querySnapshot.empty ? "green" : "red";
  } catch (error) {
    console.error("Error checking username:", error);
    usernameError.textContent = "❌ Error checking username.";
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

    farmerIdError.textContent = querySnapshot.empty
      ? "✅ Farmer ID is available."
      : "❌ Farmer ID is already in use.";
    farmerIdError.style.color = querySnapshot.empty ? "green" : "red";
  } catch (error) {
    console.error("Error checking Farmer ID:", error);
    farmerIdError.textContent = "❌ Error checking Farmer ID.";
    farmerIdError.style.color = "red";
  }
  validateForm();
}, 500);

farmerIdInput.addEventListener("input", checkFarmerIdExists);

if (!form.dataset.listenerAdded) {
  form.dataset.listenerAdded = "true";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showError("Please correct all form errors");
      return;
    }

    submitsButton.disabled = true;

    const userType = userTypeSelect.value;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const firstName = document.getElementById("firstName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const contact = contactInput.value.trim();
    const birthday = document.getElementById("birthday").value;
    const sex = document.getElementById("sex").value;
    const barangay_name = barangaySelect.value;
    const username = usernameInput.value.trim();
    const farmerId = farmerIdInput.value.trim();
    const profilePicture = profilePictureInput.files[0];

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential.user.uid;

      let profilePictureUrl = "";
      if (profilePicture) {
        profilePictureUrl = await uploadProfilePicture(profilePicture, uid);
      }

      const userData = {
        uid,
        user_picture: profilePictureUrl,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        contact,
        email,
        birthday,
        sex,
        user_type: userType,
        barangay_name,
      };

      if (userType === "Admin" || userType === "Supervisor") {
        userData.user_name = username;
        await setDoc(doc(db, "tb_users", uid), userData);
      } else {
        userData.farmer_id = farmerId;
        await setDoc(doc(db, "tb_farmers", uid), userData);
      }

      showSuccessPanel("Account created successfully!");
      form.reset();
      updateFormFields();
      updateProfilePictureUI();
      usernameError.textContent = "";
      farmerIdError.textContent = "";
      emailError.textContent = "";
      confirmPasswordError.style.display = "none";
      passwordMatchMessage.style.display = "none";
      contactError.textContent = "";
      document.getElementById("profilePictureError").textContent = "";
      Object.entries(passwordChecks).forEach(([id]) => {
        document.getElementById(id).style.color = "";
      });
    } catch (error) {
      console.error("Error:", error.code, error.message);
      showError(error.message || "Failed to create account");
    } finally {
      submitsButton.disabled = true;
    }
  });
}

const inputs = form.querySelectorAll("input, select");
inputs.forEach((input) => {
  input.addEventListener("input", validateForm);
  input.addEventListener("change", validateForm);
});

// Debounce function for click events
function debounceClick(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    if (timeout) return; // Skip if already processing
    timeout = setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, delay);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  fetchUserRoles();
  fetchBarangayList();
  updateProfilePictureUI();
  updateFormFields();
  submitsButton.disabled = true;
  validateForm();

  // Password toggle functionality
  const togglePasswordButtons = document.querySelectorAll(".toggle-password");
  console.log("Found toggle buttons:", togglePasswordButtons.length);
  if (togglePasswordButtons.length === 0) {
    console.error("No toggle-password elements found");
    return;
  }

  togglePasswordButtons.forEach((button, index) => {
    // Remove existing listeners to prevent duplicates
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    const handleToggle = debounceClick((e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(
        `Toggle button ${index + 1} clicked at ${Date.now()}:`,
        newButton
      );

      const targetId = newButton.getAttribute("data-target");
      const input = document.getElementById(targetId);
      const showIcon = newButton.querySelector(".eye-icon.show");
      const hideIcon = newButton.querySelector(".eye-icon.hide");

      if (!input || !showIcon || !hideIcon) {
        console.error(`Missing elements for toggle ${targetId}`);
        return;
      }

      console.log(`Current input type for ${targetId}:`, input.type);
      if (input.type === "password") {
        input.type = "text";
        showIcon.style.display = "none";
        hideIcon.style.display = "block";
        console.log(`For ${targetId}: Show icon hidden, hide icon shown`);
      } else {
        input.type = "password";
        showIcon.style.display = "block";
        hideIcon.style.display = "none";
        console.log(`For ${targetId}: Hide icon hidden, show icon shown`);
      }
      console.log(`New input type for ${targetId}:`, input.type);

      // Force repaint
      input.style.visibility = "hidden";
      input.offsetHeight; // Trigger reflow
      input.style.visibility = "visible";
    }, 200);

    newButton.addEventListener("click", handleToggle);
  });
});
