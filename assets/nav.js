import { computePosition, flip, shift, offset, arrow } from "@floating-ui/dom";

// Mark JS enabled
document.documentElement.classList.add("js");

const navEl = document.getElementById("site-nav");

/* ---------- Theme Switcher (Light / Dark) ---------- */
const themeToggle = document.getElementById("theme-toggle");

function getEffectiveTheme() {
  const saved = localStorage.getItem("theme");
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
    const nextDesc = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    themeToggle.setAttribute("aria-label", nextDesc);
    themeToggle.setAttribute("title", nextDesc);
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

// Sync initial state
applyTheme(getEffectiveTheme(), false);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      applyTheme(e.matches ? "dark" : "light", false);
    }
  });
}

/* ---------- Scroll Reveal (Subtle Stagger) ---------- */
const revealEls = document.querySelectorAll(
  ".section-heading, .pub-card, .year-label, .contact-pill"
);
let revealCounter = 0;
if ("IntersectionObserver" in window && revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const el = e.target;
          io.unobserve(el);
          const delay = (revealCounter++ % 6) * 40;
          setTimeout(() => {
            el.classList.add("in");
          }, delay);
        }
      });
    },
    { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }
  );
  revealEls.forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
}

/* ---------- Back to Top Button ---------- */
const topBtn = document.createElement("button");
topBtn.type = "button";
topBtn.className = "back-to-top";
topBtn.setAttribute("aria-label", "Back to top");
topBtn.innerHTML =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
document.body.appendChild(topBtn);

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY || window.pageYOffset || 0;
    topBtn.classList.toggle("visible", y > 360);
    if (navEl) navEl.classList.toggle("scrolled", y > 8);
    ticking = false;
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

topBtn.addEventListener("click", () => {
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
});

/* ---------- Scrollspy: Active Section Highlighting ---------- */
const links = Array.from(document.querySelectorAll('.nav-links a[href*="#"]'));
const linkMap = [];
links.forEach((a) => {
  const href = a.getAttribute("href");
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return;
  const hash = href.substring(hashIndex);
  const target = document.querySelector(hash);
  if (target) {
    linkMap.push({ link: a, target: target });
  }
});

if ("IntersectionObserver" in window && linkMap.length) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        linkMap.forEach((item) => {
          const active = item.target === e.target;
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
  linkMap.forEach((item) => {
    spy.observe(item.target);
  });
}

/* ---------- Floating UI: Dynamic Tooltip Feedback ---------- */
let activeTooltipCleanup = null;

export function showFloatingTooltip(referenceEl, htmlContent, { placement = "top", duration = 2000 } = {}) {
  if (activeTooltipCleanup) {
    activeTooltipCleanup();
    activeTooltipCleanup = null;
  }

  const tooltip = document.createElement("div");
  tooltip.id = "floating-tooltip";
  tooltip.className = "floating-tooltip";
  tooltip.setAttribute("role", "status");

  const content = document.createElement("span");
  content.innerHTML = htmlContent;
  tooltip.appendChild(content);

  const arrowEl = document.createElement("div");
  arrowEl.className = "floating-tooltip-arrow";
  tooltip.appendChild(arrowEl);

  document.body.appendChild(tooltip);

  computePosition(referenceEl, tooltip, {
    placement,
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: arrowEl }),
    ],
  }).then(({ x, y, placement, middlewareData }) => {
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    });

    const { x: arrowX, y: arrowY } = middlewareData.arrow || {};
    const staticSide = {
      top: "bottom",
      right: "left",
      bottom: "top",
      left: "right",
    }[placement.split("-")[0]];

    Object.assign(arrowEl.style, {
      left: arrowX != null ? `${arrowX}px` : "",
      top: arrowY != null ? `${arrowY}px` : "",
      right: "",
      bottom: "",
      [staticSide]: "-4px",
    });

    requestAnimationFrame(() => {
      tooltip.classList.add("visible");
    });
  });

  const timer = setTimeout(() => {
    tooltip.classList.remove("visible");
    setTimeout(() => tooltip.remove(), 200);
  }, duration);

  activeTooltipCleanup = () => {
    clearTimeout(timer);
    tooltip.remove();
  };

  return activeTooltipCleanup;
}

