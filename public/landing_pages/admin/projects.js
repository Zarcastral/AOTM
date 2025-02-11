import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, increment, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ✅ Properly initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


         window.loadFarmPresidents = async function() {
            const querySnapshot = await getDocs(query(collection(db, "tb_farmers"), where("user_type", "==", "Farm President")));
            const assignToSelect = document.getElementById('assign-to');
            assignToSelect.innerHTML = '<option value="">Select Farm President</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().first_name;
                assignToSelect.appendChild(option);
            });
        }

         window.loadBarangay = async function(farmPresidentId) {
            if (!farmPresidentId) return;
            const docRef = doc(db, "tb_farmers", farmPresidentId);
            const docSnap = await getDoc(docRef);
            const barangayInput = document.getElementById('barangay');
            if (docSnap.exists()) {
                barangayInput.value = docSnap.data().barangay_name || "N/A";
                loadFarmland(barangayInput.value);
            } else {
                barangayInput.value = "";
            }
        }

         window.loadFarmland = async function(barangayName) {
            if (!barangayName) return;
            const querySnapshot = await getDocs(query(collection(db, "tb_farmland"), where("barangay_name", "==", barangayName)));
            const farmlandSelect = document.getElementById('farmland');
            farmlandSelect.innerHTML = '<option value="">Select Farmland</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().farmland_name;
                farmlandSelect.appendChild(option);
            });
        }

         window.loadCrops = async function() {
            const querySnapshot = await getDocs(collection(db, "tb_crops"));
            const cropsSelect = document.getElementById('crops');
            cropsSelect.innerHTML = '<option value="">Select Crop</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.data().crop_name;
                option.textContent = doc.data().crop_name;
                cropsSelect.appendChild(option);
            });
        }

        window.loadCropTypes = async function(cropName) {
            if (!cropName) return;
            const q = query(collection(db, "tb_crop_types"), where("crop_name", "==", cropName));
            const querySnapshot = await getDocs(q);
            const cropTypeSelect = document.getElementById('crop-type');
            cropTypeSelect.innerHTML = '<option value="">Select Crop Type</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.data().crop_type_name;
                option.textContent = doc.data().crop_type_name;
                cropTypeSelect.appendChild(option);
            });
        }

        window.loadFertilizers = async function() {
            const querySnapshot = await getDocs(collection(db, "tb_fertilizer_types"));
            const fertilizerSelect = document.getElementById('fertilizer-type');
            fertilizerSelect.innerHTML = '<option value="">Select Fertilizer Type</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.data().fertilizer_type_name;
                option.textContent = doc.data().fertilizer_type_name;
                fertilizerSelect.appendChild(option);
            });
        }

        window.loadEquipment = async function() {
            const querySnapshot = await getDocs(collection(db, "tb_equipment_types"));
            const equipmentSelect = document.getElementById('equipment');
            equipmentSelect.innerHTML = '<option value="">Select Equipment</option>';
            querySnapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.data().equipment_type_name;
                option.textContent = doc.data().equipment_type_name;
                equipmentSelect.appendChild(option);
            });
        }

    window.getNextProjectID= async function() {
        const counterRef = doc(db, "tb_id_counters", "projects_id_counter");
        const counterSnap = await getDoc(counterRef);

        let newProjectID = 1; // Default if document doesn't exist
        if (counterSnap.exists()) {
            newProjectID = counterSnap.data().count + 1;
        }

        // Update counter atomically
        await setDoc(counterRef, { count: newProjectID }, { merge: true });

        return newProjectID;
        }

        window.getFarmlandId = async function(farmlandName) {
    if (!farmlandName) return null;
    
    const q = query(collection(db, "tb_farmland"), where("farmland_name", "==", farmlandName));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data().farmland_id; // Get the farmland_id
    }
    
    return null;
}

