/**
 * Spinner Component
 * 
 * A reusable loading spinner component.
 * Supports small, default, and large sizes.
 * 
 * @example
 * <Spinner />
 * <Spinner size="small" />
 * <Spinner size="large" />
 */
const Spinner = ({
  size = 'default',
  className = '',
  ...props
}) => {
  const sizeClass = size === 'small' 
    ? 'spinner spinner--small' 
    : size === 'large' 
      ? 'spinner spinner--large' 
      : 'spinner';
  
  return (
    <span className={`${sizeClass} ${className}`} {...props} />
  );
};

export default Spinner;

