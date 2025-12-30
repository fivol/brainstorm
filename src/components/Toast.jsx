import { observer } from 'mobx-react-lite';
import { useUIStore } from '../stores';
import { ToastType } from '../types';
import './Toast.css';

/**
 * Toast notification component.
 */
const Toast = observer(function Toast({ toast }) {
  const uiStore = useUIStore();
  
  const iconMap = {
    [ToastType.INFO]: 'ℹ️',
    [ToastType.WARNING]: '⚠️',
    [ToastType.ERROR]: '❌'
  };
  
  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-icon">{iconMap[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button 
        className="toast-close"
        onClick={() => uiStore.removeToast(toast.id)}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
});

/**
 * Toast container component.
 */
export const ToastContainer = observer(function ToastContainer() {
  const uiStore = useUIStore();
  
  // Show max 3 toasts, rest are in overflow
  const visibleToasts = uiStore.toasts.slice(-uiStore.maxToasts);
  const hasOverflow = uiStore.toasts.length > uiStore.maxToasts;
  
  return (
    <div className="toast-container">
      {hasOverflow && (
        <div className="toast-overflow">
          +{uiStore.toasts.length - uiStore.maxToasts} more
        </div>
      )}
      {visibleToasts.map(toast => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
});

export default ToastContainer;
