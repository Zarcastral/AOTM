import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const tableBody = document.getElementById("table_body");
const barangaySelect = document.getElementById("barangay-select");
const searchBar = document.getElementById("search-bar");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
const deleteMessage = document.getElementById("delete-message");
const deleteSelectedBtn = document.getElementById("bulk-delete");
const bulkDeletePanel = document.getElementById("bulk-delete-panel");
const confirmDeleteBtn = document.getElementById("confirm-bulk-delete");
const cancelDeleteBtn = document.getElementById("cancel-bulk-delete");
const downloadBtn = document.getElementById("download-btn");

const editFormContainer = document.createElement("div");
editFormContainer.id = "edit-form-container";
editFormContainer.style.display = "none";
document.body.appendChild(editFormContainer);

// State Variables
let currentPage = 1;
const rowsPerPage = 5;
let farmerAccounts = [];
let selectedFarmerId = null;
let selectedRowId = null;
let idsToDelete = [];
let isDataLoading = false;

// Activity Log Function (Updated to use email)
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
      // Query tb_users by email instead of uid
      const userQuery = query(
        collection(db, "tb_users"),
        where("email", "==", user.email)
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        console.error("User data not found in tb_users for email:", user.email);
        return;
      }

      const userData = userSnapshot.docs[0].data();
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

// Get Authenticated User (Updated to use email)
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
            resolve({
              user_name: userData.user_name,
              email: user.email,
              user_type: userData.user_type,
            });
          } else {
            console.error(
              "User record not found in tb_users for email:",
              user.email
            );
            reject("User record not found.");
          }
        } catch (error) {
          console.error("Error fetching user from tb_users:", error);
          reject(error);
        }
      } else {
        reject("No authenticated user.");
      }
    });
  });
}

// Function to manage PDF download button state
function updateDownloadButtonState() {
  if (downloadBtn) {
    const isDisabled = isDataLoading || farmerAccounts.length === 0;
    downloadBtn.disabled = isDisabled;
    downloadBtn.style.opacity = isDisabled ? "0.5" : "1";
    downloadBtn.style.backgroundColor = isDisabled ? "#cccccc" : ""; // Default background color when enabled
    downloadBtn.style.cursor = isDisabled ? "not-allowed" : "pointer";
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  fetchFarmerAccounts();
  fetch_barangays();
  updateDownloadButtonState();
});

