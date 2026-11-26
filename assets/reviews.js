(function () {
  const form = document.getElementById("guest-feedback-form");
  const sendButton = document.getElementById("send-review-button");
  const status = document.getElementById("feedback-status");
  const feedbackField = document.getElementById("feedback-message");
  const emptyMessage = document.getElementById("review-empty");
  const loadStatus = document.getElementById("review-load-status");
  const reviewSlide = document.getElementById("review-slide");
  const reviewStars = document.getElementById("review-stars");
  const reviewComment = document.getElementById("review-comment");
  const reviewAuthor = document.getElementById("review-author");
  const reviewTrip = document.getElementById("review-trip");
  const reviewControls = document.getElementById("review-controls");
  const reviewPosition = document.getElementById("review-position");
  const reviewSlider = document.getElementById("review-slider");
  const previousButton = document.getElementById("review-previous");
  const nextButton = document.getElementById("review-next");
  const myFeedbackList = document.getElementById("my-feedback-list");
  const myFeedbackEmpty = document.getElementById("my-feedback-empty");
  const myFeedbackStatus = document.getElementById("my-feedback-status");
  const hasForm = Boolean(form);
  const sliderElements = [
    emptyMessage,
    loadStatus,
    reviewSlide,
    reviewStars,
    reviewComment,
    reviewAuthor,
    reviewTrip,
    reviewControls,
    reviewPosition,
    reviewSlider,
    previousButton,
    nextButton
  ];
  const hasSliderMarkup = sliderElements.some(Boolean);
  const hasSlider = sliderElements.every(Boolean);
  const myFeedbackElements = [myFeedbackList, myFeedbackEmpty, myFeedbackStatus];
  const hasMyFeedbackMarkup = myFeedbackElements.some(Boolean);
  const hasMyFeedback = myFeedbackElements.every(Boolean);
  let currentUser = null;
  let isSubmitting = false;
  let myFeedbackRequest = 0;
  let visibleReviews = [];
  let activeReviewIndex = 0;
  let rotationTimer = null;
  let isReviewHovered = false;
  let isReviewFocused = false;

  if (!hasForm && !hasSliderMarkup && !hasMyFeedbackMarkup) {
    return;
  }
  if (hasForm && (!sendButton || !status || !feedbackField)) {
    console.error("The customer feedback form is missing required markup.");
    return;
  }
  if (hasSliderMarkup && !hasSlider) {
    console.error("The customer review slider is missing required markup.");
    return;
  }
  if (hasMyFeedbackMarkup && !hasMyFeedback) {
    console.error("The account review history is missing required markup.");
    return;
  }

  if (!window.R2RAuth) {
    if (hasForm) {
      sendButton.disabled = true;
      status.textContent = "Sign-in is unavailable. Please try again later.";
    }
    if (hasSlider) {
      loadStatus.textContent = "Approved reviews are temporarily unavailable.";
    }
    if (hasMyFeedback) {
      myFeedbackStatus.textContent = "Your feedback history is temporarily unavailable.";
    }
    console.error("The authentication script did not load for customer feedback.");
    return;
  }

  function renderActiveReview() {
    const review = visibleReviews[activeReviewIndex];
    if (!review) {
      return;
    }

    const rating = Number(review.rating);
    reviewStars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    reviewStars.setAttribute("aria-label", "Rating " + rating + " out of 5");
    reviewComment.textContent = review.feedback;
    reviewAuthor.textContent = review.display_name || "Verified traveller";
    reviewTrip.textContent = review.package_name && review.package_name !== "Not specified"
      ? review.package_name
      : "Trip details not specified";
    reviewPosition.textContent = (activeReviewIndex + 1) + " of " + visibleReviews.length;
    previousButton.disabled = visibleReviews.length < 2;
    nextButton.disabled = visibleReviews.length < 2;
  }

  function stopAutoRotation() {
    if (rotationTimer !== null) {
      window.clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  function startAutoRotation() {
    stopAutoRotation();
    if (
      visibleReviews.length < 2 ||
      isReviewHovered ||
      isReviewFocused ||
      document.hidden
    ) {
      return;
    }

    rotationTimer = window.setInterval(function () {
      activeReviewIndex = (activeReviewIndex + 1) % visibleReviews.length;
      renderActiveReview();
    }, 5000);
  }

  function renderReviews(reviews) {
    visibleReviews = reviews || [];
    activeReviewIndex = 0;

    const hasReviews = visibleReviews.length > 0;
    emptyMessage.hidden = hasReviews;
    reviewSlide.hidden = !hasReviews;
    reviewControls.hidden = !hasReviews;

    if (hasReviews) {
      renderActiveReview();
    }
    startAutoRotation();
  }

  async function loadApprovedReviews(client) {
    const pageSize = 500;
    const reviews = [];

    for (let offset = 0; ; offset += pageSize) {
      const result = await client
        .from("reviews")
        .select("id, rating, package_name, feedback, display_name, created_at")
        .eq("approved", true)
        .order("rating", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (result.error) {
        throw result.error;
      }

      const page = result.data || [];
      reviews.push.apply(reviews, page);
      if (page.length < pageSize) {
        return reviews;
      }
    }
  }

  function renderMyFeedback(reviews) {
    while (myFeedbackList.firstChild) {
      myFeedbackList.removeChild(myFeedbackList.firstChild);
    }

    const hasReviews = reviews.length > 0;
    myFeedbackEmpty.hidden = hasReviews;
    myFeedbackList.hidden = !hasReviews;
    myFeedbackStatus.textContent = "";
    if (!hasReviews) {
      return;
    }

    reviews.forEach(function (review) {
      const item = document.createElement("li");
      item.className = "my-feedback-item";

      const heading = document.createElement("div");
      heading.className = "my-feedback-item__heading";

      const stars = document.createElement("span");
      const rating = Number(review.rating);
      stars.className = "my-feedback-item__stars";
      stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
      stars.setAttribute("aria-label", "Rating " + rating + " out of 5");

      const reviewState = document.createElement("span");
      reviewState.className = review.approved
        ? "my-feedback-item__state my-feedback-item__state--approved"
        : "my-feedback-item__state";
      reviewState.textContent = review.approved ? "Approved" : "Pending approval";
      heading.appendChild(stars);
      heading.appendChild(reviewState);
      item.appendChild(heading);

      const packageName = document.createElement("p");
      packageName.className = "my-feedback-item__package";
      packageName.textContent = review.package_name || "Trip not specified";
      item.appendChild(packageName);

      const feedback = document.createElement("p");
      feedback.className = "my-feedback-item__text";
      feedback.textContent = review.feedback;
      item.appendChild(feedback);

      const date = new Date(review.created_at);
      if (!Number.isNaN(date.getTime())) {
        const dateLabel = document.createElement("time");
        dateLabel.className = "my-feedback-item__date";
        dateLabel.dateTime = review.created_at;
        dateLabel.textContent = "Submitted " + date.toLocaleDateString();
        item.appendChild(dateLabel);
      }

      myFeedbackList.appendChild(item);
    });
  }

  async function loadMyFeedback(user) {
    if (!hasMyFeedback) {
      return;
    }

    const requestId = ++myFeedbackRequest;
    myFeedbackList.hidden = true;
    myFeedbackEmpty.hidden = true;
    if (!user) {
      myFeedbackStatus.textContent = "Sign in to see your saved feedback.";
      return;
    }

    const client = window.R2RAuth.getClient();
    if (!client) {
      myFeedbackStatus.textContent = "Your feedback history is temporarily unavailable.";
      return;
    }

    myFeedbackStatus.textContent = "Loading your saved feedback…";
    try {
      const result = await client.rpc("get_my_reviews");

      if (result.error) {
        throw result.error;
      }
      if (requestId !== myFeedbackRequest || !currentUser || currentUser.id !== user.id) {
        return;
      }
      renderMyFeedback(result.data || []);
    } catch (error) {
      if (requestId !== myFeedbackRequest || !currentUser || currentUser.id !== user.id) {
        return;
      }
      console.error("Could not load the user's saved feedback:", error);
      myFeedbackStatus.textContent = "Could not load your feedback. Please try again later.";
    }
  }

  function getFormData() {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      rating: Number(data.get("rating")),
      package: String(data.get("package") || "Not specified"),
      feedback: String(data.get("feedback") || "").trim()
    };
  }

  function updateSendButton(user) {
    currentUser = user;
    if (hasForm) {
      sendButton.disabled = !currentUser || isSubmitting;
    }
    if (hasForm && !isSubmitting) {
      status.textContent = currentUser
        ? "Signed in. Your feedback will be saved for approval before it appears in the slider."
        : "Log in with the button above to send feedback.";
    }
    if (hasMyFeedback) {
      loadMyFeedback(currentUser);
    }
  }

  if (hasForm || hasMyFeedback) {
    window.R2RAuth.onChange(updateSendButton);
  }

  if (hasSlider) {
    window.R2RAuth.ready
      .then(loadApprovedReviews)
      .then(function (reviews) {
        loadStatus.textContent = "";
        renderReviews(reviews);
      })
      .catch(function (error) {
        console.error("Could not load approved Supabase reviews:", error);
        loadStatus.textContent = "Approved reviews are temporarily unavailable.";
        emptyMessage.textContent = "Customer reviews will appear here once the review database is ready.";
      });
  }

  if (hasForm) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }
      const review = getFormData();
      if (!review.feedback) {
        feedbackField.setCustomValidity("Please enter a feedback comment.");
        feedbackField.reportValidity();
        feedbackField.setCustomValidity("");
        return;
      }
      if (!currentUser) {
        status.textContent = "Please log in before sending feedback.";
        window.R2RAuth.openDialog();
        return;
      }

      const client = window.R2RAuth.getClient();
      if (!client) {
        status.textContent = "Sign-in is unavailable. Please try again later.";
        return;
      }

      isSubmitting = true;
      sendButton.disabled = true;
      status.textContent = "Saving your feedback…";

      try {
        const result = await client.from("reviews").insert({
          user_id: currentUser.id,
          display_name: review.name || null,
          rating: review.rating,
          package_name: review.package,
          feedback: review.feedback
        });

        if (result.error) {
          throw result.error;
        }

        if (hasMyFeedback) {
          loadMyFeedback(currentUser);
        }
        form.reset();
        status.textContent = "Thank you! Your feedback has been saved and will appear after approval.";
      } catch (error) {
        console.error("Could not submit the authenticated review:", error);
        status.textContent = "Your feedback could not be saved. Please try again.";
      } finally {
        isSubmitting = false;
        sendButton.disabled = !currentUser;
      }
    });
  }

  if (hasSlider) {
    previousButton.addEventListener("click", function () {
      activeReviewIndex = (activeReviewIndex - 1 + visibleReviews.length) % visibleReviews.length;
      renderActiveReview();
      startAutoRotation();
    });

    nextButton.addEventListener("click", function () {
      activeReviewIndex = (activeReviewIndex + 1) % visibleReviews.length;
      renderActiveReview();
      startAutoRotation();
    });

    reviewSlider.addEventListener("mouseenter", function () {
      isReviewHovered = true;
      stopAutoRotation();
    });

    reviewSlider.addEventListener("mouseleave", function () {
      isReviewHovered = false;
      startAutoRotation();
    });

    reviewSlider.addEventListener("focusin", function () {
      isReviewFocused = true;
      stopAutoRotation();
    });

    reviewSlider.addEventListener("focusout", function (event) {
      if (!reviewSlider.contains(event.relatedTarget)) {
        isReviewFocused = false;
        startAutoRotation();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAutoRotation();
      } else {
        startAutoRotation();
      }
    });
  }
}());
