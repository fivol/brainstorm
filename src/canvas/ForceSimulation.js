import * as d3 from 'd3';

/**
 * Force simulation manager for graph layout.
 * Handles node positioning, collision detection, and edge-aware forces.
 */
export class ForceSimulation {
  simulation = null;
  graphStore = null;
  onTick = null;
  
  // Force parameters
  linkDistance = 150;
  linkStrength = 0.3;
  chargeStrength = -400;
  collisionRadius = 50;
  centerStrength = 0.02;
  
  constructor(graphStore, options = {}) {
    this.graphStore = graphStore;
    Object.assign(this, options);
    this.init();
  }

  init() {
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink()
        .id(d => d.id)
        .distance(this.linkDistance)
        .strength(this.linkStrength)
      )
      .force('charge', d3.forceManyBody()
        .strength(this.chargeStrength)
        .distanceMax(500)
      )
      .force('collision', d3.forceCollide()
        .radius(d => this.getCollisionRadius(d))
        .strength(0.8)
      )
      .force('center', d3.forceCenter(0, 0)
        .strength(this.centerStrength)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.3);
    
    this.simulation.on('tick', () => {
      this.syncToStore();
      if (this.onTick) this.onTick();
    });
    
    // Start cooled down
    this.simulation.alpha(0).stop();
  }

  /**
   * Get collision radius for a node based on its size.
   * @param {Object} d - Node data
   * @returns {number}
   */
  getCollisionRadius(d) {
    const w = d.w || 100;
    const h = d.h || 50;
    return Math.sqrt(w * w + h * h) / 2 + 20;
  }

  /**
   * Update simulation with current graph data.
   */
  update() {
    const nodes = this.graphStore.getNodes().map(n => ({
      ...n,
      // D3 will add x, y, vx, vy - preserve if exists
      vx: n.vx || 0,
      vy: n.vy || 0
    }));
    
    const edges = this.graphStore.getEdges().map(e => ({
      source: e.sourceId,
      target: e.targetId
    }));
    
    this.simulation.nodes(nodes);
    this.simulation.force('link').links(edges);
    
    // Update collision radii
    this.simulation.force('collision').radius(d => this.getCollisionRadius(d));
  }

  /**
   * Sync simulation positions back to store.
   */
  syncToStore() {
    const simNodes = this.simulation.nodes();
    for (const simNode of simNodes) {
      const storeNode = this.graphStore.getNode(simNode.id);
      if (storeNode) {
        storeNode.x = simNode.x;
        storeNode.y = simNode.y;
      }
    }
  }

  /**
   * Sync store positions to simulation.
   */
  syncFromStore() {
    const simNodes = this.simulation.nodes();
    for (const simNode of simNodes) {
      const storeNode = this.graphStore.getNode(simNode.id);
      if (storeNode) {
        simNode.x = storeNode.x;
        simNode.y = storeNode.y;
        simNode.w = storeNode.w;
        simNode.h = storeNode.h;
      }
    }
  }

  /**
   * Trigger a gentle layout adaptation.
   * @param {number} [alpha=0.3]
   */
  reheat(alpha = 0.3) {
    this.update();
    this.simulation.alpha(alpha).restart();
  }

  /**
   * Fix a node position (during drag).
   * @param {string} nodeId
   * @param {number} x
   * @param {number} y
   */
  fixNode(nodeId, x, y) {
    const simNodes = this.simulation.nodes();
    const node = simNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }

  /**
   * Release a fixed node.
   * @param {string} nodeId
   */
  releaseNode(nodeId) {
    const simNodes = this.simulation.nodes();
    const node = simNodes.find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }

  /**
   * Stop the simulation.
   */
  stop() {
    this.simulation.stop();
  }

  /**
   * Restart with full energy.
   */
  restart() {
    this.update();
    this.simulation.alpha(1).restart();
  }

  /**
   * Set center point for centering force.
   * @param {number} x
   * @param {number} y
   */
  setCenter(x, y) {
    this.simulation.force('center', d3.forceCenter(x, y).strength(this.centerStrength));
  }

  /**
   * Focus on a node - pull connected nodes closer.
   * @param {string} nodeId
   */
  focusNode(nodeId) {
    const node = this.graphStore.getNode(nodeId);
    if (!node) return;
    
    // Temporarily strengthen links to connected nodes
    const connectedIds = new Set();
    for (const edge of this.graphStore.edges.values()) {
      if (edge.sourceId === nodeId) connectedIds.add(edge.targetId);
      if (edge.targetId === nodeId) connectedIds.add(edge.sourceId);
    }
    
    this.simulation.force('link')
      .distance(d => {
        if (d.source.id === nodeId || d.target.id === nodeId) {
          return this.linkDistance * 0.7;
        }
        return this.linkDistance;
      })
      .strength(d => {
        if (d.source.id === nodeId || d.target.id === nodeId) {
          return this.linkStrength * 1.5;
        }
        return this.linkStrength;
      });
    
    this.reheat(0.2);
    
    // Reset after settling
    setTimeout(() => {
      this.simulation.force('link')
        .distance(this.linkDistance)
        .strength(this.linkStrength);
    }, 2000);
  }

  /**
   * Dispose simulation.
   */
  dispose() {
    this.simulation.stop();
    this.simulation = null;
  }
}

export default ForceSimulation;
