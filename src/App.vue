<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Action, AppState, GamepadState } from './types'
import {
  closeWebHIDDevices,
  getWebHIDDevices,
  getWebHIDSnapshots,
  initializeWebHID,
  isWebHIDSupported,
  requestWebHIDDevices,
  setWebHIDJoystickIndex,
  type JoystickSnapshot,
  type WebHIDDeviceInfo
} from './input/webhid'

// Google Analytics gtag declaration
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

// Action definitions with sensible FilterPreset defaults and hints
const ACTIONS: Omit<Action, 'bindings'>[] = [
  { name: 'HelicopterCollectiveIncrease', filterPreset: 'up', hint: 'Increase altitude (raise collective)', hardware: 'throttle', importance: 'critical' },
  { name: 'HelicopterCollectiveDecrease', filterPreset: 'down', hint: 'Decrease altitude (lower collective)', hardware: 'throttle', importance: 'critical' },
  { name: 'HelicopterAntiTorqueLeft', filterPreset: 'left', hint: 'Yaw left (left pedal)', hardware: 'pedals', importance: 'critical' },
  { name: 'HelicopterAntiTorqueRight', filterPreset: 'right', hint: 'Yaw right (right pedal)', hardware: 'pedals', importance: 'critical' },
  { name: 'HelicopterCyclicForward', filterPreset: 'forward', hint: 'Pitch nose down (move forward)', hardware: 'stick', importance: 'critical' },
  { name: 'HelicopterCyclicBack', filterPreset: 'back', hint: 'Pitch nose up (slow down)', hardware: 'stick', importance: 'critical' },
  { name: 'HelicopterCyclicLeft', filterPreset: 'left', hint: 'Roll left (move sideways left)', hardware: 'stick', importance: 'critical' },
  { name: 'HelicopterCyclicRight', filterPreset: 'right', hint: 'Roll right (move sideways right)', hardware: 'stick', importance: 'critical' },
  { name: 'HelicopterWheelBrake', filterPreset: 'pressed', hint: 'Apply brakes (momentary)', hardware: 'pedals', importance: 'important' },
  { name: 'HelicopterWheelBrakePersistent', filterPreset: 'pressed', hint: 'Parking brake (toggle)', hardware: 'button', importance: 'important' },
  { name: 'HelicopterAutohoverToggle', filterPreset: 'click', hint: 'Auto-hover stabilization', hardware: 'button', importance: 'important' },
  { name: 'HelicopterLightsTaxiToggle', filterPreset: 'toggle', hint: 'Taxi lights (ground operations)', hardware: 'switch', importance: 'optional' },
  { name: 'HelicopterLightsLandingToggle', filterPreset: 'toggle', hint: 'Landing lights (approach)', hardware: 'switch', importance: 'optional' },
  { name: 'HelicopterEngineStart', filterPreset: 'hold', hint: 'Start engine and rotors', hardware: 'button', importance: 'critical' },
  { name: 'HelicopterEngineStop', filterPreset: 'click', hint: 'Stop engine and rotors', hardware: 'button', importance: 'critical' },
  { name: 'CharacterFire', filterPreset: 'hold', hint: 'Fire primary weapon (use same trigger as all fire actions)', hardware: 'trigger', importance: 'critical' },
  { name: 'CharacterNextWeapon', filterPreset: 'click', hint: 'Switch to next weapon (use same button as all weapon switch actions)', hardware: 'hat', importance: 'important' },
  { name: 'CharacterNextFireMode', filterPreset: 'click', hint: 'Change fire mode (single/burst/auto)', hardware: 'button', importance: 'important' },
  { name: 'CharacterNextMuzzle', filterPreset: 'click', hint: 'Switch muzzle attachment or barrel', hardware: 'button', importance: 'optional' },
  { name: 'TurretFire', filterPreset: 'hold', hint: 'Fire turret weapon (use same trigger as all fire actions)', hardware: 'trigger', importance: 'important' },
  { name: 'TurretReload', filterPreset: 'click', hint: 'Reload turret weapon', hardware: 'button', importance: 'important' },
  { name: 'TurretNextWeapon', filterPreset: 'click', hint: 'Cycle turret weapons (use same button as all weapon switch actions)', hardware: 'hat', importance: 'important' },
  { name: 'TurretNextFireMode', filterPreset: 'click', hint: 'Change turret fire mode', hardware: 'button', importance: 'optional' },
  { name: 'TurretADS', filterPreset: 'click', hint: 'Aim down sights (toggle)', hardware: 'button', importance: 'optional' },
  { name: 'TurretADSHold', filterPreset: 'hold', hint: 'Aim down sights (hold)', hardware: 'button', importance: 'optional' },
  { name: 'TurretRotateLeft', filterPreset: 'left', hint: 'Rotate turret left', hardware: 'stick', importance: 'important' },
  { name: 'TurretRotateRight', filterPreset: 'right', hint: 'Rotate turret right', hardware: 'stick', importance: 'important' },
  { name: 'TurretAimUp', filterPreset: 'up', hint: 'Elevate turret up', hardware: 'stick', importance: 'important' },
  { name: 'TurretAimDown', filterPreset: 'down', hint: 'Depress turret down', hardware: 'stick', importance: 'important' },
  { name: 'TurretAimLeft', filterPreset: 'left', hint: 'Fine aim left', hardware: 'stick', importance: 'optional' },
  { name: 'TurretAimRight', filterPreset: 'right', hint: 'Fine aim right', hardware: 'stick', importance: 'optional' },
  { name: 'HelicopterFire', filterPreset: 'hold', hint: 'Fire heli weapon (use same trigger as all fire actions)', hardware: 'trigger', importance: 'important' },
  { name: 'VehicleFire', filterPreset: 'hold', hint: 'Fire vehicle weapon (use same trigger as all fire actions)', hardware: 'trigger', importance: 'important' },
  { name: 'WeaponToggleSightsIllumination', filterPreset: 'click', hint: 'Toggle reticle illumination', hardware: 'button', importance: 'optional' },
  { name: 'WeaponSwitchOptics', filterPreset: 'click', hint: 'Change zoom/magnification', hardware: 'button', importance: 'important' },
  { name: 'FocusToggle', filterPreset: 'click', hint: 'Toggle focused aim/scope', hardware: 'button', importance: 'optional' },
  { name: 'Freelook', filterPreset: 'hold', hint: 'Hold to look around freely', hardware: 'button', importance: 'important' },
  { name: 'FreelookReset', filterPreset: 'click', hint: 'Reset view to center', hardware: 'button', importance: 'optional' },
  { name: 'FreelookUp', filterPreset: 'up', hint: 'Look up', hardware: 'hat', importance: 'optional' },
  { name: 'FreelookDown', filterPreset: 'down', hint: 'Look down', hardware: 'hat', importance: 'optional' },
  { name: 'FreelookLeft', filterPreset: 'left', hint: 'Look left', hardware: 'hat', importance: 'optional' },
  { name: 'FreelookRight', filterPreset: 'right', hint: 'Look right', hardware: 'hat', importance: 'optional' },
  { name: 'VONDirectToggle', filterPreset: 'click', hint: 'Toggle voice chat (push-to-talk)', hardware: 'button', importance: 'important' },
  { name: 'VONChannel', filterPreset: 'hold', hint: 'Hold to talk on radio channel', hardware: 'button', importance: 'important' },
  { name: 'GadgetMap', filterPreset: 'select', hint: 'Open/close map', hardware: 'button', importance: 'important' },
  { name: 'PerformAction', filterPreset: 'pressed', hint: 'Context action (interact, reload, etc.)', hardware: 'button', importance: 'important' },
  { name: 'SelectAction', filterPreset: 'previous', hint: 'Cycle through available actions', hardware: 'button', importance: 'optional' },
  { name: 'GetOut', filterPreset: 'click', hint: 'Exit vehicle safely', hardware: 'button', importance: 'important' },
  { name: 'JumpOut', filterPreset: 'click', hint: 'Emergency eject (dangerous!)', hardware: 'button', importance: 'optional' }
]

