(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var config = window.KUMAUN_TRAILS_CONFIG || {};
  var endpoint = config.SUBMIT_ENDPOINT || "";
  var adminPassword = null; // kept in memory only, never persisted
  var treks = [];

  var loginSection = $("admin-login");
  var panel = $("admin-panel");
  var loginStatus = $("loginStatus");
  var listStatus = $("listStatus");
  var trekList = $("trekList");
  var formCard = $("trekFormCard");
  var formTitle = $("trekFormTitle");
  var formStatus = $("formStatus");

  function isConfigured() {
    return endpoint && endpoint.indexOf("PASTE_YOUR_APPS_SCRIPT") === -1;
  }

  // ---------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("adminPassword").value;
    if (!pw) return;

    if (!isConfigured()) {
      loginStatus.className = "form-status show err";
      loginStatus.textContent = "Backend isn't connected yet (app/config.js still has the placeholder URL) — the admin panel needs the real backend to manage treks.";
      return;
    }

    loginStatus.className = "form-status";
    fetch(endpoint + "?action=adminTreks&password=" + encodeURIComponent(pw))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          adminPassword = pw;
          treks = data.treks;
          loginSection.classList.add("hidden");
          panel.classList.remove("hidden");
          renderList();
        } else {
          loginStatus.className = "form-status show err";
          loginStatus.textContent = (data && data.error) || "Wrong password.";
        }
      })
      .catch(function () {
        loginStatus.className = "form-status show err";
        loginStatus.textContent = "Could not reach the server. Check your connection.";
      });
  });

  // ---------------------------------------------------------------
  // Trek list
  // ---------------------------------------------------------------
  function renderList() {
    trekList.innerHTML = "";
    if (treks.length === 0) {
      trekList.innerHTML = '<p class="body-md">No treks yet — add your first one above.</p>';
      return;
    }
    treks.forEach(function (trek) {
      var row = document.createElement("div");
      row.className = "admin-trek-row";
      var difficultyClass = "status-" + trek.difficulty.toLowerCase();
      row.innerHTML =
        '<div class="admin-trek-info">' +
          '<div class="admin-trek-name">' + escapeHtml(trek.name) + (trek.active ? "" : ' <span class="admin-inactive-tag">Inactive</span>') + "</div>" +
          '<div class="admin-trek-meta">' + escapeHtml(trek.region || "") + " · " + (trek.duration_days ? trek.duration_days + " days" : "") + "</div>" +
        "</div>" +
        '<span class="status-badge ' + difficultyClass + '"><span class="dot"></span>' + escapeHtml(trek.difficulty) + "</span>" +
        '<div class="admin-trek-actions">' +
          '<button type="button" class="btn btn-outline mini-btn" data-edit="' + trek.id + '">Edit</button>' +
          '<button type="button" class="btn btn-outline mini-btn" data-delete="' + trek.id + '">Delete</button>' +
        "</div>";
      trekList.appendChild(row);
    });

    trekList.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () { openForm(findTrek(btn.getAttribute("data-edit"))); });
    });
    trekList.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteTrek(btn.getAttribute("data-delete")); });
    });
  }

  function findTrek(id) {
    for (var i = 0; i < treks.length; i++) if (treks[i].id === id) return treks[i];
    return null;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function refreshTreks() {
    return fetch(endpoint + "?action=adminTreks&password=" + encodeURIComponent(adminPassword))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) { treks = data.treks; renderList(); }
      });
  }

  // ---------------------------------------------------------------
  // Add / edit form
  // ---------------------------------------------------------------
  $("showAddFormBtn").addEventListener("click", function () { openForm(null); });
  $("cancelFormBtn").addEventListener("click", closeForm);

  var currentEditingTrekId = null;

  function openForm(trek) {
    formStatus.className = "form-status";
    if (trek) {
      currentEditingTrekId = trek.id;
      formTitle.textContent = "Edit Trek";
      $("trekId").value = trek.id;
      $("trekName").value = trek.name;
      $("trekRegion").value = trek.region || "";
      $("trekDifficulty").value = trek.difficulty;
      $("trekDuration").value = trek.duration_days || "";
      $("trekElevation").value = trek.elevation_profile || "";
      $("trekStartLabel").value = trek.start_label || "";
      $("trekPeakLabel").value = trek.peak_label || "";
      $("trekBlurb").value = trek.blurb || "";
      $("trekActive").checked = trek.active;
      $("photoNewNotice").classList.add("hidden");
      $("photoManager").classList.remove("hidden");
      renderPhotoThumbs(trek.photos || []);
    } else {
      currentEditingTrekId = null;
      formTitle.textContent = "Add Trek";
      $("trekForm").reset();
      $("trekId").value = "";
      $("trekActive").checked = true;
      $("photoManager").classList.add("hidden");
      $("photoNewNotice").classList.remove("hidden");
    }
    formCard.classList.remove("hidden");
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    formCard.classList.add("hidden");
  }

  $("trekForm").addEventListener("submit", function (e) {
    e.preventDefault();

    var name = $("trekName").value.trim();
    var elevation = $("trekElevation").value.trim();
    var parts = elevation.split(",").map(function (s) { return s.trim(); }).filter(String);
    if (!name) {
      formStatus.className = "form-status show err";
      formStatus.textContent = "Please enter a trek name.";
      return;
    }
    if (parts.length < 2 || parts.some(function (n) { return isNaN(Number(n)); })) {
      formStatus.className = "form-status show err";
      formStatus.textContent = "Elevation profile needs at least two numbers, comma-separated (e.g. 1600,3820).";
      return;
    }

    var id = $("trekId").value;
    var payload = {
      action: id ? "updateTrek" : "addTrek",
      adminPassword: adminPassword,
      id: id || undefined,
      name: name,
      region: $("trekRegion").value.trim(),
      difficulty: $("trekDifficulty").value,
      duration_days: $("trekDuration").value ? parseInt($("trekDuration").value, 10) : "",
      elevation_profile: elevation,
      start_label: $("trekStartLabel").value.trim(),
      peak_label: $("trekPeakLabel").value.trim(),
      blurb: $("trekBlurb").value.trim(),
      active: $("trekActive").checked
    };

    var saveBtn = $("saveTrekBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    fetch(endpoint, { method: "POST", body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Trek";
        if (data && data.success) {
          closeForm();
          refreshTreks();
        } else {
          formStatus.className = "form-status show err";
          formStatus.textContent = (data && data.error) || "Something went wrong saving that trek.";
        }
      })
      .catch(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Trek";
        formStatus.className = "form-status show err";
        formStatus.textContent = "Could not reach the server. Please try again.";
      });
  });

  // ---------------------------------------------------------------
  // Trek photos
  // ---------------------------------------------------------------
  function renderPhotoThumbs(photos) {
    var wrap = $("photoThumbs");
    wrap.innerHTML = photos.map(function (photo) {
      return '<div class="photo-thumb"><img referrerpolicy="no-referrer" src="' + photo.url + '" alt="" />' +
        '<button type="button" class="photo-thumb-remove" data-photo-id="' + photo.id + '" aria-label="Remove photo">&times;</button></div>';
    }).join("");
    wrap.querySelectorAll("[data-photo-id]").forEach(function (btn) {
      btn.addEventListener("click", function () { deletePhoto(btn.getAttribute("data-photo-id")); });
    });
  }

  $("addPhotoBtn").addEventListener("click", function () { $("photoFileInput").click(); });

  // Every uploaded photo is compressed in the browser before it is sent:
  // longest side capped at MAX_SIDE, re-encoded as JPEG. A 4MB phone photo
  // becomes roughly 300-600KB, so the public gallery loads fast.
  var MAX_SIDE = 1920;
  var JPEG_QUALITY = 0.82;
  var MAX_INPUT_BYTES = 25 * 1024 * 1024;

  function compressImage(file) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // flatten PNG transparency instead of turning it black
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("compress")); }, "image/jpeg", JPEG_QUALITY);
      });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result.split(",")[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function uploadOnePhoto(file) {
    return compressImage(file).then(function (blob) {
      return blobToBase64(blob).then(function (base64) {
        return fetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            action: "addTrekPhoto",
            adminPassword: adminPassword,
            trekId: currentEditingTrekId,
            photoBase64: base64,
            photoMime: "image/jpeg"
          })
        });
      });
    }).then(function (res) { return res.json(); });
  }

  $("photoFileInput").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = "";
    if (!files.length || !currentEditingTrekId) return;

    var uploadStatus = $("photoUploadStatus");
    var allowed = ["image/jpeg", "image/png"];
    var bad = files.filter(function (f) { return allowed.indexOf(f.type) === -1; });
    if (bad.length) { uploadStatus.textContent = "Please choose JPG or PNG files only."; return; }
    var big = files.filter(function (f) { return f.size > MAX_INPUT_BYTES; });
    if (big.length) { uploadStatus.textContent = "A file is over 25MB. Please pick a smaller one."; return; }

    // One at a time, so a long batch doesn't overload the Apps Script.
    var done = 0, failed = 0, lastError = "";
    function next() {
      if (done + failed === files.length) {
        uploadStatus.textContent = failed ? (failed + " of " + files.length + " failed. " + lastError) : "";
        refreshPhotosForCurrentTrek();
        return;
      }
      uploadStatus.textContent = "Compressing and uploading " + (done + failed + 1) + " of " + files.length + "…";
      uploadOnePhoto(files[done + failed]).then(function (data) {
        if (data && data.success) done++; else { failed++; lastError = (data && data.error) || "Upload failed."; }
      }).catch(function () {
        failed++; lastError = "Could not reach the server.";
      }).then(next);
    }
    next();
  });

  function deletePhoto(photoId) {
    if (!window.confirm("Remove this photo?")) return;
    fetch(endpoint, { method: "POST", body: JSON.stringify({ action: "deleteTrekPhoto", adminPassword: adminPassword, photoId: photoId }) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) refreshPhotosForCurrentTrek();
        else $("photoUploadStatus").textContent = (data && data.error) || "Could not remove that photo.";
      })
      .catch(function () {
        $("photoUploadStatus").textContent = "Could not reach the server.";
      });
  }

  function refreshPhotosForCurrentTrek() {
    refreshTreks().then(function () {
      var trek = findTrek(currentEditingTrekId);
      if (trek) renderPhotoThumbs(trek.photos || []);
    });
  }

  // ---------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------
  function deleteTrek(id) {
    var trek = findTrek(id);
    if (!trek) return;
    if (!window.confirm('Delete "' + trek.name + '"? This can\'t be undone.')) return;

    listStatus.textContent = "Deleting…";
    fetch(endpoint, { method: "POST", body: JSON.stringify({ action: "deleteTrek", adminPassword: adminPassword, id: id }) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        listStatus.textContent = "";
        if (data && data.success) {
          refreshTreks();
        } else {
          listStatus.textContent = (data && data.error) || "Could not delete that trek.";
        }
      })
      .catch(function () {
        listStatus.textContent = "Could not reach the server.";
      });
  }
})();
