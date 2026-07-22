#!/usr/bin/env python3
"""Euromilhões — historical draw scraper and frequency analyzer.

Usage:
  python main.py scrape         Fetch latest draw data from euro-millions.com
  python main.py stats          Print frequency statistics to terminal
  python main.py stats --json   Output frequency statistics as JSON
  python main.py export         Export all draws as JSON (to stdout or file)
"""

import argparse
import json
import os
import sys
from datetime import datetime

from utils import colored_print, parse_draw_line, log_error, log_success, log_warning, log_info
from logic import compute_frequency_analysis, EuromilhoesParser, setup_headless_chrome_linux

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CACHE_FILE = os.path.join(DATA_DIR, "cache.json")
os.makedirs(DATA_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_error(f"Failed to load cache: {e}")
    return None


def save_cache(draws, metadata=None):
    try:
        cache = {
            "draws": draws,
            "timestamp": datetime.now().isoformat(),
            "total": len(draws),
        }
        if metadata:
            cache.update(metadata)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        log_success(f"Cached {len(draws)} draws to {CACHE_FILE}")
    except Exception as e:
        log_error(f"Failed to save cache: {e}")


# ---------------------------------------------------------------------------
# Scrape
# ---------------------------------------------------------------------------

def cmd_scrape(args):
    current_year = datetime.now().year
    cache = load_cache()
    existing = cache.get("draws", []) if cache else []

    if existing:
        log_info(f"Cache has {len(existing)} draws — fetching only {current_year}...")
    else:
        log_info("No cache found — fetching all draws from 2004...")

    chrome = setup_headless_chrome_linux()
    if not chrome:
        log_error("Could not find Chrome binary. Is chrome-headless-shell installed?")
        sys.exit(1)

    parser = EuromilhoesParser(chrome_binary_path=chrome, reuse_browser=True)

    if existing:
        new_draws = parser.extract_all_years(current_year, current_year)
    else:
        new_draws = parser.extract_all_years(2004, current_year)

    parser.close()

    if not new_draws:
        log_warning("No draws fetched.")
        return

    if existing:
        existing_set = set(existing)
        unique = [d for d in new_draws if d not in existing_set]
        if not unique:
            log_info("No new draws since last scrape.")
            return
        combined = sorted(existing + unique)
        log_success(f"Added {len(unique)} new draws — total {len(combined)}")
    else:
        combined = sorted(new_draws)
        log_success(f"Fetched {len(combined)} draws")

    save_cache(combined, {"source": "euro-millions.com", "year_start": 2004, "year_end": current_year})


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------




def cmd_stats(args):
    cache = load_cache()
    if not cache or "draws" not in cache or not cache["draws"]:
        log_error("No data found. Run `python main.py scrape` first.")
        sys.exit(1)

    draws = cache["draws"]
    analysis = compute_frequency_analysis(draws)
    if not analysis:
        log_error("Analysis failed.")
        sys.exit(1)

    if args.json:
        print(json.dumps(analysis, ensure_ascii=False, indent=2))
        return

    # Terminal output
    print()
    print(f"  Euromilhões — Frequency Analysis ({len(draws)} draws)")
    print(f"  {'=' * 46}")
    print()

    def tab(headers, rows):
        widths = []
        for i, h in enumerate(headers):
            col_vals = [str(r[i]) for r in rows] + [h]
            widths.append(max(len(v) for v in col_vals))
        print("  " + "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers)))
        print("  " + "  ".join("-" * widths[i] for i in range(len(headers))))
        for row in rows:
            print("  " + "  ".join(str(row[i]).ljust(widths[i]) for i in range(len(headers))))

    top_nums = sorted(analysis["numbers"], key=lambda x: x["freq"], reverse=True)[:10]
    print("  ## Top 10 Numbers (by frequency)")
    tab(
        ["#", "Number", "Frequency", "Overdue"],
        [
            (str(i), str(n["number"]), str(n["freq"]),
             f"{n.get('overdueRatio', 0):.1f}x" if n.get("overdueRatio", 0) > 0 else "-")
            for i, n in enumerate(top_nums, 1)
        ],
    )
    print()

    stars = sorted(analysis["stars"], key=lambda x: x["freq"], reverse=True)
    print("  ## Star Frequencies")
    tab(
        ["Star", "Frequency"],
        [(str(s["star"]), str(s["freq"])) for s in stars],
    )
    print()

    overdue = analysis["overdue_numbers"][:10]
    print("  ## Longest overdue numbers")
    tab(
        ["Number", "Overdue ratio"],
        [(str(n["number"]), f"{n.get('overdueRatio', 0):.2f}x") for n in overdue],
    )
    print()


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def cmd_export(args):
    cache = load_cache()
    if not cache or "draws" not in cache or not cache["draws"]:
        log_error("No data found. Run `python main.py scrape` first.")
        sys.exit(1)

    draws = cache["draws"]
    parsed = []
    for line in draws:
        try:
            nums, stars = parse_draw_line(line)
            parsed.append({"numbers": nums, "stars": stars})
        except ValueError:
            continue

    output = json.dumps(
        {"total": len(parsed), "source": "euro-millions.com", "draws": parsed},
        ensure_ascii=False,
        indent=2,
    )

    out_path = args.output or "euromilhoes.json"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output)
    log_success(f"Exported to {out_path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Euromilhões — historical draw scraper and frequency analyzer."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # scrape
    sub.add_parser("scrape", help="Fetch latest draw data from euro-millions.com")

    # stats
    stats_p = sub.add_parser("stats", help="Print frequency statistics")
    stats_p.add_argument("--json", action="store_true", help="Output as JSON")

    # export
    export_p = sub.add_parser("export", help="Export all draws as JSON")
    export_p.add_argument("-o", "--output", help="Output file (default: stdout)")

    args = parser.parse_args()

    if args.command == "scrape":
        cmd_scrape(args)
    elif args.command == "stats":
        cmd_stats(args)
    elif args.command == "export":
        cmd_export(args)


if __name__ == "__main__":
    main()
