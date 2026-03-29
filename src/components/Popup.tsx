import { useEffect } from 'react';
import type { PopupConfig } from '../types';
import './Popup.css';

interface PopupProps {
  config: PopupConfig | null;
  onClose: () => void;
}

const Popup = ({ config, onClose }: PopupProps) => {
  useEffect(() => {
    if (config) {
      // Empêcher le scroll du body quand la popup est ouverte
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [config]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && config) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [config]);

  if (!config) return null;

  const handleClose = () => {
    if (config.onClose) {
      config.onClose();
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const getIcon = () => {
    switch (config.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'confirm':
        return '❓';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const defaultButtons = [
    {
      label: 'OK',
      onClick: handleClose,
      variant: 'primary' as const,
    },
  ];

  const buttons = config.buttons || defaultButtons;

  return (
    <div className="popup-overlay" onClick={handleOverlayClick}>
      <div className={`popup-container popup-${config.type}`}>
        <button className="popup-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        <div className="popup-icon">{getIcon()}</div>

        <div className="popup-content">
          <h2 className="popup-title">{config.title}</h2>
          <p className="popup-message">{config.message}</p>
        </div>

        <div className="popup-buttons">
          {buttons.map((button, index) => (
            <button
              key={index}
              className={`popup-button popup-button-${button.variant || 'primary'}`}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Popup;
