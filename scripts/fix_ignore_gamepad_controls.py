from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

old = """const gamepadVisualizations = ref<GamepadVisualization[]>([])
const ignoredGamepadIndices = ref<Set<number>>(new Set())
const ignoredGamepads = ref<{ index: number; name: string }[]>([])"""
new = """const gamepadVisualizations = ref<GamepadVisualization[]>([])
const ignoredGamepadIndices = ref<Set<number>>(new Set())
const detectedGamepads = ref<{ index: number; name: string }[]>([])
const ignoredGamepads = ref<{ index: number; name: string }[]>([])"""
if old not in src:
    raise SystemExit('Could not find gamepad refs block')
src = src.replace(old, new, 1)

old = """function pollGamepads() {
  ignoredGamepads.value = Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => !!gamepad && ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))

  const snapshots = getActiveJoystickSnapshots()"""
new = """function pollGamepads() {
  const browserGamepads = Array.from(navigator.getGamepads()).filter((gamepad): gamepad is Gamepad => !!gamepad)

  detectedGamepads.value = browserGamepads
    .filter(gamepad => !ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))

  ignoredGamepads.value = browserGamepads
    .filter(gamepad => ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))

  const snapshots = getActiveJoystickSnapshots()"""
if old not in src:
    raise SystemExit('Could not find pollGamepads header')
src = src.replace(old, new, 1)

needle = """            <div v-if=\"gamepadVisualizations.length === 0\" class=\"viz-no-devices\">
              <p>No joysticks detected. Connect a joystick and press any button.</p>
            </div>"""
insert = """            <div v-if=\"detectedGamepads.length > 0\" class=\"viz-gamepad\">
              <div class=\"viz-gamepad-header\">
                <span class=\"viz-device-number\">Gamepad API devices</span>
              </div>
              <div class=\"viz-content\">
                <div v-for=\"device in detectedGamepads\" :key=\"`detected-${device.index}`\" class=\"detected-device\">
                  <span>Device {{ device.index }} — {{ device.name }}</span>
                  <button
                    @click=\"ignoreGamepad(device.index)\"
                    class=\"btn btn-secondary\"
                    type=\"button\"
                    title=\"Ignore this Gamepad API device for this session\"
                  >Ignore</button>
                </div>
              </div>
            </div>

            <div v-if=\"gamepadVisualizations.length === 0\" class=\"viz-no-devices\">
              <p>No joysticks detected. Connect a joystick and press any button.</p>
            </div>"""
if needle not in src:
    raise SystemExit('Could not find visualization empty-state block')
src = src.replace(needle, insert, 1)

path.write_text(src, encoding='utf-8')
