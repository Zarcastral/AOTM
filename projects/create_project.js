import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD0pdy75p4D21Nz1JyFKHQxVNyh60U8yVA",
    authDomain: "operation-and-task-management.firebaseapp.com",
    projectId: "operation-and-task-management",
    storageBucket: "operation-and-task-management.firebasestorage.app",
    messagingSenderId: "182897367112",
    appId: "1:182897367112:web:600d924a446ae220fba07d",
    measurementId: "G-C91Z5709N5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fetch "Farm President" users for Assign To dropdown
async function loadAssignToOptions() {
    const assignToSelect = document.getElementById('assignTo');
    const q = query(collection(db, "tb_users"), where("user_type", "==", "Farm President"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(doc => {
        const user = doc.data();
        const option = document.createElement('option');
        option.value = user.user_name;
        option.textContent = user.user_name;
        assignToSelect.appendChild(option);
    });
}

// Function to get barangay name of the selected "Farm President"
async function getBarangayName(userName) {
    const q = query(collection(db, "tb_users"), where("user_name", "==", userName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        return userDoc.barangay_name;
    }
    return '';
}

// Fetch crop types for cropType dropdown
async function loadCropTypes() {
    const cropTypeSelect = document.getElementById('cropType');
    const q = collection(db, "tb_crop_types");
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(doc => {
        const cropType = doc.data().crop_type_name;
        const option = document.createElement('option');
        option.value = cropType;
        option.textContent = cropType;
        cropTypeSelect.appendChild(option);
    });
}

// Fetch fertilizer types for fertilizerType dropdown
async function loadFertilizerTypes() {
    const fertilizerTypeSelect = document.getElementById('fertilizerType');
    const q = collection(db, "tb_fertilizer");
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(doc => {
        const fertilizerType = doc.data().fertilizer_name;
        const option = document.createElement('option');
        option.value = fertilizerType;
        option.textContent = fertilizerType;
        fertilizerTypeSelect.appendChild(option);
    });
}

// Fetch equipment for equipment dropdown
async function loadEquipment() {
    const equipmentSelect = document.getElementById('equipment');
    const q = collection(db, "tb_equipment");
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(doc => {
        const equipmentName = doc.data().equipment_name;
        const option = document.createElement('option');
        option.value = equipmentName;
        option.textContent = equipmentName;
        equipmentSelect.appendChild(option);
    });
}

// Event listener for the "Assign To" dropdown to update the barangay
document.getElementById('assignTo').addEventListener('change', async (e) => {
    const selectedUser = e.target.value;
    const barangayName = await getBarangayName(selectedUser);
    const barangaySelect = document.getElementById('barangay');
    barangaySelect.value = barangayName; // Update the barangay field
});

// Load all options when the page loads
window.onload = () => {
    loadAssignToOptions();
    loadCropTypes();
    loadFertilizerTypes();
    loadEquipment();
};


// Handle popup visibility and form submission
document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Show the confirmation popup
    document.getElementById('confirmationPopup').style.display = 'flex';
});

// Confirm action in the popup
document.getElementById('confirmButton').addEventListener('click', async () => {
    // Proceed with form submission logic (e.g., save data to Firestore)
    const formData = new FormData(document.getElementById('createProjectForm'));
    // Save to Firestore logic (replace with your actual Firestore logic)
    await addDoc(collection(db, "projects"), formData);
    // Close popup and reset form
    document.getElementById('confirmationPopup').style.display = 'none';
    document.getElementById('createProjectForm').reset();
});

// Cancel action in the popup
document.getElementById('cancelButton').addEventListener('click', () => {
    // Close the popup without submitting
    document.getElementById('confirmationPopup').style.display = 'none';
});


/* Handle form submission
document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const projectName = document.getElementById('projectName').value;
    const assignTo = document.getElementById('assignTo').value;
    const status = document.getElementById('status').value;
    const crops = document.getElementById('crops').value;
    const barangay = document.getElementById('barangay').value;
    const farmland = document.getElementById('farmland').value;
    const cropType = document.getElementById('cropType').value;
    const cropQuantity = document.getElementById('cropQuantity').value;
    const cropUnit = document.getElementById('cropUnit').value;
    const fertilizerType = document.getElementById('fertilizerType').value;
    const fertilizerQuantity = document.getElementById('fertilizerQuantity').value;
    const fertilizerUnit = document.getElementById('fertilizerUnit').value;
    const equipment = document.getElementById('equipment').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

   
});*/
