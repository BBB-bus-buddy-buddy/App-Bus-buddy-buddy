import apiClient from '../apiClient';

export interface BusRealTimeStatus {
  busNumber: string;
  routeName: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  currentStationName: string;
  lastUpdateTime: number;
  currentStationIndex: number;
  totalStations: number;
}

export interface BusSeat {
  busNumber: string;
  totalSeats: number;
  availableSeats: number;
  occupiedSeats: number;
}

export interface BusLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface BusBoardingAction {
  busNumber: string;
  organizationId: string;
  userId: string;
  action: 'BOARD' | 'ALIGHT';
}

export const busService = {
  // 모든 버스 조회
  async getAllBuses(): Promise<BusRealTimeStatus[]> {
    const response = await apiClient.get<BusRealTimeStatus[]>('/api/bus');
    return response.data;
  },
  
  // 특정 버스 조회
  async getBusByNumber(busNumber: string): Promise<BusRealTimeStatus> {
    const response = await apiClient.get<BusRealTimeStatus>(`/api/bus/${busNumber}`);
    return response.data;
  },
  
  // 특정 정류장을 지나는 버스 조회
  async getBusesByStation(stationId: string): Promise<BusRealTimeStatus[]> {
    const response = await apiClient.get<BusRealTimeStatus[]>(`/api/bus/station/${stationId}`);
    return response.data;
  },
  
  // 버스 좌석 정보 조회
  async getBusSeats(busNumber: string): Promise<BusSeat> {
    const response = await apiClient.get<BusSeat>(`/api/bus/seats/${busNumber}`);
    return response.data;
  },
  
  // 버스 위치 조회
  async getBusLocation(busNumber: string): Promise<BusLocation> {
    const response = await apiClient.get<BusLocation>(`/api/bus/location/${busNumber}`);
    return response.data;
  },
  
  // 버스 탑승/하차 처리
  async processBusBoarding(boardingData: BusBoardingAction): Promise<boolean> {
    // 웹소켓을 사용해야 할 수도 있음
    const response = await apiClient.post<boolean>('/api/bus/boarding', boardingData);
    return response.data;
  }
};