// WCS Armament actions (optional mod support)
const WCS_ACTIONS: Omit<Action, 'bindings'>[] = [
  { name: 'WCS_Armament_CycleWeapon', filterPreset: 'click', hint: 'Cycle to next weapon (pilot/vehicle weapons)', hardware: 'button', importance: 'important' },
  { name: 'WCS_Armament_DeployFlares', filterPreset: 'hold', hint: 'Deploy flares (countermeasure)', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_DeployChaffs', filterPreset: 'hold', hint: 'Deploy chaff (countermeasure)', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_TurretStabilizationToggle', filterPreset: 'click', hint: 'Toggle turret stabilization', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_VehicleAim', filterPreset: 'hold', hint: 'Vehicle aim mode', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_CycleWeaponFireMode', filterPreset: 'click', hint: 'Cycle weapon fire mode', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_ActivateLock', filterPreset: 'hold', hint: 'Activate weapon lock', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_DeploySmoke', filterPreset: 'hold', hint: 'Deploy smoke (countermeasure)', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_RadarToggle', filterPreset: 'click', hint: 'Toggle radar', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_FireContinuousSmokeDispenser', filterPreset: 'hold', hint: 'Fire continuous smoke dispenser', hardware: 'button', importance: 'optional' },
  { name: 'TurretWeaponNextRippleQuantity', filterPreset: 'click', hint: 'Cycle weapon ripple quantity', hardware: 'button', importance: 'optional' },
  { name: 'WCS_Armament_ConfirmLock', filterPreset: 'click', hint: 'Confirm missile lock-on (after activating the seeker)', hardware: 'button', importance: 'optional' }
]

