export type InputSource = 'webhid' | 'gamepad'

export interface JoystickSnapshot {
  index: number
  id: string
  buttons: boolean[]
  axes: number[]
  source: InputSource
}

export interface WebHIDDeviceInfo {
  key: string
  name: string
  vendorId: number
  productId: number
  joystickIndex: number
  buttonCount: number
  axisCount: number
  opened: boolean
}

type HIDReportItemLike = {
  isArray?: boolean
  isConstant?: boolean
  isRange?: boolean
  hasNull?: boolean
  usages?: number[]
  usageMinimum?: number
  usageMaximum?: number
  reportSize: number
  reportCount: number
  logicalMinimum: number
  logicalMaximum: number
}

type HIDReportLike = {
  reportId: number
  items: HIDReportItemLike[]
}

type HIDCollectionLike = {
  inputReports?: HIDReportLike[]
  children?: HIDCollectionLike[]
}

type HIDDeviceLike = EventTarget & {
  opened: boolean
  vendorId: number
  productId: number
  productName: string
  collections: HIDCollectionLike[]
  open(): Promise<void>
  close(): Promise<void>
}

type HIDInputReportEventLike = Event & {
  data: DataView
  reportId: number
  device: HIDDeviceLike
}

type HIDLike = EventTarget & {
  requestDevice(options: { filters: unknown[] }): Promise<HIDDeviceLike[]>
  getDevices(): Promise<HIDDeviceLike[]>
}

interface ParsedField {
  kind: 'button' | 'axis' | 'ignore'
  bitOffset: number
  reportSize: number
  reportCount: number
  usages: number[]
  logicalMinimum: number
  logicalMaximum: number
  isArray: boolean
  hasNull: boolean
  axisIndices: number[]
  buttonIndices: number[]
}

interface ParsedReport {
  reportId: number
  fields: ParsedField[]
  totalBits: number
}

interface ManagedHIDDevice {
  key: string
  device: HIDDeviceLike
  joystickIndex: number
  buttons: boolean[]
  axes: number[]
  reports: Map<number, ParsedReport>
  buttonCount: number
  axisCount: number
  inputListener: EventListener
}

const managedDevices = new Map<string, ManagedHIDDevice>()
let changeListener: (() => void) | null = null
let initialized = false
let deviceCounter = 0

const GENERIC_DESKTOP_PAGE = 0x01
const BUTTON_PAGE = 0x09
const MAX_REFORGER_JOYSTICKS = 4

const AXIS_USAGES = new Set([0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39])

function getHID(): HIDLike | null {
  const nav = navigator as Navigator & { hid?: HIDLike }
  return nav.hid ?? null
}

export function isWebHIDSupported(): boolean {
  return getHID() !== null && window.isSecureContext
}

function usagePage(usage: number): number {
  return (usage >>> 16) & 0xffff
}

function usageId(usage: number): number {
  return usage & 0xffff
}

function expandUsages(item: HIDReportItemLike): number[] {
  if (item.isRange && item.usageMinimum !== undefined && item.usageMaximum !== undefined) {
    const usages: number[] = []
    for (let usage = item.usageMinimum; usage <= item.usageMaximum; usage++) {
      usages.push(usage >>> 0)
      if (usages.length >= item.reportCount) break
    }
    return usages
  }
  return [...(item.usages ?? [])]
}

function readBits(data: DataView, bitOffset: number, bitLength: number, signed: boolean): number {
  if (bitLength <= 0 || bitLength > 32) return 0

  let value = 0
  for (let bit = 0; bit < bitLength; bit++) {
    const absoluteBit = bitOffset + bit
    const byteIndex = Math.floor(absoluteBit / 8)
    if (byteIndex >= data.byteLength) break
    const bitIndex = absoluteBit % 8
    const bitValue = (data.getUint8(byteIndex) >> bitIndex) & 1
    value += bitValue * (2 ** bit)
  }

  if (signed && bitLength < 32) {
    const signBit = 2 ** (bitLength - 1)
    const fullRange = 2 ** bitLength
    if (value >= signBit) value -= fullRange
  } else if (signed && bitLength === 32 && value >= 0x80000000) {
    value -= 0x100000000
  }

  return value
}

