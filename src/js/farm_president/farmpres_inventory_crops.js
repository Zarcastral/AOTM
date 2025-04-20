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
let currentFarmerId = "";
let currentUserType = "";
let currentFirstName = "";
let currentMiddleName = "";
let currentLastName = "";

let cropsList = [];
let filteredCrops = [];

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

  setTimeout(() => {
    messageElement.style.opacity = "0";
    setTimeout(() => {
      messageElement.style.display = "none";
      messageElement.textContent = "";
    }, 300);
  }, 3000);
}

function sortCropsByDate() {
  filteredCrops.sort((a, b) => {
    const dateA = parseDate(a.stock_date || a.cropDate);
    const dateB = parseDate(b.stock_date || b.cropDate);
    return dateB - dateA;
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
          const farmerQuery = query(
            collection(db, "tb_farmers"),
            where("email", "==", user.email)
          );
          const farmerSnapshot = await getDocs(farmerQuery);

          if (!farmerSnapshot.empty) {
            const farmerData = farmerSnapshot.docs[0].data();
            currentFarmerId = farmerData.farmer_id;
            currentUserType = farmerData.user_type || "";
            currentFirstName = farmerData.first_name || "";
            currentMiddleName = farmerData.middle_name || "";
            currentLastName = farmerData.last_name || "";

            resolve({
              farmer_id: currentFarmerId,
              user_type: currentUserType,
              first_name: currentFirstName,
              middle_name: currentMiddleName,
              last_name: currentLastName,
            });
          } else {
            console.error("Farmer record not found.");
            reject("Farmer record not found.");
          }
        } catch (error) {
          console.error("Error fetching farmer data:", error);
          reject(error);
        }
      } else {
        console.error("User not authenticated.");
        reject("User not authenticated.");
      }
    });
  });
}

