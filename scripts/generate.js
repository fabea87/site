import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { SITE, AUTHOR_LINKS } from "../site.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "blog");

const TODAY = new Date().toISOString().slice(0, 10);

// Helper: Escape HTML special characters
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --------------------------------------------------------------------------
// Icons
// --------------------------------------------------------------------------
const SVG_CACHE = new Map();

function loadSvgBody(name) {
  if (SVG_CACHE.has(name)) return SVG_CACHE.get(name);
  const svgPath = path.join(ROOT, "assets", "img", "icons", `${name}.svg`);
  if (!fs.existsSync(svgPath)) {
    console.warn(`[generator] Missing icon assets/img/icons/${name}.svg`);
    SVG_CACHE.set(name, null);
    return null;
  }
  try {
    const content = fs.readFileSync(svgPath, "utf8");
    const vbMatch = content.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : "0 0 24 24";
    const bodyMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!bodyMatch) {
      SVG_CACHE.set(name, null);
      return null;
    }
    const body = bodyMatch[1].replace(/<title>[\s\S]*?<\/title>/gi, "").trim();
    const res = { viewBox, body };
    SVG_CACHE.set(name, res);
    return res;
  } catch (err) {
    console.error(`[generator] Error reading SVG ${name}:`, err);
    SVG_CACHE.set(name, null);
    return null;
  }
}

export function icon(name, cssClass = "icon") {
  const loaded = loadSvgBody(name);
  if (!loaded) return "";
  return `<svg class="${cssClass}" viewBox="${escapeHtml(loaded.viewBox)}" width="1em" height="1em" fill="currentColor" aria-hidden="true">${loaded.body}</svg>`;
}

// --------------------------------------------------------------------------
// BibTeX Parser
// --------------------------------------------------------------------------
export function parseBibTeX(text) {
  const entries = [];
  let pos = 0;
  while (pos < text.length) {
    const at = text.indexOf("@", pos);
    if (at === -1) break;
    const braceStart = text.indexOf("{", at);
    if (braceStart === -1) break;
    const type = text.slice(at + 1, braceStart).trim().toLowerCase();
    if (type === "comment" || type === "preamble" || type === "string") {
      pos = braceStart + 1;
      continue;
    }

    let depth = 1;
    let i = braceStart + 1;
    let inQuotes = false;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '"' && text[i - 1] !== "\\") {
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (c === "{") depth++;
        else if (c === "}") depth--;
      }
      i++;
    }
    const entryBlock = text.slice(braceStart + 1, i - 1);
    pos = i;

    const firstComma = entryBlock.indexOf(",");
    if (firstComma === -1) continue;
    const key = entryBlock.slice(0, firstComma).trim();
    const fieldsBody = entryBlock.slice(firstComma + 1);

    const fields = {};
    let fPos = 0;
    while (fPos < fieldsBody.length) {
      const eq = fieldsBody.indexOf("=", fPos);
      if (eq === -1) break;
      const fName = fieldsBody
        .slice(fPos, eq)
        .replace(/[\r\n\t, ]+/g, "")
        .trim()
        .toLowerCase();
      if (!fName) {
        fPos = eq + 1;
        continue;
      }

      let valStart = eq + 1;
      while (valStart < fieldsBody.length && /[\s]/.test(fieldsBody[valStart])) valStart++;
      let valEnd = valStart;
      let val = "";
      if (fieldsBody[valStart] === "{") {
        let bDepth = 1;
        let j = valStart + 1;
        while (j < fieldsBody.length && bDepth > 0) {
          if (fieldsBody[j] === "{") bDepth++;
          else if (fieldsBody[j] === "}") bDepth--;
          j++;
        }
        val = fieldsBody.slice(valStart + 1, j - 1);
        valEnd = j;
      } else if (fieldsBody[valStart] === '"') {
        let j = valStart + 1;
        while (j < fieldsBody.length) {
          if (fieldsBody[j] === '"' && fieldsBody[j - 1] !== "\\") break;
          j++;
        }
        val = fieldsBody.slice(valStart + 1, j);
        valEnd = j + 1;
      } else {
        let j = valStart;
        while (
          j < fieldsBody.length &&
          fieldsBody[j] !== "," &&
          fieldsBody[j] !== "\n" &&
          fieldsBody[j] !== "}"
        ) {
          j++;
        }
        val = fieldsBody.slice(valStart, j).trim();
        valEnd = j;
      }
      fields[fName] = val.replace(/\s+/g, " ").trim();
      const nextComma = fieldsBody.indexOf(",", valEnd);
      if (nextComma !== -1) fPos = nextComma + 1;
      else fPos = valEnd + 1;
    }

    const authors = fields.author
      ? fields.author
          .split(/\s+and\s+/i)
          .map((s) => s.trim().replace(/^\{|\}$/g, ""))
      : [];

    entries.push({ key, type, fields, authors });
  }
  return entries;
}