function normalizeAxis(value: number, minimum: number, maximum: number, hasNull: boolean): number {
  if (hasNull && (value < minimum || value > maximum)) return 0
  if (maximum <= minimum) return 0

  const clamped = Math.min(maximum, Math.max(minimum, value))
  const normalized = ((clamped - minimum) / (maximum - minimum)) * 2 - 1
  return Math.min(1, Math.max(-1, normalized))
}

function getTopLevelReports(device: HIDDeviceLike): HIDReportLike[] {
  const reportsById = new Map<number, HIDReportLike>()

  function visitCollection(collection: HIDCollectionLike) {
    for (const report of collection.inputReports ?? []) {
      const current = reportsById.get(report.reportId)
      if (current) {
        current.items.push(...report.items)
      } else {
        reportsById.set(report.reportId, {
          reportId: report.reportId,
          items: [...report.items]
        })
      }
    }

    for (const child of collection.children ?? []) {
      visitCollection(child)
    }
  }

  for (const collection of device.collections ?? []) {
    visitCollection(collection)
  }

  return [...reportsById.values()]
}

function parseReports(device: HIDDeviceLike): {
  reports: Map<number, ParsedReport>
  buttonCount: number
  axisCount: number
} {
  const reports = new Map<number, ParsedReport>()
  let nextButtonIndex = 0
  let nextAxisIndex = 0

  for (const report of getTopLevelReports(device)) {
    let bitOffset = 0
    const fields: ParsedField[] = []

    for (const item of report.items) {
      const usages = expandUsages(item)
      let kind: ParsedField['kind'] = 'ignore'
      const axisIndices: number[] = []
      const buttonIndices: number[] = []

      const firstUsage = usages[0]
      const firstPage = firstUsage === undefined ? -1 : usagePage(firstUsage)
      const firstId = firstUsage === undefined ? -1 : usageId(firstUsage)

      if (!item.isConstant && firstPage === BUTTON_PAGE) {
        kind = 'button'
        for (let i = 0; i < item.reportCount; i++) {
          buttonIndices.push(nextButtonIndex++)
        }
      } else if (
        !item.isConstant &&
        firstPage === GENERIC_DESKTOP_PAGE &&
        AXIS_USAGES.has(firstId)
      ) {
        kind = 'axis'
        for (let i = 0; i < item.reportCount; i++) {
          const usage = usages[i] ?? firstUsage
          if (usage !== undefined && usagePage(usage) === GENERIC_DESKTOP_PAGE && AXIS_USAGES.has(usageId(usage))) {
            axisIndices.push(nextAxisIndex++)
          } else {
            axisIndices.push(-1)
          }
        }
      }

      fields.push({
        kind,
        bitOffset,
        reportSize: item.reportSize,
        reportCount: item.reportCount,
        usages,
        logicalMinimum: item.logicalMinimum,
        logicalMaximum: item.logicalMaximum,
        isArray: Boolean(item.isArray),
        hasNull: Boolean(item.hasNull),
        axisIndices,
        buttonIndices
      })

      bitOffset += item.reportSize * item.reportCount
    }

    reports.set(report.reportId, {
      reportId: report.reportId,
      fields,
      totalBits: bitOffset
    })
  }

  return {
    reports,
    buttonCount: nextButtonIndex,
    axisCount: nextAxisIndex
  }
}

function mappingStorageKey(device: HIDDeviceLike): string {
  return `webhid-index:${device.vendorId.toString(16)}:${device.productId.toString(16)}:${device.productName}`
}

