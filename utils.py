import sys
import re

COLORS_SUPPORTED = hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()

def colored_print(message, color_code='94'):
    color_map = {
        '94': ('INFO', '\033[94m'),
        '92': ('OK', '\033[92m'),
        '93': ('AVISO', '\033[93m'),
        '91': ('ERRO', '\033[91m'),
        '96': ('CACHE', '\033[96m')
    }

    prefix, ansi_color = color_map.get(color_code, ('INFO', f'\033[{color_code}m'))

    if COLORS_SUPPORTED:
        print(f"{ansi_color}[{prefix}]\033[0m {message}")
    else:
        print(f"[{prefix}] {message}")

def parse_draw_line(line):
    parts = re.split(r'\s*\+\s*', line.strip())
    if len(parts) != 2:
        raise ValueError(f"Invalid draw line format: {line}")
    main_numbers = [int(x) for x in parts[0].split()]
    star_numbers = [int(x) for x in parts[1].split()]
    return main_numbers, star_numbers
