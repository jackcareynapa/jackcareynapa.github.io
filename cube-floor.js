(function () {
  'use strict';

  const canvas = document.getElementById('cube-floor');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const lowQuality = isSafari || coarsePointer;

  if (lowQuality) {
    document.documentElement.classList.add('reduced-fx');
  }

  const TILE_W = 48;
  const TILE_H = 24;
  const WAVE_RADIUS_PX = 130;
  const PULSE_RADIUS_PX = WAVE_RADIUS_PX * 1.5;
  const PULSE_MS = 400;
  const FOOTPRINT_PAD = 4;
  const MAX_LIFT = reducedMotion ? 0 : (coarsePointer ? 8 : 10);
  const LERP = reducedMotion ? 1 : 0.14;
  const GRID_MARGIN = lowQuality ? 1.1 : 1.4;
  const SIDE_LIFT_MIN = lowQuality ? 2 : 0.5;
  const BUCKET_SIZE = TILE_W;

  let BASE = { r: 247, g: 245, b: 250 };
  let BG = '#f7f5fa';
  let accent = '#a855f7';
  let tiles = [];
  let spatialBuckets = new Map();
  let offsetX = 0;
  let offsetY = 0;
  let pointerX = -1;
  let pointerY = -1;
  let animating = false;
  let lastWaveTiles = [];
  let activeTiles = new Set();
  let footprintRects = [];
  let cachedOverSurface = null;
  let lastPointerQueryX = -9999;
  let lastPointerQueryY = -9999;
  let pulseUntil = 0;
  let pulseOrigin = null;

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight,
    };
  }

  function parseCssColor(value) {
    const fallback = { r: 247, g: 245, b: 250, hex: '#f7f5fa' };
    if (!value) return fallback;
    const raw = value.trim();
    if (raw.startsWith('#')) {
      const h = raw.slice(1);
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      if (full.length === 6) {
        return {
          r: parseInt(full.slice(0, 2), 16),
          g: parseInt(full.slice(2, 4), 16),
          b: parseInt(full.slice(4, 6), 16),
          hex: `#${full}`,
        };
      }
    }
    return fallback;
  }

  function readColorsFromCss() {
    const styles = getComputedStyle(document.documentElement);
    accent = styles.getPropertyValue('--accent').trim() || accent;
    const bg = parseCssColor(styles.getPropertyValue('--bg').trim());
    BASE = { r: bg.r, g: bg.g, b: bg.b };
    BG = bg.hex;
  }

  function hash(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function noise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function tileCenter(col, row, elevation) {
    return {
      x: offsetX + (col - row) * (TILE_W / 2),
      y: offsetY + (col + row) * (TILE_H / 2) - elevation,
    };
  }

  function tileTopPoints(cx, cy) {
    return [
      { x: cx, y: cy - TILE_H },
      { x: cx + TILE_W / 2, y: cy },
      { x: cx, y: cy + TILE_H },
      { x: cx - TILE_W / 2, y: cy },
    ];
  }

  function elevationIntensity(elevation) {
    return MAX_LIFT > 0 ? Math.min(1, elevation / MAX_LIFT) : 0;
  }

  function waveFalloff(normalizedDist) {
    if (normalizedDist >= 1) return 0;
    const t = 1 - normalizedDist;
    return t * t * (3 - 2 * t);
  }

  function nearestPointOnRect(px, py, rect) {
    return {
      x: Math.max(rect.left, Math.min(px, rect.right)),
      y: Math.max(rect.top, Math.min(py, rect.bottom)),
    };
  }

  function refreshFootprints() {
    footprintRects = [];
    document.querySelectorAll('.surface-hover').forEach((el) => {
      footprintRects.push(el.getBoundingClientRect());
    });
  }

  function isInsideFootprint(tx, ty) {
    for (const rect of footprintRects) {
      if (
        tx >= rect.left - FOOTPRINT_PAD &&
        tx <= rect.right + FOOTPRINT_PAD &&
        ty >= rect.top - FOOTPRINT_PAD &&
        ty <= rect.bottom + FOOTPRINT_PAD
      ) {
        return true;
      }
    }
    return false;
  }

  function refreshPointerHit() {
    if (pointerX === lastPointerQueryX && pointerY === lastPointerQueryY) return;
    lastPointerQueryX = pointerX;
    lastPointerQueryY = pointerY;
    if (pointerX < 0) {
      cachedOverSurface = null;
      return;
    }
    const hit = document.elementFromPoint(pointerX, pointerY);
    cachedOverSurface = hit && hit.closest('.surface-hover');
  }

  function getWaveOrigin() {
    if (pointerX < 0) return { x: 0, y: 0 };
    if (cachedOverSurface) {
      const rect = cachedOverSurface.getBoundingClientRect();
      return nearestPointOnRect(pointerX, pointerY, rect);
    }
    return { x: pointerX, y: pointerY };
  }

  function buildSpatialIndex() {
    spatialBuckets.clear();
    for (const tile of tiles) {
      const { x, y } = tileCenter(tile.col, tile.row, 0);
      const key = `${Math.floor(x / BUCKET_SIZE)},${Math.floor(y / BUCKET_SIZE)}`;
      if (!spatialBuckets.has(key)) spatialBuckets.set(key, []);
      spatialBuckets.get(key).push(tile);
    }
  }

  function applyWaveAt(originX, originY, radiusPx, outTiles) {
    const radiusSq = radiusPx * radiusPx;
    const minBx = Math.floor((originX - radiusPx) / BUCKET_SIZE);
    const maxBx = Math.floor((originX + radiusPx) / BUCKET_SIZE);
    const minBy = Math.floor((originY - radiusPx) / BUCKET_SIZE);
    const maxBy = Math.floor((originY + radiusPx) / BUCKET_SIZE);

    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        const bucket = spatialBuckets.get(`${bx},${by}`);
        if (!bucket) continue;
        for (const tile of bucket) {
          const { x, y } = tileCenter(tile.col, tile.row, 0);
          if (isInsideFootprint(x, y)) continue;
          const dx = originX - x;
          const dy = originY - y;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;
          const dist = Math.sqrt(distSq);
          const lift = MAX_LIFT * waveFalloff(dist / radiusPx);
          if (lift > tile.targetElevation) {
            tile.targetElevation = lift;
            outTiles.push(tile);
          }
        }
      }
    }
  }

  function shadeColor(baseShade, elevation, intensity) {
    const noiseOffset = (baseShade - 0.5) * 10;
    const liftBright = elevation * 1.2;
    const glowBright = intensity * 10;
    const v = Math.min(255, Math.max(0, BASE.r + noiseOffset + liftBright + glowBright));
    const g = Math.min(255, Math.max(0, BASE.g + noiseOffset + liftBright + glowBright));
    const b = Math.min(255, Math.max(0, BASE.b + noiseOffset + liftBright + glowBright));
    return `rgb(${v | 0},${g | 0},${b | 0})`;
  }

  function sideColor(baseShade, darken) {
    const noiseOffset = (baseShade - 0.5) * 8;
    const v = Math.max(0, BASE.r + noiseOffset - darken);
    const g = Math.max(0, BASE.g + noiseOffset - darken);
    const b = Math.max(0, BASE.b + noiseOffset - darken);
    return `rgb(${v | 0},${g | 0},${b | 0})`;
  }

  function drawPolygon(points, fill, stroke, glowIntensity) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.save();
      if (glowIntensity > 0.02) {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.25 + glowIntensity * 0.55;
        ctx.lineWidth = 0.6 + glowIntensity * 1.2;
      } else {
        ctx.strokeStyle = stroke;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTile(tile) {
    const intensity = elevationIntensity(tile.elevation);
    const { x: cx, y: cy } = tileCenter(tile.col, tile.row, tile.elevation);
    const top = tileTopPoints(cx, cy);
    const elev = tile.elevation;

    if (elev > SIDE_LIFT_MIN) {
      const bottom = tileTopPoints(cx, cy + elev);
      drawPolygon([top[3], top[0], bottom[0], bottom[3]], sideColor(tile.baseShade, 18), null, 0);
      drawPolygon([top[2], top[1], bottom[1], bottom[2]], sideColor(tile.baseShade, 28), null, 0);
    }

    const fill = shadeColor(tile.baseShade, tile.elevation, intensity);
    const stroke = `rgba(12,12,15,${0.04 + tile.baseShade * 0.015})`;
    const glowIntensity = !reducedMotion && MAX_LIFT > 0 ? intensity : 0;
    drawPolygon(top, fill, stroke, glowIntensity);
  }

  function computeExtent(w, h) {
    const reachX = (w / 2 + TILE_W / 2 + MAX_LIFT) / (TILE_W / 2);
    const reachY = (h / 2 + TILE_H * 3 + MAX_LIFT) / (TILE_H / 2);
    return Math.ceil(Math.max(reachX, reachY) * GRID_MARGIN);
  }

  function buildGrid() {
    readColorsFromCss();
    let dpr = window.devicePixelRatio || 1;
    if (lowQuality) dpr = Math.min(dpr, 2);
    const { w, h } = viewportSize();

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const extent = computeExtent(w, h);
    offsetX = w / 2;
    offsetY = h / 2 + TILE_H;

    tiles = [];
    lastWaveTiles = [];
    activeTiles.clear();
    for (let r = -extent; r <= extent; r++) {
      for (let c = -extent; c <= extent; c++) {
        tiles.push({
          col: c,
          row: r,
          baseShade: noise2D(c * 0.35, r * 0.35),
          elevation: 0,
          targetElevation: 0,
        });
      }
    }
    tiles.sort((a, b) => a.col + a.row - (b.col + b.row));
    buildSpatialIndex();
    refreshFootprints();
  }

  function updateHover() {
    for (const tile of lastWaveTiles) {
      tile.targetElevation = 0;
      activeTiles.add(tile);
    }
    lastWaveTiles = [];

    if (pointerX < 0 || MAX_LIFT <= 0) return;

    refreshPointerHit();
    const origin = getWaveOrigin();
    applyWaveAt(origin.x, origin.y, WAVE_RADIUS_PX, lastWaveTiles);

    if (pulseUntil > performance.now() && pulseOrigin) {
      const pulseStrength = (pulseUntil - performance.now()) / PULSE_MS;
      applyWaveAt(
        pulseOrigin.x,
        pulseOrigin.y,
        PULSE_RADIUS_PX * pulseStrength,
        lastWaveTiles
      );
    }

    for (const tile of lastWaveTiles) {
      activeTiles.add(tile);
    }
  }

  function tickAnimations() {
    let needsFrame = false;
    const settled = [];

    for (const tile of activeTiles) {
      const diff = tile.targetElevation - tile.elevation;
      if (Math.abs(diff) > 0.1) {
        tile.elevation += diff * LERP;
        needsFrame = true;
      } else if (tile.elevation !== tile.targetElevation) {
        tile.elevation = tile.targetElevation;
        needsFrame = true;
      }
      if (tile.elevation < 0.05 && tile.targetElevation < 0.05) {
        settled.push(tile);
      }
    }

    for (const tile of settled) {
      activeTiles.delete(tile);
    }

    if (pulseUntil > performance.now()) {
      needsFrame = true;
    }

    return needsFrame;
  }

  function render() {
    const { w, h } = viewportSize();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    for (const tile of tiles) {
      drawTile(tile);
    }
  }

  function frame() {
    updateHover();
    const moving = tickAnimations();

    if (moving) {
      render();
      requestAnimationFrame(frame);
    } else {
      animating = false;
    }
  }

  function requestFrame() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(frame);
    }
  }

  function onPointerMove(e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
    lastPointerQueryX = -9999;
    requestFrame();
  }

  function onPointerLeave() {
    pointerX = -1;
    pointerY = -1;
    lastPointerQueryX = -9999;
    cachedOverSurface = null;
    requestFrame();
  }

  function onTouchStart(e) {
    if (!e.touches.length) return;
    pointerX = e.touches[0].clientX;
    pointerY = e.touches[0].clientY;
    lastPointerQueryX = -9999;
    requestFrame();
  }

  function onTouchEnd() {
    pointerX = -1;
    pointerY = -1;
    lastPointerQueryX = -9999;
    cachedOverSurface = null;
    requestFrame();
  }

  function onScroll() {
    refreshFootprints();
    lastPointerQueryX = -9999;
    updateHover();
    render();
    requestFrame();
  }

  function onSurfaceEnter(e) {
    if (reducedMotion || MAX_LIFT <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pulseOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    pulseUntil = performance.now() + PULSE_MS;
    requestFrame();
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      readColorsFromCss();
      buildGrid();
      render();
      requestFrame();
    }, 150);
  }

  function bindSurfacePulse() {
    document.querySelectorAll('.surface-hover:not([data-pulse-bound])').forEach((el) => {
      el.setAttribute('data-pulse-bound', '');
      el.addEventListener('mouseenter', onSurfaceEnter);
    });
  }

  readColorsFromCss();
  buildGrid();
  render();
  bindSurfacePulse();

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseleave', onPointerLeave);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  window.CubeFloor = {
    refreshFootprints,
    bindSurfacePulse,
    onScroll,
  };
})();
