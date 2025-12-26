import React from 'react'
import { Input, Select, LoadingSpinner } from '../../helpers'
import { RECOMMENDED_MODELS } from '../../utils/modelUtils'

export const ModelModal = ({
  currentModel,
  selectedProvider,
  selectedModel,
  apiKey,
  openaiModels,
  loadingModels,
  onProviderChange,
  onModelChange,
  onModelSelect,
  onApiKeyChange,
  onClose,
  onSave,
  onRemove
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{currentModel ? 'Change Model' : 'Add Model'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <Select
            label="Provider"
            id="provider"
            value={selectedProvider}
            onChange={onProviderChange}
          >
            <option value="">Select provider</option>
            <option value="openai">OpenAI</option>
          </Select>

          {selectedProvider === 'openai' && (
            <>
              <Input
                label="API Key"
                id="api-key"
                type="password"
                value={apiKey}
                onChange={onApiKeyChange}
                placeholder="sk-..."
              />

              {loadingModels && <LoadingSpinner message="Loading models..." />}

              {apiKey && (
                <div className="form-group">
                  <label>Recommended Models</label>
                  <div className="recommended-models">
                    {RECOMMENDED_MODELS.map(model => (
                      <button
                        key={model.id}
                        type="button"
                        className={`recommended-model-button ${selectedModel === model.id ? 'selected' : ''}`}
                        onClick={() => onModelSelect(model.id)}
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
                <Select
                  label="All Available Models"
                  id="model"
                  value={selectedModel}
                  onChange={onModelChange}
                >
                  <option value="">Select model</option>
                  {openaiModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}

          <div className="modal-actions">
            {currentModel && (
              <button
                className="modal-button remove-button"
                onClick={onRemove}
              >
                Remove {currentModel.provider === 'openai' ? 'OpenAI' : currentModel.provider}
              </button>
            )}
            <div className="modal-actions-right">
              <button
                className="modal-button cancel-button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="modal-button save-button"
                onClick={onSave}
                disabled={!selectedProvider || !selectedModel || !apiKey}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