function normalizeDeviceName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchingGamepadIndex(device: HIDDeviceLike): number | null {
  const deviceName = normalizeDeviceName(device.productName || '')
  const vendorHex = device.vendorId.toString(16).padStart(4, '0').toLowerCase()
  const productHex = device.productId.toString(16).padStart(4, '0').toLowerCase()

  for (const gamepad of navigator.getGamepads()) {
    if (!gamepad || gamepad.index >= MAX_REFORGER_JOYSTICKS) continue

    const id = gamepad.id.toLowerCase()
    const normalizedId = normalizeDeviceName(gamepad.id)
    const nameMatches = deviceName.length >= 4 && (normalizedId.includes(deviceName) || deviceName.includes(normalizedId))
    const vidPidMatches = (
      (id.includes(`vendor: ${vendorHex}`) && id.includes(`product: ${productHex}`)) ||
      (id.includes(`vid_${vendorHex}`) && id.includes(`pid_${productHex}`)) ||
      (id.includes(vendorHex) && id.includes(productHex))
    )

    if (nameMatches || vidPidMatches) return gamepad.index
  }

  return null
}

function firstFreeJoystickIndex(): number {
  const used = new Set([...managedDevices.values()].map(device => device.joystickIndex))
  for (let index = 0; index < MAX_REFORGER_JOYSTICKS; index++) {
    if (!used.has(index)) return index
  }
  return 0
}

function loadJoystickIndex(device: HIDDeviceLike): number {
  const matchedIndex = matchingGamepadIndex(device)
  if (matchedIndex !== null) {
    saveJoystickIndex(device, matchedIndex)
    return matchedIndex
  }

  try {
    const saved = localStorage.getItem(mappingStorageKey(device))
    if (saved !== null) {
      const parsed = Number.parseInt(saved, 10)
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < MAX_REFORGER_JOYSTICKS) return parsed
    }
  } catch {
    // localStorage may be unavailable in private/restricted contexts.
  }
  return firstFreeJoystickIndex()
}

function saveJoystickIndex(device: HIDDeviceLike, index: number) {
  try {
    localStorage.setItem(mappingStorageKey(device), String(index))
  } catch {
    // Mapping will still work for the current session.
  }
}

function makeDeviceKey(device: HIDDeviceLike): string {
  const base = `${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}:${device.productName}`
  let key = base
  while (managedDevices.has(key)) {
    deviceCounter += 1
    key = `${base}:${deviceCounter}`
  }
  return key
}

function applyInputReport(managed: ManagedHIDDevice, event: HIDInputReportEventLike) {
  const report = managed.reports.get(event.reportId)
  if (!report) return

  for (const field of report.fields) {
    if (field.kind === 'ignore') continue

    if (field.kind === 'button') {
      if (field.isArray) {
        for (const buttonIndex of field.buttonIndices) {
          managed.buttons[buttonIndex] = false
        }

        for (let i = 0; i < field.reportCount; i++) {
          const raw = readBits(
            event.data,
            field.bitOffset + (i * field.reportSize),
            field.reportSize,
            field.logicalMinimum < 0
          )
          if (raw > 0) {
            const relativeIndex = raw - Math.max(1, field.logicalMinimum)
            const buttonIndex = field.buttonIndices[relativeIndex]
            if (buttonIndex !== undefined) {
              managed.buttons[buttonIndex] = true
            }
          }
        }
      } else {
        for (let i = 0; i < field.reportCount; i++) {
          const raw = readBits(
            event.data,
            field.bitOffset + (i * field.reportSize),
            field.reportSize,
            false
          )
          const buttonIndex = field.buttonIndices[i]
          if (buttonIndex !== undefined) {
            managed.buttons[buttonIndex] = raw !== 0
          }
        }
      }
    } else if (field.kind === 'axis') {
      for (let i = 0; i < field.reportCount; i++) {
        const axisIndex = field.axisIndices[i]
        if (axisIndex === undefined || axisIndex < 0) continue

        const raw = readBits(
          event.data,
          field.bitOffset + (i * field.reportSize),
          field.reportSize,
          field.logicalMinimum < 0
        )
        managed.axes[axisIndex] = normalizeAxis(
          raw,
          field.logicalMinimum,
          field.logicalMaximum,
          field.hasNull
        )
      }
    }
  }

  changeListener?.()
}

