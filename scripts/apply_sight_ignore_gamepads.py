from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

# Add HelicopterSightDeploy to the base action list.
needle = "  { name: 'JumpOut', filterPreset: 'click', hint: 'Emergency eject (dangerous!)', hardware: 'button', importance: 'optional' }\n]"
replacement = "  { name: 'JumpOut', filterPreset: 'click', hint: 'Emergency eject (dangerous!)', hardware: 'button', importance: 'optional' },\n  { name: 'HelicopterSightDeploy', filterPreset: 'click', hint: 'Deploy or retract the helicopter sight', hardware: 'button', importance: 'optional' }\n]"
if needle not in src:
    raise SystemExit('Could not find ACTIONS insertion point')
src = src.replace(needle, replacement, 1)

# Add ignored Gamepad API device state.
needle = "const gamepadVisualizations = ref<GamepadVisualization[]>([])\nconst webHIDSupported = ref(false)"
replacement = """const gamepadVisualizations = ref<GamepadVisualization[]>([])
const ignoredGamepadIndices = ref<Set<number>>(new Set())
const ignoredGamepads = ref<{ index: number; name: string }[]>([])
const webHIDSupported = ref(false)"""
if needle not in src:
    raise SystemExit('Could not find visualization state insertion point')
src = src.replace(needle, replacement, 1)

# Track the snapshot source in the visualization model so only Gamepad API devices get Ignore.
needle = """interface GamepadVisualization {
  index: number
  name: string
  axes: number[]
  buttons: boolean[]
}"""
replacement = """interface GamepadVisualization {
  index: number
  name: string
  axes: number[]
  buttons: boolean[]
  source: 'gamepad' | 'webhid'
}"""
if needle not in src:
    raise SystemExit('Could not find GamepadVisualization interface')
src = src.replace(needle, replacement, 1)

# Add ignore/restore handlers after WebHID index handler.
needle = """function changeWebHIDJoystickIndex(key: string, event: Event) {
  const select = event.target as HTMLSelectElement
  setWebHIDJoystickIndex(key, Number.parseInt(select.value, 10))
  refreshWebHIDDevices()
  resetGamepadBaseline()
}
"""
replacement = needle + """
function ignoreGamepad(index: number) {
  const next = new Set(ignoredGamepadIndices.value)
  next.add(index)
  ignoredGamepadIndices.value = next
  delete state.connectedGamepads[index]
  delete state.previousGamepadState[index]
  delete state.baselineGamepadState[index]
  delete axisCalibration[index]
  resetGamepadBaseline()
}

function restoreGamepad(index: number) {
  const next = new Set(ignoredGamepadIndices.value)
  next.delete(index)
  ignoredGamepadIndices.value = next
  resetGamepadBaseline()
}
"""
if needle not in src:
    raise SystemExit('Could not find WebHID index handler')
src = src.replace(needle, replacement, 1)

# Exclude ignored Gamepad API devices from active input snapshots.
needle = """  const gamepads = navigator.getGamepads()
  for (const gamepad of gamepads) {
    if (!gamepad || webHIDIndices.has(gamepad.index)) continue
    snapshots.push(gamepadToSnapshot(gamepad))
  }
"""
replacement = """  const gamepads = navigator.getGamepads()
  for (const gamepad of gamepads) {
    if (!gamepad || webHIDIndices.has(gamepad.index) || ignoredGamepadIndices.value.has(gamepad.index)) continue
    snapshots.push(gamepadToSnapshot(gamepad))
  }
"""
if needle not in src:
    raise SystemExit('Could not find Gamepad API snapshot loop')
src = src.replace(needle, replacement, 1)