// Fixed-wing aircraft actions (Propeller/Jet Flight Core mods: SU-25, SU-33, C-130, WW2 planes...)
// Pitch/roll/yaw are single full-range analog actions in the game, so each direction is a
// separate entry here that merges into one Action block at generation (confName), with the
// negative direction carrying Multiplier -1.
const AIRCRAFT_ACTIONS: Omit<Action, 'bindings'>[] = [
  { name: 'PFC_PitchUp', confName: 'PFC_Pitch', filterPreset: 'back', hint: 'Pull stick back = nose up', hardware: 'stick', importance: 'critical' },
  { name: 'PFC_PitchDown', confName: 'PFC_Pitch', filterPreset: 'forward', multiplier: -1, hint: 'Push stick forward = nose down', hardware: 'stick', importance: 'critical' },
  { name: 'PFC_RollRight', confName: 'PFC_Roll', filterPreset: 'right', hint: 'Stick right = roll right', hardware: 'stick', importance: 'critical' },
  { name: 'PFC_RollLeft', confName: 'PFC_Roll', filterPreset: 'left', multiplier: -1, hint: 'Stick left = roll left', hardware: 'stick', importance: 'critical' },
  { name: 'PFC_YawRight', confName: 'PFC_Yaw', filterPreset: 'right', hint: 'Rudder right (twist or right pedal)', hardware: 'pedals', importance: 'critical' },
  { name: 'PFC_YawLeft', confName: 'PFC_Yaw', filterPreset: 'left', multiplier: -1, hint: 'Rudder left (twist or left pedal)', hardware: 'pedals', importance: 'critical' },
  { name: 'PFC_ThrottleAxis', rawAxis: true, filterPreset: 'forward', hint: 'Move your throttle lever FORWARD — the whole axis is captured, full travel = idle to full thrust', hardware: 'throttle', importance: 'critical' },
  { name: 'PFC_ThrottleUp', filterPreset: 'hold', hint: 'Throttle up (button fallback if you have no throttle axis)', hardware: 'button', importance: 'optional' },
  { name: 'PFC_ThrottleDown', filterPreset: 'hold', hint: 'Throttle down (button fallback if you have no throttle axis)', hardware: 'button', importance: 'optional' },
  { name: 'VehicleNextWeapon', filterPreset: 'click', hint: 'Cycle aircraft weapons (use same button as all weapon switch actions)', hardware: 'hat', importance: 'important' },
  { name: 'PFC_GearToggle', filterPreset: 'click', hint: 'Landing gear up/down', hardware: 'button', importance: 'important' },
  { name: 'PFC_Flaps', filterPreset: 'click', hint: 'Cycle flaps (clean / takeoff / landing)', hardware: 'button', importance: 'important' },
  { name: 'PFC_Airbrake', filterPreset: 'click', hint: 'Airbrake toggle', hardware: 'button', importance: 'important' },
  { name: 'PFC_WheelBrake', filterPreset: 'pressed', hint: 'Wheel brakes (hold while taxiing/landing)', hardware: 'pedals', importance: 'important' },
  { name: 'PFC_WheelBrakePersistent', filterPreset: 'pressed', hint: 'Parking brake (toggle)', hardware: 'button', importance: 'optional' },
  { name: 'PFC_EngineStart', filterPreset: 'hold', hint: 'Hold to start engines', hardware: 'button', importance: 'important' },
  { name: 'PFC_EngineStop', filterPreset: 'click', hint: 'Stop engines', hardware: 'button', importance: 'optional' },
  { name: 'PFC_TrimUp', filterPreset: 'hold', hint: 'Pitch trim nose up', hardware: 'button', importance: 'optional' },
  { name: 'PFC_TrimDown', filterPreset: 'hold', hint: 'Pitch trim nose down', hardware: 'button', importance: 'optional' },
  { name: 'PFC_TrimReset', filterPreset: 'click', hint: 'Reset pitch trim to neutral', hardware: 'button', importance: 'optional' },
  { name: 'PFC_FCSOverride', filterPreset: 'click', hint: 'Flight control system override', hardware: 'button', importance: 'optional' },
  { name: 'PFC_ReverseThrust', filterPreset: 'click', hint: 'Toggle reverse thrust (aircraft that support it)', hardware: 'button', importance: 'optional' },
  { name: 'PFC_LightsTaxiToggle', filterPreset: 'toggle', hint: 'Taxi lights', hardware: 'switch', importance: 'optional' },
  { name: 'PFC_LightsLandingToggle', filterPreset: 'toggle', hint: 'Landing lights', hardware: 'switch', importance: 'optional' }
]

