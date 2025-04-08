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
  fetchEquipmentNames();
  fetchEquipments();
  addEquipStock();
});

function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

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
        item_name: itemName, // Use equipment_name as item_name
        timestamp: Timestamp.now(),
        read: false,
        notify: "no",
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

const debouncedCheckStockAndNotify = debounce(async (equipmentsData) => {
  try {
    const userType = sessionStorage.getItem("user_type");
    if (!userType) {
      console.error("No user_type in sessionStorage for notification check.");
      return;
    }

    for (const equipment of equipmentsData) {
      for (const stock of equipment.stocks) {
        const currentStock = parseInt(stock.current_stock, 10);
        if (isNaN(currentStock)) {
          console.log(
            `Skipping notification for ${equipment.equipment_name}: invalid stock value (${stock.current_stock})`
          );
          continue;
        }

        const threshold = 100;

        if (currentStock < threshold) {
          const notificationsRef = collection(db, "tb_notifications");
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

          const existingNoQ = query(
            notificationsRef,
            where("recipient", "in", recipients),
            where("type", "==", "low_stock"),
            where("item_name", "==", equipment.equipment_name),
            where("read", "==", false),
            where("notify", "==", "no")
          );
          const existingNoSnapshot = await getDocs(existingNoQ);

          if (existingNoSnapshot.empty) {
            const q = query(
              notificationsRef,
              where("recipient", "in", recipients),
              where("type", "==", "low_stock"),
              where("item_name", "==", equipment.equipment_name),
              where("read", "==", false),
              where("notify", "==", "yes")
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty || querySnapshot.empty) {
              const allQ = query(
                notificationsRef,
                where("recipient", "in", recipients),
                where("type", "==", "low_stock"),
                where("item_name", "==", equipment.equipment_name),
                where("read", "==", false)
              );
              const allSnapshot = await getDocs(allQ);
              if (allSnapshot.empty || !querySnapshot.empty) {
                await addLowStockNotification(
                  equipment.equipment_name,
                  currentStock,
                  "Equipment",
                  threshold
                );
              }
            }
          } else {
            console.log(
              `Notification for ${equipment.equipment_name} already exists with notify: "no" for some recipients, skipping.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking stock and notifying:", error);
  }
}, 500);

// <-----------------------FETCH EQUIPMENTS----------------------------->
let equipmentsList = [];
let filteredEquipments = equipmentsList;
let currentPage = 1;
const rowsPerPage = 5;
let selectedEquipments = [];

async function fetchEquipments() {
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

    const equipmentsCollection = collection(db, "tb_equipment");
    const equipmentsQuery = query(equipmentsCollection);

    // Initial fetch and check
    const initialSnapshot = await getDocs(equipmentsQuery);
    const initialEquipmentsData = await Promise.all(
      initialSnapshot.docs.map(async (doc) => {
        const equipment = doc.data();
        const equipmentId = equipment.equipment_id;

        const stockCollection = collection(db, "tb_equipment_stock");
        const stockQuery = query(
          stockCollection,
          where("equipment_id", "==", equipmentId)
        );
        const stockSnapshot = await getDocs(stockQuery);

        equipment.stocks = [];
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
              equipment.stocks = userStockData;
            } else {
              equipment.stocks = [
                {
                  stock_date: null,
                  current_stock: `Stock has not been updated yet for ${userType}`,
                  unit: "",
                  owned_by: `No stock record found for ${userType}`,
                },
              ];
            }
          } else {
            equipment.stocks = [
              {
                stock_date: null,
                current_stock: "Stock has not been updated yet",
                unit: "",
                owned_by: "No stock record found for any user type",
              },
            ];
          }
        } else {
          equipment.stocks = [
            {
              stock_date: null,
              current_stock: "Stock has not been updated yet",
              unit: "",
              owned_by: "No stock record found for any user type",
            },
          ];
        }
        return equipment;
      })
    );

    equipmentsList = initialEquipmentsData;
    filteredEquipments = [...equipmentsList];
    sortEquipmentsById();
    displayEquipments(filteredEquipments);
    await debouncedCheckStockAndNotify(initialEquipmentsData); // Check stock on initial load

    // Real-time listener for subsequent updates
    onSnapshot(
      equipmentsQuery,
      async (snapshot) => {
        const equipmentsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const equipment = doc.data();
            const equipmentId = equipment.equipment_id;

            const stockCollection = collection(db, "tb_equipment_stock");
            const stockQuery = query(
              stockCollection,
              where("equipment_id", "==", equipmentId)
            );
            const stockSnapshot = await getDocs(stockQuery);

            equipment.stocks = [];
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
                  equipment.stocks = userStockData;
                } else {
                  equipment.stocks = [
                    {
                      stock_date: null,
                      current_stock: `Stock has not been updated yet for ${userType}`,
                      unit: "",
                      owned_by: `No stock record found for ${userType}`,
                    },
                  ];
                }
              } else {
                equipment.stocks = [
                  {
                    stock_date: null,
                    current_stock: "Stock has not been updated yet",
                    unit: "",
                    owned_by: "No stock record found for any user type",
                  },
                ];
              }
            } else {
              equipment.stocks = [
                {
                  stock_date: null,
                  current_stock: "Stock has not been updated yet",
                  unit: "",
                  owned_by: "No stock record found for any user type",
                },
              ];
            }
            return equipment;
          })
        );

        equipmentsList = equipmentsData;
        filteredEquipments = [...equipmentsList];
        sortEquipmentsById();
        displayEquipments(filteredEquipments);
        await debouncedCheckStockAndNotify(equipmentsData); // Check stock on updates
      },
      (error) => {
        console.error("Error listening to equipments:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching equipments:", error);
  }
}

function sortEquipmentsById() {
  filteredEquipments.sort((a, b) => {
    const hasDateA = a.stocks.length > 0 && a.stocks[0].stock_date;
    const hasDateB = b.stocks.length > 0 && b.stocks[0].stock_date;

    if (hasDateA && hasDateB) {
      const latestDateA = parseDate(a.stocks[0].stock_date);
      const latestDateB = parseDate(b.stocks[0].stock_date);
      return latestDateB - latestDateA;
    } else if (!hasDateA && !hasDateB) {
      return a.equipment_id - b.equipment_id;
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

function displayEquipments(equipmentsList) {
  const tableBody = document.querySelector(".equipment_table table tbody");
  if (!tableBody) {
    console.error("Table body not found inside .equipment_table");
    return;
  }

  tableBody.innerHTML = "";
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedEquipments = equipmentsList.slice(startIndex, endIndex);

  if (paginatedEquipments.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center; color: red;">No records found</td>
      </tr>`;
    return;
  }

  paginatedEquipments.forEach((equipment) => {
    equipment.stocks.forEach((stock) => {
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
        <td>${equipment.equipment_id || "N/A"}</td>
        <td>${equipment.equipment_name || "N/A"}</td>
        <td>${equipment.equipment_category || "N/A"}</td>
        <td>${stock_date}</td>
        <td>${currentStock} ${unit}</td>
        <td>${owned_by}</td>
        <td class="equip-action-btn">
          <span class="add-equip-stock-btn" data-id="${
            equipment.equipment_id
          }">
            <img src="../../../public/images/plusGreen.png" alt="Action Icon" class="action-icon-add">
            <span>Add Stock</span>
          </span>
          <span class="delete-equip-stock-btn" data-id="${
            equipment.equipment_id
          }">
            <img src="../../../public/images/ekisRed.png" alt="Action Icon" class="action-icon-remove">
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
  const totalPages = Math.ceil(filteredEquipments.length / rowsPerPage) || 1;
  document.getElementById(
    "equipment-page-number"
  ).textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  document.getElementById("equipment-prev-page").disabled = currentPage === 1;
  document.getElementById("equipment-next-page").disabled =
    currentPage >= Math.ceil(filteredEquipments.length / rowsPerPage);
}

document.getElementById("equipment-prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    displayEquipments(filteredEquipments);
  }
});

document.getElementById("equipment-next-page").addEventListener("click", () => {
  if (currentPage * rowsPerPage < filteredEquipments.length) {
    currentPage++;
    displayEquipments(filteredEquipments);
  }
});

async function fetchEquipmentNames() {
  const equipmentsCollection = collection(db, "tb_equipment_types");
  const equipmentsSnapshot = await getDocs(equipmentsCollection);
  const equipmentNames = equipmentsSnapshot.docs.map(
    (doc) => doc.data().equipment_type_name
  );
  populateEquipmentDropdown(equipmentNames);
}

function populateEquipmentDropdown(equipmentNames) {
  const equipmentSelect = document.querySelector(".equipment_select");
  if (!equipmentSelect) {
    console.error("Equipment dropdown not found!");
    return;
  }
  const firstOption = equipmentSelect.querySelector("option")?.outerHTML || "";
  equipmentSelect.innerHTML = firstOption;

  equipmentNames.forEach((equipmentName) => {
    const option = document.createElement("option");
    option.textContent = equipmentName;
    equipmentSelect.appendChild(option);
  });
}

let currentFilteredList = [...equipmentsList];

function applyFilters() {
  const selectedEquipment = document
    .querySelector(".equipment_select")
    .value.toLowerCase()
    .trim();
  const searchQuery = document
    .getElementById("equip-search-bar")
    .value.toLowerCase()
    .trim();

  let filteredList = [...equipmentsList];

  if (selectedEquipment) {
    filteredList = filteredList.filter(
      (equipment) =>
        equipment.equipment_type_name?.toLowerCase() === selectedEquipment ||
        equipment.equipment_category?.toLowerCase() === selectedEquipment
    );
  }

  if (searchQuery) {
    filteredList = filteredList.filter(
      (equipment) =>
        equipment.equipment_name?.toLowerCase().includes(searchQuery) ||
        equipment.equipment_category?.toLowerCase().includes(searchQuery) ||
        equipment.equipment_id?.toString().includes(searchQuery)
    );
  }

  currentFilteredList = filteredList;
  currentPage = 1;
  sortEquipmentsById();
  displayEquipments(currentFilteredList);
}

document.querySelector(".equipment_select").addEventListener("change", () => {
  applyFilters();
});

document.getElementById("equip-search-bar").addEventListener("input", () => {
  applyFilters();
});

const equipmentStockMessage = document.getElementById("equip-stock-message");

function showEquipmentStockMessage(message, success) {
  equipmentStockMessage.textContent = message;
  equipmentStockMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  equipmentStockMessage.style.opacity = "1";
  equipmentStockMessage.style.display = "block";

  setTimeout(() => {
    equipmentStockMessage.style.opacity = "0";
    setTimeout(() => {
      equipmentStockMessage.style.display = "none";
    }, 300);
  }, 4000);
}

const saveBtn = document.getElementById("equip-save-stock");
const equipmentStockPanel = document.getElementById("equip-stock-panel");
const equipmentOverlay = document.getElementById("equip-overlay");
const cancelBtn = document.getElementById("equip-cancel-stock");
const equipmentStockTitle = document.getElementById("equip-stock-title");
const deleteStockTitle = document.getElementById("equip-delete-stock-title");
const deleteStockBtn = document.getElementById("equip-delete-stock");

equipmentStockPanel.style.display = "none";
equipmentOverlay.style.display = "none";

function addEquipStock() {
  document
    .querySelector(".equipment_table")
    .addEventListener("click", async function (event) {
      const button =
        event.target.closest(".add-equip-stock-btn") ||
        event.target.closest(".delete-equip-stock-btn");
      if (!button) return;

      event.preventDefault();
      const equipmentId = button.dataset.id;
      const isDelete = button.classList.contains("delete-equip-stock-btn");

      try {
        const user = await getAuthenticatedUser();
        if (!user || !user.user_type) {
          console.error("No authenticated user or user type found.");
          return;
        }

        const userType = user.user_type.trim();
        const tableRows = document.querySelectorAll(
          ".equipment_table table tbody tr"
        );
        let rowData = null;

        tableRows.forEach((row) => {
          if (row.cells[0].textContent.trim() === equipmentId) {
            rowData = row;
          }
        });

        if (!rowData) {
          console.error("Equipment not found in table");
          return;
        }

        const equipmentName =
          rowData.cells[1].textContent.trim() || "No name was recorded";
        const equipmentCategory =
          rowData.cells[2].textContent.trim() || "No category was recorded";
        let currentStock =
          rowData.cells[4].textContent.trim() || "No stock recorded";
        let stockUnit = "";
        const stockParts = currentStock.split(" ");
        if (stockParts.length > 1) {
          currentStock = stockParts[0];
          stockUnit = stockParts[1];
        }

        const equipmentUnit =
          document.getElementById("equip_unit_hidden").value || stockUnit || "";

        document.getElementById("equip_name").value = equipmentName;
        document.getElementById("equip_type").value = equipmentCategory;
        document.getElementById("equip_unit_hidden").value = equipmentUnit;
        document.getElementById("current_equip_stock").value =
          currentStock + (stockUnit ? ` ${stockUnit}` : "");
        document.getElementById("equip_stock").value = "";

        saveBtn.dataset.equipmentId = equipmentId;
        deleteStockBtn.dataset.equipmentId = equipmentId;

        equipmentStockPanel.style.display = "block";
        equipmentOverlay.style.display = "block";

        if (isDelete) {
          equipmentStockTitle.style.display = "none";
          deleteStockTitle.style.display = "block";
          saveBtn.style.display = "none";
          deleteStockBtn.style.display = "block";
        } else {
          equipmentStockTitle.style.display = "block";
          deleteStockTitle.style.display = "none";
          saveBtn.style.display = "block";
          deleteStockBtn.style.display = "none";
        }
      } catch (error) {
        console.error("Error fetching equipment details from table:", error);
      }
    });

  cancelBtn.addEventListener("click", closeStockPanel);
  equipmentOverlay.addEventListener("click", closeStockPanel);

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
  equipmentStockPanel.style.display = "none";
  equipmentOverlay.style.display = "none";
  document.getElementById("equip_type").value = "";
  document.getElementById("equip_name").value = "";
  document.getElementById("equip_stock").value = "";
  document.getElementById("equip_unit_hidden").value = "";
  document.getElementById("current_equip_stock").value = "";
  fetchEquipments();
}

async function saveStock() {
  const equipmentId = Number(saveBtn.dataset.equipmentId);
  const equipmentCategory = document.getElementById("equip_type").value.trim();
  const equipmentName = document.getElementById("equip_name").value.trim();
  const equipmentStock = Number(document.getElementById("equip_stock").value);
  let unit = document.getElementById("equip_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "";
  }

  if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
    showEquipmentStockMessage(
      "Please enter a valid equipment stock quantity.",
      false
    );
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showEquipmentStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showEquipmentStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_equipment_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("equipment_id", "==", equipmentId)
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
        newStock = existingStock + equipmentStock;
        stocks[userStockIndex].current_stock = newStock;
        stocks[userStockIndex].stock_date = Timestamp.now();
        stocks[userStockIndex].unit = unit;
      } else {
        newStock = equipmentStock;
        stocks.push({
          owned_by: userType,
          current_stock: newStock,
          stock_date: Timestamp.now(),
          unit: unit,
        });
      }

      await updateDoc(inventoryDocRef, {
        stocks: stocks,
        equipment_type: equipmentCategory,
        equipment_name: equipmentName,
      });
    } else {
      newStock = equipmentStock;
      await addDoc(inventoryCollection, {
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        equipment_type: equipmentCategory,
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

    // If new stock is >= 100, update notify to "yes" in tb_notifications
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
          where("item_name", "==", equipmentName),
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
      `Added ${equipmentStock} ${unit} of stock for ${equipmentName} by ${userType}`
    );
    showEquipmentStockMessage(
      "Equipment Stock has been added successfully!",
      true
    );
    closeStockPanel();
  } catch (error) {
    console.error("Error saving equipment stock:", error);
    showEquipmentStockMessage(
      "An error occurred while saving equipment stock.",
      false
    );
  }
}

async function deleteStock() {
  const equipmentId = Number(deleteStockBtn.dataset.equipmentId);
  const equipmentCategory = document.getElementById("equip_type").value.trim();
  const equipmentName = document.getElementById("equip_name").value.trim();
  const equipmentStock = Number(document.getElementById("equip_stock").value);
  let unit = document.getElementById("equip_unit").value.trim();

  if (!unit || unit === "Invalid Unit") {
    unit = "";
  }

  if (!equipmentStock || isNaN(equipmentStock) || equipmentStock <= 0) {
    showEquipmentStockMessage(
      "Please enter a valid equipment stock quantity.",
      false
    );
    return;
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      showEquipmentStockMessage("User not authenticated.", false);
      return;
    }

    const usersCollection = collection(db, "tb_users");
    const userQuery = query(usersCollection, where("email", "==", user.email));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      showEquipmentStockMessage("User not found in the database.", false);
      return;
    }

    const userType = userSnapshot.docs[0].data().user_type;

    const inventoryCollection = collection(db, "tb_equipment_stock");
    const inventoryQuery = query(
      inventoryCollection,
      where("equipment_id", "==", equipmentId)
    );
    const inventorySnapshot = await getDocs(inventoryQuery);

    if (inventorySnapshot.empty) {
      showEquipmentStockMessage("No stock record found to delete.", false);
      return;
    }

    const inventoryDocRef = inventorySnapshot.docs[0].ref;
    const inventoryData = inventorySnapshot.docs[0].data();
    let stocks = inventoryData.stocks || [];

    const userStockIndex = stocks.findIndex(
      (stock) => stock.owned_by === userType
    );
    if (userStockIndex === -1) {
      showEquipmentStockMessage(
        "No stock entry found for this user type.",
        false
      );
      return;
    }

    const existingStock = stocks[userStockIndex].current_stock || 0;
    const newStock = existingStock - equipmentStock;

    if (newStock < 0) {
      showEquipmentStockMessage("Not enough stock available", false);
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
      equipment_type: equipmentCategory,
      equipment_name: equipmentName,
    });

    await saveActivityLog(
      "Delete",
      `Deleted ${equipmentStock} ${unit} of stock for ${equipmentName} from ${userType} Inventory`
    );
    showEquipmentStockMessage(
      "Equipment Stock has been deleted successfully!",
      true
    );
    closeStockPanel();
  } catch (error) {
    console.error("Error deleting equipment stock:", error);
    showEquipmentStockMessage(
      "An error occurred while deleting equipment stock.",
      false
    );
  }
}
