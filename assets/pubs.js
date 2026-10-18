(function () {
  "use strict";

  var filterBar = document.getElementById("pub-filter");
  var searchInput = document.getElementById("pub-search");
  var searchClearBtn = document.getElementById("pub-search-clear");
  var emptyState = document.getElementById("pub-empty");
  var emptyResetBtn = document.getElementById("pub-empty-reset");

  var rows = Array.prototype.slice.call(
    document.querySelectorAll("#publications .pub-row")
  );

  if (!rows.length) return;

  var currentFilter = "all";
  var currentSearch = "";

  // Precompute searchable text on rows for 60fps instant live filtering
  rows.forEach(function (row) {
    var title = row.querySelector(".pub-title-link");
    var authors = row.querySelector(".pub-authors");
    var meta = row.querySelector(".pub-meta");
    var searchStr = [
      title ? title.textContent : "",
      authors ? authors.textContent : "",
      meta ? meta.textContent : "",
      row.getAttribute("data-year") || "",
    ]
      .join(" ")
      .toLowerCase();
    row._searchIndex = searchStr;
  });

  function updateView() {
    var query = currentSearch.trim().toLowerCase();
    var matchCount = 0;

    rows.forEach(function (row) {
      var matchesTab = false;
      if (currentFilter === "all") {
        matchesTab = true;
      } else if (currentFilter === "featured") {
        matchesTab = row.getAttribute("data-featured") === "true";
      } else {
        matchesTab = row.getAttribute("data-year") === currentFilter;
      }

      var matchesQuery = true;
      if (query.length > 0) {
        matchesQuery = row._searchIndex.indexOf(query) !== -1;
      }

      var visible = matchesTab && matchesQuery;
      row.classList.toggle("is-hidden", !visible);
      if (visible) matchCount++;
    });

    // Toggle empty state
    if (emptyState) {
      emptyState.hidden = matchCount > 0;
    }

    // Toggle clear search button
    if (searchClearBtn) {
      searchClearBtn.hidden = query.length === 0;
    }
  }

  /* ---------- Filter Tab Click ---------- */
  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-pill");
      if (!btn) return;
      currentFilter = btn.getAttribute("data-filter") || "all";

      filterBar.querySelectorAll(".filter-pill").forEach(function (p) {
        var isThis = p === btn;
        p.classList.toggle("active", isThis);
        p.setAttribute("aria-selected", isThis ? "true" : "false");
      });

      updateView();
    });
  }

  /* ---------- Live Search Input ---------- */
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      currentSearch = searchInput.value;
      updateView();
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        searchInput.value = "";
        currentSearch = "";
        updateView();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", function () {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      currentSearch = "";
      updateView();
    });
  }

  if (emptyResetBtn) {
    emptyResetBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      currentSearch = "";
      currentFilter = "all";
      if (filterBar) {
        filterBar.querySelectorAll(".filter-pill").forEach(function (p) {
          var isAll = p.getAttribute("data-filter") === "all";
          p.classList.toggle("active", isAll);
          p.setAttribute("aria-selected", isAll ? "true" : "false");
        });
      }
      updateView();
    });
  }
})();
