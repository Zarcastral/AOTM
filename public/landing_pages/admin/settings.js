const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
        const snapshot = await db.collection('tb_crops').get();
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
        const snapshot = await db.collection('tb_equipment_types').get();
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
        const snapshot = await db.collection('tb_fertilizer_types').get();
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
        const docRef = db.collection('tb_id_counters').doc(counter);
        const doc = await docRef.get();

        if (!doc.exists) {
            await docRef.set({
                count: 0
            });
        }
    }
};

window.getNextId = async function(counterName) {
    const counterRef = db.collection('tb_id_counters').doc(counterName);
    const doc = await counterRef.get();
    
    if (doc.exists) {
        const currentCount = doc.data().count;
        const nextId = currentCount + 1;

        await counterRef.update({
            count: nextId
        });

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
    
    // Clear existing options (keep the default/placeholder if needed)
    barangaySelect.innerHTML = '<option value="" selected disabled>Select Barangay</option>';
    
    try {
        const snapshot = await db.collection('tb_barangay').get();
        const uniqueBarangays = new Set(); // Using Set to track unique names
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const barangayName = data.barangay_name.trim();
            
            // Only add if not already in the Set
            if (barangayName && !uniqueBarangays.has(barangayName)) {
                uniqueBarangays.add(barangayName);
                const option = document.createElement('option');
                option.value = barangayName;
                option.textContent = barangayName;
                barangaySelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error loading barangays:", error);
        showCustomMessage("Failed to load barangays.", false);
    }
};

window.onload = populateBarangayDropdown;

window.fetchData = async function(collection, listId, field) {
    const listContainer = document.getElementById(listId);
    listContainer.innerHTML = '';

    try {
        const snapshot = await db.collection(collection).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');
            itemDiv.innerHTML = `
                <span>${data[field] || ''}</span>
                <div class="actions">
                    <img src="../../images/Edit.png" alt="Edit" class="action-icon" onclick="editItem('${collection}', '${doc.id}', '${data[field]}')">
                    <img src="../../images/Delete.png" alt="Delete" class="action-icon" onclick="deleteItem('${collection}', '${doc.id}')">
                </div>
            `;
            listContainer.appendChild(itemDiv);
        });
    } catch (error) {
        console.error(`Error fetching ${collection}: `, error);
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

//edit
window.editItem = function(collection, id, name) {
    // Validate inputs
    if (!collection || !id || name === undefined) {
        console.error('Invalid edit parameters:', {collection, id, name});
        showCustomMessage('Cannot edit this item', false);
        return;
    }

    // Sanitize name display (prevent XSS)
    const sanitizedName = name.toString()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Set form values
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-collection').value = collection;
    document.getElementById('edit-item-name').value = sanitizedName;

    // Show popup
    openPopup('edit-item-popup');
};
//save edit
window.saveEditedItem = async function() {
    // Get form values
    const id = document.getElementById('edit-item-id').value;
    const collection = document.getElementById('edit-item-collection').value;
    const newName = document.getElementById('edit-item-name').value.trim();

    if (!newName) {
        showCustomMessage('Name cannot be empty', false);
        return;
    }

    // Map collections to their respective name fields
    const fieldMap = {
        'tb_barangay': 'barangay_name',
        'tb_crop_types': 'crop_type_name',
        'tb_fertilizer': 'fertilizer_name',
        'tb_equipment': 'equipment_name',
        'tb_farmland': 'farmland_name'
    };

    const fieldToUpdate = fieldMap[collection];
    
    if (!fieldToUpdate) {
        showCustomMessage('Invalid collection type', false);
        return;
    }

    try {
        // Check for duplicate names (except for the current item)
        const querySnapshot = await db.collection(collection)
            .where(fieldToUpdate, '==', newName)
            .get();

        const isDuplicate = querySnapshot.docs.some(doc => doc.id !== id);
        
        if (isDuplicate) {
            showCustomMessage(`${fieldToUpdate.replace('_', ' ')} already exists!`, false);
            return;
        }

        // Perform the update
        await db.collection(collection).doc(id).update({
            [fieldToUpdate]: newName
        });

        showCustomMessage('Item updated successfully', true);
        closePopup('edit-item-popup');
        loadData(); // Refresh the displayed data

        // Special reload for dependent data
        if (collection === 'tb_barangay') {
            loadFarmlandsForBarangay();
            populateBarangayDropdown();
        }
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
        db.collection(deleteItemCollection).doc(deleteItemId).delete().then(() => {
            showCustomMessage('Item deleted successfully', true);
            loadData();
            if (deleteItemCollection === 'tb_farmland') {
                loadFarmlandsForBarangay();
            }
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
    const barangayName = document.getElementById('barangay-name').value;
    const totalPlotSize = parseFloat(document.getElementById('total-plot-size').value);
    const landArea = document.getElementById('land-area').value;
    const plotSize = parseFloat(document.getElementById('plot-size').value);
    const dateCreated = new Date().toISOString();

    if (!barangayName || isNaN(totalPlotSize) || !landArea || isNaN(plotSize)) {
        showCustomMessage('All fields are required, and numeric fields must be valid numbers!', false);
        return;
    }

    try {
        const existingBrgy = await db.collection('tb_barangay')
            .where('barangay_name', '==', barangayName)
            .get();

        if (!existingBrgy.empty) {
            showCustomMessage('Barangay name already exists in the database!', false);
            return;
        }

        const nextBrgyId = await getNextId('brgy_id_counter');
        const nextFarmlandId = await getNextId('farmland_id_counter');

        if (nextBrgyId !== null && nextFarmlandId !== null) {
            const barangayData = {
                barangay_id: nextBrgyId,
                barangay_name: barangayName,
                total_plot_size: totalPlotSize,
                land_area: parseInt(landArea), // Convert to integer
                plot_area: parseInt(plotSize), // Convert to integer
                dateCreated
            };
            
            const farmlandData = {
                farmland_id: nextFarmlandId,
                barangay_id: nextBrgyId,
                barangay_name: barangayName,
                farmland_name: landArea,
                plot_area: parseInt(plotSize), // Convert to integer
                dateCreated
            };
            

            const batch = db.batch();
            const barangayRef = db.collection('tb_barangay').doc();
            const farmlandRef = db.collection('tb_farmland').doc();

            batch.set(barangayRef, barangayData);
            batch.set(farmlandRef, farmlandData);

            await batch.commit();

            const barangaySelect = document.getElementById('barangay-select');
            const option = document.createElement('option');
            option.value = barangayName.trim();
            option.textContent = barangayName;
            barangaySelect.appendChild(option);

            showCustomMessage('Barangay and farmland added successfully', true);
            clearBarangayInputs();
            loadData();
            closePopup('add-barangay-popup');
        }
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
    const cropTypeName = document.getElementById('crop-type-name').value;
    const cropName = document.getElementById('crop-name').value;
    const dateAdded = new Date().toISOString();

    if (!cropTypeName || !cropName) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    const existingCropType = await db.collection('tb_crop_types')
        .where('crop_type_name', '==', cropTypeName)
        .where('crop_name', '==', cropName)
        .get();

    if (!existingCropType.empty) {
        showCustomMessage('Crop type already exists in the database!', false);
        return;
    }

    const cropSnapshot = await db.collection('tb_crops').where('crop_name', '==', cropName).get();
    let cropNameId = null;
    cropSnapshot.forEach(doc => {
        cropNameId = doc.id;
    });

    if (!cropNameId) {
        showCustomMessage('Crop name not found!', false);
        return;
    }

    const nextCropTypeId = await getNextId('crop_type_id_counter');
    if (nextCropTypeId !== null) {
        db.collection('tb_crop_types').add({
            crop_type_id: nextCropTypeId,
            crop_type_name: cropTypeName,
            crop_name: cropName,
            crop_name_id: cropNameId,
            current_stock: 0,
            unit: "kg",
            dateAdded
        }).then(() => {
            showCustomMessage('Crop Type added successfully', true);
            clearCropInputs();
            loadData();
            closePopup('add-crop-type-popup');
        }).catch(error => {
            console.error('Error adding crop type:', error);
            showCustomMessage('Error adding crop type. Please try again.', false);
        });
    }
};

function clearEquipmentInputs() {
    document.getElementById('equipment-name').value = '';
    document.getElementById('equipment-category').selectedIndex = 0;
}

window.addEquipment = async function() {
    const equipmentName = document.getElementById('equipment-name').value;
    const category = document.getElementById('equipment-category').value;
    const dateAdded = new Date().toISOString();

    if (!equipmentName || !category) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    const existingEquipment = await db.collection('tb_equipment')
        .where('equipment_name', '==', equipmentName)
        .where('equipment_category', '==', category)
        .get();

    if (!existingEquipment.empty) {
        showCustomMessage('Equipment already exists in the database!', false);
        return;
    }

    const nextEquipmentId = await getNextId('equipment_id_counter');
    if (nextEquipmentId !== null) {
        db.collection('tb_equipment').add({
            equipment_id: nextEquipmentId,
            equipment_name: equipmentName,
            equipment_category: category,
            current_quantity: 0,
            dateAdded
        }).then(() => {
            showCustomMessage('Equipment added successfully', true);
            clearEquipmentInputs();
            loadData();
            closePopup('add-equipment-popup');
        }).catch(error => {
            console.error('Error adding equipment:', error);
            showCustomMessage('Error adding equipment. Please try again.', false);
        });
    }
};

function clearFertilizerInputs() {
    document.getElementById('fertilizer-name').value = '';
    document.getElementById('fertilizer-category').selectedIndex = 0;
}

window.addFertilizer = async function() {
    const fertilizerName = document.getElementById('fertilizer-name').value;
    const fertilizerType = document.getElementById('fertilizer-category').value;
    const dateAdded = new Date().toISOString();

    if (!fertilizerName || !fertilizerType) {
        showCustomMessage('All fields are required!', false);
        return;
    }

    const existingFertilizer = await db.collection('tb_fertilizer')
        .where('fertilizer_name', '==', fertilizerName)
        .where('fertilizer_type', '==', fertilizerType)
        .get();

    if (!existingFertilizer.empty) {
        showCustomMessage('Fertilizer already exists in the database!', false);
        return;
    }

    const nextFertilizerId = await getNextId('fertilizer_id_counter');
    if (nextFertilizerId !== null) {
        db.collection('tb_fertilizer').add({
            fertilizer_id: nextFertilizerId,
            fertilizer_name: fertilizerName,
            fertilizer_type: fertilizerType,
            quantity: 0,
            unit: "kg",
            dateAdded
        }).then(() => {
            showCustomMessage('Fertilizer added successfully', true);
            clearFertilizerInputs();
            loadData();
            closePopup('add-fertilizer-popup');
        }).catch(error => {
            console.error('Error adding fertilizer:', error);
            showCustomMessage('Error adding fertilizer. Please try again.', false);
        });
    }
};

window.loadFarmlandsForBarangay = async function() {
    const listContainer = document.getElementById('farmland-list');
    const barangaySelect = document.getElementById('barangay-select');
    const selectedBarangayName = barangaySelect.value.trim();

    if (!selectedBarangayName) {
        listContainer.innerHTML = '<p>Please select a barangay.</p>';
        return;
    }

    listContainer.innerHTML = '';

    try {
        const snapshot = await db.collection('tb_farmland')
            .where('barangay_name', '==', selectedBarangayName)
            .get();

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
    } catch (error) {
        console.error('Error loading farmlands:', error);
        listContainer.innerHTML = '<p>Error loading farmlands. Please try again later.</p>';
    }
};

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

    if (!farmlandName || !landArea) {
        showCustomMessage("All fields are required!", false);
        return;
    }

    if (!selectedBarangayName) {
        showCustomMessage("Please select a barangay.", false);
        return;
    }

    try {
        const barangaySnapshot = await db
            .collection("tb_barangay")
            .where("barangay_name", "==", selectedBarangayName)
            .get();

        if (barangaySnapshot.empty) {
            showCustomMessage("Selected barangay does not exist!", false);
            return;
        }

        const barangayDoc = barangaySnapshot.docs[0];
        const barangayData = barangayDoc.data();
        const barangayId = barangayData.barangay_id;

        const existingFarmland = await db
            .collection("tb_farmland")
            .where("barangay_name", "==", selectedBarangayName)
            .where("farmland_name", "==", farmlandName)
            .get();

        if (!existingFarmland.empty) {
            showCustomMessage("Farmland already exists in this barangay!", false);
            return;
        }

        const nextFarmlandId = await getNextId("farmland_id_counter");
        if (nextFarmlandId !== null) {
            const newFarmland = {
                farmland_id: nextFarmlandId,
                barangay_id: barangayId,
                barangay_name: selectedBarangayName,
                farmland_name: farmlandName,
                land_area: parseInt(landArea),
                dateAdded,
            };

            await db.collection("tb_farmland").add(newFarmland);

            showCustomMessage("Farmland added successfully", true);
            clearFarmlandInputs();
            loadData();
            loadFarmlandsForBarangay();
            populateBarangayDropdown();

            displayNewFarmland(newFarmland);

            document.getElementById("farmland-name").value = "";
            document.getElementById("farmland-land-area").value = "";
            barangaySelect.selectedIndex = 0;

            closePopup("add-farmland-popup");
        }
    } catch (error) {
        console.error("Error adding farmland:", error);
        showCustomMessage("Error adding farmland. Please try again.", false);
    }
};

function displayNewFarmland(farmland) {
    const farmlandList = document.getElementById("farmland-list");
    const farmlandItem = document.createElement("div");
    farmlandItem.classList.add("item");

    farmlandItem.innerHTML = `
        <span><strong>${farmland.farmland_name}</strong> - ${farmland.land_area} hectares 
        <span>(${farmland.barangay_name})</span></span>
        <div class="actions">
            <button class="edit-button"><img src="../../images/Edit.png" class="action-icon" alt="Edit"></button>
            <button class="delete-button"><img src="../../images/Delete.png" class="action-icon" alt="Delete"></button>
        </div>
    `;

    farmlandList.appendChild(farmlandItem);
}

document.getElementById('confirm-delete-button').addEventListener('click', confirmDelete);

const accountIcon = document.getElementById("account-icon");
const accountPanel = document.getElementById("account-panel");
const accountFrame = document.getElementById("account-frame");

accountIcon.addEventListener("click", () => {
    accountPanel.classList.toggle("active");

    if (accountPanel.classList.contains("active")) {
        accountFrame.src = "account_loginout.php";
    } else {
        accountFrame.src = "";
    }
});

document.addEventListener("click", (event) => {
    if (!accountPanel.contains(event.target) && !accountIcon.contains(event.target)) {
        accountPanel.classList.remove("active");
        accountFrame.src = "";
    }
});

initializeCounters();