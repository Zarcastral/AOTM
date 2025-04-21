import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

/* ======================== CODE FOR POPULATING FIELDS BASED ON SELECTED FARMER ID ======================== */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Populate Barangay combobox
    const barangaySelect = document.getElementById("barangay");
    const barangayQuerySnapshot = await getDocs(collection(db, "tb_barangay"));
    barangayQuerySnapshot.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.data().barangay_name;
      option.textContent = doc.data().barangay_name;
      barangaySelect.appendChild(option);
    });

    // Populate User Type combobox
    const userTypeSelect = document.getElementById("user_type");
    const userTypeQuerySnapshot = await getDocs(collection(db, "tb_user_type"));
    userTypeQuerySnapshot.forEach((doc) => {
      const option = document.createElement("option");
      option.value = doc.data().user_type;
      option.textContent = doc.data().user_type;
      userTypeSelect.appendChild(option);
    });

    // Automatically select the option fetched from data
    const farmerData = localStorage.getItem("farmerData");
    if (farmerData) {
      const data = JSON.parse(farmerData);
      const farmer_id = data.farmer_id;
      // <------------------------- POPULATE THE FIELDS ON READ ONLY ---------------------------->
      const farmer_idField = document.getElementById("farmer_id");
      farmer_idField.value = data.farmer_id || "";
      farmer_idField.readOnly = true;

      const firstNameField = document.getElementById("first_name");
      firstNameField.value = data.first_name || "";
      firstNameField.readOnly = true;

      const middleNameField = document.getElementById("middle_name");
      middleNameField.value = data.middle_name || "";
      middleNameField.readOnly = true;

      const lastNameField = document.getElementById("last_name");
      lastNameField.value = data.last_name || "";
      lastNameField.readOnly = true;

      const contactField = document.getElementById("contact");
      contactField.value = data.contact || "";
      contactField.readOnly = true;

      const emailField = document.getElementById("email");
      emailField.value = data.email || "";
      emailField.readOnly = true;

      const birthdayField = document.getElementById("birthday");
      birthdayField.value = data.birthday || "";
      birthdayField.readOnly = true;
      /* ========================== Helper Function for Setting Select Value ========================== */

      function setSelectValue(selectElement, value) {
        if (!value) return; // Skip if value is empty

        const options = Array.from(selectElement.options);
        const matchedOption = options.find(
          (option) => option.value.toLowerCase() === value.toLowerCase()
        );

        if (matchedOption) {
          selectElement.value = matchedOption.value; // Assign the correct case-sensitive value
        }
      }
      // <---------------- AUTOMATIC SELECTION OF VALUES AND DISABLING THE COMBOBOXES ---------------->
      if (data.sex) {
        const sexSelect = document.getElementById("sex");
        setSelectValue(sexSelect, data.sex);
        sexSelect.disabled = true; // Disable combobox
      }

      if (data.barangay_name) {
        setSelectValue(barangaySelect, data.barangay_name);
        barangaySelect.disabled = true; // Disable combobox
      }

      if (data.user_type) {
        setSelectValue(userTypeSelect, data.user_type);
        userTypeSelect.disabled = true; // Disable combobox
      }

      fetchProfilePicture(farmer_id);
    }
    async function fetchProfilePicture(farmerId) {
      try {
        const q = query(
          collection(db, "tb_farmers"),
          where("farmer_id", "==", farmerId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          const user_picture = userData.user_picture;

          if (user_picture) {
            const profilePicture = document.getElementById("profile-picture");
            profilePicture.src = user_picture;

            // Add click event listener to the profile picture
            profilePicture.addEventListener("click", () => {
              const modal = document.getElementById("imageModal");
              const modalImg = document.getElementById("modalImage");
              const captionText = document.getElementById("caption");

              modal.style.display = "block";
              modalImg.src = profilePicture.src; // Use the current src value of the p
              captionText.innerHTML = "Profile Picture of: " + farmerId;

              // Close the modal when the close button is clicked
              const span = document.getElementsByClassName("close")[0];
              span.onclick = function () {
                modal.style.display = "none";
              };
            });
          }
        } else {
          console.log("No user found with the given farmer_id.");
        }
      } catch (error) {
        console.error("Error fetching profile picture:", error);
      }
    }
  } catch (error) {
    console.error("Error populating comboboxes:", error);
  }

  // Close button functionality
  const closeButton = document.getElementById("close-button");
  closeButton.addEventListener("click", () => {
    window.location.href = "supervisor_farmers.html";
  });
});
