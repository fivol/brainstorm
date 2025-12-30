import * as d3 from 'd3';
import { observer } from 'mobx-react-lite';
import { NodeState } from '../types';
import { generateEdgePath, getEdgeMidpoint, createArrowMarker } from './EdgeRenderer';
import { measureText, truncateText } from '../utils/text';

/**
 * D3-based canvas renderer.
 * Handles SVG rendering of nodes and edges.
 */
export class CanvasRenderer {
  svg = null;
  container = null;
  nodesGroup = null;
  edgesGroup = null;
  overlayGroup = null;
  defs = null;
  
  graphStore = null;
  uiStore = null;
  
  // Callbacks
  onNodeClick = null;
  onNodeDoubleClick = null;
  onNodeDragStart = null;
  onNodeDrag = null;
  onNodeDragEnd = null;
  onEdgeClick = null;
  onCanvasClick = null;
  onCanvasDragStart = null;
  onCanvasDrag = null;
  onCanvasDragEnd = null;
  
  // State
  width = 0;
  height = 0;
  
  constructor(svgElement, graphStore, uiStore) {
    this.svg = d3.select(svgElement);
    this.graphStore = graphStore;
    this.uiStore = uiStore;
    
    this.setup();
  }

  setup() {
    // Clear existing content
    this.svg.selectAll('*').remove();
    
    // Create defs for markers
    this.defs = this.svg.append('defs');
    createArrowMarker(this.defs.node());
    
    // Create main container for zoom/pan
    this.container = this.svg.append('g').attr('class', 'canvas-container');
    
    // Add background rect for capturing clicks on empty space
    this.background = this.container.append('rect')
      .attr('class', 'canvas-background')
      .attr('x', -50000)
      .attr('y', -50000)
      .attr('width', 100000)
      .attr('height', 100000)
      .attr('fill', 'transparent');
    
    // Create layer groups (order matters for z-index)
    this.edgesGroup = this.container.append('g').attr('class', 'edges-layer');
    this.nodesGroup = this.container.append('g').attr('class', 'nodes-layer');
    this.overlayGroup = this.container.append('g').attr('class', 'overlay-layer');
    
    // Get dimensions
    const rect = this.svg.node().getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    // Setup zoom behavior
    this.setupZoom();
  }

  setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      // Enable both pan and zoom via wheel/trackpad
      // wheelDelta controls zoom sensitivity
      .wheelDelta(event => {
        // Trackpad pinch-to-zoom uses ctrlKey
        // Regular scroll wheel doesn't
        if (event.ctrlKey) {
          // Pinch zoom - use delta for zoom
          return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
        }
        // Two-finger scroll - handled as pan, return 0 to not zoom
        return 0;
      })
      .filter(event => {
        // Allow all wheel events (for both pan and zoom)
        if (event.type === 'wheel') return true;
        // Allow touch gestures
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') return true;
        // Allow middle mouse button
        if (event.type === 'mousedown' && event.button === 1) return true;
        // Block other mouse events on canvas (left click creates nodes)
        return false;
      })
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
        this.uiStore.setViewTransform({
          x: event.transform.x,
          y: event.transform.y,
          scale: event.transform.k
        });
      });
    
    // Handle two-finger pan via wheel events (without ctrl)
    this.svg.on('wheel.pan', (event) => {
      if (event.ctrlKey) return; // Let zoom handler deal with pinch
      
      event.preventDefault();
      
      // Get current transform
      const currentTransform = d3.zoomTransform(this.svg.node());
      
      // Calculate new position based on scroll delta
      const newX = currentTransform.x - event.deltaX;
      const newY = currentTransform.y - event.deltaY;
      
      // Apply new transform
      const newTransform = d3.zoomIdentity
        .translate(newX, newY)
        .scale(currentTransform.k);
      
      this.svg.call(zoom.transform, newTransform);
    });
    
    this.svg.call(zoom);
    this.zoom = zoom;
    
    // Set initial transform from store
    const { x, y, scale } = this.uiStore.view;
    this.svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
  }

  /**
   * Convert screen coordinates to canvas coordinates.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {{x: number, y: number}}
   */
  screenToCanvas(screenX, screenY) {
    const { x, y, scale } = this.uiStore.view;
    const rect = this.svg.node().getBoundingClientRect();
    return {
      x: (screenX - rect.left - x) / scale,
      y: (screenY - rect.top - y) / scale
    };
  }

  /**
   * Render the entire graph.
   */
  render() {
    this.renderEdges();
    this.renderNodes();
    this.renderOverlay();
  }

  /**
   * Render all edges.
   */
  renderEdges() {
    const edges = this.graphStore.getEdges();
    const activeNodeId = this.uiStore.activeNodeId;
    const selectedEdgeId = this.uiStore.selectedEdgeId;
    
    // Data join
    const edgeSelection = this.edgesGroup
      .selectAll('.edge')
      .data(edges, d => d.id);
    
    // Exit
    edgeSelection.exit().remove();
    
    // Enter
    const edgeEnter = edgeSelection.enter()
      .append('g')
      .attr('class', 'edge');
    
    edgeEnter.append('path')
      .attr('class', 'edge-path')
      .attr('fill', 'none')
      .attr('stroke', 'var(--edge-color)')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');
    
    // Hit area for easier selection
    edgeEnter.append('path')
      .attr('class', 'edge-hitarea')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 15);
    
    edgeEnter.append('g')
      .attr('class', 'edge-label-group');
    
    // Update
    const edgeUpdate = edgeSelection.merge(edgeEnter);
    
    edgeUpdate.each((d, i, nodes) => {
      const g = d3.select(nodes[i]);
      const source = this.graphStore.getNode(d.sourceId);
      const target = this.graphStore.getNode(d.targetId);
      
      if (!source || !target) return;
      
      const path = generateEdgePath(source, target);
      const midpoint = getEdgeMidpoint(source, target);
      
      const isConnectedToActive = activeNodeId && 
        (d.sourceId === activeNodeId || d.targetId === activeNodeId);
      const isSelected = d.id === selectedEdgeId;
      
      g.select('.edge-path')
        .attr('d', path)
        .attr('stroke', isSelected ? 'var(--edge-selected-color)' : 'var(--edge-color)')
        .attr('stroke-width', isSelected ? 2.5 : 1.5)
        .attr('marker-end', isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)')
        .attr('opacity', isConnectedToActive || isSelected ? 1 : 0.5);
      
      g.select('.edge-hitarea')
        .attr('d', path);
      
      // Label rendering
      const labelGroup = g.select('.edge-label-group');
      labelGroup.selectAll('*').remove();
      
      const showLabel = isConnectedToActive || isSelected;
      
      if (d.label && showLabel) {
        // Show full label
        labelGroup.append('rect')
          .attr('x', midpoint.x - 30)
          .attr('y', midpoint.y - 10)
          .attr('width', 60)
          .attr('height', 20)
          .attr('rx', 4)
          .attr('fill', 'var(--bg-color)')
          .attr('stroke', 'var(--border-color)')
          .attr('stroke-width', 1);
        
        labelGroup.append('text')
          .attr('x', midpoint.x)
          .attr('y', midpoint.y + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', 12)
          .attr('fill', 'var(--text-color)')
          .text(d.label);
      } else if (d.label) {
        // Show ellipsis widget
        labelGroup.append('rect')
          .attr('x', midpoint.x - 12)
          .attr('y', midpoint.y - 8)
          .attr('width', 24)
          .attr('height', 16)
          .attr('rx', 8)
          .attr('fill', 'var(--bg-muted)')
          .attr('stroke', 'var(--border-color)')
          .attr('stroke-width', 1)
          .attr('opacity', 0.7);
        
        labelGroup.append('text')
          .attr('x', midpoint.x)
          .attr('y', midpoint.y + 3)
          .attr('text-anchor', 'middle')
          .attr('font-size', 10)
          .attr('fill', 'var(--text-muted)')
          .text('•••');
      }
    });
    
    // Event handlers
    edgeUpdate.on('click', (event, d) => {
      event.stopPropagation();
      if (this.onEdgeClick) this.onEdgeClick(d.id, event);
    });
  }

  /**
   * Render all nodes.
   */
  renderNodes() {
    const nodes = this.graphStore.getNodes();
    
    // Data join
    const nodeSelection = this.nodesGroup
      .selectAll('.node')
      .data(nodes, d => d.id);
    
    // Exit
    nodeSelection.exit().remove();
    
    // Enter
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node');
    
    nodeEnter.append('rect')
      .attr('class', 'node-bg')
      .attr('rx', 8)
      .attr('ry', 8);
    
    nodeEnter.append('foreignObject')
      .attr('class', 'node-content');
    
    // Update
    const nodeUpdate = nodeSelection.merge(nodeEnter);
    
    nodeUpdate.each((d, i, nodes) => {
      const g = d3.select(nodes[i]);
      const isActive = d.state === NodeState.ACTIVE;
      const isEditable = d.state === NodeState.EDITABLE;
      const isMultiSelected = d.state === NodeState.MULTI_SELECTED;
      const isExpanded = isActive || isEditable;
      
      // Set data-node-id for focusNodeTextInput to find the node
      g.attr('data-node-id', d.id);
      g.attr('transform', `translate(${d.x - d.w / 2}, ${d.y - d.h / 2})`);
      
      // Background rect
      g.select('.node-bg')
        .attr('width', d.w)
        .attr('height', d.h)
        .attr('fill', 'var(--node-bg)')
        .attr('stroke', isActive || isEditable ? 'var(--node-active-border)' : 
                       isMultiSelected ? 'var(--node-selected-border)' : 'var(--node-border)')
        .attr('stroke-width', isActive || isEditable || isMultiSelected ? 2 : 1);
      
      // Content
      const fo = g.select('.node-content')
        .attr('width', d.w)
        .attr('height', d.h);
      
      // Create or update content div
      let contentDiv = fo.select('div.node-text-container');
      if (contentDiv.empty()) {
        contentDiv = fo.append('xhtml:div')
          .attr('class', 'node-text-container')
          .style('width', '100%')
          .style('height', '100%')
          .style('padding', '12px 16px')
          .style('box-sizing', 'border-box')
          .style('overflow', isExpanded ? 'auto' : 'hidden')
          .style('font-size', '14px')
          .style('line-height', '1.4')
          .style('color', 'var(--text-color)')
          .style('outline', 'none');
      }
      
      contentDiv
        .style('overflow', isExpanded ? 'auto' : 'hidden')
        .attr('contenteditable', isEditable ? 'true' : 'false')
        .style('cursor', isEditable ? 'text' : 'default');
      
      // Update text content only if not currently editing
      if (!isEditable) {
        const displayText = isExpanded ? d.text : truncateText(d.text, 3).text;
        contentDiv.text(displayText || 'Click to edit...');
        contentDiv.style('color', d.text ? 'var(--text-color)' : 'var(--text-muted)');
      }
    });
    
    // Event handlers
    this.attachNodeEventHandlers(nodeUpdate);
  }

  attachNodeEventHandlers(selection) {
    const self = this;
    
    // Click handler
    selection.on('click', function(event, d) {
      event.stopPropagation();
      if (self.onNodeClick) self.onNodeClick(d.id, event);
    });
    
    // Double-click handler
    selection.on('dblclick', function(event, d) {
      event.stopPropagation();
      if (self.onNodeDoubleClick) self.onNodeDoubleClick(d.id, event);
    });
    
    // Drag behavior
    const drag = d3.drag()
      .filter(event => {
        // Don't drag if clicking on editable content
        const node = self.graphStore.getNode(event.subject?.id);
        if (node?.state === NodeState.EDITABLE) return false;
        return true;
      })
      .on('start', function(event, d) {
        if (self.onNodeDragStart) self.onNodeDragStart(d.id, event);
      })
      .on('drag', function(event, d) {
        if (self.onNodeDrag) self.onNodeDrag(d.id, event);
      })
      .on('end', function(event, d) {
        if (self.onNodeDragEnd) self.onNodeDragEnd(d.id, event);
      });
    
    selection.call(drag);
  }

  /**
   * Render overlay elements (selection rect, edge preview, etc.)
   */
  renderOverlay() {
    // Selection rectangle
    if (this.uiStore.rectSelection.active) {
      const bounds = this.uiStore.getRectSelectionBounds();
      
      let rect = this.overlayGroup.select('.selection-rect');
      if (rect.empty()) {
        rect = this.overlayGroup.append('rect')
          .attr('class', 'selection-rect')
          .attr('fill', 'var(--selection-fill)')
          .attr('stroke', 'var(--selection-stroke)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4 2');
      }
      
      rect
        .attr('x', bounds.x)
        .attr('y', bounds.y)
        .attr('width', bounds.width)
        .attr('height', bounds.height);
    } else {
      this.overlayGroup.select('.selection-rect').remove();
    }
    
    // Edge creation preview
    if (this.uiStore.edgeCreation.active) {
      const source = this.graphStore.getNode(this.uiStore.edgeCreation.sourceId);
      if (source) {
        let preview = this.overlayGroup.select('.edge-preview');
        if (preview.empty()) {
          preview = this.overlayGroup.append('line')
            .attr('class', 'edge-preview')
            .attr('stroke', 'var(--edge-preview-color)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6 4')
            .attr('marker-end', 'url(#arrowhead)');
        }
        
        preview
          .attr('x1', source.x)
          .attr('y1', source.y)
          .attr('x2', this.uiStore.edgeCreation.cursorX)
          .attr('y2', this.uiStore.edgeCreation.cursorY);
      }
    } else {
      this.overlayGroup.select('.edge-preview').remove();
    }
  }

  /**
   * Fit the view to show all nodes.
   */
  fitView(padding = 50) {
    const nodes = this.graphStore.getNodes();
    if (nodes.length === 0) {
      // Reset to center
      this.svg.call(this.zoom.transform, d3.zoomIdentity);
      return;
    }
    
    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.w / 2);
      minY = Math.min(minY, node.y - node.h / 2);
      maxX = Math.max(maxX, node.x + node.w / 2);
      maxY = Math.max(maxY, node.y + node.h / 2);
    }
    
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const scaleX = this.width / graphWidth;
    const scaleY = this.height / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    const translateX = this.width / 2 - centerX * scale;
    const translateY = this.height / 2 - centerY * scale;
    
    this.svg.transition()
      .duration(500)
      .call(this.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  }

  /**
   * Update dimensions on resize.
   */
  resize() {
    const rect = this.svg.node().getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Clean up.
   */
  dispose() {
    this.svg.selectAll('*').remove();
  }
}

export default CanvasRenderer;