// Axis calibration data
interface AxisCalibrationData {
  min: number
  max: number
  center: number
}

interface AxisCalibration {
  [gamepadIndex: number]: {
    [axisIndex: number]: AxisCalibrationData
  }
}

// State
const state = reactive<AppState>({
  actions: ACTIONS.map(action => ({ ...action, bindings: [] })),
  currentActionIndex: -1,
  furthestActionIndex: -1,
  configuring: false,
  connectedGamepads: {},
  previousGamepadState: {},
  baselineGamepadState: {},
  filter: 'all',
  inputCooldown: false,
  pendingInput: null
})

const axisCalibration = reactive<AxisCalibration>({})

const hatModeEnabled = ref(false)
const calibrationModeEnabled = ref(false)
const autoProgressEnabled = ref(true) // Auto-advance to next action after confirming binding
const wcsActionsEnabled = ref(false) // Include WCS Armament mod actions
const aircraftActionsEnabled = ref(false) // Include fixed-wing aircraft mod actions

// Test mode state
const testModeEnabled = ref(false)
const testModeInput = ref<string | null>(null)
const testModeMatchingActions = ref<Action[]>([])

// Documentation expanded state
const docsExpanded = ref(false)

// Rebuild the actions list when an action-set toggle changes
function rebuildActionsList() {
  const aircraftActions = aircraftActionsEnabled.value ? AIRCRAFT_ACTIONS.map(action => ({ ...action, bindings: [] as string[] })) : []
  const baseActions = ACTIONS.map(action => ({ ...action, bindings: [] as string[] }))
  const wcsActions = wcsActionsEnabled.value ? WCS_ACTIONS.map(action => ({ ...action, bindings: [] as string[] })) : []

  // Preserve existing bindings where possible
  const existingBindings = new Map(state.actions.map(a => [a.name, a.bindings]))

  const newActions = [...aircraftActions, ...baseActions, ...wcsActions]
  newActions.forEach(action => {
    const existing = existingBindings.get(action.name)
    if (existing) {
      action.bindings = existing
    }
  })

  state.actions = newActions

  // Reset current action index if it's out of bounds
  if (state.currentActionIndex >= state.actions.length) {
    state.currentActionIndex = state.actions.length - 1
  }
  if (state.furthestActionIndex >= state.actions.length) {
    state.furthestActionIndex = state.actions.length - 1
  }
}

