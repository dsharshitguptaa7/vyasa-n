import os
import base64
import io
import numpy as np
from PIL import Image, ImageEnhance

def generate():
    src_path = 'assets/branding/csjmu/csjmu-logo.png'
    img = Image.open(src_path).convert('RGBA')

    # Remove stray pixels in columns 0..50
    arr = np.array(img)
    arr[:, :50, 3] = 0
    clean_img = Image.fromarray(arr)

    # The circular emblem is centered at (579, 627) with radius ~426.5
    # Center-crop a square with half-size 430: box is (149, 197, 1009, 1057) -> 860x860
    crop_box = (149, 197, 1009, 1057)
    emblem = clean_img.crop(crop_box)
    print("Cropped emblem size:", emblem.size)

    out_dir = 'frontend/public'
    os.makedirs(out_dir, exist_ok=True)

    # 1. Apple Touch Icon: 180x180
    # Crisp 180x180 PNG
    icon_180 = emblem.resize((180, 180), Image.Resampling.LANCZOS)
    icon_180.save(os.path.join(out_dir, 'apple-touch-icon.png'), format='PNG', optimize=True)
    print("Saved apple-touch-icon.png (180x180)")

    # 2. 32x32 PNG (favicon-32x32.png)
    icon_32 = emblem.resize((32, 32), Image.Resampling.LANCZOS)
    enhancer_32 = ImageEnhance.Sharpness(icon_32)
    icon_32_sharp = enhancer_32.enhance(1.2)
    icon_32_sharp.save(os.path.join(out_dir, 'favicon-32x32.png'), format='PNG', optimize=True)
    print("Saved favicon-32x32.png (32x32)")

    # 3. 16x16 PNG (favicon-16x16.png)
    icon_16 = emblem.resize((16, 16), Image.Resampling.LANCZOS)
    enhancer_16 = ImageEnhance.Sharpness(icon_16)
    icon_16_sharp = enhancer_16.enhance(1.25)
    icon_16_sharp.save(os.path.join(out_dir, 'favicon-16x16.png'), format='PNG', optimize=True)
    print("Saved favicon-16x16.png (16x16)")

    # 4. Standard favicon.png (48x48)
    icon_48 = emblem.resize((48, 48), Image.Resampling.LANCZOS)
    icon_48.save(os.path.join(out_dir, 'favicon.png'), format='PNG', optimize=True)
    print("Saved favicon.png (48x48)")

    # 5. High-res manifest icons
    icon_192 = emblem.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(os.path.join(out_dir, 'android-chrome-192x192.png'), format='PNG', optimize=True)
    
    icon_512 = emblem.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(out_dir, 'android-chrome-512x512.png'), format='PNG', optimize=True)
    print("Saved android-chrome-192x192.png and android-chrome-512x512.png")

    # 6. Multi-resolution favicon.ico containing 16x16, 32x32, 48x48
    ico_path = os.path.join(out_dir, 'favicon.ico')
    emblem.save(
        ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("Saved favicon.ico with sizes [16x16, 32x32, 48x48]")

    # 7. Scalable favicon.svg
    # We encode the crisp 512x512 PNG representation in SVG with crisp rendering hints
    buf = io.BytesIO()
    icon_512.save(buf, format='PNG', optimize=True)
    b64_png = base64.b64encode(buf.getvalue()).decode('ascii')

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <title>CSJMU University Emblem - VYASA Portal</title>
  <defs>
    <clipPath id="circle-clip">
      <circle cx="256" cy="256" r="256" />
    </clipPath>
  </defs>
  <image href="data:image/png;base64,{b64_png}" width="512" height="512" preserveAspectRatio="xMidYMid meet" clip-path="url(#circle-clip)" />
</svg>
'''
    with open(os.path.join(out_dir, 'favicon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print("Saved favicon.svg (512x512 embedded SVG)")

if __name__ == '__main__':
    generate()
