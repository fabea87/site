import os
import re
import html
import json
import datetime
from pybtex.database.input import bibtex

from site_config import SITE


# --------------------------------------------------------------------------
# 个人信息与页面文案（数据来自 site_config.py）
# --------------------------------------------------------------------------


def get_name():
    return SITE["name"]


def get_bio_text():
    return SITE["bio_text"]


def get_social_media_html():
    email = SITE["email"]
    scholar = SITE["scholar"]
    cv_en = SITE["cv_en"]
    cv_cn = SITE["cv_cn"]
    return f"""
                <div class="hero-links">
                <details class="about-details">
                <summary class="link-pill"><i class="fa-solid fa-graduation-cap"></i>About</summary>
                <div class="about-body">{SITE["bio"]}</div>
                </details>
                <div class="cv-menu">
                <button type="button" class="link-pill cv-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="cv-panel"><i class="fa-solid fa-address-card"></i>CV <span class="cv-chev">▾</span></button>
                <div class="cv-menu-panel" id="cv-panel">
                <a class="cv-menu-item" href="{cv_en}" target="_blank">English CV</a>
                <a class="cv-menu-item" href="{cv_cn}" target="_blank">中文简历</a>
                </div>
                </div>
                <a class="link-pill" href="mailto:{email}"><i class="fa-solid fa-envelope-open"></i>Mail</a>
                <a class="link-pill" href="https://scholar.google.com/citations?user={scholar}&hl=en" target="_blank"><i class="fa-brands fa-google-scholar"></i>Scholar</a>
                </div>
    """


def get_interests_html():
    s = '<div class="interests">'
    for item in SITE["interests"]:
        s += f'<span class="interest-chip">{html.escape(item)}</span>'
    s += "</div>"
    return s


_CONTACT_SVG_DIR = "assets/img/icons"


def _load_svg_body(name):
    """读取 assets/img/icons/{name}.svg，返回 (内联体, viewBox)；缺失或异常返回 None。"""
    path = os.path.join(_CONTACT_SVG_DIR, name + ".svg")
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        m = re.search(r"<svg[^>]*>(.*)</svg>", content, re.S)
        if not m:
            return None
        body = re.sub(r"<title>.*?</title>", "", m.group(1), flags=re.S)
        vb = re.search(r'viewBox="([^"]+)"', content)
        return body, (vb.group(1) if vb else "0 0 24 24")
    except OSError:
        return None


def get_contact_html():
    email = SITE["email"]
    items = [
        ("fa", "fa-solid fa-envelope", "Email", f"mailto:{email}", False, ""),
        (
            "fa",
            "fa-brands fa-orcid",
            "ORCID",
            f"https://orcid.org/{SITE['orcid']}",
            True,
            "",
        ),
        (
            "fa",
            "fa-brands fa-google-scholar",
            "Scholar",
            f"https://scholar.google.com/citations?user={SITE['scholar']}&hl=en",
            True,
            "",
        ),
        (
            "fa",
            "fa-brands fa-github",
            "GitHub",
            f"https://github.com/{SITE['github']}",
            True,
            "",
        ),
        (
            "fa",
            "fa-brands fa-researchgate",
            "ResearchGate",
            "https://www.researchgate.net/profile/Da-Yan-3?ev=hdr_xprf",
            True,
            "",
        ),
        (
            "svg",
            "webofscience",
            "Web of Science",
            "https://www.webofscience.com/wos/author/record/AAE-3520-2022",
            True,
            "brand-wos",
        ),
        (
            "svg",
            "scopus",
            "Scopus",
            "https://www.scopus.com/authid/detail.uri?authorId=57192956833",
            True,
            "brand-scopus",
        ),
    ]
    s = '<div class="contact-grid">'
    for kind, icon, label, href, external, brand in items:
        target = ' target="_blank" rel="me noopener"' if external else ""
        brand_attr = f" {brand}" if brand else ""
        if kind == "fa":
            inner = f'<i class="{icon}" aria-hidden="true"></i>'
        else:
            loaded = _load_svg_body(icon)
            if loaded:
                body, viewbox = loaded
                inner = (
                    f'<span class="contact-icon"><svg viewBox="{html.escape(viewbox, quote=True)}" '
                    f'width="26" height="26" fill="currentColor" aria-hidden="true">'
                    f"{body}</svg></span>"
                )
            else:
                mono = "WoS" if icon == "webofscience" else "S"
                inner = f'<span class="contact-icon mono" aria-hidden="true">{mono}</span>'
                print(
                    f"[build] 缺少 {_CONTACT_SVG_DIR}/{icon}.svg，"
                    f"Contact 区“{label}”使用字母徽标降级"
                )
        s += (
            f'<a class="contact-item{brand_attr}" href="{html.escape(href, quote=True)}"{target}>'
            f"{inner}<span>{html.escape(label)}</span></a>"
        )
    s += "</div>"
    return s


