document.addEventListener("DOMContentLoaded", () => {
  const userType = sessionStorage.getItem("user_type");
  const userEmail = sessionStorage.getItem("userEmail"); // Fix: use correct key

  console.log("Session User Type:", userType);
  console.log("Session Email:", userEmail);

  const userTypeField = document.getElementById("user_type");
  const formContainer = document.querySelector(".container");

  if (!userType) {
    console.error(
      "⚠️ User type not found in session. Make sure it is set during login."
    );
    return;
  }

  userTypeField.value = userType;

  const farmerRoles = ["Farmer", "Farm President", "Head Farmer"];
  if (farmerRoles.includes(userType)) {
    replaceUsernameWithFarmerId();
  }

  function replaceUsernameWithFarmerId() {
    const usernameFieldContainer = document.querySelector(
      ".form-group:has(#user_name)"
    ); // Select whole div

    if (!usernameFieldContainer) {
      console.error("⚠️ Username field not found.");
      return;
    }

    console.log("✅ Replacing Username field with Farmer ID.");

    const farmerField = document.createElement("div");
    farmerField.classList.add("form-group");
    farmerField.innerHTML = `
      <label for="farmer_id">Farmer ID</label>
      <input type="text" id="farmer_id" name="farmer_id" readonly>
    `;

    usernameFieldContainer.replaceWith(farmerField);
  }
});
