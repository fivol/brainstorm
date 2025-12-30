import CloseButton from './CloseButton';

/**
 * Modal Overlay Component
 * 
 * A reusable modal overlay component with header and close button.
 * Clicking the overlay background closes the modal.
 * 
 * @example
 * <ModalOverlay
 *   title="Settings"
 *   onClose={handleClose}
 *   icon={<MyIcon />}
 *   footer={<div>Footer content</div>}
 * >
 *   <div>Modal content</div>
 * </ModalOverlay>
 */
const ModalOverlay = ({
  title,
  onClose,
  children,
  icon,
  footer,
  className = '',
  overlayClassName = '',
  style = {},
  ...props
}) => {
  return (
    <div className={`modal-overlay ${overlayClassName}`} onClick={onClose}>
      <div 
        className={`modal ${className}`} 
        onClick={(e) => e.stopPropagation()}
        style={style}
        {...props}
      >
        <div className="modal-header">
          <h2>
            {icon && icon}
            {title}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="modal-content">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalOverlay;