def get_footer_html():
    today = datetime.date.today()
    year = today.year
    updated = today.strftime("%Y-%m-%d")
    return f"""
                <p>© {year} {SITE['short_name']} · Last updated {updated}</p>
                <p>
                This website follows the design of <a href="https://m-niemeyer.github.io/" target="_blank">Michael Niemeyer</a> and <a href="https://jonbarron.info/" target="_blank">Jon Barron</a>.
                </p>
    """


# --------------------------------------------------------------------------
# 缩略图 WebP 管线（需要 Pillow；缺失时优雅降级）
# --------------------------------------------------------------------------

_THUMB_WIDTHS = (480, 960)


def _thumb_paths(src):
    base, _ = os.path.splitext(src)
    return base + ".webp", base + "-2x.webp"


def ensure_thumbnails(img_paths):
    """为每张图片生成 480w / 960w WebP，返回 {原图: (1x路径, 1x宽, 2x路径, 2x宽)}。"""
    try:
        from PIL import Image
    except ImportError:
        print("[build] Pillow 未安装，跳过 WebP 缩略图（pip install pillow 可启用）")
        return {}

    def saved_widths(paths):
        return [Image.open(p).width for p in paths]

    result = {}
    for src in sorted({p for p in img_paths if p}):
        if not os.path.exists(src):
            continue
        t1, t2 = _thumb_paths(src)
        src_mtime = os.path.getmtime(src)
        up_to_date = (
            os.path.exists(t1)
            and os.path.exists(t2)
            and os.path.getmtime(t1) >= src_mtime
            and os.path.getmtime(t2) >= src_mtime
        )
        if up_to_date:
            try:
                w1, w2 = saved_widths((t1, t2))
                result[src] = (t1, w1, t2, w2)
            except Exception:
                pass
            continue
        try:
            with Image.open(src) as im:
                im.load()
                rgb = im if im.mode == "RGB" else im.convert("RGB")
                w, h = rgb.size
                w1, w2 = min(_THUMB_WIDTHS[0], w), min(_THUMB_WIDTHS[1], w)
                for width, path in ((w1, t1), (w2, t2)):
                    if width == w:
                        rgb.save(path, "WEBP", quality=82, method=6)
                    else:
                        nh = max(1, round(h * width / w))
                        rgb.resize((width, nh), Image.LANCZOS).save(
                            path, "WEBP", quality=82, method=6
                        )
            result[src] = (t1, w1, t2, w2)
            print(f"[build] WebP: {src} -> {os.path.basename(t1)}, {os.path.basename(t2)}")
        except Exception as exc:  # noqa: BLE001
            print(f"[build] 缩略图生成失败 {src}: {exc}")
    return result


def _img_tag(img, alt, thumbs, lazy=True, extra="", sizes="150px"):
    """生成 <img>；有 WebP 版本时附加 srcset。"""
    src = html.escape(img, quote=True)
    srcset = ""
    entry = thumbs.get(img)
    if entry:
        t1, w1, t2, w2 = entry
        candidates = [f"{html.escape(t1, quote=True)} {w1}w"]
        if w2 > w1:
            candidates.append(f"{html.escape(t2, quote=True)} {w2}w")
        srcset = (
            f' srcset="{", ".join(candidates)}" sizes="{html.escape(sizes, quote=True)}"'
        )
    lazy_attr = ' loading="lazy"' if lazy else ""
    return f'<img src="{src}"{srcset}{lazy_attr} alt="{html.escape(alt)}"{extra}>'


# --------------------------------------------------------------------------
# 作者与期刊格式化
# --------------------------------------------------------------------------


