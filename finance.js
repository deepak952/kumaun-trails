/* Finance tab (Bookings) and CA tab (accountant report) for the admin page.
   Needs admin.js first: it exposes window.KT_ADMIN with the login state. */
(function () {
  "use strict";
  var A = window.KT_ADMIN;
  if (!A) return;
  var $ = A.$, esc = A.escapeHtml;

  var biz = (window.KUMAUN_TRAILS_CONFIG || {}).BUSINESS || {};
  var BUSINESS = { name: biz.NAME || "Kumaun Trails", gstin: biz.GSTIN || "", address: biz.ADDRESS || "" };
  var MODES = ["Cash", "UPI", "Bank transfer", "Card", "Other"];
  var STATUSES = ["Confirmed", "Completed", "Cancelled"];

  var bookings = [];
  var bookingsLoaded = false;
  var caRows = [];
  var caLoaded = false;
  var caFilter = { preset: "month", from: "", to: "", trek: "All" };

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function inr(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return String(s || "");
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function get(action) {
    return fetch(A.endpoint + "?action=" + action + "&password=" + encodeURIComponent(A.getPassword())).then(function (r) { return r.json(); });
  }
  function post(body) {
    body.adminPassword = A.getPassword();
    return fetch(A.endpoint, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  var BACKEND_OLD = "The backend doesn't know about finance yet. Redeploy the Apps Script as a new version, then refresh.";

  var scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error("Could not load " + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  // ---------------------------------------------------------------
  // Sub-tabs
  // ---------------------------------------------------------------
  function showSub(name) {
    var ca = name === "ca";
    $("bookingsPane").classList.toggle("hidden", ca);
    $("caPane").classList.toggle("hidden", !ca);
    $("subBookings").setAttribute("aria-selected", String(!ca));
    $("subCa").setAttribute("aria-selected", String(ca));
    if (ca && !caLoaded) loadCa();
    if (!ca && !bookingsLoaded && A.getRole() === "admin") loadBookings();
  }
  $("subBookings").addEventListener("click", function () { showSub("bookings"); });
  $("subCa").addEventListener("click", function () { showSub("ca"); });

  // ---------------------------------------------------------------
  // Bookings (admin)
  // ---------------------------------------------------------------
  function loadBookings() {
    $("bkStatus").textContent = "Loading bookings…";
    get("adminBookings").then(function (data) {
      if (data && data.success) {
        bookings = data.bookings; bookingsLoaded = true;
        $("bkStatus").textContent = "";
        renderBookings();
      } else if (data && data.ok) {
        $("bkStatus").textContent = BACKEND_OLD;
      } else {
        $("bkStatus").textContent = (data && data.error) || "Could not load bookings.";
      }
    }).catch(function () { $("bkStatus").textContent = "Could not reach the server."; });
  }

  function renderBookings() {
    var wrap = $("bkList");
    if (!bookings.length) {
      wrap.innerHTML = '<p class="body-md">No bookings yet. Click <strong>+ Add Booking</strong> when a client confirms a trek.</p>';
      return;
    }
    wrap.innerHTML = '<div class="fin-scroll"><table class="fin-table"><thead><tr>' +
      "<th>ID</th><th>Date</th><th>Client / Trek</th><th class=\"num\">Total</th><th class=\"num\">Balance</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" + bookings.map(function (b) {
        var bal = b.total - b.amount_paid;
        return "<tr>" +
          '<td class="mono-stat">' + esc(b.id) + "</td>" +
          "<td>" + esc(fmtDate(b.booking_date)) + "</td>" +
          "<td><strong>" + esc(b.client_name) + "</strong><div class=\"fin-sub\">" + esc(b.trek) + (b.travel_date ? " · " + esc(fmtDate(b.travel_date)) : "") + "</div></td>" +
          '<td class="num">' + inr(b.total) + "</td>" +
          '<td class="num ' + (bal > 0 ? "fin-due" : "fin-clear") + '">' + (bal > 0 ? inr(bal) : "Paid") + "</td>" +
          '<td><span class="fin-pill fin-' + esc(b.status.toLowerCase()) + '">' + esc(b.status) + "</span></td>" +
          '<td class="fin-actions"><button type="button" class="btn btn-outline mini-btn" data-bk-edit="' + esc(b.id) + '">Edit</button> ' +
          '<button type="button" class="btn btn-outline mini-btn" data-bk-del="' + esc(b.id) + '">Delete</button></td>' +
          "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function fillTrekSelect(sel, selected) {
    var names = A.getTreks().map(function (t) { return t.name; });
    if (selected && names.indexOf(selected) === -1) names.push(selected);
    sel.innerHTML = names.map(function (n) { return "<option" + (n === selected ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("");
  }

  function field(id) { return $(id); }
  function openBookingForm(b) {
    $("bkFormCard").classList.remove("hidden");
    $("bkFormTitle").textContent = b ? "Edit Booking " + b.id : "Add Booking";
    $("bkId").value = b ? b.id : "";
    fillTrekSelect($("bkTrek"), b ? b.trek : "");
    $("bkDate").value = b ? b.booking_date : ymd(new Date());
    $("bkName").value = b ? b.client_name : "";
    $("bkPhone").value = b ? b.phone : "";
    $("bkTravel").value = b ? b.travel_date : "";
    $("bkGroup").value = b ? b.group_size : 1;
    $("bkSelling").value = b ? b.selling_amount : "";
    $("bkGstRate").value = b ? b.gst_rate : 5;
    $("bkCost").value = b ? b.cost_amount : "";
    $("bkPaid").value = b ? b.amount_paid : "";
    $("bkMode").value = b ? b.payment_mode : "UPI";
    $("bkStatusSel").value = b ? b.status : "Confirmed";
    $("bkNotes").value = b ? b.notes : "";
    $("bkFormStatus").className = "form-status";
    updatePreview();
    $("bkFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeBookingForm() { $("bkFormCard").classList.add("hidden"); }

  function updatePreview() {
    var sell = Math.max(0, Number($("bkSelling").value) || 0);
    var rate = Math.min(100, Math.max(0, Number($("bkGstRate").value) || 0));
    var gst = Math.round(sell * rate) / 100;
    var cost = Math.max(0, Number($("bkCost").value) || 0);
    var paid = Math.max(0, Number($("bkPaid").value) || 0);
    $("bkPreview").innerHTML =
      "<span>GST <b>" + inr(gst) + "</b></span><span>Total <b>" + inr(sell + gst) + "</b></span>" +
      "<span>Balance <b>" + inr(Math.max(0, sell + gst - paid)) + "</b></span><span>Profit <b>" + inr(sell - cost) + "</b></span>";
  }
  ["bkSelling", "bkGstRate", "bkCost", "bkPaid"].forEach(function (id) { $(id).addEventListener("input", updatePreview); });

  $("bkAddBtn").addEventListener("click", function () { openBookingForm(null); });
  $("bkCancelBtn").addEventListener("click", closeBookingForm);

  $("bkList").addEventListener("click", function (ev) {
    var edit = ev.target.closest("[data-bk-edit]"), del = ev.target.closest("[data-bk-del]");
    if (edit) {
      var b = bookings.filter(function (x) { return x.id === edit.getAttribute("data-bk-edit"); })[0];
      if (b) openBookingForm(b);
    } else if (del) {
      var id = del.getAttribute("data-bk-del");
      if (!window.confirm("Delete booking " + id + "? This can't be undone.")) return;
      $("bkStatus").textContent = "Deleting…";
      post({ action: "deleteBooking", id: id }).then(function (data) {
        if (data && data.success) { loadBookings(); caLoaded = false; }
        else $("bkStatus").textContent = (data && data.error) || "Could not delete.";
      }).catch(function () { $("bkStatus").textContent = "Could not reach the server."; });
    }
  });

  $("bkForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("bkFormStatus");
    var id = $("bkId").value;
    var body = {
      action: id ? "updateBooking" : "addBooking", id: id,
      trek: $("bkTrek").value, booking_date: $("bkDate").value, client_name: $("bkName").value.trim(),
      phone: $("bkPhone").value.trim(), travel_date: $("bkTravel").value, group_size: $("bkGroup").value,
      selling_amount: $("bkSelling").value, gst_rate: $("bkGstRate").value, cost_amount: $("bkCost").value,
      amount_paid: $("bkPaid").value, payment_mode: $("bkMode").value, status: $("bkStatusSel").value, notes: $("bkNotes").value.trim()
    };
    if (!body.trek || !body.client_name || body.selling_amount === "") {
      st.className = "form-status show err"; st.textContent = "Trek, client name and selling amount are required."; return;
    }
    var btn = $("bkSaveBtn"); btn.disabled = true; st.className = "form-status show ok"; st.textContent = "Saving…";
    post(body).then(function (data) {
      btn.disabled = false;
      if (data && data.success) {
        st.className = "form-status"; closeBookingForm(); loadBookings(); caLoaded = false;
      } else {
        st.className = "form-status show err"; st.textContent = (data && data.error) || "Could not save the booking.";
      }
    }).catch(function () { btn.disabled = false; st.className = "form-status show err"; st.textContent = "Could not reach the server."; });
  });

  // ---------------------------------------------------------------
  // CA report
  // ---------------------------------------------------------------
  function loadCa() {
    $("caStatus").textContent = "Loading report…";
    get("caBookings").then(function (data) {
      if (data && data.success) {
        caRows = data.bookings; caLoaded = true;
        $("caStatus").textContent = "";
        var sel = $("caTrek"), seen = {};
        caRows.forEach(function (b) { seen[b.trek] = 1; });
        sel.innerHTML = '<option value="All">All treks</option>' + Object.keys(seen).sort().map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
        sel.value = caFilter.trek === "All" || seen[caFilter.trek] ? caFilter.trek : "All";
        renderCa();
      } else if (data && data.ok) {
        $("caStatus").textContent = BACKEND_OLD;
      } else {
        $("caStatus").textContent = (data && data.error) || "Could not load the report.";
      }
    }).catch(function () { $("caStatus").textContent = "Could not reach the server."; });
  }

  function presetRange(p) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    if (p === "month") return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
    if (p === "last") return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    if (p === "three") return [ymd(new Date(y, m - 2, 1)), ymd(new Date(y, m + 1, 0))];
    if (p === "all") return ["", ""];
    return [$("caFrom").value, $("caTo").value];
  }

  function caFiltered() {
    var r = presetRange(caFilter.preset);
    return caRows.filter(function (b) {
      if (r[0] && b.booking_date < r[0]) return false;
      if (r[1] && b.booking_date > r[1]) return false;
      if (caFilter.trek !== "All" && b.trek !== caFilter.trek) return false;
      return true;
    });
  }

  function rangeLabel() {
    var r = presetRange(caFilter.preset);
    return r[0] || r[1] ? (r[0] || "start") + "_to_" + (r[1] || "today") : "All-time";
  }

  function totals(rows) {
    var t = { n: rows.length, revenue: 0, gst: 0, total: 0, cost: 0, profit: 0, paid: 0, balance: 0 };
    rows.forEach(function (b) {
      t.revenue += b.selling_amount; t.gst += b.gst_amount; t.total += b.total; t.cost += b.cost_amount;
      t.paid += b.amount_paid; t.balance += Math.max(0, b.total - b.amount_paid);
    });
    t.profit = t.revenue - t.cost;
    return t;
  }

  function byTrek(rows) {
    var map = {};
    rows.forEach(function (b) { (map[b.trek] = map[b.trek] || []).push(b); });
    return Object.keys(map).sort().map(function (k) { var t = totals(map[k]); t.trek = k; return t; });
  }

  function renderCa() {
    // Preset chips
    var presets = [["month", "This month"], ["last", "Last month"], ["three", "Last 3 months"], ["all", "All time"], ["custom", "Custom"]];
    $("caPresets").innerHTML = presets.map(function (p) {
      return '<button type="button" class="enq-chip" data-preset="' + p[0] + '" aria-pressed="' + (caFilter.preset === p[0]) + '">' + p[1] + "</button>";
    }).join("");
    $("caCustom").classList.toggle("hidden", caFilter.preset !== "custom");

    var rows = caFiltered(), t = totals(rows);
    $("caSummary").innerHTML = [
      ["Bookings", String(t.n)], ["Revenue (excl. GST)", inr(t.revenue)], ["GST collected", inr(t.gst)],
      ["Total billed", inr(t.total)], ["Collected", inr(t.paid)], ["Balance due", inr(t.balance)],
      ["Cost", inr(t.cost)], ["Profit", inr(t.profit)]
    ].map(function (c) { return '<div class="fin-stat"><div class="fin-stat-v">' + c[1] + '</div><div class="fin-stat-l">' + c[0] + "</div></div>"; }).join("");

    if (!rows.length) {
      $("caReport").innerHTML = '<p class="body-md">' + (caRows.length ? "No bookings in this range." : "No bookings have been recorded yet.") + "</p>";
      $("caOrders").innerHTML = "";
      return;
    }
    $("caReport").innerHTML = '<h3 class="fin-h">By trek</h3><div class="fin-scroll"><table class="fin-table"><thead><tr><th>Trek</th>' +
      '<th class="num">Bookings</th><th class="num">Revenue</th><th class="num">GST</th><th class="num">Billed</th><th class="num">Collected</th><th class="num">Balance</th><th class="num">Cost</th><th class="num">Profit</th></tr></thead><tbody>' +
      byTrek(rows).map(function (r) {
        return "<tr><td><strong>" + esc(r.trek) + '</strong></td><td class="num">' + r.n + '</td><td class="num">' + inr(r.revenue) + '</td><td class="num">' + inr(r.gst) +
          '</td><td class="num">' + inr(r.total) + '</td><td class="num">' + inr(r.paid) + '</td><td class="num ' + (r.balance > 0 ? "fin-due" : "") + '">' + inr(r.balance) +
          '</td><td class="num">' + inr(r.cost) + '</td><td class="num">' + inr(r.profit) + "</td></tr>";
      }).join("") + "</tbody></table></div>";

    $("caOrders").innerHTML = '<h3 class="fin-h">Bookings <span class="fin-hint">Click a row to download its invoice</span></h3><div class="fin-scroll"><table class="fin-table fin-click"><thead><tr>' +
      '<th>Invoice no.</th><th>Date</th><th>Trek</th><th class="num">Group</th><th class="num">Revenue</th><th class="num">GST</th><th class="num">Total</th><th class="num">Cost</th><th class="num">Profit</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr tabindex="0" data-inv="' + esc(b.id) + '"><td class="mono-stat">' + esc(b.id) + "</td><td>" + esc(fmtDate(b.booking_date)) + "</td><td>" + esc(b.trek) +
          '</td><td class="num">' + b.group_size + '</td><td class="num">' + inr(b.selling_amount) + '</td><td class="num">' + inr(b.gst_amount) + '</td><td class="num">' + inr(b.total) +
          '</td><td class="num">' + inr(b.cost_amount) + '</td><td class="num">' + inr(b.selling_amount - b.cost_amount) + '</td><td><span class="fin-pill fin-' + esc(b.status.toLowerCase()) + '">' + esc(b.status) + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  $("caPresets").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-preset]");
    if (!b) return;
    caFilter.preset = b.getAttribute("data-preset");
    renderCa();
  });
  $("caFrom").addEventListener("change", renderCa);
  $("caTo").addEventListener("change", renderCa);
  $("caTrek").addEventListener("change", function () { caFilter.trek = this.value; renderCa(); });
  $("caRefresh").addEventListener("click", loadCa);

  // ---------------------------------------------------------------
  // Excel export
  // ---------------------------------------------------------------
  $("caExcel").addEventListener("click", function () {
    var rows = caFiltered();
    if (!rows.length) { $("caStatus").textContent = "Nothing to export in this range."; return; }
    $("caStatus").textContent = "Preparing Excel file…";
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js").then(function () {
      var report = byTrek(rows).map(function (r) {
        return { "Trek": r.trek, "Bookings": r.n, "Revenue (excl. GST)": r.revenue, "GST": r.gst, "Total billed": r.total, "Collected": r.paid, "Balance due": r.balance, "Cost": r.cost, "Profit": r.profit };
      });
      var list = rows.map(function (b) {
        return { "Invoice no.": b.id, "Booking date": b.booking_date, "Trek": b.trek, "Travel date": b.travel_date, "Group size": b.group_size, "Revenue (excl. GST)": b.selling_amount, "GST rate %": b.gst_rate, "GST": b.gst_amount, "Total": b.total, "Cost": b.cost_amount, "Profit": b.selling_amount - b.cost_amount, "Collected": b.amount_paid, "Balance due": Math.max(0, b.total - b.amount_paid), "Payment mode": b.payment_mode, "Status": b.status };
      });
      var wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(report), "Trek report");
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(list), "Bookings");
      window.XLSX.writeFile(wb, "KT-CA-Report_" + rangeLabel() + ".xlsx");
      $("caStatus").textContent = "";
    }).catch(function () { $("caStatus").textContent = "Could not load the Excel library. Check your internet connection."; });
  });

  // ---------------------------------------------------------------
  // PDF invoices. The file is named by the invoice (booking) number and
  // date, never by the GST number.
  // ---------------------------------------------------------------
  function rs(n) { return "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN"); }

  function drawInvoice(doc, b) {
    var W = 148, M = 12, R = W - M;
    doc.setTextColor(30, 42, 34);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(BUSINESS.name.toUpperCase(), M, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(124, 133, 121);
    var y = 23;
    if (BUSINESS.address) { doc.text(doc.splitTextToSize(BUSINESS.address, 70), M, y); y += 4 * Math.min(3, doc.splitTextToSize(BUSINESS.address, 70).length); }
    doc.setTextColor(30, 42, 34); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("TAX INVOICE", R, 18, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(b.id, R, 23, { align: "right" });
    if (BUSINESS.gstin) doc.text("GSTIN: " + BUSINESS.gstin, R, 28, { align: "right" });
    doc.setDrawColor(220, 212, 187); doc.line(M, 36, R, 36);

    function meta(label, value, x, yy, align) {
      doc.setFontSize(7); doc.setTextColor(124, 133, 121); doc.text(label.toUpperCase(), x, yy, { align: align || "left" });
      doc.setFontSize(9.5); doc.setTextColor(30, 42, 34); doc.text(String(value || "-"), x, yy + 5, { align: align || "left" });
    }
    meta("Invoice date", fmtDate(b.booking_date), M, 44);
    meta("Travel date", fmtDate(b.travel_date), W / 2, 44, "center");
    meta("Status", b.status, R, 44, "right");

    // Items
    var top = 62;
    doc.setFontSize(7); doc.setTextColor(124, 133, 121);
    doc.text("DESCRIPTION", M, top); doc.text("GROUP", 100, top, { align: "right" }); doc.text("AMOUNT", R, top, { align: "right" });
    doc.line(M, top + 2, R, top + 2);
    doc.setFontSize(10); doc.setTextColor(30, 42, 34);
    doc.text(doc.splitTextToSize(b.trek, 78), M, top + 8);
    doc.text(String(b.group_size || 1), 100, top + 8, { align: "right" });
    doc.text(rs(b.selling_amount), R, top + 8, { align: "right" });
    doc.line(M, top + 14, R, top + 14);

    // Totals
    var ty = top + 24;
    function row(label, value, bold) {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 12 : 9.5);
      doc.setTextColor(bold ? 30 : 74, bold ? 42 : 87, bold ? 34 : 80);
      doc.text(label, 80, ty); doc.text(value, R, ty, { align: "right" }); ty += bold ? 8 : 6;
    }
    row("Amount (excl. GST)", rs(b.selling_amount));
    row("GST @ " + b.gst_rate + "%", rs(b.gst_amount));
    doc.line(80, ty - 3.5, R, ty - 3.5);
    row("Total", rs(b.total), true);
    row("Amount paid", rs(b.amount_paid));
    row("Balance due", rs(Math.max(0, b.total - b.amount_paid)));

    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(124, 133, 121);
    doc.text("Computer-generated invoice for internal accounting use. Client details omitted.", W / 2, 198, { align: "center" });
  }

  function withPdf(fn) {
    return loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(function () {
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a5" });
      fn(doc);
    });
  }

  function downloadInvoice(id) {
    var b = caRows.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    $("caStatus").textContent = "Preparing invoice…";
    withPdf(function (doc) {
      drawInvoice(doc, b);
      doc.save(b.id + "_" + b.booking_date + ".pdf");
      $("caStatus").textContent = "";
    }).catch(function () { $("caStatus").textContent = "Could not load the PDF library. Check your internet connection."; });
  }

  $("caOrders").addEventListener("click", function (ev) {
    var tr = ev.target.closest("[data-inv]");
    if (tr) downloadInvoice(tr.getAttribute("data-inv"));
  });
  $("caOrders").addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    var tr = ev.target.closest("[data-inv]");
    if (tr) { ev.preventDefault(); downloadInvoice(tr.getAttribute("data-inv")); }
  });

  $("caBulk").addEventListener("click", function () {
    var rows = caFiltered();
    if (!rows.length) { $("caStatus").textContent = "No invoices in this range."; return; }
    $("caStatus").textContent = "Preparing " + rows.length + " invoice" + (rows.length === 1 ? "" : "s") + "…";
    withPdf(function (doc) {
      rows.forEach(function (b, i) { if (i) doc.addPage(); drawInvoice(doc, b); });
      doc.save("KT-Invoices_" + rangeLabel() + ".pdf");
      $("caStatus").textContent = "";
    }).catch(function () { $("caStatus").textContent = "Could not load the PDF library. Check your internet connection."; });
  });

  // ---------------------------------------------------------------
  // Entry points used by admin.js
  // ---------------------------------------------------------------
  window.KT_FINANCE = {
    // Called when the Finance tab is opened (admin) or right after an accountant logs in.
    open: function () {
      if (A.getRole() === "ca") { showSub("ca"); return; }
      if (!bookingsLoaded) loadBookings();
    },
    reset: function () { bookingsLoaded = false; caLoaded = false; }
  };
})();
