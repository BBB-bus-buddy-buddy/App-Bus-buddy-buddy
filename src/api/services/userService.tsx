import apiClient from '../apiClient';
import {Station} from './stationService';

export const userService = {
  // 내 정류장 조회
  async getMyStations(): Promise<Station[]> {
    const response = await apiClient.get<Station[]>('/api/user/my-station');
    return response.data;
  },

  // 내 정류장 추가
  async addMyStation(stationId: string): Promise<boolean> {
    const response = await apiClient.post<boolean>('/api/user/my-station', {
      stationId,
    });
    return response.data;
  },

  // 내 정류장 삭제
  async deleteMyStation(stationId: string): Promise<boolean> {
    const response = await apiClient.delete<boolean>(
      `/api/user/my-station/${stationId}`,
    );
    return response.data;
  },
};
