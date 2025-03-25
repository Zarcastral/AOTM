import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import app from "../../config/firebase_config.js";
const db = getFirestore(app);
const auth = getAuth();

const tableBody = document.getElementById("table_body");
const statusSelect = document.getElementById("status_select");
const searchBar = document.getElementById("search-bar");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumberSpan = document.getElementById("page-number");
const editFormContainer = document.createElement("div");
editFormContainer.id = "edit-form-container";
editFormContainer.style.display = "none";
document.body.appendChild(editFormContainer);

let globalLeadFarmerId = null;

let currentPage = 1;
const rowsPerPage = 5;
let projectList = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is authenticated:", user.email);
    fetch_projects(); // Run this ONLY after authentication is confirmed
  } else {
    console.error("User not authenticated.");
    // Redirect to login page or prompt for sign-in
  }
});

async function fetch_projects(filter = {}) {
  try {
    const user = auth.currentUser; // Ensure user is passed correctly

    if (!user) {
      console.error("User not authenticated.");
      return;
    }

    const farmerDocRef = doc(db, "tb_farmers", user.uid);
    const farmerDocSnap = await getDoc(farmerDocRef);

    if (!farmerDocSnap.exists()) {
      console.error("Farmer document not found.");
      return;
    }

    const farmerData = farmerDocSnap.data();
    const farmerId = sessionStorage.getItem("farmer_id") || ""; // Fetch farmer_id from sessionStorage

    const querySnapshot = await getDocs(collection(db, "tb_projects"));
    projectList = [];
    let projectIdList = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const projectId = String(data.project_id || "");

      // Check email in tb_projects instead of farm_president
      if ((data.farmer_id || "").toLowerCase() !== farmerId.toLowerCase()) {
        return;
      }

      projectIdList.push(projectId);

      const searchTerm = filter.search?.toLowerCase();
      const matchesSearch = searchTerm
        ? `${data.project_name || ""}`.toLowerCase().includes(searchTerm) ||
          `${data.email || ""}`.toLowerCase().includes(searchTerm) || // Updated condition
          (data.start_date || "").includes(searchTerm) ||
          (data.end_date || "").includes(searchTerm) ||
          (data.crop_type_name || "").toLowerCase().includes(searchTerm) ||
          (data.status || "").toLowerCase().includes(searchTerm)
        : true;

      const matchesStatus = filter.status
        ? (data.status || "").toLowerCase() === filter.status.toLowerCase()
        : true;

      if (matchesSearch && matchesStatus) {
        projectList.push({ project_id: projectId, ...data });
      }
    });

    projectList.sort((a, b) => {
      const startA = a.start_date ? new Date(a.start_date) : new Date(0);
      const startB = b.start_date ? new Date(b.start_date) : new Date(0);
      const endA = a.end_date ? new Date(a.end_date) : new Date(0);
      const endB = b.end_date ? new Date(b.end_date) : new Date(0);

      if (startB - startA !== 0) {
        return startB - startA;
      }
      return endB - endA;
    });

    console.log("Project IDs:", projectIdList);
    currentPage = 1;
    updateTable();
    updatePagination();
  } catch (error) {
    console.error("Error Fetching Projects:", error);
  }
}

// <------------------------ FUNCTION TO CAPTALIZE THE INITIAL LETTERS ------------------------>
function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProjectName(project_name) {
  const formattedProjectName = project_name
    ? capitalizeWords(project_name)
    : "";
  return `${formattedProjectName}`.trim();
}
function formatFarmPresident(farm_president) {
  const formattedFarmPresident = farm_president
    ? capitalizeWords(farm_president)
    : "";
  return `${formattedFarmPresident}`.trim();
}
function formatCrop(crop_type_name) {
  const formattedCrop = crop_type_name ? capitalizeWords(crop_type_name) : "";
  return `${formattedCrop}`.trim();
}
function formatStatus(status) {
  const formattedStatus = status ? capitalizeWords(status) : "";
  return `${formattedStatus}`.trim();
}

//  <------------- TABLE DISPLAY AND UPDATE ------------->
function updateTable() {
  const start = (currentPage - 1) * rowsPerPage;
  const end = currentPage * rowsPerPage;
  const pageData = projectList.slice(start, end);

  tableBody.innerHTML = "";

  if (pageData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5">No records found.</td></tr>`;
  }

  pageData.forEach((data) => {
    const row = document.createElement("tr");
    const formattedProjectName = formatProjectName(data.project_name);
    const formattedFarmPresident = formatFarmPresident(data.farm_president);
    const formattedCrop = formatCrop(data.crop_type_name);
    const formattedStatus = formatStatus(data.status);
    //yung projectid papalitan ng progress bar
    row.innerHTML = `
            <td>${formattedProjectName || "Project Name not recorded"}</td>
            <td>${formattedFarmPresident || "Farm President not recorded"}</td>
            <td>${data.start_date || "Start Date not recorded"}</td>
            <td>${data.end_date || "End Date not recorded"}</td>
            <td>${formattedCrop || "Crop not recorded"}</td>
            <td>${data.project_id || "Project Progress not recorded"}</td>
            <td>${formattedStatus || "Status not recorded"}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${
                  data.project_id
                }" title="Edit">
                    <img src="../../images/edit.png" alt="Edit">
                </button>
                <button class="action-btn view-btn" data-id="${
                  data.project_id
                }" title="View">
                    <img src="../../images/eye.png" alt="View">
                </button>
            </td>
        `;
    tableBody.appendChild(row);
  });

  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(projectList.length / rowsPerPage) || 1;
  pageNumberSpan.textContent = `${currentPage} of ${totalPages}`;
  updatePaginationButtons();
}

