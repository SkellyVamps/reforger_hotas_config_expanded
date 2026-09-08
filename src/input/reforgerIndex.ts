const MAX_REFORGER_JOYSTICKS = 4
const STORAGE_PREFIX = 'reforger-index:gamepad:'
const MAPPING_CHANGED_EVENT = 'reforger-joystick-mapping-changed'
const IGNORE_CHANGED_EVENT = 'reforger-ignored-gamepads-changed'
const IGNORE_COOKIE_NAME = 'reforger_ignored_gamepads'
const IGNORE_STORAGE_KEY = 'reforger-ignored-gamepads'
const IGNORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const nativeGetGamepads = navigator.getGamepads.bind(navigator)
let mappingInstalled = false
let mappingPanelMounted = false
let mappingPanelTimer: number | null = null
let ignoreSyncInstalled = false
let lastPanelSignature = ''

function clampReforgerIndex(index: number): number {
  return Math.min(MAX_REFORGER_JOYSTICKS - 1, Math.max(0, Math.trunc(index)))
}

function storageKey(gamepad: Gamepad): string {
  return `${STORAGE_PREFIX}${gamepad.id}`
}

function readSavedIndex(gamepad: Gamepad): number | null {
  try {
    const saved = localStorage.getItem(storageKey(gamepad))
    if (saved === null) return null

    const parsed = Number.parseInt(saved, 10)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < MAX_REFORGER_JOYSTICKS) {
      return parsed
    }
  } catch {
    // localStorage can be unavailable in restrictive browser modes.
  }

  return null
}

function writeSavedIndex(gamepad: Gamepad, index: number): void {
  try {
    localStorage.setItem(storageKey(gamepad), String(clampReforgerIndex(index)))
  } catch {
    // Keep working for the current browser session even when persistence is unavailable.
  }
}

export function getRawGamepads(): (Gamepad | null)[] {
  return Array.from(nativeGetGamepads())
}

// Gamepad API does not expose a hardware serial number, so this is the most stable identity it
// gives us without depending on either the browser index or the Reforger joystick number.
// The button/axis counts help avoid collisions between differently configured devices that happen
// to report the same display name. Identical copies of the exact same model remain indistinguishable
// to the standard Gamepad API and therefore share an ignore preference.
export function getGamepadDeviceKey(gamepad: Gamepad): string {
  return `${gamepad.id}|${gamepad.mapping || 'none'}|buttons:${gamepad.buttons.length}|axes:${gamepad.axes.length}`
}

function readIgnoredDeviceKeysFromCookie(): Set<string> | null {
  try {
    const prefix = `${IGNORE_COOKIE_NAME}=`
    const entry = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix))

    if (!entry) return null

    const raw = decodeURIComponent(entry.slice(prefix.length))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()

    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return null
  }
}

function readIgnoredDeviceKeysFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORE_STORAGE_KEY)
    if (!raw) return new Set<string>()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()

    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set<string>()
  }
}

function readIgnoredDeviceKeys(): Set<string> {
  const cookieValues = readIgnoredDeviceKeysFromCookie()
  if (cookieValues !== null) return cookieValues
  return readIgnoredDeviceKeysFromStorage()
}

