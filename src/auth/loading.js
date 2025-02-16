export function toggleLoadingIndicator(isLoading) {
  let loadingIndicator = document.getElementById("loading-indicator");

  if (!loadingIndicator) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-indicator";
    loadingIndicator.innerHTML = `
      <div class="spinner">
        ${Array.from({ length: 8 })
          .map((_, i) => `<div class="dot" style="--i:${i};"></div>`)
          .join("")}
      </div>
      <style>
        /* Centered loading overlay */
        #loading-indicator {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Spinner container */
        .spinner {
          position: relative;
          width: 60px;
          height: 60px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Dots in a circular shape */
        .dot {
          position: absolute;
          width: 12px;
          height: 12px;
          background-color: #41A186; /* Custom Green */
          border-radius: 50%;
          animation: fade 1.5s infinite ease-in-out;
          transform: rotate(calc(var(--i) * 45deg)) translate(25px);
          animation-delay: calc(var(--i) * 0.15s);
        }

        /* Fade effect for the dots */
        @keyframes fade {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
    `;
    document.body.appendChild(loadingIndicator);
  }

  loadingIndicator.style.display = isLoading ? "flex" : "none";
}
