import assert from "node:assert/strict";
import { test } from "node:test";
import { footerTypographyProfile, packTypography, wordMotionBounds, wordMotionLimits } from "../../src/lib/typography-layout.ts";

test("projected corners stay inside the reserved bounds at motion extremes", () => {
  const radians = degrees => degrees * Math.PI / 180;
  const { perspective, rotation, yaw, depth, scale } = wordMotionLimits;
  for (const size of [{ width: 540, height: 94 }, { width: 180, height: 42 }, { width: 46, height: 23 }]) {
    for (const displacement of [4, 8, 12]) {
      const bounds = wordMotionBounds(size, displacement);
      for (const x of [-size.width / 2, size.width / 2]) {
        for (const y of [-size.height / 2, size.height / 2]) {
          for (const zRotation of [-rotation, 0, rotation].map(radians)) {
            for (const yRotation of [-yaw, 0, yaw].map(radians)) {
              const leanedX = x * scale * Math.cos(yRotation);
              const tiltedX = leanedX * Math.cos(zRotation) - y * scale * Math.sin(zRotation);
              const tiltedY = leanedX * Math.sin(zRotation) + y * scale * Math.cos(zRotation);
              const factor = perspective / (perspective - depth + x * scale * Math.sin(yRotation));
              assert.ok(Math.abs(tiltedX * factor) + displacement <= bounds.width / 2);
              assert.ok(Math.abs(tiltedY * factor) + displacement <= bounds.height / 2);
            }
          }
        }
      }
    }
  }
});

test("deterministic packing preserves clearances and drops words before overflowing", () => {
  const sizes = Array.from({ length: 24 }, (_, index) => ({ width: 42 + (index * 43) % 311, height: 24 + (index * 7) % 53 }));
  for (const field of [{ width: 1410, height: 680 }, { width: 912, height: 500 }, { width: 288, height: 360 }]) {
    const { count, gap, displacement } = footerTypographyProfile(field.width);
    const requested = sizes.slice(0, count);
    const placed = packTypography(requested, field, gap, displacement);
    assert.deepEqual(placed, packTypography(requested, field, gap, displacement));
    assert.ok(placed.length > 0 && placed.length <= count);
    if (field.width === 288) assert.ok(placed.length < count);
    for (const [index, a] of placed.entries()) {
      assert.ok(a.x - a.width / 2 >= 0 && a.x + a.width / 2 <= field.width);
      assert.ok(a.y - a.height / 2 >= 0 && a.y + a.height / 2 <= field.height);
      for (const b of placed.slice(index + 1)) {
        const separatedX = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
        const separatedY = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
        assert.ok(Math.max(separatedX, separatedY) >= gap - 1e-8);
      }
    }
  }
  assert.deepEqual(packTypography([{ width: 300, height: 100 }], { width: 80, height: 80 }, 14, 4), []);
});
