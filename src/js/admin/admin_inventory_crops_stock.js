import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
const auth = getAuth();

// Initialize fetches when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchCropNames();
  fetchCrops();
  addCropStock();
});

// <-----------------------ACTIVITY LOG CODE----------------------------->
async function saveActivityLog(action, description) {
  const allowedActions = ["Create", "Update", "Delete"];
  if (!allowedActions.includes(action)) {
    console.error(
      "Invalid action. Allowed actions are: create, update, delete."
    );
    return;
  }
  if (!description || typeof description !== "string") {
    console.error("Activity description is required and must be a string.");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDocRef = doc(db, "tb_users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        console.error("User data not found in tb_users.");
        return;
      }

      const userData = userDocSnap.data();
      const userName = userData.user_name || "Unknown User";
      const userType = userData.user_type || "Unknown Type";

      const currentTimestamp = Timestamp.now().toDate();
      const date = currentTimestamp.toLocaleDateString("en-US");
      const time = currentTimestamp.toLocaleTimeString("en-US");

      const activityLogCollection = collection(db, "tb_activity_log");
      try {
        const counterDocRef = doc(
          db,
          "tb_id_counters",
          "activity_log_id_counter"
        );
        const counterDocSnap = await getDoc(counterDocRef);
        if (!counterDocSnap.exists()) {
          console.error("Counter document not found.");
          return;
        }

        let currentCounter = counterDocSnap.data().value || 0;
        let newCounter = currentCounter + 1;
        await updateDoc(counterDocRef, { value: newCounter });

        await addDoc(activityLogCollection, {
          activity_log_id: newCounter,
          username: userName,
          user_type: userType,
          activity: action,
          activity_desc: description,
          date: date,
          time: time,
        });
        console.log("Activity log saved successfully with ID:", newCounter);
      } catch (error) {
        console.error("Error saving activity log:", error);
      }
    } else {
      console.error("No authenticated user found.");
    }
  });
}

// <-----------------------NOTIFICATION CODE----------------------------->
// Debounce utility to prevent multiple rapid calls
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function addLowStockNotification(itemName, stock, type, threshold) {
  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user_type found in sessionStorage for notification.");
      return;
    }

    // Fetch all users with the same user_type
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(
      usersCollection,
      where("user_type", "==", userType)
    );
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error(`No users found with user_type: ${userType}`);
      return;
    }

    const notificationsRef = collection(db, "tb_notifications");
    const notificationPromises = userSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const recipient = userData.user_name || "Unknown User";

      const notificationDoc = {
        recipient: recipient,
        type: "low_stock",
        title: "LOW STOCK ALERT",
        description: `${type} '${itemName}' stock is low: ${stock} remaining (below ${threshold}).`,
        item_name: itemName,
        timestamp: Timestamp.now(),
        read: false,
        notify: "no", // Set to "no" when notification is created
      };

      return addDoc(notificationsRef, notificationDoc);
    });

    await Promise.all(notificationPromises);
    console.log(
      `✅ Added low stock notifications for ${type}: ${itemName} to all ${userType} users`
    );
  } catch (error) {
    console.error("Error adding low stock notifications:", error);
  }
}

