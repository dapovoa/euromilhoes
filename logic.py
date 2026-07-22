#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import re
import requests
import zipfile
import io
import stat
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from utils import parse_draw_line

def setup_headless_chrome_linux():
    project_dir = os.getcwd()
    chrome_dir = os.path.join(project_dir, "chrome")
    binary_path = os.path.join(chrome_dir, "chrome-headless-shell")

    if os.path.exists(binary_path):
        if not os.access(binary_path, os.X_OK): os.chmod(binary_path, stat.S_IRWXU)
        return binary_path

    try:
        os.makedirs(chrome_dir, exist_ok=True)
        # Use a more reliable way to get the URL if possible, this is fragile
        page_url = "https://googlechromelabs.github.io/chrome-for-testing/"
        response = requests.get(page_url, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')
        stable_section = soup.find('section', id='stable')
        if not stable_section: raise RuntimeError("Stable section not found on Chrome for Testing page")
        
        rows = stable_section.find_all('tr')
        zip_url = None
        for row in rows:
            cells = row.find_all(['th', 'td'])
            if len(cells) >= 3 and cells[0].text.strip() == 'chrome-headless-shell' and cells[1].text.strip() == 'linux64':
                zip_url = cells[2].text.strip()
                break
        if not zip_url: raise RuntimeError("URL for 'chrome-headless-shell linux64' not found")
        
        r = requests.get(zip_url, stream=True, timeout=300)
        r.raise_for_status()
        zip_content = io.BytesIO(r.content)
        
        with zipfile.ZipFile(zip_content) as zf:
            prefix = os.path.commonprefix(zf.namelist())
            for member in zf.infolist():
                if member.filename.startswith(prefix):
                    member.filename = member.filename[len(prefix):]
                    if member.filename: zf.extract(member, chrome_dir)
        
        os.chmod(binary_path, stat.S_IRWXU)
        return binary_path
    except Exception as e:
        print(f"\n    ↳ Failed to download chrome: {e}", file=sys.stderr)
        if os.path.exists("/usr/bin/google-chrome"):
            return "/usr/bin/google-chrome"
        return None

_browser_instance = None
_browser_lock = None

class EuromilhoesParser:
    def __init__(self, chrome_binary_path, timeout=15, reuse_browser=True):
        self.chrome_binary_path = chrome_binary_path
        self.timeout = timeout
        self.reuse_browser = reuse_browser
        self.driver = self.get_or_create_driver() if reuse_browser else self.setup_driver()

    def get_or_create_driver(self):
        """Get existing browser instance or create new one (pooling/reuse)"""
        global _browser_instance

        if _browser_instance is not None:
            try:
                _browser_instance.execute_script("return 1")
                return _browser_instance
            except Exception:
                _browser_instance = None

        _browser_instance = self.setup_driver()
        return _browser_instance

    def setup_driver(self):
        if not self.chrome_binary_path or not os.path.exists(self.chrome_binary_path):
            raise FileNotFoundError(f"Chrome executable not found: {self.chrome_binary_path}")

        chrome_options = Options()
        chrome_options.binary_location = self.chrome_binary_path
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--log-level=3")
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])

        os.environ['WDM_LOG'] = '0'
        try:
            service = Service(ChromeDriverManager().install())
            return webdriver.Chrome(service=service, options=chrome_options)
        except Exception:
            return webdriver.Chrome(options=chrome_options)

    def extract_numbers_from_row(self, row):
        try:
            balls = row.find_elements(by=By.CSS_SELECTOR, value="ul.balls li.resultBall")
            main_numbers = [b.text for b in balls if b.text.isdigit() and "lucky-star" not in b.get_attribute("class")]
            star_numbers = [b.text for b in balls if b.text.isdigit() and "lucky-star" in b.get_attribute("class")]
            if len(main_numbers) == 5 and len(star_numbers) == 2:
                return f"{ ' '.join(main_numbers)} + {' '.join(star_numbers)}"
            return None
        except Exception: return None

    def extract_all_years(self, start_year, end_year):
        all_results = []
        for year in range(start_year, end_year + 1):
            url = f"https://www.euro-millions.com/results-history-{year}"
            try:
                self.driver.get(url)
                WebDriverWait(self.driver, self.timeout).until(EC.presence_of_element_located((By.ID, "resultsTable")))
                result_rows = self.driver.find_elements(by=By.CSS_SELECTOR, value="tr.resultRow")
                year_results = [self.extract_numbers_from_row(row) for row in result_rows]
                all_results.extend(res for res in year_results if res)
            except Exception: pass
        return all_results

    def close(self):
        if not self.reuse_browser and self.driver:
            self.driver.quit()

