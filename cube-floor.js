/* ═══════════════════════════════════════════════════════════════════════
   The press floor.

   An isometric field of ink dots. The wave physics are unchanged from the
   original cube grid — spatial buckets, smoothstep falloff, footprint
   occlusion — but `elevation` no longer means height. It means ink
   coverage: how wide each diamond opens. Push the pointer across the sheet
   and the screen gains, exactly the way a cheap duplicator does. Where type
   sits, the ink is knocked out.
   ═══════════════════════════════════════════════════════════════════════ */

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

  const TILE_W = 38;
  const TILE_H = 19;
  const WAVE_RADIUS_PX = 170;
  const FOOTPRINT_PAD = 14;
  const MAX_LIFT = reducedMotion ? 0 : 10;   // peak coverage, in arbitrary units
  const LERP = reducedMotion ? 1 : 0.16;
  const GRID_MARGIN = lowQuality ? 1.1 : 1.2;
  const BUCKET_SIZE = TILE_W;

  /* Ink. Coverage is carried by dot size, not alpha, so each pass is a
     single path and a single fill. */
  const REST_COVER = 0.24;
  /* Capped well below 1 so neighbouring dots never touch. A halftone that
     floods to solid stops being a halftone and starts being a blob. */
  const MAX_COVER = 0.58;
  const KNOCKOUT = 0.34;   // ink left under a block of type
  const INK_ALPHA = 0.22;
  const PINK_ALPHA = 0.14;  // a fringe, not a second colour
  const MISREG_X = 3;
  const MISREG_Y = -2.5;
  const JITTER = 2.6;      // the screen was not laid out by a machine

  let STOCK = '#DEDAD0';
  let BLUE = '#2440C4';
  let PINK = '#FF4FA3';
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

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: vv ? vv.width : window.innerWidth,
      h: vv ? vv.height : window.innerHeight,
    };
  }

  function readColorsFromCss() {
    const styles = getComputedStyle(document.documentElement);
    STOCK = styles.getPropertyValue('--stock').trim() || STOCK;
    BLUE = styles.getPropertyValue('--blue').trim() || BLUE;
    PINK = styles.getPropertyValue('--pink').trim() || PINK;
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

  function tileCenter(col, row) {
    return {
      x: offsetX + (col - row) * (TILE_W / 2),
      y: offsetY + (col + row) * (TILE_H / 2),
    };
  }

  function coverageIntensity(elevation) {
    return MAX_LIFT > 0 ? Math.min(1, elevation / MAX_LIFT) : 0;
  }

  /* Rest coverage varies with the noise field so the screen looks bitten,
     not machine-perfect. */
  function restScale(tile) {
    return REST_COVER * (0.25 + tile.baseShade * 1.5);
  }

  function tileScale(tile, intensity) {
    const rest = restScale(tile);
    return rest + (MAX_COVER - rest) * intensity;
  }

  function waveFalloff(normalizedDist) {
    if (normalizedDist >= 1) return 0;
    const t = 1 - normalizedDist;
    return t * t * (3 - 2 * t);
  }

  /* Outside the block, the closest point on its edge. Inside it, the closest
     way *out* — so reading a paragraph squeezes ink from under the type
     instead of killing the wave entirely. */
  function nearestPointOnRect(px, py, rect) {
    const cx = Math.max(rect.left, Math.min(px, rect.right));
    const cy = Math.max(rect.top, Math.min(py, rect.bottom));
    if (cx !== px || cy !== py) return { x: cx, y: cy };

    const dl = px - rect.left;
    const dr = rect.right - px;
    const dt = py - rect.top;
    const db = rect.bottom - py;
    const nearest = Math.min(dl, dr, dt, db);

    if (nearest === dl) return { x: rect.left, y: py };
    if (nearest === dr) return { x: rect.right, y: py };
    if (nearest === dt) return { x: px, y: rect.top };
    return { x: px, y: rect.bottom };
  }

  function refreshFootprints() {
    footprintRects = [];
    document.querySelectorAll('.occludes').forEach((el) => {
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
    cachedOverSurface = hit && hit.closest('.occludes');
  }

  /* Over a block of type the wave slides to the block's edge, so ink pools
     against the knockout instead of vanishing under it. */
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
      const { x, y } = tileCenter(tile.col, tile.row);
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
          const { x, y } = tileCenter(tile.col, tile.row);
          if (isInsideFootprint(x, y)) continue;
          const dx = originX - x;
          const dy = originY - y;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;
          const lift = MAX_LIFT * waveFalloff(Math.sqrt(distSq) / radiusPx);
          if (lift > tile.targetElevation) {
            tile.targetElevation = lift;
            outTiles.push(tile);
          }
        }
      }
    }
  }

  function addDiamond(cx, cy, scale) {
    const hw = (TILE_W / 2) * scale;
    const hh = TILE_H * scale;
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
  }

  function computeExtent(w, h) {
    const reachX = (w / 2 + TILE_W) / (TILE_W / 2);
    const reachY = (h / 2 + TILE_H * 3) / (TILE_H / 2);
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
          jx: (hash(c, r) - 0.5) * JITTER,
          jy: (hash(r, c) - 0.5) * JITTER * 0.6,
          elevation: 0,
          targetElevation: 0,
        });
      }
    }
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

    return needsFrame;
  }

  function render() {
    const { w, h } = viewportSize();

    ctx.globalAlpha = 1;
    ctx.fillStyle = STOCK;
    ctx.fillRect(0, 0, w, h);

    const padX = TILE_W;
    const padY = TILE_H * 2;

    // Ink pass: every visible dot, one path, one fill.
    ctx.globalAlpha = INK_ALPHA;
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    for (const tile of tiles) {
      const { x, y } = tileCenter(tile.col, tile.row);
      if (x < -padX || x > w + padX || y < -padY || y > h + padY) continue;
      // Under type the screen thins out rather than stopping dead — a hard
      // rectangular void reads as a bug, a pale one reads as a knockout.
      const scale = isInsideFootprint(x, y)
        ? restScale(tile) * KNOCKOUT
        : tileScale(tile, coverageIntensity(tile.elevation));
      addDiamond(x + tile.jx, y + tile.jy, scale);
    }
    ctx.fill();

    // Second impression: pink, off register, only where ink is moving.
    if (activeTiles.size) {
      ctx.globalAlpha = PINK_ALPHA;
      ctx.fillStyle = PINK;
      ctx.beginPath();
      for (const tile of activeTiles) {
        const intensity = coverageIntensity(tile.elevation);
        if (intensity < 0.06) continue;
        const { x, y } = tileCenter(tile.col, tile.row);
        if (isInsideFootprint(x, y)) continue;
        addDiamond(x + tile.jx + MISREG_X, y + tile.jy + MISREG_Y, tileScale(tile, intensity) * 0.7);
      }
      ctx.fill();
    }

    ctx.globalAlpha = 1;
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

  function onScroll() {
    refreshFootprints();
    lastPointerQueryX = -9999;
    updateHover();
    render();
    requestFrame();
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildGrid();
      render();
      requestFrame();
    }, 150);
  }

  readColorsFromCss();
  buildGrid();
  render();

  // Web fonts land after first paint and reflow the type, which moves every
  // knockout. Re-measure once the sheet has settled.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      refreshFootprints();
      render();
    });
  }

  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseleave', onPointerLeave);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onPointerLeave, { passive: true });
  window.addEventListener('touchcancel', onPointerLeave, { passive: true });
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  window.CubeFloor = { refreshFootprints, onScroll, render };
})();