// Fetch Farmer Accounts
async function fetchFarmerAccounts(filter = {}) {
  try {
    isDataLoading = true;
    updateDownloadButtonState();

    const querySnapshot = await getDocs(collection(db, "tb_farmers"));
    farmerAccounts = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const searchTerm = filter.search?.toLowerCase();
      const matchesSearch = searchTerm
        ? `${data.first_name || ""} ${data.middle_name || ""} ${
            data.last_name || ""
          }`
            .toLowerCase()
            .includes(searchTerm) ||
          (data.farmer_id || "").toLowerCase().includes(searchTerm) ||
          (data.user_type || "").toLowerCase().includes(searchTerm) ||
          (data.user_name || "").toLowerCase().includes(searchTerm)
        : true;

      const matchesBarangay = filter.barangay_name
        ? (data.barangay_name || "").toLowerCase() ===
          filter.barangay_name.toLowerCase()
        : true;

      if (matchesSearch && matchesBarangay) {
        farmerAccounts.push({ id: doc.id, ...data });
      }
    });

    const missingFarmerIds = [];
    farmerAccounts.sort((a, b) => {
      const farmerIdA = a.farmer_id;
      const farmerIdB = b.farmer_id;
      const farmerNameA = formatName(a.first_name, a.middle_name, a.last_name);
      if (farmerIdA === undefined) {
        missingFarmerIds.push(farmerNameA);
        return 0;
      }
      if (isNaN(farmerIdA) && isNaN(farmerIdB)) {
        return String(farmerIdA).localeCompare(String(farmerIdB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (!isNaN(farmerIdA) && !isNaN(farmerIdB)) {
        return Number(farmerIdA) - Number(farmerIdB);
      }
      return isNaN(farmerIdA) ? 1 : -1;
    });

    if (missingFarmerIds.length > 0) {
      console.log(
        "Farmer ID's are not retrieved for the following farmers: " +
          missingFarmerIds.join(", ")
      );
    }

    updateTable();
  } catch (error) {
    console.error("Error Fetching Farmer Accounts:", error);
  } finally {
    isDataLoading = false;
    updateDownloadButtonState();
  }
}

// Utility Functions
function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatBarangay(barangay) {
  const formattedBarangay = barangay ? capitalizeWords(barangay) : "";
  return `${formattedBarangay}`.trim();
}

function formatUserType(user_type) {
  const formattedUserType = user_type ? capitalizeWords(user_type) : "";
  return `${formattedUserType}`.trim();
}

function formatName(firstName, middleName, lastName) {
  function getMiddleInitial(middle) {
    return middle ? middle.charAt(0).toUpperCase() + "." : "";
  }
  const formattedFirstName = firstName ? capitalizeWords(firstName) : "";
  const formattedMiddleName = getMiddleInitial(middleName);
  const formattedLastName = lastName ? capitalizeWords(lastName) : "";
  return `${formattedFirstName} ${formattedMiddleName} ${formattedLastName}`.trim();
}

// Update Table
function updateTable() {
  console.log(
    "Updating table - Current Page:",
    currentPage,
    "Total Records:",
    farmerAccounts.length
  );
  const start = (currentPage - 1) * rowsPerPage;
  const end = currentPage * rowsPerPage;
  const pageData = farmerAccounts.slice(start, end);

  console.log(
    "Start index:",
    start,
    "End index:",
    end,
    "Page Data length:",
    pageData.length
  );

  tableBody.innerHTML = "";

  if (pageData.length === 0 && farmerAccounts.length > 0) {
    currentPage = Math.max(1, Math.ceil(farmerAccounts.length / rowsPerPage));
    console.log("Adjusted currentPage to:", currentPage);
    updateTable();
    return;
  } else if (farmerAccounts.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7">No records found</td></tr>`;
  }

  pageData.forEach((data) => {
    const row = document.createElement("tr");
    const formattedName = formatName(
      data.first_name,
      data.middle_name,
      data.last_name
    );
    const formattedBarangay = formatBarangay(data.barangay_name);
    const formattedUserType = formatUserType(data.user_type);
    row.innerHTML = `
            <td><input type="checkbox" class="checkbox" data-farmer-id="${
              data.farmer_id
            }"></td>
            <td>${data.farmer_id || "Farmer ID not recorded"}</td>
            <td>${formattedName || "User's name not recorded"}</td>
            <td>${formattedUserType || "User's role not recorded"}</td>
            <td>${formattedBarangay || "Barangay not recorded"}</td>
            <td>${data.contact || "Contact Number not recorded"}</td>
            <td>
                <button class="action-btn view-btn" data-id="${
                  data.farmer_id
                }" title="View">
                    <img src="/images/eye.png" alt="View">
                </button>
                <button class="action-btn edit-btn" data-id="${
                  data.farmer_id
                }" title="Edit">
                    <img src="/images/Edit.png" alt="Edit">
                </button>
                <button class="action-btn delete-btn" data-id="${
                  data.farmer_id
                }" title="Delete">
                    <img src="/images/Delete.png" alt="Delete">
                </button>
            </td>
        `;
    tableBody.appendChild(row);
    const checkbox = row.querySelector(".checkbox");
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        row.classList.add("highlight");
      } else {
        row.classList.remove("highlight");
      }
    });
  });

  updatePagination();
  toggleBulkDeleteButton();
  updateDownloadButtonState();
}

// Event Listeners for Table
tableBody.addEventListener("change", (event) => {
  if (event.target.classList.contains("checkbox")) {
    const farmerId = event.target.getAttribute("data-farmer-id");
    toggleBulkDeleteButton();
    if (event.target.checked) {
      selectedFarmerId = farmerId;
      console.log("Selected Farmer ID: ", selectedFarmerId);
    } else {
      selectedFarmerId = null;
      console.log("Selected Farmer ID: ", "Farmer ID Unselected");
    }
  }
});

tableBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const farmerId = target.getAttribute("data-id");

  if (target.classList.contains("edit-btn")) {
    editFarmerAccount(farmerId);
  } else if (target.classList.contains("view-btn")) {
    viewFarmerAccount(farmerId);
  } else if (target.classList.contains("delete-btn")) {
    deleteFarmerAccount(farmerId);
  }
});