watch(wcsActionsEnabled, rebuildActionsList)
watch(aircraftActionsEnabled, rebuildActionsList)

// Cookie consent state
const showCookieConsent = ref(false)

// Visualization data for all connected gamepads
interface GamepadVisualization {
  index: number
  name: string
  axes: number[]
  buttons: boolean[]
}

const gamepadVisualizations = ref<GamepadVisualization[]>([])
const webHIDSupported = ref(false)
const webHIDDevices = ref<WebHIDDeviceInfo[]>([])
const webHIDError = ref<string | null>(null)

function refreshWebHIDDevices() {
  webHIDDevices.value = getWebHIDDevices()
}

async function connectWebHID() {
  webHIDError.value = null
  try {
    await requestWebHIDDevices()
    refreshWebHIDDevices()
    resetGamepadBaseline()
  } catch (error) {
    webHIDError.value = error instanceof Error ? error.message : String(error)
  }
}

function changeWebHIDJoystickIndex(key: string, event: Event) {
  const select = event.target as HTMLSelectElement
  setWebHIDJoystickIndex(key, Number.parseInt(select.value, 10))
  refreshWebHIDDevices()
  resetGamepadBaseline()
}

// Git commit hash injected at build time
const gitHash = __GIT_HASH__

// Computed
const filteredActions = computed(() => {
  return state.actions.filter(action => {
    if (state.filter === 'configured') return action.bindings.length > 0
    if (state.filter === 'unconfigured') return action.bindings.length === 0
    return true
  })
})

const configuredCount = computed(() => state.actions.filter(a => a.bindings.length > 0).length)
const unconfiguredCount = computed(() => state.actions.length - configuredCount.value)
const progressPercentage = computed(() => (configuredCount.value / state.actions.length) * 100)

const currentAction = computed(() => {
  if (state.currentActionIndex >= 0 && state.currentActionIndex < state.actions.length) {
    return state.actions[state.currentActionIndex]
  }
  return null
})

const showResumeButton = computed(() => {
  if (state.currentActionIndex < state.furthestActionIndex) {
    let resumeIndex = state.furthestActionIndex
    while (resumeIndex < state.actions.length && state.actions[resumeIndex].bindings.length > 0) {
      resumeIndex++
    }
    return resumeIndex < state.actions.length
  }
  return false
})

const resumeActionNumber = computed(() => {
  let resumeIndex = state.furthestActionIndex
  while (resumeIndex < state.actions.length && state.actions[resumeIndex].bindings.length > 0) {
    resumeIndex++
  }
  return resumeIndex + 1
})

const isConfigurationComplete = computed(() => {
  return configuredCount.value === state.actions.length && configuredCount.value > 0
})

// Fire action helpers
const FIRE_ACTION_NAMES = ['CharacterFire', 'TurretFire', 'HelicopterFire', 'VehicleFire']

// Weapon switching action helpers
const WEAPON_SWITCH_ACTION_NAMES = ['CharacterNextWeapon', 'TurretNextWeapon', 'VehicleNextWeapon']

const isCurrentActionFireAction = computed(() => {
  if (!currentAction.value) return false
  return FIRE_ACTION_NAMES.includes(currentAction.value.name)
})

const configuredFireActions = computed(() => {
  return state.actions.filter(action => FIRE_ACTION_NAMES.includes(action.name) && action.bindings.length > 0)
})

const firstConfiguredFireAction = computed(() => configuredFireActions.value[0] || null)

const isCurrentActionWeaponSwitch = computed(() => {
  if (!currentAction.value) return false
  return WEAPON_SWITCH_ACTION_NAMES.includes(currentAction.value.name)
})

const configuredWeaponSwitchActions = computed(() => {
  return state.actions.filter(action => WEAPON_SWITCH_ACTION_NAMES.includes(action.name) && action.bindings.length > 0)
})

const firstConfiguredWeaponSwitchAction = computed(() => configuredWeaponSwitchActions.value[0] || null)

// ... remaining file content unchanged ...
