import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Canvas, Controls, HelpPanel, ToastContainer } from './components';
import { StoreContext, graphStore, uiStore, undoStore } from './stores';
import { PersistenceService } from './services/persistence';
import './App.css';

const stores = { graphStore, uiStore, undoStore };

/**
 * Main application component.
 */
const App = observer(function App() {
  const persistenceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Initialize persistence
    const persistence = new PersistenceService(graphStore, uiStore);
    persistence.start();
    persistenceRef.current = persistence;
    
    // Listen for fit view events
    const handleFitView = () => {
      window.dispatchEvent(new CustomEvent('canvas:fit-view'));
    };
    window.addEventListener('brainstorm:fit-view', handleFitView);
    
    return () => {
      persistence.stop();
      window.removeEventListener('brainstorm:fit-view', handleFitView);
    };
  }, []);

  return (
    <StoreContext.Provider value={stores}>
      <div className="app">
        <Canvas ref={canvasRef} />
        <Controls canvasRef={canvasRef} />
        <HelpPanel />
        <ToastContainer />
      </div>
    </StoreContext.Provider>
  );
});

export default App;
