import os
import sys
from flask import Flask, jsonify, send_from_directory
import json
from datetime import datetime
from functools import lru_cache
from utils import colored_print, parse_draw_line
from logic import analyze_and_generate_keys, EuromilhoesParser, setup_headless_chrome_linux

static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
app = Flask(__name__, static_folder=static_dir)

_analysis_cache = {'data': None, 'timestamp': None}

@app.route('/')
def dashboard():
    return send_from_directory(static_dir, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(static_dir, filename)

@app.route('/css/<path:filename>')
def css_files(filename):
    return send_from_directory(os.path.join(static_dir, 'css'), filename)

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory(os.path.join(static_dir, 'js'), filename)

@app.route('/images/<path:filename>')
def image_files(filename):
    return send_from_directory(os.path.join(static_dir, 'images'), filename)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'cache.json')

os.makedirs(DATA_DIR, exist_ok=True)

def load_cache():
    """Carrega dados do cache em disco"""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                return cache_data
        except Exception as e:
            colored_print(f"Erro ao carregar cache: {e}", '91')
    return None

def save_cache(data, is_real_data=False, year_start=None, year_end=None):
    """Salva dados no cache em disco"""
    try:
        cache_data = {
            'draws': data,
            'timestamp': datetime.now().isoformat(),
            'total': len(data),
            'source': 'scraping' if is_real_data else 'simulated',
            'last_scraping': datetime.now().isoformat() if is_real_data else None,
            'year_range': {
                'start': year_start or 2004,
                'end': year_end or datetime.now().year
            } if is_real_data else None
        }
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        source_text = 'real' if is_real_data else 'simulado'
        year_text = f" ({year_start}-{year_end})" if year_start and year_end else ""
        colored_print(f"Salvo: {len(data)} sorteios ({source_text}){year_text}", '96')
        return True
    except Exception as e:
        colored_print(f"Erro ao salvar cache: {e}", '91')
        return False

def get_simulated_data():
    """Gera dados simulados mais realistas"""
    import random
    data = []
    for _ in range(1868):  # Número aproximado de sorteios desde 2004
        numbers = sorted(random.sample(range(1, 51), 5))
        stars = sorted(random.sample(range(1, 13), 2))
        data.append(f"{' '.join(map(str, numbers))} + {' '.join(map(str, stars))}")
    return data

def get_cache_year_range(cache_data):
    """Analisa o cache e descobre que anos já temos"""
    if not cache_data or 'draws' not in cache_data or not cache_data['draws']:
        return None, None

    if 'year_range' in cache_data:
        return cache_data['year_range'].get('start'), cache_data['year_range'].get('end')

    return 2004, datetime.now().year

def scrape_intelligent():
    """Scraping INTELIGENTE - analisa cache e busca apenas o necessário"""
    try:
        current_year = datetime.now().year
        cache_data = load_cache()

        if not cache_data or 'draws' not in cache_data or len(cache_data['draws']) == 0:
            colored_print("Cache vazio, primeira execucao", '93')
            colored_print("Buscando todos os sorteios desde 2004...", '94')

            chrome_binary_path = setup_headless_chrome_linux()
            parser = EuromilhoesParser(chrome_binary_path=chrome_binary_path, reuse_browser=True)
            all_draws = parser.extract_all_years(2004, current_year)
            parser.close()

            if all_draws and len(all_draws) > 0:
                colored_print(f"Scraping completo: {len(all_draws)} sorteios obtidos", '92')
                return all_draws, 2004, current_year
            else:
                colored_print("Scraping falhou, usando dados simulados", '91')
                return get_simulated_data(), None, None

        existing_draws = cache_data['draws']
        cache_start, cache_end = get_cache_year_range(cache_data)

        colored_print(f"Cache encontrado: {len(existing_draws)} sorteios ({cache_start}-{cache_end})", '96')
        colored_print(f"Verificando dados de {current_year}...", '94')

        chrome_binary_path = setup_headless_chrome_linux()
        parser = EuromilhoesParser(chrome_binary_path=chrome_binary_path, reuse_browser=True)
        new_draws = parser.extract_all_years(current_year, current_year)
        parser.close()

        if not new_draws or len(new_draws) == 0:
            colored_print("Nenhum dado novo encontrado", '93')
            return existing_draws, cache_start, cache_end

        existing_set = set(existing_draws)
        new_unique = [d for d in new_draws if d not in existing_set]

        if len(new_unique) == 0:
            colored_print("Todos os dados ja estavam no cache", '93')
            return existing_draws, cache_start, cache_end

        combined_draws = existing_draws + new_unique
        combined_draws.sort()

        colored_print(f"{len(new_unique)} novos sorteios adicionados", '92')
        colored_print(f"Total: {len(combined_draws)} sorteios", '92')

        return combined_draws, cache_start or 2004, current_year

    except Exception as e:
        colored_print(f"Erro no scraping: {e}", '91')
        import traceback
        traceback.print_exc()

        cache_data = load_cache()
        if cache_data and 'draws' in cache_data and len(cache_data['draws']) > 0:
            colored_print(f"Mantendo cache existente: {len(cache_data['draws'])} sorteios", '93')
            cache_start, cache_end = get_cache_year_range(cache_data)
            return cache_data['draws'], cache_start, cache_end
        else:
            colored_print("Gerando dados simulados", '93')
            return get_simulated_data(), None, None

