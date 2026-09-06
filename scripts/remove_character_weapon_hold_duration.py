from pathlib import Path

path = Path('src/App.vue')
src = path.read_text(encoding='utf-8')
old = '''        if (action.name === 'CharacterNextWeapon') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterSingleClick "${filterGUID}" {\\n`
          config += `       HoldDuration 25\\n`
          config += `      }\\n`
'''
new = '''        if (action.name === 'CharacterNextWeapon') {
          const filterGUID = generateGUID()
          config += `      Filter InputFilterSingleClick "${filterGUID}" {\\n`
          config += `      }\\n`
'''
if old not in src:
    raise SystemExit('Expected CharacterNextWeapon generator block not found')
path.write_text(src.replace(old, new, 1), encoding='utf-8')
