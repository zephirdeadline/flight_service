import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { SimData } from '../types';

interface SimConnectContextType {
  isStreaming: boolean;
  lastData: SimData | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
}

const SimConnectContext = createContext<SimConnectContextType | null>(null);

export const SimConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastData, setLastData] = useState<SimData | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    listen<SimData>('simconnect-data', (event) => {
      setLastData(event.payload);
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const startStreaming = async () => {
    try {
      await invoke('simconnect_connect');
      await invoke('simconnect_start_streaming');
      setIsStreaming(true);
    } catch (e) {
      console.error('Failed to start streaming:', e);
    }
  };

  const stopStreaming = async () => {
    try {
      await invoke('simconnect_stop_streaming');
      setIsStreaming(false);
    } catch (e) {
      console.error('Failed to stop streaming:', e);
    }
  };

  return (
    <SimConnectContext.Provider value={{ isStreaming, lastData, startStreaming, stopStreaming }}>
      {children}
    </SimConnectContext.Provider>
  );
};

export const useSimConnect = () => {
  const ctx = useContext(SimConnectContext);
  if (!ctx) throw new Error('useSimConnect must be used within SimConnectProvider');
  return ctx;
};
