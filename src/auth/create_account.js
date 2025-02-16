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

const userTypeSelect = document.getElementById("user_type");
const farmerFields = document.getElementById("farmerFields");
const adminFields = document.getElementById("adminFields");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");
const barangaySelect = document.getElementById("barangay"); // Get Barangay field

// 🚀 Pop-up Elements
const errorPopup = document.getElementById("errorPopup");
const popupMessage = document.getElementById("popupMessage");
const closePopup = document.getElementById("closePopup");

// ✅ Function to Show Pop-up Error
function showPopup(message) {
  popupMessage.textContent = message;
  errorPopup.style.display = "block";
}

// ✅ Close the Pop-up when "Okay" is clicked
closePopup.addEventListener("click", () => {
  errorPopup.style.display = "none";
});

// ✅ Fetch user roles from Firestore
async function fetchUserRoles() {
  try {
    const userTypesRef = collection(db, "tb_user_type");
    const snapshot = await getDocs(userTypesRef);

    userTypeSelect.innerHTML = '<option value="">Select User Type</option>';

    snapshot.forEach((doc) => {
      const userType = doc.data().user_type;
      const option = document.createElement("option");
      option.value = userType;
      option.textContent = userType;
      userTypeSelect.appendChild(option);
    });

    if (userTypeSelect.options.length === 1) {
      userTypeSelect.innerHTML = '<option value="">No roles available</option>';
    }
  } catch (error) {
    showPopup("Failed to load user roles.");
    console.error("Error fetching user roles:", error);
  }
}

// ✅ Fetch Barangay Names from Firestore
async function fetchBarangayList() {
  try {
    const barangayRef = collection(db, "tb_barangay");
    const snapshot = await getDocs(barangayRef);

    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';

    snapshot.forEach((doc) => {
      const barangayName = doc.data().barangay_name;
      const option = document.createElement("option");
      option.value = barangayName;
      option.textContent = barangayName;
      barangaySelect.appendChild(option);
    });

    if (barangaySelect.options.length === 1) {
      barangaySelect.innerHTML =
        '<option value="">No barangays available</option>';
    }
  } catch (error) {
    showPopup("Failed to load barangays.");
    console.error("Error fetching barangays:", error);
  }
}

// ✅ Update form fields dynamically based on `user_type`
export function updateFormFields() {
  const selectedType = userTypeSelect.value;
  farmerFields.style.display = [
    "Farmer",
    "Head Farmer",
    "Farm President",
  ].includes(selectedType)
    ? "block"
    : "none";
  adminFields.style.display = ["Admin", "Supervisor"].includes(selectedType)
    ? "block"
    : "none";
}

// ✅ Check for existing email, username, or farmer ID
async function checkDuplicate(field, value, collectionName) {
  const q = query(collection(db, collectionName), where(field, "==", value));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

// ✅ Handle form submission
document
  .getElementById("createAccountForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = document.querySelector("button[type='submit']");
    submitButton.disabled = true;

    // Gather form values
    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const profilePicture = document.getElementById("profilePicture").files[0];
    const firstName = document.getElementById("firstName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const birthday = document.getElementById("birthday").value;
    const sex = document.getElementById("sex").value;
    const user_type = userTypeSelect.value;
    const barangay = barangaySelect.value;

    let farmer_id = "";
    let username = "";

    if (["Farmer", "Head Farmer", "Farm President"].includes(user_type)) {
      farmer_id = document.getElementById("farmer_id").value.trim();
    } else if (["Admin", "Supervisor"].includes(user_type)) {
      username = document.getElementById("userName").value.trim();
    }

    // ✅ Validate inputs
    if (!user_type) {
      showPopup("Please select a user type.");
      submitButton.disabled = false;
      return;
    }
    if (password !== confirmPassword) {
      passwordMessage.textContent = ""; // Remove inline message
      showPopup("Passwords do not match."); // Show pop-up
      submitButton.disabled = false;
      return;
    }

    // ✅ Check for duplicate email, username, or farmer ID
    try {
      // 🔍 Check Firestore for email duplication
      const emailExistsInUsers = await checkDuplicate(
        "email",
        email,
        "tb_users"
      );
      const emailExistsInFarmers = await checkDuplicate(
        "email",
        email,
        "tb_farmers"
      );

      if (emailExistsInUsers || emailExistsInFarmers) {
        showPopup(
          "This email is already registered. Please use a different email."
        );
        submitButton.disabled = false;
        return;
      }

      if (
        username &&
        (await checkDuplicate("username", username, "tb_users"))
      ) {
        showPopup("This username is already taken.");
        submitButton.disabled = false;
        return;
      }

      if (
        farmer_id &&
        (await checkDuplicate("farmer_id", farmer_id, "tb_farmers"))
      ) {
        showPopup("This Farmer ID is already registered.");
        submitButton.disabled = false;
        return;
      }

      // ✅ Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      const userId = user.uid;

      let profilePictureURL = "";
      if (profilePicture) {
        const storageRef = ref(storage, `profile_pictures/${userId}`);
        await uploadBytes(storageRef, profilePicture);
        profilePictureURL = await getDownloadURL(storageRef);
      }

      const collectionName = [
        "Farmer",
        "Head Farmer",
        "Farm President",
      ].includes(user_type)
        ? "tb_farmers"
        : "tb_users";

      const userData = {
        user_picture: profilePictureURL,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        contact,
        email,
        birthday,
        sex,
        user_type,
        barangay,
      };

      if (farmer_id) userData.farmer_id = farmer_id;
      if (username) userData.username = username;

      await setDoc(doc(collection(db, collectionName), userId), userData);

      alert("Account created successfully!");
      document.getElementById("createAccountForm").reset();
      passwordMessage.textContent = "";
    } catch (error) {
      console.error("Error creating account:", error);
      showPopup(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

// ✅ Load user roles & barangays on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchUserRoles();
  fetchBarangayList();
});
userTypeSelect.addEventListener("change", updateFormFields);
