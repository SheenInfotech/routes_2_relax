(function () {
  const callbackButton = document.querySelector(".r2r-callback-open");
  const callbackDialog = document.getElementById("r2r-callback-dialog");
  const closeButton = document.querySelector(".r2r-callback-dialog__close");
  const callbackForm = document.getElementById("r2r-callback-form");
  const nameInput = document.getElementById("r2r-callback-name");

  if (!callbackButton || !callbackDialog || !closeButton || !callbackForm || !nameInput) {
    throw new Error("Floating contact widget is missing required markup.");
  }

  let lastFocusedElement = null;

  callbackButton.addEventListener("click", function () {
    lastFocusedElement = document.activeElement;
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

  callbackForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(callbackForm);
    const message = [
      "Hello Routes 2 Relax, please call me back.",
      "Name: " + formData.get("name"),
      "Phone: " + formData.get("phone"),
      "Best time to call: " + formData.get("call-time"),
      "Package / destination: " + (formData.get("trip") || "Not specified")
    ].join("\n");

    window.open(
      "https://wa.me/919596261463?text=" + encodeURIComponent(message),
      "_blank",
      "noopener,noreferrer"
    );
    callbackForm.reset();
    callbackDialog.close();
  });
}());