// Pagination
function updatePagination() {
  const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage) || 1;
  pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
  console.log(
    "Pagination updated - Current Page:",
    currentPage,
    "Total Pages:",
    totalPages
  );
}

function changePage(direction) {
  const totalPages = Math.ceil(farmerAccounts.length / rowsPerPage) || 1;
  console.log(
    "Changing page - Direction:",
    direction,
    "Current Page:",
    currentPage,
    "Total Pages:",
    totalPages
  );
  if (direction === "prev" && currentPage > 1) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages) {
    currentPage++;
  }
  console.log("New Current Page:", currentPage);
  updateTable();
}

prevPageBtn.addEventListener("click", () => {
  console.log("Previous button clicked");
  changePage("prev");
});

nextPageBtn.addEventListener("click", () => {
  console.log("Next button clicked");
  changePage("next");
});

// CRUD Operations
async function editFarmerAccount(farmerId) {
  try {
    const q = query(
      collection(db, "tb_farmers"),
      where("farmer_id", "==", farmerId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const farmerData = doc.data();
        localStorage.setItem("farmerData", JSON.stringify(farmerData));
        window.location.href = "supervisor_farmers_edit.html";
      });
    } else {
      showDeleteMessage(
        "No matching record found, Unable to proceed with the requested action",
        false
      );
    }
  } catch (error) {
    console.error("Error fetching Farmer data for edit:", error);
  }
}

async function viewFarmerAccount(farmerId) {
  try {
    const q = query(
      collection(db, "tb_farmers"),
      where("farmer_id", "==", farmerId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const farmerData = doc.data();
        localStorage.setItem("farmerData", JSON.stringify(farmerData));
        window.location.href = "supervisor_farmers_view.html";
      });
    } else {
      showDeleteMessage(
        "No matching record found, Unable to proceed with the requested action",
        false
      );
    }
  } catch (error) {
    console.log("Error fetching user data for view:", error);
  }
}

async function deleteFarmerAccount(farmer_id) {
  try {
    const q = query(
      collection(db, "tb_farmers"),
      where("farmer_id", "==", farmer_id)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      selectedRowId = querySnapshot.docs[0].id; // Store the document ID
      confirmationPanel.style.display = "flex";
      editFormContainer.style.pointerEvents = "none";
    } else {
      showDeleteMessage(
        "No Farmer ID found, Unable to proceed with deleting the record",
        false
      );
    }
  } catch (error) {
    console.log("Error checking farmer account:", error);
  }
}

// Single Delete Confirmation
confirmDeleteButton.addEventListener("click", async () => {
  if (selectedRowId) {
    try {
      const farmerDocRef = doc(db, "tb_farmers", selectedRowId);
      const farmerDocSnap = await getDoc(farmerDocRef);
      if (farmerDocSnap.exists()) {
        const farmerData = farmerDocSnap.data();
        const user = await getAuthenticatedUser();
        const userName = user.user_name;
        const userType = user.user_type;

        // Handle archive counter
        const counterDocRef = doc(db, "tb_id_counters", "archive_id_counter");
        const counterDocSnap = await getDoc(counterDocRef);
        let archiveCounter = counterDocSnap.exists()
          ? counterDocSnap.data().counter
          : 0;
        if (isNaN(archiveCounter)) {
          archiveCounter = 0;
        }
        archiveCounter++;

        // Prepare archive data
        const now = new Date();
        const archiveDate = now.toISOString().split("T")[0];
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        const archiveTime = `${hours % 12 || 12}:${minutes
          .toString()
          .padStart(2, "0")} ${ampm}`;

        const archivedData = {
          ...farmerData,
          archive_id: archiveCounter,
          document_type: "Farmer Account",
          document_name: `${farmerData.user_type} Account of ${farmerData.first_name} ${farmerData.middle_name} ${farmerData.last_name}`,
          archive_date: archiveDate,
          archive_time: archiveTime,
          archived_by: {
            user_name: userName,
            user_type: userType,
          },
        };

        // Archive the record
        const archiveCollection = collection(db, "tb_archive");
        const archiveRef = doc(archiveCollection);
        await setDoc(archiveRef, archivedData);

        // Update archive counter
        await setDoc(
          counterDocRef,
          { counter: archiveCounter },
          { merge: true }
        );

        // Delete the original record
        await deleteDoc(farmerDocRef);

        // Log the activity
        await saveActivityLog(
          "Delete",
          `Archived and deleted farmer account ${farmerData.farmer_id} by ${userType} ${userName}`
        );

        // Refresh the table and show success message
        fetchFarmerAccounts();
        showDeleteMessage(
          "Farmer account has been archived and deleted!",
          true
        );
      }
    } catch (error) {
      console.error("Error archiving and deleting record:", error);
      showDeleteMessage("Error processing farmer account deletion!", false);
    }
  }
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
  selectedRowId = null;
});