const debouncedCheckStockAndNotify = debounce(async (cropsData) => {
  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user_type in sessionStorage for notification check.");
      return;
    }

    for (const crop of cropsData) {
      for (const stock of crop.stocks) {
        const currentStock = parseInt(stock.current_stock, 10);
        if (isNaN(currentStock)) {
          console.log(
            `Skipping notification for ${crop.crop_type_name}: invalid stock value (${stock.current_stock})`
          );
          continue;
        }

        const threshold = 100;

        if (currentStock < threshold) {
          const notificationsRef = collection(db, "tb_notifications");
          // Fetch all users with the same user_type
          const usersCollection = collection(db, "tb_users");
          const userQuery = query(
            usersCollection,
            where("user_type", "==", userType)
          );
          const userSnapshot = await getDocs(userQuery);

          if (userSnapshot.empty) {
            console.error(`No users found with user_type: ${userType}`);
            continue;
          }

          const recipients = userSnapshot.docs.map(
            (doc) => doc.data().user_name || "Unknown User"
          );

          // Check if any recipient already has an unread notification with notify: "no"
          const existingNoQ = query(
            notificationsRef,
            where("recipient", "in", recipients),
            where("type", "==", "low_stock"),
            where("item_name", "==", crop.crop_type_name),
            where("read", "==", false),
            where("notify", "==", "no")
          );
          const existingNoSnapshot = await getDocs(existingNoQ);

          if (existingNoSnapshot.empty) {
            // No unread "no" notification exists for any recipient, check for "yes"
            const q = query(
              notificationsRef,
              where("recipient", "in", recipients),
              where("type", "==", "low_stock"),
              where("item_name", "==", crop.crop_type_name),
              where("read", "==", false),
              where("notify", "==", "yes")
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty || querySnapshot.empty) {
              // Send a new notification if "yes" exists or no notification at all
              const allQ = query(
                notificationsRef,
                where("recipient", "in", recipients),
                where("type", "==", "low_stock"),
                where("item_name", "==", crop.crop_type_name),
                where("read", "==", false)
              );
              const allSnapshot = await getDocs(allQ);
              if (allSnapshot.empty || !querySnapshot.empty) {
                await addLowStockNotification(
                  crop.crop_type_name,
                  currentStock,
                  "Crop",
                  threshold
                );
              }
            }
          } else {
            console.log(
              `Notification for ${crop.crop_type_name} already exists with notify: "no" for some recipients, skipping.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking stock and notifying:", error);
  }
}, 500); // 500ms debounce

// <-----------------------FETCH CROPS----------------------------->
let cropsList = [];
let currentPage = 1;
const rowsPerPage = 5;
let filteredCrops = [];

async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userQuery = query(
            collection(db, "tb_users"),
            where("email", "==", user.email)
          );
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            sessionStorage.setItem("user_type", userData.user_type); // Ensure user_type is set
            resolve({ ...user, user_type: userData.user_type });
          } else {
            reject("User record not found.");
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject("User not authenticated.");
      }
    });
  });
}

async function fetchCrops() {
  try {
    const user = await getAuthenticatedUser();
    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      console.error("User not found in the database.");
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const cropsCollection = collection(db, "tb_crop_types");
    const cropsQuery = query(cropsCollection);

    // Initial fetch and check
    const initialSnapshot = await getDocs(cropsQuery);
    const initialCropsData = await Promise.all(
      initialSnapshot.docs.map(async (doc) => {
        const crop = doc.data();
        const cropTypeId = crop.crop_type_id;

        const stockCollection = collection(db, "tb_crop_stock");
        const stockQuery = query(
          stockCollection,
          where("crop_type_id", "==", cropTypeId)
        );
        const stockSnapshot = await getDocs(stockQuery);

        crop.stocks = [];
        if (!stockSnapshot.empty) {
          const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
            const stockData = stockDoc.data();
            return stockData.stocks || [];
          });

          if (stockDataArray.length > 0) {
            const userStockData = stockDataArray.filter(
              (stock) => stock.owned_by === userType
            );
            if (userStockData.length > 0) {
              userStockData.forEach((stock) => {
                if (stock.current_stock === 0) {
                  stock.current_stock = `No available stock for ${userType}`;
                  stock.unit = "";
                }
              });
              crop.stocks = userStockData;
            } else {
              crop.stocks = [
                {
                  stock_date: null,
                  current_stock: `Stock has not been updated yet for ${userType}`,
                  unit: "",
                  owned_by: `No stock record found for ${userType}`,
                },
              ];
            }
          } else {
            crop.stocks = [
              {
                stock_date: null,
                current_stock: "Stock has not been updated yet",
                unit: "",
                owned_by: "No stock record found for any user type",
              },
            ];
          }
        } else {
          crop.stocks = [
            {
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type",
            },
          ];
        }
        return crop;
      })
    );

    // Set initial data and check stock immediately
    cropsList = initialCropsData;
    filteredCrops = [...cropsList];
    sortCropsById();
    displayCrops(filteredCrops);
    await debouncedCheckStockAndNotify(initialCropsData); // Check stock on initial load

    // Real-time listener for subsequent updates
    onSnapshot(
      cropsQuery,
      async (snapshot) => {
        const cropsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const crop = doc.data();
            const cropTypeId = crop.crop_type_id;

            const stockCollection = collection(db, "tb_crop_stock");
            const stockQuery = query(
              stockCollection,
              where("crop_type_id", "==", cropTypeId)
            );
            const stockSnapshot = await getDocs(stockQuery);

            crop.stocks = [];
            if (!stockSnapshot.empty) {
              const stockDataArray = stockSnapshot.docs.flatMap((stockDoc) => {
                const stockData = stockDoc.data();
                return stockData.stocks || [];
              });

              if (stockDataArray.length > 0) {
                const userStockData = stockDataArray.filter(
                  (stock) => stock.owned_by === userType
                );
                if (userStockData.length > 0) {
                  userStockData.forEach((stock) => {
                    if (stock.current_stock === 0) {
                      stock.current_stock = `No available stock for ${userType}`;
                      stock.unit = "";
                    }
                  });
                  crop.stocks = userStockData;
                } else {
                  crop.stocks = [
                    {
                      stock_date: null,
                      current_stock: `Stock has not been updated yet for ${userType}`,
                      unit: "",
                      owned_by: `No stock record found for ${userType}`,
                    },
                  ];
                }
              } else {
                crop.stocks = [
                  {
                    stock_date: null,
                    current_stock: "Stock has not been updated yet",
                    unit: "",
                    owned_by: "No stock record found for any user type",
                  },
                ];
              }
            } else {
              crop.stocks = [
                {
                  stock_date: null,
                  current_stock: "Stock has not been updated yet",
                  unit: "",
                  owned_by: "No stock record found for any user type",
                },
              ];
            }
            return crop;
          })
        );

        cropsList = cropsData;
        filteredCrops = [...cropsList];
        sortCropsById();
        displayCrops(filteredCrops);
        await debouncedCheckStockAndNotify(cropsData); // Check stock on updates
      },
      (error) => {
        console.error("Error listening to crops:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching crops:", error);
  }
}

function sortCropsById() {
  filteredCrops.sort((a, b) => {
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      return a.crop_type_id - b.crop_type_id;
    } else {
      return hasDateB - hasDateA;
    }
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0);
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  return new Date(dateValue);
}

function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .crop_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCrops = cropsList.slice(startIndex, endIndex);

  if (paginatedCrops.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="7" style="text-align: center;">No records found</td>
      </tr>`;
    return;
  }

  paginatedCrops.forEach((crop) => {
    crop.stocks.forEach((stock) => {
      const row = document.createElement("tr");
      const stock_date = stock.stock_date
        ? stock.stock_date.toDate
          ? stock.stock_date.toDate().toLocaleDateString()
          : new Date(stock.stock_date).toLocaleDateString()
        : "Stock has not been updated";
      const currentStock = stock.current_stock || "";
      const unit = stock.unit || "";
      const owned_by = stock.owned_by || "Owner not Recorded";

      row.innerHTML = `
        <td>${crop.crop_type_id || "N/A"}</td>
        <td>${crop.crop_type_name || "N/A"}</td>
        <td>${crop.crop_name || "N/A"}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td class="crop-action-btn">
          <span class="add-crop-stock-btn" data-id="${crop.crop_type_id}">
            <img src="/images/plusGreen.png" alt="Action Icon" class="action-icon-add">
            <span>Add Stock</span>
          </span>
          <span class="delete-crop-stock-btn" data-id="${crop.crop_type_id}">
            <img src="/images/ekisRed.png" alt="Action Icon" class="action-icon-remove">
            <span>Remove Stock</span>
          </span>
        </td>
      `;
      tableBody.appendChild(row);
    });
  });
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredCrops.length / rowsPerPage) || 1;
  document.getElementById(
    "crop-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("crop-prev-page").disabled = currentPage === 1;
  document.getElementById("crop-next-page").disabled =
    currentPage >= Math.ceil(filteredCrops.length / rowsPerPage);
}

document.getElementById("crop-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayCrops(filteredCrops);
  }
});

document.getElementById("crop-next-page").addEventListener("click", () => {
  if (currentPage * rowsPerPage < filteredCrops.length) {
    currentPage++;
    displayCrops(filteredCrops);
  }
});

async function fetchCropNames() {
  const cropsCollection = collection(db, "tb_crops");
  const cropsSnapshot = await getDocs(cropsCollection);
  const cropNames = cropsSnapshot.docs.map((doc) => doc.data().crop_name);
  populateCropDropdown(cropNames);
}

function populateCropDropdown(cropNames) {
  const cropSelect = document.querySelector(".crop_select");
  if (!cropSelect) {
    console.error("Crop dropdown not found!");
    return;
  }
  const firstOption = cropSelect.querySelector("option")?.outerHTML || "";
  cropSelect.innerHTML = firstOption;

  cropNames.forEach((cropName) => {
    const option = document.createElement("option");
    option.textContent = cropName;
    cropSelect.appendChild(option);
  });
}

document.querySelector(".crop_select").addEventListener("change", function () {
  const selectedCrop = this.value.toLowerCase();
  filteredCrops = selectedCrop
    ? cropsList.filter((crop) => crop.crop_name?.toLowerCase() === selectedCrop)
    : cropsList;
  currentPage = 1;
  sortCropsById();
  displayCrops(filteredCrops);
});

document
  .getElementById("crop-search-bar")
  .addEventListener("input", function () {
    const searchQuery = this.value.toLowerCase().trim();
    filteredCrops = cropsList.filter((crop) => {
      return (
        crop.crop_name?.toLowerCase().includes(searchQuery) ||
        crop.crop_type_name?.toLowerCase().includes(searchQuery) ||
        crop.crop_type_id?.toString().includes(searchQuery)
      );
    });
    currentPage = 1;
    sortCropsById();
    displayCrops(filteredCrops);
  });

const cropStockMessage = document.getElementById("crop-stock-message");

function showCropStockMessage(message, success) {
  cropStockMessage.textContent = message;
  cropStockMessage.style.backgroundColor = success ? "#41A186" : "#f44336";
  cropStockMessage.style.opacity = "1";
  cropStockMessage.style.display = "block";
  setTimeout(() => {
    cropStockMessage.style.opacity = "0";
    setTimeout(() => {
      cropStockMessage.style.display = "none";
    }, 300);
  }, 4000);
}

const saveBtn = document.getElementById("crop-save-stock");
const cropStockPanel = document.getElementById("crop-stock-panel");
const cropOverlay = document.getElementById("crop-overlay");
const cancelBtn = document.getElementById("crop-cancel-stock");
const cropStockTitle = document.getElementById("crop-stock-title");
const deleteStockTitle = document.getElementById("crop-delete-stock-title");
const deleteStockBtn = document.getElementById("crop-delete-stock");

cropStockPanel.style.display = "none";
cropOverlay.style.display = "none";

function addCropStock() {
  document
    .querySelector(".crop_table")
    .addEventListener("click", async function (event) {
      const button =
        event.target.closest(".add-crop-stock-btn") ||
        event.target.closest(".delete-crop-stock-btn");
      if (!button) return;

      event.preventDefault();
      const cropTypeId = button.dataset.id;
      const isDelete = button.classList.contains("delete-crop-stock-btn");

      try {
        const user = await getAuthenticatedUser();
        if (!user || !user.user_type) {
          console.error("No authenticated user or user type found.");
          return;
        }

        const userType = user.user_type.trim();
        const tableRows = document.querySelectorAll(
          ".crop_table table tbody tr"
        );
        let rowData = null;

        tableRows.forEach((row) => {
          if (row.cells[0].textContent.trim() === cropTypeId) {
            rowData = row;
          }
        });

        if (!rowData) {
          console.error("Crop not found in table");
          return;
        }

        const cropTypeName =
          rowData.cells[1].textContent.trim() || "No category was recorded";
        const cropName =
          rowData.cells[2].textContent.trim() || "No name was recorded";
        let currentStock =
          rowData.cells[4].textContent.trim() || "No stock recorded";
        let stockUnit = "";
        const stockParts = currentStock.split(" ");
        if (stockParts.length > 1) {
          currentStock = stockParts[0];
          stockUnit = stockParts[1];
        }

        const cropUnit =
          document.getElementById("crop_unit_hidden").value ||
          stockUnit ||
          "No unit was recorded";

        document.getElementById("crops").value = cropTypeName;
        document.getElementById("crop_name").value = cropName;
        document.getElementById("crop_unit_hidden").value = cropUnit;
        document.getElementById("current_crop_stock").value =
          currentStock + (stockUnit ? ` ${stockUnit}` : "");
        document.getElementById("crop_stock").value = "";

        saveBtn.dataset.cropTypeId = cropTypeId;
        deleteStockBtn.dataset.cropTypeId = cropTypeId;

        cropStockPanel.style.display = "block";
        cropOverlay.style.display = "block";

        if (isDelete) {
          cropStockTitle.style.display = "none";
          deleteStockTitle.style.display = "block";
          saveBtn.style.display = "none";
          deleteStockBtn.style.display = "block";
        } else {
          cropStockTitle.style.display = "block";
          deleteStockTitle.style.display = "none";
          saveBtn.style.display = "block";
          deleteStockBtn.style.display = "none";
        }
      } catch (error) {
        console.error("Error fetching crop details from table:", error);
      }
    });

  cancelBtn.addEventListener("click", closeStockPanel);
  cropOverlay.addEventListener("click", closeStockPanel);

  let isSaving = false;
  let isDeleting = false;

  saveBtn.addEventListener("click", async () => {
    if (isSaving) return;
    isSaving = true;
    saveBtn.disabled = true;

    try {
      await saveStock();
    } catch (error) {
      console.error("Error saving stock:", error);
    } finally {
      isSaving = false;
      saveBtn.disabled = false;
    }
  });

  deleteStockBtn.addEventListener("click", async () => {
    if (isDeleting) return;
    isDeleting = true;
    deleteStockBtn.disabled = true;

    try {
      await deleteStock();
    } catch (error) {
      console.error("Error deleting stock:", error);
    } finally {
      isDeleting = false;
      deleteStockBtn.disabled = false;
    }
  });
}

function closeStockPanel() {
  cropStockPanel.style.display = "none";
  cropOverlay.style.display = "none";
  document.getElementById("crops").value = "";
  document.getElementById("crop_name").value = "";
  document.getElementById("crop_stock").value = "";
  document.getElementById("crop_unit_hidden").value = "";
  document.getElementById("current_crop_stock").value = "";
  fetchCrops();
}

async function saveStock() {
  const cropTypeId = Number(saveBtn.dataset.cropTypeId);
  const cropTypeName = document.getElementById("crops").value.trim();
  const cropName = document.getElementById("crop_name").value.trim();
  const cropStock = Number(document.getElementById("crop_stock").value);
  let unit = document.getElementById("crop_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "No unit was recorded";
  }

  if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
    showCropStockMessage("Please enter a valid crop stock quantity.", false);
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showCropStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showCropStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_crop_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("crop_type_id", "==", cropTypeId)
    );
    const inventorySnapshot = await getDocs(inventoryQuery);

    let newStock;
    if (!inventorySnapshot.empty) {
      const inventoryDocRef = inventorySnapshot.docs[0].ref;
      const inventoryData = inventorySnapshot.docs[0].data();
      const stocks = inventoryData.stocks || [];

      const userStockIndex = stocks.findIndex(
        (stock) => stock.owned_by === userType
      );
      if (userStockIndex !== -1) {
        const existingStock = stocks[userStockIndex].current_stock || 0;
        newStock = existingStock + cropStock;
        stocks[userStockIndex].current_stock = newStock;
        stocks[userStockIndex].stock_date = Timestamp.now();
        stocks[userStockIndex].unit = unit;
      } else {
        newStock = cropStock;
        stocks.push({
          owned_by: userType,
          current_stock: newStock,
          stock_date: Timestamp.now(),
          unit: unit,
        });
      }

      await updateDoc(inventoryDocRef, {
        stocks: stocks,
        crop_name: cropName,
        crop_type_name: cropTypeName,
      });
    } else {
      newStock = cropStock;
      await addDoc(inventoryCollection, {
        crop_type_id: cropTypeId,
        crop_name: cropName,
        crop_type_name: cropTypeName,
        stocks: [
          {
            owned_by: userType,
            current_stock: newStock,
            stock_date: Timestamp.now(),
            unit: unit,
          },
        ],
      });
    }

    // If new stock is >= 100, update notify to "yes" in tb_notifications for all users with same user_type
    if (newStock >= 100) {
      const userType = sessionStorage.getItem("user_type");
      if (userType) {
        const usersCollection = collection(db, "tb_users");
        const userQuery = query(
          usersCollection,
          where("user_type", "==", userType)
        );
        const userSnapshot = await getDocs(userQuery);

        const recipients = userSnapshot.docs.map(
          (doc) => doc.data().user_name || "Unknown User"
        );

        const notificationsRef = collection(db, "tb_notifications");
        const q = query(
          notificationsRef,
          where("recipient", "in", recipients),
          where("type", "==", "low_stock"),
          where("item_name", "==", cropTypeName),
          where("read", "==", false)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
          await updateDoc(doc.ref, { notify: "yes" });
        });
      }
    }

    await saveActivityLog(
      "Update",
      `Added ${cropStock} ${unit} of stock for ${cropTypeName} by ${userType}`
    );
    showCropStockMessage("Crop Stock has been added successfully!", true);
    closeStockPanel();
  } catch (error) {
    console.error("Error saving crop stock:", error);
    showCropStockMessage("An error occurred while saving crop stock.", false);
  }
}

