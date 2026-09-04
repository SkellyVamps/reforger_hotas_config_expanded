import type { Action, ConnectedGamepad } from './types'

interface CheatSheetBinding {
  joystickIndex: number
  type: 'button' | 'axis'
  controlIndex: number
  direction: '' | '+' | '-'
  actions: string[]
}

interface CheatSheetDevice {
  index: number
  name: string
  bindings: CheatSheetBinding[]
}

const WIDTH = 1920
const HEIGHT = 1080

function readableActionName(name: string): string {
  return name
    .replace(/^PFC_/, '')
    .replace(/^WCS_Armament_/, 'WCS ')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

function controlLabel(binding: CheatSheetBinding): string {
  if (binding.type === 'button') return `Button ${binding.controlIndex}`
  return `Axis ${binding.controlIndex}${binding.direction}`
}

function compareBindings(a: CheatSheetBinding, b: CheatSheetBinding): number {
  if (a.type !== b.type) return a.type === 'button' ? -1 : 1
  if (a.controlIndex !== b.controlIndex) return a.controlIndex - b.controlIndex
  return a.direction.localeCompare(b.direction)
}

function collectDevices(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
): CheatSheetDevice[] {
  const map = new Map<string, CheatSheetBinding>()

  for (const action of actions) {
    for (const rawBinding of action.bindings) {
      const match = rawBinding.match(/^joystick(\d+):(button|axis)(\d+)([+-])?$/)
      if (!match) continue

      const joystickIndex = Number.parseInt(match[1], 10)
      const type = match[2] as 'button' | 'axis'
      const controlIndex = Number.parseInt(match[3], 10)
      const direction = (match[4] ?? '') as '' | '+' | '-'
      const key = `${joystickIndex}:${type}:${controlIndex}:${direction}`

      let entry = map.get(key)
      if (!entry) {
        entry = { joystickIndex, type, controlIndex, direction, actions: [] }
        map.set(key, entry)
      }

      const label = readableActionName(action.name)
      if (!entry.actions.includes(label)) entry.actions.push(label)
    }
  }

  const indices = new Set<number>()
  for (const entry of map.values()) indices.add(entry.joystickIndex)

  const devices: CheatSheetDevice[] = [...indices]
    .sort((a, b) => a - b)
    .map(index => ({
      index,
      name: connectedGamepads[index]?.id || `Joystick ${index}`,
      bindings: [...map.values()]
        .filter(entry => entry.joystickIndex === index)
        .sort(compareBindings)
    }))

  return devices
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

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed}…`
}

function drawDeviceCard(
  ctx: CanvasRenderingContext2D,
  device: CheatSheetDevice,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const accent = '#22d3ee'
  const text = '#f8fafc'
  const muted = '#94a3b8'

  ctx.save()
  roundedRect(ctx, x, y, width, height, 28)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = text
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText(`JOYSTICK ${device.index}`, x + 32, y + 48)

  ctx.font = '20px system-ui, sans-serif'
  ctx.fillStyle = muted
  const deviceName = fitText(ctx, device.name, width - 64)
  ctx.fillText(deviceName, x + 32, y + 78)

  const top = y + 108
  const innerWidth = width - 64
  const columnGap = 18
  const columnWidth = (innerWidth - columnGap) / 2
  const rowHeight = 38
  const maxRows = Math.max(1, Math.floor((height - 148) / rowHeight))
  const maxItems = maxRows * 2
  const bindings = device.bindings.slice(0, maxItems)

  for (let i = 0; i < bindings.length; i++) {
    const column = Math.floor(i / maxRows)
    const row = i % maxRows
    const bx = x + 32 + column * (columnWidth + columnGap)
    const by = top + row * rowHeight
    const binding = bindings[i]

    roundedRect(ctx, bx, by, columnWidth, rowHeight - 6, 8)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.96)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.95)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = accent
    const control = controlLabel(binding)
    ctx.fillText(control, bx + 12, by + 21)

    const labelX = bx + 122
    const labelWidth = columnWidth - 134
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillStyle = text
    const actionText = fitText(ctx, binding.actions.join(' / '), labelWidth)
    ctx.fillText(actionText, labelX, by + 21)
  }

  if (device.bindings.length === 0) {
    ctx.font = '20px system-ui, sans-serif'
    ctx.fillStyle = muted
    ctx.fillText('No configured bindings for this joystick.', x + 32, top + 28)
  } else if (device.bindings.length > maxItems) {
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillStyle = muted
    ctx.fillText(`+ ${device.bindings.length - maxItems} more bindings`, x + 32, y + height - 20)
  }

  ctx.restore()
}

function drawSheet(actions: Action[], connectedGamepads: Record<number, ConnectedGamepad>): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create cheat-sheet canvas')

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  background.addColorStop(0, '#020617')
  background.addColorStop(0.5, '#0f172a')
  background.addColorStop(1, '#082f49')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Subtle star-field effect inspired by common HOTAS reference sheets.
  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  for (let i = 0; i < 110; i++) {
    const sx = (i * 173) % WIDTH
    const sy = (i * 311) % HEIGHT
    const size = i % 9 === 0 ? 2 : 1
    ctx.fillRect(sx, sy, size, size)
  }

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 54px system-ui, sans-serif'
  ctx.fillText('ARMA REFORGER HOTAS CHEAT SHEET', 70, 76)

  ctx.fillStyle = '#22d3ee'
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillText('Generated from your HOTAS Configurator bindings', 72, 112)

  const devices = collectDevices(actions, connectedGamepads)
  const visibleDevices = devices.length > 0 ? devices.slice(0, 4) : [{ index: 0, name: 'Joystick 0', bindings: [] }]

  const margin = 70
  const gap = 28
  const contentTop = 150
  const contentHeight = HEIGHT - contentTop - 64

  if (visibleDevices.length === 1) {
    drawDeviceCard(ctx, visibleDevices[0], margin, contentTop, WIDTH - margin * 2, contentHeight)
  } else if (visibleDevices.length === 2) {
    const cardWidth = (WIDTH - margin * 2 - gap) / 2
    drawDeviceCard(ctx, visibleDevices[0], margin, contentTop, cardWidth, contentHeight)
    drawDeviceCard(ctx, visibleDevices[1], margin + cardWidth + gap, contentTop, cardWidth, contentHeight)
  } else {
    const cardWidth = (WIDTH - margin * 2 - gap) / 2
    const cardHeight = (contentHeight - gap) / 2
    visibleDevices.forEach((device, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      drawDeviceCard(
        ctx,
        device,
        margin + col * (cardWidth + gap),
        contentTop + row * (cardHeight + gap),
        cardWidth,
        cardHeight
      )
    })
  }

  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
  ctx.font = '16px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('reforger_hotas_config_expanded', WIDTH - 70, HEIGHT - 24)
  ctx.textAlign = 'left'

  return canvas
}

function safeFilenamePart(value: string): string {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function downloadCheatSheet(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
) {
  const canvas = drawSheet(actions, connectedGamepads)
  const devices = Object.values(connectedGamepads)
  const firstDevice = devices.length > 0 ? safeFilenamePart(devices[0].id) : 'HOTAS'
  const filename = `${firstDevice || 'HOTAS'}_Cheat_Sheet.png`

  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