def get_author_dict():
    return {
        "Shuxian Zhang": "https://www.xyafu.edu.cn/wgyxy/info/1127/7073.htm",
        "Mansour Amini": "https://ppblt.usm.my/index.php/lecturer-profile/393-mansour-amini-dr",
        "Hualing Gong": "https://s.wanfangdata.com.cn/paper?q=%E4%BD%9C%E8%80%85%3A%22%E9%BE%9A%E5%8D%8E%E7%8E%B2%22%20%E4%BD%9C%E8%80%85%E5%8D%95%E4%BD%8D%3A%20%22%E4%BF%A1%E9%98%B3%E5%86%9C%E6%9E%97%E5%AD%A6%E9%99%A2%22",
        "Qiongqiong Fan": "https://www.xyafu.edu.cn/wgyxy/info/1127/7062.htm",
        "Junyue Wang": "https://www.xyafu.edu.cn/wgyxy/info/1127/7079.htm",
        "Shaidatul Kasuma": "https://ppblt.usm.my/index.php/lecturer-profile/188-shaidatul-akma-adi-kasuma",
        "Chenjin Jia": "https://scholar.google.com/citations?hl=en&user=Nk-Ar0IAAAAJ",
        "Feng Tian": "https://orcid.org/0009-0006-1905-3921",
        "Yu Gao": "https://www.xyafu.edu.cn/wgyxy/info/1126/7057.htm",
    }


def generate_person_html(
    persons,
    connection=", ",
    make_bold=True,
    make_bold_name=None,
    add_links=True,
    equal_contribution=None,
):
    if make_bold_name is None:
        make_bold_name = SITE["short_name"]
    links = get_author_dict() if add_links else {}
    s = ""
    last = len(persons) - 1
    for idx, p in enumerate(persons):
        plain = " ".join(p.get_part("first") + p.get_part("last"))
        piece = html.escape(plain)
        if plain in links:
            piece = f'<a href="{html.escape(links[plain], quote=True)}" target="_blank">{piece}</a>'
        if make_bold and plain == make_bold_name:
            piece = f'<span class="self-name">{html.escape(make_bold_name)}</span>'
        if equal_contribution is not None and idx < equal_contribution:
            piece += "*"
        s += piece
        if idx != last:
            s += connection
    return s


_ACCEPTED_LIKE = {"accepted", "in press", "online first", "ahead-of-print"}


def format_venue(entry):
    fields = entry.fields
    venue = fields.get("booktitle", "")
    year = fields.get("year", "").strip()
    vol = fields.get("volume", "").strip()
    num = fields.get("number", "").strip()
    pages = fields.get("pages", "").strip()

    parts = [venue]
    if vol:
        if vol.lower() in _ACCEPTED_LIKE:
            parts.append(vol)
        elif vol != year:
            detail = vol
            if num and num.lower() not in _ACCEPTED_LIKE and num.lower() != "n/a":
                detail += f"({num})"
            if re.fullmatch(r"\d+(?:\s*[-–—]\s*\d+)?|e\d+", pages):
                detail += f": {pages.replace('--', '–')}"
            parts.append(detail)
    if year and not re.search(rf"{re.escape(year)}[\)]?$", venue):
        parts.append(year)
    return ", ".join(parts)


def build_cite(entry, entry_key):
    authors = generate_person_html(
        entry.persons["author"], make_bold=False, add_links=False, connection=" and "
    )
    cite = f"@{entry.type}{{{entry_key}, \n"
    cite += f"\tauthor = {{{authors}}}, \n"
    for entr in ["title", "booktitle", "year"]:
        cite += f"\t{entr} = {{{entry.fields[entr]}}}, \n"
    cite += "}"
    return html.escape(cite)


# --------------------------------------------------------------------------
# 论文 / 会议卡片
# --------------------------------------------------------------------------

_PAPER_ARTEFACTS = {
    "html": "Web view",
    "pdf": "Postprint archive",
    "supp": "Supplementary",
    "video": "Video",
    "poster": "Poster",
    "code": "Code",
}

_TALK_ARTEFACTS = {
    "slides": "Slides",
    "video": "Recording",
}


def _artefact_links(fields, artefacts):
    """渲染条目附带资源链接；缺失的可选字段静默跳过。"""
    s = ""
    first = True
    for key, label in artefacts.items():
        if key in fields:
            if not first:
                s += '<span class="sep">·</span>'
            s += (
                f'<a class="pub-link" href="{html.escape(fields[key], quote=True)}" '
                f'target="_blank">{label}</a>'
            )
            first = False
    return s


