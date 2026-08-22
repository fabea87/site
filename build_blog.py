# -*- coding: utf-8 -*-
"""静态 Blog 生成器。

读取 blog/*.md（Markdown 源文件），生成：
  blog/index.html          博客列表页
  blog/<文件名>.html       每篇文章独立页面

md 约定：
  - 头条完全由 Markdown 内容构成：标题取第一个 # 标题；
    发布时间取文件的修改时间（mtime，精确到秒），md 内部不需要任何日期元数据
  - 可选 front matter（文件开头，仅用于补充信息，均可省略）：
      ---
      title: 标题          # 缺省时取第一个 # 标题
      summary: 一句话简介   # 用于列表页
      tags: 标签, 逗号分隔
      ---
  - 文件名建议 文章slug.md；如保留 YYYY-MM-DD- 前缀会被从 URL 中剥离

零依赖（只用标准库）。在仓库根目录运行 python build_blog.py，
或在 build.py / build_site.py 中调用 generate_blog()。
"""
import datetime
import html
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

from site_config import SITE  # noqa: E402
from build import get_nav_html  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
BLOG_DIR = os.path.join(ROOT, "blog")
TODAY = datetime.date.today().isoformat()

FONTS_LINK = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '  <link href="https://fonts.googleapis.com/css2?family=Bona+Nova+SC:wght@400;700'
    '&family=IBM+Plex+Serif:ital,wght@0,400;0,700;1,400'
    '&family=Lora:wght@400;700'
    '&family=Noto+Serif+SC:wght@400;600&display=swap" rel="stylesheet">'
)

CSS_LINK = '<link rel="stylesheet" href="../assets/stylesheet.css">'
FAVICON = '<link rel="icon" type="image/x-icon" href="../assets/favicon.ico">'


# --------------------------------------------------------------------------
# 轻量 Markdown -> HTML（标准库实现）
# --------------------------------------------------------------------------

def _inline(text):
    """对已 HTML 转义过的文本应用行内语法：code / 图片 / 链接 / 粗 / 斜。"""
    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", r'<img alt="\1" src="\2" loading="lazy">', text)
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', text)
    text = text.replace("**", "\x00B\x00")  # 临时保护，避免与 * 冲突
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    text = text.replace("\x00B\x00", "**")
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", text)
    return text


def _is_block_start(line):
    if re.match(r"^(#{1,6})\s", line):
        return True
    if line.startswith("```"):
        return True
    if re.match(r"^\s*([-*+]|\d+\.)\s", line):
        return True
    if line.startswith(">"):
        return True
    if re.match(r"^(-{3,}|\*{3,})\s*$", line):
        return True
    return False


def md_to_html(md):
    lines = md.splitlines()
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        # 围栏代码块
        m = re.match(r"^```(\w*)\s*$", line)
        if m:
            buf = []
            i += 1
            while i < n and not re.match(r"^```\s*$", lines[i]):
                buf.append(lines[i])
                i += 1
            i += 1  # 关闭围栏
            code = html.escape("\n".join(buf))
            out.append(f"<pre><code>{code}</code></pre>")
            continue
        # 标题
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{_inline(html.escape(m.group(2)))}</h{lvl}>")
            i += 1
            continue
        # 分割线
        if re.match(r"^(-{3,}|\*{3,})\s*$", line):
            out.append("<hr>")
            i += 1
            continue
        # 引用
        if line.startswith(">"):
            buf = []
            while i < n and lines[i].startswith(">"):
                buf.append(lines[i][1:].lstrip())
                i += 1
            out.append(f"<blockquote>{md_to_html(chr(10).join(buf))}</blockquote>")
            continue
        # 列表
        m = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", line)
        if m:
            items = []
            ordered = False
            while i < n:
                m2 = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", lines[i])
                if not m2:
                    break
                if re.match(r"^\d+\.", m2.group(1)):
                    ordered = True
                items.append(_inline(html.escape(m2.group(2))))
                i += 1
            tag = "ol" if ordered else "ul"
            lis = "".join(f"<li>{it}</li>" for it in items)
            out.append(f"<{tag}>{lis}</{tag}>")
            continue
        # 段落：收集到空行或块起始
        buf = [line]
        i += 1
        while i < n and lines[i].strip() and not _is_block_start(lines[i]):
            buf.append(lines[i])
            i += 1
        para = " ".join(x.strip() for x in buf)
        out.append(f"<p>{_inline(html.escape(para))}</p>")
    return "\n".join(out)


