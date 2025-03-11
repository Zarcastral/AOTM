import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  deleteDoc,
  onSnapshot,
  doc
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(app);
import app from "../../config/firebase_config.js";
const db = getFirestore(app);

async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(collection(db, "tb_users"), where("email", "==", user.email));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userName = userSnapshot.docs[0].data().user_name;
            console.log("Authenticated user's user_name:", userName);
            resolve(user); // Resolve with user object if needed
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


let fertilizersList = []; // Declare fertilizersList globally for filtering
let filteredFertilizers = fertilizersList; // Declare a variable for filtered fertilizers
let currentPage = 1;
const rowsPerPage = 5;
let selectedFertilizers = [];
let currentUserName = ""; // Variable to store the current user's user_name

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchFertilizers();
});


function sortFertilizersById() {
   filteredFertilizers.sort((a, b) => {
    const dateA = parseDate(a.dateAdded);
    const dateB = parseDate(b.dateAdded);
    return dateB - dateA; // Sort latest to oldest
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0); // Default to epoch if no date
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  
  return new Date(dateValue); // Convert string/ISO formats to Date
}


// Fetch fertilizers data (tb_fertilizer) from Firestore
async function fetchFertilizers() {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    // Get user_type from the fetched user document
    const userType = userSnapshot.docs[0].data().user_type;

    const fertilizersCollection = collection(db, "tb_fertilizer");
    const fertilizersQuery = query(fertilizersCollection);

    // Listen for real-time updates
    onSnapshot(fertilizersQuery, async (snapshot) => {
      const fertilizersData = await Promise.all(snapshot.docs.map(async (doc) => {
        const fertilizer = doc.data();
        const fertilizerId = fertilizer.fertilizer_id;

        // Fetch related stock data from tb_fertilizer_stock based on fertilizer_id
        const stockCollection = collection(db, "tb_fertilizer_stock");
        const stockQuery = query(stockCollection, where("fertilizer_id", "==", fertilizerId));
        const stockSnapshot = await getDocs(stockQuery);

        // Initialize stock array for this fertilizer
        fertilizer.stocks = [];

        if (!stockSnapshot.empty) {
          const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
            const stockData = stockDoc.data();
            return stockData.stocks || []; // Access the nested stocks array if available
          });
        
          if (stockDataArray.length > 0) {
            // Filter stock data for the authenticated user based on user_type
            const userStockData = stockDataArray.filter(stock => stock.owned_by === userType);
        
            if (userStockData.length > 0) {
              fertilizer.stocks = userStockData;  // Save user-specific stock data as an array
            } else {
              // Stocks exist but not for the current user_type
              fertilizer.stocks = [{
                stock_date: null,
                current_stock: "",
                unit: "Stock has not been updated yet",
                owned_by: "No stock record found for the current user type"
              }];
            }
          } else {
            // `stocks` array is empty for all users
            fertilizer.stocks = [{
              stock_date: null,
              current_stock: "",
              unit: "Stock has not been updated yet",
              owned_by: "No stock record found for any user type"
            }];
          }
        } else {
          // No stock data found at all
          fertilizer.stocks = [{
            stock_date: null,
            current_stock: "",
            unit: "Stock has not been updated yet",
            owned_by: "No stock record found for any user type"
          }];
        }  

        return fertilizer;
      }));

      fertilizersList = fertilizersData;
      filteredFertilizers = [...fertilizersList];
      sortFertilizersById();            // Sort Fertilizers by date (latest to oldest)
      displayFertilizers(filteredFertilizers); // Update table display
    }, (error) => {
      console.error("Error listening to Fertilizers:", error);
    });
  } catch (error) {
    console.error("Error fetching Fertilizers:", error);
  }
}

function displayFertilizers(fertilizersList) {
  const tableBody = document.querySelector(".fertilizer_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .fertilizer_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedFertilizers = fertilizersList.slice(startIndex, endIndex);

  if (paginatedFertilizers.length === 0) {
    // Show "No records found" if fertilizersList is empty
    const messageRow = document.createElement("tr");
    messageRow.classList.add("no-records-message");
    messageRow.innerHTML = `
      <td colspan="6" style="text-align: center; color: red;">No records found</td>
    `;
    tableBody.appendChild(messageRow);
    return;
  }

  // Remove any "No records found" message if there are records
  const noRecordsMessage = document.querySelector(".no-records-message");
  if (noRecordsMessage) {
    noRecordsMessage.remove();
  }

  paginatedFertilizers.forEach((fertilizer, index) => {
    const row = document.createElement("tr");

    const fertilizerName = fertilizer.fertilizer_name || "Fertilizer Name not recorded";
    const fertilizerId = fertilizer.fertilizer_id || "Fertilizer Id not recorded";
    const fertilizerType = fertilizer.fertilizer_type || "Fertilizer Category not recorded";
    const dateAdded = fertilizer.dateAdded
      ? fertilizer.dateAdded.toDate
        ? fertilizer.dateAdded.toDate().toLocaleDateString()
        : new Date(fertilizer.dateAdded).toLocaleDateString()
      : "Date not recorded";
    fertilizer.stocks.forEach((stock) => {
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "Units";
      const owned_by = stock.owned_by || "Owner not Recorded";


    row.innerHTML = `
        <td class="checkbox">
            <input type="checkbox" data-fertilizer-id="${fertilizerId}">
        </td>
        <td>${fertilizerId}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizerType}</td>
        <td>${dateAdded}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
    `;

    tableBody.appendChild(row);
  });
});
  addCheckboxListeners();
  updatePagination();
  toggleBulkDeleteButton();

}

// Update pagination display
function updatePagination() {
  const totalPages = Math.ceil(filteredFertilizers.length / rowsPerPage) || 1;
  document.getElementById("fertilizer-page-number").textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

// Enable or disable pagination buttons
function updatePaginationButtons() {
  document.getElementById("fertilizer-prev-page").disabled = currentPage === 1;
  document.getElementById("fertilizer-next-page").disabled = currentPage >= Math.ceil(filteredFertilizers.length / rowsPerPage);
}

// Event listener for "Previous" button
document.getElementById("fertilizer-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayFertilizers(filteredFertilizers);
  }
});

