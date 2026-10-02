import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";
import {
  generateSite,
  cleanBlogHtml,
  getBlogPosts,
  renderBlogIndex,
  renderBlogPost,
  slugOf,
} from "./scripts/generate.js";

const rootDir = import.meta.dirname;

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getHtmlInputs() {
  const inputs = {
    main: resolve(rootDir, "index.html"),
    blog_index: resolve(rootDir, "blog", "index.html"),
  };
  const blogDir = resolve(rootDir, "blog");
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir);
    for (const f of files) {
      if (f.endsWith(".md")) {
        const slug = slugOf(f);
        inputs["blog_" + slug] = resolve(blogDir, `${slug}.html`);
      }
    }
  }
  return inputs;
}

function academicSitePlugin() {
  return {
    name: "academic-site-generator",
    buildStart() {
      // During production build, generate temporary HTMLs for Rollup bundling
      generateSite({ writeBlogHtml: true });
    },
    closeBundle() {
      console.log("[vite] Syncing static assets to dist...");
      const distDir = resolve(rootDir, "dist");
      const pdfSrc = resolve(rootDir, "assets", "pdf");
      const pdfDest = resolve(distDir, "assets", "pdf");
      copyDirRecursive(pdfSrc, pdfDest);

      const pubDir = resolve(rootDir, "public");
      for (const fn of ["feed.xml", "sitemap.xml", "robots.txt", "favicon.ico"]) {
        const srcFile = resolve(pubDir, fn);
        const destFile = resolve(distDir, fn);
        if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
          fs.copyFileSync(srcFile, destFile);
        }
      }

      // Keep blog/ strictly clean with only *.md files
      cleanBlogHtml();
      console.log("[vite] Cleaned up temporary blog HTMLs. Only .md files retained in blog/.");
    },
    configureServer(server) {
      try {
        console.log("[vite] Dev server start: generating HTML and SEO files...");
        generateSite({ writeBlogHtml: false });
        cleanBlogHtml();
      } catch (err) {
        console.error("[vite] Failed to generate on start:", err);
      }

      // Dev middleware: serve blog pages dynamically from .md files with zero HTML files on disk
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url?.split("?")[0] || "";
        if (rawUrl === "/blog" || rawUrl === "/blog/" || rawUrl === "/blog/index.html") {
          try {
            const posts = getBlogPosts();
            const rawHtml = renderBlogIndex(posts);
            const html = await server.transformIndexHtml("/blog/index.html", rawHtml);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          } catch (e) {
            return next(e);
          }
        }
        if (rawUrl.startsWith("/blog/") && rawUrl.endsWith(".html")) {
          const slug = rawUrl.slice("/blog/".length).replace(/\.html$/, "");
          try {
            const posts = getBlogPosts();
            const post = posts.find((p) => p.slug === slug);
            if (post) {
              const rawHtml = renderBlogPost(post);
              const html = await server.transformIndexHtml(rawUrl, rawHtml);
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(html);
              return;
            }
          } catch (e) {
            return next(e);
          }
        }
        next();
      });

      const watchItems = [
        "publication_list.bib",
        "talk_list.bib",
        "site.config.js",
        "scripts",
        "blog",
        "assets/img/icons",
      ];
      watchItems.forEach((item) => {
        const p = resolve(rootDir, item);
        if (fs.existsSync(p)) server.watcher.add(p);
      });

      server.watcher.on("change", (file) => {
        if (
          file.endsWith(".bib") ||
          file.endsWith(".md") ||
          file.endsWith(".js") ||
          file.endsWith(".svg")
        ) {
          console.log(`[vite] Source content changed (${file}), regenerating...`);
          try {
            generateSite({ writeBlogHtml: false });
            server.ws.send({ type: "full-reload" });
          } catch (err) {
            console.error("[vite] Content regeneration failed:", err);
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [academicSitePlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: getHtmlInputs(),
    },
  },
});
