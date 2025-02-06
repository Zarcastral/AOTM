import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAuth,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import app from "../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const userTypeSelect = document.getElementById("user_type");
const farmerFields = document.getElementById("farmerFields");
const adminFields = document.getElementById("adminFields");

// ✅ Fetch user roles from Firestore (`tb_user_type`)
async function fetchUserRoles() {
  try {
    const userTypesRef = collection(db, "tb_user_type");
    const snapshot = await getDocs(userTypesRef);

    userTypeSelect.innerHTML = '<option value="">Select User Type</option>'; // Reset dropdown

    snapshot.forEach((doc) => {
      const userType = doc.data().user_type; // Ensure correct field name
      const option = document.createElement("option");
      option.value = userType;
      option.textContent = userType;
      userTypeSelect.appendChild(option);
    });

    if (userTypeSelect.options.length === 1) {
      userTypeSelect.innerHTML = '<option value="">No roles available</option>';
    }
  } catch (error) {
    console.error("Error fetching user roles:", error);
    userTypeSelect.innerHTML = '<option value="">Failed to load roles</option>';
  }
}

// ✅ Update form fields dynamically based on `user_type` selection
export function updateFormFields() {
  const selectedType = userTypeSelect.value;

  if (["Farmer", "Head Farmer", "Farm President"].includes(selectedType)) {
    farmerFields.style.display = "block";
    adminFields.style.display = "none";
  } else if (["Admin", "Supervisor"].includes(selectedType)) {
    farmerFields.style.display = "none";
    adminFields.style.display = "block";
  } else {
    farmerFields.style.display = "none";
    adminFields.style.display = "none";
  }
}

// ✅ Load user roles on page load
document.addEventListener("DOMContentLoaded", fetchUserRoles);
userTypeSelect.addEventListener("change", updateFormFields);

// ✅ Handle form submission
document
  .getElementById("createAccountForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    // Disable the submit button to prevent double submission
    const submitButton = document.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const profilePicture = document.getElementById("profilePicture").files[0];
    const firstName = document.getElementById("firstName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const birthday = document.getElementById("birthday").value;
    const sex = document.getElementById("sex").value;
    const user_type = userTypeSelect.value;
    const barangay = document.getElementById("barangay").value.trim();

    let farmer_id = "";

    if (["Farmer", "Head Farmer", "Farm President"].includes(user_type)) {
      farmer_id = document.getElementById("farmer_id").value.trim();
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      submitButton.disabled = false; // Re-enable the button
      return;
    }

    try {
      // Check if the user already exists in Firebase Authentication using fetchSignInMethodsForEmail
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        alert("User with this email already exists.");
        submitButton.disabled = false; // Re-enable the button
        return;
      }

      // Create the user in Authentication
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

      const userDocRef = doc(collection(db, collectionName), userId);
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

      if (["Farmer", "Head Farmer", "Farm President"].includes(user_type)) {
        userData.farmer_id = farmer_id; // Only add `farmer_id` for farmers
      }

      // Insert user data into Firestore
      await setDoc(userDocRef, userData);

      alert("Account created successfully!");
      document.getElementById("createAccountForm").reset();
    } catch (error) {
      console.error("Error creating account:", error);
      alert(error.message);
    } finally {
      submitButton.disabled = false; // Re-enable the button
    }
  });