// Event listener for "Next" button
document.getElementById("fertilizer-next-page").addEventListener("click", () => {
  if ((currentPage * rowsPerPage) < filteredFertilizers.length) {
    currentPage++;
    displayFertilizers(filteredFertilizers);
  }
});

// Fetch fertilizer names for the dropdown
async function fetchFertilizerNames() {
  const fertilizersCollection = collection(db, "tb_fertilizer_types");
  const fertilizersSnapshot = await getDocs(fertilizersCollection);
  const fertilizerNames = fertilizersSnapshot.docs.map(doc => doc.data().fertilizer_type);

  populateFertilizerDropdown(fertilizerNames);
}

// Populate the fertilizer dropdown with fertilizer names
function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");
  if (!fertilizerSelect) {
    console.error("fertilizer dropdown not found!");
    return;
  }
  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";

  // Clear existing options except the first default one
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach(fertilizerName => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}

// Event listener to filter fertilizers based on dropdown selection
document.querySelector(".fertilizer_select").addEventListener("change", function () {
  const selectedFertilizer = this.value.toLowerCase();
  // Filter fertilizers based on selected value
  filteredFertilizers = selectedFertilizer
    ? fertilizersList.filter(fertilizer => fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer)
    : fertilizersList; // If no selection, show all fertilizers

  currentPage = 1; // Reset to the first page when filter is applied
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered fertilizers
});

// ---------------------------- FERTILIZER BULK DELETE CODES ---------------------------- //
const deletemessage = document.getElementById("fert-bulk-message");

// CHECKBOX CHANGE EVENT HANDLER
function handleCheckboxChange(event) {
  const checkbox = event.target; // The checkbox that triggered the event
  const row = checkbox.closest("tr"); // Get the row of the checkbox
  if (!row) return;

  // Get fertilizer ID from the data attribute
  const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

  if (checkbox.checked) {
    // Add to selected list if checked
    if (!selectedFertilizers.includes(fertilizerId)) {
      selectedFertilizers.push(fertilizerId);
    }
  } else {
    // Remove from list if unchecked
    selectedFertilizers = selectedFertilizers.filter(item => item !== fertilizerId);
  }

  console.log("Selected Fertilizers:", selectedFertilizers);
  toggleBulkDeleteButton();
}


// BULK DELETE TOGGLE 
function toggleBulkDeleteButton() {
  const bulkDeleteButton = document.getElementById("fert-bulk-delete");
  bulkDeleteButton.disabled = selectedFertilizers.length === 0;
}
function addCheckboxListeners() {
  document.querySelectorAll(".fertilizer_table input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });
}

// BULK DELETE CONFIRM/CANCEL BUTTON CODE
document.getElementById("confirm-fert-delete").addEventListener("click", () => {
  deleteSelectedFertilizers();
});

document.getElementById("cancel-fert-delete").addEventListener("click", () => {
  document.getElementById("fert-bulk-panel").style.display = "none";
});

// <------------- BULK DELETE BUTTON CODE ---------------> //
document.getElementById("fert-bulk-delete").addEventListener("click", async () => {
  const selectedCheckboxes = document.querySelectorAll(".fertilizer_table input[type='checkbox']:checked");

  let selectedfertilizerIds = [];
  let hasInvalidId = false;
  let hasStocks = false;  // Flag to track if stocks exist

  for (const checkbox of selectedCheckboxes) {
      const fertilizerId = checkbox.getAttribute("data-fertilizer-id");

      // Validate fertilizerId (null, undefined, or empty string)
      if (!fertilizerId || fertilizerId.trim() === "") {
          hasInvalidId = true;
          break;
      }

      /* Check if the fertilizerType_id exists in the database */
      try {
          const q = query(collection(db, "tb_fertilizer"), where("fertilizer_id", "==", Number(fertilizerId)));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              hasInvalidId = true;
              console.error(`ERROR: Fertilizer ID ${fertilizerId} does not exist in the database.`);
              break;
          }

          // Check if there are stocks for this Fertilizer_type_id by querying tb_Fertilizer_stock
          const stockQuery = query(collection(db, "tb_fertilizer_stock"), where("fertilizer_id", "==", Number(fertilizerId)));
          const stockSnapshot = await getDocs(stockQuery);

          if (!stockSnapshot.empty) {
              for (const stockDoc of stockSnapshot.docs) {
                  const stocksArray = stockDoc.data().stocks;
                  if (Array.isArray(stocksArray) && stocksArray.length > 0) {
                      hasStocks = true;
                      console.error(`ERROR: Fertilizer ID ${fertilizerId} has stocks and cannot be deleted.`);
                      break;
                  }
              }
          }

          if (hasStocks) break;  // Stop further checks if stocks are found

          selectedfertilizerIds.push(fertilizerId);
      } catch (error) {
          console.error("Error fetching Fertilizer records or stocks:", error);
          hasInvalidId = true;
          break;
      }
  }

  if (hasInvalidId) {
      showDeleteMessage("ERROR: Fertilizer ID of one or more selected records are invalid", false);
  } else if (hasStocks) {
      showDeleteMessage("ERROR: One or more selected Fertilizers have existing stocks", false);
  } else {
      document.getElementById("fert-bulk-panel").style.display = "block"; // Show confirmation panel
  }
});

