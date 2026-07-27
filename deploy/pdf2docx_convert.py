#!/usr/bin/env python3
"""PDF → DOCX 转换（依赖 pdf2docx）。供 Java 侧调用。

用法：
  python3 pdf2docx_convert.py <input.pdf> <output.docx>
"""

from __future__ import annotations

import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: pdf2docx_convert.py <input.pdf> <output.docx>", file=sys.stderr)
        return 2

    pdf_path, docx_path = sys.argv[1], sys.argv[2]
    try:
        from pdf2docx import Converter
    except ImportError:
        print(
            "pdf2docx 未安装。请执行: python3 -m pip install -U pdf2docx",
            file=sys.stderr,
        )
        return 3

    try:
        cv = Converter(pdf_path)
        try:
            cv.convert(docx_path)
        finally:
            cv.close()
    except Exception as exc:  # noqa: BLE001 - 原样回传给调用方日志
        print(f"pdf2docx 转换失败: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
