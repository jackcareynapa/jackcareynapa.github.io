"""Make the view through the window (the dusk hills) from the reference image.

Usage: python3 tools/make_backdrop.py path/to/reference.png
Writes assets/scene/backdrop.webp: the two window panes with the mullion and the deck
removed, softened like a distant view through wet glass.
"""
import os, sys
import cv2, numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
src = cv2.imread(sys.argv[1])
x0, y0, x1, y1 = 728, 0, 1672, 312
img = src[y0:y1, x0:x1].copy()
h, w = img.shape[:2]
# the deck and its cheek cover the lower left: fill them from the clear forest to the right
deck = np.zeros((h, w), np.uint8)
cv2.fillPoly(deck, [np.array([(0, 176), (1236 - x0, 176), (1262 - x0, 182), (1365 - x0, 312), (0, 312)])], 255)
src_band = img[176:312, 1370 - x0:w]
fill = img.copy()
bx = 0
while bx < 1370 - x0:
    seg = src_band[:, : min(src_band.shape[1], 1370 - x0 - bx)]
    seg = seg[:, ::-1] if (bx // src_band.shape[1]) % 2 else seg
    fill[176:312, bx:bx + seg.shape[1]] = seg
    bx += seg.shape[1]
m = cv2.GaussianBlur(deck.astype(np.float32) / 255, (31, 31), 0)[..., None]
img = (img * (1 - m) + fill * m).astype(np.uint8)
# the mullion between the panes
mull = np.zeros((h, w), np.uint8)
mull[:, 943 - x0:1024 - x0] = 255
img = cv2.inpaint(img, mull, 11, cv2.INPAINT_TELEA)
reg = img[:, 930 - x0:1040 - x0].astype(np.float32)
img[:, 930 - x0:1040 - x0] = cv2.GaussianBlur(reg, (21, 5), 0).astype(np.uint8)
# extend both sides by mirroring, for parallax room, then soften like a far view
img = np.concatenate([img[:, :240][:, ::-1], img, img[:, -240:][:, ::-1]], axis=1)
img = cv2.medianBlur(img, 5)
img = cv2.GaussianBlur(img, (5, 5), 0)
out = os.path.join(HERE, '..', 'assets', 'scene', 'backdrop.webp')
Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(out, 'WEBP', quality=86, method=6)
print(img.shape)
