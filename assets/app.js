(function () {
  var D = window.SURVEY_DATA;
  if (!D) return;

  var KEY = "varpick:" + D.id;
  var tbody = document.getElementById("tbody");
  var q = document.getElementById("q");
  var onlySel = document.getElementById("onlySel");
  var showVals = document.getElementById("showVals");
  var countEl = document.getElementById("count");
  var empty = document.getElementById("empty");
  var itemRows = [];
  var rowGroup = [];
  var groups = {};
  var hay = [];
  var activeFile = "";

  var sel = new Set();
  var canStore = true;
  try {
    localStorage.setItem("__probe", "1");
    localStorage.removeItem("__probe");
  } catch (e) { canStore = false; }

  try {
    JSON.parse(localStorage.getItem(KEY) || "[]").forEach(function (n) { sel.add(n); });
  } catch (e) {}

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(sel))); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function display(groupKey) {
    var s = String(groupKey || "");
    return s.indexOf("|") >= 0 ? s.split("|").pop() : s;
  }

  function build() {
    var counts = {};
    var runs = {};
    var prev = null;
    D.items.forEach(function (it) {
      var k = it[4];
      if (k) {
        counts[k] = (counts[k] || 0) + 1;
        if (k !== prev) runs[k] = (runs[k] || 0) + 1;
      }
      prev = k;
    });
    var merge = !!D.mergeGroups;
    function groupable(k) { return k && counts[k] >= 2 && (merge || runs[k] === 1); }
    var html = [];
    var seen = {};
    for (var i = 0; i < D.items.length; i++) {
      var it = D.items[i];
      var name = it[0], label = it[1], vals = it[2], grp = it[3] || "";
      var k = groupable(it[4]) ? it[4] : "";
      if (k && !seen[k]) {
        seen[k] = 1;
        html.push(
          '<tr class="grow" data-g="' + esc(k) + '" data-file="' + esc(grp) + '">' +
            '<td class="c-no"></td>' +
            '<td class="c-pick"><input type="checkbox" class="gpick" aria-label="' +
              esc(display(k)) + ' 전체 선택"></td>' +
            '<td colspan="3" class="gcell"><div class="ginner">' +
              '<button type="button" class="gcaret" aria-label="펼치기"><svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
              '<button type="button" class="gname" title="클릭하면 전체 선택/해제">' +
              '<b>' + esc(display(k)) + "</b>" +
              (D.groupLabels && D.groupLabels[k] ? '<span class="gdesc" title="' + esc(D.groupLabels[k]) + '">' + esc(D.groupLabels[k]) + "</span>" : "") +
              "<span class='gcnt'>" + counts[k] + "개</span></button></div></td>" +
          "</tr>"
        );
      }
      var on = sel.has(name);
      html.push(
        '<tr data-i="' + i + '"' + (k ? ' data-g="' + esc(k) + '"' : "") + (on ? ' class="sel"' : "") + ">" +
          '<td class="c-no">' + (i + 1) + "</td>" +
          '<td class="c-pick"><input type="checkbox" class="pick"' + (on ? " checked" : "") +
            ' aria-label="' + esc(name) + ' 선택"></td>' +
          '<td class="c-var"><code title="클릭하면 변수명이 복사됩니다">' + esc(name) + "</code></td>" +
          '<td class="c-label">' + (grp ? '<span class="grp">' + esc(grp) + "</span>" : "") +
            (label ? esc(label) : '<span class="dim">-</span>') + "</td>" +
          '<td class="c-val">' + (vals ? '<span class="v" title="' + esc(vals) + '">' + esc(vals) + "</span>" : '<span class="dim">-</span>') + "</td>" +
        "</tr>"
      );
      hay.push((name + " " + label + " " + vals + " " + grp).toLowerCase());
    }
    tbody.innerHTML = html.join("");

    itemRows = Array.prototype.slice.call(tbody.querySelectorAll("tr[data-i]"));
    Array.prototype.forEach.call(tbody.querySelectorAll("tr.grow"), function (tr) {
      var key = tr.getAttribute("data-g");
      groups[key] = {
        tr: tr,
        box: tr.querySelector(".gpick"),
        caret: tr.querySelector(".caret"),
        cnt: tr.querySelector(".gcnt"),
        names: [],
        file: tr.getAttribute("data-file") || "",
        collapsed: true
      };
    });
    itemRows.forEach(function (tr, idx) {
      var k = tr.getAttribute("data-g") || "";
      rowGroup[idx] = k;
      if (k && groups[k]) groups[k].names.push(D.items[+tr.getAttribute("data-i")][0]);
    });
    Object.keys(groups).forEach(refreshGroup);
  }

  function refreshGroup(key) {
    var g = groups[key];
    if (!g) return;
    var total = g.names.length, on = 0;
    g.names.forEach(function (n) { if (sel.has(n)) on++; });
    g.box.checked = total > 0 && on === total;
    g.box.indeterminate = on > 0 && on < total;
    if (g.cnt) g.cnt.textContent = on ? on + "/" + total + "개" : total + "개";
  }

  function applyFilter() {
    var term = (q.value || "").trim().toLowerCase();
    var only = onlySel.checked;
    var searching = term.length > 0;
    var shown = 0;
    var gvis = {};

    for (var i = 0; i < itemRows.length; i++) {
      var tr = itemRows[i];
      var it = D.items[+tr.getAttribute("data-i")];
      var k = rowGroup[i] || "";
      var fileOk = !activeFile || (it[3] || "") === activeFile;
      var collapsed = !searching && !only && k && groups[k] && groups[k].collapsed;
      var ok = fileOk && !collapsed &&
               (!term || hay[i].indexOf(term) !== -1) &&
               (!only || tr.classList.contains("sel"));
      tr.style.display = ok ? "" : "none";
      if (ok) {
        shown++;
        if (k) gvis[k] = true;
      }
    }

    var anyGroup = false;
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var fileMatch = !activeFile || g.file === activeFile;
      var show = false;
      if (!searching && fileMatch) {
        if (only) show = g.box.indeterminate || g.box.checked;
        else show = gvis[key] || g.collapsed;
      }
      g.tr.style.display = show ? "" : "none";
      if (show) anyGroup = true;
    });

    empty.classList.toggle("on", shown === 0 && !anyGroup);
    updateCount();
  }

  function updateCount() {
    var shown = itemRows.filter(function (r) { return r.style.display !== "none"; }).length;
    var collapsed = 0;
    var searching = (q.value || "").trim().length > 0;
    if (!searching && !onlySel.checked) {
      Object.keys(groups).forEach(function (k) {
        if (groups[k].collapsed && groups[k].tr.style.display !== "none") collapsed++;
      });
    }
    countEl.innerHTML = "표시 <b>" + shown.toLocaleString() + "</b> / 전체 <b>" +
      D.count.toLocaleString() + "</b>" +
      (collapsed ? " · 접힘 <b>" + collapsed + "</b>그룹" : "") +
      " · 선택 <b>" + sel.size.toLocaleString() + "</b>";
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove("on"); }, 1400);
  }

  build();

  if (D.files && D.files.length > 1) {
    var tabs = document.createElement("div");
    tabs.className = "filetabs";
    var all = document.createElement("button");
    all.type = "button";
    all.className = "on";
    all.innerHTML = "전체 <span class='n'>" + D.count.toLocaleString() + "</span>";
    all.addEventListener("click", function () { setFile("", all); });
    tabs.appendChild(all);
    D.files.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = f.name + " <span class='n'>" + f.count.toLocaleString() + "</span>";
      b.addEventListener("click", function () { setFile(f.name, b); });
      tabs.appendChild(b);
    });
    var card = document.querySelector(".tablecard");
    card.parentNode.insertBefore(tabs, card);
    var setFile = function (name, btn) {
      activeFile = name;
      Array.prototype.forEach.call(tabs.children, function (c) { c.classList.remove("on"); });
      btn.classList.add("on");
      applyFilter();
    };
  }

  applyFilter();

  if (!canStore) {
    var warn = document.createElement("div");
    warn.className = "notice";
    warn.style.margin = "0 0 16px";
    warn.innerHTML = "<strong>이 브라우저에서는 선택이 저장되지 않습니다.</strong> Safari에서 파일을 직접 열면 저장이 막힙니다. Chrome에서 열거나, 폴더에서 <code>python3 -m http.server</code>를 실행해 <code>http://localhost:8000</code>으로 접속하세요. CSV 내보내기는 그대로 됩니다.";
    var tb = document.querySelector(".toolbar");
    tb.parentNode.insertBefore(warn, tb);
  }

  q.addEventListener("input", applyFilter);
  onlySel.addEventListener("change", function () {
    onlySel.closest(".toggle").classList.toggle("on", onlySel.checked);
    applyFilter();
  });

  if (showVals) {
    var want = false;
    try { want = localStorage.getItem("showvals") === "1"; } catch (e) {}
    showVals.checked = want;
    document.body.classList.toggle("show-vals", want);
    showVals.addEventListener("change", function () {
      document.body.classList.toggle("show-vals", showVals.checked);
      try { localStorage.setItem("showvals", showVals.checked ? "1" : "0"); } catch (e) {}
    });
  }

  function setGroup(key, on) {
    var g = groups[key];
    if (!g) return;
    g.names.forEach(function (n) { if (on) sel.add(n); else sel.delete(n); });
    itemRows.forEach(function (r) {
      if (r.getAttribute("data-g") === key) {
        r.classList.toggle("sel", on);
        r.querySelector(".pick").checked = on;
      }
    });
    save();
    refreshGroup(key);
    updateCount();
    if (onlySel.checked) applyFilter();
  }

  tbody.addEventListener("change", function (e) {
    var box = e.target;
    if (box.classList.contains("pick")) {
      var tr = box.closest("tr");
      var idx = itemRows.indexOf(tr);
      var name = D.items[+tr.getAttribute("data-i")][0];
      if (box.checked) { sel.add(name); tr.classList.add("sel"); }
      else { sel.delete(name); tr.classList.remove("sel"); }
      save();
      refreshGroup(rowGroup[idx]);
      updateCount();
      if (onlySel.checked) applyFilter();
    } else if (box.classList.contains("gpick")) {
      setGroup(box.closest("tr").getAttribute("data-g"), box.checked);
    }
  });

  tbody.addEventListener("click", function (e) {
    var caretBtn = e.target.closest(".gcaret");
    if (caretBtn) {
      var key = caretBtn.closest("tr").getAttribute("data-g");
      var g = groups[key];
      if (!g) return;
      g.collapsed = !g.collapsed;
      g.caret.classList.toggle("open", !g.collapsed);
      caretBtn.setAttribute("aria-label", g.collapsed ? "펼치기" : "접기");
      applyFilter();
      return;
    }
    var nameBtn = e.target.closest(".gname");
    if (nameBtn) {
      var gkey = nameBtn.closest("tr").getAttribute("data-g");
      var gg = groups[gkey];
      if (!gg) return;
      setGroup(gkey, !gg.box.checked);
      return;
    }
    var code = e.target.closest(".c-var code");
    if (!code) return;
    var txt = code.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast("복사됨: " + txt); }, function () {});
    }
  });

  var expandBtn = document.getElementById("expandAll");
  if (expandBtn) {
    expandBtn.addEventListener("click", function () {
      var anyCollapsed = Object.keys(groups).some(function (k) { return groups[k].collapsed; });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k];
        g.collapsed = !anyCollapsed;
        g.caret.classList.toggle("open", !g.collapsed);
        var btn = g.tr.querySelector(".gcaret");
        if (btn) btn.setAttribute("aria-label", g.collapsed ? "펼치기" : "접기");
      });
      expandBtn.textContent = anyCollapsed ? "그룹 모두 접기" : "그룹 모두 펼치기";
      applyFilter();
    });
  }

  var csvBtn = document.getElementById("csv");
  if (csvBtn) {
    csvBtn.addEventListener("click", function () {
      if (!sel.size) { toast("먼저 변수를 선택하세요"); return; }
      var hasGrp = D.items.some(function (it) { return it[3]; });
      var lines = [["조사", "연도"].concat(hasGrp ? ["구분"] : []).concat(["변수명", "변수라벨", "값라벨(코드)"]).join(",")];
      function cell(s) {
        s = String(s == null ? "" : s);
        return '"' + s.replace(/"/g, '""') + '"';
      }
      for (var i = 0; i < D.items.length; i++) {
        var it = D.items[i];
        if (!sel.has(it[0])) continue;
        var row = [cell(D.title), cell(D.year)];
        if (hasGrp) row.push(cell(it[3] || ""));
        row.push(cell(it[0]), cell(it[1]), cell(it[2]));
        lines.push(row.join(","));
      }
      var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = D.id + "_selected.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast(sel.size + "개 변수를 CSV로 저장했습니다");
    });
  }

  var clearBtn = document.getElementById("clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!sel.size) return;
      if (!confirm("이 조사에서 선택한 " + sel.size + "개 변수를 모두 해제할까요?")) return;
      sel.clear();
      save();
      itemRows.forEach(function (r) {
        r.classList.remove("sel");
        r.querySelector(".pick").checked = false;
      });
      Object.keys(groups).forEach(refreshGroup);
      updateCount();
      if (onlySel.checked) applyFilter();
    });
  }
})();
