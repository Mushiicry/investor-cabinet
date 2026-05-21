import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Panel } from "../shared/Panel";
import { currency } from "../../lib/formatters";
import type { Category, CategoryAllocation } from "../../types/portfolio";

type HologramAllocationChartProps = {
  categories: CategoryAllocation[];
};

type CategoryColor = {
  color: string;
  glow: string;
};

type CanvasSegment = CategoryAllocation &
  CategoryColor & {
    startAngle: number;
    endAngle: number;
    midAngle: number;
  };

type Point = {
  x: number;
  y: number;
};

const CATEGORY_COLORS: Record<Category, CategoryColor> = {
  Крипта: { color: "#28e7ff", glow: "rgba(40, 231, 255, 0.88)" },
  Металлы: { color: "#ffe766", glow: "rgba(255, 231, 102, 0.82)" },
  Фьючерсы: { color: "#c260ff", glow: "rgba(194, 96, 255, 0.82)" },
  Акции: { color: "#24df8e", glow: "rgba(36, 223, 142, 0.72)" },
  "Свободные деньги": { color: "#2cff83", glow: "rgba(44, 255, 131, 0.9)" },
};

const DEFAULT_COLOR = { color: "#8fb5ff", glow: "rgba(143, 181, 255, 0.52)" };
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 258;
const TAU = Math.PI * 2;
const PIE = {
  cx: 151,
  cy: 116,
  rx: 122,
  ry: 72,
  depth: 64,
  startAngle: Math.PI * 1.02,
};
const MIN_VISIBLE_ANGLE = (Math.PI / 180) * 18;
const SLICE_GAP = 0.072;
const PIE_X_SHIFT = 30;

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const number = Number.parseInt(full, 16);

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const color = hexToRgb(hex);

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function pointOnEllipse(angle: number, yOffset = 0): Point {
  return {
    x: PIE.cx + PIE.rx * Math.cos(angle),
    y: PIE.cy + yOffset + PIE.ry * Math.sin(angle),
  };
}

function renderColor(segment: CanvasSegment) {
  if (segment.name === "Свободные деньги") {
    return "#28ff7f";
  }

  if (segment.name === "Крипта") {
    return "#24e6ff";
  }

  if (segment.name === "Фьючерсы") {
    return "#dc4cff";
  }

  if (segment.name === "Металлы") {
    return "#ffea42";
  }

  return segment.color;
}

function lowerWallPoint(angle: number): Point {
  return {
    x: PIE.cx + PIE.rx * 0.955 * Math.cos(angle),
    y: PIE.cy + PIE.depth + PIE.ry * 0.86 * Math.sin(angle),
  };
}

function sliceExplodeDistance(segment: CanvasSegment) {
  if (segment.name === "Свободные деньги") {
    return 9;
  }

  if (segment.name === "Крипта") {
    return 12;
  }

  if (segment.name === "Фьючерсы") {
    return 14;
  }

  if (segment.name === "Металлы") {
    return 15;
  }

  return 10;
}

function sliceOffset(segment: CanvasSegment, hovered: boolean) {
  const distance = sliceExplodeDistance(segment) + (hovered ? 8 : 0);

  return {
    x: Math.cos(segment.midAngle) * distance,
    y: Math.sin(segment.midAngle) * distance * 0.44,
  };
}

function formatShare(share: number) {
  const safeShare = Number(share || 0);
  const value = Math.abs(safeShare) <= 1 ? safeShare * 100 : safeShare;

  return `${value.toFixed(1)}%`;
}

