import os
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BEFORE_DIR = os.path.join(ROOT_DIR, "shots", "stage2.1-before")
AFTER_DIR = os.path.join(ROOT_DIR, "shots", "stage2.2-after")
COMP_DIR = os.path.join(ROOT_DIR, "shots", "stage2-2-comparison")
ARTIFACT_DIR = r"C:\Users\Aaron\.gemini\antigravity\brain\9deda20f-4636-408c-9db4-d0794dd2af98"

os.makedirs(COMP_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

views = [
    ("front", "1. Front View (正面)"),
    ("side_left", "2. Left Side View (左側面)"),
    ("angle45", "3. 45-Degree Perspective (45 度透視)"),
    ("closeup_eye_brow", "4. Eye Socket, Eyelids & Brow Close-Up (龍眼與眉骨近景)"),
    ("closeup_snout_mouth_teeth", "5. Snout, Oral Cavity & Dentition Close-Up (鼻吻、口腔與牙齒近景)"),
    ("closeup_whisker_neck", "6. Ribbon Whiskers & Neck Junction Close-Up (龍鬚與頸部連接近景)"),
]

def get_font(size):
    for font_path in (
        r"C:\Windows\Fonts\msjhbd.ttc",
        r"C:\Windows\Fonts\msjh.ttc",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except Exception:
                pass
    return ImageFont.load_default()

font_title = get_font(28)
font_badge = get_font(22)

pair_images = []

for vkey, vlabel in views:
    b_path = os.path.join(BEFORE_DIR, f"after_{vkey}.png")
    a_path = os.path.join(AFTER_DIR, f"after_{vkey}.png")

    if not os.path.exists(b_path) or not os.path.exists(a_path):
        print(f"[Warn] Missing {b_path} or {a_path}")
        continue

    img_b = Image.open(b_path).convert("RGB")
    img_a = Image.open(a_path).convert("RGB")

    w, h = img_b.size
    header_h = 64
    gap = 16
    pad = 16
    canvas_w = pad * 2 + w * 2 + gap
    canvas_h = header_h + h + pad

    canvas = Image.new("RGB", (canvas_w, canvas_h), (24, 20, 18))
    draw = ImageDraw.Draw(canvas)

    # Header title
    draw.text((pad, 16), f"Stage 2.2 Visual Comparison — {vlabel}", fill=(245, 224, 178), font=font_title)

    # Paste Before (left) and After (right)
    canvas.paste(img_b, (pad, header_h))
    canvas.paste(img_a, (pad + w + gap, header_h))

    # Draw BEFORE / AFTER badges
    draw.rectangle([pad + 16, header_h + 16, pad + 320, header_h + 58], fill=(55, 24, 20), outline=(180, 90, 70), width=2)
    draw.text((pad + 28, header_h + 23), "BEFORE (Stage 2.1)", fill=(255, 195, 180), font=font_badge)

    rx = pad + w + gap
    draw.rectangle([rx + 16, header_h + 16, rx + 320, header_h + 58], fill=(20, 58, 42), outline=(90, 205, 145), width=2)
    draw.text((rx + 28, header_h + 23), "AFTER (Stage 2.2 Polish)", fill=(190, 255, 215), font=font_badge)

    out_pair_path = os.path.join(COMP_DIR, f"compare_{vkey}.png")
    canvas.save(out_pair_path, quality=95)
    canvas.save(os.path.join(ARTIFACT_DIR, f"stage2_2_compare_{vkey}.png"), quality=95)
    # Also copy individual Before and After into artifact dir & comparison dir
    img_b.save(os.path.join(COMP_DIR, f"before_{vkey}.png"))
    img_a.save(os.path.join(COMP_DIR, f"after_{vkey}.png"))
    img_b.save(os.path.join(ARTIFACT_DIR, f"stage2_2_before_{vkey}.png"))
    img_a.save(os.path.join(ARTIFACT_DIR, f"stage2_2_after_{vkey}.png"))

    pair_images.append(canvas)
    print(f"[Compare] Saved {out_pair_path}")

# Update stage2_blender_*.png in artifact dir and shots/dragon-head-blender/ so existing links show latest Stage 2.2
STAGE2_SHOT_DIR = os.path.join(ROOT_DIR, "shots", "stage2-dragon-head")
os.makedirs(STAGE2_SHOT_DIR, exist_ok=True)
for vkey, _ in views:
    a_path = os.path.join(AFTER_DIR, f"after_{vkey}.png")
    if os.path.exists(a_path):
        img_a = Image.open(a_path)
        img_a.save(os.path.join(STAGE2_SHOT_DIR, f"stage2_blender_{vkey}.png"))
        img_a.save(os.path.join(ARTIFACT_DIR, f"stage2_blender_{vkey}.png"))

# Build 6-row Master Comparison Sheet
if pair_images:
    scale = 0.5
    pw = int(pair_images[0].width * scale)
    ph = int(pair_images[0].height * scale)
    master = Image.new("RGB", (pw, ph * len(pair_images)), (24, 20, 18))
    for idx, pimg in enumerate(pair_images):
        resized = pimg.resize((pw, ph), Image.Resampling.LANCZOS)
        master.paste(resized, (0, idx * ph))

    master_path = os.path.join(COMP_DIR, "stage2_2_master_before_after_6views.png")
    master.save(master_path, quality=95)
    master.save(os.path.join(ARTIFACT_DIR, "stage2_2_master_before_after_6views.png"), quality=95)
    print(f"[Master] Saved {master_path} ({master.width}x{master.height})")
