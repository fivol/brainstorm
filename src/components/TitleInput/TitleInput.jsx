import { useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores';
import './TitleInput.css';

/**
 * Title input component - displays and edits the graph title.
 * Positioned in top-left corner.
 */
const TitleInput = observer(function TitleInput() {
  const { graphStore } = useStores();
  const inputRef = useRef(null);
  
  const handleChange = useCallback((e) => {
    graphStore.setTitle(e.target.value);
  }, [graphStore]);
  
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.target.blur();
    }
    // Prevent keyboard shortcuts from triggering while typing
    e.stopPropagation();
  }, []);
  
  // Set initial document title
  useEffect(() => {
    const title = graphStore.title;
    document.title = title ? `BrainStorm: ${title}` : 'BrainStorm';
  }, [graphStore.title]);
  
  return (
    <div className="title-input-container">
      <input
        ref={inputRef}
        type="text"
        className="title-input"
        value={graphStore.title}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Untitled"
        spellCheck={false}
      />
    </div>
  );
});

export default TitleInput;

