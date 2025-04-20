import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for authenticated user
let currentFarmerId = sessionStorage.getItem("farmer_id") || "";
let currentUserType = "";
let currentFirstName = "";
let currentMiddleName = "";
let currentLastName = "";

let fertilizersList = [];
let filteredFertilizers = [];
let currentPage = 1;
const rowsPerPage = 5;

// Helper function to display success or error messages
function showMessage(type, text) {
  const messageElement = document.getElementById(`${type}-message`);
  if (!messageElement) {
    console.error(`Message element #${type}-message not found.`);
    return;
  }

  messageElement.textContent = text;
  messageElement.style.display = "block";
  messageElement.style.opacity = "1";

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    messageElement.style.opacity = "0";
    setTimeout(() => {
      messageElement.style.display = "none";
      messageElement.textContent = "";
    }, 300); // Match CSS transition duration
  }, 3000);
}

function sortFertilizersByDate() {
  filteredFertilizers.sort((a, b) => {
    const dateA = parseDate(a.stock_date || a.fertilizerDate);
    const dateB = parseDate(b.stock_date || b.fertilizerDate);
    return dateB - dateA; // Sort latest to oldest
  });
}

function parseDate(dateValue) {
  if (!dateValue) return new Date(0);
  if (typeof dateValue.toDate === "function") {
    return dateValue.toDate();
  }
  return new Date(dateValue);
}

async function getAuthenticatedFarmer() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          console.log("Authenticated user email:", user.email);
          const farmerQuery = query(
            collection(db, "tb_farmers"),
            where("email", "==", user.email)
          );
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            console.log("Farmer data:", farmerData);
            sessionStorage.setItem("farmer_id", String(farmerData.farmer_id));
            currentFarmerId = String(farmerData.farmer_id);
            currentUserType = farmerData.user_type || "";
            currentFirstName = farmerData.first_name || "";
            currentMiddleName = farmerData.middle_name || "";
            currentLastName = farmerData.last_name || "";
            console.log("Set currentFarmerId:", currentFarmerId);

            resolve({
              farmer_id: currentFarmerId,
              user_type: currentUserType,
              first_name: currentFirstName,
              middle_name: currentMiddleName,
              last_name: currentLastName,
            });
          } else {
            console.error("Farmer record not found for email:", user.email);
            reject(new Error("Farmer record not found."));
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated.");
        reject(new Error("User not authenticated."));
      }
    });
  });
}

