import apiClient from '../apiClient';

export interface BusSchedule {
  id: string;
  busNumber: string;
  busRealNumber: string;
  routeName: string;
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  driverName: string;
}

export const operationPlanService = {
  // 오늘의 버스 운행 시간표 조회 (사용자용)
  async getTodayBusSchedule(): Promise<BusSchedule[]> {
    const response = await apiClient.get<BusSchedule[]>('/api/operation-plan/today');
    return response.data;
  },

  // 특정 날짜의 버스 운행 시간표 조회
  async getBusScheduleByDate(date: string): Promise<BusSchedule[]> {
    const response = await apiClient.get<BusSchedule[]>(`/api/operation-plan/${date}`);
    return response.data;
  },
};