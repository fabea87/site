# -*- coding: utf-8 -*-
"""Generate minimal/index.html — 暖纸墨蓝编辑排版风格的极简单文件版主页。

用法：在仓库根目录运行  python minimal/generate.py
依赖：pybtex；数据源为仓库根目录的 publication_list.bib / talk_list.bib。
"""
import datetime
import html
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from build import (  # noqa: E402
    _PAPER_ARTEFACTS,
    _TALK_ARTEFACTS,
    _load_entries,
    build_cite,
    format_venue,
    generate_person_html,
)
from site_config import SITE  # noqa: E402


def esc(s, quote=True):
    return html.escape(str(s), quote=quote)


def esc_soft(s):
    """转义后还原已被配置层转义过的 &amp;，避免双重转义。"""
    return html.escape(str(s)).replace("&amp;amp;", "&amp;")


def group_years(entries):
    groups = {}
    for key, e in entries.items():
        y = e.fields.get("year", "").strip() or "n.d."
        groups.setdefault(y, []).append(key)
    return sorted(groups, key=lambda y: y if y.isdigit() else "0", reverse=True), groups


def artefact_links(fields, artefacts):
    parts = []
    for k, label in artefacts.items():
        if k in fields:
            parts.append(f'<a href="{esc(fields[k], quote=True)}" target="_blank" rel="noopener">{label}</a>')
    return ('<span class="sep"> · </span>').join(parts)


def thumb_html(img):
    if not img:
        return ""
    p = os.path.join(ROOT, img.replace("/", os.sep))
    if not os.path.exists(p):
        return ""
    return (
        f'<img class="thumb" src="../{esc(img)}" alt="" loading="lazy" '
        f'onerror="this.style.display=\'none\'">'
    )


def render_entry(key, e, artefacts):
    f = e.fields
    title = esc(f["title"])
    href = esc(f.get("html", "#"), quote=True)
    award = f'<span class="award">({esc(f["award"])})</span>' if "award" in f else ""
    if "equal_contribution" in f:
        authors = generate_person_html(e.persons["author"], equal_contribution=int(f["equal_contribution"]))
    else:
        authors = generate_person_html(e.persons["author"])
    venue = esc(format_venue(e))
    links = artefact_links(f, artefacts)
    cite = esc(build_cite(e, key))
    flag = '<p class="flag">※&#8202;Featured</p>' if "highlight" in f else ""
    bib = (
        f'<details class="bib"><summary>BibTeX</summary>'
        f"<pre><code>{cite}</code></pre></details>"
    )
    return f"""<article class="pub">
{thumb_html(f.get('img'))}{flag}
<h3 class="title"><a href="{href}" target="_blank" rel="noopener">{title}</a>{award}</h3>
<p class="authors">{authors}</p>
<p class="venue">{venue}</p>
{'<p class="links">' + links + '</p>' if links else ''}
{bib}
</article>"""


def render_section(entries, artefacts):
    years, groups = group_years(entries)
    out = []
    for y in years:
        n = len(groups[y])
        items = "\n".join(render_entry(k, entries[k], artefacts) for k in groups[y])
        out.append(
            f'<div class="year"><h2>{esc(y)}<span class="count">&#183;&#8202;{n}</span></h2>\n{items}\n</div>'
        )
    return "\n".join(out)


def interests_ul():
    li = "\n".join(f"<li>{esc(i)}</li>" for i in SITE["interests"])
    return f'<ul class="interests">\n{li}\n</ul>'


def contact_p():
    email = SITE["email"]
    items = [
        ("Email", f"mailto:{email}"),
        ("ORCID", f"https://orcid.org/{SITE['orcid']}"),
        ("Scholar", f"https://scholar.google.com/citations?user={SITE['scholar']}&hl=en"),
        ("GitHub", f"https://github.com/{SITE['github']}"),
        ("ResearchGate", "https://www.researchgate.net/profile/Da-Yan-3"),
    ]
    return ('<span class="sep"> &#183; </span>').join(
        f'<a href="{esc(h, quote=True)}" target="_blank" rel="noopener">{t}</a>' for t, h in items
    )


