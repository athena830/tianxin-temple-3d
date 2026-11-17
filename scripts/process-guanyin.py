from PIL import Image
import numpy as np
from collections import deque

input_path = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98/.user_uploaded/media_1794872815101_5793430c.jpg'
img = Image.open(input_path).convert('RGB')
arr = np.array(img).astype(float)
h, w, _ = arr.shape

# Distance from pure white [255, 255, 255]
dist = np.sqrt(np.sum((255.0 - arr) ** 2, axis=2))

bg_mask = np.zeros((h, w), dtype=bool)
q = deque()

# 1. Outer borders
for y in range(h):
    for x in [0, w - 1]:
        if dist[y, x] < 18.0 and not bg_mask[y, x]:
            bg_mask[y, x] = True
            q.append((y, x))
for x in range(w):
    for y in [0, h - 1]:
        if dist[y, x] < 18.0 and not bg_mask[y, x]:
            bg_mask[y, x] = True
            q.append((y, x))

# 2. Internal white background seeds (gap between Guanyin and dragon body)
for y in range(470, 590):
    for x in range(485, 535):
        if dist[y, x] < 8.0 and not bg_mask[y, x]:
            bg_mask[y, x] = True
            q.append((y, x))

# Gap between left dragon neck and sleeve
for y in range(400, 430):
    for x in range(270, 290):
        if dist[y, x] < 12.0 and not bg_mask[y, x]:
            bg_mask[y, x] = True
            q.append((y, x))

# Expand background
T_BG = 16.0
while q:
    y, x = q.popleft()
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg_mask[ny, nx]:
            if dist[ny, nx] < T_BG:
                bg_mask[ny, nx] = True
                q.append((ny, nx))

# Smooth alpha calculation
alpha = np.ones((h, w), dtype=float)
alpha[bg_mask] = 0.0

# Transition boundary for anti-aliasing
T_FG = 36.0
for y in range(1, h - 1):
    for x in range(1, w - 1):
        if not bg_mask[y, x]:
            if (bg_mask[y-1, x] or bg_mask[y+1, x] or bg_mask[y, x-1] or bg_mask[y, x+1] or
                bg_mask[y-1, x-1] or bg_mask[y-1, x+1] or bg_mask[y+1, x-1] or bg_mask[y+1, x+1]):
                if dist[y, x] < T_FG:
                    alpha[y, x] = np.clip((dist[y, x] - T_BG) / (T_FG - T_BG), 0.0, 1.0)

# Un-premultiply RGB (Defringe) to eliminate white border halo
out_rgba = np.zeros((h, w, 4), dtype=np.uint8)
for c in range(3):
    col = arr[:, :, c]
    safe_alpha = np.maximum(alpha, 0.08)
    defringed = np.clip((col - (1.0 - alpha) * 255.0) / safe_alpha, 0.0, 255.0)
    out_rgba[:, :, c] = defringed.astype(np.uint8)

out_rgba[:, :, 3] = (alpha * 255.0).astype(np.uint8)

# Check tight bounding box
non_transparent = out_rgba[:, :, 3] > 10
ys, xs = np.where(non_transparent)
ymin, ymax = ys.min(), ys.max()
xmin, xmax = xs.min(), xs.max()

# Crop tightly with 2px padding on top/left/right, and align exact bottom row to the base
crop_ymin = max(0, ymin - 2)
crop_ymax = min(h, ymax + 1)
crop_xmin = max(0, xmin - 2)
crop_xmax = min(w, xmax + 3)

cropped = out_rgba[crop_ymin:crop_ymax, crop_xmin:crop_xmax]
ch, cw, _ = cropped.shape
print(f'Cropped size: {cw}x{ch} (w={cw}, h={ch}, aspect={ch/cw:.4f})')

out_img = Image.fromarray(cropped, mode='RGBA')
out_img.save('public/guanyin.png')
out_img.save('dist/guanyin.png')
out_img.save('dist/assets/guanyin.png')
print('Successfully saved cropped and defringed guanyin.png!')
