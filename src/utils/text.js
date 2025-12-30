/**
 * Text measurement and processing utilities.
 */

// Cache for text measurements
const measurementCache = new Map();
let measureCanvas = null;
let measureContext = null;

/**
 * Get or create measurement canvas.
 * @returns {CanvasRenderingContext2D}
 */
function getMeasureContext() {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
  }
  return measureContext;
}

/**
 * Measure text dimensions.
 * @param {string} text - Text to measure
 * @param {string} [font='14px system-ui, -apple-system, sans-serif'] - Font string
 * @param {number} [maxWidth=200] - Max width for wrapping
 * @returns {{width: number, height: number, lines: string[]}}
 */
export function measureText(text, font = '14px system-ui, -apple-system, sans-serif', maxWidth = 200) {
  const cacheKey = `${text}|${font}|${maxWidth}`;
  if (measurementCache.has(cacheKey)) {
    return measurementCache.get(cacheKey);
  }
  
  const ctx = getMeasureContext();
  ctx.font = font;
  
  const lineHeight = 20;
  const lines = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    
    const words = paragraph.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  
  if (lines.length === 0) {
    lines.push('');
  }
  
  const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const result = {
    width: Math.min(maxLineWidth, maxWidth),
    height: lines.length * lineHeight,
    lines
  };
  
  // Limit cache size
  if (measurementCache.size > 500) {
    const firstKey = measurementCache.keys().next().value;
    measurementCache.delete(firstKey);
  }
  
  measurementCache.set(cacheKey, result);
  return result;
}

/**
 * Clear measurement cache.
 */
export function clearMeasurementCache() {
  measurementCache.clear();
}

/**
 * Truncate text to fit within max lines.
 * @param {string} text - Text to truncate
 * @param {number} maxLines - Maximum lines
 * @param {string} [font] - Font string
 * @param {number} [maxWidth] - Max width
 * @returns {{text: string, truncated: boolean}}
 */
export function truncateText(text, maxLines, font, maxWidth) {
  const measured = measureText(text, font, maxWidth);
  
  if (measured.lines.length <= maxLines) {
    return { text, truncated: false };
  }
  
  const truncatedLines = measured.lines.slice(0, maxLines);
  const lastLine = truncatedLines[maxLines - 1];
  
  // Add ellipsis to last line
  truncatedLines[maxLines - 1] = lastLine.slice(0, -3) + '...';
  
  return {
    text: truncatedLines.join('\n'),
    truncated: true
  };
}

/**
 * Count approximate words in text.
 * @param {string} text 
 * @returns {number}
 */
export function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Estimate node width based on text content.
 * Target: ~6 words width for inactive state.
 * @param {string} text 
 * @returns {number}
 */
export function estimateNodeWidth(text) {
  const words = countWords(text);
  const avgWordWidth = 45; // Approximate pixels per word
  const minWidth = 80;
  const maxInactiveWidth = 200;
  
  // For inactive state, limit to ~6 words worth
  const targetWords = Math.min(words, 6);
  return clamp(targetWords * avgWordWidth + 32, minWidth, maxInactiveWidth);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
