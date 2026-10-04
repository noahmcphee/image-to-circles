const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusBadge = document.getElementById('statusBadge');
const svgPreview = document.getElementById('svgPreview');
const sourcePreview = document.getElementById('sourcePreview');

const circleCountInput = document.getElementById('circleCount');
const minRadiusInput = document.getElementById('minRadius');
const maxRadiusInput = document.getElementById('maxRadius');
const stepSizeInput = document.getElementById('stepSize');

const circleCountValue = document.getElementById('circleCountValue');
const minRadiusValue = document.getElementById('minRadiusValue');
const maxRadiusValue = document.getElementById('maxRadiusValue');
const stepSizeValue = document.getElementById('stepSizeValue');

let loadedImage = null;
let generatedSvg = '';

function updateLabels() {
  circleCountValue.textContent = circleCountInput.value;
  minRadiusValue.textContent = minRadiusInput.value;
  maxRadiusValue.textContent = maxRadiusInput.value;
  stepSizeValue.textContent = stepSizeInput.value;

  if (Number(maxRadiusInput.value) < Number(minRadiusInput.value)) {
    maxRadiusInput.value = minRadiusInput.value;
    maxRadiusValue.textContent = maxRadiusInput.value;
  }
}

circleCountInput.addEventListener('input', updateLabels);
minRadiusInput.addEventListener('input', updateLabels);
maxRadiusInput.addEventListener('input', updateLabels);
stepSizeInput.addEventListener('input', updateLabels);

imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      sourcePreview.src = reader.result;
      sourcePreview.hidden = false;
      statusBadge.textContent = 'Image loaded';
      generateBtn.disabled = false;
      generateBtn.click();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function buildCircleMask(x, y, radius, width, height) {
  const pixels = [];
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
      const dx = xx - x;
      const dy = yy - y;
      if (dx * dx + dy * dy <= radius * radius) {
        pixels.push(yy * width + xx);
      }
    }
  }
  return pixels;
}

function sampleImageData(img) {
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  return { data, width, height };
}

function computeBestCircle(data, width, height, covered, opts) {
  let best = null;
  let bestScore = -1;

  for (let y = 0; y < height; y += opts.step) {
    for (let x = 0; x < width; x += opts.step) {
      const index = y * width + x;
      if (covered[index]) continue;

      for (let radius = opts.minRadius; radius <= opts.maxRadius; radius += 2) {
        const positions = buildCircleMask(x, y, radius, width, height);
        if (positions.length < 12) continue;

        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let count = 0;

        for (const pos of positions) {
          if (covered[pos]) continue;
          const offset = pos * 4;
          rTotal += data[offset];
          gTotal += data[offset + 1];
          bTotal += data[offset + 2];
          count++;
        }

        if (count < 12) continue;

        const avgR = rTotal / count;
        const avgG = gTotal / count;
        const avgB = bTotal / count;

        let score = 0;
        for (const pos of positions) {
          if (covered[pos]) continue;
          const offset = pos * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];

          score += (r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2;
        }

        if (score > bestScore) {
          bestScore = score;
          best = {
            x,
            y,
            radius,
            color: [Math.round(avgR), Math.round(avgG), Math.round(avgB)]
          };
        }
      }
    }
  }

  return best;
}

function generateSvgFromImage(img, options) {
  const { data, width, height } = sampleImageData(img);
  const covered = new Uint8Array(width * height);
  const circles = [];

  for (let i = 0; i < options.maxCircles; i++) {
    const best = computeBestCircle(data, width, height, covered, options);
    if (!best) break;

    circles.push(best);

    const positions = buildCircleMask(best.x, best.y, best.radius, width, height);
    for (const pos of positions) {
      covered[pos] = 1;
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="white"/>',
    ...circles.map((circle) => {
      const fill = `rgb(${circle.color[0]}, ${circle.color[1]}, ${circle.color[2]})`;
      return `<circle cx="${circle.x}" cy="${circle.y}" r="${circle.radius}" fill="${fill}" />`;
    }),
    '</svg>'
  ].join('');

  return { svg, width, height, count: circles.length };
}

function setStatus(label) {
  statusBadge.textContent = label;
}

generateBtn.addEventListener('click', () => {
  if (!loadedImage) {
    setStatus('Choose an image first');
    return;
  }

  generateBtn.disabled = true;
  setStatus('Generating...');

  requestAnimationFrame(() => {
    const options = {
      maxCircles: Number(circleCountInput.value),
      minRadius: Number(minRadiusInput.value),
      maxRadius: Number(maxRadiusInput.value),
      step: Number(stepSizeInput.value)
    };

    const result = generateSvgFromImage(loadedImage, options);
    generatedSvg = result.svg;
    svgPreview.innerHTML = generatedSvg;
    setStatus(`Generated ${result.count} circles`);
    downloadBtn.disabled = false;
    generateBtn.disabled = false;
  });
});

downloadBtn.addEventListener('click', () => {
  if (!generatedSvg) return;
  const blob = new Blob([generatedSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'circle-art.svg';
  a.click();
  URL.revokeObjectURL(url);
});

updateLabels();
generateBtn.disabled = true;
downloadBtn.disabled = true;