window.saveProject = async function() {
    try {
        // Get input values
        const projectName = document.getElementById('project-name').value.trim();
        const assignToSelect = document.getElementById('assign-to');
        const farmPresidentName = assignToSelect.options[assignToSelect.selectedIndex].text;
        const status = document.getElementById('status').value;
        const cropName = document.getElementById('crops').value;
        const barangayName = document.getElementById('barangay').value.trim();
        const farmlandSelect = document.getElementById('farmland');
        const farmlandName = farmlandSelect.options[farmlandSelect.selectedIndex].text;
        const farmlandId = await getFarmlandId(farmlandName);

        const cropTypeName = document.getElementById('crop-type').value;
        let weightCropType = document.getElementById('weight-crop-type').value.trim();
        const fertilizerType = document.getElementById('fertilizer-type').value;
        let weightFertilizerType = document.getElementById('weight-fertilizer-type').value.trim();
        const equipment = document.getElementById('equipment').value;
        
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        // ✅ **Check if required fields are empty**
        if (!projectName || !farmPresidentName || !cropName || !barangayName || 
            !farmlandName || !cropTypeName || !weightCropType ||
            !fertilizerType || !weightFertilizerType ||
            !equipment || !startDate || !endDate) {
            alert("⚠️ Please fill out all required fields before saving.");
            return;
        }

        // Ensure weights end with 'kg'
        if (!weightCropType.endsWith("kg")) {
            weightCropType += "kg";
        }
        if (!weightFertilizerType.endsWith("kg")) {
            weightFertilizerType += "kg";
        }

        const projectID = await getNextProjectID();

        const projectData = {
            project_id: projectID, 
            project_name: projectName,
            farm_president: farmPresidentName,
            status: status,
            crop_name: cropName,
            barangay_name: barangayName,
            farm_land: farmlandName,
            farmland_id: farmlandId,
            crop_type_name: cropTypeName,
            weight_crop_type: weightCropType,
            fertilizer_type: fertilizerType,
            weight_fertilizer_type: weightFertilizerType,
            equipment: equipment,
            start_date: startDate,
            end_date: endDate,
            date_created: new Date()
        };

        await addDoc(collection(db, "tb_projects"), projectData);
        alert("✅ Project saved successfully!");
        resetForm();
    } catch (error) {
        console.error("❌ Error saving project: ", error);
        alert("Failed to save project. Please try again.");
    }
}


        //PAMBURA
        window.resetForm = function() {
            document.getElementById('project-name').value = "";
            document.getElementById('assign-to').selectedIndex = 0;
            document.getElementById('status').value = "pending";
            document.getElementById('crops').selectedIndex = 0;
            document.getElementById('barangay').value = "";
            document.getElementById('farmland').innerHTML = '<option value="">Select Farmland</option>';
            document.getElementById('crop-type').innerHTML = '<option value="">Select Crop Type</option>';
            document.getElementById('weight-crop-type').value = "";
            document.getElementById('fertilizer-type').selectedIndex = 0;
            document.getElementById('weight-fertilizer-type').value = "";
            document.getElementById('equipment').selectedIndex = 0;
            document.getElementById('start-date').value = "";
            document.getElementById('end-date').value = "";
        }




        document.getElementById('save-button').addEventListener('click', saveProject);

        //CANCEL BUTTON NAKA COMMENT MUNA
        /*document.getElementById('cancel-button').addEventListener('click', function() {
            window.location.href = "index.html";
        });*/

        // Event listeners for select elements
        document.getElementById('assign-to').addEventListener('change', function() {
            loadBarangay(this.value);
        });

        document.getElementById('crops').addEventListener('change', function() {
            loadCropTypes(this.value);
        });

        // Save and Cancel button functionality
        //document.getElementById('save-button').addEventListener('click', function() {
            //alert("Form has been saved!");
        //});

        document.getElementById('cancel-button').addEventListener('click', function() {
            window.location.href = "index.html"; // Redirect to the homepage or previous page
        });

        window.onload = function() {
            loadFarmPresidents();
            loadCrops();
            loadFertilizers();
            loadEquipment();
        };