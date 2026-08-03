'use client';

// Self-contained canvas ocean animation — seagrass, corals, varied fish, jellyfish, bubbles, waves.
import { useEffect, useRef } from 'react';

interface OceanBackgroundProps {
  className?: string;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Fish = {
  x: number; y: number; speed: number; size: number; dir: 1 | -1;
  body: string; belly: string; fin: string; accent: string;
  alpha: number; yPhase: number; tailPhase: number; tailSpd: number;
  shape: 'normal' | 'round' | 'angel' | 'tiny';
};
type Grass = { x: number; segs: number; h: number; color: string; phase: number; spd: number; };
type Coral = { x: number; type: 'branch' | 'bush' | 'tube' | 'anemone'; color: string; size: number; phase: number; };
type Bubble = { x: number; y: number; r: number; spd: number; alpha: number; wPhase: number; wSpd: number; };
type Jelly = { x: number; y: number; size: number; color: string; alpha: number; phase: number; spd: number; dir: 1 | -1; };

/* ─── Palettes ───────────────────────────────────────────────────────────── */
const FISH_SPECS = [
  { body:'#ff6b35', belly:'#fff8f0', fin:'#ff4500', accent:'#ffffff' }, // clownfish
  { body:'#ff4466', belly:'#ffd700', fin:'#ff2244', accent:'#ffd700' }, // red-gold
  { body:'#1a8cff', belly:'#c8e6ff', fin:'#ffd700', accent:'#ffd700' }, // blue tang
  { body:'#2ecc71', belly:'#a8f0c8', fin:'#27ae60', accent:'#1a8cff' }, // green
  { body:'#f39c12', belly:'#fef9e7', fin:'#e67e22', accent:'#2c3e50' }, // orange
  { body:'#ecdb52', belly:'#fffde7', fin:'#f1c40f', accent:'#e67e22' }, // yellow
  { body:'#9b59b6', belly:'#e8d5f5', fin:'#8e44ad', accent:'#e8d5f5' }, // purple
  { body:'#e91e8c', belly:'#fce4ec', fin:'#c2185b', accent:'#fce4ec' }, // hot pink
  { body:'#00bcd4', belly:'#e0f7fa', fin:'#0097a7', accent:'#ffffff' }, // teal
  { body:'#ff7043', belly:'#fff3e0', fin:'#e64a19', accent:'#fff176' }, // coral orange
  { body:'#8bc34a', belly:'#f1f8e9', fin:'#558b2f', accent:'#ffeb3b' }, // lime
  { body:'#673ab7', belly:'#ede7f6', fin:'#4527a0', accent:'#ce93d8' }, // deep purple
  { body:'#26c6da', belly:'#e0f7fa', fin:'#00838f', accent:'#fff59d' }, // cyan
  { body:'#ff5722', belly:'#fbe9e7', fin:'#bf360c', accent:'#ffcc02' }, // deep orange
  { body:'#66bb6a', belly:'#e8f5e9', fin:'#2e7d32', accent:'#f9a825' }, // forest green
];
const GRASS_COLORS = ['#2d6a4f','#40916c','#52b788','#74c69d','#1b4332','#388e3c','#43a047'];
const CORAL_COLORS = ['#ff6b6b','#ff8e53','#fe3c72','#ff4d4d','#ff6b35','#ffd700','#ff1493','#c0ca33','#ff7043','#ab47bc'];
const JELLY_COLORS = ['rgba(180,100,255','rgba(100,200,255','rgba(255,150,200','rgba(150,255,200','rgba(255,200,100'];

export default function OceanBackground({ className = '' }: OceanBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const nextWidth = Math.max(parent.clientWidth, 1);
      const nextHeight = Math.max(parent.clientHeight, 1);

      width = nextWidth;
      height = nextHeight;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);

    /* ─── Spawners ─────────────────────────────────────────────────────── */
    const rnd = (a: number, b: number) => Math.random() * (b - a) + a;
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const spawnFish = (forceDir?: 1 | -1): Fish => {
      const dir = forceDir ?? (Math.random() > 0.5 ? 1 : -1);
      const spec = pick(FISH_SPECS);
      const shapes: Fish['shape'][] = ['normal','round','angel','tiny','tiny','normal','normal'];
      return {
        x: dir === 1 ? rnd(-200, -60) : rnd(width + 60, width + 200),
        y: rnd(height * 0.05, height * 0.78),
        speed: rnd(0.3, 1.1), size: rnd(10, 30), dir,
        body: spec.body, belly: spec.belly, fin: spec.fin, accent: spec.accent,
        alpha: rnd(0.35, 0.72), yPhase: rnd(0, Math.PI * 2),
        tailPhase: rnd(0, Math.PI * 2), tailSpd: rnd(0.04, 0.09),
        shape: pick(shapes),
      };
    };

