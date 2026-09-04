import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from 'pdf-lib'
import type { Action, ConnectedGamepad } from './types'

type SolRSide = 'L' | 'R'
type Point = readonly [number, number]

interface FieldValues {
  [fieldName: string]: string[]
}

// These are the centers of the renamed text fields in the user-provided Sol-R2
// template. The deployed template has the same page/layout; matching by widget
// position lets the app fill those exact boxes without altering the artwork.
const FIELD_CENTERS: Record<string, Point> = {
  'Game Title':[38.269,601.44],
  'Sol-R [L] axis0':[263.455,201.741],'Sol-R [L] axis1':[275.611,202.208],'Sol-R [L] axis2':[509.611,219.974],'Sol-R [L] axis3':[67.091,299.923],'Sol-R [L] axis4':[54.935,299.689],'Sol-R [L] axis5':[288.001,201.974],
  'Sol-R [L] button0':[360.469,61.013],'Sol-R [L] button1':[372.624,60.779],'Sol-R [L] button2':[316.286,110.805],'Sol-R [L] button3':[328.91,110.805],'Sol-R [L] button4':[412.831,50.494],'Sol-R [L] button5':[425.689,50.494],'Sol-R [L] button6':[437.844,50.26],'Sol-R [L] button7':[450.469,50.26],'Sol-R [L] button8':[496.053,98.416],'Sol-R [L] button9':[508.442,98.416],'Sol-R [L] button10':[521.066,98.416],'Sol-R [L] button11':[360.702,342.234],'Sol-R [L] button12':[372.858,342.234],'Sol-R [L] button13':[316.52,298.988],'Sol-R [L] button14':[328.676,298.988],'Sol-R [L] button15':[422.884,349.014],'Sol-R [L] button16':[410.494,349.014],'Sol-R [L] button17':[447.196,349.014],'Sol-R [L] button18':[435.273,349.014],'Sol-R [L] button19':[485.299,341.066],'Sol-R [L] button20':[497.923,340.832],'Sol-R [L] button21':[510.312,340.831],'Sol-R [L] button22':[522.702,340.831],'Sol-R [L] button23':[128.338,201.741],'Sol-R [L] button24':[140.728,201.741],'Sol-R [L] button25':[90.701,201.273],'Sol-R [L] button26':[78.546,200.805],'Sol-R [L] button27':[245.221,89.766],'Sol-R [L] button28':[79.714,299.923],'Sol-R [L] button29':[154.987,92.338],'Sol-R [L] button30':[130.208,67.792],'Sol-R [L] button31':[117.585,92.338],'Sol-R [L] button32':[130.208,124.831],'Sol-R [L] button33':[142.831,92.572],'Sol-R [L] button34':[201.273,91.169],'Sol-R [L] button35':[270.234,312.546],'Sol-R [L] button36':[245.222,312.78],'Sol-R [L] button37':[257.845,313.014],'Sol-R [L] button38':[201.273,312.546],'Sol-R [L] button39':[155.455,312.546],'Sol-R [L] button40':[130.208,288.234],'Sol-R [L] button41':[117.819,313.014],'Sol-R [L] button42':[130.208,345.508],'Sol-R [L] button43':[142.831,312.546],
  'Sol-R [R] axis0':[335.053,594.469],'Sol-R [R] axis1':[347.209,594.936],'Sol-R [R] axis2':[581.208,612.702],'Sol-R [R] axis3':[138.688,692.65],'Sol-R [R] axis4':[126.532,692.417],'Sol-R [R] axis5':[359.598,594.702],
  'Sol-R [R] button0':[432.065,453.741],'Sol-R [R] button1':[444.221,453.507],'Sol-R [R] button2':[387.884,503.533],'Sol-R [R] button3':[400.507,503.533],'Sol-R [R] button4':[484.43,443.221],'Sol-R [R] button5':[497.286,443.221],'Sol-R [R] button6':[509.442,442.988],'Sol-R [R] button7':[522.066,442.988],'Sol-R [R] button8':[567.65,491.143],'Sol-R [R] button9':[580.04,491.144],'Sol-R [R] button10':[592.663,491.144],'Sol-R [R] button11':[432.299,734.962],'Sol-R [R] button12':[444.455,734.962],'Sol-R [R] button13':[388.117,691.715],'Sol-R [R] button14':[400.273,691.715],'Sol-R [R] button15':[494.481,741.741],'Sol-R [R] button16':[482.092,741.741],'Sol-R [R] button17':[518.793,741.741],'Sol-R [R] button18':[506.871,741.741],'Sol-R [R] button19':[556.897,733.793],'Sol-R [R] button20':[569.52,733.56],'Sol-R [R] button21':[581.91,733.559],'Sol-R [R] button22':[594.299,733.559],'Sol-R [R] button23':[199.936,594.469],'Sol-R [R] button24':[212.325,594.469],'Sol-R [R] button25':[162.299,594.001],'Sol-R [R] button26':[150.144,593.534],'Sol-R [R] button27':[316.819,482.495],'Sol-R [R] button28':[151.312,692.65],'Sol-R [R] button29':[226.585,485.066],'Sol-R [R] button30':[201.805,460.521],'Sol-R [R] button31':[189.182,485.066],'Sol-R [R] button32':[201.806,517.559],'Sol-R [R] button33':[214.429,485.299],'Sol-R [R] button34':[272.87,483.897],'Sol-R [R] button35':[341.831,705.274],'Sol-R [R] button36':[316.818,705.508],'Sol-R [R] button37':[329.442,705.741],'Sol-R [R] button38':[272.87,705.274],'Sol-R [R] button39':[227.052,705.274],'Sol-R [R] button40':[201.806,680.962],'Sol-R [R] button41':[189.415,705.741],'Sol-R [R] button42':[201.805,738.235],'Sol-R [R] button43':[214.429,705.274]
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

function isSolRDeviceName(name: string): boolean {
  return /sol\s*-?\s*r/i.test(name)
}

function detectSide(name: string): SolRSide | null {
  if (/\[\s*r\s*\]/i.test(name) || /\bright\b/i.test(name)) return 'R'
  if (/\[\s*l\s*\]/i.test(name) || /\bleft\b/i.test(name)) return 'L'
  return null
}

function getSolRSideByJoystick(connectedGamepads: Record<number, ConnectedGamepad>): Map<number, SolRSide> {
  const result = new Map<number, SolRSide>()
  const unresolved: number[] = []

  Object.values(connectedGamepads)
    .filter(device => isSolRDeviceName(device.id))
    .sort((a, b) => a.index - b.index)
    .forEach(device => {
      const side = detectSide(device.id)
      if (side) result.set(device.index, side)
      else unresolved.push(device.index)
    })

  const used = new Set(result.values())
  for (const index of unresolved) {
    const fallback: SolRSide = !used.has('R') ? 'R' : 'L'
    result.set(index, fallback)
    used.add(fallback)
  }

  return result
}

export function hasSolRDevices(connectedGamepads: Record<number, ConnectedGamepad>): boolean {
  return Object.values(connectedGamepads).some(device => isSolRDeviceName(device.id))
}

interface CompactDirectionalGroup {
  base: string
  directions: string[]
  plain: string | null
}

function compactDirectionalGroups(labels: string[]): CompactDirectionalGroup[] {
  const unique = [...new Set(labels.filter(Boolean))]
  const directionalWords = new Set(['Left','Right','Up','Down','Forward','Back','Increase','Decrease'])
  const groups: CompactDirectionalGroup[] = []

  for (const label of unique) {
    const words = label.split(/\s+/)
    const last = words[words.length - 1]
    const isDirectional = directionalWords.has(last)
    const base = isDirectional ? words.slice(0, -1).join(' ') : label

    if (!isDirectional) {
      groups.push({ base: label, directions: [], plain: label })
      continue
    }

    const existing = groups.find(group => group.plain === null && group.base === base)
    if (existing) {
      if (!existing.directions.includes(last)) existing.directions.push(last)
    } else {
      groups.push({ base, directions: [last], plain: null })
    }
  }

  return groups
}

function compactGroupText(group: CompactDirectionalGroup): string {
  if (group.plain !== null) return group.plain
  return `${group.base} ${group.directions.join(' / ')}`
}

function combineLabels(labels: string[]): string {
  return compactDirectionalGroups(labels).map(compactGroupText).join(' / ')
}


function collectFieldValues(actions: Action[], connectedGamepads: Record<number, ConnectedGamepad>): FieldValues {
  const sideByJoystick = getSolRSideByJoystick(connectedGamepads)
  const values: FieldValues = {}

  for (const action of actions) {
    const label = readableActionName(action.name)
    for (const rawBinding of action.bindings) {
      const match = rawBinding.match(/^joystick(\d+):(button|axis)(\d+)([+-])?$/)
      if (!match) continue

      const joystickIndex = Number.parseInt(match[1], 10)
      const side = sideByJoystick.get(joystickIndex)
      if (!side) continue

      const type = match[2]
      const controlIndex = Number.parseInt(match[3], 10)
      // Exact configurator numbering: button0 -> button0. Axis direction is
      // intentionally omitted so axis0+ and axis0- share one PDF field.
      const fieldName = `Sol-R [${side}] ${type}${controlIndex}`
      if (!values[fieldName]) values[fieldName] = []
      if (!values[fieldName].includes(label)) values[fieldName].push(label)
    }
  }

  return values
}

async function loadTemplateBytes(): Promise<Uint8Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}Arma%20Reforger%20Sol-R.pdf`)
  if (!response.ok) throw new Error('Unable to load the Sol-R2 PDF template.')
  return new Uint8Array(await response.arrayBuffer())
}

interface WidgetLike {
  getRectangle(): { x: number; y: number; width: number; height: number }
}

interface FieldWithWidgets {
  getName(): string
  acroField: { getWidgets(): WidgetLike[] }
}

function fieldCenter(field: FieldWithWidgets): Point | null {
  const widget = field.acroField.getWidgets()[0]
  if (!widget) return null
  const rect = widget.getRectangle()
  return [rect.x + rect.width / 2, rect.y + rect.height / 2]
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function resolveTemplateFieldNames(pdf: PDFDocument): Map<string, string> {
  const form = pdf.getForm()
  const sourceFields = form.getFields()
    .map(field => {
      const candidate = field as unknown as FieldWithWidgets
      const center = fieldCenter(candidate)
      return center ? { name: field.getName(), center } : null
    })
    .filter((value): value is { name: string; center: Point } => value !== null)

  const resolved = new Map<string, string>()
  for (const [semanticName, targetCenter] of Object.entries(FIELD_CENTERS)) {
    let nearest: { name: string; distance: number } | null = null
    for (const source of sourceFields) {
      const d = distance(targetCenter, source.center)
      if (!nearest || d < nearest.distance) nearest = { name: source.name, distance: d }
    }

    // The renamed PDF and deployment template are the same layout. A generous
    // tolerance protects against tiny producer/rounding differences while still
    // preventing an unrelated field from being filled.
    if (nearest && nearest.distance <= 4) resolved.set(semanticName, nearest.name)
  }
  return resolved
}

interface DetailEntry {
  control: string
  label: string
}

function detailControlLabel(control: string): string {
  const match = control.match(/^(button|axis)(\d+)$/)
  if (!match) return control
  return `${match[1] === 'button' ? 'Button' : 'Axis'} ${match[2]}`
}

function detailEntriesForSide(fieldValues: FieldValues, side: SolRSide): DetailEntry[] {
  const prefix = `Sol-R [${side}] `
  return Object.entries(fieldValues)
    .filter(([fieldName]) => fieldName.startsWith(prefix))
    .map(([fieldName, labels]) => ({
      control: fieldName.slice(prefix.length),
      label: combineLabels(labels)
    }))
    .sort((a, b) => {
      const am = a.control.match(/^(button|axis)(\d+)$/)
      const bm = b.control.match(/^(button|axis)(\d+)$/)
      if (!am || !bm) return a.control.localeCompare(b.control)
      const at = am[1] === 'button' ? 0 : 1
      const bt = bm[1] === 'button' ? 0 : 1
      if (at !== bt) return at - bt
      return Number.parseInt(am[2], 10) - Number.parseInt(bm[2], 10)
    })
}

function wrapDetailText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

function drawDetailEntry(
  page: PDFPage,
  font: PDFFont,
  entry: DetailEntry,
  x: number,
  y: number,
  width: number,
  rowHeight: number
) {
  page.drawRectangle({
    x,
    y: y - 4,
    width,
    height: rowHeight - 3,
    borderWidth: 0.5,
    borderColor: rgb(0.72, 0.76, 0.80),
    color: rgb(0.98, 0.985, 0.99)
  })

  page.drawText(detailControlLabel(entry.control), {
    x: x + 7,
    y: y + 8,
    size: 9,
    font,
    color: rgb(0.08, 0.12, 0.18)
  })

  const actionX = x + 67
  const actionWidth = width - 74
  const size = 8.5
  const lines = wrapDetailText(font, entry.label, size, actionWidth).slice(0, 2)
  const startY = lines.length > 1 ? y + 13 : y + 8
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: actionX,
      y: startY - index * 10,
      size,
      font,
      color: rgb(0.02, 0.03, 0.05)
    })
  })
}

function addDetailedBindingPages(pdf: PDFDocument, fieldValues: FieldValues, font: PDFFont) {
  const pageWidth = 612
  const pageHeight = 792
  const margin = 36
  const columnGap = 18
  const columnWidth = (pageWidth - margin * 2 - columnGap) / 2
  const rowHeight = 29
  const rowsPerColumn = 22
  const entriesPerPage = rowsPerColumn * 2

  for (const side of ['R', 'L'] as const) {
    const entries = detailEntriesForSide(fieldValues, side)
    if (entries.length === 0) continue

    for (let offset = 0; offset < entries.length; offset += entriesPerPage) {
      const chunk = entries.slice(offset, offset + entriesPerPage)
      const page = pdf.addPage([pageWidth, pageHeight])
      const sideName = side === 'R' ? 'Right Stick' : 'Left Stick'
      const pageNumber = Math.floor(offset / entriesPerPage) + 1
      const totalPages = Math.ceil(entries.length / entriesPerPage)
      const suffix = totalPages > 1 ? ` (${pageNumber}/${totalPages})` : ''

      page.drawText(`Arma Reforger Sol-R - ${sideName} Bindings${suffix}`, {
        x: margin,
        y: pageHeight - 52,
        size: 20,
        font,
        color: rgb(0.03, 0.08, 0.14)
      })
      page.drawText('Full binding reference for long labels that do not fit cleanly in the physical-layout callouts.', {
        x: margin,
        y: pageHeight - 75,
        size: 9,
        font,
        color: rgb(0.30, 0.34, 0.39)
      })

      chunk.forEach((entry, index) => {
        const column = Math.floor(index / rowsPerColumn)
        const row = index % rowsPerColumn
        const x = margin + column * (columnWidth + columnGap)
        const y = pageHeight - 112 - row * rowHeight
        drawDetailEntry(page, font, entry, x, y, columnWidth, rowHeight)
      })
    }
  }
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadSolRPdfCheatSheet(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
): Promise<void> {
  const pdf = await PDFDocument.load(await loadTemplateBytes())
  const form = pdf.getForm()
  const resolved = resolveTemplateFieldNames(pdf)
  const fieldValues = collectFieldValues(actions, connectedGamepads)

  const gameTitleField = resolved.get('Game Title')
  if (gameTitleField) form.getTextField(gameTitleField).setText('Arma Reforger')

  for (const [semanticName, labels] of Object.entries(fieldValues)) {
    const sourceName = resolved.get(semanticName)
    if (!sourceName) continue
    form.getTextField(sourceName).setText(combineLabels(labels))
  }

  // Do not flatten, rename, reposition, or otherwise alter the template. Only
  // populate the existing text fields and refresh their appearances.
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  form.updateFieldAppearances(font)
  addDetailedBindingPages(pdf, fieldValues, font)

  const output = await pdf.save()
  downloadBytes(output, 'Arma Reforger Sol-R.pdf')
}
