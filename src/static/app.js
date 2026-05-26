document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const messageDiv = document.getElementById("message");
  const loginMessageDiv = document.getElementById("login-message");
  const userPanel = document.getElementById("user-panel");
  const currentUserSpan = document.getElementById("current-user");
  const authNote = document.getElementById("auth-note");

  let currentUser = null;
  let sessionToken = localStorage.getItem("sessionToken");

  function setSessionToken(token) {
    sessionToken = token;
    if (token) {
      localStorage.setItem("sessionToken", token);
    } else {
      localStorage.removeItem("sessionToken");
    }
  }

  function getAuthHeaders() {
    return sessionToken
      ? { "X-Session-Token": sessionToken }
      : {};
  }

  function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.classList.remove("hidden");

    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const canUnregister = currentUser && currentUser.email === email;
                    return `<li>
                      <span class="participant-email">${email}</span>
                      ${canUnregister ? `<button class="delete-btn" data-activity="${name}">❌</button>` : ""}
                    </li>`;
                  })
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function loadCurrentUser() {
    if (!sessionToken) {
      updateAuthState(null);
      return;
    }

    try {
      const response = await fetch("/me", { headers: getAuthHeaders() });
      if (!response.ok) {
        setSessionToken(null);
        currentUser = null;
        updateAuthState(null);
        return;
      }

      currentUser = await response.json();
      updateAuthState(currentUser);
    } catch (error) {
      console.error("Error loading current user:", error);
      setSessionToken(null);
      currentUser = null;
      updateAuthState(null);
    }
  }

  function updateAuthState(user) {
    if (user) {
      currentUserSpan.textContent = `${user.name} (${user.email})`;
      userPanel.classList.remove("hidden");
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
      authNote.classList.add("hidden");
    } else {
      currentUserSpan.textContent = "";
      userPanel.classList.add("hidden");
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
      authNote.classList.remove("hidden");
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      console.error("Error unregistering:", error);
      showMessage(messageDiv, "Failed to unregister. Please try again.", "error");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (response.ok) {
        setSessionToken(result.token);
        currentUser = result.user;
        updateAuthState(currentUser);
        showMessage(loginMessageDiv, "Logged in successfully.", "success");
        loginForm.reset();
        fetchActivities();
      } else {
        showMessage(loginMessageDiv, result.detail || "Invalid credentials.", "error");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      showMessage(loginMessageDiv, "Login failed. Please try again.", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    setSessionToken(null);
    currentUser = null;
    updateAuthState(null);
    showMessage(loginMessageDiv, "Logged out successfully.", "info");
    fetchActivities();
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const activity = activitySelect.value;
    if (!activity) {
      showMessage(messageDiv, "Please select an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      console.error("Error signing up:", error);
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
    }
  });

  async function initialize() {
    await loadCurrentUser();
    await fetchActivities();
  }

  initialize();
});
