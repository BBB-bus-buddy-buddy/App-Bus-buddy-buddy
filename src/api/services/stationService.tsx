// src/api/services/stationService.tsx 개선
import apiClient from '../apiClient';

export interface Station {
  id: string;
  name: string;
  location?: {
    y: number;
    x: number;
    coordinates: number[]; // [longitude, latitude]
    type: string; // 일반적으로 "Point"
  };
  organizationId?: string;
}

export interface StationArrivalTimeResponse {
  estimatedTime: string;
  waypoints: string[];
}

export const stationService = {
  // 모든 정류장 조회
  async getAllStations(): Promise<Station[]> {
    const response = await apiClient.get<Station[]>('/api/station');
    return response.data;
  },

  // 정류장 이름으로 검색
  async searchStationsByName(name: string): Promise<Station[]> {
    const response = await apiClient.get<Station[]>('/api/station', {
      params: {name},
    });
    return response.data;
  },

  // 정류장 생성
  async createStation(stationData: {
    name: string;
    latitude: number;
    longitude: number;
  }): Promise<Station> {
    const response = await apiClient.post<Station>('/api/station', stationData);
    return response.data;
  },

  // 정류장 업데이트
  async updateStation(
    id: string,
    stationData: {name: string; latitude: number; longitude: number},
  ): Promise<string> {
    const response = await apiClient.put<string>(
      `/api/station/${id}`,
      stationData,
    );
    return response.data;
  },

  // 정류장 삭제
  async deleteStation(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/station/${id}`);
  },

  // 버스 도착 시간 예측 (deprecated - 이제 busService.getArrivalEstimate 사용)
  async getArrivalEstimate(
    busId: string,
    stationId: string,
  ): Promise<StationArrivalTimeResponse> {
    const response = await apiClient.get<StationArrivalTimeResponse>(
      '/api/kakao-api/arrival-time/multi',
      {
        params: {busId, stationId},
      },
    );
    return response.data;
  },
};
