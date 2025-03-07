
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

window.openAddBarangayPopup = function() {
    document.getElementById('add-barangay-popup').style.display = 'block';
};

window.openAddCropTypePopup = function() {
    document.getElementById('add-crop-type-popup').style.display = 'block';
    loadCropNames();
}
 window.loadCropNames = async function() {
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

window.openAddEquipmentPopup  = function() {
    document.getElementById('add-equipment-popup').style.display = 'block';
    loadEquipmentTypes()
}
window.loadEquipmentTypes = async function() {
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

window.openAddFertilizerPopup  = function() {
    document.getElementById('add-fertilizer-popup').style.display = 'block';
    loadFertilizerTypes()
}
window.loadFertilizerTypes = async function() {
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
 window.initializeCounters = async function() {
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
 window.getNextId = async function(counterName) {
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

//farmland
 window.populateBarangayDropdown = async function() {
    const barangaySelect = document.getElementById('barangay-select');

    try {
        const snapshot = await db.collection('tb_barangay').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = data.barangay_name.trim(); // Use barangay_name as the value
            option.textContent = data.barangay_name; // Display barangay_name
            barangaySelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading barangays:", error);
    }
}

// Load barangays on page load
window.onload = populateBarangayDropdown;

window.fetchData = async function(collection, listId, field) {
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
                    <img src="../../images/Edit.png" alt="Edit" class="action-icon" onclick="editItem('${collection}', '${doc.id}', '${data[field]}')">
                    <!-- Delete Button as Image -->
                    <img src="../../images/Delete.png" alt="Delete" class="action-icon" onclick="deleteItem('${collection}', '${doc.id}')">
                </div>
            `;
            listContainer.appendChild(itemDiv);
        });
    } catch (error) {
        console.error(`Error fetching ${collection}: `, error);
    }
}

// Load Data Function
window.loadData = function() {
    fetchData('tb_barangay', 'barangay-list', 'barangay_name');
    fetchData('tb_crop_types', 'crop-type-list', 'crop_type_name');
    fetchData('tb_equipment', 'equipment-list', 'equipment_name');
    fetchData('tb_fertilizer', 'fertilizer-list', 'fertilizer_name');
}

// Call loadData to populate the panels when the page loads
document.addEventListener("DOMContentLoaded", loadData);

 window.editItem = function(collection, id, name) {
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-collection').value = collection;
    document.getElementById('edit-item-name').value = name; // Ensure full name is assigned

    openPopup('edit-item-popup');
}
window.saveEditedItem = function() {
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

window.deleteItem = function(collection, id) {
    deleteItemCollection = collection;
    deleteItemId = id;
    openPopup('delete-confirm-popup');
}

window.confirmDelete = function() {
    if (deleteItemId && deleteItemCollection) {
        db.collection(deleteItemCollection).doc(deleteItemId).delete().then(() => {
            alert('Item deleted successfully');
            loadData(); // Refresh main lists
            
            // If deleting a farmland, refresh farmland list
            if (deleteItemCollection === 'tb_farmland') {
                loadFarmlandsForBarangay();
            }
            
            closePopup('delete-confirm-popup');
        })
    }
};

window.closePopup = function(id) {
    document.getElementById(id).style.display = 'none';
}

window.openPopup = function(id) {
    document.getElementById(id).style.display = 'block';
}

//add barangay
window.addBarangay = async function() {
    const barangayName = document.getElementById('barangay-name').value;
    const totalPlotSize = parseFloat(document.getElementById('total-plot-size').value); // Numeric
    const landArea = document.getElementById('land-area').value; // Text
    const plotSize = parseFloat(document.getElementById('plot-size').value); // Numeric
    const dateCreated = new Date().toISOString();

    if (!barangayName || isNaN(totalPlotSize) || !landArea || isNaN(plotSize)) {
        alert('All fields are required, and numeric fields must be valid numbers!');
        return;
    }

    try {
        // Check if the barangay already exists
        const existingBrgy = await db.collection('tb_barangay')
            .where('barangay_name', '==', barangayName)
            .get();

        if (!existingBrgy.empty) {
            alert('Barangay name already exists in the database!');
            return;
        }

        // Get the next available barangay and farmland IDs
        const nextBrgyId = await getNextId('brgy_id_counter');
        const nextFarmlandId = await getNextId('farmland_id_counter');

        if (nextBrgyId !== null && nextFarmlandId !== null) {
            const barangayData = {
                barangay_id: nextBrgyId,
                barangay_name: barangayName,
                total_plot_size: totalPlotSize,
                land_area: landArea, // Text field
                plot_area: plotSize,
                dateCreated
            };

            const farmlandData = {
                farmland_id: nextFarmlandId,
                barangay_id: nextBrgyId, // Link to barangay
                barangay_name: barangayName,
                farmland_name: landArea, // Text field
                plot_area: plotSize,
                dateCreated
            };

            console.log("Saving data:", { barangayData, farmlandData });

            // Save both using batch
            const batch = db.batch();

            const barangayRef = db.collection('tb_barangay').doc();
            const farmlandRef = db.collection('tb_farmland').doc();

            batch.set(barangayRef, barangayData);
            batch.set(farmlandRef, farmlandData);

            await batch.commit();

            // Add the new barangay to the dropdown
            const barangaySelect = document.getElementById('barangay-select');
            const option = document.createElement('option');
            option.value = barangayName.trim(); // Use barangay_name as the value
            option.textContent = barangayName; // Display barangay_name
            barangaySelect.appendChild(option);

            alert('Barangay and farmland added successfully');
            loadData();
            closePopup('add-barangay-popup');
        }
    } catch (error) {
        console.error('Error adding barangay and farmland:', error);
    }
};

// Add Crop
window.addCropType = async function() {
    const cropTypeName = document.getElementById('crop-type-name').value;
    const cropName = document.getElementById('crop-name').value;
    const stock = parseInt(document.getElementById('crop-stock').value, 10); // Convert to integer
    const unit = document.getElementById('crop-unit').value;
    const dateAdded = new Date().toISOString();

    if (!cropTypeName || !cropName || isNaN(stock) || !unit) { // Check if stock is a valid number
        alert('All fields are required, and stock must be a valid number!');
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
            current_stock: stock, // Now an integer
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
window.addEquipment = async function() {
    const equipmentName = document.getElementById('equipment-name').value;
    const category = document.getElementById('equipment-category').value;
    const quantity = parseInt(document.getElementById('equipment-quantity').value, 10);
    const dateAdded = new Date().toISOString();

    if (!equipmentName || !category || isNaN(quantity)) {
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
            current_quantity: quantity,
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

// Add fertilizer
window.addFertilizer = async function() {
    const fertilizerName = document.getElementById('fertilizer-name').value;
    const fertilizerType = document.getElementById('fertilizer-category').value; // Changed variable name
    const quantity = parseInt(document.getElementById('fertilizer-stock').value, 10);
    const unit = document.getElementById('fertilizer-unit').value;
    const dateAdded = new Date().toISOString();

    if (!fertilizerName || !fertilizerType || isNaN(quantity) || !unit) {
        alert('All fields are required and stock must be a valid number!');
        return;
    }

    // Check if the fertilizer already exists
    const existingFertilizer = await db.collection('tb_fertilizer')
        .where('fertilizer_name', '==', fertilizerName)
        .where('fertilizer_type', '==', fertilizerType) // Updated field name
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
            fertilizer_type: fertilizerType, // Updated field name
            quantity: quantity,
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



window.loadFarmlandsForBarangay = async function () {
    const listContainer = document.getElementById('farmland-list');
    const barangaySelect = document.getElementById('barangay-select');
    const selectedBarangayName = barangaySelect.value.trim(); // Now this is the actual name

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
            console.log("No matching farmlands found for:", selectedBarangayName);
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

        console.log("Farmlands loaded successfully for:", selectedBarangayName);
    } catch (error) {
        console.error('Error loading farmlands:', error);
        listContainer.innerHTML = '<p>Error loading farmlands. Please try again later.</p>';
    }
};

// Make sure the function runs when the dropdown changes
document.getElementById('barangay-select').addEventListener('change', loadFarmlandsForBarangay);


// Farmland Modal functions
window.openAddFarmlandPopup = function() {
    document.getElementById('add-farmland-popup').style.display = 'block';
}

function loadFarmlandsForBarangay() {
    let barangaySelect = document.getElementById("barangay-select");
    let addFarmlandButton = document.getElementById("add-farmland-button");

    if (barangaySelect.value) {
        addFarmlandButton.style.display = "block"; // Show the button when a barangay is selected
    } else {
        addFarmlandButton.style.display = "none"; // Hide the button if no barangay is selected
    }

    // Load farmlands based on the selected barangay (implement your logic here)
}

//add farmland
window.addFarmland = async function () {
    const barangaySelect = document.getElementById("barangay-select");
    const selectedBarangayName = barangaySelect.value.trim();
    const farmlandName = document.getElementById("farmland-name").value.trim();
    const landArea = document.getElementById("farmland-land-area").value.trim();
    const dateAdded = new Date().toISOString();

    if (!farmlandName || !landArea) {
        alert("All fields are required!");
        return;
    }

    if (!selectedBarangayName) {
        alert("Please select a barangay.");
        return;
    }

    try {
        // Fetch the barangay document based on the barangay name
        const barangaySnapshot = await db
            .collection("tb_barangay")
            .where("barangay_name", "==", selectedBarangayName)
            .get();

        if (barangaySnapshot.empty) {
            alert("Selected barangay does not exist!");
            return;
        }

        const barangayDoc = barangaySnapshot.docs[0];
        const barangayData = barangayDoc.data();
        const barangayId = barangayData.barangay_id;

        // Check if the farmland already exists in the selected barangay
        const existingFarmland = await db
            .collection("tb_farmland")
            .where("barangay_name", "==", selectedBarangayName)
            .where("farmland_name", "==", farmlandName)
            .get();

        if (!existingFarmland.empty) {
            alert("Farmland already exists in this barangay!");
            return;
        }

        // Get next ID and insert new farmland
        const nextFarmlandId = await getNextId("farmland_id_counter");
        if (nextFarmlandId !== null) {
            const newFarmland = {
                farmland_id: nextFarmlandId,
                barangay_id: barangayId,
                barangay_name: selectedBarangayName,
                farmland_name: farmlandName,
                land_area: landArea,
                dateAdded,
            };

            await db.collection("tb_farmland").add(newFarmland);

            alert("Farmland added successfully");
            loadData();
            loadFarmlandsForBarangay();

            // Append the new farmland to the displayed list
            displayNewFarmland(newFarmland);

            // Clear input fields
            document.getElementById("farmland-name").value = "";
            document.getElementById("farmland-land-area").value = "";
            barangaySelect.selectedIndex = 0;

            // Close the modal
            closePopup("add-farmland-popup");
        }
    } catch (error) {
        console.error("Error adding farmland:", error);
        alert("An error occurred while adding farmland. Please try again.");
    }
};

// Function to display the newly added farmland in the UI
function displayNewFarmland(farmland) {
    const farmlandList = document.getElementById("farmland-list"); // Assuming there's a div with this ID
    const farmlandItem = document.createElement("div"); // Use div instead of li
    farmlandItem.classList.add("item"); // Apply the correct CSS class

    // Add inner content to match the existing design
    farmlandItem.innerHTML = `
        <span><strong>${farmland.farmland_name}</strong> - ${farmland.land_area} hectares 
        <span>(${farmland.barangay_name})</span></span>
        <div class="actions">
            <button class="edit-button"><img src="../../images/Edit.png" class="action-icon" alt="Edit"></button>
            <button class="delete-button"><img src="../../images/Delete.png" class="action-icon" alt="Delete"></button>
        </div>
    `;

    // Append the new farmland item to the list
    farmlandList.appendChild(farmlandItem);
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

initializeCounters();