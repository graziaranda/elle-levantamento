#!/usr/bin/env python3
"""
Elle Levantamento — Bundle Generator
Junta CSS + JS num único HTML para uso no tablet sem internet.
Execute: python build.py
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE, 'css', 'app.css'), encoding='utf-8') as f:
    css = f.read()

js_order = ['data.js', 'dxf-writer.js', 'canvas-editor.js', 'dashboard.js', 'app.js', 'photo-annotator.js', 'pdf-report.js']
js_parts = []
for name in js_order:
    with open(os.path.join(BASE, 'js', name), encoding='utf-8') as f:
        js_parts.append(f'/* ─── {name} ─── */\n' + f.read())
js = '\n\n'.join(js_parts)

html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Elle Levantamento</title>
  <!-- Inter: carrega se houver internet; sistema (Helvetica/Roboto) se não houver -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
<style>
{css}
</style>
</head>
<body>
  <div id="app"></div>
  <div id="modal-root"></div>
  <div id="toast-root"></div>
  <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none">
<script>
{js}
</script>
</body>
</html>"""

out = os.path.join(BASE, 'elle-levantamento-tablet.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(out) / 1024
print(f"Bundle criado: elle-levantamento-tablet.html ({size_kb:.0f} KB)")
print()
print("COMO USAR NO TABLET:")
print("  1. Envie 'elle-levantamento-tablet.html' por WhatsApp, e-mail ou Google Drive")
print("  2. No tablet, baixe e abra com Chrome (Android) ou Safari (iPad)")
print("  3. Todos os projetos ficam salvos no navegador do tablet")
print("  4. Funciona offline — não precisa de internet nem do PC")
print()
print("DICA: Adicione aos Favoritos ou 'Adicionar à tela inicial' para acesso rapido.")