async function fetchFertilizers() {
  try {
    if (!currentFarmerId) {
      console.log("No farmer_id in sessionStorage, fetching from Firestore");
      await getAuthenticatedFarmer();
    }
    if (!currentFarmerId) {
      throw new Error("currentFarmerId is not set.");
    }
    console.log("Fetching projects for currentFarmerId:", currentFarmerId);

    const projectsCollection = collection(db, "tb_projects");
    const projectsQuery = query(
      projectsCollection,
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );

    onSnapshot(
      projectsQuery,
      async (snapshot) => {
        console.log("Projects snapshot size:", snapshot.size);
        const stockCollection = collection(db, "tb_fertilizer_stock");

        const fertilizersData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const project = doc.data();
            console.log(
              "Processing project:",
              project.project_id,
              project.project_name
            );
            const fertilizerArray = project.fertilizer || [];

            const fertilizerPromises = fertilizerArray.map(async (fert) => {
              let stockData = {};
              const fertilizerName =
                fert.fertilizer_name?.trim() || "Unknown Fertilizer";
              console.log(
                "Querying stock for fertilizer_name:",
                fertilizerName
              );

              const stockQuery = query(
                stockCollection,
                where("fertilizer_name", "==", fertilizerName)
              );
              const stockSnapshot = await getDocs(stockQuery);
              console.log(
                "Stock docs for",
                fertilizerName,
                stockSnapshot.docs.map((doc) => doc.data())
              );

              if (!stockSnapshot.empty) {
                const stockDoc = stockSnapshot.docs[0].data();
                const stockEntry = stockDoc.stocks.find(
                  (stock) => stock.farmer_id === currentFarmerId
                );
                console.log(
                  "Found stockEntry for farmer_id",
                  currentFarmerId,
                  stockEntry
                );
                if (stockEntry) {
                  stockData = {
                    stock_date: stockEntry.stock_date,
                    current_stock: stockEntry.current_stock,
                    unit: stockEntry.unit,
                  };
                } else {
                  console.warn(
                    `No stock entry found for farmer_id: ${currentFarmerId} in fertilizer: ${fertilizerName}`
                  );
                }
              } else {
                console.warn(
                  `No stock document found for fertilizer_name: ${fertilizerName}`
                );
              }

              return {
                project_id: project.project_id,
                project_name: project.project_name,
                fertilizer_type: fert.fertilizer_type || "Unknown Type",
                fertilizer_name: fertilizerName,
                fertilizerDate: project.fertilizer_date || null,
                ...stockData,
                owned_by: currentUserType,
              };
            });

            return Promise.all(fertilizerPromises);
          })
        );

        fertilizersList = fertilizersData.flat();
        filteredFertilizers = [...fertilizersList];
        sortFertilizersByDate();
        displayFertilizers(filteredFertilizers);
      },
      (error) => {
        console.error("Error listening to projects:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching fertilizers:", error);
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
    tableBody.innerHTML = `
        <tr class="no-records-message">
          <td colspan="6" style="text-align: center;">You are not the Farm Leader for any Ongoing Projects</td>
        </tr>
      `;
    updatePagination();
    return;
  }

  paginatedFertilizers.forEach((fertilizer) => {
    const row = document.createElement("tr");
    const date = fertilizer.stock_date || fertilizer.fertilizerDate;
    const formattedDate = date
      ? date.toDate
        ? date.toDate().toLocaleDateString()
        : new Date(date).toLocaleDateString()
      : "Not recorded";
    const currentStock = parseFloat(fertilizer.current_stock) || 0;
    const isDisabled = currentStock === 0 ? "disabled" : "";
    const fertilizerName = fertilizer.fertilizer_name || "Unknown Fertilizer";

    row.innerHTML = `
        <td>${fertilizer.project_id}</td>
        <td>${fertilizerName}</td>
        <td>${fertilizer.fertilizer_type}</td>
        <td>${formattedDate}</td>
        <td>${currentStock} ${fertilizer.unit || "units"}</td>
        <td>
          <span class="use-resource-wrapper ${isDisabled}" 
                data-project-id="${fertilizer.project_id}" 
                data-fertilizer-name="${encodeURIComponent(fertilizerName)}" 
                data-stock="${currentStock}" 
                data-unit="${fertilizer.unit || ""}">
            <img src="/images/use.png" alt="Use Resource" 
                class="use-resource-icon ${isDisabled}" 
                ${
                  isDisabled
                    ? 'aria-disabled="true" title="Resource unavailable (zero stock)"'
                    : ""
                }>
          </span>
        </td>
      `;
    tableBody.appendChild(row);
  });
  updatePagination();

  const icons = document.querySelectorAll(
    ".fertilizer_table .use-resource-icon:not(.disabled)"
  );
  icons.forEach((icon) => {
    icon.removeEventListener("click", handleFertilizerIconClick);
    icon.addEventListener("click", handleFertilizerIconClick);
  });
}

function handleFertilizerIconClick(event) {
  const wrapper = event.target.closest(".use-resource-wrapper");
  const projectId = wrapper.dataset.projectId;
  const fertilizerName = decodeURIComponent(wrapper.dataset.fertilizerName);
  const currentStock = parseFloat(wrapper.dataset.stock) || 0;
  const unit = wrapper.dataset.unit;
  console.log("Fertilizer icon clicked:", {
    projectId,
    fertilizerName,
    currentStock,
    unit,
  });
  if (currentStock > 0) {
    openResourcePanel(projectId, fertilizerName, currentStock, unit);
  }
}

