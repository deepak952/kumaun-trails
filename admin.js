(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var config = window.KUMAUN_TRAILS_CONFIG || {};
  var endpoint = config.SUBMIT_ENDPOINT || "";
  var adminPassword = null; // kept in memory only, never persisted
  var treks = [];
  var role = "admin"; // "admin" or "ca" (accountant, read-only CA report only)

  var loginSection = $("admin-login");
  var panel = $("admin-panel");
  var loginStatus = $("loginStatus");
  var listStatus = $("listStatus");
  var trekList = $("trekList");
  var formCard = $("trekFormCard");
  var formTitle = $("trekFormTitle");
  var formStatus = $("formStatus");

  window.KT_ADMIN = {
    $: $,
    endpoint: endpoint,
    escapeHtml: escapeHtml,
    getPassword: function () { return adminPassword; },
    getRole: function () { return role; },
    getTreks: function () { return treks; }
  };

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
    function fail(msg) { loginStatus.className = "form-status show err"; loginStatus.textContent = msg; }
    fetch(endpoint + "?action=adminTreks&password=" + encodeURIComponent(pw))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          adminPassword = pw; role = "admin"; treks = data.treks;
          loginSection.classList.add("hidden");
          panel.classList.remove("hidden");
          renderList();
          loadEnquiries();
          return;
        }
        // Not the admin password: it may be the accountant's.
        return fetch(endpoint + "?action=caBookings&password=" + encodeURIComponent(pw))
          .then(function (res) { return res.json(); })
          .then(function (ca) {
            if (ca && ca.success) {
              adminPassword = pw; role = "ca";
              loginSection.classList.add("hidden");
              panel.classList.remove("hidden");
              applyRole();
            } else {
              fail((data && data.error) || "Wrong password.");
            }
          });
      })
      .catch(function () { fail("Could not reach the server. Check your connection."); });
  });

  // The accountant only gets the Finance > CA report.
  function applyRole() {
    if (role !== "ca") return;
    $("tabTreks").classList.add("hidden");
    $("tabEnquiries").classList.add("hidden");
    $("subBookings").classList.add("hidden");
    document.querySelector(".fin-subtabs").classList.add("hidden");
    showTab("finance");
    $("subCa").click();
  }

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

  // ---------------------------------------------------------------
  // Tabs + Enquiries
  // ---------------------------------------------------------------
  var STATUSES = ["New", "Contacted", "Closed"];
  var enquiries = [];
  var enqLoaded = false;
  var enqFilter = "All";

  var VIEWS = { treks: "treksView", enquiries: "enquiriesView", finance: "financeView" };
  var TABS = { treks: "tabTreks", enquiries: "tabEnquiries", finance: "tabFinance" };
  var TITLES = { treks: "Manage Treks", enquiries: "Enquiries", finance: "Finance" };

  function showTab(name) {
    Object.keys(VIEWS).forEach(function (k) {
      $(VIEWS[k]).classList.toggle("hidden", k !== name);
      $(TABS[k]).setAttribute("aria-selected", String(k === name));
    });
    $("adminTitle").textContent = role === "ca" && name === "finance" ? "Accountant Report" : TITLES[name];
    if (name === "enquiries" && !enqLoaded) loadEnquiries();
    if (name === "finance" && window.KT_FINANCE) window.KT_FINANCE.open();
  }
  $("tabTreks").addEventListener("click", function () { showTab("treks"); });
  $("tabEnquiries").addEventListener("click", function () { showTab("enquiries"); });
  $("tabFinance").addEventListener("click", function () { showTab("finance"); });

  function loadEnquiries() {
    $("enqStatus").textContent = "Loading enquiries…";
    fetch(endpoint + "?action=adminEnquiries&password=" + encodeURIComponent(adminPassword))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          enquiries = data.enquiries;
          enqLoaded = true;
          $("enqStatus").textContent = "";
          renderEnquiries();
        } else if (data && data.ok) {
          // Old Apps Script code answered with its generic ping: not redeployed yet.
          $("enqStatus").textContent = "The backend doesn't know about enquiries yet. Redeploy the Apps Script as a new version (see SETUP.md), then press Refresh.";
        } else {
          $("enqStatus").textContent = (data && data.error) || "Could not load enquiries.";
        }
      })
      .catch(function () { $("enqStatus").textContent = "Could not reach the server."; });
  }

  function whatsappDigits(phone) {
    var d = String(phone).replace(/\D/g, "");
    if (d.length === 10) d = "91" + d;
    return d;
  }

  function formatWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || "");
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    var rel = mins < 1 ? "just now" : mins < 60 ? mins + " min ago" : mins < 1440 ? Math.round(mins / 60) + " h ago" : Math.round(mins / 1440) + " d ago";
    return rel + " · " + d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function renderFilters() {
    var counts = { All: enquiries.length };
    STATUSES.forEach(function (s) { counts[s] = 0; });
    enquiries.forEach(function (e) { if (counts[e.status] !== undefined) counts[e.status]++; });
    $("enqFilters").innerHTML = ["All"].concat(STATUSES).map(function (s) {
      return '<button type="button" class="enq-chip" data-filter="' + s + '" aria-pressed="' + (enqFilter === s) + '">' + s + ' <span>' + counts[s] + '</span></button>';
    }).join("");
    var badge = $("newCount");
    badge.textContent = counts.New;
    badge.classList.toggle("hidden", counts.New === 0);
  }

  function renderEnquiries() {
    renderFilters();
    var q = $("enqSearch").value.trim().toLowerCase();
    var rows = enquiries.filter(function (e) {
      if (enqFilter !== "All" && e.status !== enqFilter) return false;
      if (!q) return true;
      return [e.full_name, e.phone, e.email, e.trek_interest, e.message].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var list = $("enqList");
    if (!rows.length) {
      list.innerHTML = '<p class="body-md">' + (enquiries.length ? "No enquiries match this filter." : "No enquiries yet. They appear here as soon as someone submits the form on the site.") + "</p>";
      return;
    }
    list.innerHTML = rows.map(function (e) {
      var wa = whatsappDigits(e.phone);
      var details = [];
      if (e.preferred_month) details.push("<span><b>When</b> " + escapeHtml(e.preferred_month) + "</span>");
      if (e.group_size) details.push("<span><b>Group</b> " + escapeHtml(e.group_size) + "</span>");
      return '<article class="enq-card enq-' + e.status.toLowerCase() + '">' +
        '<div class="enq-head">' +
          '<div><h3 class="enq-name">' + escapeHtml(e.full_name) + '</h3>' +
          '<div class="enq-when">' + escapeHtml(formatWhen(e.created_at)) + '</div></div>' +
          '<label class="sr-only" for="st' + e.row + '">Status</label>' +
          '<select class="enq-status" id="st' + e.row + '" data-row="' + e.row + '">' +
            STATUSES.map(function (s) { return '<option' + (s === e.status ? " selected" : "") + ">" + s + "</option>"; }).join("") +
          "</select>" +
        "</div>" +
        '<div class="enq-trek">' + escapeHtml(e.trek_interest) + "</div>" +
        (details.length ? '<div class="enq-details">' + details.join("") + "</div>" : "") +
        (e.message ? '<p class="enq-message">' + escapeHtml(e.message) + "</p>" : "") +
        '<div class="enq-contact">' +
          '<span class="enq-phone mono-stat">' + escapeHtml(e.phone) + "</span>" +
          (e.email ? '<span class="enq-email">' + escapeHtml(e.email) + "</span>" : "") +
          '<a class="btn btn-outline mini-btn" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' +
          '<a class="btn btn-outline mini-btn" href="tel:' + escapeHtml(e.phone.replace(/[^\d+]/g, "")) + '">Call</a>' +
        "</div>" +
      "</article>";
    }).join("");
  }

  $("enqFilters").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-filter]");
    if (!b) return;
    enqFilter = b.getAttribute("data-filter");
    renderEnquiries();
  });
  $("enqSearch").addEventListener("input", renderEnquiries);
  $("enqRefresh").addEventListener("click", loadEnquiries);

  $("enqList").addEventListener("change", function (ev) {
    var sel = ev.target.closest(".enq-status");
    if (!sel) return;
    var row = parseInt(sel.getAttribute("data-row"), 10);
    var item = enquiries.filter(function (e) { return e.row === row; })[0];
    if (!item) return;
    var previous = item.status, next = sel.value;
    item.status = next;
    $("enqStatus").textContent = "Saving…";
    fetch(endpoint, { method: "POST", body: JSON.stringify({ action: "updateEnquiryStatus", adminPassword: adminPassword, row: row, phone: item.phone, status: next }) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) { $("enqStatus").textContent = ""; renderEnquiries(); return; }
        item.status = previous;
        $("enqStatus").textContent = (data && data.error) || "Could not save the status.";
        renderEnquiries();
      })
      .catch(function () {
        item.status = previous;
        $("enqStatus").textContent = "Could not reach the server. Status was not saved.";
        renderEnquiries();
      });
  });
})();
