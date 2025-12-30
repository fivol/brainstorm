/**
 * Close Button Component
 * 
 * A reusable close button component for panels and modals.
 * Supports standard and small variants.
 * 
 * @example
 * <CloseButton onClick={handleClose} />
 * <CloseButton onClick={handleClose} small />
 */
const CloseButton = ({
  onClick,
  small = false,
  className = '',
  'aria-label': ariaLabel = 'Close',
  ...props
}) => {
  const sizeClass = small ? 'close-btn close-btn--small' : 'close-btn';
  
  return (
    <button
      className={`${sizeClass} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      type="button"
      {...props}
    >
      ×
    </button>
  );
};

export default CloseButton;

