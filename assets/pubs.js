(function () {
  "use strict";

  var filterBar = document.getElementById("pub-filter");
  var searchInput = document.getElementById("pub-search");
  var searchClearBtn = document.getElementById("pub-search-clear");
  var emptyState = document.getElementById("pub-empty");
  var emptyResetBtn = document.getElementById("pub-empty-reset");
  var pubFoldToggle = document.getElementById("pub-fold-toggle");
  var talkFoldToggle = document.getElementById("talk-fold-toggle");

  var cards = Array.prototype.slice.call(
    document.querySelectorAll("#publications .pub-card")
  );
  var pubFolds = Array.prototype.slice.call(
    document.querySelectorAll("#publications .pub-year-fold")
  );
  var talkFolds = Array.prototype.slice.call(
    document.querySelectorAll("#talks .talk-year-fold")
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

  function updatePubFoldToggleButton() {
    if (!pubFoldToggle) return;
    var visibleFolds = pubFolds.filter(function (f) {
      return !f.classList.contains("is-hidden");
    });
    if (!visibleFolds.length) return;
    var allOpen = visibleFolds.every(function (f) {
      return f.open;
    });
    var textEl = pubFoldToggle.querySelector(".fold-toggle-text");
    if (textEl) {
      textEl.textContent = allOpen ? "Collapse all" : "Expand all";
    }
    pubFoldToggle.setAttribute("aria-expanded", allOpen ? "true" : "false");
    pubFoldToggle.classList.toggle("all-open", allOpen);
  }

  function updateTalkFoldToggleButton() {
    if (!talkFoldToggle) return;
    if (!talkFolds.length) return;
    var allOpen = talkFolds.every(function (f) {
      return f.open;
    });
    var textEl = talkFoldToggle.querySelector(".fold-toggle-text");
    if (textEl) {
      textEl.textContent = allOpen ? "Collapse all" : "Expand all";
    }
    talkFoldToggle.setAttribute("aria-expanded", allOpen ? "true" : "false");
    talkFoldToggle.classList.toggle("all-open", allOpen);
  }

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

    // Update year folds visibility and open states
    pubFolds.forEach(function (fold) {
      var y = fold.getAttribute("data-year");
      var foldCards = Array.prototype.slice.call(fold.querySelectorAll(".pub-card"));
      var hasVisible = foldCards.some(function (c) {
        return !c.classList.contains("is-hidden");
      });

      fold.classList.toggle("is-hidden", !hasVisible);

      if (hasVisible) {
        // Auto-open fold if filtering specifically, searching, or filtering featured
        if (currentFilter === y || query.length > 0 || currentFilter === "featured") {
          fold.open = true;
          foldCards.forEach(function (c) {
            c.classList.add("in");
          });
        }
      }
    });

    // Toggle empty state
    if (emptyState) {
      emptyState.hidden = matchCount > 0;
    }

    // Toggle clear search button
    if (searchClearBtn) {
      searchClearBtn.hidden = query.length === 0;
    }

    updatePubFoldToggleButton();
  }

  // Ensure scroll reveal on manual fold open and sync toggle buttons
  pubFolds.concat(talkFolds).forEach(function (fold) {
    fold.addEventListener("toggle", function () {
      if (fold.open) {
        fold.querySelectorAll(".pub-card").forEach(function (c) {
          c.classList.add("in");
        });
      }
      if (fold.classList.contains("pub-year-fold")) {
        updatePubFoldToggleButton();
      } else if (fold.classList.contains("talk-year-fold")) {
        updateTalkFoldToggleButton();
      }
    });
  });

  /* ---------- Fold Toggle All Buttons ---------- */
  if (pubFoldToggle) {
    pubFoldToggle.addEventListener("click", function (e) {
      e.preventDefault();
      var visibleFolds = pubFolds.filter(function (f) {
        return !f.classList.contains("is-hidden");
      });
      if (!visibleFolds.length) return;
      var allOpen = visibleFolds.every(function (f) {
        return f.open;
      });
      visibleFolds.forEach(function (f) {
        f.open = !allOpen;
        if (!allOpen) {
          f.querySelectorAll(".pub-card").forEach(function (c) {
            c.classList.add("in");
          });
        }
      });
      updatePubFoldToggleButton();
    });
  }

  if (talkFoldToggle) {
    talkFoldToggle.addEventListener("click", function (e) {
      e.preventDefault();
      if (!talkFolds.length) return;
      var allOpen = talkFolds.every(function (f) {
        return f.open;
      });
      talkFolds.forEach(function (f) {
        f.open = !allOpen;
        if (!allOpen) {
          f.querySelectorAll(".pub-card").forEach(function (c) {
            c.classList.add("in");
          });
        }
      });
      updateTalkFoldToggleButton();
    });
  }

  // Sync initial button states
  updatePubFoldToggleButton();
  updateTalkFoldToggleButton();

  /* ---------- Filter Tab Click ---------- */
  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-pill");
      if (!btn || btn.id === "bib-download" || btn.id === "pub-fold-toggle") return;
      currentFilter = btn.getAttribute("data-filter") || "all";

      filterBar.querySelectorAll(".filter-pill").forEach(function (p) {
        if (p.id === "pub-fold-toggle" || p.id === "bib-download") return;
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
          if (p.id === "pub-fold-toggle" || p.id === "bib-download") return;
          var isAll = p.getAttribute("data-filter") === "all";
          p.classList.toggle("active", isAll);
          p.setAttribute("aria-selected", isAll ? "true" : "false");
        });
      }
      pubFolds.forEach(function (f, idx) {
        f.open = idx === 0;
      });
      updateView();
    });
  }

  /* ---------- Deep Anchor / Hash Navigation ---------- */
  function handleHashTarget() {
    var hash = window.location.hash;
    if (!hash || hash.length <= 1) return;
    try {
      var target = document.querySelector(hash);
      if (target) {
        var parentFold = target.closest("details.year-fold");
        if (parentFold) {
          parentFold.open = true;
          parentFold.querySelectorAll(".pub-card").forEach(function (c) {
            c.classList.add("in");
          });
        }
      }
    } catch (e) {}
  }
  window.addEventListener("hashchange", handleHashTarget);
  handleHashTarget();

  /* ---------- Download BibTeX ---------- */
  var downloadBtn = document.getElementById("bib-download");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      var parts = [];
      cards.forEach(function (card) {
        if (!card.classList.contains("is-hidden")) {
          var code = card.querySelector(".bib code");
          if (code) parts.push(code.textContent);
        }
      });
      if (!parts.length) {
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
