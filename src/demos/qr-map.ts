const MAP_SIZE = 128;
const DEPTH = 30;

interface LayerBuffer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  image: ImageData;
}

function createLayer(): LayerBuffer {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create QR displacement layer");
  return { canvas, context, image: context.createImageData(MAP_SIZE, MAP_SIZE) };
}

function generateLayer(layer: LayerBuffer, halfSize: number) {
  const data = layer.image.data;
  const innerRadius = Math.max(0, halfSize - DEPTH);
  const inverseSigma = DEPTH > 0 ? 1 / (DEPTH * Math.SQRT2) : 1e6;
  for (let y = 0; y < MAP_SIZE; y += 1) {
    const py = ((y + 0.5) / MAP_SIZE) * halfSize * 2 - halfSize;
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const px = ((x + 0.5) / MAP_SIZE) * halfSize * 2 - halfSize;
      const index = (y * MAP_SIZE + x) * 4;
      const distance = Math.sqrt(px * px + py * py);
      if (distance >= halfSize) {
        data[index] = 128;
        data[index + 1] = 128;
        data[index + 2] = 128;
        data[index + 3] = 0;
        continue;
      }
      const directionX = Math.max(-1, Math.min(1, px / halfSize));
      const directionY = Math.max(-1, Math.min(1, py / halfSize));
      const falloff = 0.5 * (1 + Math.tanh(1.7724538509 * (distance - innerRadius) * inverseSigma));
      data[index] = Math.round((0.5 - 0.5 * directionX * falloff) * 255);
      data[index + 1] = Math.round((0.5 - 0.5 * directionY * falloff) * 255);
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }
  layer.context.putImageData(layer.image, 0, 0);
}

export interface ComposedQrMap {
  canvas: HTMLCanvasElement;
  halfSize: number;
  lensOrigin: [number, number];
  lensSize: [number, number];
  scale: [number, number];
}

export class QrWaveComposer {
  private readonly layers = Array.from({ length: 5 }, createLayer);
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;

  constructor() {
    this.canvas.width = MAP_SIZE;
    this.canvas.height = MAP_SIZE;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Unable to create QR displacement compositor");
    this.context = context;
  }

  compose(waves: Array<{ slot: number; radius: number }>): ComposedQrMap | null {
    if (waves.length === 0) return null;
    const halfSize = Math.max(...waves.map((wave) => wave.radius));
    this.context.globalCompositeOperation = "source-over";
    this.context.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    this.context.fillStyle = "rgb(128,128,128)";
    this.context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    for (const wave of waves) {
      const layer = this.layers[wave.slot];
      generateLayer(layer, wave.radius);
      const size = (wave.radius / halfSize) * MAP_SIZE;
      this.context.drawImage(layer.canvas, (MAP_SIZE - size) / 2, (MAP_SIZE - size) / 2, size, size);
    }
    const normalizedSize = (halfSize * 2) / 300;
    const scale = 0.08 * Math.min(normalizedSize, 1);
    return {
      canvas: this.canvas,
      halfSize,
      lensOrigin: [0.5 - halfSize / 300, 0.5 - halfSize / 300],
      lensSize: [normalizedSize, normalizedSize],
      scale: [scale, scale],
    };
  }

  dispose() {
    this.layers.forEach((layer) => {
      layer.canvas.width = 0;
      layer.canvas.height = 0;
    });
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
