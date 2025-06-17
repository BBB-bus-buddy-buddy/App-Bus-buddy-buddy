import apiClient from '../apiClient';

// 백엔드 OperationPlanDTO에 정확히 맞춘 인터페이스
export interface OperationPlanDTO {
  id: string;
  operationId: string;
  busId: string;
  busNumber: string;
  busRealNumber: string;
  driverId: string;
  driverName: string;
  routeId: string;
  routeName: string;
  operationDate: string; // LocalDate -> "2025-06-07" 형식
  startTime: string; // LocalTime -> "08:00:00" 형식
  endTime: string; // LocalTime -> "18:00:00" 형식
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isRecurring: boolean;
  recurringWeeks?: number;
  organizationId: string;
  createdAt: string; // LocalDateTime -> ISO 형식
  updatedAt: string; // LocalDateTime -> ISO 형식
}

// 프론트엔드에서 사용할 버스 스케줄 인터페이스
export interface BusSchedule {
  id: string;
  busNumber: string;
  busRealNumber: string;
  routeName: string;
  startTime: string; // HH:mm 형식으로 변환됨
  endTime: string; // HH:mm 형식으로 변환됨
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  driverName: string;
  operationDate: string;
  organizationId: string;
  operationId: string;
  routeId: string;
  isRecurring: boolean;
  recurringWeeks?: number;
  createdAt: string;
  updatedAt: string;
}

export const operationPlanService = {
  // 오늘의 버스 운행 시간표 조회
  async getTodayBusSchedule(): Promise<BusSchedule[]> {
    try {
      const response = await apiClient.get<OperationPlanDTO[]>('/api/operation-plan/today');
      return this.convertToScheduleList(response.data);
    } catch (error) {
      console.error('오늘 운행 일정 조회 실패:', error);
      throw error;
    }
  },

  // 특정 날짜의 버스 운행 시간표 조회
  async getBusScheduleByDate(date: string): Promise<BusSchedule[]> {
    try {
      // date는 YYYY-MM-DD 형식으로 전달
      const response = await apiClient.get<OperationPlanDTO[]>(`/api/operation-plan/${date}`);
      return this.convertToScheduleList(response.data);
    } catch (error) {
      console.error('날짜별 운행 일정 조회 실패:', error);
      throw error;
    }
  },

  // 주별 운행 일정 조회
  async getWeeklyBusSchedule(): Promise<BusSchedule[]> {
    try {
      const response = await apiClient.get<OperationPlanDTO[]>('/api/operation-plan/weekly');
      return this.convertToScheduleList(response.data);
    } catch (error) {
      console.error('주별 운행 일정 조회 실패:', error);
      throw error;
    }
  },

  // 월별 운행 일정 조회
  async getMonthlyBusSchedule(): Promise<BusSchedule[]> {
    try {
      const response = await apiClient.get<OperationPlanDTO[]>('/api/operation-plan/monthly');
      return this.convertToScheduleList(response.data);
    } catch (error) {
      console.error('월별 운행 일정 조회 실패:', error);
      throw error;
    }
  },

  // 운행 일정 상세 조회
  async getOperationDetail(id: string): Promise<OperationPlanDTO> {
    try {
      const response = await apiClient.get<OperationPlanDTO>(`/api/operation-plan/detail/${id}`);
      return response.data;
    } catch (error) {
      console.error('운행 일정 상세 조회 실패:', error);
      throw error;
    }
  },

  // 운행 일정 생성 (관리자용)
  async createOperationPlan(operationPlan: Partial<OperationPlanDTO>): Promise<OperationPlanDTO[]> {
    try {
      const response = await apiClient.post<OperationPlanDTO[]>('/api/operation-plan', operationPlan);
      return response.data;
    } catch (error) {
      console.error('운행 일정 생성 실패:', error);
      throw error;
    }
  },

  // 운행 일정 수정 (관리자용)
  async updateOperationPlan(operationPlan: OperationPlanDTO): Promise<OperationPlanDTO> {
    try {
      const response = await apiClient.put<OperationPlanDTO>('/api/operation-plan', operationPlan);
      return response.data;
    } catch (error) {
      console.error('운행 일정 수정 실패:', error);
      throw error;
    }
  },

  // 운행 일정 삭제 (관리자용)
  async deleteOperationPlan(id: string): Promise<boolean> {
    try {
      const response = await apiClient.delete<boolean>(`/api/operation-plan/${id}`);
      return response.data;
    } catch (error) {
      console.error('운행 일정 삭제 실패:', error);
      throw error;
    }
  },

  // OperationPlanDTO 배열을 BusSchedule 배열로 변환
  convertToScheduleList(operations: OperationPlanDTO[]): BusSchedule[] {
    return operations.map(operation => this.convertToSchedule(operation));
  },

  // OperationPlanDTO를 BusSchedule로 변환
  convertToSchedule(operation: OperationPlanDTO): BusSchedule {
    return {
      id: operation.id,
      operationId: operation.operationId,
      busNumber: operation.busNumber || '',
      busRealNumber: operation.busRealNumber || operation.busNumber || '',
      routeName: operation.routeName || '노선 정보 없음',
      routeId: operation.routeId || '',
      startTime: this.formatTimeToHHMM(operation.startTime),
      endTime: this.formatTimeToHHMM(operation.endTime),
      status: operation.status,
      driverName: operation.driverName || '기사 정보 없음',
      operationDate: operation.operationDate,
      organizationId: operation.organizationId,
      isRecurring: operation.isRecurring,
      recurringWeeks: operation.recurringWeeks,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
    };
  },

  // Java LocalTime 형식을 HH:mm 형식으로 변환
  formatTimeToHHMM(timeString: string): string {
    if (!timeString) return '';
    
    // 이미 HH:mm 형식인 경우
    if (timeString.length === 5 && timeString.match(/^\d{2}:\d{2}$/)) {
      return timeString;
    }
    
    // HH:mm:ss 형식인 경우 (Java LocalTime의 일반적인 JSON 직렬화 형식)
    if (timeString.length >= 8 && timeString.match(/^\d{2}:\d{2}:\d{2}/)) {
      return timeString.substring(0, 5);
    }
    
    // 다른 형식인 경우 파싱 시도
    try {
      const time = new Date(`1970-01-01T${timeString}`);
      return time.toTimeString().substring(0, 5);
    } catch (error) {
      console.warn('시간 포맷 변환 실패:', timeString, error);
      return timeString;
    }
  },

  // 날짜 포맷 유틸리티
  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // YYYY-MM-DD 형식인 경우 그대로 반환
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      
      // 다른 형식인 경우 변환
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('날짜 포맷 변환 실패:', error);
      return dateString;
    }
  },

  // 현재 날짜를 YYYY-MM-DD 형식으로 반환
  getTodayDateString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  },

  // LocalDateTime 형식을 사용자 친화적인 형식으로 변환
  formatDateTime(dateTimeString: string): string {
    if (!dateTimeString) return '';
    
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('날짜시간 포맷 변환 실패:', error);
      return dateTimeString;
    }
  },

  // 상태 한글 변환
  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'SCHEDULED': '운행 예정',
      'IN_PROGRESS': '운행 중',
      'COMPLETED': '운행 완료',
      'CANCELLED': '운행 취소',
    };
    return statusMap[status] || status;
  },

  // 반복 정보 텍스트 생성
  getRecurringText(isRecurring: boolean, recurringWeeks?: number): string {
    if (!isRecurring) return '단회 운행';
    if (!recurringWeeks) return '반복 운행';
    return `${recurringWeeks}주간 반복`;
  },
};