function updatePaginationButtons() {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
  const totalPages = Math.ceil(projectList.length / rowsPerPage);
  if (direction === "prev" && currentPage > 1) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages) {
    currentPage++;
  }
  updateTable();
  updatePagination();
}

// Attach event listeners to pagination buttons
prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <------------- BUTTON EVENT LISTENER FOR THE ACTION COLUMN ------------->
tableBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const project_id = target.getAttribute("data-id");
  console.log("Clicked Edit Button - Project ID:", project_id); // Debugging

  if (target.classList.contains("edit-btn")) {
    teamAssign(project_id);
  } else if (target.classList.contains("view-btn")) {
    viewProject(project_id);
  } else if (target.classList.contains("delete-btn")) {
    deleteUserAccount(project_id);
  }
});

//FETCH PROJECT DETAILS
async function fetchProjectDetails(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      let projectData = null;
      querySnapshot.forEach((doc) => {
        projectData = doc.data();
      });

      if (projectData) {
        const filteredProjectData = {
          project_created_by: projectData.project_creator || "N/A",
          farmer_id: projectData.farmer_id || "N/A", // ✅ Extracted farmer_id
          crop_name: projectData.crop_name || "N/A", // ✅ Extracted crop_name
          crop_type_name: projectData.crop_type_name || "N/A",
          crop_type_quantity: projectData.crop_type_quantity || 0,
          equipment: projectData.equipment || [],
          fertilizer: projectData.fertilizer || [],
        };

        console.log("Fetched Project Details:", filteredProjectData);
        return filteredProjectData;
      }
    }

    console.warn("No project found with the given project_id:", project_id);
    return null;
  } catch (error) {
    console.error("Error fetching project details:", error);
    return null;
  }
}

//--------------------------- C R O P S   S T O C K ---------------------------------
//CROP STOCK
async function fetchCropStockByOwner(project_created_by, crop_type_name) {
  // Change function parameter
  console.log("Fetching crop stock for project creator:", project_created_by);

  try {
    const cropStockQuery = query(collection(db, "tb_crop_stock"));
    const cropStockSnapshot = await getDocs(cropStockQuery);

    let foundStock = null;

    cropStockSnapshot.forEach((doc) => {
      const cropStockData = doc.data();

      const matchingStock = cropStockData.stocks.find(
        (stock) => stock.owned_by === project_created_by
      ); // Change variable

      if (matchingStock && cropStockData.crop_type_name === crop_type_name) {
        foundStock = {
          crop_name: cropStockData.crop_name || "N/A",
          crop_type_id: cropStockData.crop_type_id || "N/A",
          crop_type_name: cropStockData.crop_type_name || "N/A",
          unit: cropStockData.unit || "N/A",
          stocks: cropStockData.stocks.map((stock) => ({
            current_stock: stock.current_stock || 0,
            owned_by: stock.owned_by || "N/A",
            stock_date: stock.stock_date || "N/A",
          })),
        };
      }
    });

    if (foundStock) {
      console.log("Fetched Crop Stock:", foundStock);
    } else {
      console.log(
        "No crop stock found for project creator:",
        project_created_by
      );
    }

    return foundStock;
  } catch (error) {
    console.error("Error fetching crop stock:", error);
    return null;
  }
}

