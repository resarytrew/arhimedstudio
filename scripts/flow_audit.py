#!/usr/bin/env python3
"""Heuristic, non-executing Python scene audit. Not a proof of compressibility.

Usage:
    python scripts/flow_audit.py scene.py --format json
    python scripts/flow_audit.py scene.py --formatted-tokens --format json
Ruff must be installed at the pinned version for formatted token measurements.
"""
from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import tokenize
from collections import Counter
from pathlib import Path

KINDS = ("math", "objects_style", "layout", "choreography", "time_camera", "scaffolding", "ambiguous")
PATTERNS = (
    ("choreography", r"\bself\.(?:play|add|remove|clear)\s*\(|\b(?:FadeIn|FadeOut|Write|Create|Transform|ReplacementTransform|TransformMatchingTex|LaggedStart)\s*\("),
    ("time_camera", r"\bself\.wait\s*\(|\brun_time\s*=|\brate_func\s*=|\blag_ratio\s*=|\bcamera\.|config\.(?:pixel_width|pixel_height|frame_rate)"),
    ("layout", r"\.(?:move_to|next_to|to_edge|to_corner|align_to|arrange|shift|scale_to_fit_width|scale_to_fit_height|set_x|set_y)\s*\("),
    ("math", r"\b(?:MathTex|Tex|ValueTracker|np\.|math\.|sqrt|sin|cos|integral|derivative|linspace|plot|root|roots)\b|\\(?:frac|sqrt|sum|int|pi)|\*\*"),
    ("objects_style", r"\b(?:Circle|Dot|Line|Arrow|Axes|Rectangle|Square|VGroup|Text|Surface|Sphere|Cube|color_gradient|font_size|fill_opacity|stroke_width)\b"),
)


def docstring_lines(tree: ast.AST) -> set[int]:
    excluded: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
                excluded.update(range(body[0].lineno, body[0].end_lineno + 1))
    return excluded


def header_lines(tree: ast.Module) -> set[int]:
    """Symmetric exclusions: top-level imports, class and construct headers only."""
    out: set[int] = set()
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            out.update(range(node.lineno, node.end_lineno + 1))
        if isinstance(node, ast.ClassDef):
            out.add(node.lineno)
            for member in node.body:
                if isinstance(member, (ast.FunctionDef, ast.AsyncFunctionDef)) and member.name == "construct":
                    out.add(member.lineno)
    return out


def source_tokens(source: str):
    doc = docstring_lines(ast.parse(source))
    ignored = {tokenize.ENCODING, tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE,
               tokenize.INDENT, tokenize.DEDENT, tokenize.ENDMARKER}
    yield from (tok for tok in tokenize.generate_tokens(io.StringIO(source).readline)
                if tok.type not in ignored and tok.start[0] not in doc)


def token_counts(source: str) -> dict:
    """Token counts include string literals (one token) and publish literal sizes."""
    tree = ast.parse(source)
    omit = header_lines(tree)
    tokens = list(source_tokens(source))
    author = [tok for tok in tokens if tok.start[0] not in omit]
    return {"raw_tokens": len(tokens), "author_tokens": len(author),
            "literal_chars": sum(len(tok.string) for tok in author if tok.type == tokenize.STRING),
            "omitted_header_lines": len(omit)}