cancelDeleteButton.addEventListener("click", () => {
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
  selectedRowId = null;
});

// Search and Filter
searchBar.addEventListener("input", () => {
  currentPage = 1;
  fetchFarmerAccounts({
    search: searchBar.value,
    barangay_name: barangaySelect.value,
  });
});

barangaySelect.addEventListener("change", () => {
  currentPage = 1;
  fetchFarmerAccounts({
    search: searchBar.value,
    barangay_name: barangaySelect.value,
  });
});

// Fetch Barangays
async function fetch_barangays() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_barangay"));
    let addedBarangays = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const barangayName = data.barangay_name;
      if (!addedBarangays.includes(barangayName)) {
        addedBarangays.push(barangayName);
        const option = document.createElement("option");
        option.value = barangayName;
        option.textContent = barangayName;
        barangaySelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error Fetching Barangays:", error);
  }
}

// Bulk Delete
function toggleBulkDeleteButton() {
  const selectedCheckboxes = tableBody.querySelectorAll(
    "input[type='checkbox']:checked"
  );
  const bulkDeleteBtn = document.getElementById("bulk-delete");
  if (selectedCheckboxes.length > 0) {
    bulkDeleteBtn.disabled = false;
  } else {
    bulkDeleteBtn.disabled = true;
  }
}

async function archiveAndDelete(collectionName, matchField, valuesToDelete) {
  if (valuesToDelete.length === 0) {
    console.warn("No items selected for deletion.");
    return;
  }

  try {
    const mainCollection = collection(db, collectionName);
    const archiveCollection = collection(db, "tb_archive");
    const counterDocRef = doc(db, "tb_id_counters", "archive_id_counter");
    let hasArchived = false;
    const user = await getAuthenticatedUser();
    const userName = user.user_name;
    const userType = user.user_type;

    const counterDocSnap = await getDoc(counterDocRef);
    let archiveCounter = counterDocSnap.exists()
      ? counterDocSnap.data().counter
      : 0;
    if (isNaN(archiveCounter)) {
      archiveCounter = 0;
    }

    for (const value of valuesToDelete) {
      const querySnapshot = await getDocs(
        query(mainCollection, where(matchField, "==", value))
      );
      if (!querySnapshot.empty) {
        for (const docSnapshot of querySnapshot.docs) {
          archiveCounter++;
          const data = docSnapshot.data();
          const archiveId = archiveCounter;

          const now = new Date();
          const archiveDate = now.toISOString().split("T")[0];
          const hours = now.getHours();
          const minutes = now.getMinutes();
          const ampm = hours >= 12 ? "PM" : "AM";
          const archiveTime = `${hours % 12 || 12}:${minutes
            .toString()
            .padStart(2, "0")} ${ampm}`;

          const archivedData = {
            ...data,
            archive_id: archiveId,
            document_type: "Farmer Account",
            document_name: `${data.user_type} Account of ${data.first_name} ${data.middle_name} ${data.last_name}`,
            archive_date: archiveDate,
            archive_time: archiveTime,
            archived_by: {
              user_name: userName,
              user_type: userType,
            },
          };

          const archiveRef = doc(archiveCollection);
          await setDoc(archiveRef, archivedData);
          await deleteDoc(doc(db, collectionName, docSnapshot.id));
          console.log(
            `Archived and deleted document ID from ${collectionName}:`,
            docSnapshot.id
          );
          hasArchived = true;
        }
      }
    }

    if (hasArchived) {
      await setDoc(counterDocRef, { counter: archiveCounter }, { merge: true });
    } else {
      console.warn(
        `WARNING: No records found in ${collectionName} for deletion.`
      );
    }

    console.log(`Processing complete for Farmer Accounts:`, valuesToDelete);
    showDeleteMessage(`Farmer accounts have been archived and deleted!`, true);
  } catch (error) {
    console.error(
      `Error archiving or deleting records from ${collectionName}:`,
      error
    );
    showDeleteMessage(`Error processing farmer accounts!`, false);
  }
}

