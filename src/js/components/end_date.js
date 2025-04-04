import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import app from "../../config/firebase_config.js";

const db = getFirestore(app);

// Helper function to calculate days until end_date
function daysUntil(endDate) {
  const currentDate = new Date();
  const projectEndDate = new Date(endDate);

  currentDate.setHours(0, 0, 0, 0);
  projectEndDate.setHours(0, 0, 0, 0);

  const diffMs = projectEndDate - currentDate;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
}

// Function to add a notification to Firestore if it doesn’t already exist
async function addNotification(farmerId, projectId, endDate, daysLeft) {
  try {
    const notificationsRef = collection(db, "tb_notifications");
    // Updated: Query using "recipient" instead of "farmer_id"
    const q = query(
      notificationsRef,
      where("recipient", "==", farmerId),
      where("project_id", "==", projectId),
      where("type", "==", "upcoming_deadline")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      await addDoc(notificationsRef, {
        recipient: farmerId,
        project_id: projectId,
        type: "upcoming_deadline",
        title: "PROJECT REMINDER",
        description: `Project ${projectId} ends in ${daysLeft} day${
          daysLeft === 1 ? "" : "s"
        } on ${endDate}!`,
        timestamp: Timestamp.now(),
        read: false,
      });
      console.log(
        `✅ Added notification for Project ${projectId} (ends in ${daysLeft} days)`
      );
    } else {
      console.log(`Notification for Project ${projectId} already exists`);
    }
  } catch (error) {
    console.error("❌ Error adding notification:", error);
  }
}

// Function to check projects for upcoming deadlines (< 7 days)
export async function checkProjectReminders(farmerId) {
  try {
    const projectsRef = collection(db, "tb_projects");
    const q = query(projectsRef, where("lead_farmer_id", "==", farmerId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No projects found for this farmer.");
      return;
    }

    querySnapshot.forEach(async (doc) => {
      const project = doc.data();
      if (project.status === "Ongoing") {
        const daysLeft = daysUntil(project.end_date);
        if (daysLeft > 0 && daysLeft < 7) {
          await addNotification(
            farmerId,
            project.project_id,
            project.end_date,
            daysLeft
          );
          console.log(
            `⚠️ Project ${project.project_id} ends in ${daysLeft} day${
              daysLeft === 1 ? "" : "s"
            } on ${project.end_date}`
          );
        } else if (daysLeft >= 7) {
          console.log(
            `Project ${project.project_id} has ${daysLeft} days until end_date (no notification yet)`
          );
        } else {
          console.log(
            `Project ${project.project_id} is past due (ended on ${project.end_date})`
          );
        }
      }
    });
  } catch (error) {
    console.error("❌ Error checking project reminders:", error);
  }
}
