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

interface CheatSheetPage {
  device: CheatSheetDevice
  bindings: CheatSheetBinding[]
  pageNumber: number
  totalPages: number
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

const WIDTH = 1920
const HEIGHT = 1080
const COLUMN_COUNT = 3
const ROWS_PER_COLUMN = 18
const BINDINGS_PER_PAGE = COLUMN_COUNT * ROWS_PER_COLUMN

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
  if (binding.type === 'button') return `Button ${binding.controlIndex + 1}`
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

  return [...indices]
    .sort((a, b) => a - b)
    .map(index => ({
      index,
      name: connectedGamepads[index]?.id || `Joystick ${index}`,
      bindings: [...map.values()]
        .filter(entry => entry.joystickIndex === index)
        .sort(compareBindings)
    }))
}

function paginateDevices(devices: CheatSheetDevice[]): CheatSheetPage[] {
  const sourceDevices = devices.length > 0
    ? devices
    : [{ index: 0, name: 'Joystick 0', bindings: [] }]

  const pages: CheatSheetPage[] = []

  for (const device of sourceDevices) {
    const totalPages = Math.max(1, Math.ceil(device.bindings.length / BINDINGS_PER_PAGE))

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const start = pageIndex * BINDINGS_PER_PAGE
      pages.push({
        device,
        bindings: device.bindings.slice(start, start + BINDINGS_PER_PAGE),
        pageNumber: pageIndex + 1,
        totalPages
      })
    }
  }

  return pages
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
  page: CheatSheetPage,
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
  ctx.fillText(`JOYSTICK ${page.device.index}`, x + 32, y + 48)

  ctx.font = '20px system-ui, sans-serif'
  ctx.fillStyle = muted
  const pageSuffix = page.totalPages > 1 ? ` · Page ${page.pageNumber} of ${page.totalPages}` : ''
  const deviceName = fitText(ctx, `${page.device.name}${pageSuffix}`, width - 64)
  ctx.fillText(deviceName, x + 32, y + 78)

  const top = y + 108
  const innerWidth = width - 64
  const columnGap = 18
  const columnWidth = (innerWidth - columnGap * (COLUMN_COUNT - 1)) / COLUMN_COUNT
  const rowHeight = 38

  for (let i = 0; i < page.bindings.length; i++) {
    const column = Math.floor(i / ROWS_PER_COLUMN)
    const row = i % ROWS_PER_COLUMN
    const bx = x + 32 + column * (columnWidth + columnGap)
    const by = top + row * rowHeight
    const binding = page.bindings[i]

    roundedRect(ctx, bx, by, columnWidth, rowHeight - 6, 8)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.96)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.95)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = accent
    const control = controlLabel(binding)
    ctx.fillText(control, bx + 10, by + 21)

    const labelX = bx + 112
    const labelWidth = columnWidth - 122
    ctx.font = '15px system-ui, sans-serif'
    ctx.fillStyle = text
    const actionText = fitText(ctx, binding.actions.join(' / '), labelWidth)
    ctx.fillText(actionText, labelX, by + 21)
  }

  if (page.device.bindings.length === 0) {
    ctx.font = '20px system-ui, sans-serif'
    ctx.fillStyle = muted
    ctx.fillText('No configured bindings for this joystick.', x + 32, top + 28)
  }

  ctx.restore()
}

function drawSheet(page: CheatSheetPage, exportPageNumber: number, exportPageCount: number): HTMLCanvasElement {
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

  const margin = 70
  const contentTop = 150
  const contentHeight = HEIGHT - contentTop - 64
  drawDeviceCard(ctx, page, margin, contentTop, WIDTH - margin * 2, contentHeight)

  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
  ctx.font = '16px system-ui, sans-serif'
  ctx.textAlign = 'left'
  if (exportPageCount > 1) {
    ctx.fillText(`Cheat sheet ${exportPageNumber} of ${exportPageCount}`, 70, HEIGHT - 24)
  }
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to render cheat-sheet PNG'))
    }, 'image/png')
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeUint32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  )
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff

  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const checksum = crc32(entry.data)

    const localHeader: number[] = []
    writeUint32(localHeader, 0x04034b50)
    writeUint16(localHeader, 20)
    writeUint16(localHeader, 0x0800)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint32(localHeader, checksum)
    writeUint32(localHeader, entry.data.length)
    writeUint32(localHeader, entry.data.length)
    writeUint16(localHeader, nameBytes.length)
    writeUint16(localHeader, 0)

    const local = new Uint8Array(localHeader.length + nameBytes.length + entry.data.length)
    local.set(localHeader, 0)
    local.set(nameBytes, localHeader.length)
    local.set(entry.data, localHeader.length + nameBytes.length)
    localParts.push(local)

    const centralHeader: number[] = []
    writeUint32(centralHeader, 0x02014b50)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 0x0800)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, checksum)
    writeUint32(centralHeader, entry.data.length)
    writeUint32(centralHeader, entry.data.length)
    writeUint16(centralHeader, nameBytes.length)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, 0)
    writeUint32(centralHeader, offset)

    const central = new Uint8Array(centralHeader.length + nameBytes.length)
    central.set(centralHeader, 0)
    central.set(nameBytes, centralHeader.length)
    centralParts.push(central)

    offset += local.length
  }

  const centralOffset = offset
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end: number[] = []
  writeUint32(end, 0x06054b50)
  writeUint16(end, 0)
  writeUint16(end, 0)
  writeUint16(end, entries.length)
  writeUint16(end, entries.length)
  writeUint32(end, centralSize)
  writeUint32(end, centralOffset)
  writeUint16(end, 0)

  return new Blob([...localParts, ...centralParts, new Uint8Array(end)], { type: 'application/zip' })
}

export async function downloadCheatSheet(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
) {
  const devices = collectDevices(actions, connectedGamepads)
  const pages = paginateDevices(devices)
  const rendered: ZipEntry[] = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const canvas = drawSheet(page, i + 1, pages.length)
    const blob = await canvasToBlob(canvas)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const deviceName = safeFilenamePart(page.device.name) || `Joystick_${page.device.index}`
    const pageSuffix = page.totalPages > 1 ? `_Page_${page.pageNumber}` : ''

    rendered.push({
      name: `${deviceName}_Cheat_Sheet${pageSuffix}.png`,
      data: bytes
    })
  }

  if (rendered.length === 1) {
    downloadBlob(new Blob([rendered[0].data], { type: 'image/png' }), rendered[0].name)
    return
  }

  const firstDevice = devices.length > 0 ? safeFilenamePart(devices[0].name) : 'HOTAS'
  const zipFilename = `${firstDevice || 'HOTAS'}_Cheat_Sheets.zip`
  downloadBlob(createZip(rendered), zipFilename)
}
