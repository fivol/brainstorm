import { makeAutoObservable, runInAction } from 'mobx';

/**
 * LLM provider configurations
 */
export const LLMProviders = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

/**
 * Recommended models by category
 */
export const RecommendedModels = {
  [LLMProviders.OPENAI]: {
    small: { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
    medium: { id: 'gpt-4o', name: 'GPT-4o', description: 'Balanced' },
    large: { id: 'o1', name: 'o1', description: 'Most capable' }
  },
  [LLMProviders.ANTHROPIC]: {
    small: { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: 'Fast & affordable' },
    medium: { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced' },
    large: { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable' }
  }
};

/**
 * Available models per provider
 */
export const AvailableModels = {
  [LLMProviders.OPENAI]: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1-mini' },
    { id: 'o3-mini', name: 'o3-mini' }
  ],
  [LLMProviders.ANTHROPIC]: [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' }
  ]
};

const AI_STORAGE_KEY = 'brainstorm-ai-config';

/**
 * Store for AI/LLM configuration and state.
 */
class AIStore {
  /** Current provider */
  provider = LLMProviders.OPENAI;
  
  /** API keys per provider */
  apiKeys = {
    [LLMProviders.OPENAI]: '',
    [LLMProviders.ANTHROPIC]: ''
  };
  
  /** Selected model per provider */
  selectedModels = {
    [LLMProviders.OPENAI]: 'gpt-4o-mini',
    [LLMProviders.ANTHROPIC]: 'claude-3-5-haiku-latest'
  };
  
  /** API key validation status: 'idle' | 'validating' | 'valid' | 'invalid' */
  validationStatus = 'idle';
  
  /** Validation error message */
  validationError = '';
  
  /** Whether AI modal is open */
  modalOpen = false;
  
  /** Virtual cards for current node */
  virtualCards = [];
  
  /** Loading state for suggestions */
  loadingSuggestions = false;
  
  /** Current node ID for which suggestions are shown */
  suggestionsForNodeId = null;

  constructor() {
    makeAutoObservable(this);
    this.loadConfig();
  }

  /**
   * Load configuration from localStorage
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem(AI_STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.provider) this.provider = config.provider;
        if (config.apiKeys) this.apiKeys = { ...this.apiKeys, ...config.apiKeys };
        if (config.selectedModels) this.selectedModels = { ...this.selectedModels, ...config.selectedModels };
      }
    } catch (e) {
      console.warn('Failed to load AI config:', e);
    }
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig() {
    try {
      const config = {
        provider: this.provider,
        apiKeys: this.apiKeys,
        selectedModels: this.selectedModels
      };
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save AI config:', e);
    }
  }

  /**
   * Set the current provider
   */
  setProvider(provider) {
    this.provider = provider;
    this.validationStatus = 'idle';
    this.validationError = '';
    this.saveConfig();
  }

  /**
   * Set API key for current provider
   */
  setApiKey(key) {
    this.apiKeys[this.provider] = key;
    this.validationStatus = 'idle';
    this.validationError = '';
    this.saveConfig();
  }

  /**
   * Set selected model for current provider
   */
  setModel(modelId) {
    this.selectedModels[this.provider] = modelId;
    this.saveConfig();
  }

  /**
   * Get current API key
   */
  get currentApiKey() {
    return this.apiKeys[this.provider];
  }

  /**
   * Get current model
   */
  get currentModel() {
    return this.selectedModels[this.provider];
  }

  /**
   * Check if AI is configured (has API key)
   */
  get isConfigured() {
    return !!this.currentApiKey;
  }

  /**
   * Open AI modal
   */
  openModal() {
    this.modalOpen = true;
  }

  /**
   * Close AI modal
   */
  closeModal() {
    this.modalOpen = false;
  }

  /**
   * Validate API key
   */
  async validateApiKey() {
    if (!this.currentApiKey) {
      this.validationStatus = 'invalid';
      this.validationError = 'API key is required';
      return false;
    }

    this.validationStatus = 'validating';
    this.validationError = '';

    try {
      if (this.provider === LLMProviders.OPENAI) {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${this.currentApiKey}`
          }
        });
        
        if (response.ok) {
          runInAction(() => {
            this.validationStatus = 'valid';
          });
          return true;
        } else {
          const error = await response.json().catch(() => ({}));
          runInAction(() => {
            this.validationStatus = 'invalid';
            this.validationError = error.error?.message || 'Invalid API key';
          });
          return false;
        }
      } else if (this.provider === LLMProviders.ANTHROPIC) {
        // Anthropic doesn't have a models endpoint, so we'll try a minimal completion
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': this.currentApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        });
        
        if (response.ok) {
          runInAction(() => {
            this.validationStatus = 'valid';
          });
          return true;
        } else {
          const error = await response.json().catch(() => ({}));
          runInAction(() => {
            this.validationStatus = 'invalid';
            this.validationError = error.error?.message || 'Invalid API key';
          });
          return false;
        }
      }
    } catch (e) {
      runInAction(() => {
        this.validationStatus = 'invalid';
        this.validationError = e.message || 'Failed to validate';
      });
      return false;
    }
  }

  /**
   * Generate suggestions for a node
   */
  async generateSuggestions(graphStore, nodeId, numSuggestions = 3) {
    const node = graphStore.getNode(nodeId);
    if (!node || !this.isConfigured) return;

    this.loadingSuggestions = true;
    this.suggestionsForNodeId = nodeId;
    this.virtualCards = [];

    try {
      // Build context from graph
      const nodes = graphStore.getNodes();
      const edges = graphStore.getEdges();
      
      // Build a text representation of the graph
      let graphContext = '';
      for (const edge of edges) {
        const source = graphStore.getNode(edge.sourceId);
        const target = graphStore.getNode(edge.targetId);
        if (source && target) {
          graphContext += `(${source.id.slice(-4)}) ${source.text} -> (${target.id.slice(-4)}) ${target.text}\n`;
        }
      }
      
      // Add orphan nodes
      const connectedIds = new Set();
      edges.forEach(e => {
        connectedIds.add(e.sourceId);
        connectedIds.add(e.targetId);
      });
      for (const n of nodes) {
        if (!connectedIds.has(n.id)) {
          graphContext += `(${n.id.slice(-4)}) ${n.text}\n`;
        }
      }

      const prompt = `${graphContext}\n\nCurrent node text: "${node.text}" -> ?`;
      
      const systemPrompt = `You are a brainstorming assistant. Given a mind map graph and a current node, suggest ${numSuggestions} possible next ideas that could connect to the current node.

Each suggestion should be:
- A concise phrase (2-6 words)
- Logically connected to the current node
- Different from existing nodes
- Creative but relevant

Respond with ONLY a JSON array of ${numSuggestions} strings, no explanation. Example:
["First suggestion", "Second suggestion", "Third suggestion"]`;

      let suggestions = [];

      if (this.provider === LLMProviders.OPENAI) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.currentModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: 200,
            temperature: 0.8
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '[]';
          suggestions = JSON.parse(content);
        }
      } else if (this.provider === LLMProviders.ANTHROPIC) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': this.currentApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: this.currentModel,
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.content?.[0]?.text || '[]';
          suggestions = JSON.parse(content);
        }
      }

      runInAction(() => {
        this.virtualCards = suggestions.map((text, index) => ({
          id: `virtual-${Date.now()}-${index}`,
          text,
          sourceNodeId: nodeId
        }));
        this.loadingSuggestions = false;
      });
    } catch (e) {
      console.error('Failed to generate suggestions:', e);
      runInAction(() => {
        this.virtualCards = [];
        this.loadingSuggestions = false;
      });
    }
  }

  /**
   * Clear virtual cards
   */
  clearVirtualCards() {
    this.virtualCards = [];
    this.suggestionsForNodeId = null;
    this.loadingSuggestions = false;
  }

  /**
   * Accept a virtual card suggestion
   */
  acceptSuggestion(virtualCardId) {
    const card = this.virtualCards.find(c => c.id === virtualCardId);
    if (card) {
      // Return the card data to be used by the canvas
      const result = { ...card };
      this.clearVirtualCards();
      return result;
    }
    return null;
  }
}

export const aiStore = new AIStore();
export default aiStore;

