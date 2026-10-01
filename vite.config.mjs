import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";
import { execSync } from "child_process";

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
  };
  const blogDir = resolve(rootDir, "blog");
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir);
    for (const f of files) {
      if (f.endsWith(".html")) {
        const name = "blog_" + f.replace(/\.html$/, "");
        inputs[name] = resolve(blogDir, f);
      }
    }
  }
  return inputs;
}

function academicSitePlugin() {
  return {
    name: "academic-site-generator",
    buildStart() {
      console.log("[vite] Running Python static site generator...");
      execSync("python build.py", { cwd: rootDir, stdio: "inherit" });
    },
    closeBundle() {
      // Ensure raw static assets like PDFs and SEO files are available in dist
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
    },
    configureServer(server) {
      try {
        console.log("[vite] Dev server start: generating HTML...");
        execSync("python build.py", { cwd: rootDir, stdio: "inherit" });
      } catch (err) {
        console.error("[vite] Failed to generate HTML on start:", err);
      }

      const watchItems = [
        "publication_list.bib",
        "talk_list.bib",
        "site_config.py",
        "build.py",
        "build_blog.py",
        "blog",
      ];
      watchItems.forEach((item) => {
        const p = resolve(rootDir, item);
        if (fs.existsSync(p)) server.watcher.add(p);
      });

      server.watcher.on("change", (file) => {
        if (
          file.endsWith(".bib") ||
          file.endsWith(".md") ||
          file.endsWith(".py")
        ) {
          console.log(`[vite] Source content changed (${file}), regenerating...`);
          try {
            execSync("python build.py", { cwd: rootDir, stdio: "inherit" });
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
