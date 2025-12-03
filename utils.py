import sys
import re

COLORS_SUPPORTED = hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()

def colored_print(message, color_code='94'):
    prefix = '[*]' if color_code in ['94', '92', '96'] else '[!]'
    ansi_color = f'\033[{color_code}m'

    if COLORS_SUPPORTED:
        print(f"{ansi_color}{prefix}\033[0m {message}")
    else:
        print(f"{prefix} {message}")

def log_error(message):
    colored_print(message, '91')

def log_success(message):
    colored_print(message, '92')

def log_warning(message):
    colored_print(message, '93')

def log_info(message):
    colored_print(message, '94')

def log_cache(message):
    colored_print(message, '96')

def parse_draw_line(line):
    parts = re.split(r'\s*\+\s*', line.strip())
    if len(parts) != 2:
        raise ValueError(f"Invalid draw line format: {line}")
    main_numbers = [int(x) for x in parts[0].split()]
    star_numbers = [int(x) for x in parts[1].split()]
    return main_numbers, star_numbers
