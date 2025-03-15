import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    getDoc,
    query,
    where,
    getFirestore
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth();

// <--------------------------> FUNCTION TO GET AUTHENTICATED USER <-------------------------->
async function getAuthenticatedUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
                    const userSnapshot = await getDocs(userQuery);

                    if (!userSnapshot.empty) {
                        const userData = userSnapshot.docs[0].data();
                        console.log("Authenticated user data:", userData); // Debugging line
                        resolve(userData.user_type); // Return ONLY user_type
                    } else {
                        console.error("User record not found in tb_users collection.");
                        reject("User record not found.");
                    }
                } catch (error) {
                    console.error("Error fetching user_name:", error);
                    reject(error);
                }
            } else {
                console.error("User not authenticated. Please log in.");
                reject("User not authenticated.");
            }
        });
    });
}

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE and ERROR MESSAGES ------------------------>
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;

const deleteMessage = document.getElementById("delete-message");
let messageQueue = [];
let isMessageShowing = false;

function showDeleteMessage(message, success) {
    messageQueue.push({ message, success });

    if (!isMessageShowing) {
        processMessageQueue();
    }
}

function processMessageQueue() {
    if (messageQueue.length === 0) {
        isMessageShowing = false;
        return;
    }

    isMessageShowing = true;
    const { message, success } = messageQueue.shift();

    deleteMessage.textContent = message;
    deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
    deleteMessage.style.opacity = '1';
    deleteMessage.style.display = 'block';

    setTimeout(() => {
        deleteMessage.style.opacity = '0';
        setTimeout(() => {
            deleteMessage.style.display = 'none';
            processMessageQueue(); // Show the next message after this one disappears
        }, 400);
    }, 4000);
}


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
            if (data && data.fertilizer_type) { // Ensure it exists before using trim()
                const fertilizerType = data.fertilizer_type.trim();

                if (!uniqueFertilizerTypes.has(fertilizerType)) {
                    const option = document.createElement('option');
                    option.value = fertilizerType;
                    option.textContent = fertilizerType;
                    fertilizerCategorySelect.appendChild(option);
                    uniqueFertilizerTypes.add(fertilizerType);
                }
            } else {
                console.warn(`Missing fertilizer_type in document: ${doc.id}`);
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
        const q = query(collection(db, "tb_fertilizer"), where("fertilizer_type", "==", selectedFertilizerType));
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

// <----------------------------> Function To populate fields <----------------------------> //
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
                //document.getElementById("fertilizer-name").value = project.fertilizer_name || "";
                //document.getElementById("fertilizer-category").value = project.fertilizer_type || "";
                document.getElementById("quantity-fertilizer-type").value = project.quantity_fertilizer_type || "";
                document.getElementById("fertilizer-unit").value = project.fertilizer_unit || "";
                document.getElementById("start-date").value = project.start_date || "";
                document.getElementById("end-date").value = project.end_date || "";

                loadEquipment(project.equipment);
                loadFarmPresidents(project.farm_president);
                loadFarmlands(selectedFarmland);
                loadCropNamesAndTypes(selectedCropName, selectedCropTypeName);
                loadFertilizerCategories(project.fertilizer_type || "");
                loadFertilizerNames(project.fertilizer_type || "");

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
document.addEventListener("DOMContentLoaded", async () => {
    const cancelButton = document.getElementById("cancel-button");
    if (cancelButton) {
        cancelButton.addEventListener("click", () => {
            window.location.href = "admin_projects_list.html";
        });
    } else {
        console.error("Cancel button not found! Check your HTML.");
    }

    let initialQuantityCropType = 0;
    let initialQuantityFertilizerType = 0;

    // Get project ID from localStorage
    const projectData = JSON.parse(localStorage.getItem("projectData"));
    if (!projectData || !projectData.project_id) {
        alert("Project data is missing in localStorage.");
        window.location.href = "admin_projects_list.html";
        return;
    }
    const projectId = projectData.project_id;

    try {
        const projectsRef = collection(db, "tb_projects");
        const querySnapshot = await getDocs(query(projectsRef, where("project_id", "==", projectId)));

        if (!querySnapshot.empty) {
            const projectDoc = querySnapshot.docs[0].data();
            initialQuantityCropType = projectDoc.quantity_crop_type || 0;
            initialQuantityFertilizerType = projectDoc.quantity_fertilizer_type || 0;
        } else {
            alert("Project not found in the database.");
            window.location.href = "admin_projects_list.html";
            return;
        }
    } catch (error) {
        console.error("Error fetching initial project data:", error);
        alert("An error occurred while fetching project data.");
        window.location.href = "admin_projects_list.html";
        return;
    }

    const saveButton = document.getElementById("save-button");
    if (saveButton) {
        saveButton.addEventListener("click", async () => {
            console.log("Save button clicked!");
    
            try {
                const userType = await getAuthenticatedUser(); // Assuming this function exists
    
                // Query Firestore again to get the document reference
                const querySnapshot = await getDocs(query(collection(db, "tb_projects"), where("project_id", "==", projectId)));
    
                if (querySnapshot.empty) {
                    alert("Project not found in the database.");
                    window.location.href = "admin_projects_list.html";
                    return;
                }
    
                const projectDoc = querySnapshot.docs[0];
                const projectRef = doc(db, "tb_projects", projectDoc.id);
    
                // Fetch form values
                const projectName = document.getElementById("project-name")?.value.trim();
                const cropName = document.getElementById("crops")?.value.trim();
                const cropTypeName = document.getElementById("crop-type")?.value.trim();
                const quantityCropType = parseInt(document.getElementById("quantity-crop-type")?.value) || 0;
    
                const fertilizerType = document.getElementById("fertilizer-category")?.value.trim();
                const fertilizerName = document.getElementById("fertilizer-name")?.value.trim();
                const quantityFertilizerType = parseInt(document.getElementById("quantity-fertilizer-type")?.value) || 0;
    
                const status = document.getElementById("status")?.value.trim();
                const startDate = document.getElementById("start-date")?.value;
                const endDate = document.getElementById("end-date")?.value;
    
                // Basic validation
                if (!projectName || !cropName || !cropTypeName || !status || !startDate || !endDate) {
                    alert("Please fill in all required fields.");
                    return;
                }
    
                // Check if there are changes in quantity fields
                const cropChanged = quantityCropType !== initialQuantityCropType;
                const fertilizerChanged = quantityFertilizerType !== initialQuantityFertilizerType;
    
                let cropStockUpdated = true;
                let fertilizerStockUpdated = true;
    
                // Validate stock BEFORE updating project data
                if (cropChanged && typeof updateStock === "function") {
                    cropStockUpdated = await updateStock("tb_crop_stock", cropTypeName, cropName, quantityCropType, initialQuantityCropType, userType);
                }
    
                if (fertilizerChanged && typeof updateStock === "function") {
                    fertilizerStockUpdated = await updateStock("tb_fertilizer_stock", fertilizerType, fertilizerName, quantityFertilizerType, initialQuantityFertilizerType, userType);
                }
    
                // Stop if stock validation fails
                if (!cropStockUpdated || !fertilizerStockUpdated) {
                    alert("Stock update failed. Cancelling project update.");
                    return;
                }

                // Check if there are any changes before proceeding
                const hasChanges = projectName !== projectDoc.project_name ||
                    cropName !== projectDoc.crop_name ||
                    cropTypeName !== projectDoc.crop_type_name ||
                    quantityCropType !== initialQuantityCropType ||
                    fertilizerType !== projectDoc.fertilizer_type ||
                    fertilizerName !== projectDoc.fertilizer_name ||
                    quantityFertilizerType !== initialQuantityFertilizerType ||
                    status !== projectDoc.status ||
                    startDate !== projectDoc.start_date ||
                    endDate !== projectDoc.end_date;
    
                const updateData = {};
                if (projectName) updateData.project_name = projectName;
                if (cropName) updateData.crop_name = cropName;
                if (cropTypeName) updateData.crop_type_name = cropTypeName;
                if (cropChanged) updateData.quantity_crop_type = quantityCropType;
                if (fertilizerType) updateData.fertilizer_type = fertilizerType;
                if (fertilizerName) updateData.fertilizer_name = fertilizerName;
                if (fertilizerChanged) updateData.quantity_fertilizer_type = quantityFertilizerType;
                if (status) updateData.status = status;
                if (startDate) updateData.start_date = startDate;
                if (endDate) updateData.end_date = endDate;
    
                if (hasChanges) {
                    await updateDoc(projectRef, updateData);
                    console.log("Project data updated successfully!");
                    // Store success message in localStorage
                    localStorage.setItem("successMessage", "Project updated successfully!");
                } else {
                    // If no changes were made
                    localStorage.setItem("successMessage", "No Changes Made");
                }
    
                // Redirect to Admin Projects List
                window.location.href = "admin_projects_list.html";
    
            } catch (error) {
                console.error("Error updating project:", error);
                alert("An error occurred while updating the project. Please try again.");
                window.location.href = "admin_projects_list.html";
            }
        });
    } else {
        console.error("Save button not found! Check your HTML.");
    }
});    

// Function to update inventory stock
async function updateStock(collectionName, type, name, newQuantity, initialQuantity, userType) {
    try {
        // Determine field names dynamically
        const typeField = collectionName === "tb_crop_stock" ? "crop_type_name" : "fertilizer_type";
        const nameField = collectionName === "tb_crop_stock" ? "crop_name" : "fertilizer_name";

        // Query Firestore
        const q = query(collection(db, collectionName), 
            where(typeField, "==", type), 
            where(nameField, "==", name)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`No Stock Value found for ${type} - ${name} in ${collectionName}`);
            showDeleteMessage(`No Stock Value found for ${type} - ${name}.`, false);
            return false;
        }

        let updateAllowed = true; // Flag to track if update can proceed
        let updateSucceeded = false; // Flag to track if any update succeeds

        for (const docSnapshot of querySnapshot.docs) {
            const stockData = docSnapshot.data();
            const updatedStocks = stockData.stocks.map(stock => {
                if (stock.owned_by === userType) {
                    const difference = newQuantity - initialQuantity;
                    const currentStock = stock.current_stock || 0;

                    // Validation checks
                    if (newQuantity < 0) {
                        showDeleteMessage(`Error: Quantity for ${name} cannot be negative.`, false);
                        updateAllowed = false;
                        return stock;
                    }

                    if (difference > 0 && difference > currentStock) {
                        showDeleteMessage(`Error: Cannot increase quantity of ${name} (${type}) beyond available stock (${currentStock}).`, false);
                        updateAllowed = false;
                        return stock;
                    }

                    if (difference < 0 && Math.abs(difference) > initialQuantity) {
                        showDeleteMessage(`Error: Cannot decrease quantity of ${name} (${type}) below zero.`, false);
                        updateAllowed = false;
                        return stock;
                    }

                    updateSucceeded = true; // Mark that an update is successful
                    return { ...stock, current_stock: currentStock - difference };
                }
                return stock;
            });

            if (updateAllowed && updateSucceeded) {
                await updateDoc(doc(db, collectionName, docSnapshot.id), { stocks: updatedStocks });
                console.log(`Updated Stock for ${type} - ${name} in ${collectionName}, owned by ${userType}`);
            }
        }

        return updateSucceeded; // Return whether any update succeeded

    } catch (error) {
        console.error(`Error updating ${collectionName} inventory:`, error);
        return false;
    }
}
