import { useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StarLayer = "dust" | "star" | "bright";
type FlareState = "idle" | "rising" | "falling";

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
  twinkleAmp: number;
  r: number;
  g: number;
  b: number;
  layer: StarLayer;
  // flare
  flareState: FlareState;
  flarePhase: number;       // 0 = dark, 1 = peak
  flareIdleMs: number;      // rest between flares
  flareIdleTimer: number;   // countdown
  flareRiseMs: number;
  flareFallMs: number;
  flareMaxBoost: number;    // opacity boost at peak
  flareMaxGlow: number;     // glow radius at peak
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const COLD: Array<[number, number, number]> = [
  [205, 238, 255],
  [190, 225, 255],
  [220, 245, 255],
  [165, 210, 255],
];
const CYAN: [number, number, number] = [86, 196, 240];

// ─── Star factory ─────────────────────────────────────────────────────────────

function buildStars(w: number, h: number): Star[] {
  const out: Star[] = [];

  const add = (
    layer: StarLayer,
    count: number,
    {
      sizeMin, sizeMax,
      opMin, opMax,
      twAmpMin, twAmpMax,
      twSpMin, twSpMax,
      cyanP,
      idleMin, idleMax,
      riseMin, riseMax,
      fallMin, fallMax,
      boost,
      glowMin, glowMax,
    }: {
      sizeMin: number; sizeMax: number;
      opMin: number; opMax: number;
      twAmpMin: number; twAmpMax: number;
      twSpMin: number; twSpMax: number;
      cyanP: number;
      idleMin: number; idleMax: number;
      riseMin: number; riseMax: number;
      fallMin: number; fallMax: number;
      boost: number;
      glowMin: number; glowMax: number;
    }
  ) => {
    for (let i = 0; i < count; i++) {
      const col = Math.random() < cyanP ? CYAN : COLD[Math.floor(Math.random() * COLD.length)];
      const canFlare = isFinite(idleMax);
      out.push({
        x: rnd(0, w),
        y: rnd(0, h),
        size: rnd(sizeMin, sizeMax),
        baseOpacity: rnd(opMin, opMax),
        twinklePhase: rnd(0, Math.PI * 2),
        twinkleSpeed: rnd(twSpMin, twSpMax),
        twinkleAmp: rnd(twAmpMin, twAmpMax),
        r: col[0], g: col[1], b: col[2],
        layer,
        flareState: "idle",
        flarePhase: 0,
        flareIdleMs:  canFlare ? rnd(idleMin, idleMax) : Infinity,
        flareIdleTimer: canFlare ? rnd(0, idleMax * 0.6) : Infinity,
        flareRiseMs: rnd(riseMin, riseMax),
        flareFallMs: rnd(fallMin, fallMax),
        flareMaxBoost: boost,
        flareMaxGlow: canFlare ? rnd(glowMin, glowMax) : 0,
      });
    }
  };

  // Dust — many tiny particles, slow ambient shimmer, never flare
  add("dust", 70, {
    sizeMin: 0.3, sizeMax: 0.8,
    opMin: 0.04, opMax: 0.16,
    twAmpMin: 0.02, twAmpMax: 0.06,
    twSpMin: 0.0002, twSpMax: 0.0007,
    cyanP: 0,
    idleMin: Infinity, idleMax: Infinity,
    riseMin: 1000, riseMax: 1000,
    fallMin: 1000, fallMax: 1000,
    boost: 0, glowMin: 0, glowMax: 0,
  });

  // Stars — medium, occasional small flare
  add("star", 38, {
    sizeMin: 0.7, sizeMax: 1.5,
    opMin: 0.10, opMax: 0.38,
    twAmpMin: 0.04, twAmpMax: 0.13,
    twSpMin: 0.00008, twSpMax: 0.0004,
    cyanP: 0.10,
    idleMin: 10000, idleMax: 50000,
    riseMin: 700, riseMax: 1800,
    fallMin: 1100, fallMax: 3200,
    boost: 0.45,
    glowMin: 3, glowMax: 9,
  });

  // Bright — few, strong glow, cross-rays at peak
  add("bright", 10, {
    sizeMin: 1.4, sizeMax: 2.4,
    opMin: 0.22, opMax: 0.52,
    twAmpMin: 0.07, twAmpMax: 0.16,
    twSpMin: 0.00006, twSpMax: 0.00022,
    cyanP: 0.28,
    idleMin: 4000, idleMax: 18000,
    riseMin: 500, riseMax: 1400,
    fallMin: 900, fallMax: 2400,
    boost: 0.85,
    glowMin: 10, glowMax: 30,
  });

  return out;
}

// ─── Per-star update + draw ───────────────────────────────────────────────────

function tick(ctx: CanvasRenderingContext2D, s: Star, dt: number) {
  // Ambient twinkle
  s.twinklePhase += s.twinkleSpeed * dt;

  // Flare state machine
  if (s.flareState === "idle") {
    if (isFinite(s.flareIdleTimer)) {
      s.flareIdleTimer -= dt;
      if (s.flareIdleTimer <= 0) {
        s.flareState = "rising";
        s.flarePhase = 0;
      }
    }
  } else if (s.flareState === "rising") {
    s.flarePhase = Math.min(1, s.flarePhase + dt / s.flareRiseMs);
    if (s.flarePhase >= 1) s.flareState = "falling";
  } else {
    s.flarePhase = Math.max(0, s.flarePhase - dt / s.flareFallMs);
    if (s.flarePhase <= 0) {
      s.flareState = "idle";
      // randomise next idle duration slightly
      s.flareIdleTimer = s.flareIdleMs * rnd(0.6, 1.4);
    }
  }

  // Smooth flare curve (ease in-out)
  const fp = s.flarePhase * s.flarePhase * (3 - 2 * s.flarePhase);

  const twinkle = Math.sin(s.twinklePhase) * s.twinkleAmp;
  const opacity = Math.min(1, Math.max(0, s.baseOpacity + twinkle + fp * s.flareMaxBoost));

  const { r, g, b } = s;

  // 1. Outer soft glow halo
  if (fp > 0.02 && s.flareMaxGlow > 0) {
    const gr = fp * s.flareMaxGlow;
    const ga = fp * 0.30;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, gr);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${ga})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${ga * 0.4})`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Cross / diffraction rays for bright stars at peak
  if (s.layer === "bright" && fp > 0.45) {
    const t = (fp - 0.45) / 0.55; // 0→1 during upper half of flare
    const rayLen = t * s.flareMaxGlow * 1.1;
    const rayAlpha = t * 0.22;
    ctx.save();
    ctx.strokeStyle = `rgba(${r},${g},${b},${rayAlpha})`;
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    // Draw 4 rays
    for (let angle = 0; angle < Math.PI; angle += Math.PI / 2) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(s.x - cos * rayLen, s.y - sin * rayLen);
      ctx.lineTo(s.x + cos * rayLen, s.y + sin * rayLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Star core
  ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function V2StarField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;

    let stars = buildStars(w, h);
    let last  = performance.now();
    let raf   = 0;

     
    const safeCtx = ctx!;
     
    const safeCanvas = canvas!;

    function frame(now: number) {
      const dt = Math.min(now - last, 80); // cap delta to avoid jumps
      last = now;
      safeCtx.clearRect(0, 0, w, h);
      for (const s of stars) tick(safeCtx, s, dt);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    function onResize() {
      w = window.innerWidth;
      h = window.innerHeight;
      safeCanvas.width  = w;
      safeCanvas.height = h;
      stars = buildStars(w, h);
    }
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
