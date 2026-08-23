#!/usr/bin/env python3
"""Stamp the shared nav/footer partials into every top-level page.

Static site, no framework, no runtime include — this runs once after editing
partials/nav.html, partials/footer.html, or adding a new page, so every page
ships byte-identical chrome with zero client-side fetch/FOUC risk.

Usage: python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
PARTIALS = {
    "NAV": (ROOT / "partials" / "nav.html").read_text(encoding="utf-8"),
    "FOOTER": (ROOT / "partials" / "footer.html").read_text(encoding="utf-8"),
}

def stamp(html: str) -> str:
    for name, content in PARTIALS.items():
        pattern = re.compile(
            rf"<!-- {name} -->.*?<!-- /{name} -->", re.DOTALL
        )
        replacement = f"<!-- {name} -->\n{content}<!-- /{name} -->"
        html, n = pattern.subn(replacement, html)
        if n == 0:
            print(f"  (no <!-- {name} --> marker found)")
    return html

def main():
    pages = sorted(ROOT.glob("*.html"))
    if not pages:
        print("No pages to stamp yet.")
        return
    for page in pages:
        html = page.read_text(encoding="utf-8")
        new_html = stamp(html)
        if new_html != html:
            page.write_text(new_html, encoding="utf-8")
            print(f"stamped {page.name}")
        else:
            print(f"unchanged {page.name}")

if __name__ == "__main__":
    main()