// --------------------------------------------------------------------------
// Author and Venue Formatting
// --------------------------------------------------------------------------
const ACCEPTED_LIKE = new Set(["accepted", "in press", "online first", "ahead-of-print"]);

function formatVenue(entry) {
  const fields = entry.fields;
  const venue = fields.booktitle || "";
  const year = (fields.year || "").trim();
  const vol = (fields.volume || "").trim();
  const num = (fields.number || "").trim();
  const pages = (fields.pages || "").trim();

  const parts = [venue];
  if (vol) {
    if (ACCEPTED_LIKE.has(vol.toLowerCase())) {
      parts.push(vol);
    } else if (vol !== year) {
      let detail = vol;
      if (num && !ACCEPTED_LIKE.has(num.toLowerCase()) && num.toLowerCase() !== "n/a") {
        detail += `(${num})`;
      }
      if (/^\d+(?:\s*[-–—]\s*\d+)?|e\d+$/i.test(pages)) {
        detail += `: ${pages.replace(/--/g, "–")}`;
      }
      parts.push(detail);
    }
  }
  if (year && !new RegExp(`${escapeRegExp(year)}[)]?$`).test(venue)) {
    parts.push(year);
  }
  return parts.join(", ");
}

function generatePersonHtml(
  authors,
  {
    connection = ", ",
    makeBold = true,
    makeBoldName = SITE.short_name,
    addLinks = true,
    equalContribution = null,
  } = {}
) {
  return authors
    .map((plain, idx) => {
      let piece = escapeHtml(plain);
      if (addLinks && AUTHOR_LINKS[plain]) {
        piece = `<a href="${escapeHtml(AUTHOR_LINKS[plain])}" target="_blank">${piece}</a>`;
      }
      if (makeBold && plain === makeBoldName) {
        piece = `<span class="self-name">${escapeHtml(makeBoldName)}</span>`;
      }
      if (equalContribution !== null && idx < equalContribution) {
        piece += "*";
      }
      return piece;
    })
    .join(connection);
}

function buildCite(entry) {
  const authors = generatePersonHtml(entry.authors, {
    makeBold: false,
    addLinks: false,
    connection: " and ",
  });
  let cite = `@${entry.type}{${entry.key}, \n`;
  cite += `\tauthor = {${authors}}, \n`;
  for (const field of ["title", "booktitle", "year"]) {
    if (entry.fields[field]) {
      cite += `\t${field} = {${entry.fields[field]}}, \n`;
    }
  }
  cite += "}";
  return escapeHtml(cite);
}

// --------------------------------------------------------------------------
// Image / Thumbnails helper
// --------------------------------------------------------------------------
function imgTag(imgPath, alt, { lazy = true, extra = "", sizes = "150px" } = {}) {
  const src = escapeHtml(imgPath);
  let srcset = "";
  if (imgPath) {
    const ext = path.extname(imgPath);
    const base = imgPath.slice(0, -ext.length);
    const t1 = `${base}.webp`;
    const t2 = `${base}-2x.webp`;
    const fullT1 = path.join(ROOT, t1);
    const fullT2 = path.join(ROOT, t2);

    const candidates = [];
    if (fs.existsSync(fullT1)) {
      if (imgPath.includes("profile")) {
        candidates.push(`${t1} 412w`);
      } else {
        candidates.push(`${t1} 480w`);
      }
    }
    if (fs.existsSync(fullT2)) {
      candidates.push(`${t2} 960w`);
    }
    if (candidates.length > 0) {
      srcset = ` srcset="${candidates.join(", ")}" sizes="${escapeHtml(sizes)}"`;
    }
  }
  const lazyAttr = lazy ? ' loading="lazy"' : "";
  return `<img src="${src}"${srcset}${lazyAttr} alt="${escapeHtml(alt)}"${extra}>`;
}

