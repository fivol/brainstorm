import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import './App.css'

// Recommended models from weakest/cheapest to strongest/most expensive
const RECOMMENDED_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', label: 'Budget', description: 'Cheapest, good for simple tasks' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', label: 'Best Value', description: 'Great price/performance balance' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', label: 'Powerful', description: 'Strong performance, mid-range price' },
  { id: 'gpt-4o', name: 'GPT-4o', label: 'Premium', description: 'Strongest, most capable' }
]

function App() {
  const [blocks, setBlocks] = useState([])
  const [activeBlockId, setActiveBlockId] = useState(null)
  const [hoveredBlockId, setHoveredBlockId] = useState(null)
  const [showModelModal, setShowModelModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [openaiModels, setOpenaiModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [currentModel, setCurrentModel] = useState(null)
  const canvasRef = useRef(null)

  const fetchOpenAIModels = useCallback(async (key) => {
    setLoadingModels(true)
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter for chat completion models only (gpt-* models, exclude embeddings, fine-tuned, etc.)
        const chatModels = data.data
          .filter(model => {
            const id = model.id
            // Include only chat completion models
            return id.startsWith('gpt-') && 
                   !id.includes('embedding') && 
                   !id.includes('instruct') &&
                   !id.includes(':') && // Exclude fine-tuned models (format: ft:gpt-3.5-turbo:org:model)
                   (id.includes('gpt-3.5-turbo') || 
                    id.includes('gpt-4') || 
                    id.includes('gpt-4o'))
          })
          .map(model => ({
            id: model.id,
            name: model.id
          }))
          .sort((a, b) => {
            // Sort by recommended order first, then alphabetically
            const aIndex = RECOMMENDED_MODELS.findIndex(m => m.id === a.id)
            const bIndex = RECOMMENDED_MODELS.findIndex(m => m.id === b.id)
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
            if (aIndex !== -1) return -1
            if (bIndex !== -1) return 1
            return a.id.localeCompare(b.id)
          })
        setOpenaiModels(chatModels)
      } else {
        // If API call fails, use recommended models list
        setOpenaiModels(RECOMMENDED_MODELS.map(m => ({ id: m.id, name: m.name })))
      }
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error)
      // Use recommended models list as fallback
      setOpenaiModels(RECOMMENDED_MODELS.map(m => ({ id: m.id, name: m.name })))
    } finally {
      setLoadingModels(false)
    }
  }, [])

  // Load model config from localStorage on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('aiModelConfig')
    if (savedModel) {
      try {
        const modelConfig = JSON.parse(savedModel)
        setCurrentModel(modelConfig)
      } catch (e) {
        console.error('Failed to parse saved model config:', e)
      }
    }
  }, [])

  // Debounced fetch of OpenAI models when API key changes
  useEffect(() => {
    if (selectedProvider === 'openai' && apiKey && apiKey.length > 10 && !openaiModels.length && !loadingModels) {
      const timeoutId = setTimeout(() => {
        fetchOpenAIModels(apiKey)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [apiKey, selectedProvider, openaiModels.length, loadingModels, fetchOpenAIModels])

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

  const handleRemoveAll = useCallback(() => {
    setBlocks([])
    setActiveBlockId(null)
    setHoveredBlockId(null)
  }, [])

  const handleOpenModelModal = useCallback(() => {
    if (currentModel) {
      setSelectedProvider(currentModel.provider)
      setSelectedModel(currentModel.model)
      setApiKey(currentModel.apiKey)
      if (currentModel.provider === 'openai' && currentModel.apiKey) {
        fetchOpenAIModels(currentModel.apiKey)
      }
    }
    setShowModelModal(true)
  }, [currentModel, fetchOpenAIModels])

  const handleCloseModelModal = useCallback(() => {
    setShowModelModal(false)
    setSelectedProvider('')
    setSelectedModel('')
    setApiKey('')
    setOpenaiModels([])
    setLoadingModels(false)
  }, [])

  const handleProviderChange = useCallback((e) => {
    setSelectedProvider(e.target.value)
    setSelectedModel('')
    setOpenaiModels([])
    setLoadingModels(false)
  }, [])

  const handleSaveModel = useCallback(() => {
    if (!selectedProvider || !selectedModel || !apiKey) {
      alert('Please fill in all fields')
      return
    }

    const modelConfig = {
      provider: selectedProvider,
      model: selectedModel,
      apiKey: apiKey
    }

    localStorage.setItem('aiModelConfig', JSON.stringify(modelConfig))
    setCurrentModel(modelConfig)
    handleCloseModelModal()
  }, [selectedProvider, selectedModel, apiKey, handleCloseModelModal])

  const handleRemoveModel = useCallback(() => {
    if (window.confirm('Remove current model configuration?')) {
      localStorage.removeItem('aiModelConfig')
      setCurrentModel(null)
      handleCloseModelModal()
    }
  }, [handleCloseModelModal])

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
      <div className="floating-buttons">
        <button 
          className="floating-button model-button"
          onClick={(e) => {
            e.stopPropagation()
            handleOpenModelModal()
          }}
        >
          {currentModel ? 'Change Model' : 'Add Model'}
        </button>
        <button 
          className="floating-button remove-all-button"
          onClick={(e) => {
            e.stopPropagation()
            if (blocks.length > 0 && window.confirm('Remove all blocks?')) {
              handleRemoveAll()
            }
          }}
        >
          Remove All
        </button>
      </div>

      {showModelModal && (
        <div className="modal-overlay" onClick={handleCloseModelModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{currentModel ? 'Change Model' : 'Add Model'}</h2>
              <button className="modal-close" onClick={handleCloseModelModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="provider">Provider</label>
                <select
                  id="provider"
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  className="form-input"
                >
                  <option value="">Select provider</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              {selectedProvider === 'openai' && (
                <>
                  <div className="form-group">
                    <label htmlFor="api-key">API Key</label>
                    <input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="form-input"
                    />
                  </div>

                  {loadingModels && (
                    <div className="loading-message">Loading models...</div>
                  )}

                  {apiKey && (
                    <div className="form-group">
                      <label>Recommended Models</label>
                      <div className="recommended-models">
                        {RECOMMENDED_MODELS.map(model => (
                          <button
                            key={model.id}
                            type="button"
                            className={`recommended-model-button ${selectedModel === model.id ? 'selected' : ''}`}
                            onClick={() => setSelectedModel(model.id)}
                          >
                            <div className="recommended-model-name">{model.name}</div>
                            <div className="recommended-model-label">{model.label}</div>
                            <div className="recommended-model-desc">{model.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {openaiModels.length > 0 && (
                    <div className="form-group">
                      <label htmlFor="model">All Available Models</label>
                      <select
                        id="model"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select model</option>
                        {openaiModels.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="modal-actions">
                {currentModel && (
                  <button
                    className="modal-button remove-button"
                    onClick={handleRemoveModel}
                  >
                    Remove {currentModel.provider === 'openai' ? 'OpenAI' : currentModel.provider}
                  </button>
                )}
                <div className="modal-actions-right">
                  <button
                    className="modal-button cancel-button"
                    onClick={handleCloseModelModal}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-button save-button"
                    onClick={handleSaveModel}
                    disabled={!selectedProvider || !selectedModel || !apiKey}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