def formatted_tokens(source: str, name: str, expected_version: str = "ruff 0.14.6") -> dict:
    path = shutil.which("ruff")
    if path is None:
        raise RuntimeError("Pinned Ruff formatter unavailable; no unformatted metric fallback")
    version = subprocess.run([path, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    if version != expected_version:
        raise RuntimeError(f"Ruff version mismatch: expected {expected_version}, got {version}")
    formatted = subprocess.run([path, "format", "--stdin-filename", Path(name).name, "-"],
                               input=source, capture_output=True, text=True, check=True).stdout
    result = token_counts(formatted)
    result.update({"formatter": version, "formatted_sha256": hashlib.sha256(formatted.encode()).hexdigest()})
    return result


def classify(line: str) -> tuple[str, str]:
    text = line.strip()
    if re.match(r"^(?:import |from |def |class |return\b|if\b|for\b|while\b|else:|elif\b|try:|except\b|pass\b|with\b)", text):
        return ("scaffolding", "definition/control")
    if re.search(r"\b(?:self\.)?(?:math_at|math_text|equation)\s*\(", text):
        return ("math", "math helper")
    if re.search(r"\b(?:self\.)?(?:text_at|text|make_label)\s*\(", text):
        return ("objects_style", "text helper")
    if re.search(r"^\s*(?:x|y|z|t|dx|dy|r|n|rho|theta)\s*=", text) and re.search(r"[-+/*]|\bmath\.", text):
        return ("math", "numeric relationship")
    for category, pattern in PATTERNS:
        if re.search(pattern, text):
            return (category, pattern)
    if re.match(r"^[A-Z_][A-Z_0-9]*\s*=", text) and re.search(r"#[0-9a-fA-F]{6}", text):
        return ("objects_style", "color constant")
    return ("ambiguous", "human review needed")


def audit_source(source: str, name: str = "<source>") -> dict:
    """Classify physical source-code lines without running the supplied Python."""
    tree = ast.parse(source, filename=name)
    doc = docstring_lines(tree)
    physical = set()
    for tok in source_tokens(source):
        physical.update(range(tok.start[0], tok.end[0] + 1))
    physical.difference_update(doc)
    rows = []
    lines = source.splitlines()
    for n in sorted(physical):
        category, rule = classify(lines[n - 1] if n <= len(lines) else "")
        rows.append({"line": n, "kind": category, "rule": rule,
                     "source": lines[n - 1].strip() if n <= len(lines) else ""})
    counts = Counter(row["kind"] for row in rows)
    return {"file": name, "sha256": hashlib.sha256(source.encode()).hexdigest(),
            "source_lines": len(rows), "classes": {key: counts[key] for key in KINDS},
            "ambiguous_lines": counts["ambiguous"], "lines": rows}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="+", help="Python files/directories; directories recursed")
    ap.add_argument("--format", choices=("table", "json", "csv"), default="table")
    ap.add_argument("--formatted-tokens", action="store_true", help="strict Ruff-formatted primary token metric")
    ap.add_argument("--details", action="store_true")
    args = ap.parse_args()
    paths = sorted({f for p in map(Path, args.paths) for f in
                    (p.rglob("*.py") if p.is_dir() else [p])})
    reports = []
    for path in paths:
        try:
            source = path.read_text(encoding="utf-8-sig")
            rec = audit_source(source, str(path))
            if args.formatted_tokens:
                rec["tokens"] = formatted_tokens(source, str(path))
            reports.append(rec)
        except (OSError, SyntaxError, tokenize.TokenError, RuntimeError, subprocess.CalledProcessError) as exc:
            print(f"Audit failed for {path}: {exc}", file=sys.stderr)
            return 2
    if args.format == "json":
        print(json.dumps(reports, ensure_ascii=False, indent=2))
    elif args.format == "csv":
        out = csv.writer(sys.stdout)
        out.writerow(["file", "sha256", "source_lines", *KINDS, "author_tokens", "formatter"])
        for r in reports:
            out.writerow([r["file"], r["sha256"], r["source_lines"],
                          *[r["classes"][c] for c in KINDS],
                          r.get("tokens", {}).get("author_tokens", ""), r.get("tokens", {}).get("formatter", "")])
    else:
        for r in reports:
            print(f"{r['file']}: {r['source_lines']} SLOC; {r['classes']}")
            if args.formatted_tokens:
                print(f"  FORMATTED {r['tokens']}")
            if args.details:
                for line in r["lines"]:
                    print(f"  {line['line']:>4} {line['kind']:<14} {line['source']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
