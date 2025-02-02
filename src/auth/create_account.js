import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, doc, getFirestore, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import app from "../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const createAccountForm = document.getElementById("createAccountForm");
const errorMessage = document.getElementById("error-message");

createAccountForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const profilePicture = document.getElementById("profilePicture").files[0];
  const farmerId = document.getElementById("farmerId").value.trim();
  const firstName = document.getElementById("firstName").value.trim();
  const middleName = document.getElementById("middleName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const birthday = document.getElementById("birthday").value;
  const sex = document.getElementById("sex").value;
  const user_type = document.getElementById("user_type").value;
  const barangay = document.getElementById("barangay").value.trim();

  if (password !== confirmPassword) {
    errorMessage.textContent = "Passwords do not match.";
    errorMessage.style.display = "block";
    return;
  }

  try {
    // Create user with email and password in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    const userId = user.uid; // Get unique Firebase user ID

    // Upload profile picture to Firebase Storage (if available)
    let profilePictureURL = "";
    if (profilePicture) {
      const storageRef = ref(storage, `profile_pictures/${userId}`);
      await uploadBytes(storageRef, profilePicture);
      profilePictureURL = await getDownloadURL(storageRef);
    }

    // Store user details in Firestore (tb_users collection)
    const userDocRef = doc(collection(db, "tb_users"), userId);
    await setDoc(userDocRef, {
      email,
      farmerId,
      firstName,
      middleName,
      lastName,
      contact,
      birthday,
      sex,
      user_type,
      barangay,
      profilePictureURL,
      createdAt: new Date().toISOString(), // Timestamp of account creation
    });

    // Optionally, log the user data to the console for verification
    console.log("User created and stored in Firestore:", {
      email,
      farmerId,
      firstName,
      middleName,
      lastName,
      contact,
      birthday,
      sex,
      user_type,
      barangay,
      profilePictureURL,
    });

    alert("Account created successfully!");
    createAccountForm.reset();
  } catch (error) {
    console.error("Error creating account:", error);
    errorMessage.textContent = error.message;
    errorMessage.style.display = "block";
  }
});