CSS = """/* ============================================================
   暖纸墨蓝 · minimal 单文件版 —— 色板 token 表
   --paper #f5f4ed   --paper-raised #faf9f3  --paper-sunken #efece0
   --ink-900 #24221b --ink-700 #403d33 --ink-500 #6b6658
   --ink-400 #8d887a --ink-300 #b3ad9d
   --line-strong #d7d1ba --line #e3ddc9 --line-soft #ebe6d3
   --accent #1B365D --accent-soft rgba(27,54,93,.10)
   --accent-line rgba(27,54,93,.35)
   --shadow-1 0 1px 2px rgba(80,72,44,.05)
   --shadow-2 0 2px 10px rgba(80,72,44,.07)
   ============================================================ */
:root {
  --paper: #f5f4ed;
  --paper-raised: #faf9f3;
  --paper-sunken: #efece0;
  --ink-900: #24221b;
  --ink-700: #403d33;
  --ink-500: #6b6658;
  --ink-400: #8d887a;
  --ink-300: #b3ad9d;
  --line-strong: #d7d1ba;
  --line: #e3ddc9;
  --line-soft: #ebe6d3;
  --accent: #1B365D;
  --accent-soft: rgba(27, 54, 93, 0.10);
  --accent-line: rgba(27, 54, 93, 0.35);
  --shadow-1: 0 1px 2px rgba(80, 72, 44, 0.05);
  --shadow-2: 0 2px 10px rgba(80, 72, 44, 0.07);
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink-700);
  font-family: Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
  font-size: 1.0625rem;
  line-height: 1.75;
  font-feature-settings: "onum" 1;
  text-rendering: optimizeLegibility;
}

.wrap { max-width: 44rem; margin: 0 auto; padding: 0 1.25rem; }

::selection { background: var(--accent-soft); }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-track { background: var(--paper); }
::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 2px; }
html { scrollbar-color: var(--line-strong) var(--paper); scrollbar-width: thin; }

/* ---- 链接：墨字 + 墨蓝细下划线 ---- */
a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--accent-line);
  text-underline-offset: 3px;
  transition: color 0.15s ease;
}
a:hover { color: var(--accent); text-decoration-thickness: 1.5px; }

/* ---- 页眉 ---- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.95rem;
}
.masthead .brand { font-weight: 700; color: var(--ink-900); text-decoration: none; }
.masthead nav a { margin-left: 1rem; }

/* ---- Hero ---- */
header.hero { padding: 3rem 0 0.5rem; }
.eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 1rem;
}
h1 {
  margin: 0 0 0.8rem;
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 700;
  line-height: 1.2;
  color: var(--ink-900);
}
h1 .suffix {
  font-size: 0.45em;
  font-weight: 400;
  font-style: italic;
  color: var(--ink-500);
  letter-spacing: 0;
}
.tagline { margin: 0 0 1.4rem; font-style: italic; color: var(--ink-500); font-size: 1.05rem; }
.bio p { margin: 0 0 1.1em; }
ruby rt { font-size: 0.55em; color: var(--ink-400); }

.actions { margin: 1.4rem 0 0; display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; }
.btn-primary {
  display: inline-block;
  padding: 0.45rem 1.1rem;
  background: var(--accent);
  color: var(--paper);
  text-decoration: none;
  border-radius: 2px;
  font-size: 0.95rem;
}
.btn-primary:hover { color: var(--paper); opacity: 0.92; }
.actions a.plain { font-size: 0.95rem; }

/* ---- 分隔花饰 ---- */
.orn { text-align: center; color: var(--ink-300); margin: 2.6rem 0; font-size: 1rem; user-select: none; }

/* ---- 区块 ---- */
section { padding: 0.5rem 0; }
.year h2 {
  margin: 2.2rem 0 0.9rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink-900);
  border-bottom: 1px solid var(--line-strong);
  padding-bottom: 0.45rem;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
.year h2 .count { font-size: 0.85rem; font-weight: 400; color: var(--ink-400); margin-left: 0.4rem; }

/* ---- 条目 ---- */
.pub {
  position: relative;
  margin: 0 0 1.6rem;
  padding: 0 0 1.4rem;
  border-bottom: 1px solid var(--line);
  display: flow-root;
}
.pub:last-child { border-bottom: none; }
.thumb {
  float: right;
  width: 96px;
  height: auto;
  margin: 0.25rem 0 0.6rem 1.1rem;
  border: 1px solid var(--line);
  filter: sepia(0.1) saturate(0.9);
}
.flag {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
h3.title { margin: 0 0 0.35rem; font-size: 1.15rem; font-weight: 700; line-height: 1.4; color: var(--ink-900); }
h3.title .award { font-weight: 400; font-style: italic; font-size: 0.9em; color: var(--ink-500); }
.authors { margin: 0 0 0.25rem; font-size: 0.95rem; }
.self-name { font-weight: 700; }
.venue { margin: 0 0 0.45rem; font-size: 0.95rem; font-style: italic; color: var(--ink-500); }
.links { margin: 0 0 0.4rem; font-size: 0.9rem; }
.links .sep { color: var(--ink-300); }

details.bib { font-size: 0.9rem; }
details.bib summary {
  cursor: pointer;
  list-style: none;
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent-line);
  text-underline-offset: 3px;
}
details.bib summary:hover { text-decoration-thickness: 1.5px; }
details.bib summary::-webkit-details-marker { display: none; }
details.bib[open] summary { margin-bottom: 0.5rem; }
details.bib pre {
  margin: 0;
  padding: 0.8rem 1rem;
  background: var(--paper-sunken);
  border: 1px solid var(--line);
  border-radius: 2px;
  font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--ink-500);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---- 兴趣列表 ---- */
ul.interests { margin: 0; padding-left: 1.3rem; columns: 2; column-gap: 2.5rem; font-size: 0.98rem; }
ul.interests li { margin: 0 0 0.45rem; break-inside: avoid; }
ul.interests li::marker { color: var(--accent); }

/* ---- 联系 ---- */
.contact p { margin: 0.4rem 0 0; font-size: 1rem; }
.contact .sep { color: var(--ink-300); }

/* ---- 页脚 ---- */
footer {
  margin: 3rem 0 0;
  padding: 1.4rem 0 2.6rem;
  border-top: 1px solid var(--line);
  font-size: 0.85rem;
  font-style: italic;
  color: var(--ink-400);
}

@media (max-width: 640px) {
  .masthead { flex-direction: column; gap: 0.2rem; }
  .masthead nav a:first-child { margin-left: 0; }
  .thumb { width: 76px; }
  ul.interests { columns: 1; }
}

@media print {
  body { background: #fff; color: #000; font-size: 11pt; }
  .masthead, .actions, details.bib, .orn { display: none !important; }
  .wrap { max-width: none; padding: 0; }
  .thumb { filter: none; }
  a { color: #000; text-decoration: none; }
}
"""