// Micro-tooltips on hover for interactive elements with [data-tooltip]
document.querySelectorAll("[data-tooltip]").forEach((el) => {
  let timer;
  el.addEventListener("mouseenter", () => {
    const tipText = el.getAttribute("data-tooltip");
    if (!tipText) return;
    timer = setTimeout(() => {
      showFloatingTooltip(el, tipText, { duration: 1600 });
    }, 350);
  });
  el.addEventListener("mouseleave", () => {
    clearTimeout(timer);
  });
});

/* ---------- BibTeX Copy Button Enhanced with Floating UI ---------- */
function copyText(text, btn) {
  function done(ok) {
    if (ok) {
      showFloatingTooltip(btn, "✓ Copied to clipboard!", { placement: "top", duration: 2200 });
      btn.classList.add("copied");
    } else {
      showFloatingTooltip(btn, "⚠ Copy failed", { placement: "top", duration: 2200 });
      btn.classList.add("failed");
    }
    setTimeout(() => {
      btn.classList.remove("copied", "failed");
    }, 1600);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => done(true),
      () => fallback()
    );
  } else {
    fallback();
  }

  function fallback() {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      done(document.execCommand("copy"));
    } catch {
      done(false);
    }
    document.body.removeChild(ta);
  }
}

document.querySelectorAll(".bib").forEach((det) => {
  const pre = det.querySelector("pre");
  const code = det.querySelector("code");
  if (!pre || !code) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "bib-copy";
  btn.setAttribute("aria-label", "Copy BibTeX entry");
  btn.setAttribute("data-tooltip", "Copy BibTeX");
  btn.innerHTML =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg><span>Copy</span>';

  pre.insertAdjacentElement("beforebegin", btn);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyText(code.textContent, btn);
  });
});

