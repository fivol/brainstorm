import CloseButton from './CloseButton';

/**
 * Panel Component
 * 
 * A reusable floating panel component with header and close button.
 * Used for settings panels, recent documents, etc.
 * 
 * @example
 * <Panel
 *   title="Settings"
 *   onClose={handleClose}
 *   className="settings-panel"
 *   style={{ bottom: 80, left: 20 }}
 * >
 *   <div>Panel content</div>
 * </Panel>
 */
const Panel = ({
  title,
  onClose,
  children,
  className = '',
  style = {},
  headerClassName = '',
  contentClassName = '',
  ...props
}) => {
  return (
    <div className={`panel ${className}`} style={style} {...props}>
      <div className={`panel-header ${headerClassName}`}>
        <h3>{title}</h3>
        <CloseButton onClick={onClose} small />
      </div>
      <div className={`panel-content ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default Panel;

