// src/services/GlobalWebSocketService.tsx
import { AppState } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { createPassengerWebSocket } from '../api/services/websocketService';
import { authService } from '../api/services/authService';

interface UserInfo {
  userId: string;
  organizationId: string;
}

interface ToastCallback {
  (message: string, type: 'success' | 'error' | 'warning' | 'info'): void;
}

class GlobalWebSocketService {
  private static instance: GlobalWebSocketService | null = null;
  private websocket: ReturnType<typeof createPassengerWebSocket> | null = null;
  private userInfo: UserInfo | null = null;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private locationWatchId: number | null = null;
  private forcedLocationTimer: NodeJS.Timeout | null = null; // 강제 위치 전송용 타이머
  private lastLocationUpdate = 0;
  private toastCallback: ToastCallback | null = null;
  private appStateSubscription: any = null;

  // 위치 전송 간격 (5초로 단축)
  private readonly LOCATION_UPDATE_INTERVAL = 5000;
  // 재연결 시도 간격 (5초)
  private readonly RECONNECT_INTERVAL = 5000;
  // 최대 재연결 시도 횟수
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  // 강제 위치 전송 간격 (10초)
  private readonly FORCED_LOCATION_INTERVAL = 10000;
  private reconnectAttempts = 0;

  private constructor() {
    this.setupAppStateListener();
  }

  static getInstance(): GlobalWebSocketService {
    if (!GlobalWebSocketService.instance) {
      GlobalWebSocketService.instance = new GlobalWebSocketService();
    }
    return GlobalWebSocketService.instance;
  }

