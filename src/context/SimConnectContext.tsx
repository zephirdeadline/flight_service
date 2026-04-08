import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { simConnectService } from '../services/simConnectService';
import type { SimData } from '../types';

interface SimConnectContextType {
  isConnected: boolean;
  isStreaming: boolean;
  lastData: SimData | null;
  lastDataTime: Date | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
}

const SimConnectContext = createContext<SimConnectContextType | null>(null);

export const SimConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastData, setLastData] = useState<SimData | null>(null);
  const [lastDataTime, setLastDataTime] = useState<Date | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listen<SimData>('simconnect-data', (event) => {
      setLastData(event.payload);
      setLastDataTime(new Date());
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    const tryConnect = async () => {
      try {
        await invoke('simconnect_connect');
        await invoke('simconnect_start_streaming');
        setIsStreaming(true);
      } catch {
        // MSFS pas lancé, on réessaiera au prochain poll
      }
    };

    const poll = async () => {
      try {
        const connected = await simConnectService.isConnected();
        setIsConnected(connected);
        if (!connected) {
          setLastData(null);
          tryConnect();
        }
      } catch {
        setIsConnected(false);
        setLastData(null);
      }
    };

    tryConnect();
    poll();
    pollRef.current = setInterval(async () => {
      await poll();
    }, 3000);

    return () => {
      unlistenRef.current?.();
      if (pollRef.current) clearInterval(pollRef.current);
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
    <SimConnectContext.Provider value={{ isConnected, isStreaming, lastData, lastDataTime, startStreaming, stopStreaming }}>
      {children}
    </SimConnectContext.Provider>
  );
};

export const useSimConnect = () => {
  const ctx = useContext(SimConnectContext);
  if (!ctx) throw new Error('useSimConnect must be used within SimConnectProvider');
  return ctx;
};
