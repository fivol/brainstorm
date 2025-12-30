import { observer } from 'mobx-react-lite';
import { useUIStore } from '../stores';
import './HelpPanel.css';

/**
 * Help panel component with all interactions and shortcuts.
 */
const HelpPanel = observer(function HelpPanel() {
  const uiStore = useUIStore();
  
  if (!uiStore.helpVisible) return null;
  
  return (
    <div className="help-overlay" onClick={() => uiStore.hideHelp()}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <h2>Keyboard Shortcuts & Interactions</h2>
          <button className="help-close" onClick={() => uiStore.hideHelp()}>×</button>
        </div>
        
        <div className="help-content">
          <section className="help-section">
            <h3>Canvas Navigation</h3>
            <ul>
              <li><kbd>Scroll</kbd> / <kbd>Two-finger</kbd> — Pan canvas</li>
              <li><kbd>Pinch</kbd> / <kbd>Ctrl + Scroll</kbd> — Zoom</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Node Creation</h3>
            <ul>
              <li><kbd>Click</kbd> empty space — Create new node</li>
              <li><kbd>Enter</kbd> (no selection) — Create node at center</li>
              <li><kbd>Ctrl/⌘ + Arrow</kbd> — Create connected node in direction</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Selection & Editing</h3>
            <ul>
              <li><kbd>Click</kbd> node — Select (Active)</li>
              <li><kbd>Click</kbd> active node — Enter edit mode</li>
              <li><kbd>Double-click</kbd> — Select and edit immediately</li>
              <li><kbd>Enter</kbd> on active node — Enter edit mode</li>
              <li><kbd>Enter</kbd> in edit mode — Exit edit mode</li>
              <li><kbd>Shift + Enter</kbd> — New line (in edit mode)</li>
              <li><kbd>Escape</kbd> — Exit edit mode or clear selection</li>
              <li><kbd>Drag</kbd> on empty space — Rectangular selection</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Node Navigation</h3>
            <ul>
              <li><kbd>Arrow keys</kbd> — Move to connected node in direction</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Edge Creation</h3>
            <ul>
              <li><kbd>Alt + Drag</kbd> from active node — Create edge</li>
              <li>Release on node — Connect to existing node</li>
              <li>Release on empty — Create new node and connect</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Deletion</h3>
            <ul>
              <li><kbd>Delete</kbd> / <kbd>Backspace</kbd> — Delete selected node(s) or edge</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Undo / Redo</h3>
            <ul>
              <li><kbd>Ctrl/⌘ + Z</kbd> — Undo</li>
              <li><kbd>Ctrl/⌘ + Shift + Z</kbd> — Redo</li>
            </ul>
          </section>
          
          <section className="help-section">
            <h3>Dev Mode</h3>
            <ul>
              <li><kbd>F8</kbd> — Toggle dev console</li>
            </ul>
            <button 
              className="help-dev-mode-btn"
              onClick={() => {
                uiStore.hideHelp();
                uiStore.showDevMode();
              }}
            >
              Open Dev Console
            </button>
          </section>
        </div>
      </div>
    </div>
  );
});

export default HelpPanel;
