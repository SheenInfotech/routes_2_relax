(function () {
  const callbackButton = document.querySelector(".r2r-callback-open");
  const callbackDialog = document.getElementById("r2r-callback-dialog");
  const closeButton = document.querySelector(".r2r-callback-dialog__close");
  const callbackForm = document.getElementById("r2r-callback-form");
  const nameInput = document.getElementById("r2r-callback-name");
  const statusElement = callbackDialog && callbackDialog.querySelector(".r2r-callback-dialog__status");
  const submitButton = callbackForm && callbackForm.querySelector('button[type="submit"]');

  if (!callbackButton || !callbackDialog || !closeButton || !callbackForm || !nameInput || !statusElement || !submitButton) {
    throw new Error("Floating contact widget is missing required markup.");
  }

  let lastFocusedElement = null;
  const submitLabel = submitButton.textContent;

  callbackButton.addEventListener("click", function () {
    lastFocusedElement = document.activeElement;
    callbackForm.reset();
    statusElement.textContent = "";
    statusElement.classList.remove("is-error");
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
    callbackDialog.showModal();
    nameInput.focus();
  });

  closeButton.addEventListener("click", function () {
    callbackDialog.close();
  });

  callbackDialog.addEventListener("click", function (event) {
    if (event.target === callbackDialog) {
      callbackDialog.close();
    }
  });

  callbackDialog.addEventListener("close", function () {
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  });

  callbackForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const formData = new FormData(callbackForm);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const bestTime = String(formData.get("call-time") || "Any time");
    const trip = String(formData.get("trip") || "").trim();

    statusElement.textContent = "Saving your callback request…";
    statusElement.classList.remove("is-error");
    submitButton.disabled = true;

    try {
      if (!window.R2RAuth) {
        throw new Error("Supabase authentication client is not available.");
      }

      const client = await window.R2RAuth.ready;
      const result = await client.from("callback_requests").insert({
        name: name,
        phone: phone,
        best_time: bestTime,
        trip: trip || null
      });

      if (result.error) {
        throw result.error;
      }

      callbackForm.reset();
      submitButton.textContent = "Request saved";
      statusElement.textContent = "Your callback request is saved. Our team will call you at the number provided.";
    } catch (error) {
      console.error("Could not save callback request:", error);
      statusElement.textContent = "We couldn’t save your request. Please check your connection and try again.";
      statusElement.classList.add("is-error");
      submitButton.disabled = false;
    }
  });
}());
