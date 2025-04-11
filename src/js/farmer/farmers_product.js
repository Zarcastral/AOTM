// farmers_product.js
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

async function fetchAndDisplayTasks() {
  try {
    // Get farmer_id from session storage
    const farmerId = sessionStorage.getItem("farmer_id");
    console.log("Fetching data for Farmer ID:", farmerId);
    if (!farmerId) {
      console.error("No farmer_id found in session storage");
      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No farmer ID found. Please log in again.</td></tr>`;
      return;
    }

    // Fetch all projects where status is Ongoing
    console.log("Querying tb_projects for status: Ongoing");
    const projectsQuery = query(
      collection(db, "tb_projects"),
      where("status", "==", "Ongoing")
    );

    const projectSnapshot = await getDocs(projectsQuery);
    console.log("Ongoing Projects Found:", projectSnapshot.size);

    // Filter projects where farmer_id matches in farmer_name array
    let matchingProject = null;
    projectSnapshot.forEach((doc) => {
      const projectData = doc.data();
      console.log("Checking Project:", doc.id, projectData);
      const farmerNameArray = projectData.farmer_name || [];
      const farmerMatch = farmerNameArray.find(
        (farmer) => farmer.farmer_id === farmerId
      );
      if (farmerMatch) {
        console.log(
          "Farmer ID",
          farmerId,
          "found in farmer_name:",
          farmerMatch
        );
        matchingProject = { id: doc.id, data: projectData };
      }
    });

    if (!matchingProject) {
      console.error(
        "No ongoing projects found with farmer ID:",
        farmerId,
        "in farmer_name"
      );
      const tableBody = document.querySelector("tbody");
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">There are currently no ongoing project.</td></tr>`;
      return;
    }

    // Use the matched project
    const projectData = matchingProject.data;
    console.log("Selected Project:", projectData);
    sessionStorage.setItem("project_id", projectData.project_id.toString());

    // Fetch tasks for the project
    const projectId = projectData.project_id.toString();
    console.log("Querying tb_project_task for project_id:", projectId);
    const tasksQuery = query(
      collection(db, "tb_project_task"),
      where("project_id", "==", projectId)
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    console.log("Tasks Found:", tasksSnapshot.size);
    const tableBody = document.querySelector("tbody");
    tableBody.innerHTML = ""; // Clear existing table content

    // Populate table with task data
    tasksSnapshot.forEach((taskDoc, index) => {
      const taskData = taskDoc.data();
      console.log(`Task ${index + 1}:`, taskData);

      // Create table row without # and DURATION columns
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${projectData.project_name || "N/A"}</td>
        <td>${taskData.task_name || "N/A"}</td>
        <td>${projectData.lead_farmer || "N/A"}</td>
        <td>${projectData.barangay_name || "N/A"}</td>
        <td>${taskData.crop_name || "N/A"}</td>
        <td><span class="status ${taskData.task_status
          .toLowerCase()
          .replace(" ", "-")}">
          ${taskData.task_status}
          ${taskData.task_status === "Completed" ? "<span>✔</span>" : ""}
        </span></td>
      `;

      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    const tableBody = document.querySelector("tbody");
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Error loading data: ${error.message}</td></tr>`;
  }
}

// Execute when DOM is loaded
document.addEventListener("DOMContentLoaded", fetchAndDisplayTasks);
