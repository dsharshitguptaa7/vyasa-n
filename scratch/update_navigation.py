with open('frontend/src/config/navigation.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

old_anudaan_nav = """export function getAnudaanNavItems(_auth?: any): NavItemConfig[] {
  return [
    {
      id: 'anudaan-portal',
      label: 'Incentive Portal',
      path: '/modules/yajur-veda/anudaan',
      icon: 'building',
    },
    {
      id: 'anudaan-apply',
      label: 'Apply for Incentive',
      path: '/modules/yajur-veda/anudaan/apply',
      icon: 'file-text',
    },
    {
      id: 'anudaan-track',
      label: 'Track Application',
      path: '/modules/yajur-veda/anudaan/track',
      icon: 'search',
    },
  ];
}"""

new_anudaan_nav = """export function getAnudaanNavItems(auth?: any): NavItemConfig[] {
  const user = auth?.user;
  const userRoles = ((user?.roles as string[]) || []).map((r: string) => r.toLowerCase());
  const userPermissions = (((user?.permissions as string[]) || []).map((p: string) => p.toLowerCase()));
  const isSuperAdmin = !!auth?.isSuperAdmin;
  const isAdmin = !!auth?.isAdmin;
  const isAdministrator =
    isSuperAdmin || isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isAnudaanAdmin = isAdministrator || userRoles.includes('anudaan_admin');
  const isAnudaanFinance = isAnudaanAdmin || userRoles.includes('anudaan_finance_officer') || userPermissions.includes('anudaan:finance:manage');
  const isAnudaanGallery = isAnudaanAdmin || userRoles.includes('anudaan_gallery_editor') || userPermissions.includes('anudaan:gallery:edit');
  const isAnudaanConfig = isAnudaanAdmin || userPermissions.includes('anudaan:config:manage');

  const items: NavItemConfig[] = [
    {
      id: 'anudaan-portal',
      label: 'Incentive Portal',
      path: '/modules/yajur-veda/anudaan',
      icon: 'building',
    },
    {
      id: 'anudaan-apply',
      label: 'Apply for Incentive',
      path: '/modules/yajur-veda/anudaan/apply',
      icon: 'file-text',
    },
    {
      id: 'anudaan-track',
      label: 'Track Application',
      path: '/modules/yajur-veda/anudaan/track',
      icon: 'search',
    },
  ];

  if (isAnudaanFinance) {
    items.push({
      id: 'anudaan-admin-impact',
      label: 'Incentive Impact & Finance',
      path: '/admin/anudaan',
      icon: 'layout-dashboard',
    });
  }

  if (isAnudaanGallery) {
    items.push({
      id: 'anudaan-admin-gallery',
      label: 'Researcher Gallery CMS',
      path: '/admin/anudaan/gallery',
      icon: 'layers',
    });
  }

  if (isAnudaanConfig) {
    items.push({
      id: 'anudaan-admin-config',
      label: 'Showcase Configuration',
      path: '/admin/anudaan/config',
      icon: 'settings',
    });
  }

  return items;
}"""

assert old_anudaan_nav in content, "old_anudaan_nav target not found in navigation.ts"
content = content.replace(old_anudaan_nav, new_anudaan_nav)

with open('frontend/src/config/navigation.ts', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Updated getAnudaanNavItems in navigation.ts successfully")