function buildSegments(categories: CategoryAllocation[]): CanvasSegment[] {
  const visibleCategories = [...categories]
    .filter((item) => Number(item.value || 0) > 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const total = visibleCategories.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const rawSegments = visibleCategories.map((item) => ({
    item,
    rawSpan: total ? (Number(item.value || 0) / total) * TAU : 0,
  }));
  const minAngleTotal = rawSegments.reduce(
    (sum, segment) => sum + (segment.rawSpan > 0 && segment.rawSpan < MIN_VISIBLE_ANGLE ? MIN_VISIBLE_ANGLE : 0),
    0,
  );
  const scalableAngleTotal = rawSegments.reduce(
    (sum, segment) => sum + (segment.rawSpan >= MIN_VISIBLE_ANGLE ? segment.rawSpan : 0),
    0,
  );
  const remainingAngle = Math.max(0, TAU - minAngleTotal);
  const scale = scalableAngleTotal > 0 ? remainingAngle / scalableAngleTotal : 1;
  const fallbackSpan = rawSegments.length > 0 ? TAU / rawSegments.length : 0;
  let cursor = PIE.startAngle;

  return rawSegments.map(({ item, rawSpan }) => {
    const span =
      minAngleTotal >= TAU
        ? fallbackSpan
        : rawSpan > 0 && rawSpan < MIN_VISIBLE_ANGLE
          ? MIN_VISIBLE_ANGLE
          : rawSpan * scale;
    const startAngle = cursor;
    const endAngle = cursor + span;
    const midAngle = startAngle + span / 2;
    const palette = CATEGORY_COLORS[item.name] ?? DEFAULT_COLOR;

    cursor = endAngle;

    return {
      ...item,
      ...palette,
      startAngle: startAngle + SLICE_GAP,
      endAngle: endAngle - SLICE_GAP,
      midAngle,
    };
  });
}

function sectorTopPath(ctx: CanvasRenderingContext2D, segment: CanvasSegment) {
  const start = pointOnEllipse(segment.startAngle);

  ctx.beginPath();
  ctx.moveTo(PIE.cx, PIE.cy);
  ctx.lineTo(start.x, start.y);
  ctx.ellipse(PIE.cx, PIE.cy, PIE.rx, PIE.ry, 0, segment.startAngle, segment.endAngle);
  ctx.closePath();
}

function outerWallPath(ctx: CanvasRenderingContext2D, startAngle: number, endAngle: number) {
  const start = pointOnEllipse(startAngle);
  const endLower = lowerWallPoint(endAngle);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.ellipse(PIE.cx, PIE.cy, PIE.rx, PIE.ry, 0, startAngle, endAngle);
  ctx.lineTo(endLower.x, endLower.y);
  ctx.ellipse(PIE.cx, PIE.cy + PIE.depth, PIE.rx * 0.955, PIE.ry * 0.86, 0, endAngle, startAngle, true);
  ctx.closePath();
}

function ellipseArcPath(
  ctx: CanvasRenderingContext2D,
  yOffset: number,
  rxScale: number,
  ryScale: number,
  startAngle: number,
  endAngle: number,
  anticlockwise = false,
) {
  ctx.beginPath();
  ctx.ellipse(PIE.cx, PIE.cy + yOffset, PIE.rx * rxScale, PIE.ry * ryScale, 0, startAngle, endAngle, anticlockwise);
}

function radialWallPath(ctx: CanvasRenderingContext2D, angle: number) {
  const top = pointOnEllipse(angle);
  const bottom = lowerWallPoint(angle);

  ctx.beginPath();
  ctx.moveTo(PIE.cx, PIE.cy);
  ctx.lineTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(PIE.cx, PIE.cy + PIE.depth);
  ctx.closePath();
}

function frontArcRanges(segment: CanvasSegment) {
  const ranges: Array<{ startAngle: number; endAngle: number }> = [];
  const firstCycle = Math.floor(segment.startAngle / TAU) - 1;
  const lastCycle = Math.ceil(segment.endAngle / TAU) + 1;

  for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
    const frontStart = cycle * TAU;
    const frontEnd = frontStart + Math.PI;
    const startAngle = Math.max(segment.startAngle, frontStart);
    const endAngle = Math.min(segment.endAngle, frontEnd);

    if (endAngle - startAngle > 0.018) {
      ranges.push({ startAngle, endAngle });
    }
  }

  return ranges;
}

function wallArcRanges(segment: CanvasSegment) {
  if (segment.name === "Свободные деньги" || isSmallSlice(segment)) {
    return [{ startAngle: segment.startAngle, endAngle: segment.endAngle }];
  }

  return frontArcRanges(segment);
}