// --------------------------------------------------------------------------
// Navigation and Layout Components
// --------------------------------------------------------------------------
export function getNavHtml(root = "", home = "#top") {
  return `<nav class="site-nav" id="site-nav" data-pagefind-ignore>
    <div class="container nav-inner">
      <a class="nav-brand" href="${home}" aria-label="Da Yan">
        <img class="nav-brand-img" src="${root}assets/img/signature.webp" alt="Da Yan" width="121" height="38">
      </a>
      <div class="nav-links">
        <a href="${root}index.html#interests">Interests</a>
        <a href="${root}index.html#publications">Publications</a>
        <a href="${root}index.html#talks">Conferences</a>
        <a href="${root}blog/index.html">Blog</a>
        <a href="${root}index.html#contact">Contact</a>
      </div>
      <div class="nav-right">
        <button type="button" class="nav-search-btn" id="nav-search-btn" aria-label="Search site" data-tooltip="Search site (⌘K)">
          ${icon("search", "nav-search-icon")}
          <span class="nav-search-text">Search</span>
          <kbd class="nav-search-kbd">⌘K</kbd>
        </button>
        <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle theme" title="Toggle theme" data-tooltip="Toggle light/dark theme">
          <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>
      </div>
    </div>
  </nav>
  <dialog id="search-modal" class="search-modal" aria-label="Search site" data-pagefind-ignore>
    <div class="search-modal-box">
      <div class="search-modal-header">
        <div class="search-input-wrap">
          ${icon("search", "search-input-icon")}
          <input type="search" id="search-modal-input" class="search-modal-input" placeholder="Search publications, talks, blogs... (↑↓ to navigate, Esc to close)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <button type="button" class="search-esc-btn" id="search-modal-close" aria-label="Close search">Esc</button>
        </div>
      </div>
      <div class="search-modal-body" id="search-modal-results">
        <div class="search-hint">Type keyword or title to search across all content...</div>
      </div>
    </div>
  </dialog>`;
}

export function getFooterHtml() {
  const year = new Date().getFullYear();
  return `
                <p>© ${year} ${escapeHtml(SITE.short_name)} · Last updated ${TODAY}</p>
                <p>
                This website follows the design of <a href="https://m-niemeyer.github.io/" target="_blank">Michael Niemeyer</a> and <a href="https://jonbarron.info/" target="_blank">Jon Barron</a>.
                </p>
  `;
}

function getSocialMediaHtml() {
  return `
                <div class="hero-links">
                <details class="about-details">
                <summary class="link-pill">${icon("graduation-cap")}About</summary>
                <div class="about-body">${SITE.bio}</div>
                </details>
                <div class="cv-menu">
                <button type="button" class="link-pill cv-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="cv-panel">${icon("address-card")}CV <span class="cv-chev">▾</span></button>
                <div class="cv-menu-panel" id="cv-panel">
                <a class="cv-menu-item" href="${SITE.cv_en}" target="_blank">English CV</a>
                <a class="cv-menu-item" href="${SITE.cv_cn}" target="_blank">中文简历</a>
                </div>
                </div>
                <a class="link-pill" href="mailto:${SITE.email}">${icon("envelope-open")}Mail</a>
                <a class="link-pill" href="https://scholar.google.com/citations?user=${SITE.scholar}&hl=en" target="_blank">${icon("google-scholar")}Scholar</a>
                </div>
  `;
}

