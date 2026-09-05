from pathlib import Path
import re

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

# Keep one complete browser Gamepad API list. Ignored devices stay in this list.
src = src.replace(
"""const gamepadVisualizations = ref<GamepadVisualization[]>([])
const ignoredGamepadIndices = ref<Set<number>>(new Set())
const detectedGamepads = ref<{ index: number; name: string }[]>([])
const ignoredGamepads = ref<{ index: number; name: string }[]>([])""",
"""const gamepadVisualizations = ref<GamepadVisualization[]>([])
const ignoredGamepadIndices = ref<Set<number>>(new Set())
const detectedGamepads = ref<{ index: number; name: string }[]>([])""",
1)

old_poll = """  detectedGamepads.value = browserGamepads
    .filter(gamepad => !ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))

  ignoredGamepads.value = browserGamepads
    .filter(gamepad => ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))"""
new_poll = """  detectedGamepads.value = browserGamepads
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))"""
if old_poll not in src:
    raise SystemExit('Could not find Gamepad API polling lists')
src = src.replace(old_poll, new_poll, 1)

# Replace the old connected-gamepad snapshot list with the actual browser Gamepad API list.
old_connected = """        <div id=\"joystick-list\">
          <p v-if=\"Object.keys(state.connectedGamepads).length === 0\" class=\"no-joysticks\">
            No joysticks detected. Connect a joystick with WebHID, or press a button to use the Gamepad API fallback.
          </p>
          <div v-for=\"gp in Object.values(state.connectedGamepads)\" :key=\"gp.index\" class=\"joystick-item\">
            <div class=\"joystick-name\">{{ gp.id }}</div>
            <div class=\"joystick-id\">Joystick {{ gp.index }}</div>
          </div>
        </div>"""
new_connected = """        <div id=\"joystick-list\">
          <p v-if=\"webHIDDevices.length === 0 && detectedGamepads.length === 0\" class=\"no-joysticks\">
            No joysticks detected. Connect a joystick with WebHID, or press a button to use the Gamepad API fallback.
          </p>
          <div
            v-for=\"device in detectedGamepads\"
            :key=\"`gamepad-api-${device.index}`\"
            class=\"joystick-item\"
            :style=\"{ opacity: ignoredGamepadIndices.has(device.index) ? 0.45 : 1 }\"
          >
            <div>
              <div class=\"joystick-name\">{{ device.name }}</div>
              <div class=\"joystick-id\">
                Gamepad API · Joystick {{ device.index }}
                <span v-if=\"ignoredGamepadIndices.has(device.index)\"> · Ignored</span>
              </div>
            </div>
            <button
              v-if=\"!ignoredGamepadIndices.has(device.index)\"
              @click=\"ignoreGamepad(device.index)\"
              class=\"btn btn-secondary\"
              type=\"button\"
              title=\"Ignore this Gamepad API device for this session\"
            >Ignore</button>
            <button
              v-else
              @click=\"restoreGamepad(device.index)\"
              class=\"btn btn-secondary\"
              type=\"button\"
            >Restore</button>
          </div>
        </div>"""
if old_connected not in src:
    raise SystemExit('Could not find Connected Joysticks gamepad list')
src = src.replace(old_connected, new_connected, 1)

# Remove the separate Gamepad API management boxes from the Live Input Monitor.
src, n = re.subn(
    r'''\n\s*<div v-if=\"detectedGamepads\.length > 0\" class=\"viz-gamepad\">.*?</div>\n\s*<div v-if=\"gamepadVisualizations\.length === 0\" class=\"viz-no-devices\">''',
    '\n            <div v-if="gamepadVisualizations.length === 0" class="viz-no-devices">',
    src,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit('Could not remove Live Input Monitor Gamepad API device box')

src, n = re.subn(
    r'''\n\s*<div v-if=\"ignoredGamepads\.length > 0\" class=\"viz-gamepad\">.*?</div>\n\s*(?=<div v-for=\"gamepadViz in gamepadVisualizations\")''',
    '\n            ',
    src,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit('Could not remove ignored-device box from Live Input Monitor')

# Remove per-visualization Ignore button from Live Input Monitor cards.
src, n = re.subn(
    r'''\n\s*<button\n\s*v-if=\"gamepadViz\.source === 'gamepad'\"\n\s*@click=\"ignoreGamepad\(gamepadViz\.index\)\"\n\s*class=\"btn btn-secondary\"\n\s*type=\"button\"\n\s*title=\"Ignore this Gamepad API device for this session\"\n\s*>Ignore</button>''',
    '',
    src,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit('Could not remove per-device Ignore button from Live Input Monitor')

# Add editor credit on its own line.
old_credit = '      <p class="credits">Designed by StormPale</p>'
new_credit = '      <p class="credits">Designed by StormPale<br>Edited by SkellyVamps</p>'
if old_credit not in src:
    raise SystemExit('Could not find StormPale credit')
src = src.replace(old_credit, new_credit, 1)

path.write_text(src, encoding='utf-8')
