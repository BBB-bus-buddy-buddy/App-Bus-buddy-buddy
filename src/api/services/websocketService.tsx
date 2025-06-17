import {Platform} from 'react-native';
import {PassengerLocationDTO} from './dto/PassengerLocationDTO';

// API 및 WebSocket 기본 URL 설정
const API_BASE_URL = Platform.select({
  ios: 'http://devse.kr:12589',
  android: 'http://devse.kr:12589',
});
const WS_BASE_URL = API_BASE_URL?.replace('http', 'ws');

// WebSocket 이벤트 콜백 인터페이스
export interface WebSocketOptions {
  onOpen: () => void;
  onMessage: (data: any) => void;
  onError: (error: any) => void;
  onClose: (event: any) => void;
}

/**
 * WebSocket 통신을 직접 담당하는 저수준(low-level) 서비스 클래스.
 * 재연결 로직 없이 연결, 해제, 메시지 전송/수신, 하트비트 기능만 수행합니다.
 */
export class WebSocketWrapper {
  private socket: WebSocket | null = null;
  private options: WebSocketOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private endpoint: string = '';

  constructor(options: WebSocketOptions) {
    this.options = options;
  }

  /**
   * 지정된 엔드포인트로 WebSocket 연결을 시도합니다.
   * @param endpoint - 연결할 WebSocket 엔드포인트 (예: '/ws/passenger')
   */
  public connect(endpoint: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('🔵 [WebSocketWrapper] WebSocket이 이미 연결되어 있습니다.');
      return;
    }

    this.endpoint = endpoint;
    const url = `${WS_BASE_URL}${this.endpoint}`;
    console.log('🔵 [WebSocketWrapper] 연결 시도:', url);

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('🔵 [WebSocketWrapper] 연결됨.');
      this.startHeartbeat();
      this.options.onOpen();
    };

    this.socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        this.options.onMessage(data);
      } catch (error) {
        // JSON 파싱 에러가 아닌 경우 원본 데이터 전달
        this.options.onMessage(event.data);
      }
    };

    this.socket.onerror = error => {
      console.error('🔵 [WebSocketWrapper] 오류 발생:', error);
      this.options.onError(error);
    };

    this.socket.onclose = event => {
      console.log('🔵 [WebSocketWrapper] 연결 종료:', event.code, event.reason);
      this.stopHeartbeat();
      this.options.onClose(event);
    };
  }

  /**
   * WebSocket으로 데이터를 전송합니다.
   * @param data - 전송할 데이터 (JSON으로 변환됨)
   */
  public send(data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.error('🔵 [WebSocketWrapper] WebSocket이 연결되지 않아 메시지를 보낼 수 없습니다.');
    }
  }

  /**
   * WebSocket 연결을 해제합니다.
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    console.log('🔵 [WebSocketWrapper] 연결이 수동으로 해제되었습니다.');
  }

  /**
   * 현재 연결 상태를 반환합니다.
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  // 조직 구독 (백엔드 BusPassengerWebSocketHandler 형식에 맞춤)
  public subscribeToOrganization(organizationId: string): void {
    this.send({
      type: 'subscribe',
      organizationId,
    });
    console.log('🔵 [WebSocketWrapper] 조직 구독 요청:', organizationId);
  }

  // 승객 위치 정보 전송 (자동 탑승 감지용, 백엔드 형식에 맞춤)
  public sendLocationUpdate(locationData: PassengerLocationDTO): void {
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
  }


  /**
   * 1분마다 하트비트 메시지를 보내 연결을 유지합니다.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 기존 하트비트가 있다면 중지
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({type: 'heartbeat'});
        console.log('🔵 [WebSocketWrapper] Ping...');
      }
    }, 60000); // 1분
  }

  /**
   * 하트비트를 중지합니다.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}