async function fetchCrops() {
  try {
    await getAuthenticatedFarmer();

    const projectsCollection = collection(db, "tb_projects");
    const ongoingQuery = query(
      projectsCollection,
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );

    onSnapshot(
      ongoingQuery,
      async (snapshot) => {
        const stockCollection = collection(db, "tb_crop_stock");

        // Store the single project_id in sessionStorage
        const projectId = snapshot.docs[0]?.data().project_id;
        if (projectId) {
          sessionStorage.setItem("projectId", projectId);
          console.log("Stored project_id in sessionStorage:", projectId);
        } else {
          sessionStorage.removeItem("projectId");
          console.log("No project_id found, cleared from sessionStorage");
        }

        const projectsData = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const project = doc.data();
            let stockData = {};

            const stockQuery = query(
              stockCollection,
              where("crop_type_name", "==", project.crop_type_name)
            );
            const stockSnapshot = await getDocs(stockQuery);

            if (!stockSnapshot.empty) {
              const stockDoc = stockSnapshot.docs[0].data();
              const stockEntry = stockDoc.stocks.find(
                (stock) => stock.farmer_id === currentFarmerId
              );
              if (stockEntry) {
                stockData = {
                  stock_date: stockEntry.stock_date,
                  current_stock: stockEntry.current_stock,
                  unit: stockEntry.unit,
                };
              }
            }

            return {
              project_id: project.project_id,
              project_name: project.project_name,
              crop_type_name: project.crop_type_name || "Unknown Crop",
              crop_name: project.crop_name || "Unknown Crop",
              cropDate: project.crop_date || null,
              ...stockData,
              owned_by: currentUserType,
            };
          })
        );

        cropsList = projectsData;
        filteredCrops = [...cropsList];
        sortCropsByDate();
        displayCrops(filteredCrops);
      },
      (error) => {
        console.error("Error listening to projects:", error);
      }
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function displayCrops(cropsList) {
  const tableBody = document.querySelector(".crop_table table tbody");
  if (!tableBody) {
    console.error("Table body not found.");
    return;
  }

  tableBody.innerHTML = "";
  if (cropsList.length === 0) {
    tableBody.innerHTML = `
      <tr class="no-records-message">
        <td colspan="6" style="text-align: center;">You are not the Farm Leader for any Ongoing Projects</td>
      </tr>
    `;
    return;
  }

  cropsList.forEach((crop) => {
    const row = document.createElement("tr");
    const date = crop.stock_date || crop.cropDate;
    const formattedDate = date
      ? date.toDate
        ? date.toDate().toLocaleDateString()
        : new Date(date).toLocaleDateString()
      : "Not recorded";
    const currentStock = parseFloat(crop.current_stock) || 0;
    const isDisabled = currentStock === 0 ? "disabled" : "";

    row.innerHTML = `
      <td>${crop.project_id}</td>
      <td>${crop.crop_name}</td>
      <td>${crop.crop_type_name}</td>
      <td>${formattedDate}</td>
      <td>${currentStock} ${crop.unit || ""}</td>
      <td>
        <span class="use-resource-wrapper ${isDisabled}" 
              data-project-id="${crop.project_id}" 
              data-crop-type="${encodeURIComponent(crop.crop_type_name)}" 
              data-stock="${currentStock}" 
              data-unit="${crop.unit || ""}">
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

  const icons = document.querySelectorAll(
    ".crop_table .use-resource-icon:not(.disabled)"
  );
  icons.forEach((icon) => {
    icon.removeEventListener("click", handleCropIconClick);
    icon.addEventListener("click", handleCropIconClick);
  });
}

function handleCropIconClick(event) {
  const wrapper = event.target.closest(".use-resource-wrapper");
  const projectId = wrapper.dataset.projectId;
  const cropType = decodeURIComponent(wrapper.dataset.cropType);
  const currentStock = parseFloat(wrapper.dataset.stock) || 0;
  const unit = wrapper.dataset.unit;
  console.log("Crop icon clicked:", {
    projectId,
    cropType,
    currentStock,
    unit,
  });
  if (currentStock > 0) {
    openResourcePanel(projectId, cropType, currentStock, unit);
  }
}

function openResourcePanel(projectId, cropType, currentStock, unit) {
  const panel = document.getElementById("use-resource-panel");
  const resourceNameDisplay = document.getElementById("resource-type-display");
  const maxQuantityDisplay = document.getElementById("max-quantity");
  const quantityInput = document.getElementById("quantity-input");
  const usageTypeSelect = document.getElementById("usage-type");
  const detailsContainer = document.getElementById("details-container");
  const detailsInput = document.getElementById("usage-details");
  const saveButton = document.getElementById("save-resource");

  console.log("Opening crop resource panel with:", {
    cropType,
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
    console.error("Required DOM elements for use-resource-panel not found.");
    showMessage(
      "error",
      "Resource panel elements not found. Please check the HTML."
    );
    return;
  }

  const displayName = cropType || "Unknown Crop";
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
      const sessionedProjectId = sessionStorage.getItem("projectId");

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
        collection(db, "tb_crop_stock"),
        where("crop_type_name", "==", cropType)
      );
      const stockSnapshot = await getDocs(stockQuery);
      if (stockSnapshot.empty) {
        console.error("No stock found for crop type:", cropType);
        showMessage("error", "No stock found for this crop type.");
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
      await updateDoc(doc(db, "tb_crop_stock", stockDoc.id), {
        stocks: stockData.stocks,
      });

      await addDoc(collection(db, "tb_inventory_log"), {
        project_id: sessionedProjectId,
        resource_name: cropType,
        quantity_used: parsedQuantity,
        unit: unit || "kg",
        resource_type: "Crops",
        usage_type: usageType,
        details: details || "",
        farmer_id: currentFarmerId,
        timestamp: new Date(),
      });

      console.log("Crop usage saved successfully");
      showMessage("success", "Crop usage saved successfully!");
      newQuantityInput.value = "";
      closeResourcePanel();
      fetchCrops();
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
  fetchProjectNames();
  fetchCrops();
});

async function fetchProjectNames() {
  try {
    const projectsQuery = query(
      collection(db, "tb_projects"),
      where("lead_farmer_id", "==", currentFarmerId),
      where("status", "==", "Ongoing")
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    const projectNames = projectsSnapshot.docs.map(
      (doc) => doc.data().project_name
    );
    populateProjectDropdown(projectNames);
  } catch (error) {
    console.error("Error fetching project names:", error);
  }
}

function populateProjectDropdown(projectNames) {
  const projectSelect = document.querySelector(".project_select");
  if (!projectSelect) {
    console.warn("Project select dropdown (.project_select) not found");
    return;
  }
  const firstOption =
    projectSelect.querySelector("option")?.outerHTML ||
    '<option value="">Select Project</option>';
  projectSelect.innerHTML = firstOption;

  const uniqueProjectNames = [...new Set(projectNames)].sort();
  uniqueProjectNames.forEach((projectName) => {
    const option = document.createElement("option");
    option.textContent = projectName;
    option.value = projectName;
    projectSelect.appendChild(option);
  });
}

document
  .querySelector(".project_select")
  ?.addEventListener("change", function () {
    const selectedProject = this.value.toLowerCase();

    filteredCrops = cropsList.filter((crop) => {
      const matchesProject = selectedProject
        ? crop.project_name?.toLowerCase() === selectedProject
        : true;
      return matchesProject;
    });

    sortCropsByDate();
    displayCrops(filteredCrops);
  });

function getFarmerFullName() {
  const middleInitial = currentMiddleName
    ? `${currentMiddleName.charAt(0)}.`
    : "";
  return `${currentFirstName} ${middleInitial} ${currentLastName}`.trim();
}
