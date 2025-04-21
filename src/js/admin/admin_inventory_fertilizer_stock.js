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

document.addEventListener("DOMContentLoaded", () => {
  fetchFertilizerNames();
  fetchFertilizers();
  addFertStock();
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
        item_name: itemName, // Use fertilizer_name as item_name
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

const debouncedCheckStockAndNotify = debounce(async (fertilizersData) => {
  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user_type in sessionStorage for notification check.");
      return;
    }

    for (const fertilizer of fertilizersData) {
      for (const stock of fertilizer.stocks) {
        const currentStock = parseInt(stock.current_stock, 10);
        if (isNaN(currentStock)) {
          console.log(
            `Skipping notification for ${fertilizer.fertilizer_name}: invalid stock value (${stock.current_stock})`
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
            where("item_name", "==", fertilizer.fertilizer_name),
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
              where("item_name", "==", fertilizer.fertilizer_name),
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
                where("item_name", "==", fertilizer.fertilizer_name),
                where("read", "==", false)
              );
              const allSnapshot = await getDocs(allQ);
              if (allSnapshot.empty || !querySnapshot.empty) {
                await addLowStockNotification(
                  fertilizer.fertilizer_name,
                  currentStock,
                  "Fertilizer",
                  threshold
                );
              }
            }
          } else {
            console.log(
              `Notification for ${fertilizer.fertilizer_name} already exists with notify: "no" for some recipients, skipping.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking stock and notifying:", error);
  }
}, 500); // 500ms debounce

// <-----------------------FETCH FERTILIZERS----------------------------->
let fertilizersList = [];
let filteredFertilizers = fertilizersList;
let currentPage = 1;
const rowsPerPage = 5;
let selectedFertilizers = [];

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

async function fetchFertilizers() {
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

    const fertilizersCollection = collection(db, "tb_fertilizer");
    const fertilizersQuery = query(fertilizersCollection);

    // Initial fetch and check
    const initialSnapshot = await getDocs(fertilizersQuery);
    const initialFertilizersData = await Promise.all(
      initialSnapshot.docs.map(async (doc) => {
        const fertilizer = doc.data();
        const fertilizerId = fertilizer.fertilizer_id;

        const stockCollection = collection(db, "tb_fertilizer_stock");
        const stockQuery = query(
          stockCollection,
          where("fertilizer_id", "==", fertilizerId)
        );
        const stockSnapshot = await getDocs(stockQuery);

        fertilizer.stocks = [];
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
              fertilizer.stocks = userStockData;
            } else {
              fertilizer.stocks = [
                {
                  stock_date: null,
                  current_stock: `Stock has not been updated yet for ${userType}`,
                  unit: "",
                  owned_by: `No stock record found for ${userType}`,
                },
              ];
            }
          } else {
            fertilizer.stocks = [
              {
                stock_date: null,
                current_stock: "Stock has not been updated yet",
                unit: "",
                owned_by: "No stock record found for any user type",
              },
            ];
          }
        } else {
          fertilizer.stocks = [
            {
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type",
            },
          ];
        }
        return fertilizer;
      })
    );

    fertilizersList = initialFertilizersData;
    filteredFertilizers = [...fertilizersList];
    sortFertilizersById();
    displayFertilizers(filteredFertilizers);
    await debouncedCheckStockAndNotify(initialFertilizersData); // Check stock on initial load

    // Real-time listener for subsequent updates
    onSnapshot(
      fertilizersQuery,
      async (snapshot) => {
        const fertilizersData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const fertilizer = doc.data();
            const fertilizerId = fertilizer.fertilizer_id;

            const stockCollection = collection(db, "tb_fertilizer_stock");
            const stockQuery = query(
              stockCollection,
              where("fertilizer_id", "==", fertilizerId)
            );
            const stockSnapshot = await getDocs(stockQuery);

            fertilizer.stocks = [];
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
                  fertilizer.stocks = userStockData;
                } else {
                  fertilizer.stocks = [
                    {
                      stock_date: null,
                      current_stock: `Stock has not been updated yet for ${userType}`,
                      unit: "",
                      owned_by: `No stock record found for ${userType}`,
                    },
                  ];
                }
              } else {
                fertilizer.stocks = [
                  {
                    stock_date: null,
                    current_stock: "Stock has not been updated yet",
                    unit: "",
                    owned_by: "No stock record found for any user type",
                  },
                ];
              }
            } else {
              fertilizer.stocks = [
                {
                  stock_date: null,
                  current_stock: "Stock has not been updated yet",
                  unit: "",
                  owned_by: "No stock record found for any user type",
                },
              ];
            }
            return fertilizer;
          })
        );

        fertilizersList = fertilizersData;
        filteredFertilizers = [...fertilizersList];
        sortFertilizersById();
        displayFertilizers(filteredFertilizers);
        await debouncedCheckStockAndNotify(fertilizersData); // Check stock on updates
      },
      (error) => {
        console.error("Error listening to fertilizers:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
  }
}

function sortFertilizersById() {
  filteredFertilizers.sort((a, b) => {
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      return a.fertilizer_id - b.fertilizer_id;
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
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center;">No records found</td>
      </tr>`;
    return;
  }

  paginatedFertilizers.forEach((fertilizer) => {
    fertilizer.stocks.forEach((stock) => {
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
        <td>${fertilizer.fertilizer_id || "N/A"}</td>
        <td>${fertilizer.fertilizer_name || "N/A"}</td>
        <td>${fertilizer.fertilizer_type || "N/A"}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td class="fert-action-btn">
          <span class="add-fert-stock-btn" data-id="${fertilizer.fertilizer_id}">
            <img src="/images/plusGreen.png" alt="Action Icon" class="action-icon-add">
            <span>Add Stock</span>
          </span>
          <span class="delete-fert-stock-btn" data-id="${fertilizer.fertilizer_id}">
            <img src="/images/ekisRed.png" alt="Action Icon" class="action-icon-remove">
            <span>Delete Stock</span>
          </span>
        </td>
      `;
      tableBody.appendChild(row);
    });
  });
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredFertilizers.length / rowsPerPage) || 1;
  document.getElementById(
    "fertilizer-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("fertilizer-prev-page").disabled = currentPage === 1;
  document.getElementById("fertilizer-next-page").disabled =
    currentPage >= Math.ceil(filteredFertilizers.length / rowsPerPage);
}

document
  .getElementById("fertilizer-prev-page")
  .addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayFertilizers(filteredFertilizers);
    }
  });

document
  .getElementById("fertilizer-next-page")
  .addEventListener("click", () => {
    if (currentPage * rowsPerPage < filteredFertilizers.length) {
      currentPage++;
      displayFertilizers(filteredFertilizers);
    }
  });

async function fetchFertilizerNames() {
  const fertilizersCollection = collection(db, "tb_fertilizer_types");
  const fertilizersSnapshot = await getDocs(fertilizersCollection);
  const fertilizerNames = fertilizersSnapshot.docs.map(
    (doc) => doc.data().fertilizer_type_name
  );
  populateFertilizerDropdown(fertilizerNames);
}

function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");
  if (!fertilizerSelect) {
    console.error("Fertilizer dropdown not found!");
    return;
  }
  const firstOption = fertilizerSelect.querySelector("option")?.outerHTML || "";
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach((fertilizerName) => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}

document
  .querySelector(".fertilizer_select")
  .addEventListener("change", function () {
    const selectedFertilizer = this.value.toLowerCase();
    filteredFertilizers = selectedFertilizer
      ? fertilizersList.filter(
          (fertilizer) =>
            fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer
        )
      : fertilizersList;
    currentPage = 1;
    sortFertilizersById();
    displayFertilizers(filteredFertilizers);
  });

document
  .getElementById("fert-search-bar")
  .addEventListener("input", function () {
    const searchQuery = this.value.toLowerCase().trim();
    filteredFertilizers = fertilizersList.filter((fertilizer) => {
      return (
        fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery) ||
        fertilizer.fertilizer_type?.toLowerCase().includes(searchQuery) ||
        fertilizer.fertilizer_id?.toString().includes(searchQuery)
      );
    });
    currentPage = 1;
    sortFertilizersById();
    displayFertilizers(filteredFertilizers);
  });

const fertilizerStockMessage = document.getElementById("fert-stock-message");

function showFertilizerStockMessage(message, success) {
  fertilizerStockMessage.textContent = message;
  fertilizerStockMessage.style.backgroundColor = success
    ? "#41A186"
    : "#f44336";
  fertilizerStockMessage.style.opacity = "1";
  fertilizerStockMessage.style.display = "block";
  setTimeout(() => {
    fertilizerStockMessage.style.opacity = "0";
    setTimeout(() => {
      fertilizerStockMessage.style.display = "none";
    }, 300);
  }, 4000);
}

const saveBtn = document.getElementById("fert-save-stock");
const fertilizerStockPanel = document.getElementById("fert-stock-panel");
const fertilizerOverlay = document.getElementById("fert-overlay");
const cancelBtn = document.getElementById("fert-cancel-stock");
const fertilizerStockTitle = document.getElementById("fert-stock-title");
const deleteStockTitle = document.getElementById("fert-delete-stock-title");
const deleteStockBtn = document.getElementById("fert-delete-stock");

fertilizerStockPanel.style.display = "none";
fertilizerOverlay.style.display = "none";

function addFertStock() {
  document
    .querySelector(".fertilizer_table")
    .addEventListener("click", async function (event) {
      const button =
        event.target.closest(".add-fert-stock-btn") ||
        event.target.closest(".delete-fert-stock-btn");
      if (!button) return;

      event.preventDefault();
      const fertilizerId = button.dataset.id;
      const isDelete = button.classList.contains("delete-fert-stock-btn");

      try {
        const user = await getAuthenticatedUser();
        if (!user || !user.user_type) {
          console.error("No authenticated user or user type found.");
          return;
        }

        const userType = user.user_type.trim();
        const tableRows = document.querySelectorAll(
          ".fertilizer_table table tbody tr"
        );
        let rowData = null;

        tableRows.forEach((row) => {
          if (row.cells[0].textContent.trim() === fertilizerId) {
            rowData = row;
          }
        });

        if (!rowData) {
          console.error("Fertilizer not found in table");
          return;
        }

        const fertilizerName =
          rowData.cells[1].textContent.trim() || "No name was recorded";
        const fertilizerType =
          rowData.cells[2].textContent.trim() || "No category was recorded";
        let currentStock =
          rowData.cells[4].textContent.trim() || "No stock recorded";
        let stockUnit = "";
        const stockParts = currentStock.split(" ");
        if (stockParts.length > 1) {
          currentStock = stockParts[0];
          stockUnit = stockParts[1];
        }

        const fertilizerUnit =
          document.getElementById("fert_unit_hidden").value ||
          stockUnit ||
          "No unit was recorded";

        document.getElementById("fert_name").value = fertilizerName;
        document.getElementById("fert_type").value = fertilizerType;
        document.getElementById("fert_unit_hidden").value = fertilizerUnit;
        document.getElementById("current_fert_stock").value =
          currentStock + (stockUnit ? ` ${stockUnit}` : "");
        document.getElementById("fert_stock").value = "";

        saveBtn.dataset.fertilizerId = fertilizerId;
        deleteStockBtn.dataset.fertilizerId = fertilizerId;

        fertilizerStockPanel.style.display = "block";
        fertilizerOverlay.style.display = "block";

        if (isDelete) {
          fertilizerStockTitle.style.display = "none";
          deleteStockTitle.style.display = "block";
          saveBtn.style.display = "none";
          deleteStockBtn.style.display = "block";
        } else {
          fertilizerStockTitle.style.display = "block";
          deleteStockTitle.style.display = "none";
          saveBtn.style.display = "block";
          deleteStockBtn.style.display = "none";
        }
      } catch (error) {
        console.error("Error fetching fertilizer details from table:", error);
      }
    });

  cancelBtn.addEventListener("click", closeStockPanel);
  fertilizerOverlay.addEventListener("click", closeStockPanel);

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
  fertilizerStockPanel.style.display = "none";
  fertilizerOverlay.style.display = "none";
  document.getElementById("fert_type").value = "";
  document.getElementById("fert_name").value = "";
  document.getElementById("fert_stock").value = "";
  document.getElementById("fert_unit_hidden").value = "";
  document.getElementById("current_fert_stock").value = "";
  fetchFertilizers();
}

async function saveStock() {
  const fertilizerId = Number(saveBtn.dataset.fertilizerId);
  const fertilizerType = document.getElementById("fert_type").value.trim();
  const fertilizerName = document.getElementById("fert_name").value.trim();
  const fertilizerStock = Number(document.getElementById("fert_stock").value);
  let unit = document.getElementById("fert_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "No unit was recorded";
  }

  if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
    showFertilizerStockMessage(
      "Please enter a valid fertilizer stock quantity.",
      false
    );
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showFertilizerStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showFertilizerStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_fertilizer_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("fertilizer_id", "==", fertilizerId)
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
        newStock = existingStock + fertilizerStock;
        stocks[userStockIndex].current_stock = newStock;
        stocks[userStockIndex].stock_date = Timestamp.now();
        stocks[userStockIndex].unit = unit;
      } else {
        newStock = fertilizerStock;
        stocks.push({
          owned_by: userType,
          current_stock: newStock,
          stock_date: Timestamp.now(),
          unit: unit,
        });
      }

      await updateDoc(inventoryDocRef, {
        stocks: stocks,
        fertilizer_type: fertilizerType,
        fertilizer_name: fertilizerName,
      });
    } else {
      newStock = fertilizerStock;
      await addDoc(inventoryCollection, {
        fertilizer_id: fertilizerId,
        fertilizer_name: fertilizerName,
        fertilizer_type: fertilizerType,
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
          where("item_name", "==", fertilizerName),
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
      `Added ${fertilizerStock} ${unit} of stock for ${fertilizerName} by ${userType}`
    );
    showFertilizerStockMessage(
      "Fertilizer Stock has been added successfully!",
      true
    );
    closeStockPanel();
  } catch (error) {
    console.error("Error saving fertilizer stock:", error);
    showFertilizerStockMessage(
      "An error occurred while saving fertilizer stock.",
      false
    );
  }
}

async function deleteStock() {
  const fertilizerId = Number(deleteStockBtn.dataset.fertilizerId);
  const fertilizerType = document.getElementById("fert_type").value.trim();
  const fertilizerName = document.getElementById("fert_name").value.trim();
  const fertilizerStock = Number(document.getElementById("fert_stock").value);
  let unit = document.getElementById("fert_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "No unit was recorded";
  }

  if (!fertilizerStock || isNaN(fertilizerStock) || fertilizerStock <= 0) {
    showFertilizerStockMessage(
      "Please enter a valid fertilizer stock quantity.",
      false
    );
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showFertilizerStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showFertilizerStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_fertilizer_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("fertilizer_id", "==", fertilizerId)
    );
    const inventorySnapshot = await getDocs(inventoryQuery);

    if (inventorySnapshot.empty) {
      showFertilizerStockMessage("No stock record found to delete.", false);
      return;
    }

    const inventoryDocRef = inventorySnapshot.docs[0].ref;
    const inventoryData = inventorySnapshot.docs[0].data();
    let stocks = inventoryData.stocks || [];

    const userStockIndex = stocks.findIndex(
      (stock) => stock.owned_by === userType
    );
    if (userStockIndex === -1) {
      showFertilizerStockMessage(
        "No stock entry found for this user type.",
        false
      );
      return;
    }

    const existingStock = stocks[userStockIndex].current_stock || 0;
    const newStock = existingStock - fertilizerStock;

    if (newStock < 0) {
      showFertilizerStockMessage("Not enough stock available", false);
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
      fertilizer_type: fertilizerType,
      fertilizer_name: fertilizerName,
    });

    await saveActivityLog(
      "Delete",
      `Deleted ${fertilizerStock} ${unit} of stock for ${fertilizerName} from ${userType} Inventory`
    );
    showFertilizerStockMessage(
      "Fertilizer Stock has been deleted successfully!",
      true
    );
    closeStockPanel();
  } catch (error) {
    console.error("Error deleting fertilizer stock:", error);
    showFertilizerStockMessage(
      "An error occurred while deleting fertilizer stock.",
      false
    );
  }
}
