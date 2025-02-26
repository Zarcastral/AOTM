import { getFirestore, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import app from "../../../src/config/firebase_config.js";

const db = getFirestore(app);

export async function fetchAssignedTasks() {
    try {
        const taskListTable = document.getElementById("assigned-tasks-table-body");
        if (!taskListTable) {
            console.error("Table body element not found.");
            return;
        }

        taskListTable.innerHTML = ""; // Clear existing data

        const querySnapshot = await getDocs(collection(db, "tb_task_list"));
        querySnapshot.forEach((doc) => {
            const taskDoc = doc.data();
            const cropTypeName = taskDoc.crop_type_name || "N/A";
            const taskName = taskDoc.task_name || "N/A";
            const assignedOnTimestamp = taskDoc.assigned_on; // Firestore Timestamp object

            let assignedOn = "N/A";
            if (assignedOnTimestamp && assignedOnTimestamp.seconds) {
                const date = new Date(assignedOnTimestamp.seconds * 1000); // Convert to milliseconds
                assignedOn = date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                });
            }

            const taskId = doc.id; // Firestore document ID

            // Create table row
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${cropTypeName}</td>
                <td>${taskName}</td>
                <td>${assignedOn}</td>
                <td>
                    <button class="edit-btn" data-id="${taskId}" data-crop="${cropTypeName}" data-task="${taskName}">Edit</button>
                    <button class="delete-btn" data-id="${taskId}">Delete</button>
                </td>
            `;
            taskListTable.appendChild(row);
        });

        // Attach event listeners to all edit buttons
        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", async (event) => {
                const taskId = event.target.getAttribute("data-id");
                const cropTypeName = event.target.getAttribute("data-crop");
                const taskName = event.target.getAttribute("data-task");
                openEditModal(taskId, cropTypeName, taskName);
            });
        });

    } catch (error) {
        console.error("Error fetching assigned tasks:", error);
    }
}

async function openEditModal(taskId, cropTypeName, taskName) {
    const editModal = document.getElementById("edit-task-modal");
    const subtaskList = document.getElementById("subtask-list");
    const saveSubtasksBtn = document.getElementById("save-subtasks-btn");
    const taskNameDisplay = document.getElementById("edit-task-name-display");
    const newSubtaskInput = document.getElementById("new-subtask-input");
    const addSubtaskBtn = document.getElementById("add-subtask-btn");

    if (!editModal || !subtaskList || !saveSubtasksBtn || !taskNameDisplay || !newSubtaskInput || !addSubtaskBtn) {
        console.error("Edit modal or subtask elements not found.");
        return;
    }

    // Display task name (not editable)
    taskNameDisplay.textContent = `Task: ${taskName}`;

    // Clear previous subtasks and input field
    subtaskList.innerHTML = "";
    newSubtaskInput.value = "";
    saveSubtasksBtn.disabled = true; // Initially disable the button

    try {
        const q = query(
            collection(db, "tb_task_list"),
            where("crop_type_name", "==", cropTypeName),
            where("task_name", "==", taskName)
        );
        const querySnapshot = await getDocs(q);

        let subtasks = [];
        let docRef;
        querySnapshot.forEach((docSnapshot) => {
            subtasks = docSnapshot.data().subtasks || [];
            docRef = docSnapshot.ref;
        });

        // Store original subtasks for comparison
        let originalSubtasks = [...subtasks];

        // Populate modal with existing subtasks
        subtasks.forEach((subtask, index) => {
            const subtaskItem = document.createElement("li");
            subtaskItem.innerHTML = `
                <input type="text" class="subtask-input" data-index="${index}" value="${subtask}">
            `;
            subtaskList.appendChild(subtaskItem);
        });

        // Show modal
        editModal.style.display = "block";

        // Function to check for actual changes
        function checkForChanges() {
            const currentSubtasks = Array.from(document.querySelectorAll(".subtask-input")).map(input => input.value.trim());
            const hasNewSubtask = newSubtaskInput.value.trim() !== "";
            const hasChanges = JSON.stringify(currentSubtasks) !== JSON.stringify(originalSubtasks);

            // Enable button only if there are actual changes or a new subtask is added
            saveSubtasksBtn.disabled = !(hasChanges || hasNewSubtask);
        }

        // Detect input changes
        document.querySelectorAll(".subtask-input").forEach(input => {
            input.addEventListener("input", checkForChanges);
        });

        // Detect changes in new subtask input
        newSubtaskInput.addEventListener("input", checkForChanges);

        // Add new subtask
        addSubtaskBtn.onclick = () => {
            const newSubtask = newSubtaskInput.value.trim();
            if (newSubtask) {
                const subtaskItem = document.createElement("li");
                subtaskItem.innerHTML = `
                    <input type="text" class="subtask-input" value="${newSubtask}">
                `;
                subtaskList.appendChild(subtaskItem);

                // Reset input field and update changes check
                newSubtaskInput.value = "";
                checkForChanges();

                // Add input event listener to new subtask input
                subtaskItem.querySelector(".subtask-input").addEventListener("input", checkForChanges);
            }
        };

        // Save changes
        saveSubtasksBtn.onclick = async () => {
            const updatedSubtasks = Array.from(document.querySelectorAll(".subtask-input")).map(input => input.value.trim());

            // Prevent saving if all fields are empty
            if (updatedSubtasks.every(subtask => subtask === "")) {
                alert("Subtasks cannot be empty!");
                return;
            }

            try {
                await updateDoc(docRef, { subtasks: updatedSubtasks });
                editModal.style.display = "none";
                fetchAssignedTasks(); // Refresh the table
            } catch (error) {
                console.error("Error updating subtasks:", error);
            }
        };

    } catch (error) {
        console.error("Error fetching subtasks:", error);
    }
}
