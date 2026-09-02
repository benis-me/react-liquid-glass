const SPLASH_COLORS = ["#9896FF", "#39D1F9", "#FFB400", "#FF3200"];

interface PaintPoint {
  x: number;
  y: number;
  age: number;
  color: string;
}

class PaintSplash {
  private radius = 0;
  private innerRadius: number;
  private readonly outerRadius: number;
  private opacity = 1;
  complete = false;

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly size: number,
    private readonly color: string,
    private readonly speed: number,
    private readonly clearColor: string,
    ringStart: number,
    ringEnd: number,
  ) {
    this.innerRadius = Math.max(0, Math.min(ringStart, ringEnd - 0.01));
    this.outerRadius = Math.max(this.innerRadius + 0.01, Math.min(1, ringEnd));
  }

  draw(delta: number) {
    const previousAlpha = this.context.globalAlpha;
    this.context.globalAlpha = this.opacity;
    const gradient = this.context.createRadialGradient(this.size / 2, this.size / 2, 0, this.size / 2, this.size / 2, this.radius);
    gradient.addColorStop(0, this.clearColor);
    gradient.addColorStop(this.innerRadius, this.color);
    gradient.addColorStop(this.outerRadius, this.color);
    gradient.addColorStop(1, "transparent");
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, this.size, this.size);
    this.context.globalAlpha = previousAlpha;
    if (this.innerRadius < 1 - this.speed / 1_000) {
      this.innerRadius = Math.min(this.outerRadius, this.innerRadius + (this.speed / 1_000) * delta);
    }
    if (this.radius < this.size * 3) this.radius += ((this.size * this.speed) / 1_000) * delta;
    if (this.innerRadius >= this.outerRadius) {
      this.opacity = Math.max(0, this.opacity - (this.speed / 1_000) * delta);
      if (this.opacity <= 0) this.complete = true;
    }
  }
}

export interface QrPaintOptions {
  canvas?: HTMLCanvasElement;
  size: number;
  maxAge: number;
  radius: number;
  intensity: number;
  useColor?: boolean;
  clearColor?: string;
  splashSpeed: number;
  ringStart: number;
  ringEnd: number;
}

export class QrPaintTexture {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly points: PaintPoint[] = [];
  private splashes: PaintSplash[] = [];
  private mouse = { x: -10_000, y: -10_000 };
  private colorIndex = 0;
  private clearColor: string;
  private ringStart: number;
  private ringEnd: number;
  private readonly pixelSize: number;
  private readonly radius: number;

  constructor(private readonly options: QrPaintOptions) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    this.pixelSize = Math.ceil(options.size * ratio);
    this.radius = options.radius * ratio;
    this.clearColor = options.clearColor ?? "black";
    this.ringStart = options.ringStart;
    this.ringEnd = options.ringEnd;
    this.canvas = options.canvas ?? document.createElement("canvas");
    this.canvas.width = this.pixelSize;
    this.canvas.height = this.pixelSize;
    const context = this.canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("Unable to create QR paint texture");
    this.context = context;
    this.clear();
  }

  private clear() {
    this.context.fillStyle = this.clearColor;
    this.context.fillRect(0, 0, this.pixelSize, this.pixelSize);
  }

  updateClearColor(color: string) {
    this.clearColor = color;
  }

  updateRings(start: number, end: number) {
    this.ringStart = start;
    this.ringEnd = end;
  }

  updateMouse(position: { x: number; y: number }) {
    this.mouse = position;
  }

  click() {
    const color = this.options.useColor ? SPLASH_COLORS[this.colorIndex] : "#ffffff";
    this.splashes.push(new PaintSplash(this.context, this.pixelSize, color, this.options.splashSpeed, this.clearColor, this.ringStart, this.ringEnd));
    if (this.options.useColor) this.colorIndex = (this.colorIndex + 1) % SPLASH_COLORS.length;
  }

  update(delta: number, painting: boolean) {
    this.clear();
    this.splashes = this.splashes.filter((splash) => !splash.complete);
    this.splashes.forEach((splash) => splash.draw(delta));
    for (let index = this.points.length - 1; index >= 0; index -= 1) {
      const point = this.points[index];
      const eased = 1 - (1 - point.age / this.options.maxAge) ** 3;
      point.age += delta * (0.5 + 0.5 * eased);
      if (point.age > this.options.maxAge) {
        this.points.splice(index, 1);
        continue;
      }
      const position = { x: point.x * this.pixelSize, y: (1 - point.y) * this.pixelSize };
      const remaining = 1 - point.age / this.options.maxAge;
      const shadowOffset = this.pixelSize * 5;
      this.context.shadowOffsetX = shadowOffset;
      this.context.shadowOffsetY = shadowOffset;
      this.context.shadowBlur = this.radius;
      this.context.shadowColor = this.color(point.color, this.options.intensity * remaining);
      this.context.beginPath();
      this.context.fillStyle = point.color;
      this.context.arc(position.x - shadowOffset, position.y - shadowOffset, this.radius, 0, Math.PI * 2);
      this.context.fill();
      this.context.closePath();
    }
    if (painting) {
      this.points.push({
        x: this.mouse.x,
        y: this.mouse.y,
        age: 0,
        color: this.options.useColor ? SPLASH_COLORS[this.colorIndex] : "#ffffff",
      });
    }
  }

  get active() {
    return this.points.length > 0 || this.splashes.length > 0;
  }

  private color(hex: string, alpha: number) {
    const value = hex.replace("#", "");
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  dispose() {
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.points.length = 0;
    this.splashes.length = 0;
  }
}
