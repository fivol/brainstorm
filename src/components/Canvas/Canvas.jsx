import React, { useMemo } from 'react'
import { TextBlock } from '../TextBlock'

export const Canvas = ({
  blocks,
  activeBlockId,
  hoveredBlockId,
  canvasRef,
  getBlockDimensions,
  onCanvasClick,
  onBlockClick,
  onTextChange,
  onBlockBlur,
  onBlockMouseEnter,
  onBlockMouseLeave
}) => {
  const renderedBlocks = useMemo(() => {
    return blocks.map(block => {
      const isExpanded = block.isActive || block.id === hoveredBlockId
      const isFullyCollapsed = block.isCollapsed && !isExpanded && block.text.length > 50
      const { width: displayWidth, height: displayHeight } = getBlockDimensions(block, isExpanded)
      
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
          onBlockClick={onBlockClick}
          onTextChange={onTextChange}
          onBlockBlur={onBlockBlur}
          onMouseEnter={onBlockMouseEnter}
          onMouseLeave={onBlockMouseLeave}
        />
      )
    })
  }, [blocks, hoveredBlockId, activeBlockId, getBlockDimensions, onBlockClick, onTextChange, onBlockBlur, onBlockMouseEnter, onBlockMouseLeave])

  return (
    <div 
      ref={canvasRef}
      className="canvas" 
      onClick={onCanvasClick}
    >
      {renderedBlocks}
    </div>
  )
}

