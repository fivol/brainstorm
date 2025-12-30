import { useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { Canvas, Controls, HelpPanel, ToastContainer, DevConsole, TitleInput, AIModal } from './components';
import { StoreContext, graphStore, uiStore, undoStore, aiStore } from './stores';
import { PersistenceService } from './services/persistence';
import './App.css';

const stores = { graphStore, uiStore, undoStore, aiStore };

/**
 * Main application component.
 */
const App = observer(function App() {
  const persistenceRef = useRef(null);
  const canvasRef = useRef(null);

  // Track changes for beforeunload prompt
  const handleBeforeUnload = useCallback((e) => {
    // Check if there are nodes in the graph
    if (graphStore.nodes.size > 0) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  }, []);

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
    
    // Add beforeunload handler
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      persistence.stop();
      window.removeEventListener('brainstorm:fit-view', handleFitView);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  return (
    <StoreContext.Provider value={stores}>
      <div className="app">
        <Canvas ref={canvasRef} />
        <TitleInput />
        <Controls canvasRef={canvasRef} />
        <HelpPanel />
        <ToastContainer />
        <DevConsole />
        <AIModal />
      </div>
    </StoreContext.Provider>
  );
});

export default App;
