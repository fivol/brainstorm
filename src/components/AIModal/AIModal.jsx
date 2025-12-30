import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import { LLMProviders, RecommendedModels, AvailableModels } from '../../stores/AIStore';
import './AIModal.css';

/**
 * AI Configuration Modal
 */
const AIModal = observer(function AIModal() {
  const { aiStore } = useStores();

  const handleClose = useCallback(() => {
    aiStore.closeModal();
  }, [aiStore]);

  const handleProviderChange = useCallback((provider) => {
    aiStore.setProvider(provider);
  }, [aiStore]);

  const handleApiKeyChange = useCallback((e) => {
    aiStore.setApiKey(e.target.value);
  }, [aiStore]);

  const handleModelChange = useCallback((e) => {
    aiStore.setModel(e.target.value);
  }, [aiStore]);

  const handleValidate = useCallback(() => {
    aiStore.validateApiKey();
  }, [aiStore]);

  const handleRecommendedClick = useCallback((modelId) => {
    aiStore.setModel(modelId);
  }, [aiStore]);

  const handleHintsToggle = useCallback(() => {
    aiStore.setHintsEnabled(!aiStore.hintsEnabled);
  }, [aiStore]);

  const handleGenerateToggle = useCallback(() => {
    aiStore.setGenerateEnabled(!aiStore.generateEnabled);
  }, [aiStore]);

  if (!aiStore.modalOpen) return null;

  const recommended = RecommendedModels[aiStore.provider];
  const models = AvailableModels[aiStore.provider];

  return (
    <div className="ai-modal-overlay" onClick={handleClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            AI Configuration
          </h2>
          <button className="ai-modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="ai-modal-content">
          {/* Provider Selection */}
          <div className="ai-section">
            <label className="ai-label">Provider</label>
            <div className="ai-provider-tabs">
              <button
                className={`ai-provider-tab ${aiStore.provider === LLMProviders.OPENAI ? 'active' : ''}`}
                onClick={() => handleProviderChange(LLMProviders.OPENAI)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                </svg>
                OpenAI
              </button>
              <button
                className={`ai-provider-tab ${aiStore.provider === LLMProviders.ANTHROPIC ? 'active' : ''}`}
                onClick={() => handleProviderChange(LLMProviders.ANTHROPIC)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M17.303 3.248l-5.304 14.356L6.697 3.248H3l7.697 17.504h2.605L21 3.248z"/>
                </svg>
                Anthropic
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="ai-section">
            <label className="ai-label">API Key</label>
            <div className="ai-key-input-wrapper">
              <input
                type="password"
                className="ai-input"
                value={aiStore.currentApiKey}
                onChange={handleApiKeyChange}
                placeholder={`Enter your ${aiStore.provider === LLMProviders.OPENAI ? 'OpenAI' : 'Anthropic'} API key`}
              />
              <button 
                className="ai-validate-btn"
                onClick={handleValidate}
                disabled={!aiStore.currentApiKey || aiStore.validationStatus === 'validating'}
              >
                {aiStore.validationStatus === 'validating' ? (
                  <span className="ai-spinner" />
                ) : (
                  'Validate'
                )}
              </button>
            </div>
            
            {/* Validation Status */}
            {aiStore.validationStatus !== 'idle' && (
              <div className={`ai-status ai-status-${aiStore.validationStatus}`}>
                {aiStore.validationStatus === 'validating' && (
                  <>
                    <span className="ai-spinner" /> Validating...
                  </>
                )}
                {aiStore.validationStatus === 'valid' && (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    API key is valid
                  </>
                )}
                {aiStore.validationStatus === 'invalid' && (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    {aiStore.validationError || 'Invalid API key'}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="ai-section">
            <label className="ai-label">Model</label>
            
            {/* Recommended Models */}
            <div className="ai-recommended">
              {Object.entries(recommended).map(([category, model]) => (
                <button
                  key={model.id}
                  className={`ai-recommended-btn ${aiStore.currentModel === model.id ? 'active' : ''}`}
                  onClick={() => handleRecommendedClick(model.id)}
                >
                  <span className="ai-recommended-category">{category}</span>
                  <span className="ai-recommended-name">{model.name}</span>
                  <span className="ai-recommended-desc">{model.description}</span>
                </button>
              ))}
            </div>

            {/* Model Dropdown */}
            <select 
              className="ai-select"
              value={aiStore.currentModel}
              onChange={handleModelChange}
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Feature Toggles */}
          <div className="ai-section">
            <label className="ai-label">Features</label>
            <div className="ai-toggles">
              <label className="ai-toggle">
                <input
                  type="checkbox"
                  checked={aiStore.hintsEnabled}
                  onChange={handleHintsToggle}
                />
                <span className="ai-toggle-slider"></span>
                <div className="ai-toggle-content">
                  <span className="ai-toggle-title">AI Hints</span>
                  <span className="ai-toggle-desc">Show AI suggestions with Ctrl+Space</span>
                </div>
              </label>
              <label className="ai-toggle">
                <input
                  type="checkbox"
                  checked={aiStore.generateEnabled}
                  onChange={handleGenerateToggle}
                />
                <span className="ai-toggle-slider"></span>
                <div className="ai-toggle-content">
                  <span className="ai-toggle-title">AI Generate</span>
                  <span className="ai-toggle-desc">Generate nodes from tasks via AI icon</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="ai-modal-footer">
          <p className="ai-footer-hint">
            Press <kbd>Ctrl</kbd>+<kbd>Space</kbd> on a selected node to get AI suggestions
          </p>
        </div>
      </div>
    </div>
  );
});

export default AIModal;

