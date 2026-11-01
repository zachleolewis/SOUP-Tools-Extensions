// Drawing on the canvas that lies over the minimap: a blurred density ("glow") per kind of point, then the dots.
//
// Smoothness with many points: the glow is computed once per redraw on a small 256x256 canvas (a soft round stamp per point, so the
// alpha adds up where points overlap) and then stretched to the real size, which also blurs it. 50 matches are about a thousand
// stamps: a few milliseconds. The dots are drawn at full resolution on top.

import { hexToRgb, hslToRgb, type Point, type Prefs } from "./logic";

export interface Palette {
  kill: [number, number, number];
  death: [number, number, number];
}

/** The theme's colours, read from the CSS variables on <html> (so a custom theme recolours the map too). Kills use the accent, deaths the warning colour. */
export function paletteFromTheme(): Palette {
  const css = getComputedStyle(document.documentElement);
  return { kill: hslToRgb(css.getPropertyValue("--forest-300")), death: hslToRgb(css.getPropertyValue("--warning")) };
}

/** The theme's colours, with the ones chosen on the settings page in their place. */
export function paletteFor(prefs: Prefs): Palette {
  const theme = paletteFromTheme();
  return { kill: prefs.killColor ? hexToRgb(prefs.killColor) : theme.kill, death: prefs.deathColor ? hexToRgb(prefs.deathColor) : theme.death };
}

const GLOW = 256;

function glowLayer(points: Array<{ u: number; v: number }>, [r, g, b]: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = GLOW;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const radius = GLOW * 0.06;
  for (const p of points) {
    const x = p.u * GLOW;
    const y = p.v * GLOW;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, "rgba(0,0,0,0.24)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // Turn how much stamp landed in each pixel into the colour, brighter and more opaque where it piled up.
  const img = ctx.getImageData(0, 0, GLOW, GLOW);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a === 0) continue;
    const heat = Math.min(1, a * 1.5);
    const lift = heat ** 3 * 0.55;
    d[i] = r + (255 - r) * lift;
    d[i + 1] = g + (255 - g) * lift;
    d[i + 2] = b + (255 - b) * lift;
    d[i + 3] = Math.round(255 * Math.min(0.82, heat * 0.9));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface DrawOptions {
  glow: boolean;
  dots: boolean;
  palette: Palette;
}

/** Draw everything for `points` on `canvas` (its width and height are in device pixels). */
export function draw(canvas: HTMLCanvasElement, points: Point[], o: DrawOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const kills = points.filter((p) => p.kind === "kill");
  const deaths = points.filter((p) => p.kind === "death");

  if (o.glow) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (kills.length) ctx.drawImage(glowLayer(kills, o.palette.kill), 0, 0, w, h);
    if (deaths.length) ctx.drawImage(glowLayer(deaths, o.palette.death), 0, 0, w, h);
  }

  if (o.dots) {
    const unit = Math.max(1, w / 640); // 1 at the size the tab usually draws at
    const rad = 4.5 * unit;
    ctx.lineWidth = 2 * unit;
    ctx.strokeStyle = "#000";
    for (const p of deaths) {
      const x = p.u * w;
      const y = p.v * h;
      ctx.fillStyle = `rgb(${o.palette.death.join(",")})`;
      ctx.beginPath(); // a diamond, so a death is told from a kill without relying on colour alone
      ctx.moveTo(x, y - rad * 1.25);
      ctx.lineTo(x + rad * 1.25, y);
      ctx.lineTo(x, y + rad * 1.25);
      ctx.lineTo(x - rad * 1.25, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    for (const p of kills) {
      ctx.fillStyle = `rgb(${o.palette.kill.join(",")})`;
      ctx.beginPath();
      ctx.arc(p.u * w, p.v * h, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