def get_paper_entry(entry_key, entry, thumbs=None):
    thumbs = thumbs or {}
    fields = entry.fields
    year = fields.get("year", "").strip() or "n.d."
    featured = " featured" if "highlight" in fields else ""
    badge = '<span class="featured-badge">Featured</span>' if "highlight" in fields else ""
    title = html.escape(fields["title"])
    href = html.escape(fields["html"], quote=True)
    img = fields["img"]
    data_year = f' data-year="{html.escape(year, quote=True)}"'
    data_featured = ' data-featured="true"' if "highlight" in fields else ""

    s = f'<article class="pub-card{featured}"{data_year}{data_featured}>{badge}'
    s += f'<div class="pub-thumb">{_img_tag(img, fields["title"], thumbs, extra=' onerror="this.closest(\'.pub-thumb\').classList.add(\'img-missing\')"')}</div>'
    s += '<div class="pub-body">'

    award = ""
    if "award" in fields:
        award = f'<span class="pub-award">({html.escape(fields["award"])})</span>'
    s += f'<h3 class="pub-title"><a href="{href}" target="_blank">{title}</a>{award}</h3>'

    if "equal_contribution" in fields:
        authors = generate_person_html(
            entry.persons["author"], equal_contribution=int(fields["equal_contribution"])
        )
    else:
        authors = generate_person_html(entry.persons["author"])
    s += f'<p class="pub-authors">{authors}</p>'

    s += f'<p class="pub-meta">{html.escape(format_venue(entry))}</p>'
    s += '<div class="pub-links">'
    s += _artefact_links(fields, _PAPER_ARTEFACTS)
    s += (
        '<details class="bib"><summary>Bibtex</summary>'
        "<pre><code>" + build_cite(entry, entry_key) + "</code></pre></details>"
    )
    s += "</div></div></article>"
    return s


def get_talk_entry(entry_key, entry, thumbs=None):
    thumbs = thumbs or {}
    fields = entry.fields
    year = fields.get("year", "").strip() or "n.d."
    title = html.escape(fields["title"])
    img = fields["img"]
    data_year = f' data-year="{html.escape(year, quote=True)}"'
    s = f'<article class="pub-card"{data_year}>'
    s += f'<div class="pub-thumb">{_img_tag(img, fields["title"], thumbs, extra=' onerror="this.closest(\'.pub-thumb\').classList.add(\'img-missing\')"')}</div>'
    s += '<div class="pub-body">'
    s += f'<h3 class="pub-title">{title}</h3>'
    s += f'<p class="pub-meta">{html.escape(format_venue(entry))}</p>'
    s += '<div class="pub-links">'
    s += _artefact_links(fields, _TALK_ARTEFACTS)
    s += "</div></div></article>"
    return s


def _group_by_year(entries):
    groups = {}
    for key, entry in entries.items():
        year = entry.fields.get("year", "").strip() or "n.d."
        groups.setdefault(year, []).append(key)
    return groups


def _load_entries(filename):
    return bibtex.Parser().parse_file(filename).entries


def get_publications_html(entries, thumbs=None):
    groups = _group_by_year(entries)
    s = ""
    for year in sorted(groups, key=lambda y: y if y.isdigit() else "0", reverse=True):
        count = len(groups[year])
        s += (
            f'<h3 class="year-label" data-year="{html.escape(year, quote=True)}">'
            f"{year}<span class=\"year-count\">&nbsp;·&nbsp;{count}</span></h3>"
        )
        for key in groups[year]:
            s += get_paper_entry(key, entries[key], thumbs)
    return s


def get_talks_html(entries, thumbs=None):
    groups = _group_by_year(entries)
    s = ""
    for year in sorted(groups, key=lambda y: y if y.isdigit() else "0", reverse=True):
        s += (
            f'<h3 class="year-label" data-year="{html.escape(year, quote=True)}">'
            f"{year}</h3>"
        )
        for key in groups[year]:
            s += get_talk_entry(key, entries[key], thumbs)
    return s


def get_pub_filter_html(entries):
    groups = _group_by_year(entries)
    years = sorted(groups, key=lambda y: y if y.isdigit() else "0", reverse=True)
    s = (
        '<div class="pub-filter" id="pub-filter" role="group" '
        'aria-label="Filter publications">'
    )
    s += '<button type="button" class="filter-pill active" data-filter="all">All</button>'
    s += (
        '<button type="button" class="filter-pill" data-filter="featured">'
        "Featured</button>"
    )
    s += '<span class="filter-divider" aria-hidden="true"></span>'
    for year in years:
        s += (
            f'<button type="button" class="filter-pill" '
            f'data-filter="{html.escape(year, quote=True)}">'
            f"{html.escape(year)}</button>"
        )
    s += (
        '<button type="button" class="filter-pill download" id="bib-download" '
        'aria-label="Download all BibTeX">'
        '<i class="fa-solid fa-download"></i>&nbsp;BibTeX</button>'
    )
    s += "</div>"
    return s


# --------------------------------------------------------------------------
# 页面模板
# --------------------------------------------------------------------------


