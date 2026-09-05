from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')
old = '''        <button @click="downloadCheatSheet(state.actions, state.connectedGamepads)" :disabled="configuredCount === 0" class="btn btn-secondary">\n          Download Cheat Sheet\n        </button>'''
new = '''        <button @click="downloadCheatSheet(state.actions, state.connectedGamepads)" :disabled="configuredCount === 0" class="btn btn-success">\n          Download Cheat Sheet\n        </button>'''
if old not in src:
    raise SystemExit('Cheat sheet button block not found')
path.write_text(src.replace(old, new, 1), encoding='utf-8')
