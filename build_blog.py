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
import json
import os
import re
import sys
from email.utils import formatdate

sys.stdout.reconfigure(encoding="utf-8")

from site_config import SITE  # noqa: E402
from build import get_nav_html  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
# 源文件目录（*.md）与生成输出目录（public/blog/）
BLOG_DIR = os.path.join(ROOT, "blog")
BLOG_OUT_DIR = os.path.join(ROOT, "public", "blog")
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
    """解析可选的 YAML Front Matter（--- 包围的简单 key: value 行），
    返回 (title, date, summary, tags, body)。

    支持字段：title / summary / tags / date（创作时间，格式 YYYY-MM-DD[ HH:MM[:SS]]）。
    date 缺省时返回 None，由调用方回退到文件 mtime。
    """
    title = date = summary = None
    tags = []
    body = md
    if md.startswith("---"):
        end = md.find("\n---", 3)
        if end != -1:
            fm = md[3:end]
            body = md[end + 4:].lstrip("\n")
            for line in fm.splitlines():
                line = line.strip()
                if not line or line.startswith("#") or ":" not in line:
                    continue
                k, v = line.split(":", 1)
                k = k.strip().lower()
                v = v.strip().strip("'\"")
                if k == "title":
                    title = v
                elif k == "summary":
                    summary = v
                elif k == "tags":
                    tags = [t.strip() for t in re.split("[,，]", v) if t.strip()]
                elif k in ("date", "created", "created_at"):
                    date = _parse_date(v)
    return title, date, summary, tags, body


def _parse_date(v):
    """把 front matter 的日期字符串解析为 'YYYY-MM-DD HH:MM:SS'；失败返回 None。"""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.datetime.strptime(v.strip(), fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None


def slug_of(filename):
    """去掉 .md 与日期前缀，得到 URL slug；重复则由文件名后缀保证。"""
    stem = os.path.splitext(filename)[0]
    m = re.match(r"^\d{4}-\d{2}-\d{2}(-\d{4})?-(.+)$", stem)
    return m.group(2) if m else stem


# --------------------------------------------------------------------------
# 页面生成
# --------------------------------------------------------------------------

def nav_html():
    """导航单一来源：直接复用 build.py 的 get_nav_html（blog/ 子目录前缀）。"""
    return get_nav_html(root="../", home="../index.html")


def page(title, body, meta_desc="", canonical=None, ld_json=None):
    """博客页面骨架。canonical 用绝对 URL；ld_json 为 JSON-LD 字符串（可省略）。"""
    site_url = SITE["url"].rstrip("/")
    short_name = SITE["short_name"]
    head = []
    if meta_desc:
        head.append(f'<meta name="description" content="{html.escape(meta_desc, quote=True)}">')
    if canonical:
        head.append(f'<link rel="canonical" href="{html.escape(canonical, quote=True)}">')
        head.append('<meta property="og:type" content="article">')
        head.append(f'<meta property="og:title" content="{html.escape(title, quote=True)}">')
        if meta_desc:
            head.append(f'<meta property="og:description" content="{html.escape(meta_desc, quote=True)}">')
        head.append(f'<meta property="og:url" content="{html.escape(canonical, quote=True)}">')
    head.append(
        f'<link rel="alternate" type="application/rss+xml" '
        f'title="{html.escape(short_name)} — Blog" href="{site_url}/feed.xml">'
    )
    if ld_json:
        head.append("<script type=\"application/ld+json\">\n" + ld_json + "\n</script>")
    seo = "\n  ".join(head)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{html.escape(title)}</title>
  {seo}
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
    return page(
        "Blog · Da Yan",
        body,
        meta_desc="Blog posts by Da Yan on CALL, feedback, and language data science.",
        canonical=SITE["url"].rstrip("/") + "/blog/",
    )


def render_post(date, title, content_html, slug="", summary="", tags=None):
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
    meta_desc = summary or (title + " — blog post on Da Yan's homepage.")
    site_url = SITE["url"].rstrip("/")
    url = f"{site_url}/blog/{slug}.html"
    post_json = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "url": url,
        "mainEntityOfPage": url,
        "datePublished": (date or TODAY).replace(" ", "T"),
        "dateModified": (date or TODAY).replace(" ", "T"),
        "inLanguage": "en",
        "author": {
            "@type": "Person",
            "name": SITE["short_name"],
            "url": site_url + "/",
        },
        "publisher": {"@type": "Person", "name": SITE["short_name"]},
        "image": site_url + "/assets/img/profile.jpg",
        "description": meta_desc,
        "keywords": tags or [],
    }
    return page(
        title + " · Da Yan",
        body,
        meta_desc=meta_desc,
        canonical=url,
        ld_json=json.dumps(post_json, ensure_ascii=False, indent=2),
    )