deleteSelectedBtn.addEventListener("click", async () => {
  const selectedCheckboxes = tableBody.querySelectorAll(
    "input[type='checkbox']:checked"
  );
  idsToDelete = [];
  let hasInvalidId = false;

  for (const checkbox of selectedCheckboxes) {
    const farmerId = checkbox.getAttribute("data-farmer-id");
    if (!farmerId || farmerId.trim() === "") {
      hasInvalidId = true;
      break;
    }
    try {
      const q = query(
        collection(db, "tb_farmers"),
        where("farmer_id", "==", farmerId)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        hasInvalidId = true;
        break;
      }
      idsToDelete.push(farmerId);
    } catch (error) {
      console.error("Error fetching farmer records:", error);
      hasInvalidId = true;
      break;
    }
  }

  if (hasInvalidId) {
    showDeleteMessage(
      "ERROR: Farmer ID of one or more selected records are invalid",
      false
    );
  } else {
    bulkDeletePanel.classList.add("show");
  }
});

confirmDeleteBtn.addEventListener("click", async () => {
  try {
    await archiveAndDelete("tb_farmers", "farmer_id", idsToDelete);
    fetchFarmerAccounts();
  } catch (error) {
    console.error("Error archiving or deleting farmers:", error);
    showDeleteMessage(
      "Error archiving or deleting farmers. Please try again.",
      false
    );
  }
  bulkDeletePanel.classList.remove("show");
});

cancelDeleteBtn.addEventListener("click", () => {
  bulkDeletePanel.classList.remove("show");
});

// Show Delete Message
function showDeleteMessage(message, success) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#41A186" : "#f44336";
  deleteMessage.style.opacity = "1";
  deleteMessage.style.display = "block";
  setTimeout(() => {
    deleteMessage.style.opacity = "0";
    setTimeout(() => {
      deleteMessage.style.display = "none";
    }, 400);
  }, 4000);
}

