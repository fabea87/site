#!/usr/bin/env node
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "blog");

function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

function frontMatter(title, date, summary, tags) {
  const lines = ["---", `title: ${title}`, `date: ${date}`];
  if (summary) lines.push(`summary: ${summary}`);
  if (tags && tags.length > 0) lines.push(`tags: ${tags.join(", ")}`);
  lines.push("---");
  return lines.join("\n");
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function pad(num) {
  return String(num).padStart(2, "0");
}

function formatNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return {
    dateStr: `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`,
    filePrefix: `${yyyy}-${mm}-${dd}-${hh}${min}`,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    console.log("Existing blog posts metadata:\n");
    const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md")).sort();
    for (const fn of files) {
      const content = fs.readFileSync(path.join(BLOG_DIR, fn), "utf8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      console.log(`  ${fn}`);
      if (match) {
        for (const line of match[1].split(/\r?\n/)) {
          const col = line.indexOf(":");
          if (col !== -1) {
            const k = line.slice(0, col).trim();
            const v = line.slice(col + 1).trim();
            console.log(`    ${k.padEnd(8)}= ${v}`);
          }
        }
      }
      console.log();
    }
    return;
  }

  let title = "";
  let summary = "";
  let tags = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-s" || args[i] === "--summary") {
      summary = args[++i] || "";
    } else if (args[i] === "-t" || args[i] === "--tags") {
      const rawTags = args[++i] || "";
      tags = rawTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    } else if (!args[i].startsWith("-") && !title) {
      title = args[i];
    }
  }

  if (!title) {
    title = await ask("Post title: ");
    if (!title) {
      console.log("No title specified. Exiting.");
      return;
    }
  }

  if (!summary) {
    summary = await ask("Summary (optional, press Enter to skip): ");
  }

  if (tags.length === 0) {
    const rawTags = await ask("Tags (comma separated, optional, press Enter to skip): ");
    if (rawTags) {
      tags = rawTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    }
  }

  const { dateStr, filePrefix } = formatNow();
  const slug = slugify(title);
  const fname = `${filePrefix}-${slug}.md`;
  const filePath = path.join(BLOG_DIR, fname);

  if (fs.existsSync(filePath)) {
    console.error(`! File already exists: ${filePath}`);
    process.exit(1);
  }

  const fm = frontMatter(title, dateStr, summary, tags);
  const body = `# ${title}\n\n<!-- TODO: Write content here -->\n`;
  fs.writeFileSync(filePath, `${fm}\n\n${body}`, "utf8");

  console.log(`Created: blog/${fname}`);
  console.log(`  title = ${title}`);
  console.log(`  date  = ${dateStr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