// Close the Bulk Delete Panel
document.getElementById("cancel-fert-delete").addEventListener("click", () => {
  document.getElementById("fert-bulk-panel").style.display = "none";
});

// Function to delete selected Fertilizers from both tb_Fertilizer_types and tb_Fertilizer_stock in Firestore
async function deleteSelectedFertilizers() {
  if (selectedFertilizers.length === 0) {
    return;
  }

  try {
    const fertilizersCollection = collection(db, "tb_fertilizer");
    const stocksCollection = collection(db, "tb_fertilizer_stock");
    const batch = writeBatch(db);  // Create a batch for efficient deletions

    for (const fertilizerId of selectedFertilizers) {
      // Delete from tb_Fertilizer_types
      const fertilizerQuery = query(fertilizersCollection, where("fertilizer_id", "==", Number(fertilizerId)));
      const fertilizerSnapshot = await getDocs(fertilizerQuery);

      if (!fertilizerSnapshot.empty) {
        for (const docSnapshot of fertilizerSnapshot.docs) {
          console.log("Deleting document ID from tb_fertilizer:", docSnapshot.id);
          batch.delete(doc(db, "tb_fertilizer", docSnapshot.id));  // Add to batch
        }
      } else {
        console.error(`ERROR: Fertilizer ID ${fertilizerId} does not exist in tb_fertilizer.`);
      }

      // Delete from tb_fertilizer_stock
      const stockQuery = query(stocksCollection, where("fertilizer_id", "==", Number(fertilizerId)));
      const stockSnapshot = await getDocs(stockQuery);

      if (!stockSnapshot.empty) {
        for (const stockDoc of stockSnapshot.docs) {
          console.log("Deleting document ID from tb_fertilizer_stock:", stockDoc.id);
          batch.delete(doc(db, "tb_fertilizer_stock", stockDoc.id));  // Add to batch
        }
      } else {
        console.warn(`WARNING: No matching stocks found for Fertilizer ID ${fertilizerId} in tb_fertilizer_stock.`);
      }
    }

    // Commit all deletions in a batch
    await batch.commit();
    console.log("Deleted ferts and Stocks:", selectedFertilizers);
    showDeleteMessage("All selected Fertilizer records and their stocks successfully deleted!", true);
    selectedFertilizers = [];  // Clear selection AFTER successful deletion
    document.getElementById("fert-bulk-panel").style.display = "none";
    fetchFertilizers();  // Refresh the table

  } catch (error) {
    console.error("Error deleting Fertilizers or stocks:", error);
    showDeleteMessage("Error deleting Fertilizers or stocks!", false);
  }
}

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE ------------------------>
const deleteMessage = document.getElementById("fert-bulk-message");

function showDeleteMessage(message, success) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.opacity = '1';
  deleteMessage.style.display = 'block';

  setTimeout(() => {
    deleteMessage.style.opacity = '0';
    setTimeout(() => {
      deleteMessage.style.display = 'none';
    }, 300);
  }, 4000);
}

// Search bar event listener for real-time filtering
document.getElementById("fert-search-bar").addEventListener("input", function () {
  const searchQuery = this.value.toLowerCase().trim();

  // Filter Fertilizers based on searchQuery, excluding stock and date fields
  filteredFertilizers = fertilizersList.filter(fertilizer => {
    return (
      fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_type?.toLowerCase().includes(searchQuery) ||
      fertilizer.fertilizer_id?.toString().includes(searchQuery) // Ensure ID is searchable
    );
  });

  currentPage = 1; // Reset pagination
  sortFertilizersById();
  displayFertilizers(filteredFertilizers); // Update the table with filtered Fertilizers
});
