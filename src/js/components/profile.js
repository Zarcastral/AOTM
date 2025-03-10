import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js"; // Ensure the correct Firebase config path

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);
  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  console.log("Session User Type:", userType);
  console.log("Session Email:", userEmail);

  if (!userType || !userEmail) {
    console.error(
      "⚠️ Missing user session data. Ensure login sets these values."
    );
    return;
  }

  // Set user_type in the user type field
  const userTypeField = document.getElementById("user_type");
  if (userTypeField) userTypeField.value = userType;

  // Fetch user data from the appropriate Firestore collection
  if (["Admin", "Supervisor"].includes(userType)) {
    await fetchUserData(db, "tb_users", userEmail);
  } else if (["Farmer", "Farm President", "Head Farmer"].includes(userType)) {
    await fetchFarmerData(db, "tb_farmers", userEmail);
  } else {
    console.error("⚠️ Unknown user type.");
  }
});

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
    }
  }

  // Handle user profile picture if the field exists
  const userPictureField = document.getElementById("user_picture");
  if (userPictureField && data.user_picture) {
    userPictureField.src = data.user_picture; // Assuming an `img` element
  }
}

/**
 * Replaces the username input with a readonly Farmer ID field.
 */
function replaceUsernameWithFarmerId(farmerId) {
  const usernameFieldContainer = document.querySelector(
    ".form-group:has(#user_name)"
  );

  if (!usernameFieldContainer) {
    console.error("⚠️ Username field not found.");
    return;
  }

  console.log("✅ Replacing Username field with Farmer ID.");

  const farmerField = document.createElement("div");
  farmerField.classList.add("form-group");
  farmerField.innerHTML = `
    <label for="farmer_id">Farmer ID</label>
    <input type="text" id="farmer_id" name="farmer_id" value="${farmerId}" readonly>
  `;

  usernameFieldContainer.replaceWith(farmerField);
}
