import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import app from "../../config/firebase_config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const db = getFirestore(app);
  const storage = getStorage(app);

  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail");

  if (!userType || !userEmail) return;

  await populateBarangayDropdown(db);

  if (["Admin", "Supervisor"].includes(userType)) {
    await fetchUserData(db, "tb_users", userEmail);
  } else if (["Farmer", "Farm President", "Head Farmer"].includes(userType)) {
    await fetchFarmerData(db, "tb_farmers", userEmail);
  }

  document
    .getElementById("profile-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateUserProfile(db, storage, userType, userEmail);
    });
});

/**
 * Fetches all barangay names from `tb_barangay` and populates the dropdown.
 */
async function populateBarangayDropdown(db) {
  try {
    const barangayDropdown = document.getElementById("barangay");
    if (!barangayDropdown) return;

    const barangayRef = collection(db, "tb_barangay");
    const querySnapshot = await getDocs(barangayRef);

    barangayDropdown.innerHTML = "";

    querySnapshot.forEach((doc) => {
      const barangayData = doc.data();
      const option = document.createElement("option");
      option.value = barangayData.barangay_name;
      option.textContent = barangayData.barangay_name;
      barangayDropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching barangay list:", error);
  }
}

/**
 * Fetch user data from Firestore and populate form fields.
 */
async function fetchUserData(db, collectionName, email) {
  try {
    const usersRef = collection(db, collectionName);
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      fillFormFields(querySnapshot.docs[0].data());
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
  }
}

async function fetchFarmerData(db, collectionName, email) {
  try {
    const farmersRef = collection(db, collectionName);
    const q = query(farmersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const farmerData = querySnapshot.docs[0].data();
      replaceUsernameWithFarmerId(farmerData.farmer_id);
      fillFormFields(farmerData);
    }
  } catch (error) {
    console.error("Error fetching farmer data:", error);
  }
}

function fillFormFields(data) {
  for (const [key, value] of Object.entries(data)) {
    let fieldId = key;
    if (key === "barangay_name") fieldId = "barangay";
    if (key === "user_type") fieldId = "user_type";

    const field = document.getElementById(fieldId);
    if (field) field.value = value;
  }

  selectUserBarangay(data.barangay_name);

  const profilePictureField = document.getElementById("profile-picture");
  if (profilePictureField && data.user_picture) {
    profilePictureField.src = data.user_picture;
  }
}

function selectUserBarangay(userBarangay) {
  const barangayDropdown = document.getElementById("barangay");
  if (!barangayDropdown) return;

  Array.from(barangayDropdown.options).forEach((option) => {
    if (option.value === userBarangay) {
      option.selected = true;
    }
  });
}

async function updateUserProfile(db, storage, userType, userEmail) {
  try {
    const collectionName = ["Admin", "Supervisor"].includes(userType)
      ? "tb_users"
      : "tb_farmers";
    const userDocId = await getUserDocumentId(db, collectionName, userEmail);
    if (!userDocId) return;

    const formData = {
      contact: document.getElementById("contact").value,
      barangay_name: document.getElementById("barangay").value,
    };

    const profilePictureInput = document.getElementById("profile_picture");
    if (profilePictureInput.files.length > 0) {
      const file = profilePictureInput.files[0];
      formData.user_picture = await uploadProfilePicture(
        storage,
        file,
        userDocId
      );
    }

    await updateUserData(db, collectionName, userDocId, formData);
    alert("Profile updated successfully!");
    window.location.reload();
  } catch (error) {
    console.error("Error updating profile:", error);
  }
}

async function getUserDocumentId(db, collectionName, email) {
  const usersRef = collection(db, collectionName);
  const q = query(usersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);

  return querySnapshot.empty ? null : querySnapshot.docs[0].id;
}

async function uploadProfilePicture(storage, file, userId) {
  const fileRef = ref(storage, `profile_pictures/${userId}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

async function updateUserData(db, collectionName, docId, formData) {
  const userRef = doc(db, collectionName, docId);
  await updateDoc(userRef, formData);
}
