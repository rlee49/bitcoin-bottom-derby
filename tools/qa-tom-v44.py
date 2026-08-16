#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def fail(message: str) -> None:
    raise SystemExit(message)


project = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
tom_dir = project / "assets/realistic-v43/tom"
frames = sorted(tom_dir.glob("frame-*.png"))
if len(frames) != 12:
    fail(f"Tom: expected 12 frames, found {len(frames)}")

for frame in frames:
    image = Image.open(frame).convert("RGBA")
    if image.size != (600, 460):
        fail(f"{frame.name}: expected 600x460, found {image.size}")

    pixels = np.asarray(image, dtype=np.uint8)
    rgb = pixels[:, :, :3].astype(np.int16)
    alpha = pixels[:, :, 3]
    ys, xs = np.nonzero(alpha)
    if not len(xs):
        fail(f"{frame.name}: empty alpha")

    left, right = int(xs.min()), 599 - int(xs.max())
    top, bottom = int(ys.min()), 459 - int(ys.max())
    if min(left, right) < 40 or min(top, bottom) < 10:
        fail(f"{frame.name}: unsafe padding L/T/R/B {left}/{top}/{right}/{bottom}")

    channel_min = rgb.min(axis=2)
    channel_max = rgb.max(axis=2)
    chroma = channel_max - channel_min

    # Reject the large opaque white pockets that were visible under the donkey.
    pure_white = (alpha >= 250) & (channel_min > 248) & (chroma < 10)
    labels, count = ndimage.label(pure_white, structure=np.ones((3, 3), dtype=bool))
    sizes = np.bincount(labels.ravel())[1:] if count else np.array([], dtype=int)
    largest_white_pocket = int(sizes.max()) if sizes.size else 0
    if largest_white_pocket >= 20:
        fail(f"{frame.name}: opaque white pocket of {largest_white_pocket} pixels")

    # Bright neutral, meaningfully opaque edge pixels expose a white halo on dark UI.
    halo = (alpha >= 64) & (alpha < 250) & (channel_min > 225) & (chroma < 30)
    halo_pixels = int(halo.sum())
    if halo_pixels >= 40:
        fail(f"{frame.name}: {halo_pixels} visible white-matte edge pixels")

    # Carrot/stick occupy the upper-right side of every centered Tom frame.
    yy, xx = np.mgrid[:460, :600]
    red, green, blue = (rgb[:, :, index] for index in range(3))
    carrot = (
        (xx > 350) & (yy < 280) & (alpha > 80) &
        (red > 95) & (red > green * 1.12) & (red > blue * 1.55) &
        (green < 190) & (blue < 125)
    )
    carrot_pixels = int(carrot.sum())
    if carrot_pixels < 1000:
        fail(f"{frame.name}: carrot/stick visibility fell to {carrot_pixels} pixels")

    print(
        f"PASS {frame.name}: padding={left}/{top}/{right}/{bottom} "
        f"white-pocket={largest_white_pocket} halo={halo_pixels} carrot={carrot_pixels}"
    )
