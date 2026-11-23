export interface ImageProcessOptions {
  width: number;
  height: number;
  invert: boolean;
  contrast: number;
  threshold: number;
  fit: 'contain' | 'cover';
}

export interface ProcessedGuideMap {
  /**
   * Interleaved RGB bytes (3 bytes per pixel):
   * R = Sharp B&W target luminance (0..255)
   * G = Full-canvas Euclidean/Chamfer proximity gradient (0..255)
   * B = Sobel edge intensity (0..255)
   */
  guideRGB: Uint8Array;
  luminance: Uint8Array;
  previewDataUrl: string;
}

function separableBoxBlur(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const horiz = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  const win = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let sum = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = Math.max(0, Math.min(width - 1, dx));
      sum += src[rowOffset + cx];
    }
    for (let x = 0; x < width; x++) {
      horiz[rowOffset + x] = sum / win;
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      sum += src[rowOffset + addX] - src[rowOffset + removeX];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const cy = Math.max(0, Math.min(height - 1, dy));
      sum += horiz[cy * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / win;
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      sum += horiz[addY * width + x] - horiz[removeY * width + x];
    }
  }

  return out;
}

/**
 * Computes a smooth organic nutrient diffusion halo blended with a soft Chamfer gradient
 * so colonies discover and colonize shapes naturally without straight radial star-lines.
 */
function buildFullCanvasProximityField(
  src: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const total = width * height;
  const dist = new Float32Array(total);
  const floatLum = new Float32Array(total);
  const maxDist = Math.hypot(width, height);

  for (let i = 0; i < total; i++) {
    dist[i] = src[i] > 50 ? 0 : maxDist;
    floatLum[i] = src[i] / 255;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[i - 1] + 1.0);
      if (y > 0) d = Math.min(d, dist[i - width] + 1.0);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - width - 1] + 1.414);
      if (x < width - 1 && y > 0) d = Math.min(d, dist[i - width + 1] + 1.414);
      dist[i] = d;
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 1.0);
      if (y < height - 1) d = Math.min(d, dist[i + width] + 1.0);
      if (x < width - 1 && y < height - 1) d = Math.min(d, dist[i + width + 1] + 1.414);
      if (x > 0 && y < height - 1) d = Math.min(d, dist[i + width - 1] + 1.414);
      dist[i] = d;
    }
  }

  // 3-pass separable blur creates a smooth organic Gaussian-like agar nutrient halo
  let halo = separableBoxBlur(floatLum, width, height, 10);
  halo = separableBoxBlur(halo, width, height, 16);
  halo = separableBoxBlur(halo, width, height, 22);

  const out = new Uint8Array(total);
  const normScale = Math.max(width, height) * 0.78;
  for (let i = 0; i < total; i++) {
    const prox = Math.max(0, 1.0 - dist[i] / normScale);
    const softProx = prox * prox;
    const combined = Math.min(1, halo[i] * 0.64 + softProx * 0.50);
    out[i] = Math.round(combined * 255);
  }
  return out;
}

/**
 * Computes Sobel edge magnitude so agents trace fine outlines in photos and logos.
 */
function buildEdgeField(src: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = src[i - width - 1];
      const t = src[i - width];
      const tr = src[i - width + 1];
      const l = src[i - 1];
      const r = src[i + 1];
      const bl = src[i + width - 1];
      const b = src[i + width];
      const br = src[i + width + 1];

      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy) * 0.45));
      out[i] = mag;
    }
  }
  return out;
}

export function processImageToGuideMap(
  source: HTMLImageElement | HTMLCanvasElement,
  options: ImageProcessOptions
): ProcessedGuideMap {
  const { width, height, invert, contrast, threshold, fit } = options;

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      guideRGB: new Uint8Array(width * height * 3),
      luminance: new Uint8Array(width * height),
      previewDataUrl: '',
    };
  }

  ctx.fillStyle = invert ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, width, height);

  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  if (srcW > 0 && srcH > 0) {
    const scale =
      fit === 'cover'
        ? Math.max(width / srcW, height / srcH)
        : Math.min(width / srcW, height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (width - drawW) * 0.5;
    const dy = (height - drawH) * 0.5;
    ctx.drawImage(source, dx, dy, drawW, drawH);
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const total = width * height;
  const luminance = new Uint8Array(total);
  const threshNorm = threshold / 255.0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] / 255.0;

    let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    if (a < 1.0) {
      const bgVal = invert ? 1.0 : 0.0;
      lum = lum * a + bgVal * (1.0 - a);
    }

    if (invert) {
      lum = 1.0 - lum;
    }

    let adjusted = (lum - threshNorm) * contrast + 0.5;
    if (adjusted < 0) adjusted = 0;
    if (adjusted > 1) adjusted = 1;
    adjusted = adjusted * adjusted * (3 - 2 * adjusted);

    const byteVal = Math.round(adjusted * 255);
    luminance[p] = byteVal;

    data[i] = byteVal;
    data[i + 1] = byteVal;
    data[i + 2] = byteVal;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);

  const proximity = buildFullCanvasProximityField(luminance, width, height);
  const edges = buildEdgeField(luminance, width, height);
  const guideRGB = new Uint8Array(total * 3);

  for (let i = 0; i < total; i++) {
    guideRGB[i * 3] = luminance[i];
    guideRGB[i * 3 + 1] = proximity[i];
    guideRGB[i * 3 + 2] = edges[i];
  }

  return {
    guideRGB,
    luminance,
    previewDataUrl: offscreen.toDataURL('image/png'),
  };
}

export type SampleTemplateId = 'typography' | 'botanical' | 'sacred_ring' | 'labyrinth';

export function generateSampleTemplate(
  id: SampleTemplateId,
  width = 640,
  height = 480
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';

  const cx = width * 0.5;
  const cy = height * 0.5;

  if (id === 'typography') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.round(width * 0.22);
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('FUNGO', cx, cy - fontSize * 0.25);
    ctx.font = `600 ${Math.round(fontSize * 0.36)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('PHYSARUM', cx, cy + fontSize * 0.45);
    ctx.lineWidth = Math.max(4, width * 0.008);
    ctx.strokeRect(width * 0.08, height * 0.12, width * 0.84, height * 0.76);
  } else if (id === 'botanical') {
    const r = Math.min(width, height) * 0.34;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.15);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#d4d4d4');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
      const wobble = 1 + 0.18 * Math.sin(a * 5) + 0.1 * Math.cos(a * 3);
      const x = cx + Math.cos(a) * r * wobble;
      const y = cy + Math.sin(a) * r * wobble;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000000';
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * r * 0.45, cy + Math.sin(ang) * r * 0.45, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'sacred_ring') {
    const baseR = Math.min(width, height) * 0.22;
    ctx.lineWidth = Math.max(6, width * 0.015);
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 1.45, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * baseR * 0.72, cy + Math.sin(a) * baseR * 0.72, baseR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (id === 'labyrinth') {
    ctx.lineWidth = Math.max(8, width * 0.018);
    const maxR = Math.min(width, height) * 0.4;
    const rings = 5;
    for (let i = 1; i <= rings; i++) {
      const r = (i / rings) * maxR;
      const gapAngle = i * 1.15;
      ctx.beginPath();
      ctx.arc(cx, cy, r, gapAngle + 0.35, gapAngle + Math.PI * 2 - 0.15);
      ctx.stroke();
    }
  }

  return canvas;
}
