import { useState, useRef, useCallback, useMemo } from 'react'
import './App.css'

function App() {
  const [blocks, setBlocks] = useState([])
  const [activeBlockId, setActiveBlockId] = useState(null)
  const [hoveredBlockId, setHoveredBlockId] = useState(null)
  const canvasRef = useRef(null)

  const measureTextWidth = useCallback((text) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    context.font = '16px system-ui'
    return context.measureText(text).width
  }, [])

  const doBlocksOverlap = useCallback((x1, y1, w1, h1, x2, y2, w2, h2) => {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
  }, [])

  const getBlockDimensions = useCallback((block, isExpanded) => {
    if (block.isCollapsed && !isExpanded) {
      if (block.text.trim()) {
        const textLength = block.text.length
        if (textLength > 50) {
          return { width: 40, height: 40 }
        } else {
          const displayText = block.text.substring(0, 50)
          const textWidth = measureTextWidth(displayText)
          return { width: Math.max(100, textWidth + 40), height: 40 }
        }
      }
    }
    return { width: block.width, height: block.height }
  }, [measureTextWidth])

  // Resolve collisions
  const resolveCollisions = useCallback((blocksToResolve, activeId, hoveredId) => {
    const updatedBlocks = [...blocksToResolve]
    let hasChanges = false
    const maxIterations = 10
    let iterations = 0

    while (iterations < maxIterations) {
      let foundCollision = false

      for (let i = 0; i < updatedBlocks.length; i++) {
        const block = updatedBlocks[i]
        const isExpanded = block.isActive || block.id === hoveredId
        const { width, height } = getBlockDimensions(block, isExpanded)

        for (let j = 0; j < updatedBlocks.length; j++) {
          if (i === j) continue

          const otherBlock = updatedBlocks[j]
          const otherIsExpanded = otherBlock.isActive || otherBlock.id === hoveredId
          const { width: otherWidth, height: otherHeight } = getBlockDimensions(otherBlock, otherIsExpanded)

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
  }, [getBlockDimensions, doBlocksOverlap])

  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newBlock = {
        id: Date.now(),
        x,
        y,
        text: '',
        width: 200,
        height: 100,
        isActive: true,
        isCollapsed: false
      }

      setBlocks(prevBlocks => {
        const updated = [...prevBlocks, newBlock]
        return resolveCollisions(updated, newBlock.id, null)
      })
      setActiveBlockId(newBlock.id)
    }
  }, [resolveCollisions])

  const handleBlockClick = useCallback((e, blockId) => {
    e.stopPropagation()
    setActiveBlockId(blockId)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(block =>
        block.id === blockId ? { ...block, isActive: true, isCollapsed: false } : block
      )
      return resolveCollisions(updated, blockId, hoveredBlockId)
    })
  }, [resolveCollisions, hoveredBlockId])

  const handleTextChange = useCallback((blockId, text) => {
    setBlocks(prevBlocks => prevBlocks.map(block =>
      block.id === blockId ? { ...block, text } : block
    ))
  }, [])

  const handleBlockBlur = useCallback((blockId) => {
    setActiveBlockId(null)
    setBlocks(prevBlocks => {
      const block = prevBlocks.find(b => b.id === blockId)
      // Remove block if it's empty (no text or only whitespace)
      if (!block || !block.text.trim()) {
        return prevBlocks.filter(b => b.id !== blockId)
      }
      // Otherwise, collapse it
      const updated = prevBlocks.map(b =>
        b.id === blockId
          ? { ...b, isActive: false, isCollapsed: true }
          : b
      )
      return resolveCollisions(updated, null, hoveredBlockId)
    })
  }, [resolveCollisions, hoveredBlockId])

  const handleBlockMouseEnter = useCallback((blockId) => {
    setHoveredBlockId(blockId)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(block =>
        block.id === blockId && !block.isActive
          ? { ...block, isCollapsed: false }
          : block
      )
      return resolveCollisions(updated, activeBlockId, blockId)
    })
  }, [resolveCollisions, activeBlockId])

  const handleBlockMouseLeave = useCallback((blockId) => {
    setHoveredBlockId(null)
    setBlocks(prevBlocks => {
      const updated = prevBlocks.map(b =>
        b.id === blockId && !b.isActive && b.text.trim()
          ? { ...b, isCollapsed: true }
          : b
      )
      return resolveCollisions(updated, activeBlockId, null)
    })
  }, [resolveCollisions, activeBlockId])

  const renderedBlocks = useMemo(() => {
    return blocks.map(block => {
      const isExpanded = block.isActive || block.id === hoveredBlockId
      const isFullyCollapsed = block.isCollapsed && !isExpanded && block.text.length > 50
      const { width: displayWidth, height: displayHeight } = getBlockDimensions(block, isExpanded)
      
      let displayText = block.text
      if (isFullyCollapsed) {
        displayText = block.text.charAt(0).toUpperCase() || ''
      } else if (block.isCollapsed && !isExpanded && block.text.trim()) {
        displayText = block.text.substring(0, 50)
      }

      return (
        <div
          key={block.id}
          className={`text-block ${block.isActive ? 'active' : ''} ${isFullyCollapsed ? 'collapsed-circle' : ''}`}
          style={{
            left: `${block.x}px`,
            top: `${block.y}px`,
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
          }}
          onClick={(e) => handleBlockClick(e, block.id)}
          onMouseEnter={() => handleBlockMouseEnter(block.id)}
          onMouseLeave={() => handleBlockMouseLeave(block.id)}
        >
          {block.isActive ? (
            <textarea
              value={block.text}
              onChange={(e) => handleTextChange(block.id, e.target.value)}
              onBlur={() => handleBlockBlur(block.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.target.blur()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.target.blur()
                }
              }}
              autoFocus
              className="text-input"
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <div className="text-display">
              {isFullyCollapsed ? (
                <span className="circle-letter">{displayText}</span>
              ) : (
                displayText || 'Click to edit'
              )}
            </div>
          )}
        </div>
      )
    })
  }, [blocks, hoveredBlockId, activeBlockId, getBlockDimensions, handleBlockClick, handleTextChange, handleBlockBlur, handleBlockMouseEnter, handleBlockMouseLeave])

  return (
    <div 
      ref={canvasRef}
      className="canvas" 
      onClick={handleCanvasClick}
    >
      {renderedBlocks}
      </div>
  )
}

export default App