function openResourcePanel(projectId, fertilizerName, currentStock, unit) {
  const panel = document.getElementById("use-resource-panel");
  const resourceNameDisplay = document.getElementById("resource-type-display");
  const maxQuantityDisplay = document.getElementById("max-quantity");
  const quantityInput = document.getElementById("quantity-input");
  const usageTypeSelect = document.getElementById("usage-type");
  const detailsContainer = document.getElementById("details-container");
  const detailsInput = document.getElementById("usage-details");
  const saveButton = document.getElementById("save-resource");

  console.log("Opening fertilizer resource panel with:", {
    fertilizerName,
    currentStock,
    unit,
  });

  if (
    !panel ||
    !resourceNameDisplay ||
    !maxQuantityDisplay ||
    !quantityInput ||
    !usageTypeSelect ||
    !detailsContainer ||
    !detailsInput ||
    !saveButton
  ) {
    console.error(
      "One or more required DOM elements for use-resource-panel not found."
    );
    showMessage(
      "error",
      "Resource panel elements not found. Please check the HTML."
    );
    return;
  }

  const displayName = fertilizerName || "Unknown Fertilizer";
  console.log("Setting resource-type-display to:", displayName);

  try {
    resourceNameDisplay.value = displayName;
    resourceNameDisplay.dispatchEvent(new Event("input"));
    console.log(
      "resource-type-display value after setting:",
      resourceNameDisplay.value
    );
  } catch (error) {
    console.error("Error setting resource-type-display:", error);
    showMessage(
      "error",
      "Error setting resource name. Please check the console."
    );
    return;
  }

  maxQuantityDisplay.textContent = `${currentStock} ${unit || "units"}`;
  quantityInput.value = "";
  quantityInput.max = currentStock;
  quantityInput.min = 0;
  usageTypeSelect.innerHTML = `
    <option value="">Select Usage Type</option>
    <option value="Used">Used</option>
    <option value="Damaged">Damaged</option>
    <option value="Missing">Missing</option>
  `;
  usageTypeSelect.value = "";
  detailsInput.value = "";
  detailsContainer.style.display = "none";

  panel.classList.add("active");

  // Clone inputs to reset event listeners
  const newQuantityInput = quantityInput.cloneNode(true);
  quantityInput.parentNode.replaceChild(newQuantityInput, quantityInput);
  const newUsageTypeSelect = usageTypeSelect.cloneNode(true);
  usageTypeSelect.parentNode.replaceChild(newUsageTypeSelect, usageTypeSelect);

  newUsageTypeSelect.addEventListener("change", () => {
    if (newUsageTypeSelect.value === "Used") {
      detailsContainer.style.display = "none";
      detailsInput.value = "";
    } else if (
      newUsageTypeSelect.value === "Damaged" ||
      newUsageTypeSelect.value === "Missing"
    ) {
      detailsContainer.style.display = "block";
    }
  });

  // One-click prevention for save button
  let isSaving = false;
  saveButton.disabled = false;
  const handleSaveClick = async () => {
    if (isSaving) {
      console.log("Save operation already in progress, ignoring click");
      return;
    }
    isSaving = true;
    saveButton.disabled = true;
    console.log("Save button clicked, processing...");

    try {
      const quantity = newQuantityInput.value.trim();
      const usageType = newUsageTypeSelect.value;
      const details = detailsInput.value.trim();
      const sessionedProjectId = sessionStorage.getItem("projectId"); // Get sessioned project_id

      // Warning trap: Check if all fields are empty/invalid
      if (
        (quantity === "" || isNaN(parseFloat(quantity))) &&
        usageType === "" &&
        (newUsageTypeSelect.value === "Damaged" ||
        newUsageTypeSelect.value === "Missing"
          ? details === ""
          : true)
      ) {
        showMessage("error", "Please provide quantity and usage type.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      // Individual validations
      const parsedQuantity = parseFloat(quantity);
      if (
        isNaN(parsedQuantity) ||
        parsedQuantity > currentStock ||
        parsedQuantity <= 0
      ) {
        showMessage(
          "error",
          "Please enter a valid quantity within stock limits."
        );
        isSaving = false;
        saveButton.disabled = false;
        return;
      }
      if (!usageType) {
        showMessage("error", "Please select a usage type.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }
      if ((usageType === "Damaged" || usageType === "Missing") && !details) {
        showMessage("error", "Details field cannot be empty.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }
      if (!sessionedProjectId) {
        console.error("No project_id found in sessionStorage");
        showMessage("error", "Project ID not found. Please try again.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      const stockQuery = query(
        collection(db, "tb_fertilizer_stock"),
        where("fertilizer_name", "==", fertilizerName)
      );
      const stockSnapshot = await getDocs(stockQuery);
      if (stockSnapshot.empty) {
        console.error("No stock found for fertilizer:", fertilizerName);
        showMessage("error", "No stock found for this fertilizer.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      const stockDoc = stockSnapshot.docs[0];
      const stockData = stockDoc.data();
      const stockEntry = stockData.stocks.find(
        (stock) => stock.farmer_id === currentFarmerId
      );
      if (!stockEntry) {
        console.error("No stock entry found for farmer:", currentFarmerId);
        showMessage("error", "No stock entry found for this farmer.");
        isSaving = false;
        saveButton.disabled = false;
        return;
      }

      stockEntry.current_stock =
        (stockEntry.current_stock || 0) - parsedQuantity;
      await updateDoc(doc(db, "tb_fertilizer_stock", stockDoc.id), {
        stocks: stockData.stocks,
      });

      await addDoc(collection(db, "tb_inventory_log"), {
        project_id: sessionedProjectId, // Use sessioned project_id
        resource_name: fertilizerName,
        quantity_used: parsedQuantity,
        unit: unit || "units",
        resource_type: "Fertilizer",
        usage_type: usageType,
        details: details || "",
        farmer_id: currentFarmerId,
        timestamp: new Date(),
      });

      console.log("Fertilizer usage saved successfully");
      showMessage("success", "Fertilizer usage saved successfully!");
      newQuantityInput.value = "";
      closeResourcePanel();
      fetchFertilizers();
    } catch (error) {
      console.error("Error saving inventory log:", error);
      showMessage("error", "Failed to save inventory log.");
      isSaving = false;
      saveButton.disabled = false;
    }
  };

  saveButton.removeEventListener("click", handleSaveClick);
  saveButton.addEventListener("click", handleSaveClick);

  const cancelButton = document.getElementById("cancel-resource");
  const newCancelButton = cancelButton.cloneNode(true);
  cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
  newCancelButton.addEventListener("click", closeResourcePanel);

  const closeButton = document.getElementById("close-resource-panel");
  const newCloseButton = closeButton.cloneNode(true);
  closeButton.parentNode.replaceChild(newCloseButton, closeButton);
  newCloseButton.addEventListener("click", closeResourcePanel);
}

function closeResourcePanel() {
  const panel = document.getElementById("use-resource-panel");
  const resourceNameDisplay = document.getElementById("resource-type-display");
  if (panel) {
    panel.classList.remove("active");
  }
  if (resourceNameDisplay) {
    resourceNameDisplay.value = "";
    resourceNameDisplay.dispatchEvent(new Event("input"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Initial currentFarmerId from session:", currentFarmerId);
  fetchFertilizerNames();
  fetchFertilizers();
});

function updatePagination() {
  const totalPages = Math.ceil(filteredFertilizers.length / rowsPerPage) || 1;
  const pageNumberElement = document.getElementById("fertilizer-page-number");
  if (pageNumberElement) {
    pageNumberElement.textContent = `${currentPage} of ${totalPages}`;
  } else {
    console.error("Page number element (#fertilizer-page-number) not found");
  }
  updatePaginationButtons();
}

function updatePaginationButtons() {
  const prevButton = document.getElementById("fertilizer-prev-page");
  const nextButton = document.getElementById("fertilizer-next-page");
  if (!prevButton) {
    console.error("Previous button (#fertilizer-prev-page) not found");
    return;
  }
  if (!nextButton) {
    console.error("Next button (#fertilizer-next-page) not found");
    return;
  }
  prevButton.disabled = currentPage === 1;
  nextButton.disabled =
    currentPage >= Math.ceil(filteredFertilizers.length / rowsPerPage);
  console.log(
    `Pagination updated: currentPage=${currentPage}, totalPages=${Math.ceil(
      filteredFertilizers.length / rowsPerPage
    )}`
  );
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
  try {
    const fertilizersCollection = collection(db, "tb_fertilizer_types");
    const fertilizersSnapshot = await getDocs(fertilizersCollection);
    const fertilizerNames = fertilizersSnapshot.docs.map(
      (doc) => doc.data().fertilizer_type_name
    );
    populateFertilizerDropdown(fertilizerNames);
  } catch (error) {
    console.error("Error fetching fertilizer names:", error);
  }
}

function populateFertilizerDropdown(fertilizerNames) {
  const fertilizerSelect = document.querySelector(".fertilizer_select");
  if (!fertilizerSelect) {
    console.warn("Fertilizer select dropdown (.fertilizer_select) not found");
    return;
  }
  const firstOption =
    fertilizerSelect.querySelector("option")?.outerHTML ||
    '<option value="">Fertilizer Type</option>';
  fertilizerSelect.innerHTML = firstOption;

  fertilizerNames.forEach((fertilizerName) => {
    const option = document.createElement("option");
    option.textContent = fertilizerName;
    option.value = fertilizerName;
    fertilizerSelect.appendChild(option);
  });
}

document
  .querySelector(".fertilizer_select")
  .addEventListener("change", function () {
    const selectedFertilizer = this.value.toLowerCase();

    filteredFertilizers = fertilizersList.filter((fertilizer) => {
      return selectedFertilizer
        ? fertilizer.fertilizer_type?.toLowerCase() === selectedFertilizer
        : true;
    });

    currentPage = 1;
    sortFertilizersByDate();
    displayFertilizers(filteredFertilizers);
  });

document
  .getElementById("fert-search-bar")
  .addEventListener("input", function () {
    const searchQuery = this.value.toLowerCase().trim();

    filteredFertilizers = fertilizersList.filter((fertilizer) => {
      return (
        fertilizer.project_id?.toString().toLowerCase().includes(searchQuery) ||
        fertilizer.fertilizer_name?.toLowerCase().includes(searchQuery) ||
        fertilizer.fertilizer_type?.toLowerCase().includes(searchQuery)
      );
    });

    currentPage = 1;
    sortFertilizersByDate();
    displayFertilizers(filteredFertilizers);
  });

function getFarmerFullName() {
  const middleInitial = currentMiddleName
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}
