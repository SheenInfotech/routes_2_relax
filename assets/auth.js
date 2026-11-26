(function () {
  const config = window.ROUTES2RELAX_SUPABASE_CONFIG;
  const triggers = document.querySelectorAll("[data-auth-trigger]");
  const dialog = document.getElementById("auth-dialog");
  const credentialsForm = document.getElementById("auth-credentials-form");
  const accountPanel = document.getElementById("auth-account-panel");
  const authStatus = document.getElementById("auth-status");
  const emailInput = document.getElementById("auth-email");
  const passwordInput = document.getElementById("auth-password");
  const phoneInput = document.getElementById("auth-phone");
  const phoneField = document.getElementById("auth-phone-field");
  const accountLabel = document.getElementById("auth-account-label");
  const authTitle = document.getElementById("auth-title");
  const authIntro = document.getElementById("auth-intro");
  const authSubmitButton = document.getElementById("auth-submit-button");
  const modeToggleButton = document.getElementById("auth-mode-toggle");
  const closeButton = document.getElementById("auth-close-button");
  const signOutButton = document.getElementById("auth-signout-button");
  let client = null;
  let currentUser = null;
  let authMode = "signin";
  let initializationError = null;
  const authListeners = [];

  function setStatus(message) {
    if (authStatus) {
      authStatus.textContent = message;
    }
  }

  function updateAuthState(user) {
    currentUser = user || null;

    triggers.forEach(function (trigger) {
      trigger.textContent = currentUser ? "Account" : "Login";
      trigger.setAttribute("aria-label", currentUser ? "Account profile" : "Log in");
      if (trigger.tagName === "A") {
        trigger.href = currentUser ? "account.html" : "index.html#login";
      }
    });

    if (dialog) {
      const signedIn = Boolean(currentUser);
      credentialsForm.hidden = signedIn;
      modeToggleButton.hidden = signedIn;
      accountPanel.hidden = !signedIn;
      if (signedIn) {
        accountLabel.textContent = "Signed in as " + (currentUser.email || "your account") + ".";
      }
    }

    authListeners.slice().forEach(function (listener) {
      listener(currentUser);
    });
  }

  function openDialog() {
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    if (initializationError) {
      setStatus("Sign-in is unavailable: " + initializationError.message);
    } else if (currentUser) {
      setStatus("You are signed in. Your account is ready.");
    } else {
      setStatus(authMode === "signup" ? "Create an account with your email and password." : "Sign in with your email and password.");
      window.setTimeout(function () {
        emailInput.focus();
      }, 0);
    }
  }

  function updateAuthMode(mode) {
    authMode = mode;
    const signingUp = authMode === "signup";
    authTitle.textContent = signingUp ? "Create an account" : "Sign in to your account";
    authIntro.textContent = signingUp
      ? "Create an account with your email and password. Phone number is optional."
      : "Sign in with your email and password to manage your profile and send feedback.";
    phoneField.hidden = !signingUp;
    passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
    passwordInput.minLength = signingUp ? 6 : 0;
    authSubmitButton.textContent = signingUp ? "Create account" : "Sign in";
    modeToggleButton.textContent = signingUp ? "Already have an account? Sign in" : "Create an account";
  }

  if (dialog) {
    updateAuthMode("signin");
  }

  async function initialize() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("The Supabase client library did not load.");
    }
    if (!config || !config.url || !config.publishableKey) {
      throw new Error("Supabase project configuration is missing.");
    }

    client = window.supabase.createClient(config.url, config.publishableKey);
    const result = await client.auth.getSession();
    if (result.error) {
      throw result.error;
    }

    updateAuthState(result.data.session ? result.data.session.user : null);
    client.auth.onAuthStateChange(function (_event, session) {
      updateAuthState(session ? session.user : null);
    });
    return client;
  }

  const ready = initialize();
  ready.catch(function (error) {
    initializationError = error;
    console.error("Could not initialize Supabase authentication:", error);
    setStatus("Sign-in is unavailable. Check the Supabase project configuration and try again.");
  });

  window.R2RAuth = {
    ready: ready,
    getClient: function () {
      return client;
    },
    getUser: function () {
      return currentUser;
    },
    onChange: function (listener) {
      authListeners.push(listener);
      listener(currentUser);
      return function () {
        const index = authListeners.indexOf(listener);
        if (index >= 0) {
          authListeners.splice(index, 1);
        }
      };
    },
    openDialog: openDialog
  };

  triggers.forEach(function (trigger) {
    if (trigger.tagName === "BUTTON") {
      trigger.addEventListener("click", function () {
        if (currentUser) {
          window.location.href = "account.html";
        } else {
          openDialog();
        }
      });
    }
  });

  if (closeButton) {
    closeButton.addEventListener("click", function () {
      dialog.close();
    });
  }

  if (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", function () {
      if (window.location.hash === "#login") {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }
    });
  }

  if (credentialsForm) {
    credentialsForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!client) {
        setStatus("The sign-in service is not ready. Please try again later.");
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const signingUp = authMode === "signup";
      let contactPhone = phoneInput.value.trim().replace(/[\s()-]/g, "");

      if (signingUp && contactPhone && !/^\+[1-9]\d{7,14}$/.test(contactPhone)) {
        setStatus("Enter the optional phone number in international format, such as +91 98765 43210.");
        phoneInput.focus();
        return;
      }

      authSubmitButton.disabled = true;
      setStatus(signingUp ? "Creating your account…" : "Signing in…");
      try {
        const result = signingUp
          ? await client.auth.signUp({
            email: email,
            password: password,
            options: {
              data: contactPhone ? { contact_phone: contactPhone } : {}
            }
          })
          : await client.auth.signInWithPassword({
            email: email,
            password: password
          });

        if (result.error) {
          throw result.error;
        }

        if (signingUp && !result.data.session) {
          setStatus("Account created. Check your email to confirm it, then sign in.");
        } else {
          updateAuthState(result.data.session ? result.data.session.user : result.data.user);
          setStatus(signingUp ? "Account created and signed in." : "You are signed in. Your account is ready.");
        }
      } catch (error) {
        console.error("Could not authenticate with Supabase:", error);
        setStatus(error.message || "Authentication failed. Check your details and try again.");
      } finally {
        authSubmitButton.disabled = false;
      }
    });
  }

  if (modeToggleButton) {
    modeToggleButton.addEventListener("click", function () {
      updateAuthMode(authMode === "signup" ? "signin" : "signup");
      setStatus(authMode === "signup"
        ? "Create an account with your email and password."
        : "Sign in with your email and password.");
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", async function () {
      if (!client) {
        return;
      }

      signOutButton.disabled = true;
      setStatus("Signing out…");
      try {
        const result = await client.auth.signOut();
        if (result.error) {
          throw result.error;
        }
        credentialsForm.reset();
        updateAuthMode("signin");
        updateAuthState(null);
        setStatus("You have signed out.");
      } catch (error) {
        console.error("Could not sign out of Supabase:", error);
        setStatus(error.message || "Could not sign out. Please try again.");
      } finally {
        signOutButton.disabled = false;
      }
    });
  }

  if (window.location.hash === "#login") {
    openDialog();
  }
}());