function getInterestsHtml() {
  return `<div class="interests">${SITE.interests
    .map((item) => `<span class="interest-chip">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function getContactHtml() {
  const items = [
    { iconName: "envelope", label: "Email", href: `mailto:${SITE.email}`, ext: false, brand: "" },
    {
      iconName: "orcid",
      label: "ORCID",
      href: `https://orcid.org/${SITE.orcid}`,
      ext: true,
      brand: "",
    },
    {
      iconName: "google-scholar",
      label: "Google Scholar",
      href: `https://scholar.google.com/citations?user=${SITE.scholar}&hl=en`,
      ext: true,
      brand: "",
    },
    {
      iconName: "github",
      label: "GitHub",
      href: `https://github.com/${SITE.github}`,
      ext: true,
      brand: "",
    },
    {
      iconName: "researchgate",
      label: "ResearchGate",
      href: "https://www.researchgate.net/profile/Da-Yan-3?ev=hdr_xprf",
      ext: true,
      brand: "",
    },
    {
      iconName: "webofscience",
      label: "Web of Science",
      href: "https://www.webofscience.com/wos/author/record/AAE-3520-2022",
      ext: true,
      brand: "brand-wos",
    },
    {
      iconName: "scopus",
      label: "Scopus",
      href: "https://www.scopus.com/authid/detail.uri?authorId=57192956833",
      ext: true,
      brand: "brand-scopus",
    },
  ];

  let s = '<div class="contact-links">';
  for (const item of items) {
    const target = item.ext ? ' target="_blank" rel="me noopener"' : "";
    const brandAttr = item.brand ? ` ${item.brand}` : "";
    const loaded = loadSvgBody(item.iconName);
    let inner = "";
    if (loaded) {
      inner = `<span class="contact-icon"><svg viewBox="${escapeHtml(loaded.viewBox)}" width="16" height="16" fill="currentColor" aria-hidden="true">${loaded.body}</svg></span>`;
    } else {
      const mono = item.iconName === "webofscience" ? "WoS" : item.iconName.slice(0, 1).toUpperCase();
      inner = `<span class="contact-icon mono" aria-hidden="true">${mono}</span>`;
    }
    s += `<a class="contact-pill${brandAttr}" href="${escapeHtml(item.href)}"${target}>${inner}<span>${escapeHtml(item.label)}</span><span class="contact-arrow" aria-hidden="true">↗</span></a>`;
  }
  s += "</div>";
  return s;
}

// --------------------------------------------------------------------------
// Publication and Talk Artefacts
// --------------------------------------------------------------------------
const PAPER_ARTEFACTS = {
  html: "Web view",
  pdf: "Postprint archive",
  supp: "Supplementary",
  video: "Video",
  poster: "Poster",
  code: "Code",
};

const TALK_ARTEFACTS = {
  slides: "Slides",
  video: "Recording",
};

function artefactLinks(fields, artefacts) {
  let s = "";
  for (const [key, label] of Object.entries(artefacts)) {
    if (fields[key]) {
      let iconSvg = "";
      if (key === "html") {
        iconSvg =
          '<svg class="pub-link-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/></svg>';
      } else if (key === "pdf") {
        iconSvg =
          '<svg class="pub-link-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/></svg>';
      } else if (key === "slides") {
        iconSvg =
          '<svg class="pub-link-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/><path d="M8.5 13a.5.5 0 0 0-.5.5v1.5H5.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1H9v-1.5a.5.5 0 0 0-.5-.5z"/></svg>';
      }
      s += `<a class="pub-link" href="${escapeHtml(fields[key])}" target="_blank" rel="noopener">${iconSvg}<span>${label}</span></a>`;
    }
  }
  return s;
}

function getPaperEntry(entry) {
  const fields = entry.fields;
  const year = (fields.year || "").trim() || "n.d.";
  const featured = fields.highlight ? " featured" : "";
  const badge = fields.highlight
    ? '<span class="featured-badge"><svg class="featured-star" viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/></svg>Featured</span>'
    : "";
  const title = escapeHtml(fields.title);
  const href = escapeHtml(fields.html || "#");
  const img = fields.img;
  const dataYear = ` data-year="${escapeHtml(year)}"`;
  const dataFeatured = fields.highlight ? ' data-featured="true"' : "";

  const onerrorHandler = ' onerror="this.closest(\'.pub-thumb\').classList.add(\'img-missing\')"';
  let s = `<article class="pub-card${featured}"${dataYear}${dataFeatured}>${badge}`;
  s += `<div class="pub-thumb">${imgTag(img, fields.title, { extra: onerrorHandler })}</div>`;
  s += '<div class="pub-body">';

  let award = "";
  if (fields.award) {
    award = ` <span class="pub-award">(${escapeHtml(fields.award)})</span>`;
  }
  s += `<h3 class="pub-title"><a href="${href}" target="_blank">${title}</a>${award}</h3>`;

  const equalContribution = fields.equal_contribution ? parseInt(fields.equal_contribution, 10) : null;
  const authors = generatePersonHtml(entry.authors, { equalContribution });
  s += `<p class="pub-authors">${authors}</p>`;
  s += `<p class="pub-meta">${escapeHtml(formatVenue(entry))}</p>`;
  s += '<div class="pub-links">';
  s += artefactLinks(fields, PAPER_ARTEFACTS);
  const bibIcon =
    '<svg class="pub-link-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
  s += `<details class="bib"><summary>${bibIcon}<span>BibTeX</span></summary><div class="bib-drawer"><pre><code>${buildCite(entry)}</code></pre></div></details>`;
  s += "</div></div></article>";
  return s;
}

function getTalkEntry(entry) {
  const fields = entry.fields;
  const year = (fields.year || "").trim() || "n.d.";
  const title = escapeHtml(fields.title);
  const img = fields.img;
  const dataYear = ` data-year="${escapeHtml(year)}"`;
  const onerrorHandler = ' onerror="this.closest(\'.pub-thumb\').classList.add(\'img-missing\')"';

  let s = `<article class="pub-card"${dataYear}>`;
  s += `<div class="pub-thumb">${imgTag(img, fields.title, { extra: onerrorHandler })}</div>`;
  s += '<div class="pub-body">';
  s += `<h3 class="pub-title">${title}</h3>`;
  s += `<p class="pub-meta">${escapeHtml(formatVenue(entry))}</p>`;
  s += '<div class="pub-links">';
  s += artefactLinks(fields, TALK_ARTEFACTS);
  s += "</div></div></article>";
  return s;
}

function groupByYear(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const year = (entry.fields.year || "").trim() || "n.d.";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(entry);
  }
  return groups;
}

