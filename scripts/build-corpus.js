import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toMarkdown } from "@firecrawl/anydoc";
import { parseBibTeX, escapeHtml } from "./generate.js";
import { SITE } from "../site.config.js";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

export const CORPUS_DIR = path.join(ROOT, "corpus");
export const PUB_CORPUS_DIR = path.join(CORPUS_DIR, "publications");
export const TALK_CORPUS_DIR = path.join(CORPUS_DIR, "talks");

// Ensure directories exist
fs.mkdirSync(PUB_CORPUS_DIR, { recursive: true });
fs.mkdirSync(TALK_CORPUS_DIR, { recursive: true });

export function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const rawMeta = match[1];
  const body = match[2];
  const meta = {};
  for (const line of rawMeta.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const k = line.slice(0, colon).trim();
      let v = line.slice(colon + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      meta[k] = v;
    }
  }
  return { meta, body };
}

function yamlEscape(str) {
  if (!str) return '""';
  return `"${String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function parsePdfToCorpusMarkdown(pdfPath, outMdPath, metadata = {}, { force = false } = {}) {
  // Check if target file already exists and is newer than source PDF
  if (!force && fs.existsSync(outMdPath)) {
    const pdfStat = fs.statSync(pdfPath);
    const mdStat = fs.statSync(outMdPath);
    if (mdStat.mtime >= pdfStat.mtime && mdStat.size > 80) {
      return { cached: true, path: outMdPath };
    }
  }

  let body = "";
  let needsOcr = false;
  try {
    body = await toMarkdown(pdfPath);
  } catch (err) {
    needsOcr = true;
    console.warn(`[anydoc] Note for ${path.basename(pdfPath)}: ${err.message}`);
  }

  if (needsOcr || !body || body.trim().length === 0) {
    body = `## Publication Information & Overview

This work is part of Da Yan's academic publications and presentations.

- **Title:** ${metadata.title || path.basename(pdfPath, ".pdf")}
- **Authors:** ${metadata.authors || SITE.short_name}
- **Venue:** ${metadata.venue || "Academic Publication / Conference"}
- **Year:** ${metadata.year || ""}
${metadata.abstract ? `\n### Abstract\n\n${metadata.abstract}\n` : ""}

The complete manuscript or presentation slides are available for reading and download via the link below:

- [View / Download PDF](${metadata.pdf ? (metadata.pdf.startsWith("/") ? metadata.pdf : "/" + metadata.pdf) : "/" + path.relative(ROOT, pdfPath).replace(/\\/g, "/")})
`;
  }

  const frontMatter = [
    "---",
    `title: ${yamlEscape(metadata.title || path.basename(pdfPath, ".pdf"))}`,
    `authors: ${yamlEscape(metadata.authors || SITE.short_name)}`,
    `venue: ${yamlEscape(metadata.venue || "")}`,
    `year: ${yamlEscape(metadata.year || "")}`,
    `type: ${yamlEscape(metadata.type || "Publication")}`,
    `pdf: ${yamlEscape(metadata.pdf || path.relative(ROOT, pdfPath).replace(/\\/g, "/"))}`,
    `html: ${yamlEscape(metadata.html || "")}`,
    `key: ${yamlEscape(metadata.key || path.basename(pdfPath, ".pdf"))}`,
    "---",
    "",
    body.trim(),
    "",
  ].join("\n");

  fs.writeFileSync(outMdPath, frontMatter, "utf8");
  return { cached: false, path: outMdPath };
}

export async function buildCorpus({ force = false } = {}) {
  console.log("[corpus] Syncing publication and talk PDFs for full-text search corpus...");
  const pubBibPath = path.join(ROOT, "publication_list.bib");
  const talkBibPath = path.join(ROOT, "talk_list.bib");

  const pubEntries = fs.existsSync(pubBibPath) ? parseBibTeX(fs.readFileSync(pubBibPath, "utf8")) : [];
  const talkEntries = fs.existsSync(talkBibPath) ? parseBibTeX(fs.readFileSync(talkBibPath, "utf8")) : [];

  const pubDir = path.join(ROOT, "assets", "pdf", "publications");
  const talkDir = path.join(ROOT, "assets", "pdf", "talks");

  const pubFiles = fs.existsSync(pubDir) ? fs.readdirSync(pubDir).filter((f) => f.endsWith(".pdf")) : [];
  const talkFiles = fs.existsSync(talkDir) ? fs.readdirSync(talkDir).filter((f) => f.endsWith(".pdf")) : [];

  let pubProcessed = 0;
  for (const fn of pubFiles) {
    const slug = fn.replace(/\.pdf$/, "");
    const pdfRel = `assets/pdf/publications/${fn}`;
    const pdfPath = path.join(pubDir, fn);
    const mdPath = path.join(PUB_CORPUS_DIR, `${slug}.md`);

    // Accurate matching with bib entry
    let entry = pubEntries.find(
      (e) => e.fields.pdf && (e.fields.pdf.endsWith("/" + fn) || e.fields.pdf === pdfRel || e.fields.pdf === fn)
    );
    if (!entry) {
      entry = pubEntries.find((e) => e.key === slug || e.key.toLowerCase() === slug.toLowerCase());
    }

    const authors = entry
      ? Array.isArray(entry.authors)
        ? entry.authors.join(", ")
        : entry.fields.author || SITE.short_name
      : SITE.short_name;
    const venue = entry ? entry.fields.booktitle || entry.fields.journal || entry.fields.publisher || "" : "";
    const metadata = {
      title: entry ? entry.fields.title : slug,
      authors,
      venue,
      year: entry ? entry.fields.year : "",
      type: "Publication",
      pdf: pdfRel,
      html: entry ? entry.fields.html || "" : "",
      key: entry ? entry.key : slug,
      abstract: entry ? entry.fields.abstract || "" : "",
    };

    const res = await parsePdfToCorpusMarkdown(pdfPath, mdPath, metadata, { force });
    pubProcessed++;
    if (!res.cached) {
      console.log(`[corpus] Processed publication: ${fn} -> corpus/publications/${slug}.md`);
    }
  }

  let talkProcessed = 0;
  for (const fn of talkFiles) {
    const slug = fn.replace(/\.pdf$/, "");
    const pdfRel = `assets/pdf/talks/${fn}`;
    const pdfPath = path.join(talkDir, fn);
    const mdPath = path.join(TALK_CORPUS_DIR, `${slug}.md`);

    // Accurate matching with bib entry
    let entry = talkEntries.find(
      (e) => e.fields.slides && (e.fields.slides.endsWith("/" + fn) || e.fields.slides === pdfRel || e.fields.slides === fn)
    );
    if (!entry) {
      entry = talkEntries.find((e) => e.key === slug || e.key.toLowerCase() === slug.toLowerCase());
    }

    const authors = entry
      ? Array.isArray(entry.authors)
        ? entry.authors.join(", ")
        : entry.fields.author || SITE.short_name
      : SITE.short_name;
    const venue = entry ? entry.fields.booktitle || "" : "";
    const metadata = {
      title: entry ? entry.fields.title : slug,
      authors,
      venue,
      year: entry ? entry.fields.year : "",
      type: "Talk",
      pdf: pdfRel,
      html: entry ? entry.fields.html || "" : "",
      key: entry ? entry.key : slug,
    };

    const res = await parsePdfToCorpusMarkdown(pdfPath, mdPath, metadata, { force });
    talkProcessed++;
    if (!res.cached) {
      console.log(`[corpus] Processed talk: ${fn} -> corpus/talks/${slug}.md`);
    }
  }

  console.log(`[corpus] Corpus ready: ${pubProcessed} publications, ${talkProcessed} talks available.`);
}

export function getCorpusEntries() {
  const entries = [];
  if (fs.existsSync(PUB_CORPUS_DIR)) {
    for (const f of fs.readdirSync(PUB_CORPUS_DIR).filter((x) => x.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(PUB_CORPUS_DIR, f), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      entries.push({
        slug: f.replace(/\.md$/, ""),
        category: "publications",
        meta,
        markdown: body,
      });
    }
  }
  if (fs.existsSync(TALK_CORPUS_DIR)) {
    for (const f of fs.readdirSync(TALK_CORPUS_DIR).filter((x) => x.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(TALK_CORPUS_DIR, f), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      entries.push({
        slug: f.replace(/\.md$/, ""),
        category: "talks",
        meta,
        markdown: body,
      });
    }
  }
  return entries;
}

export function renderCorpusPage(item) {
  const { meta, markdown, slug, category } = item;
  const isPub = category === "publications";
  const typeLabel = isPub ? "Publication Manuscript" : "Presentation Slides";
  const typeBadge = isPub ? "Publication" : "Talk";
  const backHash = isPub ? "#publications" : "#talks";
  const backText = isPub ? "Back to Publications" : "Back to Conf & Talks";

  const pdfUrl = meta.pdf ? (meta.pdf.startsWith("/") ? meta.pdf : "/" + meta.pdf) : null;
  const htmlUrl = meta.html || null;

  const htmlContent = marked.parse(markdown);

  const actions = [];
  if (pdfUrl) {
    actions.push(
      `<a href="${escapeHtml(pdfUrl)}" class="corpus-action-btn primary" target="_blank" rel="noopener">` +
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/></svg>' +
      `<span>View Original PDF</span></a>`
    );
  }
  if (htmlUrl) {
    actions.push(
      `<a href="${escapeHtml(htmlUrl)}" class="corpus-action-btn" target="_blank" rel="noopener">` +
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/></svg>' +
      '<span>Publisher / Web Link</span></a>'
    );
  }
  actions.push(
    `<a href="/${backHash}" class="corpus-action-btn secondary">` +
    '<span>← Back to Homepage</span></a>'
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(meta.title || slug)} | Da Yan Research Corpus</title>
  <meta name="description" content="Full text research corpus entry for '${escapeHtml(meta.title || slug)}' by ${escapeHtml(meta.authors || SITE.short_name)}.">
  <script>
    (function () {
      var saved = localStorage.getItem('theme');
      var pref = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', saved || pref);
    })();
  </script>
  <link rel="icon" type="image/x-icon" href="/assets/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/stylesheet.css">
</head>
<body class="corpus-page">
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="corpus-topbar">
    <div class="container corpus-topbar-inner">
      <a href="/" class="corpus-home-link">
        <span class="corpus-site-title">${escapeHtml(SITE.short_name)}</span>
        <span class="corpus-site-sep">/</span>
        <span class="corpus-subbrand">Research Corpus</span>
      </a>
      <div class="corpus-topbar-nav">
        <a href="/${backHash}" class="corpus-back-pill">← ${escapeHtml(backText)}</a>
      </div>
    </div>
  </header>

  <main id="content" class="container corpus-container" data-pagefind-body>
    <article class="corpus-article">
      <header class="corpus-header">
        <div class="corpus-meta-row">
          <span class="corpus-badge ${category}" data-pagefind-filter="type" data-pagefind-meta="type">${typeBadge}</span>
          ${meta.year ? `<span class="corpus-year">${escapeHtml(meta.year)}</span>` : ""}
          <span class="corpus-type-label">${typeLabel}</span>
        </div>
        <h1 class="corpus-title" data-pagefind-meta="title">${escapeHtml(meta.title || slug)}</h1>
        ${meta.authors ? `<p class="corpus-authors">${escapeHtml(meta.authors)}</p>` : ""}
        ${meta.venue ? `<p class="corpus-venue">${escapeHtml(meta.venue)}</p>` : ""}
        <div class="corpus-actions" data-pagefind-ignore>
          ${actions.join("\n          ")}
        </div>
      </header>

      <section class="prose corpus-prose">
        ${htmlContent}
      </section>

      <footer class="corpus-footer" data-pagefind-ignore>
        <div class="corpus-actions">
          ${actions.join("\n          ")}
        </div>
        <p class="corpus-footer-note">This document is parsed and indexed by Da Yan's academic website search corpus.</p>
      </footer>
    </article>
  </main>
</body>
</html>`;
}

// Generate all corpus HTML pages into target output directory
export function generateCorpusSite({ outDir = path.join(ROOT, "dist") } = {}) {
  const entries = getCorpusEntries();
  const pubOutDir = path.join(outDir, "corpus", "publications");
  const talkOutDir = path.join(outDir, "corpus", "talks");
  fs.mkdirSync(pubOutDir, { recursive: true });
  fs.mkdirSync(talkOutDir, { recursive: true });

  for (const item of entries) {
    const targetDir = item.category === "publications" ? pubOutDir : talkOutDir;
    const htmlPath = path.join(targetDir, `${item.slug}.html`);
    fs.writeFileSync(htmlPath, renderCorpusPage(item), "utf8");
  }
  console.log(`[corpus] Generated ${entries.length} corpus HTML pages in ${path.relative(ROOT, outDir)}/corpus`);
  return entries;
}

// Direct execution CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const force = process.argv.includes("--force");
  await buildCorpus({ force });
}
