// src/providers/globalWebSocketProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
// 파일 경로의 대소문자를 실제 파일명(globalWebSocketService.tsx)과 일치시켰습니다.
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
  
  // 서비스 인스턴스를 한 번만 가져옵니다.
  const wsService = useMemo(() => GlobalWebSocketService.getInstance(), []);

  // 서비스에 토스트 콜백을 설정합니다.
  useEffect(() => {
    wsService.setToastCallback(showToast);
  }, [showToast, wsService]);

  // 서비스 초기화 및 상태 변화 구독
  useEffect(() => {
    let isMounted = true;

    // 서비스의 연결 상태 변경을 구독합니다.
    const unsubscribe = wsService.subscribe(status => {
      if (isMounted) {
        setIsConnected(status);
      }
    });
    
    // 초기 상태 설정
    setIsConnected(wsService.getConnectionStatus());

    // 서비스 초기화
    wsService.initialize();

    return () => {
      isMounted = false;
      unsubscribe(); // 컴포넌트 언마운트 시 구독 해제
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

// 커스텀 훅
export const useGlobalWebSocket = (): GlobalWebSocketContextType => {
  const context = useContext(GlobalWebSocketContext);
  if (!context) {
    throw new Error('useGlobalWebSocket must be used within a GlobalWebSocketProvider');
  }
  return context;
};