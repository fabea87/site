(function () {
  "use strict";

  var filterBar = document.getElementById("pub-filter");
  var searchInput = document.getElementById("pub-search");
  var searchClearBtn = document.getElementById("pub-search-clear");
  var emptyState = document.getElementById("pub-empty");
  var emptyResetBtn = document.getElementById("pub-empty-reset");

  var cards = Array.prototype.slice.call(
    document.querySelectorAll("#publications .pub-card")
  );
  var labels = Array.prototype.slice.call(
    document.querySelectorAll("#publications .year-label")
  );

  if (!cards.length) return;

  var currentFilter = "all";
  var currentSearch = "";

  // Precompute searchable text on cards to ensure 60fps instant search
  cards.forEach(function (card) {
    var title = card.querySelector(".pub-title");
    var authors = card.querySelector(".pub-authors");
    var meta = card.querySelector(".pub-meta");
    var searchStr = [
      title ? title.textContent : "",
      authors ? authors.textContent : "",
      meta ? meta.textContent : "",
      card.getAttribute("data-year") || "",
    ]
      .join(" ")
      .toLowerCase();
    card._searchIndex = searchStr;
  });

  function updateView() {
    var query = currentSearch.trim().toLowerCase();
    var matchCount = 0;

    cards.forEach(function (card) {
      var matchesTab = false;
      if (currentFilter === "all") {
        matchesTab = true;
      } else if (currentFilter === "featured") {
        matchesTab = card.getAttribute("data-featured") === "true";
      } else {
        matchesTab = card.getAttribute("data-year") === currentFilter;
      }

      var matchesQuery = true;
      if (query.length > 0) {
        matchesQuery = card._searchIndex.indexOf(query) !== -1;
      }

      var visible = matchesTab && matchesQuery;
      card.classList.toggle("is-hidden", !visible);
      if (visible) matchCount++;
    });

    // Update year labels visibility
    labels.forEach(function (label) {
      var y = label.getAttribute("data-year");
      var hasVisible = cards.some(function (c) {
        return (
          c.getAttribute("data-year") === y && !c.classList.contains("is-hidden")
        );
      });
      label.classList.toggle("is-hidden", !hasVisible);
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
      if (!btn || btn.id === "bib-download") return;
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

  /* ---------- Download BibTeX ---------- */
  var downloadBtn = document.getElementById("bib-download");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      var parts = [];
      // Download BibTeX for currently matching/visible publications (or all if all)
      cards.forEach(function (card) {
        if (!card.classList.contains("is-hidden")) {
          var code = card.querySelector(".bib code");
          if (code) parts.push(code.textContent);
        }
      });
      if (!parts.length) {
        // Fallback to all if none visible
        document.querySelectorAll("#publications .bib code").forEach(function (c) {
          parts.push(c.textContent);
        });
      }
      if (!parts.length) return;

      var blob = new Blob([parts.join("\n\n")], {
        type: "text/plain;charset=utf-8",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "da-yan-publications.bib";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    });
  }
})();
