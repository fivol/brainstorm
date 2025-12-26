import React from 'react'
import { observer } from 'mobx-react-lite'
import { getArrowPoints } from '../../utils/blockUtils'

export const Arrow = observer(({ 
  fromBlock, 
  toBlock, 
  fromDimensions, 
  toDimensions,
  isTemporary = false,
  tempEnd = null,
  arrowId = 'arrow',
  isBidirectional = false
}) => {
  let fromX, fromY, toX, toY, angle

  if (isTemporary && tempEnd) {
    // Temporary arrow while dragging
    const fromCenterX = fromBlock.x + fromDimensions.width / 2
    const fromCenterY = fromBlock.y + fromDimensions.height / 2
    
    const dx = tempEnd.x - fromCenterX
    const dy = tempEnd.y - fromCenterY
    angle = Math.atan2(dy, dx)

    const fromHalfWidth = fromDimensions.width / 2
    const fromHalfHeight = fromDimensions.height / 2

    // Calculate start point on from block edge
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      fromX = fromCenterX + (Math.cos(angle) > 0 ? fromHalfWidth : -fromHalfWidth)
      fromY = fromCenterY + Math.tan(angle) * (fromX - fromCenterX)
      fromY = Math.max(fromBlock.y, Math.min(fromBlock.y + fromDimensions.height, fromY))
    } else {
      fromY = fromCenterY + (Math.sin(angle) > 0 ? fromHalfHeight : -fromHalfHeight)
      fromX = fromCenterX + (fromY - fromCenterY) / Math.tan(angle)
      fromX = Math.max(fromBlock.x, Math.min(fromBlock.x + fromDimensions.width, fromX))
    }

    toX = tempEnd.x
    toY = tempEnd.y
  } else {
    // Permanent arrow between two blocks
    const points = getArrowPoints(fromBlock, toBlock, fromDimensions, toDimensions)
    fromX = points.fromX
    fromY = points.fromY
    toX = points.toX
    toY = points.toY
    angle = points.angle
  }

  // For bidirectional connections, use center-to-center line
  if (isBidirectional && !isTemporary) {
    fromX = fromBlock.x + fromDimensions.width / 2
    fromY = fromBlock.y + fromDimensions.height / 2
    toX = toBlock.x + toDimensions.width / 2
    toY = toBlock.y + toDimensions.height / 2
    angle = Math.atan2(toY - fromY, toX - fromX)
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100
      }}
    >
      <defs>
        {!isBidirectional && (
          <marker
            id={`arrowhead-${arrowId}`}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="2.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points="0 0, 8 2.5, 0 5"
              fill="#646cff"
              opacity={isTemporary ? 0.6 : 0.8}
            />
          </marker>
        )}
        <linearGradient id={`arrowGradient-${arrowId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#646cff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#646cff" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={isTemporary ? '#646cff' : `url(#arrowGradient-${arrowId})`}
        strokeWidth={isTemporary ? 2 : 2.5}
        strokeOpacity={isTemporary ? 0.6 : 0.8}
        markerEnd={!isBidirectional ? `url(#arrowhead-${arrowId})` : undefined}
        style={{
          filter: isTemporary 
            ? 'drop-shadow(0 0 4px rgba(100, 108, 255, 0.4))'
            : 'drop-shadow(0 0 6px rgba(100, 108, 255, 0.5))'
        }}
      />
    </svg>
  )
})