def get_index_html():
    pub_entries = _load_entries("publication_list.bib")
    talk_entries = _load_entries("talk_list.bib")

    imgs = ["assets/img/profile.jpg"]
    imgs += [e.fields.get("img") for e in pub_entries.values()]
    imgs += [e.fields.get("img") for e in talk_entries.values()]
    thumbs = ensure_thumbnails(imgs)

    pub = get_publications_html(pub_entries, thumbs)
    pub_filter = get_pub_filter_html(pub_entries)
    talks = get_talks_html(talk_entries, thumbs)

    name = get_name()
    bio_text = get_bio_text()
    social_media = get_social_media_html()
    interests = get_interests_html()
    contact = get_contact_html()
    footer = get_footer_html()
    short_name = SITE["short_name"]
    tagline = SITE["tagline"]
    title_suffix = SITE["title"]
    site_url = SITE["url"].rstrip("/")
    page_title = f"{name[0]}{name[1]} | {title_suffix}"
    description = SITE["description"]
    hero_img = _img_tag(
        "assets/img/profile.jpg",
        "Da Yan's profile photo",
        thumbs,
        lazy=False,
        extra=' fetchpriority="high"',
        sizes="189px",
    )

    affiliation_name, affiliation_url = SITE["affiliation"]
    person_json = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": SITE["short_name"],
        "alternateName": name[0],
        "url": site_url + "/",
        "email": "mailto:" + SITE["email"],
        "affiliation": {
            "@type": "Organization",
            "name": affiliation_name,
            "url": affiliation_url,
        },
        "sameAs": [
            f"https://orcid.org/{SITE['orcid']}",
            f"https://scholar.google.com/citations?user={SITE['scholar']}&hl=en",
            f"https://github.com/{SITE['github']}",
            "https://www.researchgate.net/profile/Da-Yan-3",
            "https://www.webofscience.com/wos/author/record/AAE-3520-2022",
            "https://www.scopus.com/authid/detail.uri?authorId=57192956833",
        ],
    }
    ld_json = json.dumps(person_json, ensure_ascii=False, indent=2)

    s = f"""<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{page_title}</title>
  <meta name="description" content="{html.escape(description, quote=True)}">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="{site_url}/">
  <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="{html.escape(page_title, quote=True)}">
  <meta property="og:description" content="{html.escape(description, quote=True)}">
  <meta property="og:url" content="{site_url}/">
  <meta property="og:image" content="{site_url}/assets/img/profile.jpg">
  <script type="application/ld+json">
  {ld_json}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bona+Nova+SC:wght@400;700&family=IBM+Plex+Serif:ital,wght@0,400;0,700;1,400&family=Lora:wght@400;700&family=Noto+Serif+SC:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <link rel="stylesheet" type="text/css" href="assets/stylesheet.css">
</head>

<body>
  <a class="skip-link" href="#top">Skip to content</a>
  <nav class="site-nav" id="site-nav">
    <div class="container nav-inner">
      <a class="nav-brand" href="#top" aria-label="Da Yan"><img class="nav-brand-img" src="assets/img/signature.webp" alt="Da Yan" width="121" height="38"></a>
      <div class="nav-links">
        <a href="#interests">Interests</a>
        <a href="#publications">Publications</a>
        <a href="#talks">Conferences</a>
        <a href="#contact">Contact</a>
      </div>
    </div>
  </nav>

  <main id="top">
    <div class="container">
      <header class="hero">
        <div class="hero-grid">
          <div class="hero-text">
            <h1 class="hero-name">{name[0]}<span class="hero-suffix">{name[1]}</span></h1>
            <p class="hero-tagline">{tagline}</p>
            <div class="hero-bio">{bio_text}</div>
            {social_media}
          </div>
          <div class="hero-photo">
            {hero_img}
          </div>
        </div>
      </header>

      <section id="interests" class="section">
        <h2 class="section-heading">Research Interests</h2>
        {interests}
      </section>

      <section id="publications" class="section">
        <h2 class="section-heading">Publications</h2>
        {pub_filter}
        {pub}
      </section>

      <section id="talks" class="section">
        <h2 class="section-heading">Conferences</h2>
        {talks}
      </section>

      <section id="contact" class="section">
        <h2 class="section-heading">Contact</h2>
        {contact}
      </section>

      <footer class="site-footer">
        {footer}
      </footer>
    </div>
  </main>

  <script src="assets/thumbs.js"></script>
  <script src="assets/cvmenu.js"></script>
  <script src="assets/nav.js"></script>
  <script src="assets/pubs.js"></script>
</body>

</html>
    """
    return s


def write_index_html(filename="index.html"):
    s = get_index_html()
    with open(filename, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"Written index content to {filename}.")


if __name__ == "__main__":
    write_index_html("index.html")
