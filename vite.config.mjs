import { defineConfig } from "vite";
import { resolve, extname } from "path";
import { execSync } from "child_process";
import fs from "fs";
import {
  generateSite,
  generateIndexHtml,
  cleanGeneratedHtml,
  getBlogPosts,
  renderBlogIndex,
  renderBlogPost,
  generateRobotsTxt,
  generateSitemapXml,
  generateFeedXml,
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

function getVirtualHtmlRoutes() {
  const posts = getBlogPosts();
  const routes = new Map();

  const mainPath = resolve(rootDir, "index.html");
  const blogIndexPath = resolve(rootDir, "blog", "index.html");

  routes.set(mainPath, () => generateIndexHtml());
  routes.set(blogIndexPath, () => renderBlogIndex(posts));

  const inputs = {
    main: mainPath,
    blog_index: blogIndexPath,
  };

  for (const post of posts) {
    const postPath = resolve(rootDir, "blog", `${post.slug}.html`);
    routes.set(postPath, () => renderBlogPost(post));
    inputs[`blog_${post.slug}`] = postPath;
  }

  return { routes, inputs, posts };
}

function academicSitePlugin() {
  let isBuild = false;
  let virtualRoutes = null;

  return {
    name: "academic-site-generator",
    config(_config, { command }) {
      isBuild = command === "build";
    },
    buildStart() {
      cleanGeneratedHtml();
      virtualRoutes = getVirtualHtmlRoutes();
    },
    resolveId(id) {
      if (!virtualRoutes) virtualRoutes = getVirtualHtmlRoutes();
      if (virtualRoutes.routes.has(id)) {
        return id;
      }
    },
    load(id) {
      if (!virtualRoutes) virtualRoutes = getVirtualHtmlRoutes();
      if (virtualRoutes.routes.has(id)) {
        return virtualRoutes.routes.get(id)();
      }
    },
    generateBundle() {
      if (!isBuild) return;
      const posts = getBlogPosts();
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: generateRobotsTxt(),
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: generateSitemapXml(posts),
      });
      this.emitFile({
        type: "asset",
        fileName: "feed.xml",
        source: generateFeedXml(posts),
      });

      const faviconPath = resolve(rootDir, "assets", "favicon.ico");
      if (fs.existsSync(faviconPath)) {
        this.emitFile({
          type: "asset",
          fileName: "favicon.ico",
          source: fs.readFileSync(faviconPath),
        });
      }
    },
    closeBundle() {
      if (!isBuild) return;
      console.log("[vite] Syncing static PDF and image assets to dist...");
      const distDir = resolve(rootDir, "dist");
      copyDirRecursive(resolve(rootDir, "assets", "pdf"), resolve(distDir, "assets", "pdf"));
      copyDirRecursive(resolve(rootDir, "assets", "img"), resolve(distDir, "assets", "img"));

      console.log("[vite] Building Pagefind search index...");
      try {
        execSync("npx pagefind --site dist", { stdio: "inherit" });
      } catch (err) {
        console.warn("[vite] Pagefind indexing warning:", err);
      }

      cleanGeneratedHtml();
      console.log("[vite] Verified workspace code folder is completely clean.");
    },
    configureServer(server) {
      cleanGeneratedHtml();

      const pagefindDir = resolve(rootDir, "dist", "pagefind");
      if (!fs.existsSync(pagefindDir)) {
        console.log("[vite] Dev server start: generating initial Pagefind search index...");
        try {
          generateSite({ outDir: resolve(rootDir, "dist") });
        } catch (err) {
          console.warn("[vite] Pagefind index generation warning:", err);
        }
      }

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url?.split("?")[0] || "";

        // 1. Homepage
        if (rawUrl === "/" || rawUrl === "/index.html") {
          try {
            const rawHtml = generateIndexHtml();
            const html = await server.transformIndexHtml("/", rawHtml);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          } catch (e) {
            return next(e);
          }
        }

        // 2. Blog list
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

        // 3. Blog post
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

        // 4. Dynamic SEO & favicon endpoints
        if (rawUrl === "/robots.txt") {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(generateRobotsTxt());
          return;
        }

        if (rawUrl === "/sitemap.xml") {
          const posts = getBlogPosts();
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(generateSitemapXml(posts));
          return;
        }

        if (rawUrl === "/feed.xml") {
          const posts = getBlogPosts();
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(generateFeedXml(posts));
          return;
        }

        if (rawUrl === "/favicon.ico") {
          const faviconPath = resolve(rootDir, "assets", "favicon.ico");
          if (fs.existsSync(faviconPath)) {
            res.setHeader("Content-Type", "image/x-icon");
            res.end(fs.readFileSync(faviconPath));
            return;
          }
        }

        // 5. Pagefind assets in dev mode
        if (rawUrl.startsWith("/pagefind/")) {
          const rel = rawUrl.slice("/pagefind/".length);
          const filePath = resolve(rootDir, "dist", "pagefind", rel);
          if (fs.existsSync(filePath)) {
            const ext = extname(filePath);
            const mimeMap = {
              ".js": "application/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".json": "application/json; charset=utf-8",
              ".pf_meta": "application/octet-stream",
              ".pf_index": "application/octet-stream",
              ".pf_fragment": "application/octet-stream",
              ".pagefind": "application/octet-stream",
              ".wasm": "application/wasm",
            };
            res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
            res.end(fs.readFileSync(filePath));
            return;
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
        "assets",
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
          file.endsWith(".svg") ||
          file.endsWith(".css")
        ) {
          console.log(`[vite] Source content changed (${file}), sending reload...`);
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [academicSitePlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: getVirtualHtmlRoutes().inputs,
    },
  },
});
