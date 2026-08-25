---
title: Teaching My Agent to Blog: Building the blog-writing Skill
date: 2026-08-25 17:50:36
summary: How I turned my blog publishing workflow into a reusable agent skill — from front matter conventions to one-command build-and-deploy.
tags: AI, agent, skills, blogging
---

# Teaching My Agent to Blog: Building the blog-writing Skill

Today I did something a bit meta: I spent the morning building an agent skill whose entire purpose is to help me write and publish the very post you are reading right now.

Modern coding agents (like [pi](https://github.com/badlogic/pi-mono)) support a concept borrowed from Anthropic's Agent Skills standard: **skills** are self-contained capability packages — a directory with a `SKILL.md` file that contains instructions, conventions, and scripts. At startup, the agent only sees each skill's name and description; when a task matches, it loads the full instructions on demand. It's progressive disclosure for procedures.

So I packaged my entire blogging workflow into one. The result is `blog-writing`, and this post is its first real test.

## Why package a workflow at all?

Before the skill, every blog session meant re-explaining myself:

- Where the site repository lives on disk
- What front matter fields my static site generator expects
- How file naming affects URLs
- The exact build → verify → commit → push sequence that deploys via GitHub Actions

Each of these is small, but together they were friction — and worse, they were *unwritten knowledge* that I had to repeat from memory, risking inconsistency. A skill turns tribal knowledge into an executable checklist the agent follows mechanically.

## Anatomy of the skill

The whole thing is a single Markdown file. The most important part is the front matter — the `description` is what the agent uses to decide when to load the skill:

```markdown
---
name: blog-writing
description: 为 Da Yan 个人主页网站（GitHub 仓库 fabea87/site）撰写、修改和发布博客文章。当用户想写博客、发布新文章或修改现有博客时使用；通过脚手架脚本创建文章、撰写 Markdown 正文并一键构建 + git 推送部署到 GitHub Pages。
---
```

(Yes, the description is in Chinese — it matches how I actually talk to the agent.)

Then come the fixed paths. Since the skill should work from any working directory, everything is an absolute path to the site repo:

```markdown
## 固定路径（任何文件夹下都直接用这些绝对路径）

- 仓库根目录：`C:/Users/fabea/OneDrive/24 new homepage`
- 博客源文件：`C:/Users/fabea/OneDrive/24 new homepage/blog/*.md`
- 脚手架脚本：`C:/Users/fabea/OneDrive/24 new homepage/new_post.py`
- 构建脚本：`C:/Users/fabea/OneDrive/24 new homepage/build_site.py`（输出到其 `public/` 子目录）
```

The heart of the skill is the front matter contract my site generator depends on:

```yaml
---
title: 文章标题          # 必需
date: YYYY-MM-DD HH:MM:SS # 必需，决定列表排序；缺省回退到文件 mtime
summary: 一句话简介       # 可选，显示在列表页
tags: 标签1, 标签2        # 可选，逗号分隔（中英文逗号均可）
---
```

Encoding this as a comment-annotated YAML block means the agent never has to guess which fields are required versus optional.

## The four-step pipeline

The skill defines a semi-automated writing flow. Step 1 scaffolds a new post with a helper script that fills in the title and timestamp automatically — including the date-and-time prefix in the filename so multiple posts on one day never collide:

```bash
python "C:/Users/fabea/OneDrive/24 new homepage/new_post.py" "标题" -s "简介" -t "标签1,标签2"
```

Step 2 is the only human-heavy part: I write the actual prose (the agent drafts, I edit). Steps 3 and 4 collapse publishing into a one-liner plus verification rules:

```bash
cd "C:/Users/fabea/OneDrive/24 new homepage" && python build_site.py && git add -A && git commit -m "blog: <文章标题>" && git push
```

The skill even pins down conventions I used to keep in my head — like the commit message format (`blog: <title>` for new posts, `blog: update <title>` for edits) and the pre-push checks (build must succeed, the generated `public/blog/index.html` must contain the new title).

## What makes a good skill

Building this taught me a few things about skill design:

1. **The description is everything.** It's the only text always in context; it determines whether the agent reaches for your skill at all. Write it like a routing rule: what the skill does *and when to use it*.
2. **Absolute paths beat assumptions.** Skills live in a config directory but operate on project directories. Stating every path explicitly removes an entire class of failure.
3. **Encode judgment, not just commands.** The valuable parts aren't the shell one-liners — those I could always retype. It's the decision points: when to ask the user for a summary vs. omit it, what to verify before pushing, how to handle updating old posts without touching their sort date.
4. **Validate against the spec.** My first version was missing required front matter (`name`, `description`), which pi warns about and refuses to load. One edit fixed it.

## The meta moment

This post itself went through the full pipeline: scaffold → draft → build → verify → push. The skill loaded, ran the script, embedded these snippets correctly, and will deploy through GitHub Actions in about a minute.

There's something satisfying about a tool documenting its own first use. The next time I want to publish — maybe from a completely different folder, maybe six months from now — I won't need to remember any of this. The skill remembers for me.
