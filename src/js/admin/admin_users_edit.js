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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";
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
        const userData = localStorage.getItem("userData");
        if (userData) {
            const data = JSON.parse(userData);
           
            const username = data.user_name;
            if (username) {
                fetchProfilePicture(username);
                saveProfilePicture(username); 
            } else {
                console.error("Username is missing");
            }

            // Populate text fields
            const usernameField = document.getElementById("user_name");
            usernameField.value = data.user_name || "";

            document.getElementById("first_name").value = data.first_name || "";
            document.getElementById("middle_name").value = data.middle_name || "";
            document.getElementById("last_name").value = data.last_name || "";
            document.getElementById("contact").value = data.contact || "";
            document.getElementById("email").value = data.email || "";
            document.getElementById("birthday").value = data.birthday || "";
            document.getElementById("user_name").value = data.user_name || "";

            if (data.sex) {
                setSelectValue(document.getElementById("sex"), data.sex);
            }
            if (data.barangay_name) {
                setSelectValue(document.getElementById("barangay"), data.barangay_name);
            }
            if (data.user_type) {
                setSelectValue(document.getElementById("user_type"), data.user_type);
            }

            fetchProfilePicture(username);
        }
        let originalImageSrc;
        async function fetchProfilePicture(username) {
            try {
                const q = query(collection(db, "tb_users"), where("user_name", "==", username));
                const querySnapshot = await getDocs(q);
        
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    const user_picture = userData.user_picture;
        
                    if (user_picture) {
                        document.getElementById("profile-picture").src = user_picture;
                        originalImageSrc = user_picture;
                    }
                } else {
                    console.log("No user found with the given user_name.");
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
        window.location.href = "admin_users.html"; // Redirect to users_list.html
    });

    // Add event listener for the save button
    document.getElementById("admin_users_edit").addEventListener("submit", (event) => {
        event.preventDefault(); // Prevent the default form submission
        validateUniqueFields();
        
    });

});

/* ================ Validates if contact, email, and user_name are unique before saving changes ================ */
async function validateUniqueFields() {
    const colRef = collection(db, "tb_users"); // Use collection() properly
    const snapshot = await getDocs(colRef);
    const username = document.getElementById("user_name").value;
    const contact = document.getElementById("contact").value;
    const email = document.getElementById("email").value;
    const userName = document.getElementById("user_name").value;

    try {
        let errors = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            if (data.user_name !== username) {
                if (data.contact === contact) errors.push("Contact is already in use");
                if (data.email === email) errors.push("Email is already in use");
                if (data.user_name === userName) errors.push("Username is already in use");
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
async function saveProfilePicture(username) {
    if (!username) {
        console.error("Username is undefined or empty");
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
        const q = query(collection(db, "tb_users"), where("user_name", "==", username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, { user_picture: downloadURL });
            console.log("Profile picture updated successfully.");
        } else {
            console.error("Username not found in Firestore.");
        }
    } catch (error) {
        console.error("Error uploading profile picture:", error);
    }
}

async function saveChanges() {
    const username = (document.getElementById("user_name").value);
    console.log("Searching for user_name:", username, "Type:", typeof username);

    if (!username) {
        alert("Please provide a valid username.");
        return;
    }

    // Get all form data
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
        user_name: document.getElementById("user_name").value,
    };

    const colRef = collection(db, "tb_users");
    const q = query(colRef, where("user_name", "==", username)); 

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        
        await saveProfilePicture(username);  // Ensure picture is uploaded first
        await updateDoc(docRef, updatedData);
        alert("Changes saved successfully!");
        window.location.href = "admin_users.html"; 
    } else {
        alert("Account with this username does not exist.");
    }

    // Remove confirmation panel
    const confirmationPanel = document.getElementById("confirmationPanel");
    if (confirmationPanel) {
        document.body.removeChild(confirmationPanel);
    }
}

