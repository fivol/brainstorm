export interface Block {
  id: number
  x: number
  y: number
  text: string
  width: number
  height: number
  isActive: boolean
  isCollapsed: boolean
}

export const measureTextWidth = (text: string): number => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  context.font = '16px system-ui'
  return context.measureText(text).width
}

export const doBlocksOverlap = (
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean => {
  return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
}

export const getBlockDimensions = (
  block: Block,
  isExpanded: boolean,
  measureTextWidthFn: (text: string) => number
): { width: number; height: number } => {
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
  blocksToResolve: Block[],
  activeId: number | null,
  hoveredId: number | null,
  getBlockDimensionsFn: (block: Block, isExpanded: boolean) => { width: number; height: number }
): Block[] => {
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
            // Move other block away from expanded block
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

                // Keep within canvas bounds
                updatedBlocks[j].x = Math.max(0, Math.min(updatedBlocks[j].x, window.innerWidth - otherWidth))
                updatedBlocks[j].y = Math.max(0, Math.min(updatedBlocks[j].y, window.innerHeight - otherHeight))
              }
            } else {
              // Blocks are exactly on top of each other, move randomly
              updatedBlocks[j].x = otherBlock.x + 100
              updatedBlocks[j].y = otherBlock.y + 100
            }
          } else if (!isExpanded && otherIsExpanded) {
            // Shrink current block if possible
            if (block.text.length <= 50) {
              const shrinkFactor = 0.7
              updatedBlocks[i].width = Math.max(80, block.width * shrinkFactor)
              updatedBlocks[i].height = 40
            }
          } else if (!isExpanded && !otherIsExpanded) {
            // Both collapsed, shrink if needed
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

