with open('frontend/src/admin/components/AdminSidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

old_auth_block = """  const { user, isSuperAdmin, logout } = useAuth();
  const userRoles = useMemo(() => (user?.roles || []).map((r) => r.toLowerCase()), [user]);
  const isAdministrator = isSuperAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isSamaAdmin = isAdministrator || userRoles.includes('sama_content_admin');
  const isSamaEditor = isSamaAdmin || userRoles.includes('sama_content_editor');"""

new_auth_block = """  const { user, isSuperAdmin, logout } = useAuth();
  const userRoles = useMemo(() => (user?.roles || []).map((r) => r.toLowerCase()), [user]);
  const userPermissions = useMemo(
    () => (((user as any)?.permissions as string[]) || []).map((p) => p.toLowerCase()),
    [user]
  );
  const isAdministrator = isSuperAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator');
  const isSamaAdmin = isAdministrator || userRoles.includes('sama_content_admin');
  const isSamaEditor = isSamaAdmin || userRoles.includes('sama_content_editor');

  // ANUDAAN Granular RBAC Permissions
  const isAnudaanAdmin = isAdministrator || userRoles.includes('anudaan_admin');
  const isAnudaanFinance =
    isAnudaanAdmin ||
    userRoles.includes('anudaan_finance_officer') ||
    userPermissions.includes('anudaan:finance:manage');
  const isAnudaanGallery =
    isAnudaanAdmin ||
    userRoles.includes('anudaan_gallery_editor') ||
    userPermissions.includes('anudaan:gallery:edit');
  const isAnudaanConfig =
    isAnudaanAdmin ||
    userPermissions.includes('anudaan:config:manage');"""

assert old_auth_block in content, "old_auth_block not found in AdminSidebar.tsx"
content = content.replace(old_auth_block, new_auth_block)

old_nav_block = """    // 4. ANUDAAN (Yajur Veda Administration & Showcase)
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

    return sections;
  }, [isAdministrator, isSamaAdmin, isSamaEditor]);"""

new_nav_block = """    // 4. ANUDAAN MANAGEMENT (Yajur Veda)
    if (isAnudaanFinance || isAnudaanGallery || isAnudaanConfig) {
      const anudaanItems: NavItem[] = [];
      if (isAnudaanFinance) {
        anudaanItems.push({
          id: 'anudaan-impact',
          label: 'Incentive Impact & Finance',
          path: '/admin/anudaan',
          icon: 'layout-dashboard',
        });
      }
      if (isAnudaanGallery) {
        anudaanItems.push({
          id: 'anudaan-gallery',
          label: 'Researcher Gallery CMS',
          path: '/admin/anudaan/gallery',
          icon: 'layers',
        });
      }
      if (isAnudaanConfig) {
        anudaanItems.push({
          id: 'anudaan-config',
          label: 'Showcase Configuration',
          path: '/admin/anudaan/config',
          icon: 'settings',
        });
      }

      sections.push({
        id: 'anudaan-management',
        title: 'ANUDAAN MANAGEMENT',
        badge: 'Incentive CMS',
        items: anudaanItems,
      });
    }

    return sections;
  }, [isAdministrator, isSamaAdmin, isSamaEditor, isAnudaanFinance, isAnudaanGallery, isAnudaanConfig]);"""

assert old_nav_block in content, "old_nav_block not found in AdminSidebar.tsx"
content = content.replace(old_nav_block, new_nav_block)

old_active_check = """    if (item.path === '/admin' || item.path === '/admin/sama') {
      return location.pathname === item.path;
    }"""

new_active_check = """    if (item.path === '/admin' || item.path === '/admin/sama' || item.path === '/admin/anudaan') {
      return location.pathname === item.path;
    }"""

assert old_active_check in content, "old_active_check not found in AdminSidebar.tsx"
content = content.replace(old_active_check, new_active_check)

with open('frontend/src/admin/components/AdminSidebar.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("AdminSidebar.tsx updated successfully")
