import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    where,
    query,
    getFirestore
  } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";  // Import getAuth and onAuthStateChanged
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", async () => {

    const auth = getAuth();
    // Check if the user is logged in when the page is loaded
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.error("User is not authenticated!");
            return;
        }
    });

    // Function to populate a select dropdown and ensure case-insensitive selection
    async function populateSelect(selectElement, collectionName, fieldName) {
        const colRef = collection(db, collectionName); // Use the collection() function
        const snapshot = await getDocs(colRef);

        snapshot.forEach(doc => {
            const option = document.createElement("option");
            option.value = doc.data()[fieldName].toLowerCase(); 
            option.textContent = doc.data()[fieldName]; 
            selectElement.appendChild(option);
        });
    }

    function setSelectValue(selectElement, value) {
        if (!value) return;
    
        const options = Array.from(selectElement.options);
        const matchedOption = options.find(option => option.value.toLowerCase() === value.toLowerCase());
    
        if (matchedOption) {
            selectElement.value = matchedOption.value;
        } else {
            console.warn(`Value "${value}" not found in select options.`);
        }
    }
    

    try {
        // Populate Barangay combobox
        const barangaySelect = document.getElementById("barangay");
        await populateSelect(barangaySelect, "tb_barangay", "barangay_name");

        // Populate User Type combobox
        const userTypeSelect = document.getElementById("user_type");
        await populateSelect(userTypeSelect, "tb_user_type", "user_type");

        // Automatically select the option fetched from data
        const farmerData = localStorage.getItem("farmerData");
        if (farmerData) {
            const data = JSON.parse(farmerData);

            // Ensure farmerId is defined before calling the function
            const farmerId = data.farmer_id;
            if (farmerId) {
                fetchProfilePicture(farmerId);
            } else {
                console.error("Farmer ID is missing");
            }

            // Populate text fields
            const farmerIdField = document.getElementById("farmer_id");
            farmerIdField.value = data.farmer_id || "";
            farmerIdField.readOnly = true; // Make Farmer ID non-editable

            document.getElementById("first_name").value = data.first_name || "";
            document.getElementById("middle_name").value = data.middle_name || "";
            document.getElementById("last_name").value = data.last_name || "";
            document.getElementById("contact").value = data.contact || "";
            document.getElementById("email").value = data.email || "";
            document.getElementById("birthday").value = data.birthday || "";

            // Automatically select the value for the 'sex' combobox
            if (data.sex) {
                setSelectValue(document.getElementById("sex"), data.sex);
            }
            if (data.barangay_name) {
                setSelectValue(document.getElementById("barangay"), data.barangay_name);
            }
            if (data.user_type) {
                setSelectValue(document.getElementById("user_type"), data.user_type);
            }
            


            fetchProfilePicture(farmerId);
        }
        let originalImageSrc;
        async function fetchProfilePicture(farmerId) {
            try {
                const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
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
                            span.onclick = function() {
                                modal.style.display = "none";
                            }
                        });
                    }
                } else {
                    console.log("No user found with the given farmer_id.");
                }
            } catch (error) {
                console.error("Error fetching profile picture:", error);
            }
            
    // When no file is selected, revert the image back to the original profile picture
    document.getElementById("profile_picture").addEventListener("change", handleFileSelect);

    // Function to handle the selected file
    function handleFileSelect(event) {
        const file = event.target.files[0]; // Get the selected file
        const imgElement = document.getElementById("profile-picture");

        if (file) {
            const reader = new FileReader(); // Create a FileReader to read the image

            // When the file is successfully read, update the profile picture preview
            reader.onload = function(e) {
                imgElement.src = e.target.result; // Set the new image as the profile picture
            };

            reader.readAsDataURL(file); // Read the file as a data URL to display it
        } else {
            // If no file is selected, revert to the original image fetched from Firebase
            imgElement.src = originalImageSrc;
        }
    }
        }
        
    } catch (error) {
        console.error("Error populating comboboxes:", error);
    }

    const closeButton = document.getElementById("close-button");
    closeButton.addEventListener("click", () => {
        window.location.href = "admin_farmers.html";
    });

    // Add event listener for the save button
    document.getElementById("admin_farmers_edit").addEventListener("submit", (event) => {
        event.preventDefault(); // Prevent the default form submission
        validateUniqueFields();
        
    });



});