def collect_posts():
    """读取 blog/*.md，返回按日期倒序的元组列表 (date, stem, title, summary, md, tags)。"""
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
        # 发布时间优先用 front matter 的 date，缺省时回退到文件修改时间（mtime）
        if not date:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path))
            date = mtime.strftime("%Y-%m-%d %H:%M:%S")
        posts.append((date, stem, title, summary or "", body, tags))
    # 按发布时间倒序（最新在前）
    posts.sort(key=lambda p: p[0], reverse=True)
    return posts


# --------------------------------------------------------------------------
# SEO 附属文件：robots.txt / sitemap.xml / feed.xml
# --------------------------------------------------------------------------

def _write_file(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"Written {os.path.relpath(path, ROOT)}.")


def _rfc822(date):
    """'YYYY-MM-DD HH:MM:SS' -> RFC 822（RSS 用），按 UTC 处理。"""
    try:
        dt = datetime.datetime.strptime(date, "%Y-%m-%d %H:%M:%S")
        dt = dt.replace(tzinfo=datetime.timezone.utc)
        return formatdate(dt.timestamp(), usegmt=True)
    except (TypeError, ValueError):
        return formatdate(usegmt=True)


def write_seo_files(posts):
    """生成 robots.txt、sitemap.xml、feed.xml（RSS 2.0，全文）。"""
    site_url = SITE["url"].rstrip("/")
    out_dir = os.path.dirname(BLOG_OUT_DIR)  # public/

    _write_file(
        os.path.join(out_dir, "robots.txt"),
        f"User-agent: *\nAllow: /\n\nSitemap: {site_url}/sitemap.xml\n",
    )

    urls = [(site_url + "/", TODAY), (site_url + "/blog/", TODAY)]
    urls += [(f"{site_url}/blog/{p['slug']}.html", p["date"][:10]) for p in posts]
    entries = "\n".join(
        f"  <url>\n    <loc>{html.escape(u)}</loc>\n    <lastmod>{d}</lastmod>\n  </url>"
        for u, d in urls
    )
    _write_file(
        os.path.join(out_dir, "sitemap.xml"),
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n</urlset>\n",
    )

    items = []
    for p in posts:
        url = f"{site_url}/blog/{p['slug']}.html"
        cats = "".join(f"\n    <category>{html.escape(t)}</category>" for t in p["tags"])
        content = p["html"].replace("]]>", "]]&gt;")
        items.append(
            "  <item>\n"
            f"    <title>{html.escape(p['title'])}</title>\n"
            f"    <link>{url}</link>\n"
            f'    <guid isPermaLink="true">{url}</guid>\n'
            f"    <pubDate>{_rfc822(p['date'])}</pubDate>\n"
            f"    <description>{html.escape(p['summary'] or p['title'])}</description>{cats}\n"
            f"    <content:encoded><![CDATA[{content}]]></content:encoded>\n"
            "  </item>"
        )
    last_build = _rfc822(posts[0]["date"]) if posts else formatdate(usegmt=True)
    _write_file(
        os.path.join(out_dir, "feed.xml"),
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"'
        ' xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n'
        f"  <title>{html.escape(SITE['short_name'])} — Blog</title>\n"
        f"  <link>{site_url}/blog/</link>\n"
        "  <description>Notes on CALL, feedback, and language data science.</description>\n"
        "  <language>en</language>\n"
        f"  <lastBuildDate>{last_build}</lastBuildDate>\n"
        f'  <atom:link href="{site_url}/feed.xml" rel="self" type="application/rss+xml"/>\n'
        f"{chr(10).join(items)}\n</channel>\n</rss>\n",
    )


def generate_blog():
    posts = []
    for date, stem, title, summary, body, tags in collect_posts():
        posts.append({
            "date": date,
            "slug": slug_of(stem),
            "title": title,
            "summary": summary,
            "tags": tags,
            "body": body,
            "html": md_to_html(body),
        })
    os.makedirs(BLOG_OUT_DIR, exist_ok=True)
    index_rows = [(p["date"], p["slug"], p["title"], p["summary"]) for p in posts]
    _write_file(os.path.join(BLOG_OUT_DIR, "index.html"), render_index(index_rows))
    for p in posts:
        _write_file(
            os.path.join(BLOG_OUT_DIR, p["slug"] + ".html"),
            render_post(p["date"], p["title"], p["html"],
                        slug=p["slug"], summary=p["summary"], tags=p["tags"]),
        )
    print(f"Blog: {len(posts)} post(s) -> public/blog/index.html + {len(posts)} page(s)")
    write_seo_files(posts)


if __name__ == "__main__":
    generate_blog()