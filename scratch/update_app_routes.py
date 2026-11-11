with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

old_routes = """      {/* ANUDAAN (Yajur Veda) Administration Routes */}
      <Route
        path="/admin/anudaan"
        element={
          <AdminRoute allowedRoles={['super_admin', 'administrator']}>
            <AnudaanImpactPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/anudaan/gallery"
        element={
          <AdminRoute allowedRoles={['super_admin', 'administrator']}>
            <AnudaanGalleryPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/anudaan/config"
        element={
          <AdminRoute allowedRoles={['super_admin', 'administrator']}>
            <AnudaanConfigPage />
          </AdminRoute>
        }
      />"""

new_routes = """      {/* ANUDAAN (Yajur Veda) Administration Routes */}
      <Route
        path="/admin/anudaan"
        element={
          <AdminRoute
            allowedRoles={['super_admin', 'administrator', 'anudaan_admin', 'anudaan_finance_officer']}
            requiredPermission="anudaan:finance:manage"
          >
            <AnudaanImpactPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/anudaan/gallery"
        element={
          <AdminRoute
            allowedRoles={['super_admin', 'administrator', 'anudaan_admin', 'anudaan_gallery_editor']}
            requiredPermission="anudaan:gallery:edit"
          >
            <AnudaanGalleryPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/anudaan/config"
        element={
          <AdminRoute
            allowedRoles={['super_admin', 'administrator', 'anudaan_admin']}
            requiredPermission="anudaan:config:manage"
          >
            <AnudaanConfigPage />
          </AdminRoute>
        }
      />"""

assert old_routes in content, "old_routes target not found in App.tsx"
content = content.replace(old_routes, new_routes)

with open('frontend/src/App.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("App.tsx routes updated successfully")
