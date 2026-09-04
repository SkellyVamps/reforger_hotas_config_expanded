from pathlib import Path
import re

src_path = Path('src/solrPdfCheatsheet.ts')
src = src_path.read_text(encoding='utf-8')

new_combine = r'''interface CompactDirectionalGroup {
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

function fieldDisplayText(labels: string[]): string {
  const groups = compactDirectionalGroups(labels)
  if (groups.length === 0) return ''

  // When multiple systems share a control, keep each directional family on its
  // own line rather than shrinking one very long line. The slash is retained so
  // the flattened text still reads naturally, e.g.:
  // Helicopter Cyclic Forward / Back /
  // Turret Aim Up / Down
  if (groups.length > 1) return groups.map(compactGroupText).join(' /\n')

  const group = groups[0]
  const text = compactGroupText(group)
  if (text.length <= 24 || group.plain !== null) return text

  // A single long directional family gets two lines without repeating its base.
  return `${group.base}\n${group.directions.join(' / ')}`
}

function fieldFontSize(text: string): number {
  const lines = text.split('\n')
  const longest = Math.max(...lines.map(line => line.length), 0)
  let size = longest <= 18 ? 8 : longest <= 24 ? 7 : longest <= 32 ? 6 : longest <= 40 ? 5.25 : 4.5
  if (lines.length > 1) size = Math.max(4.5, size - 0.5)
  return size
}
'''

src, count = re.subn(
    r"function combineLabels\(labels: string\[\]\): string \{.*?\n\}\n\nfunction collectFieldValues",
    new_combine + "\nfunction collectFieldValues",
    src,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Could not replace combineLabels block')

src = src.replace(
    "const response = await fetch(`${import.meta.env.BASE_URL}solr2-template.pdf`)",
    "const response = await fetch(`${import.meta.env.BASE_URL}Arma%20Reforger%20Sol-R.pdf`)",
)

old_fill = """    form.getTextField(sourceName).setText(combineLabels(labels))"""
new_fill = """    const field = form.getTextField(sourceName)\n    const text = fieldDisplayText(labels)\n    if (text.includes('\\n')) field.enableMultiline()\n    field.setFontSize(fieldFontSize(text))\n    field.setText(text)"""
if old_fill not in src:
    raise SystemExit('Could not find field fill statement')
src = src.replace(old_fill, new_fill, 1)

src = src.replace(
    "downloadBytes(output, 'Arma_Reforger_Thrustmaster_Sol-R2_Cheat_Sheet.pdf')",
    "downloadBytes(output, 'Arma Reforger Sol-R.pdf')",
)

src_path.write_text(src, encoding='utf-8')

workflow_path = Path('.github/workflows/deploy-pages.yml')
workflow = workflow_path.read_text(encoding='utf-8')
workflow = workflow.replace('- name: Download Sol-R2 PDF template', '- name: Prepare Arma Reforger Sol-R PDF template')
workflow = workflow.replace('-o public/solr2-template.pdf', '-o "public/Arma Reforger Sol-R.pdf"')
workflow = workflow.replace('head -c 4 public/solr2-template.pdf', 'head -c 4 "public/Arma Reforger Sol-R.pdf"')
workflow_path.write_text(workflow, encoding='utf-8')
