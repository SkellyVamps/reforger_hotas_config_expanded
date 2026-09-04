import { PDFDocument, StandardFonts } from 'pdf-lib'
import type { Action, ConnectedGamepad } from './types'

const TEMPLATE_PART_COUNT = 12
const TEMPLATE_PART_DIR = 'solr2-template'

type SolRSide = 'L' | 'R'

interface FieldValues {
  [fieldName: string]: string[]
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

function getSolRSideByJoystick(
  connectedGamepads: Record<number, ConnectedGamepad>
): Map<number, SolRSide> {
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

  // Fallback for browsers/drivers that omit L/R from the product name.
  // Prefer the first open side for the first unresolved device.
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

function commonPrefixWords(labels: string[]): string[] {
  if (labels.length === 0) return []
  const split = labels.map(label => label.split(/\s+/))
  const minLength = Math.min(...split.map(words => words.length))
  const prefix: string[] = []

  for (let i = 0; i < minLength; i++) {
    const word = split[0][i]
    if (split.every(words => words[i] === word)) prefix.push(word)
    else break
  }
  return prefix
}

function combineLabels(labels: string[]): string {
  const unique = [...new Set(labels.filter(Boolean))]
  if (unique.length <= 1) return unique[0] ?? ''

  const directionalWords = new Set([
    'Left', 'Right', 'Up', 'Down', 'Forward', 'Back',
    'Increase', 'Decrease'
  ])

  const parsed = unique.map(label => {
    const words = label.split(/\s+/)
    const last = words[words.length - 1]
    return {
      label,
      direction: directionalWords.has(last) ? last : null,
      base: directionalWords.has(last) ? words.slice(0, -1).join(' ') : label
    }
  })

  if (parsed.every(item => item.direction && item.base === parsed[0].base)) {
    return `${parsed[0].base} ${parsed.map(item => item.direction).join('/')}`
  }

  const prefix = commonPrefixWords(unique)
  if (prefix.length > 0 && prefix.length < Math.min(...unique.map(label => label.split(/\s+/).length))) {
    const prefixText = prefix.join(' ')
    const suffixes = unique.map(label => label.split(/\s+/).slice(prefix.length).join(' '))
    return `${prefixText} ${suffixes.join('/')}`
  }

  return unique.join(' / ')
}

function collectFieldValues(
  actions: Action[],
  connectedGamepads: Record<number, ConnectedGamepad>
): FieldValues {
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

      // The PDF field names were manually mapped to the configurator output,
      // so button indices are used exactly as-is. Axis +/- directions merge into
      // one axis field, e.g. axis0- and axis0+ both populate "Sol-R [R] axis0".
      const fieldName = `Sol-R [${side}] ${type}${controlIndex}`
      if (!values[fieldName]) values[fieldName] = []
      if (!values[fieldName].includes(label)) values[fieldName].push(label)
    }
  }

  return values
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support the Sol-R PDF template decompressor.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function loadTemplateBytes(): Promise<Uint8Array> {
  const parts = await Promise.all(
    Array.from({ length: TEMPLATE_PART_COUNT }, async (_, index) => {
      const filename = `part-${String(index).padStart(2, '0')}.b64`
      const response = await fetch(`${import.meta.env.BASE_URL}${TEMPLATE_PART_DIR}/${filename}`)
      if (!response.ok) throw new Error(`Unable to load Sol-R PDF template part ${index + 1}.`)
      return response.text()
    })
  )

  const compressed = base64ToBytes(parts.join('').replace(/\s+/g, ''))
  return decompressGzip(compressed)
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
  const templateBytes = await loadTemplateBytes()
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  const fieldValues = collectFieldValues(actions, connectedGamepads)
  const fieldsByName = new Map(form.getFields().map(field => [field.getName(), field]))

  for (const [fieldName, labels] of Object.entries(fieldValues)) {
    const field = fieldsByName.get(fieldName)
    if (!field || field.constructor.name !== 'PDFTextField') continue

    form.getTextField(fieldName).setText(combineLabels(labels))
  }

  // Keep the original PDF layout/form structure and update only text-field
  // values/appearances so the supplied template remains the actual cheat sheet.
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  form.updateFieldAppearances(font)

  const output = await pdf.save()
  downloadBytes(output, 'Arma_Reforger_Thrustmaster_Sol-R2_Cheat_Sheet.pdf')
}
