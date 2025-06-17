// src/providers/globalWebSocketProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import GlobalWebSocketService from '../services/globalWebSocketService'; 
import { useToast } from '../components/common/Toast';

interface GlobalWebSocketContextType {
  isConnected: boolean;
  restart: () => Promise<boolean>;
  ensureConnection: () => Promise<void>;
}

const GlobalWebSocketContext = createContext<GlobalWebSocketContextType | null>(null);

interface GlobalWebSocketProviderProps {
  children: React.ReactNode;
}

export const GlobalWebSocketProvider: React.FC<GlobalWebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();
  
  const wsService = useMemo(() => GlobalWebSocketService.getInstance(), []);

  useEffect(() => {
    wsService.setToastCallback(showToast);
  }, [showToast, wsService]);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = wsService.subscribe(status => {
      if (isMounted) setIsConnected(status);
    });
    
    setIsConnected(wsService.getConnectionStatus());
    wsService.initialize();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [wsService]);

  const restart = useCallback(async (): Promise<boolean> => {
    return wsService.restart();
  }, [wsService]);

  const ensureConnection = useCallback(async (): Promise<void> => {
    return wsService.ensureConnection();
  }, [wsService]);

  const contextValue = useMemo(() => ({
    isConnected,
    restart,
    ensureConnection,
  }), [isConnected, restart, ensureConnection]);

  return (
    <GlobalWebSocketContext.Provider value={contextValue}>
      {children}
    </GlobalWebSocketContext.Provider>
  );
};

export const useGlobalWebSocket = (): GlobalWebSocketContextType => {
  const context = useContext(GlobalWebSocketContext);
  if (!context) {
    throw new Error('useGlobalWebSocket must be used within a GlobalWebSocketProvider');
  }
  return context;
};