import {
  getRawGamepads,
  getReforgerIndexForGamepad,
  isGamepadIgnored,
  setGamepadIgnored,
  setReforgerIndexForGamepad
} from './reforgerIndex'

const MAX_REFORGER_JOYSTICKS = 4
const PANEL_ID = 'merged-joystick-device-panel'
const STYLE_ID = 'merged-joystick-device-style'
let mounted = false
let refreshTimer: number | null = null
let lastSignature = ''

interface WebHIDRowInfo {
  row: HTMLElement
  name: string
  detail: string
  select: HTMLSelectElement | null
  matched: boolean
}

function normalizeDeviceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(vendor:[^)]+\)/gi, '')
    .replace(/vendor:\s*[0-9a-f]+/gi, '')
    .replace(/product:\s*[0-9a-f]+/gi, '')
    .replace(/[^a-z0-9]/g, '')
}

function namesMatch(left: string, right: string): boolean {
  const a = normalizeDeviceName(left)
  const b = normalizeDeviceName(right)
  if (!a || !b) return false
  if (a === b) return true
  return a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))
}

function getBrowserIndex(gamepad: Gamepad): number {
  return gamepad.index
}

function findVueGamepadRow(status: HTMLElement, gamepad: Gamepad): HTMLElement | null {
  const rows = status.querySelectorAll<HTMLElement>('#joystick-list .joystick-item')
  for (const row of rows) {
    const name = row.querySelector<HTMLElement>('.joystick-name')?.textContent?.trim() ?? ''
    if (name === gamepad.id || namesMatch(name, gamepad.id)) return row
  }
  return null
}

function collectWebHIDRows(status: HTMLElement): WebHIDRowInfo[] {
  const lists = Array.from(status.querySelectorAll<HTMLElement>('.webhid-device-list'))
  const result: WebHIDRowInfo[] = []

  for (const list of lists) {
    if (list.closest(`#${PANEL_ID}`)) continue

    for (const row of Array.from(list.querySelectorAll<HTMLElement>(':scope > .joystick-item'))) {
      const name = row.querySelector<HTMLElement>('.joystick-name')?.textContent?.trim() ?? ''
      const detail = row.querySelector<HTMLElement>('.joystick-id')?.textContent?.trim() ?? ''
      if (!detail.includes('WebHID')) continue

      result.push({
        row,
        name,
        detail,
        select: row.querySelector<HTMLSelectElement>('select'),
        matched: false
      })
    }
  }

  return result
}

function findMatchingWebHID(gamepad: Gamepad, webhidRows: WebHIDRowInfo[]): WebHIDRowInfo | null {
  for (const candidate of webhidRows) {
    if (candidate.matched) continue
    if (namesMatch(gamepad.id, candidate.name)) return candidate
  }
  return null
}

function createIndexSelect(value: number, onChange: (index: number) => void): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'merged-device-index-select'

  for (let index = 0; index < MAX_REFORGER_JOYSTICKS; index++) {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = `joystick${index}`
    option.selected = index === value
    select.appendChild(option)
  }

  select.addEventListener('change', () => {
    onChange(Number.parseInt(select.value, 10))
    lastSignature = ''
  })

  return select
}

function createSourceLine(text: string, badge?: string): HTMLElement {
  const line = document.createElement('div')
  line.className = 'merged-device-source'

  const textNode = document.createElement('span')
  textNode.textContent = text
  line.appendChild(textNode)

  if (badge) {
    const badgeNode = document.createElement('span')
    badgeNode.className = 'merged-device-source-badge'
    badgeNode.textContent = badge
    line.appendChild(badgeNode)
  }

  return line
}

