import React, { useMemo, useRef, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { TextBlock } from '../TextBlock'
import { Arrow } from '../Arrow'
import { blocksStore } from '../../stores'

export const Canvas = observer(() => {
  const canvasRef = useRef(null)
  const [spacePressed, setSpacePressed] = useState(false)

  useEffect(() => {
    blocksStore.setCanvasRef(canvasRef.current)
  }, [])

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNonPassive = (e) => {
      // Only zoom if not connecting
      if (!blocksStore.connectingFrom) {
        blocksStore.handleZoom(e)
      }
    }

    // Add event listener with passive: false
    canvas.addEventListener('wheel', handleWheelNonPassive, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheelNonPassive)
    }
  }, [blocksStore.connectingFrom])

  // Handle space key for panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' && !blocksStore.connectingFrom) {
        e.preventDefault()
        setSpacePressed(true)
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab'
        }
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setSpacePressed(false)
        if (canvasRef.current && !blocksStore.isPanning) {
          canvasRef.current.style.cursor = blocksStore.connectingFrom ? 'crosshair' : 'crosshair'
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [blocksStore.connectingFrom, blocksStore.isPanning])

  const renderedBlocks = useMemo(() => {
    return blocksStore.blocks.map(block => {
      const isExpanded = block.isActive || block.id === blocksStore.hoveredBlockId
      const isFullyCollapsed = block.isCollapsed && !isExpanded && block.text.length > 50
      const { width: displayWidth, height: displayHeight } = blocksStore.getBlockDimensionsFn(block, isExpanded)
      
      let displayText = block.text
      if (isFullyCollapsed) {
        displayText = block.text.charAt(0).toUpperCase() || ''
      } else if (!isExpanded && block.text.trim()) {
        const firstLine = block.text.split('\n')[0]
        displayText = firstLine.length > 50 ? firstLine.substring(0, 50) : firstLine
      }

      return (
        <TextBlock
          key={block.id}
          block={block}
          isExpanded={isExpanded}
          isFullyCollapsed={isFullyCollapsed}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          displayText={displayText}
        />
      )
    })
  }, [blocksStore.blocks, blocksStore.hoveredBlockId, blocksStore.activeBlockId])

  const renderedArrows = useMemo(() => {
    const arrows = []
    const processedPairs = new Set()
    
    // Render permanent connections
    blocksStore.connections.forEach(connection => {
      const pairKey = [connection.from, connection.to].sort().join('-')
      
      // Check if this is a bidirectional connection
      const isBidirectional = blocksStore.connections.some(
        conn => conn.from === connection.to && conn.to === connection.from
      )
      
      // Only process each pair once
      if (processedPairs.has(pairKey)) {
        return
      }
      processedPairs.add(pairKey)
      
      const fromBlock = blocksStore.blocks.find(b => b.id === connection.from)
      const toBlock = blocksStore.blocks.find(b => b.id === connection.to)
      
      if (fromBlock && toBlock) {
        // Use base dimensions (not expanded) for arrow calculations to prevent movement
        const fromDimensions = blocksStore.getBlockDimensionsFn(fromBlock, false)
        const toDimensions = blocksStore.getBlockDimensionsFn(toBlock, false)
        
        arrows.push(
          <Arrow
            key={pairKey}
            arrowId={pairKey}
            fromBlock={fromBlock}
            toBlock={toBlock}
            fromDimensions={fromDimensions}
            toDimensions={toDimensions}
            isTemporary={false}
            isBidirectional={isBidirectional}
          />
        )
      }
    })

    // Render temporary arrow while connecting
    if (blocksStore.connectingFrom && blocksStore.tempArrowEnd) {
      const fromBlock = blocksStore.blocks.find(b => b.id === blocksStore.connectingFrom)
      if (fromBlock) {
        // Use base dimensions for temporary arrow to prevent movement
        const fromDimensions = blocksStore.getBlockDimensionsFn(fromBlock, false)
        
        arrows.push(
          <Arrow
            key="temp-arrow"
            arrowId="temp-arrow"
            fromBlock={fromBlock}
            toBlock={null}
            fromDimensions={fromDimensions}
            toDimensions={{ width: 0, height: 0 }}
            isTemporary={true}
            tempEnd={blocksStore.tempArrowEnd}
          />
        )
      }
    }

    return arrows
  }, [
    blocksStore.connections,
    blocksStore.blocks,
    blocksStore.connectingFrom,
    blocksStore.tempArrowEnd,
    blocksStore.hoveredBlockId,
    blocksStore.activeBlockId
  ])

  const handleMouseDown = (e) => {
    // Try to start panning (space key, middle mouse, or right mouse)
    if (spacePressed || e.button === 1 || e.button === 2) {
      if (blocksStore.startPan(e, spacePressed)) {
        return
      }
    }
    
    // Don't handle click on mousedown - let onClick handle it
    // This prevents double-firing
  }

  const handleMouseMove = (e) => {
    blocksStore.handleCanvasMouseMove(e)
    
    // Update cursor for panning
    if (spacePressed || blocksStore.isPanning) {
      if (canvasRef.current) {
        canvasRef.current.style.cursor = blocksStore.isPanning ? 'grabbing' : 'grab'
      }
    }
  }

  const handleMouseUp = (e) => {
    blocksStore.handleCanvasMouseUp(e)
    
    // Reset cursor if not panning
    if (!blocksStore.isPanning && canvasRef.current) {
      canvasRef.current.style.cursor = blocksStore.connectingFrom ? 'crosshair' : 'crosshair'
    }
  }

  // Wheel handler removed - now handled by non-passive event listener in useEffect

  const handleContextMenu = (e) => {
    // Prevent context menu when right-clicking for panning
    if (blocksStore.isPanning) {
      e.preventDefault()
    }
  }

  const transformStyle = {
    transform: `translate(${blocksStore.panX}px, ${blocksStore.panY}px) scale(${blocksStore.scale})`,
    transformOrigin: '0 0',
  }

  return (
    <div 
      ref={canvasRef}
      className={`canvas ${blocksStore.connectingFrom ? 'connecting' : ''} ${blocksStore.isPanning ? 'panning' : ''}`}
      onClick={(e) => {
        // Only handle clicks directly on canvas div, not on children
        // Children (canvas-content) will handle their own clicks
        if (!blocksStore.isPanning && e.target === canvasRef.current) {
          blocksStore.handleCanvasClick(e)
        }
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onMouseLeave={(e) => {
        // Cancel connection if mouse leaves canvas
        if (blocksStore.connectingFrom) {
          blocksStore.handleCanvasMouseUp(e)
        }
        // Stop panning if mouse leaves
        if (blocksStore.isPanning) {
          blocksStore.stopPan()
        }
      }}
    >
      <div 
        className="canvas-content"
        style={transformStyle}
        onClick={(e) => {
          // Forward clicks on canvas-content (or SVG elements inside) to canvas click handler
          // Only if not clicking on a block
          if (!blocksStore.isPanning && !e.target.closest('.text-block')) {
            // Create a synthetic event that will work with the handler
            const syntheticEvent = {
              ...e,
              target: e.currentTarget
            }
            blocksStore.handleCanvasClick(syntheticEvent)
          }
        }}
      >
        {renderedArrows}
        {renderedBlocks}
      </div>
    </div>
  )
})
