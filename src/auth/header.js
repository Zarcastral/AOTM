import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { toggleLoadingIndicator } from "../auth/loading.js";
import app from "../config/firebase_config.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader("header-container");
  initializeHeaderEvents();
  setupRealtimeNotificationListener();
});

async function loadHeader(containerId) {
  try {
    const response = await fetch("../components/header.html");
    const data = await response.text();
    document.getElementById(containerId).innerHTML = data;
  } catch (error) {
    console.error("Error loading header:", error);
  }
}

function updateUnreadCount(unreadCount) {
  const unreadCountElement = document.getElementById("unread-count");
  if (unreadCountElement) {
    unreadCountElement.textContent = unreadCount > 0 ? unreadCount : "";
    unreadCountElement.style.display = unreadCount > 0 ? "block" : "none";
  }
}

function setupRealtimeNotificationListener() {
  const userType = sessionStorage.getItem("user_type");
  const farmerId = sessionStorage.getItem("farmer_id");
  const username = sessionStorage.getItem("user_name");

  console.log("User Type:", userType);
  console.log("Farmer ID:", farmerId);
  console.log("Username:", username);

  if (!userType) {
    console.error("No user_type found in sessionStorage");
    return;
  }

  let recipientValue;
  if (["Farmer", "Head Farmer", "Farm President"].includes(userType)) {
    if (!farmerId) {
      console.error("No farmer_id found in sessionStorage for this user type");
      return;
    }
    recipientValue = farmerId;
  } else if (["Admin", "Supervisor"].includes(userType)) {
    if (!username) {
      console.error("No user_name found in sessionStorage for this user type");
      return;
    }
    recipientValue = username;
  } else {
    console.error("Unknown user_type:", userType);
    return;
  }

  console.log("Setting up listener for recipient:", recipientValue);

  const q = query(
    collection(db, "tb_notifications"),
    where("recipient", "==", recipientValue),
    where("read", "==", false)
  );

  onSnapshot(
    q,
    (querySnapshot) => {
      const unreadCount = querySnapshot.size;
      console.log(`Real-time unread count updated: ${unreadCount}`);
      updateUnreadCount(unreadCount);
    },
    (error) => {
      console.error("Error in real-time notification listener:", error);
    }
  );
}

function initializeHeaderEvents() {
  const accountIcon = document.getElementById("account-icon");
  const accountPanel = document.getElementById("account-panel");
  const accountFrame = document.getElementById("account-frame");
  const notificationsIcon = document.getElementById("notifications-icon");
  const notificationsPanel = document.getElementById("notifications-panel");
  const notificationsFrame = document.getElementById("notifications-frame");

  if (
    !accountIcon ||
    !accountPanel ||
    !accountFrame ||
    !notificationsIcon ||
    !notificationsPanel ||
    !notificationsFrame
  ) {
    console.error("Header elements not found!");
    return;
  }

  accountIcon.addEventListener("click", toggleAccountPanel);
  notificationsIcon.addEventListener("click", toggleNotificationsPanel);
  window.addEventListener("message", handleIframeMessages);

  function toggleAccountPanel() {
    const isActive = accountPanel.classList.toggle("active");
    accountFrame.src = isActive ? "../components/logout.html" : "";
    if (isActive) notificationsPanel.classList.remove("active");
  }

  function toggleNotificationsPanel() {
    const isActive = notificationsPanel.classList.toggle("active");
    notificationsFrame.src = isActive ? "../components/notifications.html" : "";
    if (isActive) accountPanel.classList.remove("active");
  }

  function handleIframeMessages(event) {
    if (event.data === "notificationRead") {
      console.log("Received notificationRead message from iframe");
      return;
    }

    switch (event.data) {
      case "closeAccountPanel":
        closeAccountPanel();
        break;
      case "closeNotificationsPanel":
        closeNotificationsPanel();
        break;
      case "closeIframe":
        closeAccountPanel();
        closeNotificationsPanel();
        toggleLoadingIndicator(true);
        setTimeout(() => {
          sessionStorage.clear();
          window.top.location.href = "../../index.html";
        }, 1500);
        break;
      case "navigateToProfile":
        closeAccountPanel();
        window.location.href = "../components/profile.html";
        break;
    }
  }

  function closeAccountPanel() {
    accountPanel.classList.remove("active");
    accountFrame.src = "";
  }

  function closeNotificationsPanel() {
    notificationsPanel.classList.remove("active");
    notificationsFrame.src = "";
  }
}
