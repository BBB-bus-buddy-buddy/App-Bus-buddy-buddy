import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WebSocketOptions {
  onOpen?: () => void;
  onMessage?: (data: any) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

const API_BASE_URL = Platform.select({
  ios: 'http://localhost:8088',
  android: 'http://10.0.2.2:8088',
});

// 웹소켓 URL
const WS_BASE_URL = API_BASE_URL?.replace('http', 'ws');

export class WebSocketService {
  private socket: WebSocket | null = null;
  private options: WebSocketOptions;
  private autoReconnect: boolean = true;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 3000; // 3초
  
  constructor(options: WebSocketOptions = {}) {
    this.options = options;
  }
  
  async connect(endpoint: string): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem('token');
      const url = `${WS_BASE_URL}${endpoint}${token ? `?token=${token}` : ''}`;
      
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.options.onOpen?.();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.options.onMessage?.(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.options.onError?.(error);
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket closed');
        this.options.onClose?.();
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => {
            this.connect(endpoint);
          }, this.reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }
  
  send(data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }
  
  disconnect(): void {
    this.autoReconnect = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export class BusDriverWebSocketService extends WebSocketService {
  constructor(options: WebSocketOptions = {}) {
    super(options);
  }
  
  // 버스 위치 업데이트 전송
  sendLocationUpdate(data: {
    busNumber: string;
    organizationId: string;
    latitude: number;
    longitude: number;
    occupiedSeats: number;
    timestamp: number;
  }): void {
    this.send(data);
  }
}

export class BusPassengerWebSocketService extends WebSocketService {
  constructor(options: WebSocketOptions = {}) {
    super(options);
  }
  
  // 버스 구독
  subscribeToOrganization(organizationId: string): void {
    this.send({
      type: 'subscribe',
      organizationId
    });
  }
  
  // 버스 탑승/하차 요청
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
        action: data.action
      }
    });
  }
}

// 싱글톤 인스턴스 생성
export const createDriverWebSocket = (callbacks: WebSocketOptions): BusDriverWebSocketService => {
  return new BusDriverWebSocketService(callbacks);
};

export const createPassengerWebSocket = (callbacks: WebSocketOptions): BusPassengerWebSocketService => {
  return new BusPassengerWebSocketService(callbacks);
};