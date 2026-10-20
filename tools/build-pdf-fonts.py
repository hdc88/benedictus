#!/usr/bin/env python3
"""Genera fonts/pdf/*.js: font TTF in base64 caricabili anche da file:// per l'export PDF vettoriale."""
import base64, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILIES = {
    'EB Garamond': 'EBGaramond',
    'Cardo': 'Cardo',
    'Junicode': 'Junicode',
    'Libertinus Serif': 'LibertinusSerif',
}
STYLES = {'normal': 'Regular', 'italic': 'Italic', 'bold': 'Bold', 'bolditalic': 'BoldItalic'}
os.makedirs(os.path.join(ROOT, 'fonts', 'pdf'), exist_ok=True)
for family, prefix in FAMILIES.items():
    parts = []
    for style, suffix in STYLES.items():
        path = os.path.join(ROOT, 'fonts', f'{prefix}-{suffix}.ttf')
        if not os.path.exists(path):
            continue
        with open(path, 'rb') as f:
            parts.append(f"'{style}':'{base64.b64encode(f.read()).decode()}'")
    js = ("(window.BENEDICTUS_PDF_FONTS = window.BENEDICTUS_PDF_FONTS || {})"
          f"['{family}'] = {{file:'{prefix}', {', '.join(parts)}}};\n")
    with open(os.path.join(ROOT, 'fonts', 'pdf', f'{prefix}.js'), 'w') as f:
        f.write(js)
    print(prefix, len(js))
