import { 
  addDoc, 
  collection, 
  doc, 
  getDocs, 
  getFirestore, 
  query, 
  updateDoc, 
  where 
} from "firebase/firestore";
import app from "../../../src/config/firebase_config.js"; // Adjust path as needed

const db = getFirestore(app);

// Fetch projects for the farmer when the page loads
fetchProjectsForFarmer();

export async function fetchProjectsForFarmer() {
  const farmerId = sessionStorage.getItem("farmer_id");

  if (!farmerId) {
      console.log("No farmer ID found in session.");
      return;
  }

  try {
      const projectsRef = collection(db, "tb_projects");
      const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          console.log("No project found where the farmer is a team lead.");
          return;
      }

      querySnapshot.forEach(async (doc) => {
          const project = doc.data();
          if (project.status === "Ongoing") {
              console.log("✅ Found Project:", project.project_id);

              // Store project details in sessionStorage
              sessionStorage.setItem("selected_project_id", String(project.project_id));
              sessionStorage.setItem("selected_crop_type", project.crop_type_name);
              sessionStorage.setItem("selected_crop_name", project.crop_name);

              console.log("✅ Project details saved to sessionStorage!");

              // Fetch tasks for this project
              await fetchProjectTasks(project.crop_type_name, project.project_id);
          }
      });
  } catch (error) {
      console.error("❌ Error fetching projects:", error);
  }
}

async function fetchProjectTasks(cropTypeName, projectId) {
  try {
      const tasksRef = collection(db, "tb_project_task");
      const q = query(
          tasksRef,
          where("crop_type_name", "==", cropTypeName),
          where("project_id", "==", projectId.toString())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          console.log(`No tasks found for project ID ${projectId}.`);
          return;
      }

      const taskTableBody = document.getElementById("taskTableBody");
      taskTableBody.innerHTML = ""; // Clear previous tasks

      querySnapshot.forEach((docSnapshot) => {
          const task = docSnapshot.data();
          const taskId = docSnapshot.id; // Firestore document ID

          const taskRow = `
              <tr class="bg-white border-b" id="task-row-${taskId}">
                  <td class="px-4 py-2 font-medium text-gray-900">${task.task_name}</td>
                  <td class="px-4 py-2">${task.subtasks.length}</td>
                  <td class="px-4 py-2 start-date" data-task-id="${taskId}">${task.start_date ? task.start_date : "--"}</td>
                  <td class="px-4 py-2 end-date" data-task-id="${taskId}">${task.end_date ? task.end_date : "--"}</td>
                  <td class="px-4 py-2">
                      <select class="status-dropdown px-2 py-1 border rounded-md" data-task-id="${taskId}">
                          <option value="Pending" ${task.status === "Pending" ? "selected" : ""}>Pending</option>
                          <option value="Ongoing" ${task.status === "Ongoing" ? "selected" : ""}>Ongoing</option>
                          <option value="Completed" ${task.status === "Completed" ? "selected" : ""}>Completed</option>
                      </select>
                  </td>
                  <td class="px-4 py-2 text-center">
                      <button class="view-task-btn text-gray-500 hover:text-gray-700" data-task-id="${taskId}">
                          <img src="../../images/eye.png" alt="View" class="w-4 h-4">
                      </button>
                       <button class="text-gray-500 hover:text-gray-700 mx-2">
                       <img src="../../images/Edit.png" alt="Edit" class="w-4 h-4">
                      </button>
                      <button class="text-red-500 hover:text-red-700">
                       <img src="../../images/Delete.png" alt="Delete" class="w-4 h-4">
                      </button>
                  </td>
              </tr>
          `;

          taskTableBody.insertAdjacentHTML("beforeend", taskRow);
      });

      // Add event listeners to update status in Firestore
      document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
          dropdown.addEventListener("change", async (event) => {
              const taskId = event.target.dataset.taskId;
              const newStatus = event.target.value;
              await updateTaskStatus(taskId, newStatus);
          });
      });

      // Add event listeners for the view buttons
      document.querySelectorAll(".view-task-btn").forEach((button) => {
          button.addEventListener("click", (event) => {
              const taskId = event.currentTarget.dataset.taskId;
              // Navigate to the task details page with taskId as a query parameter
              window.location.href = `headfarm_subtask.html?taskId=${taskId}`;
          });
      });
  } catch (error) {
      console.error("❌ Error fetching project tasks:", error);
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
      const taskDocRef = doc(db, "tb_project_task", taskId);
      const updateData = { status: newStatus };

      // Get the current date
      const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

      if (newStatus === "Ongoing") {
          updateData.start_date = today;
          updateData.end_date = null; // Remove end_date when switching from Completed
      } else if (newStatus === "Pending") {
          updateData.end_date = null;
          updateData.start_date = null;
      } else if (newStatus === "Completed") {
          updateData.end_date = today;
      }

      await updateDoc(taskDocRef, updateData);
      console.log(`✅ Task ${taskId} status updated to ${newStatus}`);

      // Update the UI instantly
      const startDateCell = document.querySelector(`.start-date[data-task-id="${taskId}"]`);
      const endDateCell = document.querySelector(`.end-date[data-task-id="${taskId}"]`);

      if (startDateCell && updateData.start_date !== undefined) {
          startDateCell.textContent = updateData.start_date ? updateData.start_date : "--";
      }
      if (endDateCell && updateData.end_date !== undefined) {
          endDateCell.textContent = updateData.end_date ? updateData.end_date : "--";
      }
  } catch (error) {
      console.error("❌ Error updating task status:", error);
  }
}

// Get modal elements
const addTaskModal = document.getElementById("addTaskModal");
const taskNameInput = document.getElementById("taskNameInput");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");

// Open modal when "Add Task" is clicked
document.getElementById("addTaskButton").addEventListener("click", () => {
  addTaskModal.classList.remove("hidden");
});

// Close modal when "Cancel" is clicked
cancelTaskBtn.addEventListener("click", () => {
  taskNameInput.value = ""; // Clear input
  addTaskModal.classList.add("hidden");
});

// Save task when "Save" is clicked
saveTaskBtn.addEventListener("click", async () => {
  const taskName = taskNameInput.value.trim();

  if (!taskName) {
      alert("Please enter a task name.");
      return;
  }

  try {
      const projectId = sessionStorage.getItem("selected_project_id");
      const cropTypeName = sessionStorage.getItem("selected_crop_type");
      const cropName = sessionStorage.getItem("selected_crop_name");
      console.log("🔍 Checking sessionStorage values:");
      console.log("Project ID:", sessionStorage.getItem("selected_project_id"));
      console.log("Crop Type:", sessionStorage.getItem("selected_crop_type"));
      console.log("Crop Name:", sessionStorage.getItem("selected_crop_name"));

      if (!projectId || !cropTypeName || !cropName) {
          alert("Missing project or crop details.");
          return;
      }

      const tasksRef = collection(db, "tb_project_task");

      await addDoc(tasksRef, {
          task_name: taskName,
          project_id: String(projectId),
          crop_type_name: cropTypeName,
          crop_name: cropName,
          status: "Pending",
          subtasks: [], // Empty array for subtasks
      });

      console.log(`✅ Task "${taskName}" added successfully!`);
      alert("Task added successfully!");

      // Close modal and refresh task list
      taskNameInput.value = "";
      addTaskModal.classList.add("hidden");
      fetchProjectsForFarmer();
  } catch (error) {
      console.error("❌ Error adding task:", error);
      alert("Failed to add task. Try again.");
  }
});