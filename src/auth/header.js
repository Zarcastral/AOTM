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

  if (!accountIcon || !accountPanel || !accountFrame) {
    console.error("Header elements not found!");
    return;
  }

  accountIcon.addEventListener("click", toggleAccountPanel);
  window.addEventListener("message", handleIframeMessages);

  function toggleAccountPanel() {
    const isActive = accountPanel.classList.toggle("active");
    accountFrame.src = isActive ? "../components/logout.html" : "";
  }

  function handleIframeMessages(event) {
    switch (event.data) {
      case "closeAccountPanel":
        closeAccountPanel();
        break;
      case "closeIframe":
        closeAccountPanel();
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
}
