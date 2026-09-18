#!/usr/bin/env python3
"""
站点构建脚本（Cloudflare Workers / 任意静态托管通用）
=============================================

工作流程：
  1. 确保 pip 依赖已安装（见 requirements.txt：pybtex、Pillow）
  2. 运行站点构建器 build.py（生成 index.html、WebP 缩略图等）
  3. 把可部署的静态文件（index.html、assets/）暂存到 public/
  4. 加 --deploy 参数时，用 wrangler 把 public/ 部署到 Cloudflare Worker

用法（在本目录下）：
  python build_site.py            # 只构建，输出到 public/
  python build_site.py --deploy   # 构建后部署（读取 wrangler.jsonc）
  python build_site.py --watch    # 构建后监视源文件改动并自动重建

本地预览：npx wrangler dev
"""

import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(ROOT, "public")

# Windows 控制台默认 GBK，可能无法输出部分字符；统一按 UTF-8 输出，避免构建日志崩溃
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except (AttributeError, ValueError):
        pass

# 需要拷贝到 public/ 的静态资源目录（HTML 由 build.py / build_blog.py 直接生成到 public/）
DEPLOY_ITEMS = ["assets"]

# --watch 监视的构建输入（目录会递归检查 .md）
WATCH_SOURCES = [
    "build.py",
    "build_blog.py",
    "site_config.py",
    "publication_list.bib",
    "talk_list.bib",
    "blog",
]
WATCH_INTERVAL = 2.0  # 轮询间隔（秒）

# 构建脚本的 pip 依赖（模块名 -> 包名，便于诊断）
REQUIRED_MODULES = ("pybtex", "PIL")  # PIL 是 Pillow 的导入名


def ensure_deps():
    """依赖缺失时自动 pip install；已安装则跳过（本地/线上都适用）。"""
    missing = [m for m in REQUIRED_MODULES if not _importable(m)]
    if not missing:
        print("[1/4] 依赖已满足，跳过 pip install")
        return
    print(f"[1/4] 缺少依赖 {missing}，执行 pip install -r requirements.txt ...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        cwd=ROOT,
    )


def _importable(module):
    try:
        __import__(module)
        return True
    except ImportError:
        return False


def run_build():
    """调用站点构建器 build.py（生成 index.html 与缩略图）。"""
    print("[3/4] 运行 build.py（生成 HTML 与缩略图）...")
    subprocess.check_call([sys.executable, "build.py"], cwd=ROOT)


def _rmtree_best_effort(path, attempts=8, delay=1.0):
    """尽力删除旧输出目录。Windows 上 OneDrive/杀软可能短暂占用目录句柄，
    导致 os.rmdir 报 PermissionError；重试多次，仍失败就容忍并靠覆盖合并。"""
    for i in range(attempts):
        try:
            shutil.rmtree(path)
            return
        except PermissionError:
            if i == attempts - 1:
                print("  ! 部分旧文件无法删除（目录被占用），改为覆盖式合并")
                return
            time.sleep(delay)


def stage_output():
    """把 assets 等静态资源拷贝进 public/（HTML 已由构建步骤直接生成在那里）。"""
    print(f"[4/4] 拷贝静态资源到 {OUTPUT_DIR}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for item in DEPLOY_ITEMS:
        src = os.path.join(ROOT, item)
        if not os.path.exists(src):
            print(f"  ! 跳过（不存在）: {item}")
            continue
        dst = os.path.join(OUTPUT_DIR, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
        print(f"  + {item}")


def _newest_mtime(path, suffixes=None):
    """返回文件（或目录下匹配后缀的文件）的最新 mtime；无匹配返回 0。"""
    if os.path.isfile(path):
        return os.path.getmtime(path)
    if not os.path.isdir(path):
        return 0.0
    newest = 0.0
    for dirpath, _dirnames, filenames in os.walk(path):
        for fn in filenames:
            if suffixes and not fn.endswith(suffixes):
                continue
            newest = max(newest, os.path.getmtime(os.path.join(dirpath, fn)))
    return newest


def _sources_stamp():
    return max(_newest_mtime(os.path.join(ROOT, item), (".md",)) for item in WATCH_SOURCES)


def _assets_stamp():
    return _newest_mtime(os.path.join(ROOT, "assets"))


def watch_loop(assets_stamp):
    """轮询源文件 mtime，有改动就重建；assets/ 未变时跳过 18MB 拷贝。"""
    print(f"[watch] 监视中（每 {WATCH_INTERVAL:g}s 检查一次）；Ctrl+C 退出")
    print("[watch] 预览：另开终端运行 npx wrangler dev，打开它提示的本地地址")
    last = _sources_stamp()
    while True:
        time.sleep(WATCH_INTERVAL)
        current = _sources_stamp()
        new_assets = _assets_stamp()
        if current == last and new_assets == assets_stamp:
            continue
        if current != last:
            last = current
            print("[watch] 检测到内容改动，重新构建 ...")
            try:
                run_build()
            except subprocess.CalledProcessError as exc:
                print(f"[watch] 构建失败（{exc}），继续监视")
                continue
        if new_assets != assets_stamp:
            assets_stamp = new_assets
            print("[watch] 检测到 assets 改动，重新拷贝静态资源 ...")
            stage_output()
        print("[watch] 构建完成，等待下一次改动")


def deploy_worker():
    """把 public/ 部署到 Cloudflare Worker（配置见仓库根目录 wrangler.jsonc）。

    需要先 `npx wrangler login` 登录，或设置环境变量
    CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID。
    """
    print("部署到 Cloudflare Worker（npx wrangler deploy）...")
    cmd = ["npx", "--yes", "wrangler@4", "deploy"]
    if os.name == "nt":
        # Windows 上 npx 是 .cmd 脚本，需要通过 cmd 解释器启动
        cmd = ["cmd", "/c"] + cmd
    subprocess.check_call(cmd, cwd=ROOT)


def main():
    print(f"站点构建开始（仓库根目录: {ROOT}）")
    ensure_deps()
    print("[2/4] 清空旧输出 public/ ...")
    if os.path.isdir(OUTPUT_DIR):
        _rmtree_best_effort(OUTPUT_DIR)
    print("[3/4] 生成 HTML 与缩略图 ...")
    run_build()
    stage_output()
    print("构建完成。输出目录: public")
    if "--watch" in sys.argv[1:]:
        watch_loop(_assets_stamp())
        return
    if "--deploy" in sys.argv[1:]:
        deploy_worker()
        print("部署完成。")
    else:
        print("如需部署到 Cloudflare Worker，请运行：python build_site.py --deploy")


if __name__ == "__main__":
    main()
