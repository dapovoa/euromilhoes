import sys

COLORS_SUPPORTED = hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()

def colored_print(message, color_code='94'):
    """
    Imprime uma mensagem na consola com cor especificada.
    - '94' para azul (info)
    - '92' para verde (sucesso)
    - '93' para amarelo (aviso)
    - '91' para vermelho (erro)
    - '96' para ciano (cache)
    """
    if COLORS_SUPPORTED:
        if color_code == '94':
            print(f"\033[94m[INFO]\033[0m {message}")
        elif color_code == '92':
            print(f"\033[92m[OK]\033[0m {message}")
        elif color_code == '93':
            print(f"\033[93m[AVISO]\033[0m {message}")
        elif color_code == '91':
            print(f"\033[91m[ERRO]\033[0m {message}")
        elif color_code == '96':
            print(f"\033[96m[CACHE]\033[0m {message}")
        else:
            prefix = '[INFO]'
            print(f"\033[{color_code}m{prefix}\033[0m {message}")
    else:
        if color_code == '94':
            print(f"[INFO] {message}")
        elif color_code == '92':
            print(f"[OK] {message}")
        elif color_code == '93':
            print(f"[AVISO] {message}")
        elif color_code == '91':
            print(f"[ERRO] {message}")
        elif color_code == '96':
            print(f"[CACHE] {message}")
        else:
            print(f"[INFO] {message}")