function isSmallSlice(segment: CanvasSegment) {
  return segment.endAngle - segment.startAngle < 0.78;
}

function visibleBoundaryStrength(segment: CanvasSegment, angle: number) {
  const front = Math.max(0, Math.sin(angle));
  const smallBoost = isSmallSlice(segment) ? 0.34 : 0;

  return Math.min(0.5, Math.max(0, front * 0.3 + smallBoost));
}

function shouldDrawRadialWall(segment: CanvasSegment, angle: number) {
  if (isSmallSlice(segment)) {
    return true;
  }

  if (segment.name === "Свободные деньги") {
    return Math.sin(angle) > -0.08 && Math.cos(angle) > 0;
  }

  if (segment.name === "Крипта") {
    return Math.sin(angle) > 0.12;
  }

  return false;
}

function strokeSliceTopEdge(ctx: CanvasRenderingContext2D, segment: CanvasSegment, compact: boolean) {
  const step = Math.PI / 90;

  ctx.beginPath();

  for (let angle = segment.startAngle; angle < segment.endAngle; angle += step) {
    const nextAngle = Math.min(angle + step, segment.endAngle);
    const midAngle = angle + (nextAngle - angle) / 2;

    if (!compact && Math.sin(midAngle) < -0.16) {
      continue;
    }

    const start = pointOnEllipse(angle);
    const end = pointOnEllipse(nextAngle);

    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  }
}

function strokeSliceLowerFrontEdge(
  ctx: CanvasRenderingContext2D,
  startAngle: number,
  endAngle: number,
  trim: number,
) {
  if (endAngle - startAngle <= trim * 2) {
    return;
  }

  ctx.beginPath();
  ctx.ellipse(
    PIE.cx,
    PIE.cy + PIE.depth,
    PIE.rx * 0.955,
    PIE.ry * 0.86,
    0,
    startAngle + trim,
    endAngle - trim,
    false,
  );
}

function strokeSliceBaseEdge(ctx: CanvasRenderingContext2D, startAngle: number, endAngle: number, trim: number) {
  if (endAngle - startAngle <= trim * 2) {
    return;
  }

  ctx.beginPath();
  ctx.ellipse(
    PIE.cx,
    PIE.cy + PIE.depth,
    PIE.rx * 0.955,
    PIE.ry * 0.86,
    0,
    startAngle + trim,
    endAngle - trim,
    false,
  );
}

function baseEdgeRanges(segment: CanvasSegment) {
  if (segment.name === "Свободные деньги") {
    return [];
  }

  if (isSmallSlice(segment)) {
    return [{ startAngle: segment.startAngle, endAngle: segment.endAngle }];
  }

  return frontArcRanges(segment);
}

function strokeOuterVerticalEdge(ctx: CanvasRenderingContext2D, angle: number) {
  const top = pointOnEllipse(angle);
  const bottom = lowerWallPoint(angle);

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
}

function drawSliceLayer(
  ctx: CanvasRenderingContext2D,
  segment: CanvasSegment,
  hovered: boolean,
  draw: () => void,
) {
  const { x, y } = sliceOffset(segment, hovered);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(x + PIE_X_SHIFT, y);
  draw();
  ctx.restore();
}