    const spawnGrass = (x: number): Grass => ({
      x, segs: Math.floor(rnd(5, 12)), h: rnd(30, 90),
      color: pick(GRASS_COLORS), phase: rnd(0, Math.PI * 2), spd: rnd(0.6, 1.4),
    });

    const spawnCoral = (x: number): Coral => ({
      x, type: pick<Coral['type']>(['branch','bush','tube','anemone']),
      color: pick(CORAL_COLORS), size: rnd(18, 55), phase: rnd(0, Math.PI * 2),
    });

    const spawnBubble = (): Bubble => ({
      x: Math.random() * width,
      y: height + rnd(0, 120),
      r: rnd(1, 4), spd: rnd(0.2, 0.6),
      alpha: rnd(0.1, 0.35), wPhase: rnd(0, Math.PI * 2), wSpd: rnd(0.01, 0.025),
    });

    const spawnJelly = (): Jelly => {
      const dir = Math.random() > 0.5 ? 1 : -1 as 1 | -1;
      return {
        x: dir === 1 ? rnd(-80, -20) : rnd(width + 20, width + 80),
        y: rnd(height * 0.08, height * 0.55),
        size: rnd(14, 40), color: pick(JELLY_COLORS),
        alpha: rnd(0.2, 0.45), phase: rnd(0, Math.PI * 2),
        spd: rnd(0.08, 0.28), dir,
      };
    };

    /* ─── Initial populations ──────────────────────────────────────────── */
    const fish: Fish[] = Array.from({ length: 22 }, () => {
      const f = spawnFish(); f.x = rnd(0, width); return f;
    });
    const jellies: Jelly[] = Array.from({ length: 5 }, () => {
      const j = spawnJelly(); j.x = rnd(0, width); return j;
    });
    const bubbles: Bubble[] = Array.from({ length: 45 }, () => {
      const b = spawnBubble(); b.y = rnd(0, height); return b;
    });

    const grassCount = Math.max(1, Math.floor(width / 22));
    const grasses: Grass[] = Array.from({ length: grassCount }, (_, i) =>
      spawnGrass(rnd(i * 22, i * 22 + 22))
    );
    const coralSpots = [0.05,0.12,0.19,0.26,0.34,0.41,0.48,0.55,0.62,0.69,0.76,0.83,0.90,0.96];
    const corals: Coral[] = coralSpots.map(p => spawnCoral(width * p + rnd(-15, 15)));

