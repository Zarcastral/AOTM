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

// Form Elements
const form = document.getElementById("createAccountForm");
const userTypeSelect = document.getElementById("user_type");
const barangaySelect = document.getElementById("barangay");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const profilePictureInput = document.getElementById("profilePicture");

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

// **Form Submission**
// Ensure the event listener is attached only once
if (!form.dataset.listenerAdded) {
  form.dataset.listenerAdded = "true";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("Form submission triggered");

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const userType = userTypeSelect.value;
    const email = document.getElementById("email").value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const firstName = document.getElementById("firstName").value;
    const middleName = document.getElementById("middleName").value;
    const lastName = document.getElementById("lastName").value;
    const contact = document.getElementById("contact").value;
    const birthday = document.getElementById("birthday").value;
    const sex = document.getElementById("sex").value;
    const barangay_name = barangaySelect.value;
    const profilePicture = profilePictureInput.files[0];

    let username = "";
    let farmerId = "";

    if (userType === "Admin" || userType === "Supervisor") {
      username = usernameInput.value.trim();
      if (!username) {
        submitButton.disabled = false;
        return showError("Username is required for Admins and Supervisors.");
      }
    } else {
      farmerId = farmerIdInput.value.trim();
      if (!farmerId) {
        submitButton.disabled = false;
        return showError(
          "Farmer ID is required for Farmers, Farm Presidents, and Head Farmers."
        );
      }
    }

    if (password !== confirmPassword) {
      submitButton.disabled = false;
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
        submitButton.disabled = false;
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
        barangay: barangay_name, // Previously barangay_name, keeping it consistent
      };

      // Save username as user_name for Admin/Supervisor
      if (userType === "Admin" || userType === "Supervisor") {
        userData.user_name = username;
        await setDoc(doc(db, "tb_users", userCredential.user.uid), userData);
      } else {
        userData.farmer_id = farmerId;
        await setDoc(doc(db, "tb_farmers", userCredential.user.uid), userData);
      }

      console.log("Account created successfully!");
      alert("Account created successfully!");
      form.reset();
    } catch (error) {
      console.error("Error creating account:", error);
      showError(error.message);
    }

    submitButton.disabled = false;
  });
}

// Initialize Data Fetching
document.addEventListener("DOMContentLoaded", () => {
  fetchUserRoles();
  fetchBarangayList();
});