function getPublicationsHtml(entries) {
  const groups = groupByYear(entries);
  const sortedYears = Array.from(groups.keys()).sort((a, b) => {
    const numA = parseInt(a, 10) || 0;
    const numB = parseInt(b, 10) || 0;
    return numB - numA;
  });

  let s = "";
  for (const year of sortedYears) {
    const groupEntries = groups.get(year);
    const count = groupEntries.length;
    s += `<h3 class="year-label" data-year="${escapeHtml(year)}">${year}<span class="year-count">&nbsp;·&nbsp;${count}</span></h3>`;
    for (const entry of groupEntries) {
      s += getPaperEntry(entry);
    }
  }
  return s;
}

function getTalksHtml(entries) {
  const groups = groupByYear(entries);
  const sortedYears = Array.from(groups.keys()).sort((a, b) => {
    const numA = parseInt(a, 10) || 0;
    const numB = parseInt(b, 10) || 0;
    return numB - numA;
  });

  let s = "";
  for (const year of sortedYears) {
    const groupEntries = groups.get(year);
    s += `<h3 class="year-label" data-year="${escapeHtml(year)}">${year}</h3>`;
    for (const entry of groupEntries) {
      s += getTalkEntry(entry);
    }
  }
  return s;
}

function getPubFilterHtml(entries) {
  const groups = groupByYear(entries);
  const sortedYears = Array.from(groups.keys()).sort((a, b) => {
    const numA = parseInt(a, 10) || 0;
    const numB = parseInt(b, 10) || 0;
    return numB - numA;
  });
  const recentYears = sortedYears.filter((y) => /^\d+$/.test(y)).slice(0, 5);
  const featuredCount = entries.filter((e) => e.fields.highlight).length;
  const totalCount = entries.length;

  let s = '<div class="pub-toolbar">';
  s += `<div class="pub-search-wrapper">${icon("search", "pub-search-icon")}<input type="search" id="pub-search" class="pub-search-input" placeholder="Search publications by title, keyword, or author..." aria-label="Search publications" autocomplete="off"><button type="button" id="pub-search-clear" class="pub-search-clear" aria-label="Clear search" hidden>&times;</button></div>`;
  s += '<div class="pub-filter" id="pub-filter" role="tablist" aria-label="Filter publications">';
  s += `<button type="button" class="filter-pill active" data-filter="all" role="tab" aria-selected="true">All <span class="filter-count">${totalCount}</span></button>`;
  s += `<button type="button" class="filter-pill" data-filter="featured" role="tab" aria-selected="false">Featured <span class="filter-count">${featuredCount}</span></button>`;
  s += '<span class="filter-divider" aria-hidden="true"></span>';
  for (const year of recentYears) {
    const cnt = groups.get(year).length;
    s += `<button type="button" class="filter-pill" data-filter="${escapeHtml(year)}" role="tab" aria-selected="false">${escapeHtml(year)} <span class="filter-count">${cnt}</span></button>`;
  }
  s += "</div>";
  s += '<div id="pub-empty" class="pub-empty" hidden><p class="pub-empty-text">No publications found matching your search.</p><button type="button" id="pub-empty-reset" class="pub-empty-reset">Reset search filters</button></div>';
  s += "</div>";
  return s;
}

