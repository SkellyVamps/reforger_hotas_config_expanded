from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')

old = """  { name: 'PerformAction', filterPreset: 'pressed', hint: 'Context action (interact, reload, etc.)', hardware: 'button', importance: 'important' },
  { name: 'SelectAction', filterPreset: 'previous', hint: 'Cycle through available actions', hardware: 'button', importance: 'optional' },
  { name: 'GetOut', filterPreset: 'click', hint: 'Exit vehicle safely', hardware: 'button', importance: 'important' },
  { name: 'JumpOut', filterPreset: 'click', hint: 'Emergency eject (dangerous!)', hardware: 'button', importance: 'optional' },
  { name: 'HelicopterSightDeploy', filterPreset: 'click', hint: 'Deploy or retract the helicopter sight', hardware: 'button', importance: 'optional' }
]"""
new = """  { name: 'PerformAction', filterPreset: 'pressed', hint: 'Context action (interact, reload, etc.)', hardware: 'button', importance: 'important' },
  { name: 'SelectActionPrevious', confName: 'SelectAction', filterPreset: 'previous', hint: 'Select the previous available context action', hardware: 'button', importance: 'optional' },
  { name: 'SelectActionNext', confName: 'SelectAction', filterPreset: 'next', hint: 'Select the next available context action', hardware: 'button', importance: 'optional' },
  { name: 'GetOut', filterPreset: 'click', hint: 'Exit vehicle safely', hardware: 'button', importance: 'important' },
  { name: 'JumpOut', filterPreset: 'click', hint: 'Emergency eject (dangerous!)', hardware: 'button', importance: 'optional' },
  { name: 'VehicleDoorToggle', filterPreset: 'click', hint: 'Open or close a supported vehicle door', hardware: 'button', importance: 'optional' },
  { name: 'HelicopterSightDeploy', filterPreset: 'click', hint: 'Deploy or retract the helicopter sight', hardware: 'button', importance: 'optional' },
  { name: 'HelicopterSightZeroingIncrease', confName: 'HelicopterSightZeroing', filterPreset: 'up', hint: 'Increase helicopter sight zeroing', hardware: 'button', importance: 'optional' },
  { name: 'HelicopterSightZeroingDecrease', confName: 'HelicopterSightZeroing', filterPreset: 'down', multiplier: -1, hint: 'Decrease helicopter sight zeroing', hardware: 'button', importance: 'optional' }
]"""
if old not in src:
    raise SystemExit('Could not find base action block')
src = src.replace(old, new, 1)

old = """        if (action.multiplier !== undefined) {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterValue \"${filterGUID}\" {\\n`
          config += `       Multiplier ${action.multiplier}\\n`
          config += `      }\\n`
        } else if (action.filterPreset === 'toggle') {"""
new = """        if (action.confName === 'HelicopterSightZeroing' || action.confName === 'SelectAction') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterRepeat \"${filterGUID}\" {\\n`
          if (action.multiplier !== undefined) {
            config += `       Multiplier ${action.multiplier}\\n`
          }
          config += `      }\\n`
        } else if (action.multiplier !== undefined) {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterValue \"${filterGUID}\" {\\n`
          config += `       Multiplier ${action.multiplier}\\n`
          config += `      }\\n`
        } else if (action.filterPreset === 'toggle') {"""
if old not in src:
    raise SystemExit('Could not find multiplier filter block')
src = src.replace(old, new, 1)

old = """        } else if (action.name === 'HelicopterSightDeploy') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name.includes('EngineStop')) {"""
new = """        } else if (action.name === 'HelicopterSightDeploy' || action.name === 'VehicleDoorToggle') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterClick \"${filterGUID}\" {\\n`
          config += `      }\\n`
        } else if (action.name.includes('EngineStop')) {"""
if old not in src:
    raise SystemExit('Could not find click filter block')
src = src.replace(old, new, 1)

old = """    const action = state.actions.find(a => a.name === actionName)
    if (action) {
      // Find all Input entries within this action
      const inputRegex = /Input\\s+\"([^\"]+)\"/g
      let inputMatch

      while ((inputMatch = inputRegex.exec(actionContent)) !== null) {
        const input = inputMatch[1]
        if (!action.bindings.includes(input)) {
          action.bindings.push(input)
        }
      }
    }"""
new = """    const groupedActions = state.actions.filter(a => a.confName === actionName)
    if (groupedActions.length > 0) {
      // Split grouped game actions back into their UI entries using each source's FilterPreset.
      const sourceRegex = /FilterPreset\\s+\"([^\"]+)\"[\\s\\S]*?Input\\s+\"([^\"]+)\"/g
      let sourceMatch
      while ((sourceMatch = sourceRegex.exec(actionContent)) !== null) {
        const preset = sourceMatch[1]
        const input = sourceMatch[2]
        const action = groupedActions.find(a => a.filterPreset === preset)
        if (action && !action.bindings.includes(input)) {
          action.bindings.push(input)
        }
      }
      continue
    }

    const action = state.actions.find(a => a.name === actionName)
    if (action) {
      // Find all Input entries within this action
      const inputRegex = /Input\\s+\"([^\"]+)\"/g
      let inputMatch

      while ((inputMatch = inputRegex.exec(actionContent)) !== null) {
        const input = inputMatch[1]
        if (!action.bindings.includes(input)) {
          action.bindings.push(input)
        }
      }
    }"""
if old not in src:
    raise SystemExit('Could not find parseConfig action block')
src = src.replace(old, new, 1)

path.write_text(src, encoding='utf-8')
