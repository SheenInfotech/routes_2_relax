(function () {
  const form = document.getElementById("profile-form");
  if (!form) {
    return;
  }

  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const mobileInput = document.getElementById("profile-mobile");
  const addressInput = document.getElementById("profile-address");
  const photoInput = document.getElementById("profile-photo");
  const avatar = document.getElementById("profile-avatar");
  const avatarFallback = document.getElementById("profile-avatar-fallback");
  const saveButton = document.getElementById("profile-save");
  const signOutButton = document.getElementById("profile-signout");
  const status = document.getElementById("profile-status");
  const bucketName = "profile-pictures";
  const maxPhotoBytes = 2 * 1024 * 1024;
  const allowedTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  let client = null;
  let user = null;
  let profile = null;
  let previewUrl = null;
  saveButton.disabled = true;
  signOutButton.disabled = true;

  function setStatus(message) {
    status.textContent = message;
  }

  function showAvatar(url) {
    avatar.src = url;
    avatar.hidden = false;
    avatarFallback.hidden = true;
  }

  function clearAvatar() {
    avatar.hidden = true;
    avatar.removeAttribute("src");
    avatarFallback.hidden = false;
  }

  function releasePreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  async function loadSavedAvatar(path) {
    if (!path) {
      clearAvatar();
      return null;
    }

    const result = await client.storage
      .from(bucketName)
      .createSignedUrl(path, 3600);
    if (result.error) {
      throw result.error;
    }

    showAvatar(result.data.signedUrl);
    return result.data.signedUrl;
  }

  async function loadProfile() {
    const result = await client
      .from("profiles")
      .select("email, contact_phone, full_name, address, mobile_no, avatar_path")
      .eq("id", user.id)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }
    if (!result.data) {
      profile = {
        email: user.email || null,
        full_name: "",
        address: "",
        mobile_no: "",
        avatar_path: null
      };
      emailInput.value = user.email || "";
      nameInput.value = "";
      mobileInput.value = "";
      addressInput.value = "";
      clearAvatar();
      saveButton.disabled = false;
      setStatus("Your profile is ready to complete.");
      return;
    }

    profile = result.data;
    emailInput.value = user.email || profile.email || "";
    nameInput.value = profile.full_name || "";
    mobileInput.value = profile.mobile_no || profile.contact_phone || "";
    addressInput.value = profile.address || "";
    saveButton.disabled = false;

    if (profile.avatar_path) {
      try {
        await loadSavedAvatar(profile.avatar_path);
      } catch (error) {
        console.error("Could not load the saved profile picture:", error);
        setStatus("Profile loaded, but the profile picture is unavailable. Check the Supabase storage setup.");
        return;
      }
    }

    setStatus("Your profile is ready to update.");
  }

  photoInput.addEventListener("change", function () {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(allowedTypes, file.type)) {
      photoInput.value = "";
      setStatus("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > maxPhotoBytes) {
      photoInput.value = "";
      setStatus("Choose an image smaller than 2 MB.");
      return;
    }

    releasePreviewUrl();
    previewUrl = URL.createObjectURL(file);
    showAvatar(previewUrl);
    setStatus("Image preview ready. Save your profile to upload it.");
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.reportValidity() || !client || !user || !profile) {
      return;
    }

    const mobile = mobileInput.value.trim().replace(/[\s()-]/g, "");
    if (mobile && !/^\+[1-9]\d{7,14}$/.test(mobile)) {
      setStatus("Enter the mobile number in international format, such as +91 98765 43210.");
      mobileInput.focus();
      return;
    }

    const photo = photoInput.files && photoInput.files[0];
    if (photo && (!Object.prototype.hasOwnProperty.call(allowedTypes, photo.type) || photo.size > maxPhotoBytes)) {
      setStatus("Choose a JPG, PNG, or WebP image smaller than 2 MB.");
      return;
    }

    saveButton.disabled = true;
    setStatus("Saving your profile…");
    let uploadedPath = null;

    try {
      if (photo) {
        const extension = allowedTypes[photo.type];
        uploadedPath = user.id + "/" + crypto.randomUUID() + "." + extension;
        const uploadResult = await client.storage
          .from(bucketName)
          .upload(uploadedPath, photo, {
            contentType: photo.type,
            cacheControl: "3600",
            upsert: false
          });
        if (uploadResult.error) {
          throw uploadResult.error;
        }
      }

      const updates = {
        id: user.id,
        email: user.email || profile.email || null,
        full_name: nameInput.value.trim(),
        address: addressInput.value.trim() || null,
        mobile_no: mobile || null,
        updated_at: new Date().toISOString()
      };
      if (uploadedPath) {
        updates.avatar_path = uploadedPath;
      }

      const updateResult = await client
        .from("profiles")
        .upsert(updates, { onConflict: "id" })
        .select("id")
        .single();
      if (updateResult.error) {
        throw updateResult.error;
      }

      const oldAvatarPath = profile.avatar_path;
      profile = Object.assign({}, profile, updates);
      photoInput.value = "";

      const notices = [];
      if (uploadedPath) {
        try {
          await loadSavedAvatar(uploadedPath);
        } catch (error) {
          console.error("Profile saved, but the new profile picture could not be displayed:", error);
          clearAvatar();
          notices.push("The profile picture was saved but could not be displayed.");
        }
      }
      releasePreviewUrl();
      if (oldAvatarPath && uploadedPath && oldAvatarPath !== uploadedPath) {
        try {
          const removeResult = await client.storage.from(bucketName).remove([oldAvatarPath]);
          if (removeResult.error) {
            throw removeResult.error;
          }
        } catch (error) {
          console.error("Could not remove the previous profile picture:", error);
          notices.push("The previous profile picture could not be removed.");
        }
      }

      setStatus(notices.length ? "Profile saved. " + notices.join(" ") : "Profile saved.");
    } catch (error) {
      if (uploadedPath) {
        try {
          const cleanupResult = await client.storage.from(bucketName).remove([uploadedPath]);
          if (cleanupResult.error) {
            throw cleanupResult.error;
          }
        } catch (cleanupError) {
          console.error("Could not clean up an unused profile picture:", cleanupError);
        }
      }
      console.error("Could not save the profile:", error);
      setStatus(error.message || "Could not save your profile. Please try again.");
    } finally {
      saveButton.disabled = false;
    }
  });

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
      window.location.replace("index.html");
    } catch (error) {
      console.error("Could not sign out:", error);
      setStatus(error.message || "Could not sign out. Please try again.");
      signOutButton.disabled = false;
    }
  });

  if (!window.R2RAuth) {
    setStatus("Sign-in is unavailable. Please try again later.");
    return;
  }

  window.R2RAuth.ready
    .then(function (authClient) {
      client = authClient;
      user = window.R2RAuth.getUser();
      if (!user) {
        setStatus("Please sign in to access your profile.");
        window.location.replace("index.html#login");
        return;
      }
      signOutButton.disabled = false;
      return loadProfile();
    })
    .catch(function (error) {
      console.error("Could not initialize the account profile:", error);
      setStatus(error.message || "Could not load your profile. Check the Supabase setup and try again.");
    });
}());
