# -*- coding: utf-8 -*-
"""Append keys to both dictionaries in core/i18n.js.

The file is hand-authored and stays that way; this only splices new lines in
just before each dictionary closes, and refuses to add a key that already
exists so the two sides can never drift apart.
"""
import io, re, sys

PATH = "assets/js/core/i18n.js"

def add(pairs, section=None):
    src = io.open(PATH, encoding="utf-8").read()
    lines = src.split("\n")
    ar_start = next(i for i, l in enumerate(lines) if l == "    ar: {")
    en_start = next(i for i, l in enumerate(lines) if l == "    en: {")
    ar_end = next(i for i in range(ar_start, en_start) if lines[i].rstrip() == "},"
                  or lines[i] == "    },")
    en_end = next(i for i in range(en_start, len(lines)) if lines[i] == "    }")

    have_ar = set(re.findall(r'^\s*"([^"]+)":', "\n".join(lines[ar_start:ar_end]), re.M))
    have_en = set(re.findall(r'^\s*"([^"]+)":', "\n".join(lines[en_start:en_end]), re.M))

    def block(idx, have):
        out = []
        if section:
            out.append("")
            out.append("      /* --- %s --- */" % section)
        for k, ar, en in pairs:
            if k in have:
                continue
            v = ar if idx == 0 else en
            out.append('      "%s": %s,' % (k, jsstr(v)))
        return out

    en_block = block(1, have_en)
    ar_block = block(0, have_ar)
    # The last entry in a hand-written dictionary carries no trailing comma.
    if en_block:
        lines[en_end - 1] = comma(lines[en_end - 1])
        lines[en_end:en_end] = en_block
    if ar_block:
        lines[ar_end - 1] = comma(lines[ar_end - 1])
        lines[ar_end:ar_end] = ar_block
    io.open(PATH, "w", encoding="utf-8").write("\n".join(lines))
    return len(ar_block), len(en_block)

def comma(line):
    return line if line.rstrip().endswith((",", "{")) or not line.strip() else line + ","


def jsstr(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

def counts():
    src = io.open(PATH, encoding="utf-8").read()
    lines = src.split("\n")
    ar_start = next(i for i, l in enumerate(lines) if l == "    ar: {")
    en_start = next(i for i, l in enumerate(lines) if l == "    en: {")
    en_end = next(i for i in range(en_start, len(lines)) if lines[i] == "    }")
    ar = set(re.findall(r'^\s*"([^"]+)":', "\n".join(lines[ar_start:en_start]), re.M))
    en = set(re.findall(r'^\s*"([^"]+)":', "\n".join(lines[en_start:en_end]), re.M))
    return ar, en