def main():
    pubs = _load_entries(os.path.join(ROOT, "publication_list.bib"))
    talks = _load_entries(os.path.join(ROOT, "talk_list.bib"))

    today = datetime.date.today()
    name0, name1 = SITE["name"]

    page = f"""<!doctype html>
<html lang="en">
<head>
<!--
暖纸墨蓝 · minimal 样式 —— 色板 token 表
  --paper #f5f4ed      页面底色（唯一背景）
  --paper-raised #faf9f3  浮起面
  --paper-sunken #efece0  凹陷面（代码块）
  --ink-900 #24221b  标题        --ink-700 #403d33 正文
  --ink-500 #6b6658  次要文字     --ink-400 #8d887a 弱说明
  --ink-300 #b3ad9d  占位/饰符
  --line-strong #d7d1ba  重边框   --line #e3ddc9 常规边框
  --accent #1B365D   墨蓝强调（链接/眉题/焦点/唯一按钮）
  --accent-soft rgba(27,54,93,.10)   --accent-line rgba(27,54,93,.35)
  --shadow-1 0 1px 2px rgba(80,72,44,.05)
  --shadow-2 0 2px 10px rgba(80,72,44,.07)
-->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{esc(name0)}, Ph.D. — {esc_soft(SITE["tagline"])}</title>
<meta name="description" content="{esc(SITE["description"], quote=True)}">
<style>
{CSS}</style>
</head>
<body>
<div class="wrap">

<div class="masthead">
  <a class="brand" href="#top">Da Yan</a>
  <nav>
    <a href="#interests">Interests</a>
    <a href="#publications">Publications</a>
    <a href="#conferences">Conferences</a>
    <a href="#contact">Contact</a>
  </nav>
</div>

<header class="hero" id="top">
  <p class="eyebrow">Curriculum Vitae &#38; Research</p>
  <h1>{esc(name0)}<span class="suffix">{esc(name1)}</span></h1>
  <p class="tagline">{esc_soft(SITE["tagline"])}</p>
  <div class="bio">
  {SITE["bio_text"]}
  </div>
  <div class="actions">
    <a class="btn-primary" href="{esc(SITE["cv_en"], quote=True)}" target="_blank" rel="noopener">CV&nbsp;&darr;</a>
    <a class="plain" href="mailto:{esc(SITE["email"])}">Mail</a>
    <a class="plain" href="https://scholar.google.com/citations?user={esc(SITE["scholar"])}&amp;hl=en" target="_blank" rel="noopener">Scholar</a>
    <a class="plain" href="https://github.com/{esc(SITE["github"])}" target="_blank" rel="noopener">GitHub</a>
  </div>
</header>

<div class="orn">&#10086;</div>

<section id="interests">
  <p class="eyebrow">Research Interests</p>
  {interests_ul()}
</section>

<div class="orn">&#10086;</div>

<section id="publications">
  <p class="eyebrow">Publications</p>
  {render_section(pubs, _PAPER_ARTEFACTS)}
</section>

<div class="orn">&#10086;</div>

<section id="conferences">
  <p class="eyebrow">Conferences</p>
  {render_section(talks, _TALK_ARTEFACTS)}
</section>

<div class="orn">&#10086;</div>

<section id="contact" class="contact">
  <p class="eyebrow">Contact</p>
  <p>{contact_p()}</p>
</section>

<footer>
  <p>&#169; {today.year} {esc(name0)} &#183; Last updated {today.isoformat()} &#183; set in Georgia on warm parchment</p>
</footer>

</div>
</body>
</html>
"""

    out_dir = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(out_dir, "index.html")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(page)
    print(f"written: {out} ({os.path.getsize(out)//1024} KB)")


if __name__ == "__main__":
    main()
