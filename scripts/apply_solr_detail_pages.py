from pathlib import Path
import re

path = Path('src/solrPdfCheatsheet.ts')
src = path.read_text(encoding='utf-8')

src = src.replace(
    "import { PDFDocument, StandardFonts } from 'pdf-lib'",
    "import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from 'pdf-lib'",
)

src, removed = re.subn(
    r"\nfunction fieldDisplayText\(labels: string\[\]\): string \{.*?\n\}\n\nfunction fieldFontSize\(text: string\): number \{.*?\n\}\n",
    "\n",
    src,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise SystemExit('Could not remove temporary multiline field helpers')

old_fill = """    const field = form.getTextField(sourceName)\n    const text = fieldDisplayText(labels)\n    if (text.includes('\\n')) field.enableMultiline()\n    field.setFontSize(fieldFontSize(text))\n    field.setText(text)"""
new_fill = """    form.getTextField(sourceName).setText(combineLabels(labels))"""
if old_fill not in src:
    raise SystemExit('Could not find adaptive field fill block')
src = src.replace(old_fill, new_fill, 1)

helpers = r'''
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
'''

marker = "\nfunction downloadBytes(bytes: Uint8Array, filename: string) {"
if marker not in src:
    raise SystemExit('Could not find downloadBytes insertion point')
src = src.replace(marker, helpers + marker, 1)

old = """  form.updateFieldAppearances(font)\n\n  const output = await pdf.save()"""
new = """  form.updateFieldAppearances(font)\n  addDetailedBindingPages(pdf, fieldValues, font)\n\n  const output = await pdf.save()"""
if old not in src:
    raise SystemExit('Could not find detail-page call insertion point')
src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