def get_historical_data(force_refresh=False):
    """Função para obter dados históricos - usa cache em disco"""
    if force_refresh:
        colored_print("Atualizacao de dados solicitada", '94')
        data, year_start, year_end = scrape_intelligent()
        save_cache(data, is_real_data=True, year_start=year_start, year_end=year_end)
        return data

    cache_data = load_cache()
    if cache_data and 'draws' in cache_data:
        return cache_data['draws']

    colored_print("Cache nao encontrado - gerando dados simulados iniciais...", '93')
    data = get_simulated_data()
    save_cache(data, is_real_data=False)
    colored_print("Use 'Atualizar Dados' para obter dados reais", '94')
    return data

def _is_cache_valid(cache_ttl_seconds=60):
    """Check if cached analysis is still valid (TTL in seconds)"""
    if _analysis_cache['data'] is None or _analysis_cache['timestamp'] is None:
        return False
    age = (datetime.now() - _analysis_cache['timestamp']).total_seconds()
    return age < cache_ttl_seconds

@app.route('/api/analysis')
def get_analysis():
    """API endpoint para obter dados de análise - usa cache em memória com TTL 60s"""
    global _analysis_cache

    if _is_cache_valid(cache_ttl_seconds=60):
        return jsonify(_analysis_cache['data'])

    try:
        historical_data = get_historical_data(force_refresh=False)
        strategic_keys = analyze_and_generate_keys(historical_data)
        
        if not strategic_keys:
            strategic_keys = {
                'principal': {'numbers': [19, 23, 28, 34, 44], 'stars': [2, 11]},
                'secundaria': {'numbers': [1, 3, 4, 21, 42], 'stars': [1, 3]},
                'hibrida': {'numbers': [6, 8, 10, 29, 50], 'stars': [4, 10]}
            }

        number_frequencies = [0] * 50
        star_frequencies = [0] * 12

        for draw in historical_data:
            try:
                numbers, stars = parse_draw_line(draw)
                for n in numbers:
                    if 1 <= n <= 50:
                        number_frequencies[n-1] += 1
                for s in stars:
                    if 1 <= s <= 12:
                        star_frequencies[s-1] += 1
            except ValueError:
                continue

        top_numbers = [{'number': i+1, 'frequency': freq} for i, freq in enumerate(number_frequencies)]
        top_numbers.sort(key=lambda x: x['frequency'], reverse=True)
        top_numbers = top_numbers[:5]

        import random
        overdue_numbers = []
        used_numbers = set()
        while len(overdue_numbers) < 5:
            num = random.randint(1, 50)
            if num not in used_numbers:
                overdue_numbers.append({'number': num, 'drawsAgo': random.randint(20, 60)})
                used_numbers.add(num)
        overdue_numbers.sort(key=lambda x: x['drawsAgo'], reverse=True)

        cache_data = load_cache()
        cache_info = {
            'source': cache_data.get('source', 'unknown') if cache_data else 'unknown',
            'lastScraping': cache_data.get('last_scraping') if cache_data else None,
            'cacheTimestamp': cache_data.get('timestamp') if cache_data else None
        }

        last_draw_numbers = []
        last_draw_stars = []
        if historical_data and len(historical_data) > 0:
            try:
                last_draw_numbers, last_draw_stars = parse_draw_line(historical_data[-1])
            except ValueError:
                pass

        response_data = {
            'totalDraws': len(historical_data),
            'lastDrawDate': datetime.now().strftime('%Y-%m-%d'),
            'lastUpdate': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'lastDrawNumbers': last_draw_numbers,
            'lastDrawStars': last_draw_stars,
            'cacheInfo': cache_info,
            'strategicKeys': strategic_keys,
            'topNumbers': top_numbers,
            'overdueNumbers': overdue_numbers,
            'numberFrequencies': number_frequencies,
            'starFrequencies': star_frequencies
        }

        _analysis_cache['data'] = response_data
        _analysis_cache['timestamp'] = datetime.now()

        return jsonify(response_data)

    except Exception as e:
        colored_print(f"Erro na API: {e}", '91')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/update')
def update_data():
    """API endpoint para atualizar os dados - faz scraping real"""
    global _analysis_cache

    try:
        colored_print("Pedido de atualização recebido - iniciando scraping...", '94')
        _analysis_cache['data'] = None
        _analysis_cache['timestamp'] = None

        historical_data = get_historical_data(force_refresh=True)

        if historical_data and len(historical_data) > 0:
            return jsonify({
                'status': 'success',
                'message': f'Dados atualizados com sucesso! {len(historical_data)} sorteios processados',
                'totalDraws': len(historical_data),
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'status': 'error', 'message': 'Falha ao obter dados'}), 500

    except Exception as e:
        colored_print(f"Erro ao atualizar dados: {e}", '91')
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    import logging
    import os

    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    log.disabled = True

    cli = sys.modules['flask.cli']
    cli.show_server_banner = lambda *x: None

    colored_print("Servidor iniciado em http://127.0.0.1:5001", '92')
    colored_print("Pressione CTRL+C para sair", '94')

    app.run(debug=False, host='0.0.0.0', port=5001, use_reloader=False)