def parse_front(md):
    """解析可选 front matter，返回 (title, date, summary, tags, body)。
    date 恒为 None——发布时间统一由文件 mtime 决定。"""
    title = date = summary = None
    tags = []
    body = md
    if md.startswith("---"):
        end = md.find("\n---", 3)
        if end != -1:
            fm = md[3:end]
            body = md[end + 4:].lstrip("\n")
            for line in fm.splitlines():
                if ":" not in line:
                    continue
                k, v = line.split(":", 1)
                k = k.strip().lower()
                v = v.strip().strip('"\'')
                if k == "title":
                    title = v
                elif k == "summary":
                    summary = v
                elif k == "tags":
                    tags = [t.strip() for t in v.split(",") if t.strip()]
    return title, date, summary, tags, body


def slug_of(filename):
    """去掉 .md 与日期前缀，得到 URL slug；重复则由文件名后缀保证。"""
    stem = os.path.splitext(filename)[0]
    m = re.match(r"^\d{4}-\d{2}-\d{2}-(.+)$", stem)
    return m.group(1) if m else stem


# --------------------------------------------------------------------------
# 页面生成
# --------------------------------------------------------------------------

def nav_html():
    """导航单一来源：直接复用 build.py 的 get_nav_html（blog/ 子目录前缀）。"""
    return get_nav_html(root="../", home="../index.html")


def page(title, body, meta_desc=""):
    desc = f'\n  <meta name="description" content="{html.escape(meta_desc, quote=True)}">' if meta_desc else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{html.escape(title)}</title>{desc}
  {FAVICON}
  {FONTS_LINK}
  {CSS_LINK}
</head>
<body>
{nav_html()}
<main>
  <div class="container">
{body}
  </div>
</main>
<footer class="site-footer">
  <p>© {TODAY[:4]} {html.escape(SITE["short_name"])} · Last updated {TODAY} · <a href="../index.html">Back to homepage</a></p>
  <p>This website follows the design of <a href="https://m-niemeyer.github.io/" target="_blank">Michael Niemeyer</a> and <a href="https://jonbarron.info/" target="_blank">Jon Barron</a>.</p>
</footer>
</body>
</html>"""


def render_index(posts):
    rows = []
    for date, stem, title, summary in posts:
        date_html = f'<span class="blog-date">{html.escape(date)}</span>' if date else ""
        sum_html = f'<p class="blog-summary">{html.escape(summary)}</p>' if summary else ""
        rows.append(
            f'<li><a href="{html.escape(stem)}.html">{date_html}'
            f'<span class="blog-title">{html.escape(title)}</span></a>{sum_html}</li>'
        )
    body = f"""<section class="section">
  <h2 class="section-heading">Blog</h2>
  <p class="blog-intro">Notes on CALL, feedback, and language data science.</p>
  <ul class="blog-list">
{chr(10).join(rows)}
  </ul>
</section>"""
    return page("Blog · Da Yan", body)


def render_post(date, title, content_html):
    back = f'<p class="blog-back"><a href="index.html">← Back to Blog</a></p>'
    date_html = f'<p class="blog-date-large">{html.escape(date)}</p>' if date else ""
    body = f"""<article class="blog-post">
  {back}
  <h1 class="blog-title-large">{html.escape(title)}</h1>
  {date_html}
  <div class="prose">
{content_html}
  </div>
  {back}
</article>"""
    return page(title + " · Da Yan", body,
                 meta_desc=(title + " — blog post on Da Yan's homepage."))


def collect_posts():
    """读取 blog/*.md，返回按日期倒序的元组列表 (date, stem, title, summary, md)。"""
    if not os.path.isdir(BLOG_DIR):
        return []
    posts = []
    for fn in sorted(os.listdir(BLOG_DIR)):
        if not fn.endswith(".md"):
            continue
        path = os.path.join(BLOG_DIR, fn)
        with open(path, encoding="utf-8") as fh:
            md = fh.read()
        title, date, summary, tags, body = parse_front(md)
        stem = os.path.splitext(fn)[0]
        if not title:
            m = re.search(r"^#\s+(.+)$", body, re.M)
            title = m.group(1) if m else stem
        # 发布时间 = 文件修改时间；md 内无需日期元数据
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path))
        date = mtime.strftime("%Y-%m-%d %H:%M:%S")
        posts.append((date, stem, title, summary or "", body))
    # 按发布时间倒序（最新在前）
    posts.sort(key=lambda p: p[0], reverse=True)
    return posts


def generate_blog():
    posts = collect_posts()
    index_rows = [(d, s, t, su) for d, s, t, su, b in posts]
    with open(os.path.join(BLOG_DIR, "index.html"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(render_index(index_rows))
    for date, stem, title, summary, body in posts:
        out = os.path.join(BLOG_DIR, stem + ".html")
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(render_post(date, title, md_to_html(body)))
    print(f"Blog: {len(posts)} post(s) -> {os.path.join('blog', 'index.html')} + {len(posts)} page(s)")


if __name__ == "__main__":
    generate_blog()