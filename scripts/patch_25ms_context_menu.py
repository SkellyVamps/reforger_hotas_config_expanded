from pathlib import Path

# Applies the HOTAS-specific weapon timing and vanilla-compatible context-menu structure.
path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

repls = [
    (
        "  { name: 'TurretNextWeapon', filterPreset: 'hold', hint: 'Cycle turret weapons (250 ms hold-once to prevent skipped weapons)', hardware: 'hat', importance: 'important' },",
        "  { name: 'TurretNextWeapon', filterPreset: 'hold', hint: 'Cycle turret weapons (25 ms hold-once)', hardware: 'hat', importance: 'important' },"
    ),
    (
        "  { name: 'SelectActionNext', confName: 'SelectAction', filterPreset: 'next', hint: 'Select the next available context action', hardware: 'button', importance: 'optional' },",
        "  { name: 'SelectActionNext', confName: 'SelectAction', filterPreset: 'next', multiplier: -1, hint: 'Select the next available context action', hardware: 'button', importance: 'optional' },"
    ),
    (
        "    config += `  Action ${emittedName} {\\n`\n    config += `   InputSource InputSourceSum \"${inputSourceGUID}\" {\\n`",
        "    config += `  Action ${emittedName} {\\n`\n    if (emittedName === 'SelectAction' || emittedName === 'HelicopterSightZeroing') {\n      config += `   Type AnalogRelative\\n`\n    }\n    config += `   InputSource InputSourceSum \"${inputSourceGUID}\" {\\n`"
    ),
    (
        "          config += `      Filter InputFilterSingleClick \"${filterGUID}\" {\\n`\n          config += `      }\\n`",
        "          config += `      Filter InputFilterSingleClick \"${filterGUID}\" {\\n`\n          config += `       HoldDuration 25\\n`\n          config += `      }\\n`"
    ),
    (
        "          config += `       HoldDuration 250\\n`",
        "          config += `       HoldDuration 25\\n`"
    ),
]

for old, new in repls:
    if old not in src:
        raise SystemExit(f'Expected text not found:\n{old}')
    src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
