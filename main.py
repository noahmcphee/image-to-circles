#!/usr/bin/env python3
"""Convert an image into a vector made of circles."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass
class Circle:
    x: float
    y: float
    radius: float
    color: tuple[int, int, int]


def load_image(path: str, max_dimension: int = 900) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    scale = min(1.0, max_dimension / max(width, height))
    if scale < 1.0:
        image = image.resize((max(1, int(width * scale)), max(1, int(height * scale))))
    return np.asarray(image, dtype=np.float32)


def generate_circles(
    image: np.ndarray,
    max_circles: int = 250,
    min_radius: int = 3,
    max_radius: int = 24,
    step: int = 8,
) -> list[Circle]:
    height, width, _ = image.shape
    circles: list[Circle] = []
    covered = np.zeros((height, width), dtype=bool)

    for _ in range(max_circles):
        best_circle = None
        best_score = -1.0

        for y in range(0, height, step):
            for x in range(0, width, step):
                if covered[y, x]:
                    continue

                for radius in range(min_radius, max_radius + 1, 2):
                    yy, xx = np.ogrid[:height, :width]
                    mask = (xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2
                    local_mask = mask & ~covered
                    pixel_count = int(local_mask.sum())
                    if pixel_count < 12:
                        continue

                    patch = image[local_mask]
                    avg_color = patch.mean(axis=0)
                    diff = patch - avg_color
                    score = float(np.sum(diff * diff))

                    if score > best_score:
                        best_score = score
                        best_circle = (x, y, radius, tuple(avg_color.astype(int)))

        if best_circle is None:
            break

        x, y, radius, color = best_circle
        circles.append(Circle(float(x), float(y), float(radius), color))

        yy, xx = np.ogrid[:height, :width]
        covered |= (xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2

    return circles


def write_svg(output_path: str, circles: list[Circle], width: int, height: int, background_color: tuple[int, int, int] = (255, 255, 255)) -> None:
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="100%" height="100%" fill="rgb({background_color[0]}, {background_color[1]}, {background_color[2]})"/>',
    ]

    for circle in circles:
        x, y, radius = circle.x, circle.y, circle.radius
        color = circle.color
        out.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{radius:.2f}" '
            f'fill="rgb({color[0]}, {color[1]}, {color[2]})" opacity="1" />'
        )

    out.append("</svg>")
    Path(output_path).write_text("\n".join(out), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert an image into a circle-based SVG")
    parser.add_argument("input", help="Path to the input image")
    parser.add_argument("output", help="Path for the output SVG")
    parser.add_argument("--max-circles", type=int, default=350, help="Maximum number of circles to generate")
    parser.add_argument("--min-radius", type=int, default=3, help="Minimum circle radius in pixels")
    parser.add_argument("--max-radius", type=int, default=25, help="Maximum circle radius in pixels")
    parser.add_argument("--step", type=int, default=8, help="Sampling step size for candidate centers")
    parser.add_argument("--max-dimension", type=int, default=900, help="Largest dimension used while processing")
    args = parser.parse_args()

    image = load_image(args.input, max_dimension=args.max_dimension)
    circles = generate_circles(
        image,
        max_circles=args.max_circles,
        min_radius=args.min_radius,
        max_radius=args.max_radius,
        step=args.step,
    )

    height, width, _ = image.shape
    write_svg(args.output, circles, width=width, height=height)

    print(f"Generated {len(circles)} circles")
    print(f"Saved SVG to: {args.output}")


if __name__ == "__main__":
    main()
