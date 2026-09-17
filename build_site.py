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
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# 需要拷贝到 public/ 的静态资源目录（HTML 由 build.py / build_blog.py 直接生成到 public/）
DEPLOY_ITEMS = ["assets"]

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
    if "--deploy" in sys.argv[1:]:
        deploy_worker()
        print("部署完成。")
    else:
        print("如需部署到 Cloudflare Worker，请运行：python build_site.py --deploy")


if __name__ == "__main__":
    main()
