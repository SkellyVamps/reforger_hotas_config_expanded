from pathlib import Path

path = Path('src/App.vue')
text = path.read_text()

old_import = "import type { Action, AppState, GamepadState } from './types'\n"
new_import = old_import + "import { downloadCheatSheet } from './cheatsheet'\n"
if "from './cheatsheet'" not in text:
    if old_import not in text:
        raise SystemExit('App.vue type import anchor not found')
    text = text.replace(old_import, new_import, 1)

old_button = '''        <button @click="downloadConfig" :disabled="configuredCount === 0" class="btn btn-success" :class="{ 'btn-pulse': isConfigurationComplete }">
          {{ isConfigurationComplete ? '✓ Download Your Config File' : 'Download Config' }}
        </button>
        <button @click="startTestMode" :disabled="configuredCount === 0" class="btn btn-test">'''
new_button = '''        <button @click="downloadConfig" :disabled="configuredCount === 0" class="btn btn-success" :class="{ 'btn-pulse': isConfigurationComplete }">
          {{ isConfigurationComplete ? '✓ Download Your Config File' : 'Download Config' }}
        </button>
        <button @click="downloadCheatSheet(state.actions, state.connectedGamepads)" :disabled="configuredCount === 0" class="btn btn-secondary">
          Download Cheat Sheet
        </button>
        <button @click="startTestMode" :disabled="configuredCount === 0" class="btn btn-test">'''
if 'Download Cheat Sheet' not in text:
    if old_button not in text:
        raise SystemExit('App.vue download button anchor not found')
    text = text.replace(old_button, new_button, 1)

path.write_text(text)