    /* ─── Draw: underwater tint ────────────────────────────────────────── */
    const drawTint = () => {
      const bot = canvas.height;
      const grad = ctx.createLinearGradient(0, bot * 0.58, 0, bot);
      grad.addColorStop(0, 'rgba(0,150,180,0)');
      grad.addColorStop(0.5, 'rgba(0,120,160,0.07)');
      grad.addColorStop(1, 'rgba(0,80,120,0.17)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, bot);
    };

    /* ─── Draw: sandy floor ────────────────────────────────────────────── */
    const drawFloor = () => {
      const H = canvas.height;
      const grad = ctx.createLinearGradient(0, H - 55, 0, H);
      grad.addColorStop(0, 'rgba(194,164,112,0.18)');
      grad.addColorStop(1, 'rgba(160,130,85,0.28)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H - 55, canvas.width, 55);
    };

    /* ─── Draw: seagrass ───────────────────────────────────────────────── */
    const drawGrass = (g: Grass) => {
      const base = canvas.height - rnd(2, 8);
      ctx.save();
      ctx.globalAlpha = 0.58;
      for (let s = 0; s < g.segs; s++) {
        const ox = g.x + s * 5 - (g.segs * 2.5);
        const wag = Math.sin(time * g.spd + g.phase + s * 0.4) * 8;
        ctx.beginPath();
        ctx.moveTo(ox, base);
        ctx.bezierCurveTo(
          ox + wag * 0.3, base - g.h * 0.35,
          ox + wag * 0.7, base - g.h * 0.7,
          ox + wag, base - g.h
        );
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 1.8 - s * 0.05;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    };

    /* ─── Draw: corals ─────────────────────────────────────────────────── */
    const drawCoral = (c: Coral) => {
      const base = canvas.height - 45;
      ctx.save();
      ctx.globalAlpha = 0.62;

      if (c.type === 'branch') {
        const drawBranch = (x: number, y: number, len: number, angle: number, depth: number) => {
          if (depth < 0 || len < 3) return;
          const ex = x + Math.cos(angle) * len;
          const ey = y + Math.sin(angle) * len;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = c.color;
          ctx.lineWidth = Math.max(0.8, depth * 1.2);
          ctx.stroke();
          const sway = Math.sin(time * 0.4 + c.phase) * 0.08;
          drawBranch(ex, ey, len * 0.68, angle - 0.55 + sway, depth - 1);
          drawBranch(ex, ey, len * 0.68, angle + 0.55 + sway, depth - 1);
        };
        drawBranch(c.x, base, c.size, -Math.PI / 2, 4);

      } else if (c.type === 'bush') {
        for (let i = 0; i < 7; i++) {
          const a = (-Math.PI * 0.85) + (i / 6) * (Math.PI * 0.7);
          const sway = Math.sin(time * 0.5 + c.phase + i) * 0.06;
          ctx.beginPath();
          ctx.moveTo(c.x, base);
          const cp1x = c.x + Math.cos(a + sway) * c.size * 0.4;
          const cp1y = base + Math.sin(a + sway) * c.size * 0.4;
          const ex = c.x + Math.cos(a + sway) * c.size;
          const ey = base + Math.sin(a + sway) * c.size;
          ctx.quadraticCurveTo(cp1x, cp1y, ex, ey);
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          // blob tip
          ctx.beginPath();
          ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = c.color;
          ctx.fill();
        }

      } else if (c.type === 'tube') {
        for (let i = 0; i < 5; i++) {
          const h = c.size * (0.6 + i * 0.12);
          const ox = c.x + (i - 2) * 7;
          const sway = Math.sin(time * 0.35 + c.phase + i * 0.7) * 3;
          ctx.beginPath();
          ctx.moveTo(ox, base);
          ctx.lineTo(ox + sway, base - h);
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.stroke();
          // tube opening
          ctx.beginPath();
          ctx.ellipse(ox + sway, base - h, 4, 2.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fill();
        }

      } else { // anemone
        ctx.save();
        ctx.translate(c.x, base);
        // base disc
        ctx.beginPath();
        ctx.ellipse(0, 0, c.size * 0.45, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
        // tentacles
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI - Math.PI * 0.05;
          const sway = Math.sin(time * 0.8 + c.phase + i * 0.5) * 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * c.size * 0.3, 0);
          const ex = Math.cos(a + sway) * c.size;
          const ey = Math.sin(a + sway) * -c.size * 0.9;
          ctx.quadraticCurveTo(
            Math.cos(a + sway * 0.5) * c.size * 0.6,
            -c.size * 0.45,
            ex, ey
          );
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // tip bulb
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = c.color;
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    };

    /* ─── Draw: waves ──────────────────────────────────────────────────── */
    const drawWaves = () => {
      const W = canvas.width;
      const H = canvas.height;
      const layers = [
        { amp: 24, f: 0.005, spd: 0.28, yR: 0.72, a: 0.08 },
        { amp: 18, f: 0.009, spd: 0.44, yR: 0.76, a: 0.11 },
        { amp: 14, f: 0.013, spd: 0.62, yR: 0.80, a: 0.13 },
        { amp: 10, f: 0.019, spd: 0.84, yR: 0.84, a: 0.15 },
        { amp:  7, f: 0.027, spd: 1.10, yR: 0.88, a: 0.17 },
        { amp:  4, f: 0.038, spd: 1.44, yR: 0.92, a: 0.19 },
      ];
      layers.forEach(l => {
        const yB = H * l.yR;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 3) {
          const y = yB
            + Math.sin(x * l.f + time * l.spd) * l.amp
            + Math.sin(x * l.f * 1.7 + time * l.spd * 0.6) * l.amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,150,200,${l.a})`;
        ctx.fill();
      });
      // Foam on top two layers
      [layers[0], layers[1]].forEach(l => {
        const yB = H * l.yR;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const y = yB
            + Math.sin(x * l.f + time * l.spd) * l.amp
            + Math.sin(x * l.f * 1.7 + time * l.spd * 0.6) * l.amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(200,240,255,0.28)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
    };

    /* ─── Draw: bubbles ────────────────────────────────────────────────── */
    const drawBubbles = () => {
      bubbles.forEach(b => {
        b.y -= b.spd;
        b.x += Math.sin(time * b.wSpd * 80 + b.wPhase) * 0.6;
        if (b.y < -15) { b.y = canvas.height + 15; b.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100,200,255,${b.alpha})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.27, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${b.alpha * 0.55})`;
        ctx.fill();
      });
    };

    /* ─── Draw: jellyfish ──────────────────────────────────────────────── */
    const drawJelly = (j: Jelly) => {
      ctx.save();
      ctx.globalAlpha = j.alpha;
      const puls = Math.sin(time * 1.8 + j.phase) * 0.12 + 1;
      ctx.translate(j.x, j.y);

      // Bell
      ctx.beginPath();
      ctx.ellipse(0, 0, j.size * 0.55 * puls, j.size * 0.4, 0, Math.PI, 0, true);
      ctx.lineTo(j.size * 0.55 * puls, 0);
      ctx.quadraticCurveTo(0, j.size * 0.25, -j.size * 0.55 * puls, 0);
      ctx.closePath();
      const grad = ctx.createRadialGradient(0, -j.size * 0.1, 1, 0, 0, j.size * 0.55);
      grad.addColorStop(0, `${j.color},0.55)`);
      grad.addColorStop(1, `${j.color},0.15)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Tentacles
      for (let i = 0; i < 8; i++) {
        const tx = (i / 7 - 0.5) * j.size * 0.9;
        const wag = Math.sin(time * 1.2 + j.phase + i * 0.4) * 6;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.quadraticCurveTo(tx + wag, j.size * 0.6, tx + wag * 1.4, j.size * 1.2);
        ctx.strokeStyle = `${j.color},0.4)`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.restore();
    };

    /* ─── Draw: fish ───────────────────────────────────────────────────── */
    const drawFish = (f: Fish) => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      const fy = f.y + Math.sin(time * 0.95 + f.yPhase) * 10;
      const tailWag = Math.sin(time * f.tailSpd * 100 + f.tailPhase) * 0.38;
      ctx.translate(f.x, fy);
      if (f.dir === -1) ctx.scale(-1, 1);

      const s = f.size;

      if (f.shape === 'tiny') {
        // Small schooling fish - simple elongated
        ctx.save();
        ctx.translate(-s * 0.7, 0);
        ctx.rotate(tailWag);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-s * 0.55, -s * 0.28);
        ctx.lineTo(-s * 0.55, s * 0.28);
        ctx.closePath();
        ctx.fillStyle = f.body;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.8, s * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = f.body;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.52, -s * 0.05, s * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

      } else if (f.shape === 'round') {
        // Round puffer-like fish
        ctx.save();
        ctx.translate(-s * 0.6, 0);
        ctx.rotate(tailWag);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-s * 0.5, -s * 0.38); ctx.lineTo(-s * 0.5, s * 0.38);
        ctx.closePath(); ctx.fillStyle = f.fin; ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.82, s * 0.72, 0, 0, Math.PI * 2);
        ctx.fillStyle = f.body; ctx.fill();
        // Belly
        ctx.beginPath();
        ctx.ellipse(s * 0.05, s * 0.2, s * 0.5, s * 0.32, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = f.belly; ctx.globalAlpha = f.alpha * 0.5; ctx.fill();
        ctx.globalAlpha = f.alpha;
        // Spots
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(-s * 0.2 + i * s * 0.22, -s * 0.1 + (i % 2) * s * 0.18, s * 0.09, 0, Math.PI * 2);
          ctx.fillStyle = f.fin; ctx.globalAlpha = f.alpha * 0.45; ctx.fill();
          ctx.globalAlpha = f.alpha;
        }
        ctx.beginPath();
        ctx.arc(s * 0.44, -s * 0.1, s * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.47, -s * 0.13, s * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();

      } else if (f.shape === 'angel') {
        // Angelfish tall body
        ctx.save();
        ctx.translate(-s * 0.7, 0);
        ctx.rotate(tailWag);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-s * 0.45, -s * 0.32); ctx.lineTo(-s * 0.45, s * 0.32);
        ctx.closePath(); ctx.fillStyle = f.fin; ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.72, s * 0.88, 0, 0, Math.PI * 2);
        ctx.fillStyle = f.body; ctx.fill();
        // Stripes
        ctx.globalAlpha = f.alpha * 0.38;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.rect(-s * 0.2 + i * s * 0.28, -s * 0.88, s * 0.1, s * 1.76);
          ctx.fillStyle = f.fin; ctx.fill();
        }
        ctx.globalAlpha = f.alpha;
        // Dorsal sweeping fin
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.88);
        ctx.quadraticCurveTo(0, -s * 1.55, s * 0.4, -s * 0.88);
        ctx.fillStyle = f.fin; ctx.globalAlpha = f.alpha * 0.55; ctx.fill();
        ctx.globalAlpha = f.alpha;
        // Ventral fin
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, s * 0.88);
        ctx.quadraticCurveTo(0, s * 1.38, s * 0.3, s * 0.88);
        ctx.fillStyle = f.fin; ctx.globalAlpha = f.alpha * 0.45; ctx.fill();
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(s * 0.4, -s * 0.28, s * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.43, -s * 0.31, s * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();

      } else {
        // Normal fish
        ctx.save();
        ctx.translate(-s * 0.82, 0);
        ctx.rotate(tailWag);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-s * 0.62, -s * 0.42); ctx.lineTo(-s * 0.62, s * 0.42);
        ctx.closePath(); ctx.fillStyle = f.fin; ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.44, 0, 0, Math.PI * 2);
        ctx.fillStyle = f.body; ctx.fill();
        // Belly highlight
        ctx.beginPath();
        ctx.ellipse(s * 0.1, s * 0.14, s * 0.58, s * 0.22, 0, 0, Math.PI);
        ctx.fillStyle = f.belly; ctx.globalAlpha = f.alpha * 0.45; ctx.fill();
        ctx.globalAlpha = f.alpha;
        // Dorsal fin
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, -s * 0.44);
        ctx.quadraticCurveTo(-s * 0.32, -s * 0.9, -s * 0.58, -s * 0.44);
        ctx.closePath(); ctx.fillStyle = f.fin; ctx.globalAlpha = f.alpha * 0.65; ctx.fill();
        ctx.globalAlpha = f.alpha;
        // Pectoral fin
        ctx.beginPath();
        ctx.moveTo(s * 0.08, 0);
        ctx.quadraticCurveTo(s * 0.0, s * 0.6, -s * 0.25, s * 0.38);
        ctx.closePath(); ctx.fillStyle = f.fin; ctx.globalAlpha = f.alpha * 0.52; ctx.fill();
        ctx.globalAlpha = f.alpha;
        // Accent stripe
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.38, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.strokeStyle = f.accent; ctx.lineWidth = s * 0.08; ctx.globalAlpha = f.alpha * 0.3; ctx.stroke();
        ctx.globalAlpha = f.alpha;
        // Eye
        ctx.beginPath();
        ctx.arc(s * 0.50, -s * 0.08, s * 0.115, 0, Math.PI * 2);
        ctx.fillStyle = '#0c1a2e'; ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.525, -s * 0.11, s * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      }
      ctx.restore();
    };

    /* ─── Animation loop ───────────────────────────────────────────────── */
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.016;

      drawTint();
      drawWaves();

      // Grasses and corals (bottom layer)
      grasses.forEach(drawGrass);
      corals.forEach(drawCoral);
      drawFloor();

      drawBubbles();

      // Jellies
      jellies.forEach(j => {
        j.x += j.spd * j.dir * 0.5;
        j.y += Math.sin(time * 0.6 + j.phase) * 0.3;
        if (j.dir === 1 && j.x > canvas.width + 100) Object.assign(j, { ...spawnJelly(), dir: 1 as const });
        else if (j.dir === -1 && j.x < -100) Object.assign(j, { ...spawnJelly(), dir: -1 as const });
        drawJelly(j);
      });

      // Fish
      fish.forEach(f => {
        f.x += f.speed * f.dir;
        if (f.dir === 1 && f.x > canvas.width + 220) Object.assign(f, spawnFish(1));
        else if (f.dir === -1 && f.x < -220) Object.assign(f, spawnFish(-1));
        drawFish(f);
      });

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
