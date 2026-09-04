import type { Action, ConnectedGamepad } from './types'

interface SolRBinding {
  type: 'button' | 'axis'
  controlIndex: number
  direction: '' | '+' | '-'
  actions: string[]
}

interface SolRDevice {
  index: number
  name: string
  bindings: SolRBinding[]
}

const WIDTH = 1920
const HEIGHT = 1080

export function isSolRDeviceName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return normalized.includes('solr2') || normalized.includes('solr')
}

function readableActionName(name: string): string {
  return name
    .replace(/^PFC_/, '')
    .replace(/^WCS_Armament_/, 'WCS ')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

function collectSolRDevices(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
): SolRDevice[] {
  const solRIndices = Object.values(connectedGamepads)
    .filter(device => isSolRDeviceName(device.id))
    .map(device => device.index)
    .sort((a, b) => a - b)

  return solRIndices.map(index => {
    const map = new Map<string, SolRBinding>()

    for (const action of actions) {
      for (const rawBinding of action.bindings) {
        const match = rawBinding.match(/^joystick(\d+):(button|axis)(\d+)([+-])?$/)
        if (!match || Number.parseInt(match[1], 10) !== index) continue

        const type = match[2] as 'button' | 'axis'
        const controlIndex = Number.parseInt(match[3], 10)
        const direction = (match[4] ?? '') as '' | '+' | '-'
        const key = `${type}:${controlIndex}:${direction}`
        let binding = map.get(key)
        if (!binding) {
          binding = { type, controlIndex, direction, actions: [] }
          map.set(key, binding)
        }

        const label = readableActionName(action.name)
        if (!binding.actions.includes(label)) binding.actions.push(label)
      }
    }

    const bindings = [...map.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'button' ? -1 : 1
      if (a.controlIndex !== b.controlIndex) return a.controlIndex - b.controlIndex
      return a.direction.localeCompare(b.direction)
    })

    return {
      index,
      name: connectedGamepads[index]?.id || `Joystick ${index}`,
      bindings
    }
  })
}

