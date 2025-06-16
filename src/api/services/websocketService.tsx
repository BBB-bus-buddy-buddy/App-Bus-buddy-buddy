// src/api/services/websocketService.tsx
import {Platform} from 'react-native';
import {PassengerLocationDTO} from './dto/PassengerLocationDTO';

interface WebSocketOptions {
  onOpen?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
  onBoardingDetected?: (busNumber: string) => void;
  onBusUpdate?: (busStatus: any) => void; // 버스 상태 업데이트 콜백
}

const API_BASE_URL = Platform.select({
  ios: 'http://devse.kr:12589',
  android: 'http://devse.kr:12589',
});

// 웹소켓 URL
const WS_BASE_URL = API_BASE_URL?.replace('http', 'ws');

export class BusPassengerWebSocketService {
  private socket: WebSocket | null = null;
  private options: WebSocketOptions;
  private autoReconnect: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 3000; // 3초
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private organizationId: string | null = null;

  constructor(options: WebSocketOptions = {}) {
    this.options = options;
  }

  async connect(endpoint: string, organizationId?: string): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }

    if (organizationId) {
      this.organizationId = organizationId;
    }

    try {
      const url = `${WS_BASE_URL}${endpoint}`;
      console.log('승객 WebSocket 연결 시도:', url);

      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('승객 WebSocket 연결됨');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.options.onOpen?.();

        // 연결 후 자동으로 조직 구독
        if (this.organizationId) {
          setTimeout(() => {
            this.subscribeToOrganization(this.organizationId!);
          }, 1000);
        }
      };

      this.socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          console.log('승객 WebSocket 메시지 수신:', data);

          // 백엔드 응답 메시지 타입에 따른 처리
          if (data.type === 'connection_established') {
            console.log('연결 확인:', data.message);
          } else if (data.type === 'busUpdate') {
            // 버스 상태 업데이트
            this.options.onBusUpdate?.(data.data);
          } else if (data.status === 'success' && data.message) {
            // 자동 탑승/하차 감지 메시지 처리
            if (data.message.includes('탑승') || data.message.includes('하차') || data.message.includes('감지')) {
              console.log('탑승/하차 감지:', data.message);
              // 버스 번호 추출 (메시지에서)
              const busNumberMatch = data.message.match(/(\d+)/);
              const busNumber = busNumberMatch ? busNumberMatch[1] : 'unknown';
              this.options.onBoardingDetected?.(busNumber);
            }
          } else if (data.type === 'heartbeat_response') {
            console.log('하트비트 응답 수신');
          } else if (data.status === 'error') {
            console.error('서버 오류 메시지:', data.message);
          }

          this.options.onMessage?.(data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      this.socket.onerror = error => {
        console.error('승객 WebSocket 오류:', error);
        this.options.onError?.(error);
      };

      this.socket.onclose = event => {
        console.log('승객 WebSocket 연결 종료:', event.code, event.reason);
        this.stopHeartbeat();
        this.options.onClose?.();

        if (
          this.autoReconnect &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
          );
          setTimeout(() => {
            this.connect(endpoint, this.organizationId || undefined);
          }, this.reconnectInterval);
        }
      };
    } catch (error) {
      console.error('승객 WebSocket 연결 오류:', error);
    }
  }

  send(data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      console.log('승객 WebSocket 메시지 전송:', message);
      this.socket.send(message);
    } else {
      console.error('승객 WebSocket이 연결되지 않음');
    }
  }

  // 조직 구독 (백엔드 BusPassengerWebSocketHandler 형식에 맞춤)
  subscribeToOrganization(organizationId: string): void {
    this.organizationId = organizationId;
    this.send({
      type: 'subscribe',
      organizationId,
    });
    console.log('조직 구독 요청:', organizationId);
  }

  // 버스 탑승/하차 요청 (백엔드 형식에 맞춤)
  sendBoardingAction(data: {
    busNumber: string;
    organizationId: string;
    userId: string;
    action: 'BOARD' | 'ALIGHT';
  }): void {
    this.send({
      type: 'boarding',
      organizationId: data.organizationId,
      data: {
        busNumber: data.busNumber,
        userId: data.userId,
        action: data.action,
      },
    });
    console.log('탑승/하차 요청:', data.action, data.busNumber);
  }

  // 승객 위치 정보 전송 (자동 탑승 감지용, 백엔드 형식에 맞춤)
  sendLocationUpdate(locationData: PassengerLocationDTO): void {
    this.send({
      type: 'location',
      organizationId: locationData.organizationId,
      data: {
        userId: locationData.userId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
      },
    });
    // 너무 많은 로그 방지를 위해 가끔만 로그 출력
    if (Date.now() % 10000 < 100) { // 약 10초에 한 번
      console.log('위치 데이터 전송:', locationData.userId);
    }
  }

  // 버스 상태 조회 요청
  requestBusStatus(organizationId: string, busNumber?: string): void {
    this.send({
      type: 'get_bus_status',
      organizationId,
      busNumber,
    });
    console.log('버스 상태 조회 요청:', busNumber || '전체');
  }

  // 하트비트 시작
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({type: 'heartbeat'});
      }
    }, 60000); // 1분마다 하트비트
  }

  // 하트비트 중지
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect(): void {
    this.autoReconnect = false;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    console.log('승객 WebSocket 연결 해제됨');
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// 팩토리 함수 - 승객용만
export const createPassengerWebSocket = (
  callbacks: WebSocketOptions,
): BusPassengerWebSocketService => {
  return new BusPassengerWebSocketService(callbacks);
};