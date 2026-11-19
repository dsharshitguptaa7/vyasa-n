import re
import numpy as np
from PIL import Image
from pypdf import PdfReader

def reconstruct_qr(pdf_path, out_png_path):
    r = PdfReader(pdf_path)
    content = r.pages[0].get_contents().get_data().decode('latin1')
    rects = re.findall(r'n\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+re\s+f\*', content)
    
    # Filter for the QR rects (where h ~ 0.037006)
    qr_rects = []
    for x_s, y_s, w_s, h_s in rects:
        try:
            x, y, w, h = float(x_s), float(y_s), float(w_s), float(h_s)
            if 0.035 <= h <= 0.039:
                qr_rects.append((x, y, w, h))
        except ValueError:
            pass
    
    print(f'Total QR module rects in {pdf_path}: {len(qr_rects)}')
    if not qr_rects:
        return None
    
    # Unit size
    unit = 0.03700588235294118  # approximate
    # Let's find min x and min y
    min_x = min(r[0] for r in qr_rects)
    max_x = max(r[0] + r[2] for r in qr_rects)
    min_y = min(r[1] for r in qr_rects)
    max_y = max(r[1] + r[3] for r in qr_rects)
    
    width_units = round((max_x - min_x) / unit)
    height_units = round((max_y - min_y) / unit)
    print(f'Bounds: X=[{min_x:.4f}, {max_x:.4f}], Y=[{min_y:.4f}, {max_y:.4f}]')
    print(f'Detected grid size: {width_units} x {height_units}')
    
    # Grid size for version 4 QR is 33
    grid_size = max(width_units, height_units)
    matrix = np.zeros((grid_size, grid_size), dtype=np.uint8)
    
    for x, y, w, h in qr_rects:
        col_start = int(round((x - min_x) / unit))
        num_cols = int(round(w / unit))
        # Note: in PDF y is from bottom to top, QR row 0 is top
        row = grid_size - 1 - int(round((y - min_y) / unit))
        for c in range(col_start, col_start + num_cols):
            if 0 <= row < grid_size and 0 <= c < grid_size:
                matrix[row, c] = 1
                
    # Add quiet zone (4 modules on each side)
    quiet_zone = 4
    full_size = grid_size + 2 * quiet_zone
    full_matrix = np.zeros((full_size, full_size), dtype=np.uint8)
    full_matrix[quiet_zone:quiet_zone+grid_size, quiet_zone:quiet_zone+grid_size] = matrix
    
    # Scale up each module to 10x10 pixels for easy reading
    scale = 10
    img_arr = np.ones((full_size * scale, full_size * scale), dtype=np.uint8) * 255
    for r in range(full_size):
        for c in range(full_size):
            if full_matrix[r, c] == 1:
                img_arr[r*scale:(r+1)*scale, c*scale:(c+1)*scale] = 0
                
    img = Image.fromarray(img_arr, mode='L')
    img.save(out_png_path)
    print(f'Saved reconstructed QR to {out_png_path} ({img.size})')
    return out_png_path

reconstruct_qr('backend/storage/sama_veda/certificates/0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf', 'scratch/reconstructed_0cef_qr.png')
reconstruct_qr('backend/storage/sama_veda/certificates/88bd3085cd32_CSJMU_SAMIKSHA_2026_000001.pdf', 'scratch/reconstructed_88bd_qr.png')
