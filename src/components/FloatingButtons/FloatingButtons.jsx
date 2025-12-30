import React from 'react'
import { observer } from 'mobx-react-lite'
import { blocksStore, modelConfigStore } from '../../stores'

export const FloatingButtons = observer(() => {
  return (
    <div className="floating-buttons">
      <button 
        className="floating-button model-button"
        onClick={(e) => {
          e.stopPropagation()
          modelConfigStore.handleOpenModal()
        }}
      >
        {modelConfigStore.currentModel ? 'Change Model' : 'Add Model'}
      </button>
      
      {/* Layout Controls */}
      <button 
        className={`floating-button layout-button ${blocksStore.autoLayoutEnabled ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          blocksStore.toggleAutoLayout()
        }}
        title={blocksStore.autoLayoutEnabled ? 'Auto-layout ON' : 'Auto-layout OFF'}
      >
        {blocksStore.autoLayoutEnabled ? '⚡ Auto Layout' : '📐 Manual'}
      </button>
      
      <button 
        className="floating-button layout-button"
        onClick={(e) => {
          e.stopPropagation()
          blocksStore.reorganizeLayout()
        }}
        title="Reorganize blocks into hierarchical layout"
      >
        🔄 Reorganize
      </button>
      
      <button 
        className="floating-button layout-button"
        onClick={(e) => {
          e.stopPropagation()
          blocksStore.fitToViewport()
        }}
        title="Fit all blocks in viewport"
      >
        🔍 Fit View
      </button>
      
      <button 
        className="floating-button remove-all-button"
        onClick={(e) => {
          e.stopPropagation()
          if (blocksStore.blocks.length > 0 && window.confirm('Remove all blocks?')) {
            blocksStore.handleRemoveAll()
          }
        }}
      >
        Remove All
      </button>
    </div>
  )
})
