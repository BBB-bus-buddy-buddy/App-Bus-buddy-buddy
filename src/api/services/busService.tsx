// src/api/services/busService.tsx
import apiClient, {ApiResponse} from '../apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export interface BusInfo {
  id: string;
  busNumber: string;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  location: {
    coordinates: number[];
    type: string;
  };
  stationNames: string[];
  timestamp: string;
  position?: number;
  prevStationIdx: number;
  prevStationId: string;
  lastStationTime: string;
}

export interface StationDetail {
  id: string;
  name: string;
  sequence: number;
  isPassed: boolean;
  isCurrentStation: boolean;
  estimatedArrivalTime?: string;
  location: {
    coordinates: number[];
    type: string;
  };
  organizationId: string;
}

export interface BusArrivalEstimate {
  estimatedTime: string;
  waypoints: string[];
}

// 백엔드에서 반환하는 정류장 인터페이스
interface Station {
  id: string;
  name: string;
  location: {
    coordinates: number[]; // [경도, 위도] 배열
    type: string;
  };
  organizationId: string;
  isPassed: boolean; // 백엔드에서 isPassed로 반환
  isCurrentStation: boolean; // 백엔드에서 isCurrentStation으로 반환
  estimatedArrivalTime: string | null;
  sequence: number;
  // 추가 필드
  currentStation: boolean; // 응답에 currentStation도 있음
  passed: boolean; // 응답에 passed도 있음
}

export const busService = {
  // 모든 버스 조회
  async getAllBuses(): Promise<BusRealTimeStatus[]> {
    const response = await apiClient.get<BusRealTimeStatus[]>('/api/bus');
    return response.data;
  },

  // 특정 버스 조회
  async getBusByNumber(busNumber: string): Promise<BusRealTimeStatus> {
    const response = await apiClient.get<BusRealTimeStatus>(
      `/api/bus/${busNumber}`,
    );
    return response.data;
  },

  // 특정 정류장을 지나는 버스 조회
  async getBusesByStation(stationId: string): Promise<BusRealTimeStatus[]> {
    const response = await apiClient.get<BusRealTimeStatus[]>(
      `/api/bus/station/${stationId}`,
    );
    return response.data;
  },

  // 버스 좌석 정보 조회
  async getBusSeats(busNumber: string): Promise<BusSeat> {
    const response = await apiClient.get<BusSeat>(
      `/api/bus/seats/${busNumber}`,
    );
    return response.data;
  },

  // 버스 위치 조회
  async getBusLocation(busNumber: string): Promise<BusLocation> {
    const response = await apiClient.get<BusLocation>(
      `/api/bus/location/${busNumber}`,
    );
    return response.data;
  },

  // 버스 탑승/하차 처리
  async processBusBoarding(boardingData: BusBoardingAction): Promise<boolean> {
    const response = await apiClient.post<boolean>(
      '/api/bus/boarding',
      boardingData,
    );
    return response.data;
  },

  // 버스의 정류장 이름 목록 조회 (이전 방식)
  async getBusStationNames(busNumber: string): Promise<string[]> {
    try {
      const response = await apiClient.get<ApiResponse<string[]>>(
        `/api/bus/stationNames/${busNumber}`,
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch bus station names:', error);
      throw error;
    }
  },
  /**
   * 버스의 정류장 상세 정보 목록 조회 (최적화된 API)
   * @param busNumber 버스 번호
   * @returns 정류장 상세 정보 목록
   */
  async getBusStationsDetail(busNumber: string): Promise<Station[]> {
    try {
      const response = await apiClient.get<ApiResponse<Station[]>>(
        `/api/bus/stations-detail/${busNumber}`,
      );

      // 응답이 바로 배열로 오는 경우
      if (Array.isArray(response.data)) {
        return response.data;
      }

      // ApiResponse 형태로 오는 경우 (data 필드 안에 배열이 있는 경우)
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      console.error('예상치 못한 API 응답 형식:', response.data);
      throw new Error('API 응답 형식 오류');
    } catch (error) {
      console.error('버스 정류장 상세 정보 조회 실패:', error);
      throw error;
    }
  },
  // 도착 시간 예측
  async getArrivalEstimate(
    busId: string,
    stationId: string,
  ): Promise<BusArrivalEstimate> {
    const token = await AsyncStorage.getItem('token');
    const response = await apiClient.get<ApiResponse<BusArrivalEstimate>>(
      '/api/kakao-api/arrival-time/multi',
      {
        params: {busId, stationId},
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      },
    );
    return response.data.data;
  },
};