function physicalButtonNumber(binding: SolRBinding): number | null {
  // Browser/config numbering starts at button0 while the Sol-R2 hardware diagram starts at 1.
  if (binding.type !== 'button') return null
  return binding.controlIndex + 1
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawNumberBadge(
  ctx: CanvasRenderingContext2D,
  number: number,
  x: number,
  y: number,
  active: boolean
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fillStyle = active ? '#22d3ee' : '#334155'
  ctx.fill()
  ctx.strokeStyle = active ? '#a5f3fc' : '#64748b'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = active ? '#082f49' : '#e2e8f0'
  ctx.font = '700 12px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(number), x, y + 0.5)
  ctx.restore()
}

function drawSolRDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  activeButtons: Set<number>
) {
  ctx.save()
  const sx = width / 760
  const sy = height / 390
  ctx.translate(x, y)
  ctx.scale(sx, sy)

  // Base silhouette.
  roundedRect(ctx, 50, 205, 660, 150, 34)
  ctx.fillStyle = '#dbe2e8'
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 3
  ctx.stroke()

  // Left/right control banks inspired by the Sol-R2 template.
  roundedRect(ctx, 66, 220, 150, 118, 14)
  ctx.fillStyle = '#1f2937'
  ctx.fill()
  roundedRect(ctx, 544, 220, 150, 118, 14)
  ctx.fill()

  // Stick pedestal and grip.
  roundedRect(ctx, 318, 182, 124, 160, 28)
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  ctx.strokeStyle = '#64748b'
  ctx.stroke()
  roundedRect(ctx, 286, 35, 188, 165, 62)
  ctx.fillStyle = '#e5e7eb'
  ctx.fill()
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 4
  ctx.stroke()

  // Grip face controls.
  ctx.fillStyle = '#111827'
  ctx.beginPath(); ctx.arc(380, 78, 33, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(330, 128, 17, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(430, 128, 17, 0, Math.PI * 2); ctx.fill()
  roundedRect(ctx, 365, 132, 30, 55, 8); ctx.fill()

  // Mini decorative buttons on the base banks.
  ctx.fillStyle = '#0f172a'
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      roundedRect(ctx, 78 + col * 31, 246 + row * 38, 25, 27, 5); ctx.fill()
      roundedRect(ctx, 556 + col * 31, 246 + row * 38, 25, 27, 5); ctx.fill()
    }
  }

  // Button number positions reconstructed from the supplied right-stick numbering image.
  const positions: Record<number, [number, number]> = {
    1:[84,224],2:[84,244],3:[151,224],4:[151,244],5:[84,278],6:[151,278],7:[84,316],8:[151,316],
    9:[62,328],10:[62,350],11:[204,338],
    12:[609,224],13:[609,244],14:[542,224],15:[542,244],16:[609,278],17:[542,278],18:[609,316],19:[542,316],
    20:[530,350],21:[570,352],22:[610,352],23:[650,350],
    24:[330,145],25:[305,150],26:[430,145],27:[455,150],28:[380,310],29:[380,78],
    30:[330,58],31:[300,80],32:[316,43],33:[350,80],34:[330,108],35:[330,132],36:[380,174],37:[350,188],38:[410,188],
    39:[430,132],40:[430,78],41:[410,80],42:[444,43],43:[460,80],44:[430,108]
  }

  for (let number = 1; number <= 44; number++) {
    const pos = positions[number]
    if (!pos) continue
    drawNumberBadge(ctx, number, pos[0], pos[1], activeButtons.has(number))
  }

  ctx.restore()
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}...`).width > maxWidth) value = value.slice(0, -1)
  return `${value}...`
}

function drawBindingList(
  ctx: CanvasRenderingContext2D,
  device: SolRDevice,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const rowHeight = 31
  const gap = 14
  const columnWidth = (width - gap) / 2
  const maxRows = Math.max(1, Math.floor(height / rowHeight))
  const maxItems = maxRows * 2
  const bindings = device.bindings.slice(0, maxItems)

  for (let i = 0; i < bindings.length; i++) {
    const col = Math.floor(i / maxRows)
    const row = i % maxRows
    const bx = x + col * (columnWidth + gap)
    const by = y + row * rowHeight
    const binding = bindings[i]

    roundedRect(ctx, bx, by, columnWidth, rowHeight - 4, 6)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.9)'
    ctx.lineWidth = 1
    ctx.stroke()

    let control = ''
    if (binding.type === 'button') {
      control = `Button ${binding.controlIndex + 1}`
    } else {
      control = `Axis ${binding.controlIndex}${binding.direction}`
    }

    ctx.fillStyle = '#22d3ee'
    ctx.font = '700 14px ui-monospace, monospace'
    ctx.fillText(control, bx + 9, by + 19)

    ctx.fillStyle = '#f8fafc'
    ctx.font = '14px system-ui, sans-serif'
    const actionText = fitText(ctx, binding.actions.join(' / '), columnWidth - 118)
    ctx.fillText(actionText, bx + 108, by + 19)
  }

  if (device.bindings.length > maxItems) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`+ ${device.bindings.length - maxItems} more bindings`, x, y + height - 4)
  }
}

function drawDevicePanel(
  ctx: CanvasRenderingContext2D,
  device: SolRDevice,
  x: number,
  y: number,
  width: number,
  height: number
) {
  roundedRect(ctx, x, y, width, height, 24)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 30px system-ui, sans-serif'
  ctx.fillText(`SOL-R2 - JOYSTICK ${device.index}`, x + 24, y + 40)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText(fitText(ctx, device.name, width - 48), x + 24, y + 66)

  const activeButtons = new Set<number>()
  for (const binding of device.bindings) {
    const number = physicalButtonNumber(binding)
    if (number !== null && number >= 1 && number <= 44) activeButtons.add(number)
  }

  const diagramHeight = Math.min(410, height * 0.51)
  drawSolRDiagram(ctx, x + 22, y + 78, width - 44, diagramHeight, activeButtons)

  ctx.fillStyle = '#67e8f9'
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.fillText('Physical numbering: config button0 = Sol-R2 Button 1, button43 = Button 44', x + 24, y + 94 + diagramHeight)

  drawBindingList(ctx, device, x + 24, y + 120 + diagramHeight, width - 48, height - diagramHeight - 142)
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function tryDownloadSolRCheatSheet(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
): boolean {
  const devices = collectSolRDevices(actions, connectedGamepads)
  if (devices.length === 0) return false

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  background.addColorStop(0, '#020617')
  background.addColorStop(0.55, '#0f172a')
  background.addColorStop(1, '#082f49')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = 'rgba(255,255,255,0.26)'
  for (let i = 0; i < 100; i++) {
    const sx = (i * 173) % WIDTH
    const sy = (i * 311) % HEIGHT
    ctx.fillRect(sx, sy, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1)
  }

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 48px system-ui, sans-serif'
  ctx.fillText('ARMA REFORGER - THRUSTMASTER SOL-R2 CHEAT SHEET', 60, 62)
  ctx.fillStyle = '#22d3ee'
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText('Physical-layout reference generated from your configurator bindings', 62, 94)

  const visibleDevices = devices.slice(0, 2)
  const margin = 60
  const gap = 28
  const top = 124
  const panelHeight = HEIGHT - top - 48
  const panelWidth = visibleDevices.length === 1 ? WIDTH - margin * 2 : (WIDTH - margin * 2 - gap) / 2

  visibleDevices.forEach((device, i) => {
    drawDevicePanel(ctx, device, margin + i * (panelWidth + gap), top, panelWidth, panelHeight)
  })

  const firstDevice = safeFilenamePart(visibleDevices[0]?.name || 'Sol-R2')
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${firstDevice || 'Sol-R2'}_Physical_Cheat_Sheet.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')

  return true
}
