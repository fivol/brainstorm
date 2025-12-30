/**
 * Toggle Switch Component
 * 
 * A reusable toggle switch component that can be used throughout the application.
 * Supports both standard and compact variants.
 * 
 * @example
 * <Toggle
 *   checked={isEnabled}
 *   onChange={setIsEnabled}
 *   title="Enable Feature"
 *   description="This enables the feature"
 *   compact
 * />
 */
const Toggle = ({
  checked,
  onChange,
  title,
  description,
  compact = false,
  className = '',
  ...props
}) => {
  const baseClass = compact ? 'toggle toggle--compact' : 'toggle';
  
  return (
    <label className={`${baseClass} ${className}`} {...props}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider" />
      <div className="toggle-content">
        {title && <span className="toggle-title">{title}</span>}
        {description && <span className="toggle-desc">{description}</span>}
      </div>
    </label>
  );
};

export default Toggle;

