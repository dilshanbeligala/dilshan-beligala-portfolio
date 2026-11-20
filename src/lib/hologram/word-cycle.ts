export const hologramWords = [
  "Creative", "Engineer", "Builder", "Mobile", "Full Stack",
  "AI Assisted", "Innovator", "Leader", "Collaborator", "Curious",
  "Adaptable", "Analytical", "Inventive", "Thoughtful", "Reliable",
  "Precise", "Practical", "Focused", "Versatile", "Intentional",
] as const;

const startup = 1.2;
const faceHold = 5;
const formWord = 1.4;
const wordHold = 2;
const reformFace = 1.5;
const wordStart = faceHold + formWord;
const wordEnd = wordStart + wordHold;
const cycleDuration = wordEnd + reformFace;

function ease(progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * (3 - 2 * t);
}

export function hologramFrame(time: number) {
  if (time < startup) return { index: 0, scatter: 1 - ease(time / startup), word: 0 };

  const elapsed = time - startup;
  const phase = elapsed % cycleDuration;
  const index = Math.floor(elapsed / cycleDuration) % hologramWords.length;

  return {
    index,
    scatter: 0,
    word: phase < wordStart
      ? ease((phase - faceHold) / formWord)
      : 1 - ease((phase - wordEnd) / reformFace),
  };
}

export function createWordSampler() {
  const canvas = document.createElement("canvas");
  const width = canvas.width = 384;
  const height = canvas.height = 116;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  return (word: string, target: Float32Array, source?: Float32Array) => {
    const label = word.toUpperCase();
    ctx.clearRect(0, 0, width, height);
    ctx.font = "750 72px system-ui, sans-serif";
    const measured = ctx.measureText(label);
    if (measured.width > width - 16) {
      ctx.font = `750 ${72 * (width - 16) / measured.width}px system-ui, sans-serif`;
    }
    const metrics = ctx.measureText(label);
    ctx.fillStyle = "#fff";
    const x = (width + metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
    const y = (height + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    ctx.fillText(label, x, y);

    const rgba = ctx.getImageData(0, 0, width, height).data;
    const worldScale = 3.35 / width;
    target.fill(0);
    let index = 0;
    // Scan in horizontal order and offset alternate columns for even spacing.
    for (let col = 1; col < width; col += 2) {
      for (let row = 1 + ((col >> 1) & 1); row < height; row += 2) {
        if (rgba[(row * width + col) * 4 + 3] < 150) continue;
        target[index++] = (col - width / 2) * worldScale;
        target[index++] = (height / 2 - row) * worldScale;
        target[index++] = 1;
      }
    }
    const count = index / 3;
    if (count === 0 || !source) return count;
    const letters = target.slice(0, index);
    // The first points are present at every quality level. Assign each one a
    // unique target in horizontal order, so dots travel within their side.
    const ordered = Array.from({ length: count }, (_, point) => point * 3);
    ordered.sort((a, b) => source[a] - source[b]);
    for (let point = 0; point < count; point++) {
      const offset = ordered[point];
      target[offset] = letters[point * 3];
      target[offset + 1] = letters[point * 3 + 1];
    }
    // The remaining points merge toward nearby strokes while fading.
    for (let offset = index; offset < target.length; offset += 3) {
      let left = 0;
      let right = count - 1;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (letters[mid * 3] < source[offset]) left = mid + 1;
        else right = mid;
      }
      const x = letters[left * 3];
      let nearest = left;
      for (let point = left + 1; point < count && letters[point * 3] === x; point++) {
        if (Math.abs(letters[point * 3 + 1] - source[offset + 1]) <
            Math.abs(letters[nearest * 3 + 1] - source[offset + 1])) nearest = point;
      }
      target[offset] = letters[nearest * 3];
      target[offset + 1] = letters[nearest * 3 + 1];
    }
    return index / 3;
  };
}
