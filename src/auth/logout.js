import { toggleLoadingIndicator } from "./loading.js";

document.addEventListener("DOMContentLoaded", () => {
  function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
      callback(element);
    } else {
      setTimeout(() => waitForElement(selector, callback), 100); // Retry every 100ms
    }
  }

  waitForElement("#logout-button", (logoutButton) => {
    // Retrieve session data
    const profileName = document.querySelector(".profile-name");
    const profilePicture = document.querySelector(".profile-picture");
    const storedName = sessionStorage.getItem("userFullName") || "Guest";
    const storedPicture =
      sessionStorage.getItem("userPicture") || "/images/default.jpg";

    profileName.textContent = storedName;
    profilePicture.src = storedPicture;

    document.getElementById("account-panel").style.display = "block";

    // Logout logic
    logoutButton.addEventListener("click", () => {
      window.parent.postMessage("closeIframe", "*");

      setTimeout(() => {
        toggleLoadingIndicator(true);
        setTimeout(() => {
          sessionStorage.clear();
          window.top.location.href = "../../index.html";
        }, 1500);
      }, 500);
    });

    // Close panel logic
    document.getElementById("close-panel").addEventListener("click", () => {
      window.parent.postMessage("closeAccountPanel", "*");
    });

    // Handle profile link click
    waitForElement(".panel-item", (profileItem) => {
      profileItem.addEventListener("click", (event) => {
        event.preventDefault();
        window.parent.postMessage("navigateToProfile", "*");
      });
    });
  });
});