# Include source in live visualizations.
needle = """  gamepadVisualizations.value = snapshots.map(snapshot => ({
    index: snapshot.index,
    name: snapshot.id,
    axes: snapshot.axes.map((rawValue, axisIndex) =>
      normalizeAxisValue(snapshot.index, axisIndex, rawValue)
    ),
    buttons: [...snapshot.buttons]
  }))
}"""
replacement = """  gamepadVisualizations.value = snapshots.map(snapshot => ({
    index: snapshot.index,
    name: snapshot.id,
    axes: snapshot.axes.map((rawValue, axisIndex) =>
      normalizeAxisValue(snapshot.index, axisIndex, rawValue)
    ),
    buttons: [...snapshot.buttons],
    source: snapshot.source
  }))
}"""
if needle not in src:
    raise SystemExit('Could not find visualization update')
src = src.replace(needle, replacement, 1)

# Refresh ignored device metadata on each poll, while keeping them out of active snapshots.
needle = """function pollGamepads() {
  const snapshots = getActiveJoystickSnapshots()
  const connectedIndices = new Set<number>()
"""
replacement = """function pollGamepads() {
  ignoredGamepads.value = Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => !!gamepad && ignoredGamepadIndices.value.has(gamepad.index))
    .map(gamepad => ({ index: gamepad.index, name: gamepad.id }))

  const snapshots = getActiveJoystickSnapshots()
  const connectedIndices = new Set<number>()
"""
if needle not in src:
    raise SystemExit('Could not find pollGamepads header')
src = src.replace(needle, replacement, 1)

# Emit the explicit InputFilterClick used by Workbench for HelicopterSightDeploy.
needle = """        } else if (action.name.includes('Reset')) {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterSingleClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name.includes('EngineStop')) {"""
replacement = """        } else if (action.name.includes('Reset')) {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterSingleClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name === 'HelicopterSightDeploy') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name.includes('EngineStop')) {"""
if needle not in src:
    raise SystemExit('Could not find config filter insertion point')
src = src.replace(needle, replacement, 1)

# Add Ignore button to Gamepad API device headers.
needle = """              <div class=\"viz-gamepad-header\">
                <span class=\"viz-device-number\">Device {{ gamepadViz.index }}</span>
                <span class=\"viz-device-name\">{{ gamepadViz.name }}</span>
              </div>"""
replacement = """              <div class=\"viz-gamepad-header\">
                <span class=\"viz-device-number\">Device {{ gamepadViz.index }}</span>
                <span class=\"viz-device-name\">{{ gamepadViz.name }}</span>
                <button
                  v-if=\"gamepadViz.source === 'gamepad'\"
                  @click=\"ignoreGamepad(gamepadViz.index)\"
                  class=\"btn btn-secondary\"
                  type=\"button\"
                  title=\"Ignore this Gamepad API device for this session\"
                >Ignore</button>
              </div>"""
if needle not in src:
    raise SystemExit('Could not find visualization header')
src = src.replace(needle, replacement, 1)

# Add restore controls immediately before active device visualizations.
needle = """            <div v-for=\"gamepadViz in gamepadVisualizations\" :key=\"gamepadViz.index\" class=\"viz-gamepad\">"""
replacement = """            <div v-if=\"ignoredGamepads.length > 0\" class=\"viz-gamepad\">
              <div class=\"viz-gamepad-header\">
                <span class=\"viz-device-number\">Ignored Gamepad API devices</span>
              </div>
              <div class=\"viz-content\">
                <div v-for=\"device in ignoredGamepads\" :key=\"`ignored-${device.index}`\" class=\"detected-device\">
                  <span>Device {{ device.index }} — {{ device.name }}</span>
                  <button @click=\"restoreGamepad(device.index)\" class=\"btn btn-secondary\" type=\"button\">Restore</button>
                </div>
              </div>
            </div>
            <div v-for=\"gamepadViz in gamepadVisualizations\" :key=\"`${gamepadViz.source}-${gamepadViz.index}`\" class=\"viz-gamepad\">"""
if needle not in src:
    raise SystemExit('Could not find visualization loop')
src = src.replace(needle, replacement, 1)

path.write_text(src, encoding='utf-8')
