import * as d3 from 'd3'

/**
 * Build a forest (multiple trees) from blocks and connections.
 * Returns an array of root nodes, each with a hierarchical structure.
 */
export const buildHierarchyFromConnections = (blocks, connections) => {
  if (blocks.length === 0) return []

  // Create a map of block id to block
  const blockMap = new Map(blocks.map(b => [b.id, { ...b }]))
  
  // Track which blocks have incoming connections (children)
  const hasIncoming = new Set()
  connections.forEach(conn => {
    hasIncoming.add(conn.to)
  })
  
  // Find root nodes (blocks with no incoming connections)
  const rootIds = blocks
    .filter(b => !hasIncoming.has(b.id))
    .map(b => b.id)
  
  // If no roots found (circular references), use all blocks as roots
  if (rootIds.length === 0 && blocks.length > 0) {
    rootIds.push(blocks[0].id)
  }
  
  // Build adjacency list for children
  const childrenMap = new Map()
  connections.forEach(conn => {
    if (!childrenMap.has(conn.from)) {
      childrenMap.set(conn.from, [])
    }
    childrenMap.get(conn.from).push(conn.to)
  })
  
  // Build tree structure recursively
  const visited = new Set()
  
  const buildNode = (blockId, depth = 0) => {
    if (visited.has(blockId) || depth > 100) return null
    visited.add(blockId)
    
    const block = blockMap.get(blockId)
    if (!block) return null
    
    const childIds = childrenMap.get(blockId) || []
    const children = childIds
      .map(id => buildNode(id, depth + 1))
      .filter(n => n !== null)
    
    return {
      id: block.id,
      block: block,
      children: children.length > 0 ? children : undefined
    }
  }
  
  // Build forest (array of trees)
  const trees = []
  rootIds.forEach(rootId => {
    const tree = buildNode(rootId)
    if (tree) trees.push(tree)
  })
  
  // Add orphan blocks (not connected to any tree) as single-node trees
  blocks.forEach(block => {
    if (!visited.has(block.id)) {
      trees.push({
        id: block.id,
        block: block,
        children: undefined
      })
    }
  })
  
  return trees
}

/**
 * Calculate hierarchical layout positions for all blocks.
 * Returns a Map of blockId -> { x, y }
 */
export const calculateHierarchicalLayout = (
  blocks,
  connections,
  canvasWidth = window.innerWidth,
  canvasHeight = window.innerHeight
) => {
  const positionMap = new Map()
  
  if (blocks.length === 0) return positionMap
  
  const trees = buildHierarchyFromConnections(blocks, connections)
  
  if (trees.length === 0) return positionMap
  
  // Layout configuration
  const nodeWidth = 220  // Block width + margin
  const nodeHeight = 120 // Block height + margin
  const treePadding = 100 // Space between trees
  const topPadding = 100
  const leftPadding = 100
  
  let currentX = leftPadding
  
  trees.forEach((treeData, treeIndex) => {
    // Create d3 hierarchy from tree data
    const root = d3.hierarchy(treeData)
    
    // Calculate tree dimensions
    const treeWidth = Math.max(1, root.leaves().length) * nodeWidth
    const treeHeight = (root.height + 1) * nodeHeight
    
    // Create tree layout
    const treeLayout = d3.tree()
      .size([treeWidth, treeHeight])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2))
    
    // Apply layout
    treeLayout(root)
    
    // Extract positions for each node
    root.each(node => {
      // Swap x and y for horizontal layout (top to bottom becomes left to right)
      // node.x is the horizontal position in the tree
      // node.y is the depth (vertical position)
      positionMap.set(node.data.id, {
        x: currentX + node.y, // Depth becomes X (left to right)
        y: topPadding + node.x, // Spread becomes Y (top to bottom)
        depth: node.depth,
        isRoot: node.depth === 0
      })
    })
    
    // Move to next tree position
    currentX += treeHeight + treePadding
  })
  
  return positionMap
}

/**
 * Calculate the bounding box of all positioned blocks.
 */
export const getLayoutBounds = (positionMap, blocks) => {
  if (positionMap.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity
  
  positionMap.forEach((pos, blockId) => {
    const block = blocks.find(b => b.id === blockId)
    const width = block?.width || 200
    const height = block?.height || 100
    
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + width)
    maxY = Math.max(maxY, pos.y + height)
  })
  
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Generate a bezier curve path between two points.
 * Uses d3.linkHorizontal for smooth curves.
 */
export const generateBezierPath = (
  fromX, fromY,
  toX, toY,
  curveStrength = 0.5
) => {
  // Determine if connection is more horizontal or vertical
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)
  
  if (dx > dy) {
    // Use horizontal link generator (curves horizontally)
    const linkGenerator = d3.linkHorizontal()
      .x(d => d.x)
      .y(d => d.y)
    
    return linkGenerator({
      source: { x: fromX, y: fromY },
      target: { x: toX, y: toY }
    })
  } else {
    // Use vertical link generator (curves vertically)
    const linkGenerator = d3.linkVertical()
      .x(d => d.x)
      .y(d => d.y)
    
    return linkGenerator({
      source: { x: fromX, y: fromY },
      target: { x: toX, y: toY }
    })
  }
}

/**
 * Calculate the tangent angle at the end of a bezier curve.
 * Used for arrowhead rotation.
 */
export const calculateEndTangent = (fromX, fromY, toX, toY) => {
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)
  
  // For horizontal links, the tangent at the end is horizontal
  if (dx > dy) {
    return toX > fromX ? 0 : Math.PI
  } else {
    // For vertical links, the tangent at the end is vertical
    return toY > fromY ? Math.PI / 2 : -Math.PI / 2
  }
}

/**
 * Find the best connection points on block edges.
 */
export const findConnectionPoints = (
  fromBlock, toBlock,
  fromDimensions, toDimensions
) => {
  const fromCenterX = fromBlock.x + fromDimensions.width / 2
  const fromCenterY = fromBlock.y + fromDimensions.height / 2
  const toCenterX = toBlock.x + toDimensions.width / 2
  const toCenterY = toBlock.y + toDimensions.height / 2
  
  const dx = toCenterX - fromCenterX
  const dy = toCenterY - fromCenterY
  
  // Determine which sides to connect based on relative positions
  let fromX, fromY, toX, toY
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      // Target is to the right
      fromX = fromBlock.x + fromDimensions.width
      fromY = fromCenterY
      toX = toBlock.x
      toY = toCenterY
    } else {
      // Target is to the left
      fromX = fromBlock.x
      fromY = fromCenterY
      toX = toBlock.x + toDimensions.width
      toY = toCenterY
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      // Target is below
      fromX = fromCenterX
      fromY = fromBlock.y + fromDimensions.height
      toX = toCenterX
      toY = toBlock.y
    } else {
      // Target is above
      fromX = fromCenterX
      fromY = fromBlock.y
      toX = toCenterX
      toY = toBlock.y + toDimensions.height
    }
  }
  
  return { fromX, fromY, toX, toY }
}

