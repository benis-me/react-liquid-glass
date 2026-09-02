import QRCode from "qrcode";
import type { QrEyeRect } from "./qr-renderer";

export const QR_SIZE = 300;
export const QR_PADDING = 10;

export interface QrGeometry {
  eyes: QrEyeRect[];
  occupancy: Uint8Array;
  matrixLength: number;
  gridOriginUv: number;
  cellUv: number;
  dotRadius: number;
}

export function buildQrGeometry(): QrGeometry {
  const qr = QRCode.create("https://glass-ui.dev", { errorCorrectionLevel: "Q" });
  const matrixLength = qr.modules.size;
  const usable = QR_SIZE - QR_PADDING * 2;
  const cell = usable / matrixLength;
  const eyes: QrEyeRect[] = [];
  for (const corner of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
    const left = (matrixLength - 7) * cell * corner.x + QR_PADDING;
    const top = (matrixLength - 7) * cell * corner.y + QR_PADDING;
    for (let layer = 0; layer < 3; layer += 1) {
      eyes.push({
        x: left + cell * layer,
        y: top + cell * layer,
        width: cell * (7 - layer * 2),
        height: cell * (7 - layer * 2),
        rx: -((layer - 2) * 10) + (layer === 0 ? 2 : 3),
      });
    }
  }

  const occupancy = new Uint8Array(matrixLength * matrixLength);
  const logoSize = 0.25 * usable;
  const reservedModules = Math.floor((1.5 * logoSize) / cell);
  const minLogo = matrixLength / 2 - reservedModules / 2;
  const maxLogo = matrixLength / 2 + reservedModules / 2 - 1;
  for (let row = 0; row < matrixLength; row += 1) {
    for (let column = 0; column < matrixLength; column += 1) {
      const filled = qr.modules.get(row, column) !== 0;
      const finder = (row < 7 && column < 7) || (row > matrixLength - 8 && column < 7) || (row < 7 && column > matrixLength - 8);
      const logo = row > minLogo && row < maxLogo && column > minLogo && column < maxLogo;
      if (filled && !finder && !logo) occupancy[column * matrixLength + row] = 255;
    }
  }

  return {
    eyes,
    occupancy,
    matrixLength,
    gridOriginUv: QR_PADDING / QR_SIZE,
    cellUv: cell / QR_SIZE,
    dotRadius: cell / 2.85 / QR_SIZE,
  };
}
