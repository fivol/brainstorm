/**
 * Geometry utilities for node positioning and edge routing.
 */

/**
 * Calculate distance between two points.
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Check if a point is inside a rectangle.
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} rx - Rectangle X (center)
 * @param {number} ry - Rectangle Y (center)
 * @param {number} rw - Rectangle width
 * @param {number} rh - Rectangle height
 * @returns {boolean}
 */
export function pointInRect(px, py, rx, ry, rw, rh) {
  const halfW = rw / 2;
  const halfH = rh / 2;
  return px >= rx - halfW && px <= rx + halfW && py >= ry - halfH && py <= ry + halfH;
}

/**
 * Check if two rectangles intersect.
 * @param {Object} r1 - First rectangle {x, y, w, h} (center-based)
 * @param {Object} r2 - Second rectangle {x, y, w, h} (center-based)
 * @returns {boolean}
 */
export function rectsIntersect(r1, r2) {
  return Math.abs(r1.x - r2.x) < (r1.w + r2.w) / 2 &&
         Math.abs(r1.y - r2.y) < (r1.h + r2.h) / 2;
}

/**
 * Find intersection point of a line from center to target with rectangle boundary.
 * Used for edge attachment points.
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} tx - Target X
 * @param {number} ty - Target Y
 * @param {number} w - Rectangle width
 * @param {number} h - Rectangle height
 * @param {number} [padding=4] - Padding from edge
 * @returns {{x: number, y: number}}
 */
export function getRectEdgePoint(cx, cy, tx, ty, w, h, padding = 4) {
  const dx = tx - cx;
  const dy = ty - cy;
  
  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }
  
  const halfW = w / 2 + padding;
  const halfH = h / 2 + padding;
  
  // Calculate intersection with each edge
  const angle = Math.atan2(dy, dx);
  const tan = Math.tan(angle);
  
  let x, y;
  
  // Check which edge is hit based on angle
  const cornerAngle = Math.atan2(halfH, halfW);
  const absAngle = Math.abs(angle);
  
  if (absAngle < cornerAngle || absAngle > Math.PI - cornerAngle) {
    // Right or left edge
    x = dx > 0 ? halfW : -halfW;
    y = x * tan;
    // Clamp y
    y = Math.max(-halfH, Math.min(halfH, y));
  } else {
    // Top or bottom edge
    y = dy > 0 ? halfH : -halfH;
    x = y / tan;
    // Clamp x
    x = Math.max(-halfW, Math.min(halfW, x));
  }
  
  return { x: cx + x, y: cy + y };
}

/**
 * Calculate approximate direction from one node to another.
 * Returns one of 8 directions.
 * @param {number} fromX 
 * @param {number} fromY 
 * @param {number} toX 
 * @param {number} toY 
 * @returns {'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'}
 */
export function getDirection(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  // Convert to 8 sectors (each 45 degrees)
  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'down-right';
  if (angle >= 67.5 && angle < 112.5) return 'down';
  if (angle >= 112.5 && angle < 157.5) return 'down-left';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'up-left';
  if (angle >= -112.5 && angle < -67.5) return 'up';
  return 'up-right';
}

/**
 * Map arrow key to direction.
 * @param {string} key - Arrow key name
 * @returns {'up' | 'down' | 'left' | 'right' | null}
 */
export function arrowKeyToDirection(key) {
  switch (key) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    default: return null;
  }
}

/**
 * Find the best matching direction from available directions.
 * @param {string} targetDir - Target direction
 * @param {Array<{dir: string, node: Object}>} candidates - Available candidates with direction
 * @returns {Object | null}
 */
export function findBestDirectionMatch(targetDir, candidates) {
  if (candidates.length === 0) return null;
  
  const directionOrder = {
    up: ['up', 'up-left', 'up-right'],
    down: ['down', 'down-left', 'down-right'],
    left: ['left', 'up-left', 'down-left'],
    right: ['right', 'up-right', 'down-right']
  };
  
  const preferred = directionOrder[targetDir] || [targetDir];
  
  for (const dir of preferred) {
    const match = candidates.find(c => c.dir === dir);
    if (match) return match.node;
  }
  
  // Return closest if no directional match
  return candidates[0]?.node || null;
}

/**
 * Clamp a value between min and max.
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation.
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
