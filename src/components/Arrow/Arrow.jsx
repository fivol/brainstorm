import React from 'react'
import { observer } from 'mobx-react-lite'
import { generateBezierPath, findConnectionPoints } from '../../utils/layoutUtils'

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
  let fromX, fromY, toX, toY, pathD

  if (isTemporary && tempEnd) {
    // Temporary arrow while dragging
    const fromCenterX = fromBlock.x + fromDimensions.width / 2
    const fromCenterY = fromBlock.y + fromDimensions.height / 2
    
    const dx = tempEnd.x - fromCenterX
    const dy = tempEnd.y - fromCenterY
    const angle = Math.atan2(dy, dx)

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
    
    // Generate bezier path for temporary arrow
    pathD = generateBezierPath(fromX, fromY, toX, toY)
  } else if (toBlock) {
    // Permanent arrow between two blocks
    const points = findConnectionPoints(fromBlock, toBlock, fromDimensions, toDimensions)
    fromX = points.fromX
    fromY = points.fromY
    toX = points.toX
    toY = points.toY
    
    // Generate bezier path
    pathD = generateBezierPath(fromX, fromY, toX, toY)
  } else {
    return null
  }

  // For bidirectional connections, use simpler straight line at center
  if (isBidirectional && !isTemporary) {
    fromX = fromBlock.x + fromDimensions.width / 2
    fromY = fromBlock.y + fromDimensions.height / 2
    toX = toBlock.x + toDimensions.width / 2
    toY = toBlock.y + toDimensions.height / 2
    // Straight line for bidirectional
    pathD = `M ${fromX} ${fromY} L ${toX} ${toY}`
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
        zIndex: 100,
        overflow: 'visible'
      }}
    >
      <defs>
        {!isBidirectional && (
          <marker
            id={`arrowhead-${arrowId}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="#646cff"
              opacity={isTemporary ? 0.6 : 0.9}
            />
          </marker>
        )}
        <linearGradient 
          id={`arrowGradient-${arrowId}`} 
          gradientUnits="userSpaceOnUse"
          x1={fromX} 
          y1={fromY} 
          x2={toX} 
          y2={toY}
        >
          <stop offset="0%" stopColor="#646cff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#646cff" stopOpacity="0.9" />
        </linearGradient>
        {/* Glow filter for arrows */}
        <filter id={`glow-${arrowId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Shadow/glow layer */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(100, 108, 255, 0.3)"
        strokeWidth={isTemporary ? 4 : 6}
        strokeLinecap="round"
        style={{
          filter: `url(#glow-${arrowId})`
        }}
      />
      
      {/* Main arrow path */}
      <path
        d={pathD}
        fill="none"
        stroke={isTemporary ? '#646cff' : `url(#arrowGradient-${arrowId})`}
        strokeWidth={isTemporary ? 2 : 2.5}
        strokeLinecap="round"
        markerEnd={!isBidirectional ? `url(#arrowhead-${arrowId})` : undefined}
        style={{
          transition: isTemporary ? 'none' : 'd 0.3s ease-out'
        }}
      />
    </svg>
  )
})