/* ---------- Pagefind Static Full-Text Search Modal ---------- */
function initSearchModal() {
  const modal = document.getElementById("search-modal");
  const openBtn = document.getElementById("nav-search-btn");
  const input = document.getElementById("search-modal-input");
  const resultsContainer = document.getElementById("search-modal-results");
  const closeBtn = document.getElementById("search-modal-close");

  if (!modal || !input || !resultsContainer) return;

  let pagefind = null;
  let pagefindLoading = false;
  let selectedIndex = -1;

  async function loadPagefind() {
    if (pagefind) return pagefind;
    if (pagefindLoading) return null;
    pagefindLoading = true;
    try {
      // Use absolute origin path so it works across root, blog, and assets
      const pfUrl = new URL("/pagefind/pagefind.js", window.location.origin).href;
      const mod = await import(/* @vite-ignore */ pfUrl);
      if (mod.options) {
        await mod.options({ basePath: "/pagefind/" });
      }
      if (mod.init) {
        await mod.init();
      }
      pagefind = mod;
      return pagefind;
    } catch (err) {
      console.warn("[pagefind] Static search index not loaded:", err);
      return null;
    } finally {
      pagefindLoading = false;
    }
  }

  // Client fallback search if static index is unavailable
  function clientFallbackSearch(query) {
    const q = query.toLowerCase();
    const results = [];

    document.querySelectorAll(".pub-card").forEach((card) => {
      const title = card.querySelector(".pub-title")?.textContent || "";
      const authors = card.querySelector(".pub-authors")?.textContent || "";
      const meta = card.querySelector(".pub-meta")?.textContent || "";
      const text = `${title} ${authors} ${meta}`.toLowerCase();
      if (text.includes(q)) {
        const id = card.id ? `#${card.id}` : "#publications";
        results.push({
          url: id,
          tag: "Publication",
          title,
          excerpt: meta || authors,
        });
      }
    });

    document.querySelectorAll(".talk-card, .talk-item").forEach((talk) => {
      const title = talk.querySelector(".talk-title")?.textContent || "";
      const meta = talk.querySelector(".talk-meta")?.textContent || "";
      const text = `${title} ${meta}`.toLowerCase();
      if (text.includes(q)) {
        results.push({
          url: "#talks",
          tag: "Talk",
          title,
          excerpt: meta,
        });
      }
    });

    document.querySelectorAll(".blog-list li").forEach((li) => {
      const a = li.querySelector("a");
      const title = a?.querySelector(".blog-title")?.textContent || a?.textContent || "";
      const summary = li.querySelector(".blog-summary")?.textContent || "";
      const text = `${title} ${summary}`.toLowerCase();
      if (text.includes(q) && a) {
        results.push({
          url: a.getAttribute("href") || "#",
          tag: "Blog",
          title,
          excerpt: summary,
        });
      }
    });

    return results.slice(0, 8);
  }

  function openSearch() {
    modal.showModal();
    input.value = "";
    resultsContainer.innerHTML = '<div class="search-hint">Type keyword or title to search across all content...</div>';
    selectedIndex = -1;
    setTimeout(() => input.focus(), 60);
  }

  function closeSearch() {
    modal.close();
  }

  if (openBtn) {
    openBtn.addEventListener("click", openSearch);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSearch);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeSearch();
  });

  // Global hotkeys: Ctrl+K, Cmd+K, or "/"
  window.addEventListener("keydown", (e) => {
    const isK = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
    const isSlash = e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (isK || isSlash) {
      e.preventDefault();
      if (modal.open) {
        closeSearch();
      } else {
        openSearch();
      }
    }
  });

  function updateActiveResult() {
    const items = resultsContainer.querySelectorAll(".search-result-item");
    items.forEach((item, idx) => {
      const isAct = idx === selectedIndex;
      item.classList.toggle("active", isAct);
      if (isAct) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  input.addEventListener("keydown", (e) => {
    const items = resultsContainer.querySelectorAll(".search-result-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateActiveResult();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateActiveResult();
    } else if (e.key === "Enter" && selectedIndex >= 0 && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].click();
    }
  });

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      resultsContainer.innerHTML = '<div class="search-hint">Type keyword or title to search across all content...</div>';
      selectedIndex = -1;
      return;
    }

    debounceTimer = setTimeout(async () => {
      resultsContainer.innerHTML = '<div class="search-hint">Searching...</div>';
      const pf = await loadPagefind();

      if (pf) {
        try {
          const search = await pf.search(q);
          if (search.results && search.results.length > 0) {
            const topResults = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
            selectedIndex = 0;

            resultsContainer.innerHTML = topResults
              .map((item, idx) => {
                const isBlog = item.url.includes("/blog/");
                const tag = isBlog ? "Blog" : "Page";
                return `<a href="${item.url}" class="search-result-item ${idx === 0 ? "active" : ""}" data-index="${idx}">
                  <div class="search-result-meta">
                    <span class="search-result-tag">${tag}</span>
                    <span class="search-result-title">${item.meta?.title || item.url}</span>
                  </div>
                  ${item.excerpt ? `<p class="search-result-excerpt">${item.excerpt}</p>` : ""}
                </a>`;
              })
              .join("");
            return;
          }
        } catch (err) {
          console.warn("[pagefind] Search error:", err);
        }
      }

      // Fallback to in-page search
      const fallbackResults = clientFallbackSearch(q);
      if (fallbackResults.length > 0) {
        selectedIndex = 0;
        const reg = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
        resultsContainer.innerHTML = fallbackResults
          .map((item, idx) => {
            const highlightedTitle = item.title.replace(reg, "<mark>$1</mark>");
            const highlightedExcerpt = item.excerpt.replace(reg, "<mark>$1</mark>");
            return `<a href="${item.url}" class="search-result-item ${idx === 0 ? "active" : ""}" data-index="${idx}">
              <div class="search-result-meta">
                <span class="search-result-tag">${item.tag}</span>
                <span class="search-result-title">${highlightedTitle}</span>
              </div>
              ${item.excerpt ? `<p class="search-result-excerpt">${highlightedExcerpt}</p>` : ""}
            </a>`;
          })
          .join("");
        return;
      }

      resultsContainer.innerHTML = `<div class="search-empty">No results found for "<strong>${q.replace(/</g, "&lt;")}</strong>".</div>`;
      selectedIndex = -1;
    }, 120);
  });
}
initSearchModal();
