// src/services/globalWebSocketService.tsx

import { AppState, AppStateStatus } from 'react-native';
import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';
import { WebSocketWrapper } from '../api/services/websocketService';
import { authService } from '../api/services/authService';
import { busService } from '../api/services/busService';
import useBusStore, { BusPosition } from '../store/useBusStore';

// 타입 정의
interface UserInfo {
  userId: string;
  organizationId: string;
}
type StatusChangeListener = (isConnected: boolean) => void;
type ToastCallback = (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

class GlobalWebSocketService {
  private static instance: GlobalWebSocketService | null = null;
  private userInfo: UserInfo | null = null;
  private isInitialized = false;
  private isConnecting = false;
  private websocket: WebSocketWrapper | null = null;
  private locationWatchId: number | null = null;
  private statusListeners: Set<StatusChangeListener> = new Set();
  private toastCallback: ToastCallback | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  public static getInstance(): GlobalWebSocketService {
    if (!GlobalWebSocketService.instance) {
      GlobalWebSocketService.instance = new GlobalWebSocketService();
    }
    return GlobalWebSocketService.instance;
  }

  // --- Public API ---
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      this.ensureConnection();
      return true;
    }
    try {
      const userdata = await authService.getUserInfo();
      if (!userdata?.email || !userdata?.organizationId) return false;

      this.userInfo = { userId: userdata.email, organizationId: userdata.organizationId };
      this.websocket = new WebSocketWrapper({
        onOpen: this.onWebSocketOpen,
        onMessage: this.onWebSocketMessage,
        onError: this.onWebSocketError,
        onClose: this.onWebSocketClose,
      });

      await this.connect();
      this.startLocationTracking();
      this.startPeriodicBusSync();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ [GlobalWS] 초기화 중 심각한 오류 발생:', error);
      return false;
    }
  }

  public async restart(): Promise<boolean> {
    this.cleanup();
    this.isInitialized = false;
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.initialize();
  }

  public async ensureConnection(): Promise<void> {
    if (!this.websocket?.isConnected() && !this.isConnecting) {
      await this.connect();
    }
  }

  public getConnectionStatus = (): boolean => this.websocket?.isConnected() ?? false;
  
  public subscribe(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public setToastCallback = (callback: ToastCallback) => {
    this.toastCallback = callback;
  }

  // --- WebSocket Event Handlers ---
  private onWebSocketOpen = () => {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.notifyStatusChange(true);
    if (this.userInfo) {
      this.websocket?.subscribeToOrganization(this.userInfo.organizationId);
    }
    this.syncFullBusList();
  };
  
  private onWebSocketMessage = (data: any) => {
    // 백엔드가 JSON 메시지만 보내므로, 객체 타입인지 먼저 확인
    if (typeof data === 'object' && data !== null) {
      // 1. 버스 실시간 상태 업데이트 처리
      if (data.type === 'busUpdate' && data.data) {
        const busData: BusPosition = data.data;

        // 유효하지 않은 (0,0) 좌표 필터링
        if (Math.abs(busData.latitude) < 0.1 && Math.abs(busData.longitude) < 0.1) {
            console.log(`[GlobalWS] 유효하지 않은 좌표(0,0)를 가진 버스(${busData.busNumber}) 업데이트를 무시합니다.`);
            return;
        }

        const currentPositions = useBusStore.getState().busPositions;
        const index = currentPositions.findIndex(p => p.busNumber === busData.busNumber);

        let newPositions = [...currentPositions];
        if (index > -1) { // 기존 버스 정보 업데이트
          newPositions[index] = busData;
        } else { // 새 버스 추가
          newPositions.push(busData);
        }
        
        // 운행 중인 버스만 필터링하여 스토어 최종 업데이트
        useBusStore.getState().setBusPositions(newPositions.filter(p => p.operate));
        return;
      }
      
      // 2. 탑승 감지 등 기타 알림 메시지 처리
      if (data.type === 'boarding_detected' || (data.status === 'success' && data.message?.includes('탑승'))) {
          const busNumber = data.data?.busNumber || data.message?.match(/(\d+)/)?.[1] || '정보 없음';
          this.showToast(`${busNumber} 버스 탑승이 감지되었습니다!`, 'success');
      }
    } else {
        // 예상치 못한 다른 타입의 데이터가 올 경우 로그 기록
        console.warn("[GlobalWS] 예상치 못한 타입의 WebSocket 메시지 수신:", data);
    }
  };

  private onWebSocketError = (error: any) => {
    this.isConnecting = false;
    this.notifyStatusChange(false);
    this.scheduleReconnect();
  };
  
  private onWebSocketClose = (event: any) => {
    this.isConnecting = false;
    this.notifyStatusChange(false);
    useBusStore.getState().clearBusPositions();
    if (event.code !== 1000) this.scheduleReconnect();
  };
  
  // --- Internal Logic ---
  private syncFullBusList = async () => {
    if (!this.isInitialized || !this.userInfo) return;
    try {
      const buses = await busService.getOperatingBuses();
      const validBuses = buses.filter(bus => !(Math.abs(bus.latitude) < 0.1 && Math.abs(bus.longitude) < 0.1));
      useBusStore.getState().setBusPositions(validBuses.map(bus => ({
          busNumber: bus.busNumber,
          busRealNumber: bus.busRealNumber,
          latitude: bus.latitude,
          longitude: bus.longitude,
          operate: bus.operate,
      })));
    } catch (error) {
      console.error('❌ [GlobalWS] 전체 버스 목록 동기화 실패:', error);
    }
  }
  
  private startPeriodicBusSync = () => {
      this.stopPeriodicBusSync();
      this.syncInterval = setInterval(() => {
          this.syncFullBusList();
      }, 60000); // 1분마다 동기화
  }

  private stopPeriodicBusSync = () => {
      if (this.syncInterval) clearInterval(this.syncInterval);
      this.syncInterval = null;
  }

  private connect = async (): Promise<void> => {
    if (this.websocket?.isConnected() || this.isConnecting || !this.userInfo || !this.websocket) return;
    this.isConnecting = true;
    this.websocket.connect('/ws/passenger');
  };

  private scheduleReconnect = () => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  };

  /**
   * *** 중요: 수정된 위치 추적 로직 ***
   * 백엔드의 최소 업데이트 간격(3초)을 고려하여 프론트엔드의 전송 주기를 조정합니다.
   */
  private startLocationTracking = () => {
    if (this.locationWatchId !== null) return;
    console.log('📍 [GlobalWS] 위치 추적을 시작합니다.');
    
    this.locationWatchId = Geolocation.watchPosition(
      this.handleLocationUpdate,
      (error) => console.error('❌ [GlobalWS] 위치 추적 오류:', error),
      {
        enableHighAccuracy: true,
        interval: 10000,         // 위치 확인 주기: 10초
        fastestInterval: 5000,   // 최소 업데이트 간격: 5초 (백엔드 3초 제한보다 길게 설정)
      }
    );
  };
  
  private handleLocationUpdate = (position: GeolocationResponse) => {
    if (!this.websocket?.isConnected() || !this.userInfo) return;
    const { latitude, longitude } = position.coords;
    this.websocket.sendLocationUpdate({
      userId: this.userInfo.userId,
      organizationId: this.userInfo.organizationId,
      latitude,
      longitude,
      timestamp: Date.now(),
    });
  };

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      this.ensureConnection();
      this.syncFullBusList();
      this.startPeriodicBusSync();
    } else {
      this.stopPeriodicBusSync();
    }
  };

  private notifyStatusChange(isConnected: boolean) {
    this.statusListeners.forEach(listener => listener(isConnected));
  }
  
  private showToast: ToastCallback = (message, type = 'info') => {
    this.toastCallback?.(message, type);
  }

  private cleanup = () => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.locationWatchId !== null) {
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    this.websocket?.disconnect();
    this.websocket = null;
    this.isConnecting = false;
    this.notifyStatusChange(false);
    this.stopPeriodicBusSync();
  };
}

export default GlobalWebSocketService;