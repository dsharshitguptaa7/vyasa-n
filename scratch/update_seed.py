with open('backend/app/services/seed_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_maps_marker = """    "sama_content_editor": [
        "sama:read",
        "sama:content:edit",
        "pillars:read",
        "notifications:read",
    ],"""

new_maps = """    "sama_content_editor": [
        "sama:read",
        "sama:content:edit",
        "pillars:read",
        "notifications:read",
    ],
    "anudaan_admin": [
        "anudaan:read",
        "anudaan:finance:manage",
        "anudaan:gallery:edit",
        "anudaan:config:manage",
        "pillars:read",
        "notifications:read",
    ],
    "anudaan_finance_officer": [
        "anudaan:read",
        "anudaan:finance:manage",
        "pillars:read",
        "notifications:read",
    ],
    "anudaan_gallery_editor": [
        "anudaan:read",
        "anudaan:gallery:edit",
        "pillars:read",
        "notifications:read",
    ],"""

assert old_maps_marker in content, "old_maps_marker not found"
content = content.replace(old_maps_marker, new_maps)

with open('backend/app/services/seed_service.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Updated ROLE_PERMISSION_MAP successfully")
