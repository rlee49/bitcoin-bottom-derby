#!/usr/bin/env python3
"""Clean the accepted Tom animation without redrawing any source artwork.

The accepted corn-man sheet was rendered against white.  The older extraction
made the outside transparent but left enclosed white pockets under the donkey
and white-matted edge pixels.  This script removes only background-connected
white pixels, decontaminates the remaining cutout edge, and enlarges the
unchanged source poses on the standard 600 x 460 animation canvas.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


CANVAS = (600, 460)
SCALE = 1.28


def background_regions(rgb: np.ndarray, old_alpha: np.ndarray) -> np.ndarray:
    """Return white-matte pixels connected to outside or enclosed white holes."""
    foreground = old_alpha > 0
    channel_min = rgb.min(axis=2)
    channel_max = rgb.max(axis=2)
    chroma = channel_max - channel_min

    # The source matte is neutral white.  This looser region is used only when
    # reached from a known background seed, so colored subject detail survives.
    white_candidate = foreground & (channel_min >= 222) & (chroma <= 36)

    outside_domain = (~foreground) | white_candidate
    outside = ndimage.binary_propagation(~foreground, mask=outside_domain)

    # White pockets fully surrounded by legs are not reachable from the outer
    # transparent area.  Seed only meaningful pure-white components, then grow
    # those seeds through the same conservative neutral-white region.
    pure_white = foreground & (channel_min >= 248) & (chroma <= 9)
    labels, count = ndimage.label(pure_white, structure=np.ones((3, 3), dtype=bool))
    hole_seeds = np.zeros_like(foreground)
    if count:
        sizes = np.bincount(labels.ravel())
        for label_id in np.flatnonzero(sizes >= 10):
            if label_id:
                hole_seeds |= labels == label_id
    enclosed = ndimage.binary_propagation(hole_seeds, mask=white_candidate)
    return (outside | enclosed) & foreground


def decontaminate_white_matte(rgba: np.ndarray) -> np.ndarray:
    rgb = rgba[:, :, :3].astype(np.float32)
    old_alpha = rgba[:, :, 3]
    foreground = old_alpha > 0
    foreground &= ~background_regions(rgb.astype(np.uint8), old_alpha)

    result = np.zeros_like(rgba)
    result[:, :, :3] = rgba[:, :, :3]
    result[:, :, 3] = np.where(foreground, 255, 0).astype(np.uint8)

    if not np.any(foreground):
        return result

    inside_distance = ndimage.distance_transform_edt(foreground)
    solid = foreground & (inside_distance > 2.25)
    if not np.any(solid):
        solid = foreground.copy()

    _, nearest = ndimage.distance_transform_edt(~solid, return_indices=True)
    nearest_rgb = rgb[nearest[0], nearest[1]]
    boundary = foreground & (inside_distance <= 2.25)

    denominator = 255.0 - nearest_rgb
    numerator = 255.0 - rgb
    ratios = np.zeros_like(rgb, dtype=np.float32)
    usable = denominator > 20.0
    ratios[usable] = numerator[usable] / denominator[usable]
    ordered = np.sort(np.where(usable, ratios, np.inf), axis=2)
    usable_count = usable.sum(axis=2)
    estimated_alpha = np.ones(rgb.shape[:2], dtype=np.float32)
    estimated_alpha = np.where(usable_count == 1, ordered[:, :, 0], estimated_alpha)
    estimated_alpha = np.where(usable_count == 2, (ordered[:, :, 0] + ordered[:, :, 1]) / 2.0, estimated_alpha)
    estimated_alpha = np.where(usable_count == 3, ordered[:, :, 1], estimated_alpha)
    estimated_alpha = np.clip(estimated_alpha, 0.0, 1.0)

    # Only edge pixels can be white-matte contaminated.  Saturated/dark thin
    # details such as the carrot string and stick remain fully present.
    channel_min = rgb.min(axis=2)
    channel_max = rgb.max(axis=2)
    chroma = channel_max - channel_min
    protected_detail = (chroma >= 45.0) | (channel_min <= 150.0)
    estimated_alpha = np.where(protected_detail, np.maximum(estimated_alpha, 0.92), estimated_alpha)
    estimated_alpha = np.where(boundary, estimated_alpha, 1.0)
    estimated_alpha = np.where(foreground, estimated_alpha, 0.0)
    estimated_alpha[estimated_alpha < 0.035] = 0.0

    # Remove white from edge RGB.  This prevents light outlines when the frame
    # is composited over the orange track or dark UI.
    safe_alpha = np.maximum(estimated_alpha[:, :, None], 1.0 / 255.0)
    unmatted = (rgb - (1.0 - safe_alpha) * 255.0) / safe_alpha
    unmatted = np.clip(unmatted, 0.0, 255.0)
    low_alpha = estimated_alpha < 0.16
    unmatted[low_alpha] = nearest_rgb[low_alpha]

    result[:, :, :3] = np.rint(unmatted).astype(np.uint8)
    result[:, :, 3] = np.rint(estimated_alpha * 255.0).astype(np.uint8)
    result[result[:, :, 3] == 0, :3] = 0
    return result


def resize_and_center(rgba: np.ndarray) -> Image.Image:
    alpha = rgba[:, :, 3]
    ys, xs = np.nonzero(alpha)
    if not len(xs):
        raise ValueError("Tom frame contains no visible pixels")
    left, right = int(xs.min()), int(xs.max()) + 1
    top, bottom = int(ys.min()), int(ys.max()) + 1
    crop = Image.fromarray(rgba, "RGBA").crop((left, top, right, bottom))
    target = (round(crop.width * SCALE), round(crop.height * SCALE))

    # Premultiplied-alpha resampling avoids reintroducing a light fringe.
    crop = crop.convert("RGBa").resize(target, Image.Resampling.LANCZOS).convert("RGBA")
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    x = (CANVAS[0] - crop.width) // 2
    y = (CANVAS[1] - crop.height) // 2
    canvas.alpha_composite(crop, (x, y))
    return canvas


def process_frame(source: Path, destination: Path) -> None:
    rgba = np.asarray(Image.open(source).convert("RGBA"), dtype=np.uint8)
    cleaned = decontaminate_white_matte(rgba)
    output = resize_and_center(cleaned)
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("destination_dir", type=Path)
    args = parser.parse_args()

    frames = sorted(args.source_dir.glob("frame-*.png"))
    if len(frames) != 12:
        raise SystemExit(f"expected 12 Tom frames, found {len(frames)}")
    for source in frames:
        process_frame(source, args.destination_dir / source.name)
        print(f"cleaned {source.name}")


if __name__ == "__main__":
    main()
