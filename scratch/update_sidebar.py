import pathlib

path = pathlib.Path("frontend/src/admin/components/AdminSidebar.tsx")
content = path.read_text(encoding="utf-8")

addition = """    // 4. ANUDAAN (Yajur Veda Administration & Showcase)
    if (isAdministrator) {
      sections.push({
        id: 'yajur-veda',
        title: 'ANUDAAN (Yajur Veda)',
        badge: 'Incentive CMS',
        items: [
          {
            id: 'anudaan-impact',
            label: 'Incentive Impact & Ledger',
            path: '/admin/anudaan',
            icon: 'layout-dashboard',
          },
          {
            id: 'anudaan-gallery',
            label: 'Recognition Gallery CMS',
            path: '/admin/anudaan/gallery',
            icon: 'layers',
          },
          {
            id: 'anudaan-config',
            label: 'Showcase Configuration',
            path: '/admin/anudaan/config',
            icon: 'settings',
          },
        ],
      });
    }

"""

target = "    return sections;"
if target in content:
    content = content.replace(target, addition + target, 1)
    path.write_text(content, encoding="utf-8")
    print("Updated AdminSidebar.tsx successfully")
else:
    print("Target not found")
