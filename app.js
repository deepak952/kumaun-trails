(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Used if the backend can't be reached (not configured yet, or offline) —
  // same four treks the site launched with, so it never shows up empty.
  var FALLBACK_TREKS = [
    { name: "Pindari Glacier Trek", region: "Bageshwar District", difficulty: "Moderate", duration_days: 8, elevation_profile: "1600,1780,2680,2210,2570,3260,3820", start_label: "Song · 1,600m", peak_label: "Glacier · ~3,820m", blurb: "Kumaun's classic first high-altitude trek — oak and rhododendron forest giving way to open ground beneath Nanda Devi's eastern wall." },
    { name: "Kafni Glacier Trek", region: "Bageshwar District", difficulty: "Difficult", duration_days: 7, elevation_profile: "1600,1780,2680,2210,2570,3400,3853", start_label: "Song · 1,600m", peak_label: "Glacier · ~3,853m", blurb: "Shares Pindari's Dhakuri ridge, then breaks off for a steeper push to a glacier far fewer trekkers ever reach." },
    { name: "Sunderdhunga Valley Trek", region: "Bageshwar District", difficulty: "Difficult", duration_days: 9, elevation_profile: "1500,2600,3200,3300,3900,3950", start_label: "Saung · 1,500m", peak_label: "Glacier · ~3,950m", blurb: "A remote, technical valley beneath Panwali Dwar and Maiktoli — river crossings and exposed ridgeline. Not a first glacier trek." },
    { name: "Milam Glacier Trek", region: "Pithoragarh District", difficulty: "Strenuous", duration_days: 12, elevation_profile: "2200,1800,2500,2760,3390,3450,3600", start_label: "Munsiyari · 2,200m", peak_label: "Glacier · ~3,600m", blurb: "The old trade route to Tibet through the Gori Ganga valley. Inner Line Permit country — long approach, high reward." }
  ];

  // Normalizes an elevation array into sparkline coordinates (x: 0-200
  // evenly spaced by index, y: 6-52 inverted so higher elevation = smaller
  // y). Locates the peak dot by actual max value, not just the last point,
  // so profiles where the peak isn't the final waypoint still work.
  function buildSparkline(elevations) {
    var min = Math.min.apply(null, elevations);
    var max = Math.max.apply(null, elevations);
    var range = max - min || 1;
    var n = elevations.length;
    var coords = elevations.map(function (el, i) {
      var x = n > 1 ? Math.round((i / (n - 1)) * 200) : 200;
      var y = Math.round(52 - ((el - min) / range) * 46);
      return { x: x, y: y };
    });
    var peak = coords[elevations.indexOf(max)];
    var lineStr = coords.map(function (c) { return c.x + "," + c.y; }).join(" ");
    return { lineStr: lineStr, areaStr: lineStr + " 200,60 0,60", peakX: peak.x, peakY: peak.y };
  }

  // Drive thumbnail URLs take a width in their sz param; request what each
  // surface needs instead of always pulling the 1600px original.
  function sized(url, w) {
    return /drive\.google\.com\/thumbnail/.test(url) ? String(url).replace(/([?&])sz=[^&]*/, "$1sz=w" + w) : url;
  }

  var ICON_PHOTO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor"/><path d="M3 16l5-4 4 3 4-5 5 6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  // Swipeable photo carousel at the top of a trek card. Slides are plain
  // scroll-snap items, so touch swipe and trackpad scroll work natively.
  function carouselHtml(trek) {
    var photos = trek.photos, many = photos.length > 1;
    var slides = photos.map(function (p, i) {
      return '<div class="carousel-slide"><img referrerpolicy="no-referrer" src="' + escapeHtml(sized(p.url, 800)) + '" alt="" ' + (i === 0 ? '' : 'loading="lazy" ') + 'draggable="false" onload="this.classList.add(\'loaded\')" onerror="this.classList.add(\'loaded\')"></div>';
    }).join('');
    var dots = many ? '<div class="carousel-dots">' + photos.map(function (p, i) {
      return '<button type="button" class="carousel-dot" data-dot="' + i + '" aria-label="Show photo ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('') + '</div>' : '';
    var arrows = many ?
      '<button type="button" class="carousel-arrow carousel-prev" aria-label="Previous photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="carousel-arrow carousel-next" aria-label="Next photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : '';
    return '<div class="trek-cover carousel"><div class="carousel-track">' + slides + '</div>' + arrows + dots +
      '<span class="photo-badge">' + ICON_PHOTO + photos.length + (photos.length === 1 ? ' photo' : ' photos') + '</span></div>';
  }

  function trekCardHtml(trek, index) {
    var elevations = String(trek.elevation_profile).split(",").map(function (s) { return Number(s.trim()); });
    // Sheets can corrupt a comma-separated list into one huge number (e.g. 1.6e+27);
    // skip the graph rather than draw nonsense, until the trek is re-saved in admin.
    var validProfile = elevations.length >= 2 && elevations.every(function (n) { return isFinite(n) && n > 0 && n < 9000; });
    var spark = validProfile ? buildSparkline(elevations) : null;
    var difficultyClass = "status-" + String(trek.difficulty || "moderate").toLowerCase();
    var name = escapeHtml(trek.name);
    var hasPhotos = trek.photos && trek.photos.length > 0;
    return (
      '<article class="trek-card' + (hasPhotos ? ' has-gallery' : '') + '"' + (hasPhotos ? ' data-gallery-index="' + index + '" tabindex="0" role="button" aria-label="View photos for ' + name + '"' : '') + '>' +
        (hasPhotos ? carouselHtml(trek) : '') +
        '<div class="trek-card-head">' +
          '<div><h3 class="trek-name">' + name + '</h3>' +
          '<div class="trek-region">' + escapeHtml(trek.region) + '</div></div>' +
          '<span class="status-badge ' + difficultyClass + '"><span class="dot"></span>' + escapeHtml(trek.difficulty) + '</span>' +
        '</div>' +
        (validProfile ? '<div class="sparkline-wrap">' +
          '<svg viewBox="0 0 200 60" role="img" aria-label="Elevation profile for ' + name + '">' +
            '<polygon points="' + spark.areaStr + '" fill="#1F6E73" opacity="0.1"/>' +
            '<polyline points="' + spark.lineStr + '" fill="none" stroke="#1F6E73" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<circle cx="' + spark.peakX + '" cy="' + spark.peakY + '" r="5" fill="#F2EEE1"/>' +
            '<circle cx="' + spark.peakX + '" cy="' + spark.peakY + '" r="3.5" fill="#1F6E73"/>' +
          '</svg>' +
          '<div class="sparkline-caption"><span>' + escapeHtml(trek.start_label) + '</span><span>' + escapeHtml(trek.peak_label) + '</span></div>' +
        '</div>' : '') +
        '<div class="trek-meta">' + (trek.duration_days ? '<span><strong>' + trek.duration_days + '</strong> days</span>' : '') + '</div>' +
        '<p class="trek-blurb">' + escapeHtml(trek.blurb) + '</p>' +
        '<a href="#enquire" class="btn btn-outline btn-block" data-trek="' + name + '">Enquire</a>' +
      '</article>'
    );
  }

  var currentTreks = [];

  function renderTreks(treks) {
    currentTreks = treks || [];
    var grid = $("trekGrid");
    if (!treks || treks.length === 0) {
      grid.innerHTML = '<p class="body-md">No treks listed right now — check back soon.</p>';
      return;
    }
    grid.innerHTML = treks.map(trekCardHtml).join("");
    attachEnquireHandlers();
    attachCarousels();
    attachGalleryTriggers();
  }

  function carouselIndex(track) {
    return Math.max(0, Math.round(track.scrollLeft / (track.clientWidth || 1)));
  }

  function attachCarousels() {
    document.querySelectorAll(".carousel").forEach(function (car) {
      var track = car.querySelector(".carousel-track");
      var dots = car.querySelectorAll(".carousel-dot");
      var count = track.children.length;
      function go(i) {
        i = (i + count) % count;
        track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
      }
      track.addEventListener("scroll", function () {
        var i = carouselIndex(track);
        dots.forEach(function (d, k) { if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      }, { passive: true });
      var prev = car.querySelector(".carousel-prev"), next = car.querySelector(".carousel-next");
      // Controls act on the carousel only; they must not open the gallery.
      if (prev) prev.addEventListener("click", function (e) { e.stopPropagation(); go(carouselIndex(track) - 1); });
      if (next) next.addEventListener("click", function (e) { e.stopPropagation(); go(carouselIndex(track) + 1); });
      dots.forEach(function (d) {
        d.addEventListener("click", function (e) { e.stopPropagation(); go(parseInt(d.getAttribute("data-dot"), 10)); });
      });
    });
  }

  function attachEnquireHandlers() {
    document.querySelectorAll("[data-trek]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.stopPropagation(); // don't also trigger the card's gallery-open handler
        var select = $("trekInterest");
        if (select) select.value = link.getAttribute("data-trek");
      });
    });
  }

  // The whole card is clickable (when it has photos) so "click the trek"
  // opens its gallery — the Enquire button inside stops its own click from
  // bubbling up to this (see attachEnquireHandlers), so it still just
  // navigates to the form as normal.
  function attachGalleryTriggers() {
    document.querySelectorAll("[data-gallery-index]").forEach(function (card) {
      var open = function () {
        var track = card.querySelector(".carousel-track");
        openGallery(currentTreks[parseInt(card.getAttribute("data-gallery-index"), 10)], card, track ? carouselIndex(track) : 0);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  // ---------------------------------------------------------------
  // Photo gallery lightbox
  // ---------------------------------------------------------------
  var galleryModal = $("galleryModal");
  var galleryImage = $("galleryImage");
  var galleryCounter = $("galleryCounter");
  var galleryName = $("galleryName");
  var galleryBlurb = $("galleryBlurb");
  var galleryThumbs = $("galleryThumbs");
  var gallerySpinner = $("gallerySpinner");
  var galleryError = $("galleryError");
  var galleryStage = $("galleryStage");
  var galleryPhotos = [];
  var galleryIndex = 0;
  var galleryOpener = null;
  var galleryToken = 0;
  var galleryTrekName = "";

  function openGallery(trek, opener, startIndex) {
    if (!trek || !trek.photos || trek.photos.length === 0) return;
    galleryPhotos = trek.photos;
    galleryOpener = opener || null;
    galleryTrekName = trek.name;
    galleryName.textContent = trek.name;
    galleryBlurb.textContent = trek.blurb || "";
    galleryModal.classList.toggle("single", galleryPhotos.length < 2);
    galleryThumbs.innerHTML = galleryPhotos.map(function (p, i) {
      return '<button type="button" class="gallery-thumb" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + '"><img referrerpolicy="no-referrer" src="' + escapeHtml(sized(p.url, 200)) + '" alt="" loading="lazy"></button>';
    }).join("");
    galleryModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    showGalleryPhoto(startIndex || 0);
    $("galleryCloseBtn").focus();
  }

  function preload(i) {
    var p = galleryPhotos[(i + galleryPhotos.length) % galleryPhotos.length];
    if (p) { var im = new Image(); im.referrerPolicy = "no-referrer"; im.src = sized(p.url, 1600); }
  }

  function showGalleryPhoto(i) {
    galleryIndex = (i + galleryPhotos.length) % galleryPhotos.length;
    var token = ++galleryToken;
    var url = sized(galleryPhotos[galleryIndex].url, 1600);
    galleryError.classList.add("hidden");
    galleryImage.classList.add("loading");
    gallerySpinner.classList.remove("hidden");
    var probe = new Image();
    probe.referrerPolicy = "no-referrer";
    probe.onload = function () {
      if (token !== galleryToken) return;
      galleryImage.src = url;
      galleryImage.classList.remove("loading");
      gallerySpinner.classList.add("hidden");
    };
    probe.onerror = function () {
      if (token !== galleryToken) return;
      gallerySpinner.classList.add("hidden");
      galleryError.classList.remove("hidden");
    };
    probe.src = url;
    galleryImage.alt = galleryName.textContent + " - photo " + (galleryIndex + 1) + " of " + galleryPhotos.length;
    galleryCounter.textContent = (galleryIndex + 1) + " / " + galleryPhotos.length;
    Array.prototype.forEach.call(galleryThumbs.children, function (t, k) {
      if (k === galleryIndex) {
        t.setAttribute("aria-current", "true");
        // Scroll only the thumbnail strip, never the page.
        galleryThumbs.scrollLeft = t.offsetLeft - (galleryThumbs.clientWidth - t.offsetWidth) / 2;
      } else {
        t.removeAttribute("aria-current");
      }
    });
    if (galleryPhotos.length > 1) { preload(galleryIndex + 1); preload(galleryIndex - 1); }
  }

  function closeGallery() {
    galleryToken++;
    galleryModal.classList.add("hidden");
    galleryImage.removeAttribute("src");
    document.body.style.overflow = "";
    if (galleryOpener && galleryOpener.focus) galleryOpener.focus({ preventScroll: true });
  }

  function galleryNext() { showGalleryPhoto(galleryIndex + 1); }
  function galleryPrev() { showGalleryPhoto(galleryIndex - 1); }

  $("galleryEnquire").addEventListener("click", function () {
    var select = $("trekInterest");
    if (select) select.value = galleryTrekName;
    closeGallery();
  });
  $("galleryCloseBtn").addEventListener("click", closeGallery);
  $("galleryNextBtn").addEventListener("click", galleryNext);
  $("galleryPrevBtn").addEventListener("click", galleryPrev);
  galleryThumbs.addEventListener("click", function (e) {
    var b = e.target.closest(".gallery-thumb");
    if (b) showGalleryPhoto(parseInt(b.getAttribute("data-i"), 10));
  });
  // A click on the dark area around the photo closes; the photo and buttons don't.
  galleryStage.addEventListener("click", function (e) {
    if (e.target === galleryStage) closeGallery();
  });

  // Swipe left/right on touch screens.
  var touchX = null, touchY = null;
  galleryStage.addEventListener("touchstart", function (e) {
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  galleryStage.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) galleryNext(); else galleryPrev(); }
  }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (galleryModal.classList.contains("hidden")) return;
    if (e.key === "Escape") closeGallery();
    else if (e.key === "ArrowRight") galleryNext();
    else if (e.key === "ArrowLeft") galleryPrev();
    else if (e.key === "Home") showGalleryPhoto(0);
    else if (e.key === "End") showGalleryPhoto(galleryPhotos.length - 1);
    else if (e.key === "Tab") {
      // Keep focus inside the dialog while it is open.
      var f = Array.prototype.filter.call(galleryModal.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  (function loadTreks() {
    var config = window.KUMAUN_TRAILS_CONFIG || {};
    var endpoint = config.SUBMIT_ENDPOINT || "";
    var isDemo = !endpoint || endpoint.indexOf("PASTE_YOUR_APPS_SCRIPT") !== -1;

    if (isDemo) {
      renderTreks(FALLBACK_TREKS);
      return;
    }

    // Stale-while-revalidate: show the last good trek list immediately, then
    // refresh from the Sheet (Apps Script can take 1-3s to respond).
    var CACHE_KEY = "kumaun_treks_v1";
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) {}
    var rendered = false;
    if (cached && cached.length) { renderTreks(cached); rendered = true; }

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);

    fetch(endpoint + "?action=treks", ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        clearTimeout(timer);
        if (data && data.success && data.treks.length) {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data.treks)); } catch (e) {}
          // Re-render only when something changed, so the page doesn't flicker.
          if (!rendered || JSON.stringify(data.treks) !== JSON.stringify(cached)) renderTreks(data.treks);
        } else if (!rendered) {
          renderTreks(FALLBACK_TREKS);
        }
      })
      .catch(function () {
        clearTimeout(timer);
        if (!rendered) renderTreks(FALLBACK_TREKS);
      });
  })();

  // ---------------------------------------------------------------
  // Enquiry form submission
  // ---------------------------------------------------------------
  var form = $("enquiry-form");
  var submitBtn = $("submitBtn");
  var statusEl = $("formStatus");

  function showStatus(kind, message) {
    statusEl.textContent = message;
    statusEl.className = "form-status show " + kind;
  }

  function digitsOnly(value) {
    return (value || "").replace(/\D/g, "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var fullName = $("fullName").value.trim();
    var phone = $("phone").value.trim();
    var phoneDigits = digitsOnly(phone);

    if (!fullName) {
      showStatus("err", "Please enter your name.");
      $("fullName").focus();
      return;
    }
    if (phoneDigits.length < 10) {
      showStatus("err", "Please enter a valid phone number.");
      $("phone").focus();
      return;
    }

    var payload = {
      full_name: fullName,
      phone: phone,
      email: $("email").value.trim() || null,
      trek_interest: $("trekInterest").value,
      preferred_month: $("preferredMonth").value.trim() || null,
      group_size: $("groupSize").value ? parseInt($("groupSize").value, 10) : null,
      message: $("message").value.trim() || null
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    statusEl.className = "form-status";

    var config = window.KUMAUN_TRAILS_CONFIG || {};
    var endpoint = config.SUBMIT_ENDPOINT || "";
    var isDemo = !endpoint || endpoint.indexOf("PASTE_YOUR_APPS_SCRIPT") !== -1;

    if (isDemo) {
      // Demo mode: no backend configured yet, simulate success so the flow
      // can still be reviewed end-to-end.
      setTimeout(function () {
        finishSubmit(true, "Demo mode: this enquiry wasn't actually saved (backend isn't connected yet). The form itself works end-to-end.");
        form.reset();
      }, 800);
      return;
    }

    // text/plain avoids a CORS preflight, which Apps Script Web Apps don't
    // handle — the server still parses it as JSON regardless of the
    // declared content type.
    fetch(endpoint, { method: "POST", body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          finishSubmit(true, "Thanks, " + fullName.split(" ")[0] + " — we've got your enquiry and will reply within 24–48 hours.");
          form.reset();
        } else {
          finishSubmit(false, (data && data.error) || "Something went wrong sending that — please try again, or WhatsApp us directly.");
        }
      })
      .catch(function () {
        finishSubmit(false, "Could not reach the server. Please check your connection and try again.");
      });
  });

  function finishSubmit(ok, message) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Enquiry";
    showStatus(ok ? "ok" : "err", message);
  }
})();