def initialize_frequency_data(max_value):
    data = {}
    for i in range(1, max_value + 1):
        data[i] = {'count': 0, 'lastDraw': -1, 'gaps': [], 'veryRecent': 0}
    return data

def update_frequency_data(data_dict, items, index, total_draws, recent_window=30):
    for item in items:
        data_dict[item]['count'] += 1
        if data_dict[item]['lastDraw'] != -1:
            data_dict[item]['gaps'].append(index - data_dict[item]['lastDraw'])
        data_dict[item]['lastDraw'] = index
        if index >= total_draws - recent_window:
            data_dict[item]['veryRecent'] += 1

def calculate_numbers_analysis(numbers_data, total_draws, default_gap=10):
    analysis = []
    for num, data in numbers_data.items():
        avg_gap = sum(data['gaps']) / len(data['gaps']) if data['gaps'] else default_gap
        current_gap = total_draws - 1 - data['lastDraw']
        analysis.append({
            'number': num,
            'freq': data['count'],
            'overdueRatio': current_gap / avg_gap if avg_gap > 0 else 0,
            'isCritical': current_gap > avg_gap * 2 if avg_gap > 0 else False,
            'isHot': data['veryRecent'] >= 2
        })
    return analysis

def calculate_stars_analysis(stars_data, total_draws, default_gap=5):
    analysis = []
    for star, data in stars_data.items():
        avg_gap = sum(data['gaps']) / len(data['gaps']) if data['gaps'] else default_gap
        current_gap = total_draws - 1 - data['lastDraw']
        analysis.append({
            'star': star,
            'freq': data['count'],
            'overdueRatio': current_gap / avg_gap if avg_gap > 0 else 0,
            'isOverdue': current_gap > avg_gap * 1.5 if avg_gap > 0 else False,
            'isHot': data['veryRecent'] >= 2
        })
    return analysis

def compute_frequency_analysis(all_draws_lines):
    """
    Analyze historical draws and return frequency data for numbers and stars.

    Returns a dict with:
      - total_draws: int
      - numbers: list of {number, frequency, avg_gap, current_gap, overdue_ratio}
      - stars:   list of {star, frequency, avg_gap, current_gap, overdue_ratio}
      - hot_numbers: numbers appearing above average frequency
      - overdue_numbers: numbers with longest gap since last appearance
      - number_frequencies: array[50] of raw counts
      - star_frequencies: array[12] of raw counts
    """
    try:
        numbers_data = initialize_frequency_data(50)
        stars_data = initialize_frequency_data(12)

        total_draws = len(all_draws_lines)
        for index, line in enumerate(all_draws_lines):
            main_nums, star_nums = parse_draw_line(line)
            update_frequency_data(numbers_data, main_nums, index, total_draws)
            update_frequency_data(stars_data, star_nums, index, total_draws)

        numbers_analysis = calculate_numbers_analysis(numbers_data, total_draws)
        stars_analysis = calculate_stars_analysis(stars_data, total_draws)

        # Raw frequency arrays
        number_frequencies = [0] * 50
        star_frequencies = [0] * 12
        for n in numbers_data:
            number_frequencies[n - 1] = numbers_data[n]['count']
        for s in stars_data:
            star_frequencies[s - 1] = stars_data[s]['count']

        # Hot numbers (above average frequency)
        avg_freq = total_draws / 50
        hot_numbers = sorted(
            [n for n in numbers_analysis if n['freq'] > avg_freq * 1.1],
            key=lambda x: x['freq'],
            reverse=True,
        )

        # Overdue numbers (longest current gap)
        overdue_numbers = sorted(
            numbers_analysis,
            key=lambda x: x['overdueRatio'],
            reverse=True,
        )[:10]

        return {
            'total_draws': total_draws,
            'numbers': numbers_analysis,
            'stars': stars_analysis,
            'hot_numbers': hot_numbers,
            'overdue_numbers': overdue_numbers,
            'number_frequencies': number_frequencies,
            'star_frequencies': star_frequencies,
        }
    except Exception as e:
        print(f"Error during analysis: {e}", file=sys.stderr)
        return None