function drawSliceShadow(ctx: CanvasRenderingContext2D, segment: CanvasSegment, hovered: boolean) {
  drawSliceLayer(ctx, segment, hovered, () => {
    const color = renderColor(segment);
    const shadowMid = lowerWallPoint(segment.midAngle);
    const shadowRadius = isSmallSlice(segment) ? 28 : segment.name === "Крипта" ? 40 : 44;

    const shadow = ctx.createRadialGradient(
      shadowMid.x,
      shadowMid.y + 8,
      4,
      shadowMid.x,
      shadowMid.y + 10,
      shadowRadius,
    );
    shadow.addColorStop(0, rgba(color, hovered ? 0.18 : 0.08));
    shadow.addColorStop(0.42, "rgba(5, 16, 32, 0.12)");
    shadow.addColorStop(1, "rgba(2, 6, 23, 0)");

    ctx.save();
    ctx.filter = "blur(8px)";
    ctx.fillStyle = shadow;
    ctx.globalAlpha = hovered ? 0.36 : 0.22;
    ctx.beginPath();
    ctx.arc(shadowMid.x, shadowMid.y + 8, shadowRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

function drawSliceWalls(ctx: CanvasRenderingContext2D, segment: CanvasSegment, hovered: boolean) {
  drawSliceLayer(ctx, segment, hovered, () => {
    const color = renderColor(segment);
    const isCyan = segment.name === "Крипта";
    const isCash = segment.name === "Свободные деньги";
    const compact = isSmallSlice(segment);

    wallArcRanges(segment).forEach(({ startAngle, endAngle }) => {
      const wallSpan = endAngle - startAngle;
      const wallMid = startAngle + wallSpan / 2;
      const front = Math.max(0.18, Math.sin(wallMid));

      outerWallPath(ctx, startAngle, endAngle);
      const side = ctx.createLinearGradient(PIE.cx - 24, PIE.cy - 10, PIE.cx + 18, PIE.cy + PIE.depth + PIE.ry);
      side.addColorStop(0, rgba(color, hovered ? 0.78 : isCyan ? 0.66 : isCash ? 0.64 : compact ? 0.66 : 0.52));
      side.addColorStop(0.24, rgba(color, hovered ? 0.44 : isCyan ? 0.38 : isCash ? 0.36 : compact ? 0.38 : 0.26));
      side.addColorStop(0.52, isCash ? "rgba(1, 76, 42, 0.54)" : isCyan ? "rgba(3, 52, 72, 0.56)" : rgba(color, compact ? 0.22 : 0.16));
      side.addColorStop(0.78, "rgba(2, 13, 25, 0.5)");
      side.addColorStop(1, rgba(color, hovered ? 0.2 : isCyan ? 0.16 : isCash ? 0.18 : compact ? 0.18 : 0.09));

      ctx.globalAlpha = (isCyan ? 0.9 : isCash ? 0.88 : compact ? 0.92 : 0.82) + front * 0.06;
      ctx.fillStyle = side;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fill();
      ctx.globalAlpha = 1;

      ellipseArcPath(ctx, 0, 1, 1, startAngle, endAngle);
      ctx.strokeStyle = rgba(color, hovered ? 1 : isCyan ? 1 : isCash ? 0.98 : compact ? 0.98 : 0.9);
      ctx.lineWidth = hovered ? 3.45 : isCyan ? 2.9 : isCash ? 2.95 : compact ? 2.85 : 2.12;
      ctx.shadowColor = hovered ? segment.glow : rgba(color, isCyan ? 0.54 : isCash ? 0.58 : compact ? 0.56 : 0.34);
      ctx.shadowBlur = hovered ? 24 : isCyan ? 17 : isCash ? 19 : compact ? 18 : 10;
      ctx.stroke();

      if (front > 0.24 && !isCash) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        strokeSliceLowerFrontEdge(ctx, startAngle, endAngle, compact ? 0.02 : 0.055);
        ctx.strokeStyle = rgba(color, hovered ? 0.78 : isCyan ? 0.66 : isCash ? 0.68 : compact ? 0.7 : 0.42);
        ctx.lineWidth = hovered ? 1.65 : isCyan ? 1.34 : isCash ? 1.38 : compact ? 1.38 : 0.9;
        ctx.shadowColor = rgba(color, hovered ? 0.54 : compact ? 0.42 : isCash ? 0.4 : 0.28);
        ctx.shadowBlur = hovered ? 14 : compact ? 10 : isCash ? 10 : 6;
        ctx.stroke();
        ctx.restore();
      }

      ctx.shadowColor = segment.glow;
    });

    baseEdgeRanges(segment).forEach(({ startAngle, endAngle }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      strokeSliceBaseEdge(ctx, startAngle, endAngle, isCash ? 0.006 : compact ? 0.012 : 0.045);
      ctx.strokeStyle = rgba(color, hovered ? 0.9 : isCyan ? 0.7 : isCash ? 0.78 : compact ? 0.82 : 0.5);
      ctx.lineWidth = hovered ? 1.9 : isCyan ? 1.45 : isCash ? 1.55 : compact ? 1.58 : 0.96;
      ctx.shadowColor = rgba(color, hovered ? 0.64 : isCyan ? 0.44 : isCash ? 0.52 : compact ? 0.56 : 0.28);
      ctx.shadowBlur = hovered ? 16 : isCyan ? 10 : isCash ? 11 : compact ? 13 : 6;
      ctx.stroke();
      ctx.restore();
    });

    [segment.startAngle, segment.endAngle].forEach((angle) => {
      if (!shouldDrawRadialWall(segment, angle)) {
        return;
      }

      const strength = visibleBoundaryStrength(segment, angle);

      radialWallPath(ctx, angle);
      const wall = ctx.createLinearGradient(PIE.cx, PIE.cy - 2, PIE.cx, PIE.cy + PIE.depth + 12);
      wall.addColorStop(0, rgba(color, hovered ? 0.42 : compact ? 0.34 : isCash ? 0.28 : isCyan ? 0.3 : 0.22));
      wall.addColorStop(0.48, rgba(color, hovered ? 0.2 : compact ? 0.18 : isCash ? 0.13 : 0.1));
      wall.addColorStop(1, "rgba(2, 8, 22, 0.3)");
      ctx.fillStyle = wall;
      ctx.globalAlpha = hovered ? Math.min(0.4, strength + 0.08) : compact ? Math.min(0.46, strength + 0.04) : Math.min(0.3, strength);
      ctx.fill();
      ctx.globalAlpha = 1;

      const top = pointOnEllipse(angle);
      ctx.beginPath();
      ctx.moveTo(PIE.cx, PIE.cy);
      ctx.lineTo(top.x, top.y);
      ctx.strokeStyle = rgba(color, hovered ? 0.9 : compact ? 0.78 : isCash ? 0.62 : isCyan ? 0.58 : 0.42);
      ctx.lineWidth = hovered ? 1.55 : compact ? 1.35 : isCash ? 1.08 : 0.88;
      ctx.shadowColor = rgba(color, hovered ? 0.48 : compact ? 0.34 : 0.22);
      ctx.shadowBlur = hovered ? 10 : compact ? 7 : 4;
      ctx.stroke();

      if (Math.sin(angle) > -0.02 || compact || (isCash && Math.cos(angle) > 0)) {
        strokeOuterVerticalEdge(ctx, angle);
        ctx.strokeStyle = rgba(color, hovered ? 0.98 : compact ? 0.9 : isCash ? 0.86 : isCyan ? 0.72 : 0.52);
        ctx.lineWidth = hovered ? 2 : compact ? 1.62 : isCash ? 1.58 : 1.08;
        ctx.shadowColor = rgba(color, hovered ? 0.64 : compact ? 0.52 : isCash ? 0.46 : 0.32);
        ctx.shadowBlur = hovered ? 14 : compact ? 10 : isCash ? 10 : 6;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    });
  });
}

function drawSliceTop(ctx: CanvasRenderingContext2D, segment: CanvasSegment, hovered: boolean) {
  drawSliceLayer(ctx, segment, hovered, () => {
    const color = renderColor(segment);
    const isCyan = segment.name === "Крипта";
    const isCash = segment.name === "Свободные деньги";
    const compact = isSmallSlice(segment);

    sectorTopPath(ctx, segment);
    const top = ctx.createRadialGradient(PIE.cx - 62, PIE.cy - 64, 4, PIE.cx + 10, PIE.cy + 12, 134);
    top.addColorStop(0, isCash ? "rgba(238, 255, 244, 0.58)" : "rgba(255, 255, 255, 0.6)");
    top.addColorStop(0.16, rgba(color, hovered ? 0.94 : isCash ? 0.76 : isCyan ? 0.88 : compact ? 0.86 : 0.76));
    top.addColorStop(0.48, rgba(color, hovered ? 0.62 : isCyan ? 0.56 : isCash ? 0.48 : compact ? 0.52 : 0.4));
    top.addColorStop(0.78, rgba(color, hovered ? 0.34 : isCyan ? 0.26 : isCash ? 0.24 : compact ? 0.28 : 0.18));
    top.addColorStop(1, "rgba(2, 6, 23, 0.2)");

    ctx.fillStyle = top;
    ctx.shadowColor = hovered ? segment.glow : rgba(color, isCyan ? 0.38 : isCash ? 0.34 : compact ? 0.34 : 0.24);
    ctx.shadowBlur = hovered ? 24 : isCyan ? 17 : isCash ? 16 : compact ? 16 : 11;
    ctx.fill();

    sectorTopPath(ctx, segment);
    const sheen = ctx.createLinearGradient(PIE.cx - PIE.rx * 0.9, PIE.cy - PIE.ry, PIE.cx + PIE.rx * 0.9, PIE.cy + PIE.ry);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    sheen.addColorStop(0.32, "rgba(255, 255, 255, 0.055)");
    sheen.addColorStop(0.66, rgba(color, isCyan ? 0.22 : isCash ? 0.16 : compact ? 0.2 : 0.1));
    sheen.addColorStop(1, "rgba(255, 255, 255, 0.13)");
    ctx.fillStyle = sheen;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = hovered ? 0.6 : compact ? 0.56 : 0.42;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    strokeSliceTopEdge(ctx, segment, compact);
    ctx.strokeStyle = rgba(color, hovered ? 1 : isCyan ? 1 : isCash ? 1 : compact ? 1 : 0.92);
    ctx.lineWidth = hovered ? 4 : isCyan ? 3.4 : isCash ? 3.3 : compact ? 3.25 : 2.55;
    ctx.shadowColor = segment.glow;
    ctx.shadowBlur = hovered ? 30 : isCyan ? 22 : isCash ? 22 : compact ? 22 : 16;
    ctx.stroke();

    if (compact) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      [segment.startAngle, segment.endAngle].forEach((angle) => {
        const edge = pointOnEllipse(angle);
        ctx.beginPath();
        ctx.moveTo(PIE.cx, PIE.cy);
        ctx.lineTo(edge.x, edge.y);
        ctx.strokeStyle = rgba(color, hovered ? 0.95 : 0.72);
        ctx.lineWidth = hovered ? 1.35 : 0.96;
        ctx.shadowColor = rgba(color, hovered ? 0.48 : 0.32);
        ctx.shadowBlur = hovered ? 9 : 6;
        ctx.stroke();
      });
      ctx.restore();
    }
  });
}

function drawSlice(ctx: CanvasRenderingContext2D, segment: CanvasSegment, hovered: boolean) {
  drawSliceShadow(ctx, segment, hovered);
  drawSliceWalls(ctx, segment, hovered);
  drawSliceTop(ctx, segment, hovered);
}

function sortByDepth(segments: CanvasSegment[]) {
  return [...segments].sort((a, b) => Math.sin(a.midAngle) - Math.sin(b.midAngle));
}

function drawHudGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "rgba(91, 214, 255, 0.42)";
  ctx.lineWidth = 0.7;
  ctx.setLineDash([6, 9]);
  ctx.beginPath();
  ctx.moveTo(PIE.cx, 20);
  ctx.lineTo(PIE.cx, 226);
  ctx.moveTo(28, PIE.cy);
  ctx.lineTo(304, PIE.cy);
  ctx.stroke();
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  segments: CanvasSegment[],
  hoveredIndex: number | null,
) {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawHudGrid(ctx);
  // PATCH 3.8: portal rendering is intentionally disabled while the pie is isolated for visual polish.

  const depthSortedSegments = sortByDepth(segments);

  depthSortedSegments.forEach((segment) => {
    drawSliceShadow(ctx, segment, false);
  });

  depthSortedSegments.forEach((segment) => {
    const index = segments.indexOf(segment);

    if (index !== hoveredIndex) {
      drawSliceWalls(ctx, segment, false);
      drawSliceTop(ctx, segment, false);
    }
  });

  if (hoveredIndex !== null && segments[hoveredIndex]) {
    drawSlice(ctx, segments[hoveredIndex], true);
  }
}

function getHoveredSegment(
  canvas: HTMLCanvasElement,
  event: PointerEvent<HTMLCanvasElement>,
  segments: CanvasSegment[],
) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  const normalizedX = (x - PIE_X_SHIFT - PIE.cx) / PIE.rx;
  const normalizedY = (y - PIE.cy) / PIE.ry;
  const radius = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);

  if (radius > 1.08 || y > PIE.cy + PIE.depth + PIE.ry * 0.62) {
    return null;
  }

  const rawAngle = Math.atan2(normalizedY, normalizedX);

  return segments.findIndex((segment) => {
    let angle = rawAngle;

    while (angle < segment.startAngle) {
      angle += Math.PI * 2;
    }

    return angle >= segment.startAngle && angle <= segment.endAngle;
  });
}

