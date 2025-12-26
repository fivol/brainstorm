import React, { useMemo, useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { TextBlock } from '../TextBlock'
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

  return (
    <div 
      ref={canvasRef}
      className="canvas" 
      onClick={(e) => blocksStore.handleCanvasClick(e)}
    >
      {renderedBlocks}
    </div>
  )
})
