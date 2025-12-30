import { observer } from 'mobx-react-lite';
import { useStores } from '../stores';
import './HelpPanel.css';

// Example graphs from simple to complex
const EXAMPLES = [
  {
    name: 'Simple',
    description: '3 connected nodes',
    data: {
      title: 'Simple Example',
      nodes: [
        { id: 'n1', text: 'Main Idea', x: 0, y: 0 },
        { id: 'n2', text: 'First thought', x: -150, y: 120 },
        { id: 'n3', text: 'Second thought', x: 150, y: 120 }
      ],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n2' },
        { id: 'e2', sourceId: 'n1', targetId: 'n3' }
      ]
    }
  },
  {
    name: 'Basic',
    description: 'Linear flow',
    data: {
      title: 'Project Plan',
      nodes: [
        { id: 'n1', text: 'Start', x: -200, y: 0 },
        { id: 'n2', text: 'Research', x: 0, y: 0 },
        { id: 'n3', text: 'Design', x: 200, y: 0 },
        { id: 'n4', text: 'Build', x: 400, y: 0 },
        { id: 'n5', text: 'Launch', x: 600, y: 0 }
      ],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n2' },
        { id: 'e2', sourceId: 'n2', targetId: 'n3' },
        { id: 'e3', sourceId: 'n3', targetId: 'n4' },
        { id: 'e4', sourceId: 'n4', targetId: 'n5' }
      ]
    }
  },
  {
    name: 'Medium',
    description: 'Mind map',
    data: {
      title: 'Product Features',
      nodes: [
        { id: 'n1', text: 'Product', x: 0, y: 0 },
        { id: 'n2', text: 'Core', x: -200, y: -100 },
        { id: 'n3', text: 'UI/UX', x: 0, y: -150 },
        { id: 'n4', text: 'Backend', x: 200, y: -100 },
        { id: 'n5', text: 'Auth', x: -250, y: 80 },
        { id: 'n6', text: 'Data', x: -100, y: 120 },
        { id: 'n7', text: 'API', x: 100, y: 120 },
        { id: 'n8', text: 'Storage', x: 250, y: 80 }
      ],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n2' },
        { id: 'e2', sourceId: 'n1', targetId: 'n3' },
        { id: 'e3', sourceId: 'n1', targetId: 'n4' },
        { id: 'e4', sourceId: 'n2', targetId: 'n5' },
        { id: 'e5', sourceId: 'n2', targetId: 'n6' },
        { id: 'e6', sourceId: 'n4', targetId: 'n7' },
        { id: 'e7', sourceId: 'n4', targetId: 'n8' }
      ]
    }
  },
  {
    name: 'Complex',
    description: 'Full system',
    data: {
      title: 'Architecture',
      nodes: [
        { id: 'n1', text: 'Client', x: -300, y: -150 },
        { id: 'n2', text: 'Mobile', x: -300, y: 0 },
        { id: 'n3', text: 'Web', x: -300, y: 150 },
        { id: 'n4', text: 'API Gateway', x: 0, y: 0 },
        { id: 'n5', text: 'Auth Service', x: 200, y: -150 },
        { id: 'n6', text: 'User Service', x: 200, y: -50 },
        { id: 'n7', text: 'Data Service', x: 200, y: 50 },
        { id: 'n8', text: 'Notification', x: 200, y: 150 },
        { id: 'n9', text: 'Database', x: 400, y: -50 },
        { id: 'n10', text: 'Cache', x: 400, y: 50 },
        { id: 'n11', text: 'Queue', x: 400, y: 150 }
      ],
      edges: [
        { id: 'e1', sourceId: 'n1', targetId: 'n4' },
        { id: 'e2', sourceId: 'n2', targetId: 'n4' },
        { id: 'e3', sourceId: 'n3', targetId: 'n4' },
        { id: 'e4', sourceId: 'n4', targetId: 'n5' },
        { id: 'e5', sourceId: 'n4', targetId: 'n6' },
        { id: 'e6', sourceId: 'n4', targetId: 'n7' },
        { id: 'e7', sourceId: 'n4', targetId: 'n8' },
        { id: 'e8', sourceId: 'n6', targetId: 'n9' },
        { id: 'e9', sourceId: 'n7', targetId: 'n9' },
        { id: 'e10', sourceId: 'n7', targetId: 'n10' },
        { id: 'e11', sourceId: 'n8', targetId: 'n11' }
      ]
    }
  }
];

/**
 * Help panel component with all interactions and shortcuts.
 */
const HelpPanel = observer(function HelpPanel() {
  const { uiStore, graphStore } = useStores();
  
  if (!uiStore.helpVisible) return null;
  
  const loadExample = (example) => {
    graphStore.loadFromData(example.data);
    uiStore.hideHelp();
    // Fit view after loading
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('brainstorm:fit-view'));
    }, 100);
  };
  
  return (
    <div className="help-overlay" onClick={() => uiStore.hideHelp()}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-scrollable">
          <div className="help-header">
            <h2>Keyboard Shortcuts & Interactions</h2>
            <button className="help-close" onClick={() => uiStore.hideHelp()}>×</button>
          </div>
          
          <div className="help-description">
            <p>
              <strong>BrainStorm</strong> — a visual tool for brainstorming and organizing ideas. 
              Create nodes, connect them with edges, and build mind maps effortlessly.
            </p>
          </div>
          
          <div className="help-examples">
            <h3>Try an Example</h3>
            <div className="help-examples-grid">
              {EXAMPLES.map((example, i) => (
                <button 
                  key={i}
                  className="help-example-btn"
                  onClick={() => loadExample(example)}
                >
                  <span className="help-example-name">{example.name}</span>
                  <span className="help-example-desc">{example.description}</span>
                </button>
              ))}
            </div>
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
              <li><kbd>Tab</kbd> — Create new node at center</li>
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
    </div>
  );
});

export default HelpPanel;