// --------------------------------------------------------------------------
// Index Page Generator
// --------------------------------------------------------------------------
export function generateIndexHtml() {
  const pubBib = fs.readFileSync(path.join(ROOT, "publication_list.bib"), "utf8");
  const talkBib = fs.readFileSync(path.join(ROOT, "talk_list.bib"), "utf8");
  const pubEntries = parseBibTeX(pubBib);
  const talkEntries = parseBibTeX(talkBib);

  const name = SITE.name;
  const tagline = SITE.tagline;
  const titleSuffix = SITE.title.replace(/&amp;/g, "&");
  const siteUrl = SITE.url.replace(/\/+$/, "");
  const pageTitle = `${name[0]}${name[1]} | ${titleSuffix}`;
  const description = SITE.description;
  const [affiliationName, affiliationUrl] = SITE.affiliation;

  const heroImg = imgTag("assets/img/profile.jpg", "Da Yan's profile photo", {
    lazy: false,
    extra: ' fetchpriority="high"',
    sizes: "189px",
  });

  const personJson = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.short_name,
    alternateName: name[0],
    url: `${siteUrl}/`,
    email: `mailto:${SITE.email}`,
    affiliation: {
      "@type": "Organization",
      name: affiliationName,
      url: affiliationUrl,
    },
    sameAs: [
      `https://orcid.org/${SITE.orcid}`,
      `https://scholar.google.com/citations?user=${SITE.scholar}&hl=en`,
      `https://github.com/${SITE.github}`,
      "https://www.researchgate.net/profile/Da-Yan-3",
      "https://www.webofscience.com/wos/author/record/AAE-3520-2022",
      "https://www.scopus.com/authid/detail.uri?authorId=57192956833",
    ],
  };
  const ldJson = JSON.stringify(personJson, null, 2);

  return `<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${siteUrl}/">
  <link rel="alternate" type="application/rss+xml" title="Blog" href="${siteUrl}/feed.xml">
  <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${siteUrl}/">
  <meta property="og:image" content="${siteUrl}/assets/img/profile.jpg">
  <script type="application/ld+json">
${ldJson}
  </script>
  <script>
    (function () {
      var saved = localStorage.getItem('theme');
      var pref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', saved || pref);
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bona+Nova+SC:wght@400;700&family=IBM+Plex+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" type="text/css" href="assets/stylesheet.css">
</head>

<body>
  <a class="skip-link" href="#top">Skip to content</a>
  ${getNavHtml()}

  <main id="top" data-pagefind-body>
    <div class="container">
      <header class="hero">
        <div class="hero-grid">
          <div class="hero-text">
            <h1 class="hero-name">${name[0]}<span class="hero-suffix">${name[1]}</span></h1>
            <p class="hero-tagline">
              <span class="tagline-role">${tagline}</span>
              <span class="tagline-sep">@</span>
              <a class="tagline-affiliation" href="${affiliationUrl}" target="_blank" rel="noopener">${affiliationName}</a>
            </p>
            <div class="hero-bio">${SITE.bio_text}</div>
            ${getSocialMediaHtml()}
          </div>
          <div class="hero-photo">
            <div class="hero-photo-frame">
              ${heroImg}
            </div>
          </div>
        </div>
      </header>

      <section id="interests" class="section">
        <h2 class="section-heading">Research Interests</h2>
        ${getInterestsHtml()}
      </section>

      <section id="publications" class="section">
        <h2 class="section-heading">Publications</h2>
        ${getPubFilterHtml(pubEntries)}
        ${getPublicationsHtml(pubEntries)}
      </section>

      <section id="talks" class="section">
        <h2 class="section-heading">Conferences</h2>
        ${getTalksHtml(talkEntries)}
      </section>

      <section id="contact" class="section">
        <h2 class="section-heading">Contact</h2>
        ${getContactHtml()}
      </section>

      <footer class="site-footer" data-pagefind-ignore>
        ${getFooterHtml()}
      </footer>
    </div>
  </main>

  <script type="module" src="assets/thumbs.js"></script>
  <script type="module" src="assets/cvmenu.js"></script>
  <script type="module" src="assets/nav.js"></script>
  <script type="module" src="assets/pubs.js"></script>
</body>

</html>
`;
}

// --------------------------------------------------------------------------
// Blog Generator
// --------------------------------------------------------------------------
const FONTS_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '  <link href="https://fonts.googleapis.com/css2?family=Bona+Nova+SC:wght@400;700' +
  '&family=IBM+Plex+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">';

const CSS_LINK = '<link rel="stylesheet" href="../assets/stylesheet.css">';
const FAVICON = '<link rel="icon" type="image/x-icon" href="../assets/favicon.ico">';

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const rawMeta = match[1];
  const body = match[2];
  const meta = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const k = line.slice(0, colon).trim();
      const v = line.slice(colon + 1).trim();
      meta[k] = v;
    }
  }
  return { meta, body };
}

export function slugOf(filename) {
  const stem = filename.replace(/\.md$/, "");
  const m = stem.match(/^\d{4}-\d{2}-\d{2}(-\d{4})?-(.+)$/);
  return m ? m[2] : stem;
}

