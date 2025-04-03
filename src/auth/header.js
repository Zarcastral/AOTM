import { toggleLoadingIndicator } from "./loading.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader("header-container");
  initializeHeaderEvents();
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

function initializeHeaderEvents() {
  const accountIcon = document.getElementById("account-icon");
  const accountPanel = document.getElementById("account-panel");
  const accountFrame = document.getElementById("account-frame");
  const notificationsIcon = document.getElementById("notifications-icon");
  const notificationsPanel = document.getElementById("notifications-panel");
  const notificationsFrame = document.getElementById("notifications-frame");

  if (!accountIcon || !accountPanel || !accountFrame || !notificationsIcon || !notificationsPanel || !notificationsFrame) {
    console.error("Header elements not found!");
    return;
  }

  accountIcon.addEventListener("click", toggleAccountPanel);
  notificationsIcon.addEventListener("click", toggleNotificationsPanel);
  window.addEventListener("message", handleIframeMessages);

  function toggleAccountPanel() {
    const isActive = accountPanel.classList.toggle("active");
    accountFrame.src = isActive ? "../components/logout.html" : "";
    if (isActive) notificationsPanel.classList.remove("active"); // Close notifications if open
  }

  function toggleNotificationsPanel() {
    const isActive = notificationsPanel.classList.toggle("active");
    notificationsFrame.src = isActive ? "../components/notifications.html" : "";
    if (isActive) accountPanel.classList.remove("active"); // Close account if open
  }

  function handleIframeMessages(event) {
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