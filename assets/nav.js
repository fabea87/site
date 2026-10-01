(function () {
  "use strict";

  // Mark JS enabled
  document.documentElement.classList.add("js");

  var navEl = document.getElementById("site-nav");

  /* ---------- Theme Switcher (Light / Dark) ---------- */
  var themeToggle = document.getElementById("theme-toggle");

  function getEffectiveTheme() {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) {
      localStorage.setItem("theme", theme);
    }
    if (themeToggle) {
      var nextDesc = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
      themeToggle.setAttribute("aria-label", nextDesc);
      themeToggle.setAttribute("title", nextDesc);
    }
  }

  // Sync initial state
  applyTheme(getEffectiveTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") || "light";
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      if (!localStorage.getItem("theme")) {
        applyTheme(e.matches ? "dark" : "light", false);
      }
    });
  }

  /* ---------- Scroll reveal (with subtle stagger) ---------- */
  var revealEls = document.querySelectorAll(
    ".section-heading, .pub-card, .year-label, .contact-pill"
  );
  var revealCounter = 0;
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var el = e.target;
            io.unobserve(el);
            var delay = (revealCounter++ % 6) * 40;
            setTimeout(function () {
              el.classList.add("in");
            }, delay);
          }
        });
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }
    );
    revealEls.forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  /* ---------- Back to Top Button ---------- */
  var topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "back-to-top";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(topBtn);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset || 0;
      topBtn.classList.toggle("visible", y > 360);
      if (navEl) navEl.classList.toggle("scrolled", y > 8);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  topBtn.addEventListener("click", function () {
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  /* ---------- Scrollspy: Active section highlighting ---------- */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href*="#"]')
  );
  var linkMap = [];
  links.forEach(function (a) {
    var href = a.getAttribute("href");
    var hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;
    var hash = href.substring(hashIndex);
    var target = document.querySelector(hash);
    if (target) {
      linkMap.push({ link: a, target: target });
    }
  });

  if ("IntersectionObserver" in window && linkMap.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          linkMap.forEach(function (item) {
            var active = item.target === e.target;
            item.link.classList.toggle("active", active);
            if (active) {
              item.link.setAttribute("aria-current", "true");
            } else {
              item.link.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    linkMap.forEach(function (item) {
      spy.observe(item.target);
    });
  }

  /* ---------- BibTeX Copy Button ---------- */
  function copyText(text, btn) {
    function done(ok) {
      var oldHtml = btn.innerHTML;
      btn.innerHTML = ok
        ? '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg><span>Copied</span>'
        : '<span>Failed</span>';
      btn.classList.add(ok ? "copied" : "failed");
      setTimeout(function () {
        btn.innerHTML = oldHtml;
        btn.classList.remove("copied", "failed");
      }, 1600);
    }

    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        done(document.execCommand("copy"));
      } catch (e) {
        done(false);
      }
      document.body.removeChild(ta);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          done(true);
        },
        function () {
          fallback();
        }
      );
    } else {
      fallback();
    }
  }

  document.querySelectorAll(".bib").forEach(function (det) {
    var pre = det.querySelector("pre");
    var code = det.querySelector("code");
    if (!pre || !code) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bib-copy";
    btn.setAttribute("aria-label", "Copy BibTeX entry");
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg><span>Copy</span>';

    pre.insertAdjacentElement("beforebegin", btn);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyText(code.textContent, btn);
    });
  });
})();