export function blogPage(title, body, { metaDesc = "", canonical = null, ldJson = null } = {}) {
  const siteUrl = SITE.url.replace(/\/+$/, "");
  const shortName = SITE.short_name;
  const head = [];
  if (metaDesc) {
    head.push(`<meta name="description" content="${escapeHtml(metaDesc)}">`);
  }
  if (canonical) {
    head.push(`<link rel="canonical" href="${escapeHtml(canonical)}">`);
    head.push('<meta property="og:type" content="article">');
    head.push(`<meta property="og:title" content="${escapeHtml(title)}">`);
    if (metaDesc) {
      head.push(`<meta property="og:description" content="${escapeHtml(metaDesc)}">`);
    }
    head.push(`<meta property="og:url" content="${escapeHtml(canonical)}">`);
  }
  head.push(
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(shortName)} — Blog" href="${siteUrl}/feed.xml">`
  );
  if (ldJson) {
    head.push(`<script type="application/ld+json">\n${ldJson}\n</script>`);
  }
  const seo = head.join("\n  ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  ${seo}
  <script>
    (function () {
      var saved = localStorage.getItem('theme');
      var pref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', saved || pref);
    })();
  </script>
  ${FAVICON}
  ${FONTS_LINK}
  ${CSS_LINK}
</head>
<body>
${getNavHtml("../", "../index.html")}
<main data-pagefind-body>
  <div class="container">
${body}
  </div>
</main>
<footer class="site-footer" data-pagefind-ignore>
  <p>© ${TODAY.slice(0, 4)} ${escapeHtml(SITE.short_name)} · Last updated ${TODAY} · <a href="../index.html">Back to homepage</a></p>
  <p>This website follows the design of <a href="https://m-niemeyer.github.io/" target="_blank">Michael Niemeyer</a> and <a href="https://jonbarron.info/" target="_blank">Jon Barron</a>.</p>
</footer>
<script type="module" src="../assets/nav.js"></script>
</body>
</html>`;
}

export function renderBlogIndex(posts) {
  const rows = posts.map((p) => {
    const dateHtml = p.date ? `<span class="blog-date">${escapeHtml(p.date)}</span>` : "";
    const sumHtml = p.summary ? `<p class="blog-summary">${escapeHtml(p.summary)}</p>` : "";
    return `<li><a href="${escapeHtml(p.slug)}.html">${dateHtml}<span class="blog-title">${escapeHtml(p.title)}</span></a>${sumHtml}</li>`;
  });

  const body = `<section class="section">
  <h2 class="section-heading">Blog</h2>
  <p class="blog-intro">Notes on CALL, feedback, and language data science.</p>
  <ul class="blog-list">
${rows.join("\n")}
  </ul>
</section>`;

  return blogPage("Blog · Da Yan", body, {
    metaDesc: "Blog posts by Da Yan on CALL, feedback, and language data science.",
    canonical: `${SITE.url.replace(/\/+$/, "")}/blog/`,
  });
}

export function renderBlogPost(post) {
  const back = '<p class="blog-back"><a href="index.html">← Back to Blog</a></p>';
  const dateHtml = post.date ? `<p class="blog-date-large">${escapeHtml(post.date)}</p>` : "";
  const body = `<article class="blog-post">
  ${back}
  <h1 class="blog-title-large">${escapeHtml(post.title)}</h1>
  ${dateHtml}
  <div class="prose">
${post.html}
  </div>
  ${back}
</article>`;

  const metaDesc = post.summary || `${post.title} — blog post on Da Yan's homepage.`;
  const siteUrl = SITE.url.replace(/\/+$/, "");
  const url = `${siteUrl}/blog/${post.slug}.html`;
  const postJson = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url,
    mainEntityOfPage: url,
    datePublished: (post.date || TODAY).replace(" ", "T"),
    dateModified: (post.date || TODAY).replace(" ", "T"),
    inLanguage: "en",
    author: {
      "@type": "Person",
      name: SITE.short_name,
      url: `${siteUrl}/`,
    },
    publisher: {
      "@type": "Person",
      name: SITE.short_name,
    },
    image: `${siteUrl}/assets/img/profile.jpg`,
    description: metaDesc,
    keywords: post.tags || [],
  };

  return blogPage(`${post.title} · Da Yan`, body, {
    metaDesc,
    canonical: url,
    ldJson: JSON.stringify(postJson, null, 2),
  });
}

