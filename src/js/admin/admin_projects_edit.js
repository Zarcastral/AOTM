import {
    collection,
    getDocs,
    where,
    query,
    getFirestore
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

// Function to set the selected value in dropdown
function setSelectValue(selectElement, value) {
    if (!value) return;

    const options = Array.from(selectElement.options);
    const matchedOption = options.find(option => option.value.trim().toLowerCase() === value.trim().toLowerCase());

    if (matchedOption) {
        selectElement.value = matchedOption.value;
    } else {
        console.warn(`Value "${value}" not found in select options.`);
        console.log("Available options:", options.map(opt => opt.value));
    }
}

const farmPresSelect = document.getElementById('farmpres');
const barangayInput = document.getElementById("barangay");
const farmlandSelect = document.getElementById('farmland');

// Function to populate farm president dropdown
async function loadFarmPresidents(selectedFarmPresName = "") {
    farmPresSelect.innerHTML = '<option value="">Select Farm President</option>'; // Default option

    try {
        const q = query(collection(db, "tb_farmers"), where("user_type", "==", "Farm President"));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const fullName = data.first_name.trim();
            const barangay = data.barangay_name || ""; // Get barangay
            
            // Create option element
            const option = document.createElement('option');
            option.value = fullName;
            option.textContent = fullName;
            option.setAttribute("data-barangay", barangay); // Store barangay as a data-attribute

            farmPresSelect.appendChild(option);
        });

        // Set the selected value if available
        if (selectedFarmPresName) {
            setSelectValue(farmPresSelect, selectedFarmPresName);
        }

    } catch (error) {
        console.error("Error fetching farm presidents:", error);
    }
}

// Event listener to update barangay when Farm President is selected
farmPresSelect.addEventListener("change", function() {
    const selectedOption = farmPresSelect.options[farmPresSelect.selectedIndex];
    const barangay = selectedOption.getAttribute("data-barangay") || ""; // Get barangay
    barangayInput.value = barangay;
    barangayInput.readOnly = true;
});

async function loadCropNamesAndTypes(selectedCropName = "", selectedCropTypeName = "") {
    const cropsSelect = document.getElementById('crops');
    const cropTypeSelect = document.getElementById('crop-type');
    cropsSelect.innerHTML = '<option value="">Select Crop</option>'; // Default option
    cropTypeSelect.innerHTML = '<option value="">Select Crop Type</option>'; // Default option

    try {
        const q = query(collection(db, "tb_crop_types"));
        const querySnapshot = await getDocs(q);

        let cropTypeMap = {}; // Object to store crop_name -> crop_type_name mapping

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const cropName = data.crop_name.trim();
            const cropTypeName = data.crop_type_name.trim();

            // Store crop types under their respective crop names
            if (!cropTypeMap[cropName]) {
                cropTypeMap[cropName] = [];
            }
            cropTypeMap[cropName].push(cropTypeName);

            // Populate crops dropdown (only unique crop names)
            if (!Array.from(cropsSelect.options).some(opt => opt.value === cropName)) {
                const cropOption = document.createElement('option');
                cropOption.value = cropName;
                cropOption.textContent = cropName;
                cropsSelect.appendChild(cropOption);
            }
        });

        console.log("Crop Type Mapping:", cropTypeMap);

        // Set selected crop if available
        if (selectedCropName) {
            setSelectValue(cropsSelect, selectedCropName);
            populateCropTypes(selectedCropName, cropTypeMap, selectedCropTypeName);
        }

        // Add event listener to populate crop types dynamically when a crop is selected
        cropsSelect.addEventListener('change', () => {
            populateCropTypes(cropsSelect.value, cropTypeMap);
        });

    } catch (error) {
        console.error("Error fetching crop names and types:", error);
    }
}

// Function to populate crop-type dropdown based on selected crop
function populateCropTypes(selectedCropName, cropTypeMap, selectedCropTypeName = "") {
    const cropTypeSelect = document.getElementById('crop-type');
    cropTypeSelect.innerHTML = '<option value="">Select Crop Type</option>'; // Default option

    if (cropTypeMap[selectedCropName]) {
        cropTypeMap[selectedCropName].forEach(cropTypeName => {
            const option = document.createElement('option');
            option.value = cropTypeName;
            option.textContent = cropTypeName;
            cropTypeSelect.appendChild(option);
        });
    }

    // Set selected crop type if available
    if (selectedCropTypeName) {
        setSelectValue(cropTypeSelect, selectedCropTypeName);
    }
}


async function loadFarmlands(selectedFarmland = "") {
    const barangayName = barangayInput.value.trim(); // Get barangay from input field
    farmlandSelect.innerHTML = '<option value="">Select Farmland</option>'; // Default option

    if (!barangayName) {
        console.warn("No barangay selected, farmland dropdown will not be populated.");
        return; // Stop execution if barangay is empty
    }

    try {
        // Query farmland collection where barangay_name matches the entered barangay
        const q = query(collection(db, "tb_farmland"), where("barangay_name", "==", barangayName));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`No farmlands found for barangay "${barangayName}".`);
        }

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const farmlandName = data.farmland_name.trim();

            const option = document.createElement('option');
            option.value = farmlandName;
            option.textContent = farmlandName;
            farmlandSelect.appendChild(option);
        });

        // Set the selected farmland if available
        if (selectedFarmland) {
            setSelectValue(farmlandSelect, selectedFarmland);
        }

    } catch (error) {
        console.error("Error fetching farmlands:", error);
    }
}