function createDeviceCard(
  status: HTMLElement,
  gamepad: Gamepad,
  webhid: WebHIDRowInfo | null
): HTMLElement {
  const ignored = isGamepadIgnored(gamepad)
  const card = document.createElement('div')
  card.className = `merged-device-card${ignored ? ' ignored' : ''}`

  const header = document.createElement('div')
  header.className = 'merged-device-header'

  const identity = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'joystick-name merged-device-name'
  title.textContent = gamepad.id
  identity.appendChild(title)

  const state = document.createElement('div')
  state.className = 'merged-device-state'
  state.textContent = ignored ? 'Ignored' : (webhid ? 'WebHID preferred' : 'Gamepad API')
  identity.appendChild(state)
  header.appendChild(identity)

  const mapping = document.createElement('label')
  mapping.className = 'merged-device-mapping'
  mapping.append('Reforger joystick ')

  const currentIndex = webhid?.select
    ? Number.parseInt(webhid.select.value, 10)
    : getReforgerIndexForGamepad(gamepad)

  mapping.appendChild(createIndexSelect(currentIndex, index => {
    setReforgerIndexForGamepad(gamepad, index)
    if (webhid?.select) {
      webhid.select.value = String(index)
      webhid.select.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }))
  header.appendChild(mapping)
  card.appendChild(header)

  const sources = document.createElement('div')
  sources.className = 'merged-device-sources'

  if (webhid) {
    webhid.matched = true
    sources.appendChild(createSourceLine(webhid.detail, 'ACTIVE'))
    sources.appendChild(createSourceLine(`Gamepad API · Browser index ${getBrowserIndex(gamepad)}`, 'FALLBACK'))
  } else {
    sources.appendChild(createSourceLine(
      `Gamepad API · Browser index ${getBrowserIndex(gamepad)}`,
      ignored ? 'IGNORED' : 'ACTIVE'
    ))
  }

  card.appendChild(sources)

  // When WebHID owns the same physical device, App.vue already suppresses the duplicate Gamepad
  // snapshot. Do not offer an Ignore button that would misleadingly imply the WebHID source is off.
  if (!webhid) {
    const actions = document.createElement('div')
    actions.className = 'merged-device-actions'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'btn btn-secondary'
    button.textContent = ignored ? 'Restore Device' : 'Ignore Device'

    button.addEventListener('click', () => {
      const vueRow = findVueGamepadRow(status, gamepad)

      if (ignored) {
        // Clear persistence first so the device cannot immediately re-ignore itself, then let Vue
        // remove its session-only private ignored index if a hidden Restore button exists.
        setGamepadIgnored(gamepad, false)
        const restore = Array.from(vueRow?.querySelectorAll<HTMLButtonElement>('button') ?? [])
          .find(candidate => candidate.textContent?.trim() === 'Restore')
        restore?.click()
      } else {
        // Use the existing Vue Ignore button when possible because it also clears baselines and
        // calibration state. The persistent ignore helper handles the physical-device identity.
        const ignore = Array.from(vueRow?.querySelectorAll<HTMLButtonElement>('button') ?? [])
          .find(candidate => candidate.textContent?.trim() === 'Ignore')
        if (ignore) ignore.click()
        else setGamepadIgnored(gamepad, true)
      }

      lastSignature = ''
      window.setTimeout(() => renderMergedPanel(status), 50)
    })

    actions.appendChild(button)
    card.appendChild(actions)
  }

  return card
}

function createWebHIDOnlyCard(webhid: WebHIDRowInfo): HTMLElement {
  const card = document.createElement('div')
  card.className = 'merged-device-card'

  const header = document.createElement('div')
  header.className = 'merged-device-header'

  const identity = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'joystick-name merged-device-name'
  title.textContent = webhid.name
  identity.appendChild(title)

  const state = document.createElement('div')
  state.className = 'merged-device-state'
  state.textContent = 'WebHID only'
  identity.appendChild(state)
  header.appendChild(identity)

  const mapping = document.createElement('label')
  mapping.className = 'merged-device-mapping'
  mapping.append('Reforger joystick ')
  const currentIndex = webhid.select ? Number.parseInt(webhid.select.value, 10) : 0
  mapping.appendChild(createIndexSelect(currentIndex, index => {
    if (!webhid.select) return
    webhid.select.value = String(index)
    webhid.select.dispatchEvent(new Event('change', { bubbles: true }))
  }))
  header.appendChild(mapping)
  card.appendChild(header)

  const sources = document.createElement('div')
  sources.className = 'merged-device-sources'
  sources.appendChild(createSourceLine(webhid.detail, 'ACTIVE'))
  card.appendChild(sources)

  webhid.matched = true
  return card
}

function buildSignature(status: HTMLElement, webhidRows: WebHIDRowInfo[]): string {
  const gamepadParts = getRawGamepads()
    .filter((gamepad): gamepad is Gamepad => Boolean(gamepad))
    .map(gamepad => `${gamepad.id}|${gamepad.index}|${getReforgerIndexForGamepad(gamepad)}|${isGamepadIgnored(gamepad) ? 1 : 0}`)

  const webhidParts = webhidRows.map(row => `${row.name}|${row.detail}|${row.select?.value ?? ''}`)
  return [...gamepadParts, ...webhidParts].join('||') + `|${status.isConnected ? 1 : 0}`
}

function renderMergedPanel(status: HTMLElement): void {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return

  const webhidRows = collectWebHIDRows(status)
  const signature = buildSignature(status, webhidRows)
  if (signature === lastSignature) return
  lastSignature = signature

  const gamepads = getRawGamepads().filter((gamepad): gamepad is Gamepad => Boolean(gamepad))
  panel.replaceChildren()

  const heading = document.createElement('h3')
  heading.textContent = 'Connected Devices'
  panel.appendChild(heading)

  const note = document.createElement('p')
  note.className = 'no-joysticks merged-device-note'
  note.textContent = 'Each physical device is shown once. When WebHID and Gamepad API detect the same controller, WebHID is used as the primary source and the Gamepad API copy is kept only as a fallback.'
  panel.appendChild(note)

  const list = document.createElement('div')
  list.className = 'merged-device-list'

  for (const gamepad of gamepads) {
    const webhid = findMatchingWebHID(gamepad, webhidRows)
    list.appendChild(createDeviceCard(status, gamepad, webhid))
  }

  for (const webhid of webhidRows) {
    if (!webhid.matched) list.appendChild(createWebHIDOnlyCard(webhid))
  }

  if (list.children.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'no-joysticks'
    empty.textContent = 'No joystick devices detected yet.'
    list.appendChild(empty)
  }

  panel.appendChild(list)
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    #reforger-joystick-index-panel,
    .joystick-status > .webhid-device-list,
    .joystick-status > #joystick-list {
      display: none !important;
    }

    #${PANEL_ID} {
      margin-bottom: 12px;
    }

    #${PANEL_ID} h3 {
      margin-bottom: 4px;
    }

    .merged-device-note {
      margin-bottom: 8px;
    }

    .merged-device-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .merged-device-card {
      border: 2px solid #4a5d23;
      background: linear-gradient(135deg, rgba(64, 79, 54, 0.72), rgba(38, 48, 43, 0.82));
      padding: 12px;
      transition: opacity 0.2s ease, border-color 0.2s ease;
    }

    .merged-device-card.ignored {
      opacity: 0.45;
    }

    .merged-device-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: wrap;
    }

    .merged-device-name {
      margin-bottom: 2px;
    }

    .merged-device-state {
      color: #95a5a6;
      font-size: 0.86em;
    }

    .merged-device-mapping {
      color: #bdc3c7;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .merged-device-index-select {
      min-width: 95px;
    }

    .merged-device-sources {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 9px;
    }

    .merged-device-source {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      color: #aab4b6;
      font-size: 0.9em;
    }

    .merged-device-source-badge {
      border: 1px solid #66743a;
      padding: 1px 6px;
      color: #d4af37;
      font-size: 0.72em;
      letter-spacing: 1px;
    }

    .merged-device-actions {
      margin-top: 10px;
    }
  `
  document.head.appendChild(style)
}

export function mountMergedDevicePanel(): void {
  if (mounted) return
  mounted = true
  installStyles()

  const mountWhenReady = () => {
    const status = document.querySelector<HTMLElement>('.joystick-status')
    if (!status) {
      requestAnimationFrame(mountWhenReady)
      return
    }

    let panel = document.getElementById(PANEL_ID)
    if (!panel) {
      panel = document.createElement('div')
      panel.id = PANEL_ID
      const webHIDControls = status.querySelector('.webhid-controls')
      status.insertBefore(panel, webHIDControls)
    }

    renderMergedPanel(status)

    window.addEventListener('gamepadconnected', () => {
      lastSignature = ''
      renderMergedPanel(status)
    })
    window.addEventListener('gamepaddisconnected', () => {
      lastSignature = ''
      renderMergedPanel(status)
    })
    window.addEventListener('reforger-joystick-mapping-changed', () => {
      lastSignature = ''
      renderMergedPanel(status)
    })
    window.addEventListener('reforger-ignored-gamepads-changed', () => {
      lastSignature = ''
      renderMergedPanel(status)
    })

    refreshTimer = window.setInterval(() => renderMergedPanel(status), 500)
  }

  mountWhenReady()
}

export function unmountMergedDevicePanel(): void {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
}
