// src/providers/GlobalWebSocketProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import GlobalWebSocketService from '../services/GlobalWebSocketService';
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
  const wsService = GlobalWebSocketService.getInstance();

  // 토스트 콜백 설정
  useEffect(() => {
    wsService.setToastCallback(showToast);
  }, [showToast, wsService]);

  // 연결 상태 업데이트
  const updateConnectionStatus = useCallback(() => {
    const status = wsService.getConnectionStatus();
    setIsConnected(status);
  }, [wsService]);

  // 웹소켓 서비스 초기화
  useEffect(() => {
    let mounted = true;

    const initializeService = async () => {
      try {
        console.log('🚀 [Provider] 웹소켓 서비스 초기화 시작');
        const success = await wsService.initialize();
        
        if (mounted) {
          if (success) {
            console.log('✅ [Provider] 웹소켓 서비스 초기화 성공');
            updateConnectionStatus();
          } else {
            console.log('❌ [Provider] 웹소켓 서비스 초기화 실패');
          }
        }
      } catch (error) {
        console.error('❌ [Provider] 초기화 중 오류:', error);
      }
    };

    initializeService();

    return () => {
      mounted = false;
    };
  }, [wsService, updateConnectionStatus]);

  // 연결 상태 모니터링
  useEffect(() => {
    const interval = setInterval(() => {
      updateConnectionStatus();
    }, 5000); // 5초마다 연결 상태 확인

    return () => clearInterval(interval);
  }, [updateConnectionStatus]);

  // 앱 상태 변화 감지 (추가 보험)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('📱 [Provider] 앱 활성화 - 연결 상태 확인');
        setTimeout(() => {
          wsService.ensureConnection();
          updateConnectionStatus();
        }, 1000);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [wsService, updateConnectionStatus]);

  // 재시작 함수
  const restart = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔄 [Provider] 웹소켓 재시작 요청');
      const success = await wsService.restart();
      updateConnectionStatus();
      
      if (success) {
        showToast('위치 추적이 재시작되었습니다.', 'success');
      } else {
        showToast('위치 추적 재시작에 실패했습니다.', 'error');
      }
      
      return success;
    } catch (error) {
      console.error('❌ [Provider] 재시작 실패:', error);
      showToast('위치 추적 재시작 중 오류가 발생했습니다.', 'error');
      return false;
    }
  }, [wsService, updateConnectionStatus, showToast]);

  // 연결 확인 함수
  const ensureConnection = useCallback(async (): Promise<void> => {
    try {
      await wsService.ensureConnection();
      updateConnectionStatus();
    } catch (error) {
      console.error('❌ [Provider] 연결 확인 실패:', error);
    }
  }, [wsService, updateConnectionStatus]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 앱이 완전히 종료될 때만 정리하고, 일반적인 네비게이션에서는 정리하지 않음
      console.log('🧹 [Provider] 컴포넌트 언마운트');
    };
  }, []);

  const contextValue: GlobalWebSocketContextType = {
    isConnected,
    restart,
    ensureConnection,
  };

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

export default GlobalWebSocketProvider;