// Listen for changes in the barangay input field
barangayInput.addEventListener("input", function () {
    console.log(`Barangay changed to: ${barangayInput.value}`); // Debugging
    loadFarmlands(); // Reload farmlands based on updated barangay
});

// Also call loadFarmlands() when a farm president is selected
farmPresSelect.addEventListener("change", function() {
    setTimeout(() => {
        console.log("Triggering farmland load after barangay update...");
        loadFarmlands();
    }, 100); // Delay slightly to ensure barangay field is updated
});

// Function to populate fertilizer category dropdown
async function loadFertilizerCategories(selectedFertilizerType = "") {
    const fertilizerCategorySelect = document.getElementById("fertilizer-category");
    fertilizerCategorySelect.innerHTML = '<option value="">Select Fertilizer Type</option>'; // Default option

    try {
        const q = query(collection(db, "tb_fertilizer"));
        const querySnapshot = await getDocs(q);
        const uniqueFertilizerTypes = new Set();

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const fertilizerType = data.fertilizer_type_name.trim();

            if (!uniqueFertilizerTypes.has(fertilizerType)) {
                const option = document.createElement('option');
                option.value = fertilizerType;
                option.textContent = fertilizerType;
                fertilizerCategorySelect.appendChild(option);
                uniqueFertilizerTypes.add(fertilizerType);
            }
        });

        // Set the selected value if available
        if (selectedFertilizerType) {
            fertilizerCategorySelect.value = selectedFertilizerType;
            loadFertilizerNames(selectedFertilizerType); // Load names based on the selected type
        }

    } catch (error) {
        console.error("Error fetching fertilizer categories:", error);
    }
}

// Function to populate fertilizer name dropdown based on selected type
async function loadFertilizerNames(selectedFertilizerType) {
    const fertilizerNameSelect = document.getElementById("fertilizer-name");
    fertilizerNameSelect.innerHTML = '<option value="">Select Fertilizer</option>'; // Default option

    if (!selectedFertilizerType) return; // Exit if no type is selected

    try {
        const q = query(collection(db, "tb_fertilizer"), where("fertilizer_type_name", "==", selectedFertilizerType));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const fertilizerName = data.fertilizer_name.trim();

            const option = document.createElement('option');
            option.value = fertilizerName;
            option.textContent = fertilizerName;
            fertilizerNameSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error fetching fertilizer names:", error);
    }
}

// Event listener to update fertilizer names when category changes
document.getElementById("fertilizer-category").addEventListener("change", (event) => {
    const selectedType = event.target.value;
    loadFertilizerNames(selectedType);
});

// Function to populate equipment dropdown
async function loadEquipment(selectedEquipment = "") {
    const equipmentSelect = document.getElementById("equipment");
    equipmentSelect.innerHTML = '<option value="">Select Equipment</option>'; // Default option

    try {
        const q = query(collection(db, "tb_equipment"));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const equipmentName = data.equipment_name.trim();

            // Create option element
            const option = document.createElement('option');
            option.value = equipmentName;
            option.textContent = equipmentName;

            equipmentSelect.appendChild(option);
        });

        // Set the selected value if available
        if (selectedEquipment) {
            equipmentSelect.value = selectedEquipment;
        }

    } catch (error) {
        console.error("Error fetching equipment names:", error);
    }
}

// <----------------------------> Funtion To populate fields <----------------------------> //
document.addEventListener("DOMContentLoaded", async () => {
    // Retrieve project data from local storage
    const projectData = JSON.parse(localStorage.getItem("projectData"));

    if (!projectData) {
        console.error("No project data found.");
        return;
    }
    try {
        const projectId = Number(projectData.project_id);
        const q = query(collection(db, "tb_projects"), where("project_id", "==", projectId));
        const querySnapshot = await getDocs(q);


        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const project = doc.data();

                let selectedCropName = project.crop_name || "";
                let selectedCropTypeName = project.crop_type_name || "";
                let selectedFarmland = project.farm_land || "";
                
                const projectName = document.getElementById("project-name");
                projectName.value = project.project_name || "Project Name not recorded";
                projectName.readOnly = true;

                document.getElementById("status").value = project.status || "Pending";

                const barangay = document.getElementById("barangay");
                barangay.value = project.barangay_name || "";
                barangay.readOnly = true;
                
                document.getElementById("crop-unit").value = project.crop_unit || "";
                document.getElementById("quantity-crop-type").value = project.quantity_crop_type || "";
                document.getElementById("fertilizer-name").value = project.fertilizer_name || "";
                document.getElementById("quantity-fertilizer-type").value = project.quantity_fertilizer_type || "";
                document.getElementById("fertilizer-unit").value = project.fertilizer_unit || "";
                document.getElementById("start-date").value = project.start_date || "";
                document.getElementById("end-date").value = project.end_date || "";

                loadEquipment(project.equipment);
                loadFarmPresidents(project.farm_president);
                loadFarmlands(selectedFarmland);
                loadCropNamesAndTypes(selectedCropName, selectedCropTypeName);
                loadFertilizerCategories(project.fertilizer_type_name || "");

            });
        } else {
            console.error("No matching project found.");
        }

    } catch (error) {
        console.error("Error fetching project details:", error);
    }

    const cancelButton = document.getElementById("cancel-button");
    cancelButton.addEventListener("click", () => {
        window.location.href = "admin_projects_list.html";
    });
});