//DITO SYA MAGBABAWAS NG STOCK HA
async function updateCropStockAfterAssignment(project_id) {
  try {
    // Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.project_created_by) {
      console.warn("No project creator found, cannot update stock.");
      return;
    }

    // Fetch crop stock for the project creator
    const cropStockData = await fetchCropStockByOwner(
      projectData.project_created_by,
      projectData.crop_type_name
    );
    if (
      !cropStockData ||
      !cropStockData.stocks ||
      cropStockData.stocks.length === 0
    ) {
      console.warn("No crop stock found for the project creator.");
      return;
    }

    // Extract crop_name from the fetched stock data
    const crop_name = cropStockData.crop_name;

    const requiredQuantity = projectData.crop_type_quantity;
    console.log(
      `Required quantity for project (${crop_name}): ${requiredQuantity}`
    );

    let updatedStocks = [];

    for (let stock of cropStockData.stocks) {
      if (stock.owned_by === projectData.project_created_by) {
        let updatedStockValue = stock.current_stock - requiredQuantity;
        if (updatedStockValue < 0) {
          console.warn(
            `Not enough stock for ${crop_name}! Current: ${stock.current_stock}, Required: ${requiredQuantity}`
          );
          return;
        }

        console.log(
          `Updating stock for ${stock.owned_by}. New Stock for ${crop_name}: ${updatedStockValue}`
        );

        updatedStocks.push({
          ...stock,
          current_stock: updatedStockValue,
        });

        // Update Firestore
        const cropStockQuery = query(
          collection(db, "tb_crop_stocks"),
          where("crop_name", "==", crop_name)
        );
        const cropStockSnapshot = await getDocs(cropStockQuery);

        if (!cropStockSnapshot.empty) {
          cropStockSnapshot.forEach(async (doc) => {
            const cropStockRef = doc.ref;
            await updateDoc(cropStockRef, { stocks: updatedStocks });
          });
          console.log(`Stock updated successfully for ${crop_name}!`);
        } else {
          console.warn(
            `Crop stock document not found in the database for ${crop_name}.`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error updating crop stock:", error);
  }
}

//CROP SAVING
async function saveCropStockAfterTeamAssign(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.crop_name) {
      console.warn("Missing crop_name, cannot save crop stock.");
      return;
    }

    const { crop_name, crop_type_quantity } = projectData;
    const stock_date = new Date().toISOString();

    // Use the global variable for farmer_id
    const farmer_id = globalLeadFarmerId;
    if (!farmer_id) {
      console.warn(
        "❌ Global lead farmer ID is not set, skipping stock update."
      );
      return;
    }

    const cropStockQuery = query(
      collection(db, "tb_crop_stock"),
      where("crop_name", "==", crop_name)
    );
    const cropStockSnapshot = await getDocs(cropStockQuery);

    if (!cropStockSnapshot.empty) {
      const updatePromises = cropStockSnapshot.docs.map(async (doc) => {
        const cropStockRef = doc.ref;
        const existingData = doc.data();
        let updatedStocks = existingData.stocks || [];

        let stockDeducted = false;
        updatedStocks = updatedStocks.map((stock) => {
          if (
            stock.owned_by === projectData.project_created_by &&
            !stockDeducted
          ) {
            if (stock.current_stock >= crop_type_quantity) {
              stock.current_stock -= crop_type_quantity;
              stockDeducted = true;
            } else {
              console.warn(`Not enough stock for ${crop_name}!`);
              return stock;
            }
          }
          return stock;
        });

        if (!stockDeducted) {
          console.warn(`No available stock to deduct for ${crop_name}`);
          return;
        }

        updatedStocks.push({
          current_stock: crop_type_quantity,
          stock_date: stock_date,
          unit: "kg",
          farmer_id: farmer_id,
        });

        return updateDoc(cropStockRef, { stocks: updatedStocks });
      });

      await Promise.all(updatePromises);
      console.log(`✅ Stock updated for ${crop_name}.`);
    } else {
      console.warn(
        `❌ No crop stock found for ${crop_name}. Creating a new entry.`
      );

      await addDoc(collection(db, "tb_crop_stock"), {
        crop_name: crop_name,
        stocks: [
          {
            current_stock: crop_type_quantity,
            stock_date: stock_date,
            unit: "kg",
            farmer_id: farmer_id,
          },
        ],
      });

      console.log(`✅ New crop stock entry created for ${crop_name}.`);
    }
  } catch (error) {
    console.error("❌ Error saving crop stock:", error);
  }
}

//--------------------------- F E R T I L I Z E R   S T O C K ---------------------------------
async function fetchFertilizerStockByOwner(
  project_created_by,
  fertilizer_names
) {
  // Updated parameter name
  console.log(
    "Fetching fertilizer stock for project creator:",
    project_created_by
  );

  try {
    const fertilizerStockQuery = query(collection(db, "tb_fertilizer_stock"));
    const fertilizerStockSnapshot = await getDocs(fertilizerStockQuery);

    let foundStock = [];

    fertilizerStockSnapshot.forEach((doc) => {
      const fertilizerStockData = doc.data();

      // Check if any stock entry has an owned_by matching project_created_by
      const matchingStock = fertilizerStockData.stocks.find(
        (stock) => stock.owned_by === project_created_by
      );

      // Also check if fertilizer name is in the provided list
      if (
        matchingStock &&
        fertilizer_names.includes(fertilizerStockData.fertilizer_name)
      ) {
        foundStock.push({
          fertilizer_name: fertilizerStockData.fertilizer_name || "N/A", // ✅ Added fertilizer_name
          unit: fertilizerStockData.unit || "N/A",
          stocks: fertilizerStockData.stocks.map((stock) => ({
            current_stock: stock.current_stock || 0,
            owned_by: stock.owned_by || "N/A",
            stock_date: stock.stock_date || "N/A",
            fertilizer_name: fertilizerStockData.fertilizer_name || "N/A", // ✅ Added fertilizer_name inside stocks
          })),
        });
      }
    });

    if (foundStock.length > 0) {
      console.log("Fetched Fertilizer Stock:", foundStock);
    } else {
      console.log(
        "No fertilizer stock found for project creator:",
        project_created_by
      );
    }

    return foundStock;
  } catch (error) {
    console.error("Error fetching fertilizer stock:", error);
    return null;
  }
}

async function updateFertilizerStockAfterAssignment(project_id) {
  try {
    // Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.project_created_by ||
      !projectData.fertilizer
    ) {
      console.warn(
        "No project creator or fertilizer data found, cannot update stock."
      );
      return;
    }

    // Extract the list of fertilizer names from the project
    const fertilizerNames = projectData.fertilizer.map(
      (fert) => fert.fertilizer_name
    );

    // Fetch fertilizer stock for the project creator
    const fertilizerStockData = await fetchFertilizerStockByOwner(
      projectData.project_created_by,
      fertilizerNames
    );
    if (!fertilizerStockData || fertilizerStockData.length === 0) {
      console.warn("No fertilizer stock found for the project creator.");
      return;
    }

    let updatedStocks = [];

    // Loop through each fertilizer in the project
    for (let projectFertilizer of projectData.fertilizer) {
      let requiredQuantity = projectFertilizer.fertilizer_quantity;

      // Find the matching fertilizer stock
      let stockEntry = fertilizerStockData.find(
        (stock) => stock.fertilizer_name === projectFertilizer.fertilizer_name
      );
      if (!stockEntry) {
        console.warn(
          `No stock found for fertilizer: ${projectFertilizer.fertilizer_name}`
        );
        continue;
      }

      // Loop through stocks and update
      for (let stock of stockEntry.stocks) {
        if (stock.owned_by === projectData.project_created_by) {
          let updatedStockValue = stock.current_stock - requiredQuantity;
          if (updatedStockValue < 0) {
            console.warn(
              `Not enough stock for ${stockEntry.fertilizer_name}! Current: ${stock.current_stock}, Required: ${requiredQuantity}`
            );
            return;
          }

          console.log(
            `Updating stock for ${stock.owned_by} - ${stockEntry.fertilizer_name}. New Stock: ${updatedStockValue}`
          );

          updatedStocks.push({
            ...stock,
            current_stock: updatedStockValue,
            fertilizer_name: stockEntry.fertilizer_name, // ✅ Added fertilizer_name inside stocks array
          });

          // Update Firestore
          const fertilizerStockQuery = query(
            collection(db, "tb_fertilizer_stock"),
            where("fertilizer_name", "==", stockEntry.fertilizer_name)
          );
          const fertilizerStockSnapshot = await getDocs(fertilizerStockQuery);

          if (!fertilizerStockSnapshot.empty) {
            fertilizerStockSnapshot.forEach(async (doc) => {
              const fertilizerStockRef = doc.ref;
              await updateDoc(fertilizerStockRef, { stocks: updatedStocks });
            });
            console.log("Fertilizer stock updated successfully!");
          } else {
            console.warn(
              `Fertilizer stock document not found in the database for ${stockEntry.fertilizer_name}.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating fertilizer stock:", error);
  }
}

// ✅ Function to save fertilizer stock after team assignment
async function saveFertilizerStockAfterTeamAssign(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.fertilizer.length) {
      console.warn("No fertilizer data found for this project.");
      return;
    }

    const stockCollection = collection(db, "tb_fertilizer_stock");

    for (const fertilizer of projectData.fertilizer) {
      const { fertilizer_name, quantity } = fertilizer;
      const farmer_id = projectData.farmer_id; // Get the farmer_id
      const stock_date = new Date().toISOString(); // Current date-time

      // Query the stock document for this fertilizer
      const q = query(
        stockCollection,
        where("fertilizer_name", "==", fertilizer_name)
      );
      const querySnapshot = await getDocs(q);

      let stockRef;
      let existingStocks = [];

      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          stockRef = doc.ref;
          existingStocks = doc.data().stocks || [];
        });

        // Deduct stock from the first available entry
        let stockDeducted = false;
        existingStocks = existingStocks.map((stock) => {
          if (!stockDeducted && stock.current_stock >= quantity) {
            stock.current_stock -= quantity;
            stockDeducted = true;
          }
          return stock;
        });

        if (!stockDeducted) {
          console.warn(`❌ Not enough stock for ${fertilizer_name}.`);
          return;
        }
      } else {
        // If no existing document, create a new one
        stockRef = await addDoc(stockCollection, {
          fertilizer_name,
          stocks: [],
        });
      }

      // Add new stock entry
      existingStocks.push({
        current_stock: quantity, // Store the assigned quantity
        stock_date: stock_date,
        unit: "kg",
        farmer_id: farmer_id, // Store farmer_id instead of owned_by
      });

      // Update Firestore document
      await updateDoc(stockRef, { stocks: existingStocks });

      console.log(`✅ Fertilizer stock updated for: ${fertilizer_name}`);
    }
  } catch (error) {
    console.error("❌ Error saving fertilizer stock:", error);
  }
}

//--------------------------- E Q U I P M E N T   S T O C K ---------------------------------
async function fetchEquipmentStockByOwner(project_created_by, equipment_names) {
  console.log(
    "Fetching equipment stock for project creator:",
    project_created_by
  );

  try {
    const equipmentStockQuery = query(collection(db, "tb_equipment_stock"));
    const equipmentStockSnapshot = await getDocs(equipmentStockQuery);

    let foundStock = [];

    equipmentStockSnapshot.forEach((doc) => {
      const equipmentStockData = doc.data();

      // Check if any stock entry has an owned_by matching project_created_by
      const matchingStock = equipmentStockData.stocks.find(
        (stock) => stock.owned_by === project_created_by
      );

      // Also check if the equipment name is in the provided list
      if (
        matchingStock &&
        equipment_names.includes(equipmentStockData.equipment_name)
      ) {
        foundStock.push({
          equipment_name: equipmentStockData.equipment_name || "N/A",
          unit: equipmentStockData.unit || "N/A",
          stocks: equipmentStockData.stocks.map((stock) => ({
            current_stock: stock.current_stock || 0,
            owned_by: stock.owned_by || "N/A",
            stock_date: stock.stock_date || "N/A",
          })),
        });
      }
    });

    if (foundStock.length > 0) {
      console.log("Fetched Equipment Stock:", foundStock);
    } else {
      console.log(
        "No equipment stock found for project creator:",
        project_created_by
      );
    }

    return foundStock;
  } catch (error) {
    console.error("Error fetching equipment stock:", error);
    return null;
  }
}

async function updateEquipmentStockAfterAssignment(project_id) {
  try {
    // Fetch project details
    const projectData = await fetchProjectDetails(project_id);
    if (
      !projectData ||
      !projectData.project_created_by ||
      !projectData.equipment
    ) {
      console.warn(
        "No project creator or equipment data found, cannot update stock."
      );
      return;
    }

    // Extract the list of equipment names from the project
    const equipmentNames = projectData.equipment.map((eq) => eq.equipment_name);

    // Fetch equipment stock for the project creator
    const equipmentStockData = await fetchEquipmentStockByOwner(
      projectData.project_created_by,
      equipmentNames
    );
    if (!equipmentStockData || equipmentStockData.length === 0) {
      console.warn("No equipment stock found for the project creator.");
      return;
    }

    let updatedStocks = [];

    // Loop through each equipment in the project
    for (let projectEquipment of projectData.equipment) {
      let requiredQuantity = projectEquipment.equipment_quantity;

      // Find the matching equipment stock
      let stockEntry = equipmentStockData.find(
        (stock) => stock.equipment_name === projectEquipment.equipment_name
      );
      if (!stockEntry) {
        console.warn(
          `No stock found for equipment: ${projectEquipment.equipment_name}`
        );
        continue;
      }

      // Loop through stocks and update
      for (let stock of stockEntry.stocks) {
        if (stock.owned_by === projectData.project_created_by) {
          let updatedStockValue = stock.current_stock - requiredQuantity;
          if (updatedStockValue < 0) {
            console.warn(
              `Not enough stock for ${stockEntry.equipment_name}! Current: ${stock.current_stock}, Required: ${requiredQuantity}`
            );
            return;
          }

          console.log(
            `Updating stock for ${stock.owned_by} - ${stockEntry.equipment_name}. New Stock: ${updatedStockValue}`
          );

          updatedStocks.push({
            ...stock,
            current_stock: updatedStockValue,
          });

          // Update Firestore
          const equipmentStockQuery = query(
            collection(db, "tb_equipment_stock"),
            where("equipment_name", "==", stockEntry.equipment_name)
          );
          const equipmentStockSnapshot = await getDocs(equipmentStockQuery);

          if (!equipmentStockSnapshot.empty) {
            equipmentStockSnapshot.forEach(async (doc) => {
              const equipmentStockRef = doc.ref;
              await updateDoc(equipmentStockRef, { stocks: updatedStocks });
            });
            console.log("Equipment stock updated successfully!");
          } else {
            console.warn(
              `Equipment stock document not found in the database for ${stockEntry.equipment_name}.`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating equipment stock:", error);
  }
}

async function saveEquipmentStockAfterTeamAssign(project_id) {
  try {
    const projectData = await fetchProjectDetails(project_id);
    if (!projectData || !projectData.equipment.length) {
      console.warn("No equipment data found for this project.");
      return;
    }

    const stockCollection = collection(db, "tb_equipment_stock");

    for (const equipment of projectData.equipment) {
      const { equipment_name, equipment_quantity } = equipment; // Use equipment_quantity
      const farmer_id = projectData.farmer_id;
      const stock_date = new Date().toISOString(); // Current date-time

      // Query the stock document for this equipment
      const q = query(
        stockCollection,
        where("equipment_name", "==", equipment_name)
      );
      const querySnapshot = await getDocs(q);

      let stockRef;
      let existingStocks = [];

      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          stockRef = doc.ref;
          existingStocks = doc.data().stocks || [];
        });

        // Deduct stock from the first available entry
        let stockDeducted = false;
        existingStocks = existingStocks.map((stock) => {
          if (!stockDeducted && stock.current_stock >= equipment_quantity) {
            stock.current_stock -= equipment_quantity;
            stockDeducted = true;
          }
          return stock;
        });

        if (!stockDeducted) {
          console.warn(`❌ Not enough stock for ${equipment_name}.`);
          continue;
        }
      } else {
        // If no existing document, create a new one
        stockRef = await addDoc(stockCollection, {
          equipment_name,
          stocks: [],
        });
      }

      // Add new stock entry
      existingStocks.push({
        current_stock: equipment_quantity, // Store the assigned quantity
        stock_date: stock_date,
        unit: "pcs", // Assuming equipment is counted in pieces
        farmer_id: farmer_id, // Store farmer_id instead of owned_by
      });

      // Update Firestore document
      await updateDoc(stockRef, { stocks: existingStocks });

      console.log(`✅ Equipment stock updated for: ${equipment_name}`);
    }
  } catch (error) {
    console.error("❌ Error saving equipment stock:", error);
  }
}

//TB PROJECT TASK ASSIGNING
async function fetchProjectTasks(project_id) {
  try {
    // Fetch project details
    const projectDetails = await fetchProjectDetails(project_id);
    if (!projectDetails) {
      console.warn("No project details found.");
      return null;
    }

    const { project_created_by, crop_type_name } = projectDetails;

    // Fetch crop stock details
    const cropStock = await fetchCropStockByOwner(
      project_created_by,
      crop_type_name
    );
    if (!cropStock) {
      console.warn("No crop stock details found.");
      return null;
    }

    const { crop_name } = cropStock;

    // Fetch matching tasks from tb_task_list
    const taskQuery = query(
      collection(db, "tb_task_list"),
      where("crop_type_name", "==", crop_type_name)
    );
    const taskSnapshot = await getDocs(taskQuery);

    if (taskSnapshot.empty) {
      console.warn("No matching task found in tb_task_list.");
      return null;
    }

    // Fetch and increment project_task_id from tb_id_counters
    const idCounterRef = doc(db, "tb_id_counters", "project_task_id_counter");
    const idCounterSnap = await getDoc(idCounterRef);

    if (!idCounterSnap.exists()) {
      console.error("ID counter document not found.");
      return null;
    }

    let project_task_id = idCounterSnap.data().count || 1;

    const finalDataArray = [];

    // Loop through each task and create a separate record
    for (const taskDoc of taskSnapshot.docs) {
      const taskData = taskDoc.data();
      const task_name = taskData.task_name || "N/A";

      // Use existing subtasks directly
      const subtasks = taskData.subtasks || [];

      const finalData = {
        project_id,
        crop_name,
        crop_type_name,
        project_task_id, // Auto-incremented ID
        task_name, // Solo field
        subtasks, // Directly using the fetched data
      };

      finalDataArray.push(finalData);

      // Increment the project_task_id for the next task
      project_task_id++;
    }

    // Update the counter with the new value
    await updateDoc(idCounterRef, { count: project_task_id });

    console.log("Fetched Project Tasks:", finalDataArray);
    return finalDataArray; // Returns an array of records
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    return null;
  }
}

//TEAM ASSIGN
async function teamAssign(project_id) {
  const panel = document.getElementById("team-assign-confirmation-panel");
  if (!panel) {
    console.error("Error: Confirmation panel not found!");
    return;
  }
  panel.style.display = "flex";

  // Fetch and log project details
  const projectData = await fetchProjectDetails(project_id);
  if (!projectData) {
    console.error("Error: Failed to fetch project details.");
    return;
  }
  console.log("Project Details:", projectData);

  // Fetch and log crop stock data separately
  if (projectData.project_creator && projectData.crop_type_name) {
    const cropStock = await fetchCropStockByOwner(
      projectData.project_creator,
      projectData.crop_type_name
    );
    console.log(
      "Crop Stock by Owner:",
      cropStock ? cropStock : "No stock found."
    );
  } else {
    console.warn(
      "Missing project creator or crop type name, skipping crop stock fetch."
    );
  }

  try {
    const userBarangay = sessionStorage.getItem("barangay_name");

    // Fetch all active projects in the barangay
    const projectQuery = query(
      collection(db, "tb_projects"),
      where("barangay_name", "==", userBarangay)
    );
    const projectSnapshot = await getDocs(projectQuery);
    const assignedTeamIds = new Set();

    projectSnapshot.forEach((doc) => {
      const projectData = doc.data();
      if (projectData.team_id) {
        assignedTeamIds.add(parseInt(projectData.team_id, 10));
      }
    });

    console.log("Assigned Team IDs:", Array.from(assignedTeamIds));

    // Fetch available teams
    const teamQuery = query(
      collection(db, "tb_teams"),
      where("barangay_name", "==", userBarangay)
    );
    const teamSnapshot = await getDocs(teamQuery);

    let displayedTeamIds = [];
    let teamListHtml = `
            <div class="team-assign-box">
                <h3>Available Teams</h3>
                <div class="team-list-container">
        `;

    teamSnapshot.forEach((doc) => {
      const teamData = doc.data();
      const teamId = parseInt(teamData.team_id, 10);

      console.log(
        `Checking team: ${teamId} (Is assigned? ${assignedTeamIds.has(teamId)})`
      );

      if (assignedTeamIds.has(teamId)) return; // Skip already assigned teams

      displayedTeamIds.push(teamId);
      const teamName = teamData.team_name;
      const leadFarmer = teamData.lead_farmer;
      const leadFarmerId = String(teamData.lead_farmer_id); // Ensure it's a string
      const totalFarmers = teamData.farmer_name
        ? teamData.farmer_name.length
        : 0;

      teamListHtml += `
                <div class="team-item" 
                     data-team-id="${teamId}" 
                     data-team-name="${teamName}" 
                     data-lead-farmer="${leadFarmer}" 
                     data-lead-farmer-id="${leadFarmerId}"  
                     data-farmers='${JSON.stringify(
                       teamData.farmer_name || []
                     )}'>
                    <strong>${teamName}</strong><br>
                    Lead: ${leadFarmer}<br>
                    Total Farmers: ${totalFarmers}
                </div>
            `;
    });

    console.log("Displayed Team IDs (After Filtering):", displayedTeamIds);

    teamListHtml += "</div></div>";
    document.getElementById("team-assign-list").innerHTML = teamListHtml;
  } catch (error) {
    console.error("Error fetching team data:", error);
  }

  let selectedTeam = null;

  // Event delegation for selecting a team
  document
    .getElementById("team-assign-list")
    .addEventListener("click", function (event) {
      let selectedElement = event.target.closest(".team-item");
      if (!selectedElement) return;

      document.querySelectorAll(".team-item").forEach((item) => {
        item.style.backgroundColor = "";
        item.style.color = "";
      });

      selectedElement.style.backgroundColor = "#4CAF50";
      selectedElement.style.color = "white";

      // Store selected team details
      selectedTeam = {
        team_id: parseInt(selectedElement.getAttribute("data-team-id"), 10),
        team_name: selectedElement.getAttribute("data-team-name"),
        lead_farmer: selectedElement.getAttribute("data-lead-farmer"),
        lead_farmer_id: selectedElement.getAttribute("data-lead-farmer-id"),
        farmer_name: JSON.parse(selectedElement.getAttribute("data-farmers")),
      };

      // ✅ Set the global lead farmer ID
      globalLeadFarmerId = selectedTeam.lead_farmer_id;
      console.log("Global Lead Farmer ID Set:", globalLeadFarmerId);
    });

  // Ensure confirm button exists before adding event listener
  setTimeout(() => {
    const confirmBtn = document.getElementById("confirm-team-assign");
    if (confirmBtn) {
      confirmBtn.onclick = async function () {
        if (!selectedTeam) {
          alert("Please select a team first.");
          return;
        }

        try {
          const q = query(
            collection(db, "tb_projects"),
            where("project_id", "==", Number(project_id))
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            querySnapshot.forEach(async (doc) => {
              const projectRef = doc.ref;
              const currentDate = new Date().toISOString(); // Get current date

              await updateDoc(projectRef, {
                team_id: selectedTeam.team_id,
                team_name: selectedTeam.team_name,
                lead_farmer: selectedTeam.lead_farmer,
                lead_farmer_id: selectedTeam.lead_farmer_id, // ✅ Add lead farmer ID
                farmer_name: selectedTeam.farmer_name,
                crop_date: currentDate,
                fertilizer_date: currentDate,
                equipment_date: currentDate,
                status: "Ongoing",
              });

              localStorage.setItem(
                "projectData",
                JSON.stringify({
                  ...doc.data(),
                  team_id: selectedTeam.team_id,
                  team_name: selectedTeam.team_name,
                  lead_farmer: selectedTeam.lead_farmer,
                  lead_farmer_email: selectedTeam.lead_farmer_email,
                  farmer_name: selectedTeam.farmer_name,
                  crop_date: currentDate,
                  fertilizer_date: currentDate,
                  equipment_date: currentDate,
                  status: "Ongoing",
                })
              );

              alert(
                `Team "${selectedTeam.team_name}" has been successfully assigned! Project status updated to Ongoing.`
              );

              // ✅ Inserted Code: Save the gathered data to `tb_project_task`
              const projectTasks = await fetchProjectTasks(project_id);
              if (projectTasks && projectTasks.length > 0) {
                for (const task of projectTasks) {
                  await addDoc(collection(db, "tb_project_task"), task);
                }
                console.log(
                  "Successfully saved project task data:",
                  projectTasks
                );
              } else {
                console.warn("Failed to fetch project tasks, skipping save.");
              }

              await saveCropStockAfterTeamAssign(project_id);
              await saveFertilizerStockAfterTeamAssign(project_id);
              await saveEquipmentStockAfterTeamAssign(project_id);
              // ✅ Call the function to update crop stock after assigning a team
              await updateCropStockAfterAssignment(project_id);
              await updateFertilizerStockAfterAssignment(project_id);
              await updateEquipmentStockAfterAssignment(project_id);

              // Redirect to farmpres_project.html after successful save
              window.location.href = "farmpres_project.html";
            });
          } else {
            alert("No matching project found. Unable to proceed.");
          }
        } catch (error) {
          console.error("Error updating project with team assignment:", error);
          alert(
            "An error occurred while assigning the team. Please try again."
          );
        }

        panel.style.display = "none";
      };
    } else {
      console.error("Error: Confirm button (confirm-team-assign) not found!");
    }
  }, 100);
}

// Function to reset selection
// Function to reset selection and close the popup
function resetTeamSelection() {
  const panel = document.getElementById("team-assign-confirmation-panel");
  if (panel) {
    panel.style.display = "none"; // Hide the popup
  }
  selectedTeam = null;
}

// Cancel button event listeners
setTimeout(() => {
  const cancelTeamAssign = document.getElementById("cancel-team-assign");
  if (cancelTeamAssign)
    cancelTeamAssign.addEventListener("click", resetTeamSelection);
}, 100);

// <------------- VIEW BUTTON CODE ------------->
/*async function viewUserAccount(project_id) {
    try {
        const q = query(collection(db, "tb_projects"), where("project_id", "==", Number(project_id)));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const projectData = doc.data();
                localStorage.setItem("projectData", JSON.stringify(projectData));
                window.location.href = "admin_users_view.html";
            });
        } else {
            showDeleteMessage("No matching record found, Unable to proceed with the requested action", false);
        }
    } catch (error) {
        console.log("Error fetching user data for view:", error);
    }
}*/

function viewProject(projectId) {
  sessionStorage.setItem("selectedProjectId", parseInt(projectId, 10)); // Convert to integer
  window.location.href = "viewproject.html"; // Redirect to viewproject.html
}

// <------------- DELETE BUTTON EVENT LISTENER ------------->
async function deleteUserAccount(project_id) {
  try {
    const q = query(
      collection(db, "tb_projects"),
      where("project_id", "==", Number(project_id))
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      confirmationPanel.style.display = "flex";
      editFormContainer.style.pointerEvents = "none";
    } else {
      showDeleteMessage(
        "No project_id is found, Unable to proceed with the deleting the record",
        false
      );
    }
  } catch (error) {
    console.log("Error deleting User Account:", error);
  }
}

// <------------- DELETE ROW AND TABLE REFRESH CODE ------------->
const confirmationPanel = document.getElementById("confirmation-panel");
const confirmDeleteButton = document.getElementById("confirm-delete");
const cancelDeleteButton = document.getElementById("cancel-delete");
let selectedRowId = null;
const deleteMessage = document.getElementById("delete-message");

confirmDeleteButton.addEventListener("click", async () => {
  if (selectedRowId) {
    try {
      const userDocRef = doc(db, "tb_projects", selectedRowId);
      await deleteDoc(userDocRef);
      console.log("Record deleted successfully!");

      fetch_projects();

      deleteMessage.style.display = "block";
      setTimeout(() => {
        deleteMessage.style.opacity = "1";
        setTimeout(() => {
          deleteMessage.style.opacity = "0";
          setTimeout(() => {
            deleteMessage.style.display = "none";
          }, 300);
        }, 3000);
      }, 0);
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  }

  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

cancelDeleteButton.addEventListener("click", () => {
  confirmationPanel.style.display = "none";
  editFormContainer.style.pointerEvents = "auto";
});

// EVENT LISTENER FOR SEARCH BAR AND DROPDOWN
searchBar.addEventListener("input", () => {
  fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

statusSelect.addEventListener("change", () => {
  fetch_projects({
    search: searchBar.value,
    status: statusSelect.value,
  });
});

prevPageBtn.addEventListener("click", () => changePage("prev"));
nextPageBtn.addEventListener("click", () => changePage("next"));

// <----------------------- STATUS DROP DOWN CODE ----------------------->
async function fetch_status() {
  try {
    const querySnapshot = await getDocs(collection(db, "tb_projects"));

    let addedStatus = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let statusName = data.status ? data.status.toUpperCase() : "";

      // Case-insensitive check by converting all stored values to uppercase
      if (!addedStatus.includes(statusName)) {
        addedStatus.push(statusName);

        const option = document.createElement("option");
        option.value = statusName;
        option.textContent = statusName;
        statusSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error Fetching Status:", error);
  }
}

// <------------------ FUNCTION TO DISPLAY BULK DELETE MESSAGE and ERROR MESSAGES ------------------------>
function showDeleteMessage(message, success) {
  deleteMessage.textContent = message;
  deleteMessage.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  deleteMessage.style.opacity = "1";
  deleteMessage.style.display = "block";

  setTimeout(() => {
    deleteMessage.style.opacity = "0";
    setTimeout(() => {
      deleteMessage.style.display = "none";
    }, 400);
  }, 4000);
}

fetch_status();