function writeIgnoredDeviceKeys(keys: Set<string>): void {
  const values = [...keys]
  const json = JSON.stringify(values)

  // This is a functional preference cookie rather than tracking data. Keep a localStorage copy as
  // a fallback for browsers/privacy modes that reject cookies on GitHub Pages.
  try {
    document.cookie = `${IGNORE_COOKIE_NAME}=${encodeURIComponent(json)}; Max-Age=${IGNORE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
  } catch {
    // Fall through to localStorage.
  }

  try {
    localStorage.setItem(IGNORE_STORAGE_KEY, json)
  } catch {
    // Persistence is optional; the current Vue session can still keep its in-memory ignore state.
  }
}

export function isGamepadIgnored(gamepad: Gamepad): boolean {
  return readIgnoredDeviceKeys().has(getGamepadDeviceKey(gamepad))
}

export function setGamepadIgnored(gamepad: Gamepad, ignored: boolean): void {
  const keys = readIgnoredDeviceKeys()
  const key = getGamepadDeviceKey(gamepad)

  if (ignored) keys.add(key)
  else keys.delete(key)

  writeIgnoredDeviceKeys(keys)
  lastPanelSignature = ''
  window.dispatchEvent(new CustomEvent(IGNORE_CHANGED_EVENT))
}

export function getReforgerIndexForGamepad(gamepad: Gamepad): number {
  const saved = readSavedIndex(gamepad)
  if (saved !== null) return saved

  // Remember the first browser index we see. If Windows/browser enumeration changes after a
  // reconnect, the generated Reforger joystick number stays stable instead of silently changing.
  const initialIndex = clampReforgerIndex(gamepad.index)
  writeSavedIndex(gamepad, initialIndex)
  return initialIndex
}

export function setReforgerIndexForGamepad(gamepad: Gamepad, index: number): void {
  const nextIndex = clampReforgerIndex(index)
  const previousIndex = getReforgerIndexForGamepad(gamepad)
  const targetStorageKey = storageKey(gamepad)

  // Keep currently connected Gamepad API devices unique where possible. Choosing an index already
  // used by another different device swaps the two assignments rather than producing two devices
  // that both generate joystickN bindings.
  for (const other of getRawGamepads()) {
    if (!other || storageKey(other) === targetStorageKey) continue
    if (getReforgerIndexForGamepad(other) !== nextIndex) continue

    writeSavedIndex(other, previousIndex)
    break
  }

  writeSavedIndex(gamepad, nextIndex)
  window.dispatchEvent(new CustomEvent(MAPPING_CHANGED_EVENT))
}

function mappedGamepad(gamepad: Gamepad): Gamepad {
  const reforgerIndex = getReforgerIndexForGamepad(gamepad)

  return new Proxy(gamepad, {
    get(target, property) {
      if (property === 'index') return reforgerIndex

      const value = Reflect.get(target, property, target)
      if (typeof value === 'function') return value.bind(target)
      return value
    }
  }) as Gamepad
}

function mappedGetGamepads(): ReturnType<Navigator['getGamepads']> {
  return getRawGamepads().map(gamepad => gamepad ? mappedGamepad(gamepad) : null) as ReturnType<Navigator['getGamepads']>
}

export function installReforgerIndexMapping(): void {
  if (mappingInstalled) return
  mappingInstalled = true

  try {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: mappedGetGamepads
    })
    return
  } catch {
    // Some browsers do not allow an own-property override on navigator. Fall back to its prototype.
  }

  try {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'getGamepads', {
      configurable: true,
      value: mappedGetGamepads
    })
  } catch (error) {
    console.warn('Unable to install Reforger joystick-index mapping:', error)
  }
}

function createIndexSelect(gamepad: Gamepad): HTMLSelectElement {
  const select = document.createElement('select')
  select.setAttribute('aria-label', `Reforger joystick number for ${gamepad.id}`)

  const currentIndex = getReforgerIndexForGamepad(gamepad)
  for (let index = 0; index < MAX_REFORGER_JOYSTICKS; index++) {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = `joystick${index}`
    option.selected = index === currentIndex
    select.appendChild(option)
  }

  select.addEventListener('change', () => {
    setReforgerIndexForGamepad(gamepad, Number.parseInt(select.value, 10))
    lastPanelSignature = ''
  })

  return select
}

function renderMappingPanel(root: HTMLElement): void {
  const gamepads = getRawGamepads()
    .filter((gamepad): gamepad is Gamepad => Boolean(gamepad))
    .filter(gamepad => !isGamepadIgnored(gamepad))

  const signature = gamepads
    .map(gamepad => `${getGamepadDeviceKey(gamepad)}|${gamepad.index}|${getReforgerIndexForGamepad(gamepad)}`)
    .join('||')

  if (signature === lastPanelSignature) return
  lastPanelSignature = signature
  root.replaceChildren()

  if (gamepads.length === 0) {
    root.style.display = 'none'
    return
  }

  root.style.display = ''

  const heading = document.createElement('h3')
  heading.textContent = 'Reforger Joystick Numbers'
  root.appendChild(heading)

  const note = document.createElement('p')
  note.className = 'no-joysticks'
  note.textContent = 'Browser index is only used to detect the physical device. Choose the joystick number Reforger should receive in generated bindings; this choice is remembered after reconnecting the device. Ignored devices are hidden here.'
  root.appendChild(note)

  const list = document.createElement('div')
  list.className = 'webhid-device-list'

  for (const gamepad of gamepads) {
    const row = document.createElement('div')
    row.className = 'joystick-item'

    const identity = document.createElement('div')
    const name = document.createElement('div')
    name.className = 'joystick-name'
    name.textContent = gamepad.id

    const details = document.createElement('div')
    details.className = 'joystick-id'
    details.textContent = `Gamepad API · Browser index ${gamepad.index}`

    identity.append(name, details)

    const label = document.createElement('label')
    label.className = 'joystick-id'
    label.append('Reforger joystick ')
    label.appendChild(createIndexSelect(gamepad))

    row.append(identity, label)
    list.appendChild(row)
  }

  root.appendChild(list)
}

function findRawGamepadForRow(row: HTMLElement): Gamepad | null {
  const name = row.querySelector<HTMLElement>('.joystick-name')?.textContent?.trim()
  if (!name) return null

  return getRawGamepads().find((gamepad): gamepad is Gamepad => Boolean(gamepad) && gamepad.id === name) ?? null
}

function syncPersistedIgnoredRows(status: HTMLElement): void {
  const rows = status.querySelectorAll<HTMLElement>('#joystick-list .joystick-item')

  for (const row of rows) {
    const gamepad = findRawGamepadForRow(row)
    if (!gamepad || !isGamepadIgnored(gamepad)) continue

    const button = Array.from(row.querySelectorAll<HTMLButtonElement>('button'))
      .find(candidate => candidate.textContent?.trim() === 'Ignore')

    // Rebuild the Vue component's session-only numeric ignore set from our persistent device key.
    // This means reconnecting a device on a different browser/Reforger index still ignores the
    // same physical model instead of whichever device happens to occupy the old index.
    if (button) button.click()
  }
}

function installPersistentIgnoreSync(status: HTMLElement): void {
  if (ignoreSyncInstalled) return
  ignoreSyncInstalled = true

  status.addEventListener('click', event => {
    const target = event.target as HTMLElement | null
    const button = target?.closest<HTMLButtonElement>('button')
    if (!button) return

    const action = button.textContent?.trim()
    if (action !== 'Ignore' && action !== 'Restore') return

    const row = button.closest<HTMLElement>('#joystick-list .joystick-item')
    if (!row) return

    const gamepad = findRawGamepadForRow(row)
    if (!gamepad) return

    setGamepadIgnored(gamepad, action === 'Ignore')
  }, true)

  // App.vue keeps ignored devices in memory using the current joystick index. Reapply the saved
  // device identities after first render and after future reconnects/index changes.
  window.setInterval(() => syncPersistedIgnoredRows(status), 500)
}

export function mountReforgerIndexPanel(): void {
  if (mappingPanelMounted) return
  mappingPanelMounted = true

  const mountWhenReady = () => {
    const status = document.querySelector<HTMLElement>('.joystick-status')
    if (!status) {
      requestAnimationFrame(mountWhenReady)
      return
    }

    installPersistentIgnoreSync(status)

    let root = document.getElementById('reforger-joystick-index-panel')
    if (!root) {
      root = document.createElement('div')
      root.id = 'reforger-joystick-index-panel'
      const webHIDControls = status.querySelector('.webhid-controls')
      status.insertBefore(root, webHIDControls)
    }

    syncPersistedIgnoredRows(status)
    renderMappingPanel(root)

    window.addEventListener('gamepadconnected', () => {
      lastPanelSignature = ''
      syncPersistedIgnoredRows(status)
      renderMappingPanel(root as HTMLElement)
    })
    window.addEventListener('gamepaddisconnected', () => {
      lastPanelSignature = ''
      renderMappingPanel(root as HTMLElement)
    })
    window.addEventListener(MAPPING_CHANGED_EVENT, () => {
      lastPanelSignature = ''
      renderMappingPanel(root as HTMLElement)
    })
    window.addEventListener(IGNORE_CHANGED_EVENT, () => {
      lastPanelSignature = ''
      renderMappingPanel(root as HTMLElement)
    })

    mappingPanelTimer = window.setInterval(() => renderMappingPanel(root as HTMLElement), 1000)
  }

  mountWhenReady()
}

export function unmountReforgerIndexPanel(): void {
  if (mappingPanelTimer !== null) {
    window.clearInterval(mappingPanelTimer)
    mappingPanelTimer = null
  }
}
