import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    writeBatch
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

let deleteItemId = null;
let deleteItemCollection = null;

// Function to display custom messages
function showCustomMessage(message, success) {
    const messageDiv = document.getElementById('custom-message');
    const messageText = document.getElementById('custom-message-text');
    messageText.textContent = message;
    messageDiv.style.backgroundColor = success ? '#41A186' : '#f44336';
    messageDiv.style.opacity = '1';
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 400);
    }, 4000);
}

window.openAddBarangayPopup = function() {
    document.getElementById('add-barangay-popup').style.display = 'block';
};

window.openAddCropTypePopup = function() {
    document.getElementById('add-crop-type-popup').style.display = 'block';
    loadCropNames();
};

window.loadCropNames = async function() {
    const cropNameSelect = document.getElementById('crop-name');
    
    // Clear existing options and add default "Select Crop Name" option
    cropNameSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Crop Name';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    cropNameSelect.appendChild(defaultOption);

    try {
        const snapshot = await getDocs(collection(db, 'tb_crops'));
        snapshot.forEach(doc => {
            const cropData = doc.data();
            const option = document.createElement('option');
            option.value = cropData.crop_name;
            option.textContent = cropData.crop_name;
            cropNameSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading crop names:', error);
        showCustomMessage('Failed to load crop names', false);
    }
};

window.openAddEquipmentPopup = function() {
    document.getElementById('add-equipment-popup').style.display = 'block';
    loadEquipmentTypes();
};

window.loadEquipmentTypes = async function() {
    const equipmentCategorySelect = document.getElementById('equipment-category');
    
    // Clear existing options and add default option
    equipmentCategorySelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Equipment Category';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    equipmentCategorySelect.appendChild(defaultOption);

    try {
        const snapshot = await getDocs(collection(db, 'tb_equipment_types'));
        snapshot.forEach(doc => {
            const equipmentData = doc.data();
            const option = document.createElement('option');
            option.value = equipmentData.equipment_type_name;
            option.textContent = equipmentData.equipment_type_name;
            equipmentCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading equipment types:', error);
        showCustomMessage('Failed to load equipment categories', false);
    }
};

window.openAddFertilizerPopup = function() {
    document.getElementById('add-fertilizer-popup').style.display = 'block';
    loadFertilizerTypes();
};

window.loadFertilizerTypes = async function() {
    const fertilizerCategorySelect = document.getElementById('fertilizer-category');
    
    // Clear existing options and add default option
    fertilizerCategorySelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Fertilizer Type';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    fertilizerCategorySelect.appendChild(defaultOption);

    try {
        const snapshot = await getDocs(collection(db, 'tb_fertilizer_types'));
        snapshot.forEach(doc => {
            const fertilizerData = doc.data();
            const option = document.createElement('option');
            option.value = fertilizerData.fertilizer_type_name;
            option.textContent = fertilizerData.fertilizer_type_name;
            fertilizerCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading fertilizer types:', error);
        showCustomMessage('Failed to load fertilizer types', false);
    }
};

window.initializeCounters = async function() {
    const counters = ['brgy_id_counter', 'crop_type_id_counter', 'equipment_id_counter', 
        'fertilizer_id_counter', 'farmland_id_counter'];

    for (let counter of counters) {
        const docRef = doc(db, 'tb_id_counters', counter);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            await setDoc(docRef, { count: 0 });
        }
    }
};

window.getNextId = async function(counterName) {
    const counterRef = doc(db, 'tb_id_counters', counterName);
    const docSnap = await getDoc(counterRef);
    
    if (docSnap.exists()) {
        const currentCount = docSnap.data().count;
        const nextId = currentCount + 1;

        await updateDoc(counterRef, { count: nextId });
        return nextId;
    } else {
        console.error(`Counter ${counterName} not found!`);
        return null;
    }
};

/**
 * Populates the barangay dropdown without duplicates
 */
window.populateBarangayDropdown = async function() {
    const barangaySelect = document.getElementById('barangay-select');
    if (!barangaySelect) {
        console.error('Barangay select element not found.');
        return;
    }

    // Clear existing options and add default option
    barangaySelect.innerHTML = '<option value="">Select Barangay</option>';

    try {
        onSnapshot(collection(db, 'tb_barangay'), (snapshot) => {
            // Clear existing options except the default one
            barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
            const uniqueBarangays = new Set();

            snapshot.forEach(doc => {
                const data = doc.data();
                const barangayName = data.barangay_name.trim();

                if (barangayName && !uniqueBarangays.has(barangayName)) {
                    uniqueBarangays.add(barangayName);
                    const option = document.createElement('option');
                    option.value = barangayName;
                    option.textContent = barangayName;
                    barangaySelect.appendChild(option);
                }
            });
        }, (error) => {
            console.error("Error listening to barangays:", error);
            showCustomMessage("Failed to load barangays.", false);
        });
    } catch (error) {
        console.error("Error setting up listener for barangays:", error);
        showCustomMessage("Failed to load barangays.", false);
    }
};

window.addEventListener('load', async () => {
    await window.populateBarangayDropdown();
});

window.fetchData = function(collectionName, listId, field) {
    const listContainer = document.getElementById(listId);
    if (!listContainer) {
        console.error(`List container with ID ${listId} not found.`);
        return;
    }

    // Clear the list initially
    listContainer.innerHTML = '';

    try {
        // Use onSnapshot to listen for real-time updates
        onSnapshot(collection(db, collectionName), (snapshot) => {
            // Clear the list on each update to avoid duplicates
            listContainer.innerHTML = '';

            if (snapshot.empty) {
                listContainer.innerHTML = '<p>No items found.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('item');
                itemDiv.innerHTML = `
                    <span>${data[field] || 'Unnamed'}</span>
                    <div class="actions">
                        <img src="/public/images/Edit.png" alt="Edit" class="action-icon" onclick="editItem('${collectionName}', '${doc.id}', '${data[field] || ''}')">
                        <img src="/public/images/Delete.png" alt="Delete" class="action-icon" onclick="deleteItem('${collectionName}', '${doc.id}')">
                    </div>
                `;
                listContainer.appendChild(itemDiv);
            });
        }, (error) => {
            console.error(`Error listening to ${collectionName}: `, error);
            listContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
        });
    } catch (error) {
        console.error(`Error setting up listener for ${collectionName}: `, error);
        listContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
    }
};

// Update loadData() to include farmlands
window.loadData = function() {
    fetchData('tb_barangay', 'barangay-list', 'barangay_name');
    fetchData('tb_crop_types', 'crop-type-list', 'crop_type_name');
    fetchData('tb_equipment', 'equipment-list', 'equipment_name');
    fetchData('tb_fertilizer', 'fertilizer-list', 'fertilizer_name');
    fetchData('tb_farmland', 'farmland-list', 'farmland_name'); // +++ New
};

document.addEventListener("DOMContentLoaded", loadData);





/**
 * Checks if a record with the specified field value exists in the collection
 * @param {string} collectionName - Firestore collection name
 * @param {string} fieldName - Field to check for duplicates
 * @param {string} value - Value to check
 * @param {string} [excludeDocId] - Optional document ID to exclude from the check
 * @returns {Promise<boolean>} - True if duplicate exists, false otherwise
 */
window.checkForDuplicate = async function(collectionName, fieldName, value, excludeDocId = null) {
    try {
        const q = query(collection(db, collectionName), where(fieldName, '==', value.trim()));
        const querySnapshot = await getDocs(q);
        
        if (excludeDocId) {
            // Return true if any document matches the value, excluding the specified doc ID
            return querySnapshot.docs.some(doc => doc.id !== excludeDocId);
        }
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error(`Error checking for duplicate in ${collectionName}:`, error);
        return false; // Return false to allow operation to proceed safely on error
    }
};





window.editItem = function(collection, id, name) {
    // Validate inputs
    if (!collection || !id || name === undefined) {
        console.error('Invalid edit parameters:', { collection, id, name });
        showCustomMessage('Cannot edit this item', false);
        return;
    }

    // Sanitize name display (prevent XSS and trim)
    const sanitizedName = name.toString().trim()
        .replace(/</g, '<')
        .replace(/>/g, '>');

    // Set form values
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-collection').value = collection;
    const nameInput = document.getElementById('edit-item-name');
    nameInput.value = sanitizedName;

    // Disable save button by default
    const saveButton = document.querySelector('#edit-item-popup .btn-primary');
    saveButton.disabled = true;

    // Store initial name for comparison
    const initialName = sanitizedName;

    // Add input event listener to enable/disable save button
    nameInput.addEventListener('input', function() {
        saveButton.disabled = nameInput.value.trim() === initialName;
    });

    // Show popup
    openPopup('edit-item-popup');
};

// Save edit (unchanged, included for completeness)
window.saveEditedItem = async function() {
    const id = document.getElementById('edit-item-id').value;
    const collectionName = document.getElementById('edit-item-collection').value;
    const newName = document.getElementById('edit-item-name').value.trim();

    // Validate inputs
    if (!newName) {
        showCustomMessage('Name cannot be empty', false);
        return;
    }

    const fieldMap = {
        'tb_barangay': 'barangay_name',
        'tb_crop_types': 'crop_type_name',
        'tb_fertilizer': 'fertilizer_name',
        'tb_equipment': 'equipment_name',
        'tb_farmland': 'farmland_name'
    };

    const fieldToUpdate = fieldMap[collectionName];

    if (!fieldToUpdate) {
        showCustomMessage('Invalid collection type', false);
        return;
    }

    try {
        // Check for duplicate name, excluding the current document
        const isDuplicate = await checkForDuplicate(collectionName, fieldToUpdate, newName, id);
        if (isDuplicate) {
            showCustomMessage(`${fieldToUpdate.replace('_', ' ')} already exists!`, false);
            return;
        }

        // Additional checks for collections with composite uniqueness (e.g., crop type + crop name)
        if (collectionName === 'tb_crop_types') {
            // Fetch the current crop type to get its crop_name
            const cropTypeDoc = await getDoc(doc(db, collectionName, id));
            if (!cropTypeDoc.exists()) {
                showCustomMessage('Crop type not found!', false);
                return;
            }
            const cropName = cropTypeDoc.data().crop_name;
            const q = query(collection(db, collectionName), 
                where('crop_type_name', '==', newName), 
                where('crop_name', '==', cropName));
            const querySnapshot = await getDocs(q);
            const isDuplicateCombo = querySnapshot.docs.some(doc => doc.id !== id);
            if (isDuplicateCombo) {
                showCustomMessage('This crop type name and crop name combination already exists!', false);
                return;
            }
        } else if (collectionName === 'tb_equipment') {
            // Fetch the current equipment to get its category
            const equipmentDoc = await getDoc(doc(db, collectionName, id));
            if (!equipmentDoc.exists()) {
                showCustomMessage('Equipment not found!', false);
                return;
            }
            const category = equipmentDoc.data().equipment_category;
            const q = query(collection(db, collectionName), 
                where('equipment_name', '==', newName), 
                where('equipment_category', '==', category));
            const querySnapshot = await getDocs(q);
            const isDuplicateCombo = querySnapshot.docs.some(doc => doc.id !== id);
            if (isDuplicateCombo) {
                showCustomMessage('This equipment name and category combination already exists!', false);
                return;
            }
        } else if (collectionName === 'tb_fertilizer') {
            // Fetch the current fertilizer to get its type
            const fertilizerDoc = await getDoc(doc(db, collectionName, id));
            if (!fertilizerDoc.exists()) {
                showCustomMessage('Fertilizer not found!', false);
                return;
            }
            const fertilizerType = fertilizerDoc.data().fertilizer_type;
            const q = query(collection(db, collectionName), 
                where('fertilizer_name', '==', newName), 
                where('fertilizer_type', '==', fertilizerType));
            const querySnapshot = await getDocs(q);
            const isDuplicateCombo = querySnapshot.docs.some(doc => doc.id !== id);
            if (isDuplicateCombo) {
                showCustomMessage('This fertilizer name and type combination already exists!', false);
                return;
            }
        } else if (collectionName === 'tb_farmland') {
            // Fetch the current farmland to get its barangay_name
            const farmlandDoc = await getDoc(doc(db, collectionName, id));
            if (!farmlandDoc.exists()) {
                showCustomMessage('Farmland not found!', false);
                return;
            }
            const barangayName = farmlandDoc.data().barangay_name;
            const q = query(collection(db, collectionName), 
                where('farmland_name', '==', newName), 
                where('barangay_name', '==', barangayName));
            const querySnapshot = await getDocs(q);
            const isDuplicateCombo = querySnapshot.docs.some(doc => doc.id !== id);
            if (isDuplicateCombo) {
                showCustomMessage('This farmland name already exists in the selected barangay!', false);
                return;
            }
        }

        // Update the document
        await updateDoc(doc(db, collectionName, id), { [fieldToUpdate]: newName });

        showCustomMessage('Item updated successfully', true);
        closePopup('edit-item-popup');
    } catch (error) {
        console.error('Error updating item:', error);
        showCustomMessage('Error updating item. Please try again.', false);
    }
};


window.deleteItem = function(collection, id) {
    deleteItemCollection = collection;
    deleteItemId = id;
    openPopup('delete-confirm-popup');
};

window.confirmDelete = function() {
    if (deleteItemId && deleteItemCollection) {
        deleteDoc(doc(db, deleteItemCollection, deleteItemId)).then(() => {
            showCustomMessage('Item deleted successfully', true);
            closePopup('delete-confirm-popup');
        }).catch(error => {
            console.error('Error deleting item:', error);
            showCustomMessage('Error deleting item. Please try again.', false);
        });
    }
};

window.closePopup = function(id) {
    document.getElementById(id).style.display = 'none';
};

window.openPopup = function(id) {
    document.getElementById(id).style.display = 'block';
};

function clearBarangayInputs() {
    document.getElementById('barangay-name').value = '';
    document.getElementById('total-plot-size').value = '';
    document.getElementById('land-area').value = '';
    document.getElementById('plot-size').value = '';
}

window.addBarangay = async function() {
    const barangayName = document.getElementById('barangay-name').value.trim();
    const totalPlotSize = parseFloat(document.getElementById('total-plot-size').value);
    const landArea = document.getElementById('land-area').value.trim();
    const plotSize = parseFloat(document.getElementById('plot-size').value);
    const dateCreated = new Date().toISOString();

    // Validate inputs
    if (!barangayName || isNaN(totalPlotSize) || !landArea || isNaN(plotSize)) {
        showCustomMessage('All fields are required, and numeric fields must be valid numbers!', false);
        return;
    }

    try {
        // Check for duplicate barangay name
        const isDuplicateBarangay = await checkForDuplicate('tb_barangay', 'barangay_name', barangayName);
        if (isDuplicateBarangay) {
            showCustomMessage('Barangay name already exists!', false);
            return;
        }

        // Check for duplicate farmland name (landArea is used as farmland_name)
        const isDuplicateFarmland = await checkForDuplicate('tb_farmland', 'farmland_name', landArea);
        if (isDuplicateFarmland) {
            showCustomMessage('Farmland name already exists!', false);
            return;
        }

        const nextBrgyId = await getNextId('brgy_id_counter');
        const nextFarmlandId = await getNextId('farmland_id_counter');

        if (nextBrgyId === null || nextFarmlandId === null) {
            showCustomMessage('Error generating IDs. Please try again.', false);
            return;
        }

        const barangayData = {
            barangay_id: nextBrgyId,
            barangay_name: barangayName,
            total_plot_size: totalPlotSize,
            land_area: parseInt(landArea),
            plot_area: parseInt(plotSize),
            dateCreated
        };

        const farmlandData = {
            farmland_id: nextFarmlandId,
            barangay_id: nextBrgyId,
            barangay_name: barangayName,
            farmland_name: landArea,
            plot_area: parseInt(plotSize),
            dateCreated
        };

        const batch = writeBatch(db);
        const barangayRef = doc(collection(db, 'tb_barangay'));
        const farmlandRef = doc(collection(db, 'tb_farmland'));

        batch.set(barangayRef, barangayData);
        batch.set(farmlandRef, farmlandData);

        await batch.commit();

        showCustomMessage('Barangay and farmland added successfully', true);
        clearBarangayInputs();
        closePopup('add-barangay-popup');
    } catch (error) {
        console.error('Error adding barangay and farmland:', error);
        showCustomMessage('Error adding barangay and farmland. Please try again.', false);
    }
};

function clearCropInputs() {
    document.getElementById('crop-type-name').value = '';
    document.getElementById('crop-name').selectedIndex = 0;
}

window.addCropType = async function() {
    const cropTypeName = document.getElementById('crop-type-name').value.trim();
    const cropName = document.getElementById('crop-name').value.trim();
    const dateAdded = new Date().toISOString();

    // Validate inputs
    if (!cropTypeName || !cropName) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    try {
        // Check for duplicate crop type name
        const isDuplicateCropType = await checkForDuplicate('tb_crop_types', 'crop_type_name', cropTypeName);
        if (isDuplicateCropType) {
            showCustomMessage('Crop type name already exists!', false);
            return;
        }

        // Additional check for crop type and crop name combination
        const q = query(collection(db, 'tb_crop_types'), 
            where('crop_type_name', '==', cropTypeName), 
            where('crop_name', '==', cropName));
        const existingCropType = await getDocs(q);
        if (!existingCropType.empty) {
            showCustomMessage('This crop type and crop name combination already exists!', false);
            return;
        }

        // Verify crop name exists
        const cropQuery = query(collection(db, 'tb_crops'), where('crop_name', '==', cropName));
        const cropSnapshot = await getDocs(cropQuery);
        let cropNameId = null;
        cropSnapshot.forEach(doc => {
            cropNameId = doc.id;
        });

        if (!cropNameId) {
            showCustomMessage('Crop name not found!', false);
            return;
        }

        const nextCropTypeId = await getNextId('crop_type_id_counter');
        if (nextCropTypeId === null) {
            showCustomMessage('Error generating crop type ID. Please try again.', false);
            return;
        }

        await addDoc(collection(db, 'tb_crop_types'), {
            crop_type_id: nextCropTypeId,
            crop_type_name: cropTypeName,
            crop_name: cropName,
            crop_name_id: cropNameId,
            current_stock: 0,
            unit: "kg",
            dateAdded
        });

        showCustomMessage('Crop Type added successfully', true);
        clearCropInputs();
        closePopup('add-crop-type-popup');
    } catch (error) {
        console.error('Error adding crop type:', error);
        showCustomMessage('Error adding crop type. Please try again.', false);
    }
};

function clearEquipmentInputs() {
    document.getElementById('equipment-name').value = '';
    document.getElementById('equipment-category').selectedIndex = 0;
}

window.addEquipment = async function() {
    const equipmentName = document.getElementById('equipment-name').value.trim();
    const category = document.getElementById('equipment-category').value.trim();
    const dateAdded = new Date().toISOString();

    // Validate inputs
    if (!equipmentName || !category) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    try {
        // Check for duplicate equipment name
        const isDuplicateEquipment = await checkForDuplicate('tb_equipment', 'equipment_name', equipmentName);
        if (isDuplicateEquipment) {
            showCustomMessage('Equipment name already exists!', false);
            return;
        }

        // Additional check for equipment name and category combination
        const q = query(collection(db, 'tb_equipment'), 
            where('equipment_name', '==', equipmentName), 
            where('equipment_category', '==', category));
        const existingEquipment = await getDocs(q);
        if (!existingEquipment.empty) {
            showCustomMessage('This equipment name and category combination already exists!', false);
            return;
        }

        const nextEquipmentId = await getNextId('equipment_id_counter');
        if (nextEquipmentId === null) {
            showCustomMessage('Error generating equipment ID. Please try again.', false);
            return;
        }

        await addDoc(collection(db, 'tb_equipment'), {
            equipment_id: nextEquipmentId,
            equipment_name: equipmentName,
            equipment_category: category,
            current_quantity: 0,
            dateAdded
        });

        showCustomMessage('Equipment added successfully', true);
        clearEquipmentInputs();
        closePopup('add-equipment-popup');
    } catch (error) {
        console.error('Error adding equipment:', error);
        showCustomMessage('Error adding equipment. Please try again.', false);
    }
};

function clearFertilizerInputs() {
    document.getElementById('fertilizer-name').value = '';
    document.getElementById('fertilizer-category').selectedIndex = 0;
}

window.addFertilizer = async function() {
    const fertilizerName = document.getElementById('fertilizer-name').value.trim();
    const fertilizerType = document.getElementById('fertilizer-category').value.trim();
    const dateAdded = new Date().toISOString();

    // Validate inputs
    if (!fertilizerName || !fertilizerType) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    try {
        // Check for duplicate fertilizer name
        const isDuplicateFertilizer = await checkForDuplicate('tb_fertilizer', 'fertilizer_name', fertilizerName);
        if (isDuplicateFertilizer) {
            showCustomMessage('Fertilizer name already exists!', false);
            return;
        }

        // Additional check for fertilizer name and type combination
        const q = query(collection(db, 'tb_fertilizer'), 
            where('fertilizer_name', '==', fertilizerName), 
            where('fertilizer_type', '==', fertilizerType));
        const existingFertilizer = await getDocs(q);
        if (!existingFertilizer.empty) {
            showCustomMessage('This fertilizer name and type combination already exists!', false);
            return;
        }

        const nextFertilizerId = await getNextId('fertilizer_id_counter');
        if (nextFertilizerId === null) {
            showCustomMessage('Error generating fertilizer ID. Please try again.', false);
            return;
        }

        await addDoc(collection(db, 'tb_fertilizer'), {
            fertilizer_id: nextFertilizerId,
            fertilizer_name: fertilizerName,
            fertilizer_type: fertilizerType,
            quantity: 0,
            unit: "kg",
            dateAdded
        });

        showCustomMessage('Fertilizer added successfully', true);
        clearFertilizerInputs();
        closePopup('add-fertilizer-popup');
    } catch (error) {
        console.error('Error adding fertilizer:', error);
        showCustomMessage('Error adding fertilizer. Please try again.', false);
    }
};

window.loadFarmlandsForBarangay = function() {
    const listContainer = document.getElementById('farmland-list');
    const barangaySelect = document.getElementById('barangay-select');
    const selectedBarangayName = barangaySelect.value.trim();

    if (!listContainer || !barangaySelect) {
        console.error('Farmland list or barangay select not found.');
        return;
    }

    // Clear the list initially
    listContainer.innerHTML = '';

    // If no barangay is selected (default "Select Barangay"), load all farmlands
    if (!selectedBarangayName) {
        // Reuse fetchData to load all farmlands
        fetchData('tb_farmland', 'farmland-list', 'farmland_name');
        return;
    }

    // If a barangay is selected, load only farmlands for that barangay
    try {
        const q = query(collection(db, 'tb_farmland'), where('barangay_name', '==', selectedBarangayName));
        onSnapshot(q, (snapshot) => {
            // Clear the list on each update to avoid duplicates
            listContainer.innerHTML = '';

            if (snapshot.empty) {
                listContainer.innerHTML = '<p>No farmlands found for this barangay.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('item');
                itemDiv.innerHTML = `
                    <span>${data.farmland_name || 'Unnamed Farmland'}</span>
                    <div class="actions">
                        <img src="../../images/Edit.png" alt="Edit" class="action-icon" onclick="editItem('tb_farmland', '${doc.id}', '${data.farmland_name}')">
                        <img src="../../images/Delete.png" alt="Delete" class="action-icon" onclick="deleteItem('tb_farmland', '${doc.id}')">
                    </div>
                `;
                listContainer.appendChild(itemDiv);
            });
        }, (error) => {
            console.error('Error listening to farmlands:', error);
            listContainer.innerHTML = '<p>Error loading farmlands. Please try again later.</p>';
        });
    } catch (error) {
        console.error('Error setting up listener for farmlands:', error);
        listContainer.innerHTML = '<p>Error loading farmlands. Please try again later.</p>';
    }
};;

document.getElementById('barangay-select').addEventListener('change', loadFarmlandsForBarangay);

window.openAddFarmlandPopup = function() {
    document.getElementById('add-farmland-popup').style.display = 'block';
};

function loadFarmlandsForBarangay() {
    let barangaySelect = document.getElementById("barangay-select");
    let addFarmlandButton = document.getElementById("add-farmland-button");

    if (barangaySelect.value) {
        addFarmlandButton.style.display = "block";
    } else {
        addFarmlandButton.style.display = "none";
    }
}

function clearFarmlandInputs() {
    document.getElementById('farmland-name').value = '';
    document.getElementById('farmland-land-area').value = '';
}

window.addFarmland = async function() {
    const barangaySelect = document.getElementById("barangay-select");
    const selectedBarangayName = barangaySelect.value.trim();
    const farmlandName = document.getElementById("farmland-name").value.trim();
    const landArea = document.getElementById("farmland-land-area").value.trim();
    const dateAdded = new Date().toISOString();

    // Validate inputs
    if (!farmlandName || !landArea) {
        showCustomMessage("All fields are required!", false);
        return;
    }

    if (!selectedBarangayName) {
        showCustomMessage("Please select a barangay.", false);
        return;
    }

    const landAreaValue = parseInt(landArea);
    if (isNaN(landAreaValue) || landAreaValue <= 0) {
        showCustomMessage("Land area must be a valid positive number!", false);
        return;
    }

    try {
        // Verify barangay exists
        const barangayQuery = query(collection(db, 'tb_barangay'), where('barangay_name', '==', selectedBarangayName));
        const barangaySnapshot = await getDocs(barangayQuery);
        if (barangaySnapshot.empty) {
            showCustomMessage("Selected barangay does not exist!", false);
            return;
        }

        const barangayDoc = barangaySnapshot.docs[0];
        const barangayData = barangayDoc.data();
        const barangayId = barangayData.barangay_id;

        // Check for duplicate farmland name within the barangay
        const farmlandQuery = query(collection(db, 'tb_farmland'), 
            where('barangay_name', '==', selectedBarangayName), 
            where('farmland_name', '==', farmlandName));
        const existingFarmland = await getDocs(farmlandQuery);
        if (!existingFarmland.empty) {
            showCustomMessage("Farmland name already exists in this barangay!", false);
            return;
        }

        const nextFarmlandId = await getNextId("farmland_id_counter");
        if (nextFarmlandId === null) {
            showCustomMessage("Error generating farmland ID. Please try again.", false);
            return;
        }

        const newFarmland = {
            farmland_id: nextFarmlandId,
            barangay_id: barangayId,
            barangay_name: selectedBarangayName,
            farmland_name: farmlandName,
            land_area: landAreaValue,
            dateAdded,
        };

        await addDoc(collection(db, 'tb_farmland'), newFarmland);

        showCustomMessage("Farmland added successfully", true);
        clearFarmlandInputs();
        // No reset of barangaySelect to retain the selected barangay
        closePopup("add-farmland-popup");
    } catch (error) {
        console.error("Error adding farmland:", error);
        showCustomMessage("Error adding farmland. Please try again.", false);
    }
};


document.getElementById('confirm-delete-button').addEventListener('click', confirmDelete);  

initializeCounters();