import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import './Controls.css';

/**
 * Control panel overlay component.
 */
const Controls = observer(function Controls({ canvasRef }) {
  const { graphStore, uiStore, undoStore } = useStores();
  const fileInputRef = useRef(null);

  const handleClear = () => {
    if (confirm('Clear all nodes and edges? This cannot be undone.')) {
      graphStore.clear();
      uiStore.info('Graph cleared');
    }
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

  return (
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
          className="control-btn" 
          onClick={() => undoStore.undo()}
          disabled={!undoStore.canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
          </svg>
        </button>
        
        <button 
          className="control-btn" 
          onClick={() => undoStore.redo()}
          disabled={!undoStore.canRedo}
          title="Redo (Ctrl+Shift+Z)"
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
          title="Fit View"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
        
        <button 
          className="control-btn control-btn-danger" 
          onClick={handleClear}
          title="Clear Graph"
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
          title="Import JSON"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
          </svg>
        </button>
        
        <button 
          className="control-btn" 
          onClick={handleExportJSON}
          title="Export JSON"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </button>
        
        <button 
          className="control-btn" 
          onClick={handleCopyJSON}
          title="Copy to Clipboard"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
        
        <button 
          className="control-btn" 
          onClick={handlePasteJSON}
          title="Paste from Clipboard"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
          </svg>
        </button>
      </div>
      
      <div className="controls-divider" />
      
      <button 
        className="control-btn" 
        onClick={handleHelp}
        title="Help"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
        </svg>
      </button>
    </div>
  );
});

export default Controls;
