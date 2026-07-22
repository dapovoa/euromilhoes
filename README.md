# Euromilhões — Historical Draw Analyzer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3-3776AB?logo=python)](https://www.python.org/)
[![Selenium](https://img.shields.io/badge/Selenium-4-43B02A?logo=selenium)](https://www.selenium.dev/)
[![Beautiful Soup](https://img.shields.io/badge/Beautiful%20Soup-4-000000?logo=python&color=orange)](https://www.crummy.com/software/BeautifulSoup/)

Scrapes historical Euromillions results from 2004 onwards and computes frequency
statistics. Exposes the data via a CLI for further analysis.

---

## Commands

```
python main.py scrape         Fetch latest draw data
python main.py stats          Print frequency table
python main.py stats --json   Output as structured JSON
python main.py export         Export all draws (stdout or file)
```

### Scrape

Downloads draw results from [euro-millions.com](https://www.euro-millions.com)
using headless Chrome + Selenium. Caches results locally in `data/cache.json`.

On subsequent runs only fetches the current year — incremental.

### Stats

Reads the local cache and displays:

- **Number frequencies** — how often each number (1–50) has appeared
- **Star frequencies** — how often each star (1–12) has appeared
- **Overdue ratios** — ratio of current gap to average gap per number

The `--json` flag outputs the full analysis as structured JSON for external
consumption.

### Export

Dumps every parsed draw as a JSON array of `{numbers, stars}` objects. Useful
for feeding into notebooks or other tooling.

---

## Data integrity

Each draw is stored as a raw line (`"1 2 3 4 5 + 1 2"`) — no aggregation or
transformation. The analysis layer reads from this cache and computes
frequencies on the fly.

---

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Requires a Chrome/Chromium binary for Selenium scraping.
On first run the tool will attempt to download `chrome-headless-shell`
automatically.

```bash
python main.py scrape
python main.py stats
```

---

## License

MIT
