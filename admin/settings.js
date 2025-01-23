
const firebaseConfig = {
    apiKey: "AIzaSyD0pdy75p4D21Nz1JyFKHQxVNyh60U8yVA",
    authDomain: "operation-and-task-management.firebaseapp.com",
    projectId: "operation-and-task-management",
    storageBucket: "operation-and-task-management.appspot.com",
    messagingSenderId: "182897367112",
    appId: "1:182897367112:web:600d924a446ae220fba07d",
    measurementId: "G-C91Z5709N5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
    const counters = ['brgy_id_counter', 'crop_type_id_counter', 'equipment_id_counter', 'fertilizer_id_counter'];

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

async function addBarangay() {
    const barangayName = document.getElementById('barangay-name').value;
    const totalPlotSize = document.getElementById('total-plot-size').value;
    const farmlandname = document.getElementById('farm-land-name').value;
    const area = document.getElementById('area').value;
    const dateCreated = new Date().toISOString();
    
    // Get the next available barangay ID
    const nextBrgyId = await getNextId('brgy_id_counter');
    if (nextBrgyId !== null) {
        db.collection('tb_barangay').add({
            barangay_id: nextBrgyId,
            barangay_name: barangayName,
            total_plot_size: totalPlotSize,
            farm_land_name: farmlandname,
            area: area,
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

async function addCropType() {
    const cropTypeName = document.getElementById('crop-type-name').value;
    const cropName = document.getElementById('crop-name').value;
    const stock = document.getElementById('crop-stock').value;
    const unit = document.getElementById('crop-unit').value;
    const dateAdded = new Date().toISOString();
    
    // Get the corresponding crop_name_id
    const cropSnapshot = await db.collection('tb_crops').where('crop_name', '==', cropName).get();
    let cropNameId = null;
    cropSnapshot.forEach(doc => {
        cropNameId = doc.id;  // Assuming crop_name_id is the document ID
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

async function addEquipment() {
    const equipmentName = document.getElementById('equipment-name').value;
    const category = document.getElementById('equipment-category').value;
    const stock = document.getElementById('equipment-stock').value;
    const unit = document.getElementById('equipment-unit').value;
    const dateAdded = new Date().toISOString();

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

async function addFertilizer() {
    const fertilizerName = document.getElementById('fertilizer-name').value;
    const category = document.getElementById('fertilizer-category').value;
    const stock = document.getElementById('fertilizer-stock').value;
    const unit = document.getElementById('fertilizer-unit').value;
    const dateAdded = new Date().toISOString();

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