export function HologramAllocationChart({ categories }: HologramAllocationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const segments = useMemo(() => buildSegments(categories), [categories]);
  const total = segments.reduce((sum, item) => sum + Number(item.value || 0), 0);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    let animationFrame = 0;
    let mounted = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(ratio * (rect.width / CANVAS_WIDTH), 0, 0, ratio * (rect.height / CANVAS_HEIGHT), 0, 0);
      }
    };

    const render = () => {
      if (!mounted) {
        return;
      }

      drawCanvas(canvas, segments, hoveredIndex);
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      mounted = false;
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [hoveredIndex, segments]);

  return (
    <Panel tone="yellow" className="p-6 h-full hologram-allocation-panel" hover>
      <div className="allocation-header holo-allocation-header">
        <div>
          <div className="section-kicker allocation-kicker text-yellow-300">Allocation</div>
          <div className="section-title">Распределение средств</div>
        </div>
      </div>

      <div className="holo-allocation-layout">
        <div className="holo-chart-stage" aria-label="Динамическое распределение активов">
          <div className="holo-chart-hud holo-chart-hud-left">
            <span>DATA FLOW</span>
            <strong>SYS. ONLINE</strong>
          </div>
          <div className="holo-chart-hud holo-chart-hud-right">
            <span>{segments.length} CATEGORIES</span>
            <strong>BALANCE</strong>
          </div>
          <div className="holo-total-strip">
            <span>Total</span>
            <strong>{currency(total)}</strong>
          </div>
          <div className="holo-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="holo-canvas"
              aria-label="Hologram allocation diagram"
              onPointerLeave={() => setHoveredIndex(null)}
              onPointerMove={(event) => {
                const canvas = canvasRef.current;
                const index = canvas ? getHoveredSegment(canvas, event, segments) : null;
                const nextIndex = index === null || index < 0 ? null : index;

                setHoveredIndex(nextIndex);
              }}
            />
          </div>
        </div>

        <div className="holo-allocation-list">
          {segments.map((item) => (
            <div key={item.name} className="holo-allocation-card">
              <div className="holo-card-main">
                <div className="holo-card-dot" style={{ backgroundColor: item.color, boxShadow: `0 0 18px ${item.glow}` }} />
                <div className="holo-card-name-wrap">
                  <div className="holo-card-name">{item.name}</div>
                  <div className="holo-card-value">{currency(item.value)}</div>
                </div>
                <div className="holo-card-share">{formatShare(item.share)}</div>
              </div>
              <div className="holo-card-progress">
                <span
                  style={{
                    width: `${Math.min(Math.max(Math.abs(Number(item.share || 0)) <= 1 ? Number(item.share || 0) * 100 : Number(item.share || 0), 0), 100)}%`,
                    backgroundColor: item.color,
                    boxShadow: `0 0 14px ${item.glow}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
