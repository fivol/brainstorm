export const measureTextWidth = (text) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  context.font = '16px system-ui'
  return context.measureText(text).width
}

export const doBlocksOverlap = (
  x1, y1, w1, h1,
  x2, y2, w2, h2
) => {
  return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
}

export const getBlockDimensions = (
  block,
  isExpanded,
  measureTextWidthFn
) => {
  if (block.isCollapsed && !isExpanded) {
    if (block.text.trim()) {
      const textLength = block.text.length
      if (textLength > 50) {
        return { width: 40, height: 40 }
      } else {
        const displayText = block.text.substring(0, 50)
        const textWidth = measureTextWidthFn(displayText)
        return { width: Math.max(100, textWidth + 40), height: 40 }
      }
    }
  }
  return { width: block.width, height: block.height }
}

export const resolveCollisions = (
  blocksToResolve,
  activeId,
  hoveredId,
  getBlockDimensionsFn
) => {
  const updatedBlocks = [...blocksToResolve]
  let hasChanges = false
  const maxIterations = 10
  let iterations = 0

  while (iterations < maxIterations) {
    let foundCollision = false

    for (let i = 0; i < updatedBlocks.length; i++) {
      const block = updatedBlocks[i]
      const isExpanded = block.isActive || block.id === hoveredId
      const { width, height } = getBlockDimensionsFn(block, isExpanded)

      for (let j = 0; j < updatedBlocks.length; j++) {
        if (i === j) continue

        const otherBlock = updatedBlocks[j]
        const otherIsExpanded = otherBlock.isActive || otherBlock.id === hoveredId
        const { width: otherWidth, height: otherHeight } = getBlockDimensionsFn(otherBlock, otherIsExpanded)

        if (doBlocksOverlap(
          block.x, block.y, width, height,
          otherBlock.x, otherBlock.y, otherWidth, otherHeight
        )) {
          foundCollision = true

          if (isExpanded && !otherIsExpanded) {
            const blockCenterX = block.x + width / 2
            const blockCenterY = block.y + height / 2
            const otherCenterX = otherBlock.x + otherWidth / 2
            const otherCenterY = otherBlock.y + otherHeight / 2
            
            const dx = otherCenterX - blockCenterX
            const dy = otherCenterY - blockCenterY
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 0) {
              const minDistance = Math.max(width, height) / 2 + Math.max(otherWidth, otherHeight) / 2 + 20
              const moveDistance = minDistance - distance
              
              if (moveDistance > 0) {
                const moveX = (dx / distance) * moveDistance
                const moveY = (dy / distance) * moveDistance

                updatedBlocks[j].x = otherBlock.x + moveX
                updatedBlocks[j].y = otherBlock.y + moveY

                updatedBlocks[j].x = Math.max(0, Math.min(updatedBlocks[j].x, window.innerWidth - otherWidth))
                updatedBlocks[j].y = Math.max(0, Math.min(updatedBlocks[j].y, window.innerHeight - otherHeight))
              }
            } else {
              updatedBlocks[j].x = otherBlock.x + 100
              updatedBlocks[j].y = otherBlock.y + 100
            }
          } else if (!isExpanded && otherIsExpanded) {
            if (block.text.length <= 50) {
              const shrinkFactor = 0.7
              updatedBlocks[i].width = Math.max(80, block.width * shrinkFactor)
              updatedBlocks[i].height = 40
            }
          } else if (!isExpanded && !otherIsExpanded) {
            if (block.text.length <= 50) {
              const shrinkFactor = 0.8
              updatedBlocks[i].width = Math.max(80, block.width * shrinkFactor)
              updatedBlocks[i].height = 40
            }
          }
          hasChanges = true
        }
      }
    }

    if (!foundCollision) break
    iterations++
  }

  return hasChanges ? updatedBlocks : blocksToResolve
}

// Calculate the best connection points between two blocks
export const getArrowPoints = (
  fromBlock,
  toBlock,
  fromDimensions,
  toDimensions
) => {
  const fromCenterX = fromBlock.x + fromDimensions.width / 2
  const fromCenterY = fromBlock.y + fromDimensions.height / 2
  const toCenterX = toBlock.x + toDimensions.width / 2
  const toCenterY = toBlock.y + toDimensions.height / 2

  const dx = toCenterX - fromCenterX
  const dy = toCenterY - fromCenterY
  const angle = Math.atan2(dy, dx)

  // Calculate intersection points on block edges
  const fromHalfWidth = fromDimensions.width / 2
  const fromHalfHeight = fromDimensions.height / 2
  const toHalfWidth = toDimensions.width / 2
  const toHalfHeight = toDimensions.height / 2

  // Determine which edge of the from block the arrow starts from
  let fromX, fromY
  if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
    // Horizontal edge
    fromX = fromCenterX + (Math.cos(angle) > 0 ? fromHalfWidth : -fromHalfWidth)
    fromY = fromCenterY + Math.tan(angle) * (fromX - fromCenterX)
    // Clamp to vertical bounds
    fromY = Math.max(fromBlock.y, Math.min(fromBlock.y + fromDimensions.height, fromY))
  } else {
    // Vertical edge
    fromY = fromCenterY + (Math.sin(angle) > 0 ? fromHalfHeight : -fromHalfHeight)
    fromX = fromCenterX + (fromY - fromCenterY) / Math.tan(angle)
    // Clamp to horizontal bounds
    fromX = Math.max(fromBlock.x, Math.min(fromBlock.x + fromDimensions.width, fromX))
  }

  // Determine which edge of the to block the arrow ends at
  let toX, toY
  const reverseAngle = angle + Math.PI
  if (Math.abs(Math.cos(reverseAngle)) > Math.abs(Math.sin(reverseAngle))) {
    // Horizontal edge
    toX = toCenterX + (Math.cos(reverseAngle) > 0 ? toHalfWidth : -toHalfWidth)
    toY = toCenterY + Math.tan(reverseAngle) * (toX - toCenterX)
    // Clamp to vertical bounds
    toY = Math.max(toBlock.y, Math.min(toBlock.y + toDimensions.height, toY))
  } else {
    // Vertical edge
    toY = toCenterY + (Math.sin(reverseAngle) > 0 ? toHalfHeight : -toHalfHeight)
    toX = toCenterX + (toY - toCenterY) / Math.tan(reverseAngle)
    // Clamp to horizontal bounds
    toX = Math.max(toBlock.x, Math.min(toBlock.x + toDimensions.width, toX))
  }

  return { fromX, fromY, toX, toY, angle }
}

