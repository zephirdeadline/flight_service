import { createContext, useContext, useState, ReactNode } from 'react';
import type { PopupConfig } from '../types';
import Popup from '../components/Popup';

interface PopupContextType {
  showPopup: (config: Omit<PopupConfig, 'onClose'>) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  closePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within PopupProvider');
  }
  return context;
};

interface PopupProviderProps {
  children: ReactNode;
}

export const PopupProvider = ({ children }: PopupProviderProps) => {
  const [popupConfig, setPopupConfig] = useState<PopupConfig | null>(null);

  const showPopup = (config: Omit<PopupConfig, 'onClose'>) => {
    setPopupConfig({
      ...config,
      onClose: () => {
        setPopupConfig(null);
      },
    });
  };

  const closePopup = () => {
    setPopupConfig(null);
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    showPopup({
      type: 'confirm',
      title,
      message,
      buttons: [
        {
          label: 'Cancel',
          onClick: () => {
            if (onCancel) onCancel();
            closePopup();
          },
          variant: 'secondary',
        },
        {
          label: 'Confirm',
          onClick: () => {
            onConfirm();
            closePopup();
          },
          variant: 'primary',
        },
      ],
    });
  };

  const showSuccess = (title: string, message: string) => {
    showPopup({
      type: 'success',
      title,
      message,
    });
  };

  const showError = (title: string, message: string) => {
    showPopup({
      type: 'error',
      title,
      message,
    });
  };

  const showWarning = (title: string, message: string) => {
    showPopup({
      type: 'warning',
      title,
      message,
    });
  };

  const showInfo = (title: string, message: string) => {
    showPopup({
      type: 'info',
      title,
      message,
    });
  };

  return (
    <PopupContext.Provider
      value={{
        showPopup,
        showConfirm,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        closePopup,
      }}
    >
      {children}
      <Popup config={popupConfig} onClose={closePopup} />
    </PopupContext.Provider>
  );
};
