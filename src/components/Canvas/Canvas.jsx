import React, { useMemo, useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { TextBlock } from '../TextBlock'
import { Arrow } from '../Arrow'
import { blocksStore } from '../../stores'

export const Canvas = observer(() => {
  const canvasRef = useRef(null)

  useEffect(() => {
    blocksStore.setCanvasRef(canvasRef.current)
  }, [])

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
    
    // Render permanent connections
    blocksStore.connections.forEach(connection => {
      const fromBlock = blocksStore.blocks.find(b => b.id === connection.from)
      const toBlock = blocksStore.blocks.find(b => b.id === connection.to)
      
      if (fromBlock && toBlock) {
        const fromIsExpanded = fromBlock.isActive || fromBlock.id === blocksStore.hoveredBlockId
        const toIsExpanded = toBlock.isActive || toBlock.id === blocksStore.hoveredBlockId
        const fromDimensions = blocksStore.getBlockDimensionsFn(fromBlock, fromIsExpanded)
        const toDimensions = blocksStore.getBlockDimensionsFn(toBlock, toIsExpanded)
        
        arrows.push(
          <Arrow
            key={`${connection.from}-${connection.to}`}
            arrowId={`${connection.from}-${connection.to}`}
            fromBlock={fromBlock}
            toBlock={toBlock}
            fromDimensions={fromDimensions}
            toDimensions={toDimensions}
            isTemporary={false}
          />
        )
      }
    })

    // Render temporary arrow while connecting
    if (blocksStore.connectingFrom && blocksStore.tempArrowEnd) {
      const fromBlock = blocksStore.blocks.find(b => b.id === blocksStore.connectingFrom)
      if (fromBlock) {
        const fromIsExpanded = fromBlock.isActive || fromBlock.id === blocksStore.hoveredBlockId
        const fromDimensions = blocksStore.getBlockDimensionsFn(fromBlock, fromIsExpanded)
        
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

  return (
    <div 
      ref={canvasRef}
      className={`canvas ${blocksStore.connectingFrom ? 'connecting' : ''}`}
      onClick={(e) => blocksStore.handleCanvasClick(e)}
      onMouseMove={(e) => blocksStore.handleCanvasMouseMove(e)}
      onMouseUp={(e) => blocksStore.handleCanvasMouseUp(e)}
      onMouseLeave={(e) => {
        // Cancel connection if mouse leaves canvas
        if (blocksStore.connectingFrom) {
          blocksStore.handleCanvasMouseUp(e)
        }
      }}
    >
      {renderedArrows}
      {renderedBlocks}
    </div>
  )
})