async function registerDevice(device: HIDDeviceLike): Promise<void> {
  for (const existing of managedDevices.values()) {
    if (existing.device === device) return
  }

  if (!device.opened) await device.open()

  const parsed = parseReports(device)
  const key = makeDeviceKey(device)
  const managed: ManagedHIDDevice = {
    key,
    device,
    joystickIndex: loadJoystickIndex(device),
    buttons: Array.from({ length: parsed.buttonCount }, () => false),
    axes: Array.from({ length: parsed.axisCount }, () => 0),
    reports: parsed.reports,
    buttonCount: parsed.buttonCount,
    axisCount: parsed.axisCount,
    inputListener: (() => undefined) as EventListener
  }

  managed.inputListener = ((event: Event) => {
    applyInputReport(managed, event as HIDInputReportEventLike)
  }) as EventListener

  device.addEventListener('inputreport', managed.inputListener)
  managedDevices.set(key, managed)
  changeListener?.()
}

async function unregisterDevice(device: HIDDeviceLike): Promise<void> {
  for (const [key, managed] of managedDevices) {
    if (managed.device !== device) continue
    managed.device.removeEventListener('inputreport', managed.inputListener)
    managedDevices.delete(key)
    changeListener?.()
    break
  }
}

export async function initializeWebHID(onChange?: () => void): Promise<void> {
  changeListener = onChange ?? null
  if (initialized) return
  initialized = true

  const hid = getHID()
  if (!hid || !window.isSecureContext) return

  hid.addEventListener('connect', ((event: Event) => {
    const device = (event as Event & { device?: HIDDeviceLike }).device
    if (device) void registerDevice(device)
  }) as EventListener)

  hid.addEventListener('disconnect', ((event: Event) => {
    const device = (event as Event & { device?: HIDDeviceLike }).device
    if (device) void unregisterDevice(device)
  }) as EventListener)

  const grantedDevices = await hid.getDevices()
  for (const device of grantedDevices) {
    try {
      await registerDevice(device)
    } catch (error) {
      console.warn('Unable to open previously granted WebHID device:', error)
    }
  }
}

export async function requestWebHIDDevices(): Promise<WebHIDDeviceInfo[]> {
  const hid = getHID()
  if (!hid || !window.isSecureContext) {
    throw new Error('WebHID requires a supported Chromium browser and HTTPS.')
  }

  const devices = await hid.requestDevice({ filters: [] })
  for (const device of devices) {
    await registerDevice(device)
  }

  return getWebHIDDevices()
}

export function getWebHIDDevices(): WebHIDDeviceInfo[] {
  return [...managedDevices.values()]
    .map(managed => ({
      key: managed.key,
      name: managed.device.productName || 'HID Joystick',
      vendorId: managed.device.vendorId,
      productId: managed.device.productId,
      joystickIndex: managed.joystickIndex,
      buttonCount: managed.buttonCount,
      axisCount: managed.axisCount,
      opened: managed.device.opened
    }))
    .sort((a, b) => a.joystickIndex - b.joystickIndex)
}

export function getWebHIDSnapshots(): JoystickSnapshot[] {
  return [...managedDevices.values()].map(managed => ({
    index: managed.joystickIndex,
    id: `${managed.device.productName || 'HID Joystick'} (WebHID)`,
    buttons: [...managed.buttons],
    axes: [...managed.axes],
    source: 'webhid'
  }))
}

export function setWebHIDJoystickIndex(key: string, joystickIndex: number): void {
  const managed = managedDevices.get(key)
  if (!managed) return

  const clampedIndex = Math.min(MAX_REFORGER_JOYSTICKS - 1, Math.max(0, Math.trunc(joystickIndex)))
  managed.joystickIndex = clampedIndex
  saveJoystickIndex(managed.device, clampedIndex)
  changeListener?.()
}

export async function closeWebHIDDevices(): Promise<void> {
  for (const managed of managedDevices.values()) {
    managed.device.removeEventListener('inputreport', managed.inputListener)
    if (managed.device.opened) {
      try {
        await managed.device.close()
      } catch {
        // Ignore disconnect races.
      }
    }
  }
  managedDevices.clear()
}
