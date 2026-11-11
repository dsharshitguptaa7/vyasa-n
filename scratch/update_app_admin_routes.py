import pathlib

path = pathlib.Path("frontend/src/App.tsx")
content = path.read_text(encoding="utf-8")

# 1. Update imports
import_target = "  ImportPage,\n} from './admin';"
new_import = """  ImportPage,
  AnudaanImpactPage,
  AnudaanGalleryPage,
  AnudaanConfigPage,
} from './admin';"""

if import_target in content:
    content = content.replace(import_target, new_import, 1)
    print("Updated imports in App.tsx")
else:
    print("Import target not found")

# 2. Add admin routes
route_target = """      <Route
        path="/admin/sama/import"
        element={
          <AdminRoute allowedRoles={['super_admin', 'administrator', 'sama_content_admin']}>
            <ImportPage />
          </AdminRoute>
        }
      />"""

new_routes = route_target + """

      {/* ANUDAAN (Yajur Veda) Administration Routes */}
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

if route_target in content:
    content = content.replace(route_target, new_routes, 1)
    path.write_text(content, encoding="utf-8")
    print("Updated routes in App.tsx successfully")
else:
    print("Route target not found")
