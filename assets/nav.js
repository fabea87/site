(function () {
  "use strict";

  // 标记 JS 已启用（reveal 动画只在有 JS 时生效）
  document.documentElement.classList.add("js");

  var navEl = document.getElementById("site-nav");

  /* ---------- 滚动入场动画（带轻微 stagger） ---------- */
  var revealEls = document.querySelectorAll(
    ".section-heading, .pub-card, .year-label"
  );
  var revealCounter = 0;
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var el = e.target;
            io.unobserve(el);
            var delay = (revealCounter++ % 8) * 45;
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

  /* ---------- 返回顶部 ---------- */
  var topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "back-to-top";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(topBtn);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      topBtn.classList.toggle("visible", window.scrollY > 400);
      if (navEl) navEl.classList.toggle("scrolled", window.scrollY > 8);
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

  /* ---------- Scrollspy：高亮当前板块的导航链接 ---------- */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href^="#"]')
  );
  var sections = links
    .map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var id = "#" + e.target.id;
          links.forEach(function (a) {
            var on = a.getAttribute("href") === id;
            a.classList.toggle("active", on);
            if (on) {
              a.setAttribute("aria-current", "true");
            } else {
              a.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------- BibTeX 一键复制 ---------- */
  function copyText(text, btn) {
    function done(ok) {
      var old = btn.textContent;
      btn.textContent = ok ? "Copied ✓" : "Copy failed";
      btn.classList.add(ok ? "copied" : "failed");
      setTimeout(function () {
        btn.textContent = old;
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
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy BibTeX entry");
    pre.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      copyText(code.textContent, btn);
    });
  });
})();