async function deleteStock() {
  const cropTypeId = Number(deleteStockBtn.dataset.cropTypeId);
  const cropTypeName = document.getElementById("crops").value.trim();
  const cropName = document.getElementById("crop_name").value.trim();
  const cropStock = Number(document.getElementById("crop_stock").value);
  let unit = document.getElementById("crop_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "No unit was recorded";
  }

  if (!cropStock || isNaN(cropStock) || cropStock <= 0) {
    showCropStockMessage("Please enter a valid crop stock quantity.", false);
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showCropStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showCropStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_crop_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("crop_type_id", "==", cropTypeId)
    );
    const inventorySnapshot = await getDocs(inventoryQuery);

    if (inventorySnapshot.empty) {
      showCropStockMessage("No stock record found to delete.", false);
      return;
    }

    const inventoryDocRef = inventorySnapshot.docs[0].ref;
    const inventoryData = inventorySnapshot.docs[0].data();
    let stocks = inventoryData.stocks || [];

    const userStockIndex = stocks.findIndex(
      (stock) => stock.owned_by === userType
    );
    if (userStockIndex === -1) {
      showCropStockMessage("No stock entry found for this user type.", false);
      return;
    }

    const existingStock = stocks[userStockIndex].current_stock || 0;
    const newStock = existingStock - cropStock;

    if (newStock < 0) {
      showCropStockMessage("Not enough stock available", false);
      return;
    }

    if (newStock === 0) {
      stocks.splice(userStockIndex, 1);
    } else {
      stocks[userStockIndex].current_stock = newStock;
      stocks[userStockIndex].stock_date = Timestamp.now();
      stocks[userStockIndex].unit = unit;
    }

    await updateDoc(inventoryDocRef, {
      stocks: stocks,
      crop_name: cropName,
      crop_type_name: cropTypeName,
    });

    await saveActivityLog(
      "Delete",
      `Deleted ${cropStock} ${unit} of stock for ${cropTypeName} from ${userType} Inventory`
    );
    showCropStockMessage("Crop Stock has been Deleted successfully!", true);
    closeStockPanel();
  } catch (error) {
    console.error("Error deleting crop stock:", error);
    showCropStockMessage("An error occurred while deleting crop stock.", false);
  }
}