/* ================ Validates if contact, email are unique before saving changes ================ */
async function validateUniqueFields() {
    const colRef = collection(db, "tb_farmers"); // Use collection() properly
    const snapshot = await getDocs(colRef);
    const farmerId = document.getElementById("farmer_id").value;
    const contact = document.getElementById("contact").value;
    const email = document.getElementById("email").value;

    try {
        let errors = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            // Skip checking if the farmer_id matches (meaning this is the currently edited user)
            if (data.farmer_id !== farmerId) {
                if (data.contact === contact) errors.push("Contact is already in use");
                if (data.email === email) errors.push("Email is already in use");
            }
        });

        if (errors.length > 0) {
            createErrorPanel(errors.join("<br>"));
        } else {
            showConfirmationPanel();
        }
    } catch (error) {
        console.error("Error validating unique fields:", error);
    }
}


/*
 Displays an error message in a floating panel at the center of the screen.
 Ensures only one instance of the error panel is displayed at a time and blocks interaction with underlying fields.
*/

 function createErrorPanel(message) {
    // Check if an error panel already exists
    let existingErrorPanel = document.getElementById("errorPanel");
    if (existingErrorPanel) {
        return; // Do nothing if an error panel is already displayed
    }

    // Create the backdrop to block interaction with underlying elements
    const backdrop = document.createElement("div");
    backdrop.id = "errorBackdrop";
    document.body.appendChild(backdrop);

    // Create the error panel
    const errorPanel = document.createElement("div");
    errorPanel.id = "errorPanel";
    errorPanel.innerHTML = `
        <div class="error-content">
            <p>${message}</p>
        </div>
        <button id="closeErrorPanel">Close</button>
    `;
    document.body.appendChild(errorPanel);

    // Add event listener for the close button
    document.getElementById("closeErrorPanel").addEventListener("click", () => {
        document.body.removeChild(errorPanel);
        document.body.removeChild(backdrop);
    });
}

/* ================ Shows the confirmation panel with Yes and Cancel options ================ */
function showConfirmationPanel() {
    // Create the backdrop
    const confirmationBackdrop = document.createElement("div");
    confirmationBackdrop.id = "confirmationBackdrop";

    // Create the confirmation panel
    const confirmationPanel = document.createElement("div");
    confirmationPanel.id = "confirmationPanel";
    confirmationPanel.innerHTML = `
    <div class="confirmation-content">
        <p>Are you sure you want to save the changes?</p>
        <div class="button-container">
            <button id="confirmCancel">Cancel</button>
            <button id="confirmYes">Yes</button>
        </div>
    </div>
    `;

    // Append the backdrop and the panel to the body
    document.body.appendChild(confirmationBackdrop);
    document.body.appendChild(confirmationPanel);

    // Add event listeners for Yes and Cancel buttons
    document.getElementById("confirmYes").addEventListener("click", saveChanges);
    document.getElementById("confirmCancel").addEventListener("click", () => {
        document.body.removeChild(confirmationBackdrop);
        document.body.removeChild(confirmationPanel);
    });
}


/* ================ Saves changes to the Firebase database ================ */

async function saveProfilePicture(farmerId) {
    if (!farmerId) {
        console.error("farmerId is undefined or empty");
        return;
    }
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated!");
        return;
    }
    const db = getFirestore(app);
    const storage = getStorage(app);
    const fileInput = document.getElementById("profile_picture");
    const file = fileInput.files[0];

    if (!file) {
        console.warn("No file selected for upload.");
        return;
    }

    try {
        const userId = user.uid;
        const storageRef = ref(storage, `profile_pictures/${userId}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Update Firestore with the image URL
        const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, { user_picture: downloadURL });
            console.log("Profile picture updated successfully.");
        } else {
            console.error("Farmer ID not found in Firestore.");
        }
    } catch (error) {
        console.error("Error uploading profile picture:", error);
    }
}

async function saveChanges() {
    const farmerId = document.getElementById("farmer_id").value.trim();
    if (!farmerId) {
        console.error("Farmer ID is missing.");
        return;
    }

    const updatedData = {
        first_name: document.getElementById("first_name").value,
        middle_name: document.getElementById("middle_name").value,
        last_name: document.getElementById("last_name").value,
        contact: document.getElementById("contact").value,
        email: document.getElementById("email").value,
        birthday: document.getElementById("birthday").value,
        sex: document.getElementById("sex").value,
        user_type: document.getElementById("user_type").value,
        barangay: document.getElementById("barangay").value,
    };

    const q = query(collection(db, "tb_farmers"), where("farmer_id", "==", farmerId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await saveProfilePicture(farmerId);
        await updateDoc(docRef, updatedData);
        console.log("User details updated successfully.");
        
        // Save profile picture if a new file was selected
        
        alert("Changes saved successfully!");
        window.location.href = "admin_farmers.html";
    } else {
        alert("Account with this Farmer ID does not exist.");
    }



    // Remove confirmation panel
    const confirmationPanel = document.getElementById("confirmationPanel");
    if (confirmationPanel) {
        document.body.removeChild(confirmationPanel);
    }
}
