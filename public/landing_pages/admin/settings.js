
import app from "../../../src/config/firebase_config.js"; // Import the Firebase configuration
const db = app.firestore();

let deleteItemId = null;
let deleteItemCollection = null;

function openAddBarangayPopup() {
    document.getElementById('add-barangay-popup').style.display = 'block';
}

function openAddCropTypePopup() {
    document.getElementById('add-crop-type-popup').style.display = 'block';
    loadCropNames();
}
async function loadCropNames() {
    const cropNameSelect = document.getElementById('crop-name');
    cropNameSelect.innerHTML = ''; // Clear the existing options

    try {
        const snapshot = await db.collection('tb_crops').get();
        snapshot.forEach(doc => {
            const cropData = doc.data();
            const option = document.createElement('option');
            option.value = cropData.crop_name;  // Set the crop_name as the value
            option.textContent = cropData.crop_name;  // Display crop_name in the dropdown
            cropNameSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading crop names:', error);
    }
}

function openAddEquipmentPopup() {
    document.getElementById('add-equipment-popup').style.display = 'block';
    loadEquipmentTypes()
}
async function loadEquipmentTypes() {
    const equipmentCategorySelect = document.getElementById('equipment-category');
    equipmentCategorySelect.innerHTML = ''; // Clear the existing options

    try {
        const snapshot = await db.collection('tb_equipment_types').get();
        snapshot.forEach(doc => {
            const equipmentData = doc.data();
            const option = document.createElement('option');
            option.value = equipmentData.equipment_type_name; // Set the equipment_type_name as the value
            option.textContent = equipmentData.equipment_type_name; // Display equipment_type_name in the dropdown
            equipmentCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading equipment types:', error);
    }
}

function openAddFertilizerPopup() {
    document.getElementById('add-fertilizer-popup').style.display = 'block';
    loadFertilizerTypes()
}
async function loadFertilizerTypes() {
    const fertilizerCategorySelect = document.getElementById('fertilizer-category');
    fertilizerCategorySelect.innerHTML = ''; // Clear the existing options

    try {
        const snapshot = await db.collection('tb_fertilizer_types').get();
        snapshot.forEach(doc => {
            const fertilizerData = doc.data();
            const option = document.createElement('option');
            option.value = fertilizerData.fertilizer_type_name; // Set the fertilizer_type_name as the value
            option.textContent = fertilizerData.fertilizer_type_name; // Display fertilizer_type_name in the dropdown
            fertilizerCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading fertilizer types:', error);
    }
}


// Initialize counters
async function initializeCounters() {
    const counters = ['brgy_id_counter', 'crop_type_id_counter', 'equipment_id_counter', 
        'fertilizer_id_counter', 'farmland_id_counter'];

    for (let counter of counters) {
        const docRef = db.collection('tb_id_counters').doc(counter);
        const doc = await docRef.get();

        // If the document doesn't exist, initialize it with count = 0
        if (!doc.exists) {
            await docRef.set({
                count: 0
            });
        }
    }
}

// Get the next available ID
async function getNextId(counterName) {
    const counterRef = db.collection('tb_id_counters').doc(counterName);
    const doc = await counterRef.get();
    
    if (doc.exists) {
        const currentCount = doc.data().count;
        // Increment the counter
        const nextId = currentCount + 1;

        // Update the counter with the new value
        await counterRef.update({
            count: nextId
        });

        return nextId;
    } else {
        console.error(`Counter ${counterName} not found!`);
        return null;
    }
}

// Load Data Function
function loadData() {
    fetchData('tb_barangay', 'barangay-list', 'barangay_name');
    fetchData('tb_crop_types', 'crop-type-list', 'crop_type_name');
    fetchData('tb_equipment', 'equipment-list', 'equipment_name');
    fetchData('tb_fertilizer', 'fertilizer-list', 'fertilizer_name');
    loadBarangaysForFarmland();
}

async function fetchData(collection, listId, field) {
    const listContainer = document.getElementById(listId);
    listContainer.innerHTML = '';  // Clear existing list content

    try {
        const snapshot = await db.collection(collection).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item');
            itemDiv.innerHTML = `
                <span>${data[field] || ''}</span>
                <div class="actions">
                    <!-- Edit Button as Image -->
                    <img src="images/Edit.png" alt="Edit" class="action-icon" onclick="editItem('${collection}', '${doc.id}', '${data[field]}')">
                    <!-- Delete Button as Image -->
                    <img src="images/Delete.png" alt="Delete" class="action-icon" onclick="deleteItem('${collection}', '${doc.id}')">
                </div>
            `;
            listContainer.appendChild(itemDiv);
        });
    } catch (error) {
        console.error(`Error fetching ${collection}: `, error);
    }
}

// Call loadData to populate the panels when the page loads
document.addEventListener("DOMContentLoaded", loadData);

// Call loadData to populate the panels when the page loads
document.addEventListener("DOMContentLoaded", loadData);


function editItem(collection, id, name) {
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-collection').value = collection;
    document.getElementById('edit-item-name').value = name; // Ensure full name is assigned

    openPopup('edit-item-popup');
}
function saveEditedItem() {
    const id = document.getElementById('edit-item-id').value;
    const collection = document.getElementById('edit-item-collection').value;
    const newName = document.getElementById('edit-item-name').value;

    db.collection(collection).doc(id).update({
        [Object.keys(db.collection(collection).doc().data)[0]]: newName
    }).then(() => {
        alert('Item updated successfully');
        closePopup('edit-item-popup');
        loadData();
    }).catch(error => {
        console.error('Error updating item:', error);
    });
}

function deleteItem(collection, id) {
    deleteItemCollection = collection;
    deleteItemId = id;
    openPopup('delete-confirm-popup');
}

function confirmDelete() {
    if (deleteItemId && deleteItemCollection) {
        db.collection(deleteItemCollection).doc(deleteItemId).delete().then(() => {
            alert('Item deleted successfully');
            loadData();
            closePopup('delete-confirm-popup');
        }).catch(error => {
            console.error('Error deleting item:', error);
        });
    }
}

function closePopup(id) {
    document.getElementById(id).style.display = 'none';
}

function openPopup(id) {
    document.getElementById(id).style.display = 'block';
}


//add barangay
async function addBarangay() {
    const barangayName = document.getElementById('barangay-name').value;
    const totalPlotSize = document.getElementById('total-plot-size').value;
    const landArea = document.getElementById('land-area').value;
    const plotSize = document.getElementById('plot-size').value;
    const dateCreated = new Date().toISOString();

    if (!barangayName || !totalPlotSize || !landArea || !plotSize) {
        alert('All fields are required!');
        return;
    }

    // Check if the barangay already exists
    const existingBrgy = await db.collection('tb_barangay')
        .where('barangay_name', '==', barangayName)
        .get();

    if (!existingBrgy.empty) {
        alert('Barangay name already exists in the database!');
        return;
    }

    // Get the next available barangay ID
    const nextBrgyId = await getNextId('brgy_id_counter');
    if (nextBrgyId !== null) {
        db.collection('tb_barangay').add({
            barangay_id: nextBrgyId,
            barangay_name: barangayName,
            total_plot_size: totalPlotSize,
            land_area: landArea,
            plot_area: plotSize,
            dateCreated
        }).then(() => {
            alert('Barangay added successfully');
            loadData();
            closePopup('add-barangay-popup');
        }).catch(error => {
            console.error('Error adding barangay:', error);
        });
    }
}

//add crop
async function addCropType() {
    const cropTypeName = document.getElementById('crop-type-name').value;
    const cropName = document.getElementById('crop-name').value;
    const stock = document.getElementById('crop-stock').value;
    const unit = document.getElementById('crop-unit').value;
    const dateAdded = new Date().toISOString();

    if (!cropTypeName || !cropName || !stock || !unit) {
        alert('All fields are required!');
        return;
    }

    // Check if the crop type already exists
    const existingCropType = await db.collection('tb_crop_types')
        .where('crop_type_name', '==', cropTypeName)
        .where('crop_name', '==', cropName)
        .get();

    if (!existingCropType.empty) {
        alert('Crop type already exists in the database!');
        return;
    }

    // Get the corresponding crop_name_id
    const cropSnapshot = await db.collection('tb_crops').where('crop_name', '==', cropName).get();
    let cropNameId = null;
    cropSnapshot.forEach(doc => {
        cropNameId = doc.id; 
    });

    if (!cropNameId) {
        alert('Crop name not found!');
        return;
    }

    // Get the next available crop type ID
    const nextCropTypeId = await getNextId('crop_type_id_counter');
    if (nextCropTypeId !== null) {
        db.collection('tb_crop_types').add({
            crop_type_id: nextCropTypeId,
            crop_type_name: cropTypeName,
            crop_name: cropName,
            crop_name_id: cropNameId,
            current_stock: stock,
            unit: unit,
            dateAdded
        }).then(() => {
            alert('Crop Type added successfully');
            loadData();
            closePopup('add-crop-type-popup');
        }).catch(error => {
            console.error('Error adding crop type:', error);
        });
    }
}

//add equipment
async function addEquipment() {
    const equipmentName = document.getElementById('equipment-name').value;
    const category = document.getElementById('equipment-category').value;
    const stock = document.getElementById('equipment-stock').value;
    const unit = document.getElementById('equipment-unit').value;
    const dateAdded = new Date().toISOString();

    if (!equipmentName || !category || !stock || !unit) {
        alert('All fields are required!');
        return;
    }

    // Check if the equipment already exists
    const existingEquipment = await db.collection('tb_equipment')
        .where('equipment_name', '==', equipmentName)
        .where('equipment_category', '==', category)
        .get();

    if (!existingEquipment.empty) {
        alert('Equipment already exists in the database!');
        return;
    }

    // Get the next available equipment ID
    const nextEquipmentId = await getNextId('equipment_id_counter');
    if (nextEquipmentId !== null) {
        db.collection('tb_equipment').add({
            equipment_id: nextEquipmentId,
            equipment_name: equipmentName,
            equipment_category: category,
            current_stock: stock,
            unit: unit,
            dateAdded
        }).then(() => {
            alert('Equipment added successfully');
            loadData();
            closePopup('add-equipment-popup');
        }).catch(error => {
            console.error('Error adding equipment:', error);
        });
    }
}


//add fertilizer
async function addFertilizer() {
    const fertilizerName = document.getElementById('fertilizer-name').value;
    const category = document.getElementById('fertilizer-category').value;
    const stock = document.getElementById('fertilizer-stock').value;
    const unit = document.getElementById('fertilizer-unit').value;
    const dateAdded = new Date().toISOString();

    if (!fertilizerName || !category || !stock || !unit) {
        alert('All fields are required!');
        return;
    }

    // Check if the fertilizer already exists
    const existingFertilizer = await db.collection('tb_fertilizer')
        .where('fertilizer_name', '==', fertilizerName)
        .where('fertilizer_category', '==', category)
        .get();

    if (!existingFertilizer.empty) {
        alert('Fertilizer already exists in the database!');
        return;
    }

    // Get the next available fertilizer ID
    const nextFertilizerId = await getNextId('fertilizer_id_counter');
    if (nextFertilizerId !== null) {
        db.collection('tb_fertilizer').add({
            fertilizer_id: nextFertilizerId,
            fertilizer_name: fertilizerName,
            fertilizer_category: category,
            current_stock: stock,
            unit: unit,
            dateAdded
        }).then(() => {
            alert('Fertilizer added successfully');
            loadData();
            closePopup('add-fertilizer-popup');
        }).catch(error => {
            console.error('Error adding fertilizer:', error);
        });
    }
}


//farmland
// Load barangays for farmland selection
async function loadBarangaysForFarmland() {
    const select = document.getElementById('barangay-select');
    try {
        const snapshot = await db.collection('tb_barangay').get();
        select.innerHTML = '<option value="">Select Barangay</option>';
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id; // Use doc.id as value for barangay
            option.textContent = doc.data().barangay_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading barangays:', error);
    }
}

// Load farmlands based on selected barangay
async function loadFarmlandsForBarangay() {
    const listContainer = document.getElementById('farmland-list');
    const addButton = document.getElementById('add-farmland-button');
    const selectedBarangayId = document.getElementById('barangay-select').value;  // Get the selected barangay ID

    // Clear the list container
    listContainer.innerHTML = '';
    addButton.style.display = selectedBarangayId ? 'inline-block' : 'none';

    if (!selectedBarangayId) return; // Ensure barangay is selected

    try {
        const snapshot = await db.collection('tb_farmland') 
            .where('barangay_id', '==', selectedBarangayId) // Use barangay_id for matching
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
                <span>${data.farmland_name} (${data.land_area} ha)</span>
                <div class="actions">
                    <img src="images/Edit.png" alt="Edit" class="action-icon" 
                         onclick="editItem('tb_farmland', '${doc.id}', '${data.farmland_name}')">
                    <img src="images/Delete.png" alt="Delete" class="action-icon" 
                         onclick="deleteItem('tb_farmland', '${doc.id}')">
                </div>
            `;
            listContainer.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Error loading farmlands:', error);
        listContainer.innerHTML = '<p>Error loading farmlands. Please try again later.</p>';
    }
}



// Farmland Modal functions
function openAddFarmlandPopup() {
    document.getElementById('add-farmland-popup').style.display = 'block';
}

async function addFarmland() {
    const barangayId = document.getElementById('barangay-select').value;
    const farmlandName = document.getElementById('farmland-name').value;
    const landArea = document.getElementById('farmland-land-area').value;
    const dateAdded = new Date().toISOString();

    if (!farmlandName || !landArea) {
        alert('All fields are required!');
        return;
    }

    if (!barangayId) {
        alert('Please select a barangay.');
        return;
    }

    // Check if the farmland already exists in the selected barangay
    const existingFarmland = await db.collection('tb_farmland')
        .where('barangay_id', '==', barangayId)
        .where('farmland_name', '==', farmlandName)
        .get();
    
    if (!existingFarmland.empty) {
        alert('Farmland already exists in this barangay!');
        return;
    }

    // Get next ID and insert new farmland
    const nextFarmlandId = await getNextId('farmland_id_counter');
    if (nextFarmlandId !== null) {
        db.collection('tb_farmland').add({
            farmland_id: nextFarmlandId,
            barangay_id: barangayId,
            farmland_name: farmlandName,
            land_area: landArea,
            dateAdded
        }).then(() => {
            alert('Farmland added successfully');
            loadFarmlandsForBarangay();
            closePopup('add-farmland-popup');
        }).catch(error => {
            console.error('Error adding farmland:', error);
        });
    }
}


// Update the getNextId function to handle farmland_id_counter
// (Already handled in the modified initializeCounters above)
//farmland

document.getElementById('confirm-delete-button').addEventListener('click', confirmDelete);
const accountIcon = document.getElementById("account-icon");
const accountPanel = document.getElementById("account-panel");
const accountFrame = document.getElementById("account-frame");

// Load content when account icon is clicked
accountIcon.addEventListener("click", () => {
    accountPanel.classList.toggle("active");

    // Load external content in iframe
    if (accountPanel.classList.contains("active")) {
        accountFrame.src = "account_loginout.php"; // Change to the URL of your content page
    } else {
        accountFrame.src = ""; // Clear iframe content when panel is closed
    }
});

document.addEventListener("click", (event) => {
    if (!accountPanel.contains(event.target) && !accountIcon.contains(event.target)) {
        accountPanel.classList.remove("active");
        accountFrame.src = ""; // Clear iframe content when clicking outside
    }
});
// Initialize c ounters
initializeCounters();

// Load data on initial load
//loadData();