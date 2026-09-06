from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

wcs_line = "  { name: 'TurretWeaponNextRippleQuantity', filterPreset: 'click', hint: 'Cycle weapon ripple quantity', hardware: 'button', importance: 'optional' },\n"
if wcs_line not in src:
    raise SystemExit('Ripple quantity action not found in WCS_ACTIONS')
src = src.replace(wcs_line, '', 1)

anchor = "  { name: 'TurretNextFireMode', filterPreset: 'click', hint: 'Change turret fire mode', hardware: 'button', importance: 'optional' },\n"
base_line = "  { name: 'TurretWeaponNextRippleQuantity', filterPreset: 'click', hint: 'Cycle missile/rocket weapon ripple quantity', hardware: 'button', importance: 'important' },\n"
if anchor not in src:
    raise SystemExit('TurretNextFireMode anchor not found')
src = src.replace(anchor, anchor + base_line, 1)

path.write_text(src, encoding='utf-8')