function toRfc822(dateStr) {
  try {
    const d = new Date(dateStr ? dateStr.replace(" ", "T") + "Z" : Date.now());
    return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

export function getBlogPosts() {
  const posts = [];
  if (!fs.existsSync(BLOG_DIR)) return posts;
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md")).sort();
  for (const fn of files) {
    const filePath = path.join(BLOG_DIR, fn);
    const raw = fs.readFileSync(filePath, "utf8");
    const { meta, body } = parseFrontMatter(raw);

    let title = meta.title;
    let cleanedBody = body;
    if (!title) {
      const h1Match = body.match(/^#\s+(.+)$/m);
      title = h1Match ? h1Match[1] : fn.replace(/\.md$/, "");
      if (h1Match) {
        cleanedBody = body.slice(0, h1Match.index) + body.slice(h1Match.index + h1Match[0].length);
      }
    } else {
      cleanedBody = cleanedBody.replace(/^\s*#\s+.*?\r?\n+/, "");
    }
    cleanedBody = cleanedBody.trimStart();

    let date = meta.date;
    if (!date) {
      const stat = fs.statSync(filePath);
      date = stat.mtime.toISOString().replace("T", " ").slice(0, 19);
    }

    const summary = meta.summary || "";
    const tags = meta.tags ? meta.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [];
    const slug = slugOf(fn);
    const html = marked.parse(cleanedBody);

    posts.push({ date, slug, title, summary, tags, html });
  }

  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return posts;
}

export function cleanGeneratedHtml() {
  const rootIndex = path.join(ROOT, "index.html");
  if (fs.existsSync(rootIndex)) {
    try {
      fs.unlinkSync(rootIndex);
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(BLOG_DIR)) {
    const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".html"));
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(BLOG_DIR, f));
      } catch {
        // ignore
      }
    }
  }
  const publicDir = path.join(ROOT, "public");
  if (fs.existsSync(publicDir)) {
    try {
      fs.rmSync(publicDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

export function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function generateRobotsTxt() {
  const siteUrl = SITE.url.replace(/\/+$/, "");
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

export function generateSitemapXml(posts = getBlogPosts()) {
  const siteUrl = SITE.url.replace(/\/+$/, "");
  const urls = [
    { loc: `${siteUrl}/`, lastmod: TODAY },
    { loc: `${siteUrl}/blog/`, lastmod: TODAY },
  ];
  for (const p of posts) {
    urls.push({
      loc: `${siteUrl}/blog/${p.slug}.html`,
      lastmod: p.date ? p.date.slice(0, 10) : TODAY,
    });
  }
  const sitemapEntries = urls
    .map(
      (u) => `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;
}

export function generateFeedXml(posts = getBlogPosts()) {
  const siteUrl = SITE.url.replace(/\/+$/, "");
  const feedItems = posts.map((p) => {
    const url = `${siteUrl}/blog/${p.slug}.html`;
    const cats = (p.tags || [])
      .map((t) => `\n    <category>${escapeHtml(t)}</category>`)
      .join("");
    const content = p.html.replace(/]]>/g, "]]&gt;");
    return `  <item>\n    <title>${escapeHtml(p.title)}</title>\n    <link>${url}</link>\n    <guid isPermaLink="true">${url}</guid>\n    <pubDate>${toRfc822(p.date)}</pubDate>\n    <description>${escapeHtml(p.summary || p.title)}</description>${cats}\n    <content:encoded><![CDATA[${content}]]></content:encoded>\n  </item>`;
  });
  const lastBuild = posts.length > 0 ? toRfc822(posts[0].date) : new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n  <title>${escapeHtml(SITE.short_name)} — Blog</title>\n  <link>${siteUrl}/blog/</link>\n  <description>Notes on CALL, feedback, and language data science.</description>\n  <language>en</language>\n  <lastBuildDate>${lastBuild}</lastBuildDate>\n  <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>\n${feedItems.join("\n")}\n</channel>\n</rss>\n`;
}

// --------------------------------------------------------------------------
// Master Generator: writes exclusively to product directory (dist)
// Never writes to workspace root, blog source, or non-product directories
// --------------------------------------------------------------------------
export function generateSite({ outDir = path.join(ROOT, "dist") } = {}) {
  const relOut = path.relative(ROOT, outDir) || outDir;
  console.log(`[generator] Compiling academic site to product directory (${relOut})...`);

  // Ensure workspace code folder stays pristine
  cleanGeneratedHtml();

  const posts = getBlogPosts();
  const blogOutDir = path.join(outDir, "blog");
  fs.mkdirSync(blogOutDir, { recursive: true });

  // 1. Output HTML directly into product directory
  fs.writeFileSync(path.join(outDir, "index.html"), generateIndexHtml(), "utf8");
  fs.writeFileSync(path.join(blogOutDir, "index.html"), renderBlogIndex(posts), "utf8");
  for (const p of posts) {
    fs.writeFileSync(path.join(blogOutDir, `${p.slug}.html`), renderBlogPost(p), "utf8");
  }

  // 2. Output SEO files directly into product directory
  fs.writeFileSync(path.join(outDir, "robots.txt"), generateRobotsTxt(), "utf8");
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), generateSitemapXml(posts), "utf8");
  fs.writeFileSync(path.join(outDir, "feed.xml"), generateFeedXml(posts), "utf8");

  // 3. Sync static assets to product directory
  copyDirRecursive(path.join(ROOT, "assets"), path.join(outDir, "assets"));
  const favicon = path.join(ROOT, "assets", "favicon.ico");
  if (fs.existsSync(favicon)) {
    fs.copyFileSync(favicon, path.join(outDir, "favicon.ico"));
  }

  // 4. Index search with Pagefind
  try {
    execSync(`npx pagefind --site "${outDir}"`, { stdio: "inherit" });
  } catch (err) {
    console.warn("[generator] Pagefind indexing warning:", err);
  }

  console.log(`[generator] Done: all assets written directly to product directory: ${outDir}`);
}

// Direct execution CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  generateSite();
}