// PDF Generation
downloadBtn.addEventListener("click", async () => {
  if (downloadBtn.disabled) return; // Prevent action if button is disabled

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const user = await getAuthenticatedUser();
  const usersCollection = collection(db, "tb_users");
  const userQuery = query(usersCollection, where("email", "==", user.email));
  const userSnapshot = await getDocs(userQuery);
  const userData = userSnapshot.docs[0].data();

  const fullName = formatName(
    userData.first_name,
    userData.middle_name,
    userData.last_name
  );
  const userTypePrint = userData.user_type || "Unknown";

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentYear = new Date().getFullYear();

  const tableData = farmerAccounts.map((farmer) => {
    const farmerId = farmer.farmer_id || "Farmer ID not recorded";
    const farmerName =
      formatName(farmer.first_name, farmer.middle_name, farmer.last_name) ||
      "User's name not recorded";
    const userType =
      formatUserType(farmer.user_type) || "User's role not recorded";
    const barangay =
      formatBarangay(farmer.barangay_name) || "Barangay not recorded";
    const contact = farmer.contact || "Contact Number not recorded";
    const birthday = farmer.birthday
      ? new Date(farmer.birthday).toLocaleDateString("en-US")
      : "Birthday not recorded";
    const sex = farmer.sex ? capitalizeWords(farmer.sex) : "Sex not recorded";

    return [farmerId, farmerName, userType, barangay, contact, birthday, sex];
  });

  const columns = [
    "Farmer ID",
    "Name",
    "User Type",
    "Barangay",
    "Contact Number",
    "Birthday",
    "Sex",
  ];

  const columnWidths = [25, 40, 25, 35, 35, 30, 20];
  const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const leftMargin = (pageWidth - totalTableWidth) / 2;

  const addHeader = (doc) => {
    const headerImg = "/images/BarasHeader.png";
    const headerImgWidth = 60;
    const headerImgHeight = 40;
    try {
      doc.addImage(
        headerImg,
        "PNG",
        (pageWidth - headerImgWidth) / 2,
        5,
        headerImgWidth,
        headerImgHeight
      );
    } catch (e) {
      console.error("Error adding header image:", e);
    }

    doc.setLineWidth(0.4);
    doc.setDrawColor(51, 51, 51);
    doc.line(10, 45, pageWidth - 10, 45);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("FOR", 20, 60);
    doc.text(":", 42, 60);
    doc.text("FROM", 20, 70);
    doc.text(":", 42, 70);
    doc.text(fullName, 50, 70);
    doc.text("DATE", 20, 80);
    doc.text(":", 42, 80);
    doc.text(currentDate, 50, 80);
    doc.text("SUBJECT", 20, 90);
    doc.text(":", 42, 90);
    doc.text("Farmer Accounts Report", 50, 90);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(`BARAS FARMERS REPORT ${currentYear}`, pageWidth / 2, 100, {
      align: "center",
    });
  };

  const addBody = (doc, data) => {
    const tableEndY = data.cursor.y + 35;
    if (tableEndY < pageHeight - 30) {
      doc.setLineWidth(0.4);
      doc.setDrawColor(51, 51, 51);
      doc.line(10, tableEndY, pageWidth - 10, tableEndY);
    }
  };

  const addFooter = (doc, data) => {
    const footerImg = "/images/BarasFooter.png";
    const footerImgWidth = 140;
    const footerImgHeight = 15;
    try {
      doc.addImage(
        footerImg,
        "PNG",
        (pageWidth - footerImgWidth) / 2,
        pageHeight - 30,
        footerImgWidth,
        footerImgHeight
      );
    } catch (e) {
      console.error("Error adding footer image:", e);
    }

    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - 10,
      pageHeight - 10,
      { align: "right" }
    );
  };

  const maxTableHeight = pageHeight - 65;
  const rowHeightEstimate = 10;
  const baseRowsPerPage = Math.floor(
    (maxTableHeight - 105) / rowHeightEstimate
  );
  const rowsPerPage = baseRowsPerPage;
  let currentPage = 0;

  while (currentPage * rowsPerPage < tableData.length) {
    const startIndex = currentPage * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
    const pageData = tableData.slice(startIndex, endIndex);

    if (currentPage > 0) {
      doc.addPage();
    }

    addHeader(doc);

    doc.autoTable({
      startY: 105,
      head: [columns],
      body: pageData,
      theme: "grid",
      margin: { top: 55, left: leftMargin, right: leftMargin, bottom: 20 },
      styles: {
        fontSize: 7,
        cellPadding: 1,
        overflow: "linebreak",
        font: "helvetica",
        textColor: [51, 51, 51],
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [65, 161, 134],
        fontSize: 8,
        font: "helvetica",
        fontStyle: "bold",
        lineColor: [132, 138, 156],
        lineWidth: 0.1,
        halign: "center",
        valign: "top",
      },
      columnStyles: Object.fromEntries(
        columns.map((_, i) => [i, { cellWidth: columnWidths[i] }])
      ),
      didDrawPage: (data) => {
        addBody(doc, data);
        addFooter(doc, data);
      },
    });

    currentPage++;
  }

  // Check screen width to determine if preview is feasible
  const isPreviewSupported = window.innerWidth > 768; // Adjust threshold as needed

  if (isPreviewSupported) {
    // Show PDF preview for larger screens
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const previewPanel = document.getElementById("pdf-preview-panel");
    const previewContainer = document.getElementById("pdf-preview-container");

    previewContainer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%"></iframe>`;
    previewPanel.style.display = "flex";
    document.body.classList.add("preview-active");

    document.getElementById("preview-cancel-btn").onclick = () => {
      previewPanel.style.display = "none";
      document.body.classList.remove("preview-active");
      URL.revokeObjectURL(pdfUrl);
    };

    document.getElementById("preview-done-btn").onclick = async () => {
      doc.save(
        `Farmer_Accounts_Report_${new Date().toISOString().slice(0, 10)}.pdf`
      );
      await saveActivityLog(
        "Create",
        `Farmer Accounts Report downloaded by ${userTypePrint} ${fullName}`
      );
      previewPanel.style.display = "none";
      document.body.classList.remove("preview-active");
      URL.revokeObjectURL(pdfUrl);
    };
  } else {
    // Directly download PDF and log activity for smaller screens
    doc.save(
      `Farmer_Accounts_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    );
    await saveActivityLog(
      "Create",
      `Farmer Accounts Report downloaded by ${userTypePrint} ${fullName}`
    );
  }
});
