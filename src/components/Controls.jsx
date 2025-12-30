import { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import './Controls.css';

/**
 * Control panel overlay component.
 */
const Controls = observer(function Controls({ canvasRef }) {
  const { graphStore, uiStore, undoStore } = useStores();
  const fileInputRef = useRef(null);
  const [showRecent, setShowRecent] = useState(false);

  const handleClear = () => {
    graphStore.clear();
    uiStore.info('Graph cleared');
  };

  const handleFitView = () => {
    // Dispatch custom event to trigger fit view
    window.dispatchEvent(new CustomEvent('brainstorm:fit-view'));
    uiStore.info('View fitted');
  };

  const handleExportJSON = () => {
    const data = graphStore.toJSON(true);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `brainstorm-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    uiStore.info('Graph exported');
  };

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        graphStore.loadFromData(data);
        uiStore.info('Graph imported');
        // Trigger fit view after import
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('brainstorm:fit-view'));
        }, 100);
      } catch (err) {
        uiStore.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleCopyJSON = async () => {
    const data = graphStore.toJSON(true);
    const json = JSON.stringify(data, null, 2);
    
    try {
      await navigator.clipboard.writeText(json);
      uiStore.info('Graph copied to clipboard');
    } catch (err) {
      uiStore.error('Failed to copy to clipboard');
    }
  };

  const handlePasteJSON = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      graphStore.loadFromData(data);
      uiStore.info('Graph pasted from clipboard');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('brainstorm:fit-view'));
      }, 100);
    } catch (err) {
      uiStore.error('Invalid JSON in clipboard');
    }
  };

  const handleHelp = () => {
    uiStore.toggleHelp();
  };

  const handleCreateNode = () => {
    window.dispatchEvent(new CustomEvent('brainstorm:create-node'));
  };

  const handleToggleRecent = () => {
    setShowRecent(!showRecent);
  };

  // Recent documents management
  const getRecentDocuments = () => {
    try {
      const saved = localStorage.getItem('brainstorm-recent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveCurrentToRecent = () => {
    const nodes = graphStore.getNodes();
    if (nodes.length === 0) {
      uiStore.warn('Cannot save empty graph');
      return;
    }
    
    const recent = getRecentDocuments();
    const data = graphStore.toJSON(true);
    const name = graphStore.title || `Untitled ${new Date().toLocaleDateString()}`;
    const id = Date.now().toString();
    
    const newDoc = {
      id,
      name,
      blocksCount: nodes.length,
      updatedAt: Date.now(),
      data
    };
    
    // Add to beginning
    recent.unshift(newDoc);
    
    // Keep only last 20
    const limited = recent.slice(0, 20);
    
    try {
      localStorage.setItem('brainstorm-recent', JSON.stringify(limited));
      uiStore.info('Saved to Recent');
    } catch {
      uiStore.error('Failed to save');
    }
  };

  const loadFromRecent = (doc) => {
    graphStore.loadFromData(doc.data);
    setShowRecent(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('brainstorm:fit-view'));
    }, 100);
    uiStore.info(`Loaded: ${doc.name}`);
    
    // Update the document's updatedAt time
    const recent = getRecentDocuments();
    const updated = recent.map(d => 
      d.id === doc.id ? { ...d, updatedAt: Date.now() } : d
    ).sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem('brainstorm-recent', JSON.stringify(updated));
  };

  const deleteFromRecent = (id, e) => {
    e.stopPropagation();
    const recent = getRecentDocuments();
    const filtered = recent.filter(d => d.id !== id);
    localStorage.setItem('brainstorm-recent', JSON.stringify(filtered));
    uiStore.info('Removed from Recent');
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than a minute
    if (diff < 60000) return 'Just now';
    // Less than an hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than a day
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Less than a week
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    // Otherwise show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const recentDocs = getRecentDocuments();

  return (
    <>
      <div className="controls">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        
        <div className="controls-group">
          <button 
            className="control-btn control-btn-primary" 
            onClick={handleCreateNode}
            data-tooltip="New Node (Tab)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
        
        <div className="controls-divider" />
        
        <div className="controls-group">
          <button 
            className="control-btn" 
            onClick={() => undoStore.undo()}
            disabled={!undoStore.canUndo}
            data-tooltip="Undo (Ctrl+Z)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
          </button>
          
          <button 
            className="control-btn" 
            onClick={() => undoStore.redo()}
            disabled={!undoStore.canRedo}
            data-tooltip="Redo (Ctrl+Shift+Z)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
            </svg>
          </button>
        </div>
        
        <div className="controls-divider" />
        
        <div className="controls-group">
          <button 
            className="control-btn" 
            onClick={handleFitView}
            data-tooltip="Fit View"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
          
          <button 
            className="control-btn control-btn-danger" 
            onClick={handleClear}
            data-tooltip="Clear Graph"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
        
        <div className="controls-divider" />
        
        <div className="controls-group">
          <button 
            className="control-btn" 
            onClick={handleImportJSON}
            data-tooltip="Import JSON"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
            </svg>
          </button>
          
          <button 
            className="control-btn" 
            onClick={handleExportJSON}
            data-tooltip="Export JSON"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>
          
          <button 
            className="control-btn" 
            onClick={handleCopyJSON}
            data-tooltip="Copy to Clipboard"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
          
          <button 
            className="control-btn" 
            onClick={handlePasteJSON}
            data-tooltip="Paste from Clipboard"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
            </svg>
          </button>
        </div>
        
        <div className="controls-divider" />
        
        <div className="controls-group">
          <button 
            className="control-btn" 
            onClick={saveCurrentToRecent}
            data-tooltip="Save to Recent"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
          </button>
          
          <button 
            className={`control-btn ${showRecent ? 'control-btn-active' : ''}`}
            onClick={handleToggleRecent}
            data-tooltip="Recent Documents"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          </button>
        </div>
        
        <div className="controls-divider" />
        
        <button 
          className="control-btn" 
          onClick={handleHelp}
          data-tooltip="Help"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
          </svg>
        </button>
      </div>
      
      {/* Recent Documents Panel */}
      {showRecent && (
        <div className="recent-panel">
          <div className="recent-header">
            <h3>Recent Documents</h3>
            <button className="recent-close" onClick={() => setShowRecent(false)}>×</button>
          </div>
          <div className="recent-list">
            {recentDocs.length === 0 ? (
              <div className="recent-empty">
                <p>No recent documents</p>
                <p className="recent-empty-hint">Click the save button to add the current graph</p>
              </div>
            ) : (
              recentDocs.map(doc => (
                <div 
                  key={doc.id} 
                  className="recent-item"
                  onClick={() => loadFromRecent(doc)}
                >
                  <div className="recent-item-info">
                    <span className="recent-item-name">{doc.name}</span>
                    <div className="recent-item-meta">
                      <span className="recent-item-count">{doc.blocksCount} nodes</span>
                      <span className="recent-item-date">{formatDate(doc.updatedAt)}</span>
                    </div>
                  </div>
                  <button 
                    className="recent-item-delete"
                    onClick={(e) => deleteFromRecent(doc.id, e)}
                    data-tooltip="Remove"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default Controls;
