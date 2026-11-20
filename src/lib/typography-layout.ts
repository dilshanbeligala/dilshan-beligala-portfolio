export const wordMotionLimits = {
  perspective: 900,
  rotation: 1.3,
  yaw: 4,
  depth: 12,
  scale: 1.035,
} as const;

type Size = { width: number; height: number };
type Bounds = Size & { displacement: number };
export type WordPlacement = Bounds & { index: number; x: number; y: number };

export function footerTypographyProfile(width: number) {
  if (width >= 1000) return { count: 50, gap: 12, displacement: 5 };
  if (width >= 680) return { count: 30, gap: 11, displacement: 4 };
  return { count: 16, gap: 10, displacement: 3 };
}

export function wordMotionBounds(size: Size, displacement: number): Bounds {
  const { perspective, rotation, yaw, depth, scale } = wordMotionLimits;
  const sin = (angle: number) => Math.sin(angle * Math.PI / 180);
  // The most forward corner sets an upper bound on perspective magnification.
  // Tilt compresses x before the in-plane rotation, so using the full width is safe.
  const forward = depth + size.width * scale * .5 * sin(yaw);
  const magnification = scale * perspective / (perspective - forward);
  return {
    width: Math.ceil((size.width + size.height * sin(rotation)) * magnification + displacement * 2 + 2),
    height: Math.ceil((size.height + size.width * sin(rotation)) * magnification + displacement * 2 + 2),
    displacement,
  };
}

export function packTypography(sizes: readonly Size[], field: Size, gap: number, displacement: number): WordPlacement[] {
  const rows: { words: WordPlacement[]; width: number; height: number }[] = [];
  const inset = Math.max(8, gap / 2);
  const innerWidth = field.width - inset * 2;
  const innerHeight = field.height - inset * 2;
  let usedHeight = 0;

  for (const [index, size] of sizes.entries()) {
    const bounds = wordMotionBounds(size, displacement);
    if (bounds.width > innerWidth || bounds.height > innerHeight) continue;
    // Fill unused space in earlier rows before adding vertical height.
    let row = rows
      .filter(candidate => candidate.width + gap + bounds.width <= innerWidth
        && usedHeight + Math.max(0, bounds.height - candidate.height) <= innerHeight)
      .reduce<(typeof rows)[number] | undefined>((best, candidate) => {
        if (!best) return candidate;
        const growth = Math.max(0, bounds.height - candidate.height);
        const bestGrowth = Math.max(0, bounds.height - best.height);
        return growth < bestGrowth || (growth === bestGrowth && candidate.width > best.width) ? candidate : best;
      }, undefined);
    if (!row) {
      const rowGap = rows.length ? gap : 0;
      if (usedHeight + rowGap + bounds.height > innerHeight) continue;
      row = { words: [], width: 0, height: 0 };
      usedHeight += rowGap;
      rows.push(row);
    }
    const heightIncrease = Math.max(0, bounds.height - row.height);
    row.width += (row.words.length ? gap : 0) + bounds.width;
    row.height += heightIncrease;
    usedHeight += heightIncrease;
    row.words.push({ ...bounds, index, x: 0, y: 0 });
  }

  const verticalStep = rows.length ? (innerHeight - usedHeight) / (rows.length + 1) : 0;
  let y = inset + verticalStep;
  return rows.flatMap(row => {
    const horizontalStep = (innerWidth - row.width) / (row.words.length + 1);
    let x = inset + horizontalStep;
    for (const word of row.words) {
      word.x = x + word.width / 2;
      word.y = y + row.height / 2;
      x += word.width + gap + horizontalStep;
    }
    y += row.height + gap + verticalStep;
    return row.words;
  });
}
