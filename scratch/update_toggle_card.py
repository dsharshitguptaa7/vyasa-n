with open('frontend/src/admin/components/AdminModuleToggleCard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

old_code = """            const isAtharva = mod.key === 'atharva-veda' || mod.isEnabled;"""

new_code = """            const isActive = mod.key === 'atharva-veda' || mod.isEnabled;
            const portalLabel =
              mod.key === 'atharva-veda'
                ? 'NIVARAN Portal'
                : mod.key === 'yajur-veda'
                ? 'ANUDAAN Console'
                : mod.key === 'sama-veda'
                ? 'SAMIKSHA Portal'
                : 'PRAMAAN Portal';"""

assert old_code in content, "old_code not found in AdminModuleToggleCard.tsx"
content = content.replace(old_code, new_code)

# Replace styling usages of isAtharva with isActive
content = content.replace("isAtharva", "isActive")

# Replace NIVARAN Portal with {portalLabel}
content = content.replace("NIVARAN Portal", "{portalLabel}")

with open('frontend/src/admin/components/AdminModuleToggleCard.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Updated AdminModuleToggleCard.tsx successfully")
