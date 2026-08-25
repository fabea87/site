#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""新博客脚手架：自动生成带 YAML Front Matter 的 Markdown 文件。

用法：
  python new_post.py "文章标题"                # 交互式补全 summary/tags（可直接回车跳过）
  python new_post.py "标题" -s "简介" -t "标签1,标签2"   # 全部非交互指定
  python new_post.py --list                    # 列出现有文章及其 metadata

行为：
  - 文件名：<YYYY-MM-DD-HHMM>-<slug>.md，写入 blog/ 目录
    （build_blog.py 会把日期前缀从 URL slug 中剥离）
  - Front Matter 自动填入 title 和 date（当前时间）；
    summary / tags 可选，留空则不写入该行
"""
import argparse
import datetime
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.abspath(__file__))
BLOG_DIR = os.path.join(ROOT, "blog")


def slugify(text):
    """中英文混排 -> URL 友好 slug：中文保留，空格/符号转连字符。"""
    text = text.strip().lower()
    text = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", text)  # \w 含数字字母下划线
    return re.sub(r"-{2,}", "-", text).strip("-") or "post"


def front_matter(title, date, summary, tags):
    lines = ["---", f"title: {title}", f"date: {date}"]
    if summary:
        lines.append(f"summary: {summary}")
    if tags:
        lines.append(f"tags: {', '.join(tags)}")
    lines.append("---")
    return "\n".join(lines)


def ask(prompt, default=""):
    try:
        v = input(f"{prompt}: ").strip()
    except EOFError:
        v = ""
    return v or default


def main():
    ap = argparse.ArgumentParser(description="生成带 YAML Front Matter 的新博客 md")
    ap.add_argument("title", nargs="?", help="文章标题")
    ap.add_argument("-s", "--summary", default="", help="一句话简介")
    ap.add_argument("-t", "--tags", default="", help="逗号分隔的标签")
    ap.add_argument("--list", action="store_true", help="列出现有文章的 metadata")
    args = ap.parse_args()

    if args.list or not args.title:
        print("现有博客文章 metadata：\n")
        for fn in sorted(os.listdir(BLOG_DIR)):
            if not fn.endswith(".md"):
                continue
            with open(os.path.join(BLOG_DIR, fn), encoding="utf-8") as fh:
                head = fh.read(2000)
            meta = dict(
                re.findall(r"^(title|date|summary|tags):\s*(.+)$", head, re.M)
            )
            print(f"  {fn}")
            for k in ("title", "date", "summary", "tags"):
                if k in meta:
                    print(f"    {k:8s}= {meta[k]}")
            print()
        if not args.title:
            ap.print_help()
        return

    title = args.title
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    summary = args.summary or ask("一句话简介（可回车跳过）")
    tags = [t for t in re.split("[,，]", args.tags or ask("标签，逗号分隔（可回车跳过）")) if t.strip()]

    fname = f"{now[:10]}-{now[11:13]}{now[14:16]}-{slugify(title)}.md"
    path = os.path.join(BLOG_DIR, fname)
    if os.path.exists(path):
        sys.exit(f"! 文件已存在: {path}")

    body = f"# {title}\n\n<!-- TODO: 在这里写正文 -->\n"
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(front_matter(title, now, summary.strip(), [t.strip() for t in tags]) + "\n\n" + body)

    print(f"已创建: blog/{fname}")
    print(f"  title = {title}\n  date  = {now}")


if __name__ == "__main__":
    main()
