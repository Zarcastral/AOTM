import { toggleLoadingIndicator } from "./loading.js";

document.addEventListener("DOMContentLoaded", () => {
  fetch("../components/header.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("header-container").innerHTML = data;

      // Initialize the header events after loading
      initializeHeaderEvents();
    })
    .catch((error) => console.error("Error loading header:", error));
});

function initializeHeaderEvents() {
  const accountIcon = document.getElementById("account-icon");
  const accountPanel = document.getElementById("account-panel");
  const accountFrame = document.getElementById("account-frame");

  if (!accountIcon || !accountPanel || !accountFrame) {
    console.error("Header elements not found!");
    return;
  }

  accountIcon.addEventListener("click", () => {
    accountPanel.classList.toggle("active");
    accountFrame.src = accountPanel.classList.contains("active")
      ? "../components/logout.html"
      : "";
  });

  // Handle messages from iframe (logout.html)
  window.addEventListener("message", (event) => {
    if (event.data === "closeAccountPanel") {
      closeAccountPanel();
    } else if (event.data === "closeIframe") {
      closeAccountPanel();
      toggleLoadingIndicator(true); // Ensure function is properly imported

      setTimeout(() => {
        sessionStorage.clear();
        window.top.location.href = "../../index.html";
      }, 1500);
    } else if (event.data === "navigateToProfile") {
      closeAccountPanel();
      window.location.href = "../components/profile.html"; // Redirect to profile
    }
  });

  function closeAccountPanel() {
    accountPanel.classList.remove("active");
    accountFrame.src = "";
  }
}

// header.js
export function loadHeader(containerId) {
  fetch("../../../src/auth/header.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById(containerId).innerHTML = data;
    })
    .catch((error) => console.error("Error loading header:", error));
}
