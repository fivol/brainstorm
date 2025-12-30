import * as d3 from 'd3';
import { getRectEdgePoint } from '../utils/geometry';

/**
 * Edge rendering utilities.
 * Creates smooth curved paths between nodes.
 */

/**
 * Generate a smooth curved path between two nodes.
 * @param {Object} source - Source node {x, y, w, h}
 * @param {Object} target - Target node {x, y, w, h}
 * @returns {string} SVG path d attribute
 */
export function generateEdgePath(source, target) {
  // Get edge attachment points on node boundaries
  const start = getRectEdgePoint(source.x, source.y, target.x, target.y, source.w, source.h);
  const end = getRectEdgePoint(target.x, target.y, source.x, source.y, target.w, target.h);
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate control points for smooth curve
  // Curve amount based on distance
  const curveAmount = Math.min(dist * 0.3, 50);
  
  // Perpendicular offset for curve
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  // Slight perpendicular offset for visual interest
  const perpX = -dy / dist * curveAmount * 0.2;
  const perpY = dx / dist * curveAmount * 0.2;
  
  // Control point at midpoint with slight offset
  const cp1x = midX + perpX;
  const cp1y = midY + perpY;
  
  // Use quadratic bezier for simple curves
  return `M ${start.x} ${start.y} Q ${cp1x} ${cp1y} ${end.x} ${end.y}`;
}

/**
 * Generate a more complex S-curve path (for avoiding obstacles).
 * @param {Object} source
 * @param {Object} target
 * @param {Array} [controlPoints] - Intermediate control points
 * @returns {string}
 */
export function generateComplexEdgePath(source, target, controlPoints = []) {
  const start = getRectEdgePoint(source.x, source.y, target.x, target.y, source.w, source.h);
  const end = getRectEdgePoint(target.x, target.y, source.x, source.y, target.w, target.h);
  
  if (controlPoints.length === 0) {
    return generateEdgePath(source, target);
  }
  
  // Build path through control points
  const points = [start, ...controlPoints, end];
  
  // Use D3 curve generator for smooth path
  const lineGenerator = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveBasis);
  
  return lineGenerator(points);
}

/**
 * Get the midpoint of an edge path for label positioning.
 * @param {Object} source
 * @param {Object} target
 * @returns {{x: number, y: number}}
 */
export function getEdgeMidpoint(source, target) {
  const start = getRectEdgePoint(source.x, source.y, target.x, target.y, source.w, source.h);
  const end = getRectEdgePoint(target.x, target.y, source.x, source.y, target.w, target.h);
  
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
}

/**
 * Create SVG marker definition for arrowheads.
 * @param {SVGDefsElement} defs - SVG defs element
 */
export function createArrowMarker(defs) {
  const markerId = 'arrowhead';
  
  // Check if already exists
  if (defs.querySelector(`#${markerId}`)) return;
  
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', 'var(--edge-color, #666)');
  
  marker.appendChild(path);
  defs.appendChild(marker);
  
  // Selected arrow marker
  const selectedMarker = marker.cloneNode(true);
  selectedMarker.setAttribute('id', 'arrowhead-selected');
  selectedMarker.querySelector('path').setAttribute('fill', 'var(--edge-selected-color, #2196f3)');
  defs.appendChild(selectedMarker);
}

/**
 * Calculate if a point is near an edge path.
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {Object} source
 * @param {Object} target
 * @param {number} [threshold=10]
 * @returns {boolean}
 */
export function isPointNearEdge(px, py, source, target, threshold = 10) {
  const start = getRectEdgePoint(source.x, source.y, target.x, target.y, source.w, source.h);
  const end = getRectEdgePoint(target.x, target.y, source.x, source.y, target.w, target.h);
  
  // Simple line distance check
  const A = px - start.x;
  const B = py - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let nearestX, nearestY;
  
  if (param < 0) {
    nearestX = start.x;
    nearestY = start.y;
  } else if (param > 1) {
    nearestX = end.x;
    nearestY = end.y;
  } else {
    nearestX = start.x + param * C;
    nearestY = start.y + param * D;
  }
  
  const dx = px - nearestX;
  const dy = py - nearestY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance <= threshold;
}
