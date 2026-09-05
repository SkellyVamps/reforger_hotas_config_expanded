from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

old = "  { name: 'TurretNextWeapon', filterPreset: 'click', hint: 'Cycle turret weapons (use same button as all weapon switch actions)', hardware: 'hat', importance: 'important' },"
new = "  { name: 'TurretNextWeapon', filterPreset: 'hold', hint: 'Cycle turret weapons (250 ms hold-once to prevent skipped weapons)', hardware: 'hat', importance: 'important' },"
if old not in src:
    raise SystemExit('Could not find TurretNextWeapon action definition')
src = src.replace(old, new, 1)

old = """        if (action.confName === 'HelicopterSightZeroing' || action.confName === 'SelectAction') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterRepeat \"${filterGUID}\" {\\n`
          if (action.multiplier !== undefined) {
            config += `       Multiplier ${action.multiplier}\\n`
          }
          config += `      }\\n`
        } else if (action.multiplier !== undefined) {"""
new = """        if (action.name === 'CharacterNextWeapon') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterSingleClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name === 'TurretNextWeapon') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterHoldOnce \"${filterGUID}\" {\\n`
          config += `       HoldDuration 250\\n`
          config += `      }\\n`
        } else if (action.confName === 'HelicopterSightZeroing' || action.confName === 'SelectAction') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterRepeat \"${filterGUID}\" {\\n`
          if (action.multiplier !== undefined) {
            config += `       Multiplier ${action.multiplier}\\n`
          }
          config += `      }\\n`
        } else if (action.multiplier !== undefined) {"""
if old not in src:
    raise SystemExit('Could not find generateConfig filter chain')
src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
