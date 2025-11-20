import { AppState, AppStateStatus, Platform } from 'react-native';
import Geolocation, { GeolocationResponse, GeolocationError } from '@react-native-community/geolocation';
import { check, PERMISSIONS, request, RESULTS, PermissionStatus } from 'react-native-permissions';
import { WebSocketWrapper } from '../api/services/websocketService';
import { authService } from '../api/services/authService';
import { busService } from '../api/services/busService';
import useBusStore, { BusPosition } from '../store/useBusStore';
import useBoardingStore from '../store/useBoardingStore';

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
  
  // --- 수정: watchId 대신 interval ID를 관리합니다. ---
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private readonly LOCATION_UPDATE_INTERVAL_MS = 10000; // 10초

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

  // --- 이하 코드는 이전과 거의 동일하나, 위치 추적 관련 부분만 변경됩니다. ---

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      this.ensureConnection();
      return true;
    }
    try {
      const userdata = await authService.getUserInfo();
      if (!userdata?.email || !userdata?.organizationId) {
        console.error("초기화 실패: 사용자 정보 없음");
        return false;
      }

      this.userInfo = { userId: userdata.email, organizationId: userdata.organizationId };
      this.websocket = new WebSocketWrapper({
        onOpen: this.onWebSocketOpen,
        onMessage: this.onWebSocketMessage,
        onError: this.onWebSocketError,
        onClose: this.onWebSocketClose,
      });

      await this.connect();
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

  public getConnectionStatus = (): boolean => {
    return this.websocket?.isConnected() ?? false;
  }
  
  public subscribe(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }

  private onWebSocketOpen = () => {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.notifyStatusChange(true);
    if (this.userInfo) {
      this.websocket?.subscribeToOrganization(this.userInfo.organizationId);
    }
    this.startLocationTracking(); 
    this.syncFullBusList();
  };
  
  private onWebSocketMessage = (data: any) => {
    console.log('📩 [GlobalWS] WebSocket 메시지 수신:', JSON.stringify(data));

    if (typeof data === 'object' && data !== null) {
      if (data.type === 'busUpdate' && data.data) {
        const busData: BusPosition = data.data;
        if (Math.abs(busData.latitude) < 1 && Math.abs(busData.longitude) < 1) {
            return;
        }
        const currentPositions = useBusStore.getState().busPositions;
        const index = currentPositions.findIndex(p => p.busNumber === busData.busNumber);
        let newPositions = [...currentPositions];
        if (index > -1) {
          newPositions[index] = busData;
        } else {
          newPositions.push(busData);
        }
        useBusStore.getState().setBusPositions(newPositions.filter(p => p.operate));
        return;
      }
      if (data.type === 'boarding_update') {
        console.log('🚌 [GlobalWS] 탑승 업데이트 수신!', data);
        if (data.status === 'boarded' && data.data?.busNumber) {
          const busNumber = data.data.busNumber;
          console.log(`✅ [GlobalWS] 탑승 인식: ${busNumber}`);
          this.showToast(`${busNumber} 버스 탑승이 감지되었습니다!`, 'success');
          useBoardingStore.getState().boardBus(busNumber);
        } else if (data.status === 'alighted') {
          console.log('🚪 [GlobalWS] 하차 인식');
          this.showToast(`버스에서 하차했습니다.`, 'info');
          useBoardingStore.getState().alightBus();
        }
      }
    } else {
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
    if (event.code !== 1000) {
        this.scheduleReconnect();
    }
  };
  
  private syncFullBusList = async () => {
    if (!this.isInitialized || !this.userInfo) return;
    try {
      const buses = await busService.getOperatingBuses();
      const validBuses = buses.filter(bus => !(Math.abs(bus.latitude) < 1 && Math.abs(bus.longitude) < 1));
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
      this.syncInterval = setInterval(() => { this.syncFullBusList(); }, 60000);
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
   * *** 중요: 시간 기반으로 위치를 주기적으로 가져오도록 로직 전면 수정 ***
   */
  private startLocationTracking = async () => {
    if (this.locationUpdateInterval) {
      console.log('📍 [GlobalWS] 위치 추적이 이미 실행 중입니다.');
      return;
    }
    console.log('📍 [GlobalWS] 시간 기반 위치 추적을 시작합니다.');

    const locationPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

    let status: PermissionStatus = await check(locationPermission);
    if (status !== RESULTS.GRANTED) {
      status = await request(locationPermission);
    }

    if (status !== RESULTS.GRANTED) {
      this.showToast('위치 권한이 거부되어 위치 추적을 시작할 수 없습니다.', 'error');
      console.error('❌ [GlobalWS] 위치 권한이 최종적으로 거부되었습니다.');
      return;
    }

    // 10초마다 위치를 가져와서 전송
    this.locationUpdateInterval = setInterval(() => {
      Geolocation.getCurrentPosition(
        this.handleLocationUpdate, // 성공 시 전송
        (error: GeolocationError) => {
          console.error(`❌ [GlobalWS] getCurrentPosition 오류 (코드 ${error.code}): ${error.message}`);
          console.error('❌ [GlobalWS] PERMISSION_DENIED=1, POSITION_UNAVAILABLE=2, TIMEOUT=3');
        },
        Platform.OS === 'android'
          ? { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 } // 네트워크 기반 위치
          : { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    }, this.LOCATION_UPDATE_INTERVAL_MS);
  };
  
  // handleLocationUpdate는 이제 Throttling 없이 단순 전송만 담당
  private handleLocationUpdate = (position: GeolocationResponse) => {
    if (!this.websocket?.isConnected() || !this.userInfo) {
      return;
    }
    
    console.log(`✅ [GlobalWS] 새 위치 수신: (Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude})`);

    try {
      const { latitude, longitude } = position.coords;
      this.websocket.sendLocationUpdate({
        userId: this.userInfo.userId,
        organizationId: this.userInfo.organizationId,
        latitude,
        longitude,
        timestamp: Date.now(),
      });
      console.log('🚀 [GlobalWS] 위치 정보 전송 성공!');
    } catch (error) {
      console.error('❌ [GlobalWS] 위치 정보 전송 중 예외 발생:', error);
    }
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

  // --- 수정: cleanup 로직 변경 ---
  private cleanup = () => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    // watchId 대신 interval을 clear합니다.
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }

    this.websocket?.disconnect();
    this.websocket = null;
    this.isConnecting = false;
    this.notifyStatusChange(false);
    this.stopPeriodicBusSync();
  };
}

export default GlobalWebSocketService;