  // 토스트 콜백 설정
  setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    if (this.toastCallback) {
      this.toastCallback(message, type);
    }
  }

  // 앱 상태 변화 감지
  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('🔄 [GlobalWS] 앱 상태 변화:', nextAppState);
      
      if (nextAppState === 'active') {
        // 포그라운드로 돌아왔을 때
        this.ensureConnection();
      } else if (nextAppState === 'background') {
        // 백그라운드로 이동했을 때 - 연결 유지 시도
        console.log('📱 [GlobalWS] 백그라운드 모드 - 연결 유지 시도');
      }
    });
  }

  // 서비스 초기화
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 [GlobalWS] 서비스 초기화 시작');
      
      // 사용자 정보 로드
      const userdata = await authService.getUserInfo();
      if (!userdata?.email || !userdata?.organizationId) {
        console.error('❌ [GlobalWS] 사용자 정보 불완전');
        return false;
      }

      this.userInfo = {
        userId: userdata.email,
        organizationId: userdata.organizationId,
      };

      // 웹소켓 연결
      await this.connect();
      
      // 위치 추적 시작
      this.startLocationTracking();

      // 강제 위치 전송 시작
      this.startForcedLocationUpdates();

      console.log('✅ [GlobalWS] 서비스 초기화 완료');
      return true;
    } catch (error) {
      console.error('❌ [GlobalWS] 초기화 실패:', error);
      return false;
    }
  }

  // 웹소켓 연결
  private async connect(): Promise<void> {
    if (this.isConnected || !this.userInfo) {
      return;
    }

    try {
      console.log('🔌 [GlobalWS] 웹소켓 연결 시도');

      this.websocket = createPassengerWebSocket({
        onOpen: () => {
          console.log('✅ [GlobalWS] 웹소켓 연결 성공');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // 조직 구독
          if (this.websocket && this.userInfo) {
            this.websocket.subscribeToOrganization(this.userInfo.organizationId);
          }
        },
        onMessage: (data) => {
          this.handleWebSocketMessage(data);
        },
        onError: (error) => {
          console.error('❌ [GlobalWS] 웹소켓 오류:', error);
          this.isConnected = false;
          this.scheduleReconnect();
        },
        onClose: () => {
          console.log('🔴 [GlobalWS] 웹소켓 연결 종료');
          this.isConnected = false;
          this.scheduleReconnect();
        },
        onBoardingDetected: (busNumber) => {
          console.log('🎉 [GlobalWS] 자동 탑승 감지:', busNumber);
          this.showToast(`${busNumber} 버스에 탑승한 것으로 감지되었습니다.`, 'success');
        },
      });

      await this.websocket.connect('/ws/passenger');
    } catch (error) {
      console.error('❌ [GlobalWS] 연결 실패:', error);
      this.scheduleReconnect();
    }
  }

  // 웹소켓 메시지 처리
  private handleWebSocketMessage(data: any) {
    try {
      console.log('📨 [GlobalWS] 메시지 수신:', typeof data === 'string' ? data.substring(0, 100) : data);
      
      // 자동 탑승 감지 메시지 처리
      if (data?.status === 'success' && data?.message?.includes('버스 탑승이 자동으로 감지')) {
        console.log('🚌 [GlobalWS] 자동 탑승 감지 확인됨');
      }
    } catch (error) {
      console.error('❌ [GlobalWS] 메시지 처리 오류:', error);
    }
  }

  // 재연결 스케줄링
  private scheduleReconnect() {
    if (this.reconnectTimer || this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [GlobalWS] 재연결 시도 예약 (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.RECONNECT_INTERVAL);
  }

  // 위치 추적 시작
  private startLocationTracking() {
    if (this.locationWatchId !== null) {
      console.log('📍 [GlobalWS] 위치 추적 이미 실행 중');
      return;
    }

    console.log('📍 [GlobalWS] 위치 추적 시작');

    this.locationWatchId = Geolocation.watchPosition(
      (position) => {
        this.handleLocationUpdate(position);
      },
      (error) => {
        console.error('❌ [GlobalWS] 위치 오류:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // 5미터 이상 이동시에만 업데이트
        interval: 5000, // 5초마다 확인
        fastestInterval: 1000, // 최소 1초 간격
      }
    );
  }

  // 강제 위치 전송 시작
  private startForcedLocationUpdates() {
    if (this.forcedLocationTimer) {
      console.log('⏰ [GlobalWS] 강제 위치 전송 이미 실행 중');
      return;
    }

    console.log('⏰ [GlobalWS] 강제 위치 전송 시작');

    this.forcedLocationTimer = setInterval(() => {
      if (this.isConnected && this.websocket && this.userInfo) {
        console.log('🎯 [GlobalWS] 강제 위치 획득 시도');
        
        Geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ [GlobalWS] 강제 위치 획득 성공');
            this.handleLocationUpdate(position, true); // 강제 전송 플래그
          },
          (error) => {
            console.error('❌ [GlobalWS] 강제 위치 획득 실패:', error);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 5000,
            maximumAge: 30000 // 30초 이내 캐시된 위치 사용 가능
          }
        );
      } else {
        console.log('⚠️ [GlobalWS] 강제 위치 전송 조건 미충족:', {
          isConnected: this.isConnected,
          hasWebsocket: !!this.websocket,
          hasUserInfo: !!this.userInfo
        });
      }
    }, this.FORCED_LOCATION_INTERVAL);
  }

  // 위치 업데이트 처리 (강제 전송 옵션 추가)
  private handleLocationUpdate(position: any, forceUpdate: boolean = false) {
    const now = Date.now();
    
    console.log(`🕐 [GlobalWS] 위치 업데이트 체크: 현재=${now}, 마지막=${this.lastLocationUpdate}, 차이=${now - this.lastLocationUpdate}ms, 강제=${forceUpdate}`);
    
    // 강제 업데이트가 아닌 경우에만 시간 간격 체크
    if (!forceUpdate && now - this.lastLocationUpdate < this.LOCATION_UPDATE_INTERVAL) {
      console.log(`⏰ [GlobalWS] 위치 업데이트 스킵 - 간격 제한: ${now - this.lastLocationUpdate}ms < ${this.LOCATION_UPDATE_INTERVAL}ms`);
      return;
    }

    if (!this.isConnected || !this.websocket || !this.userInfo) {
      console.log('⚠️ [GlobalWS] 위치 업데이트 스킵 - 연결 상태 불완전');
      return;
    }

    const { latitude, longitude } = position.coords;
    
    console.log(`📍 [GlobalWS] 위치 전송${forceUpdate ? ' (강제)' : ''}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

    try {
      this.websocket.sendLocationUpdate({
        userId: this.userInfo.userId,
        organizationId: this.userInfo.organizationId,
        latitude,
        longitude,
        timestamp: now,
      });

      this.lastLocationUpdate = now;
      console.log('✅ [GlobalWS] 위치 전송 완료');
    } catch (error) {
      console.error('❌ [GlobalWS] 위치 전송 실패:', error);
    }
  }

  // 연결 상태 확인 및 복구
  async ensureConnection(): Promise<void> {
    if (!this.userInfo) {
      console.log('🔄 [GlobalWS] 사용자 정보 없음 - 재초기화 시도');
      await this.initialize();
      return;
    }

    if (!this.isConnected) {
      console.log('🔄 [GlobalWS] 연결 끊어짐 - 재연결 시도');
      await this.connect();
    }
  }

  // 수동 재시작
  async restart(): Promise<boolean> {
    console.log('🔄 [GlobalWS] 수동 재시작 시작');
    
    this.cleanup();
    
    // 잠시 대기 후 재시작
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.initialize();
  }

  // 연결 상태 반환
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // 정리 작업
  cleanup() {
    console.log('🧹 [GlobalWS] 정리 작업 시작');

    // 웹소켓 연결 해제
    if (this.websocket) {
      this.websocket.disconnect();
      this.websocket = null;
    }

    // 위치 추적 중지
    if (this.locationWatchId !== null) {
      Geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }

    // 강제 위치 전송 타이머 정리
    if (this.forcedLocationTimer) {
      clearInterval(this.forcedLocationTimer);
      this.forcedLocationTimer = null;
      console.log('🧹 [GlobalWS] 강제 위치 전송 타이머 정리');
    }

    // 재연결 타이머 정리
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 앱 상태 리스너 정리
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  // 싱글톤 인스턴스 해제 (테스트용)
  static destroy() {
    if (GlobalWebSocketService.instance) {
      GlobalWebSocketService.instance.cleanup();
      GlobalWebSocketService.instance = null;
    }
  }
}

export default GlobalWebSocketService;