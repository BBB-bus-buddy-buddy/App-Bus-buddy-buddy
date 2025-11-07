// src/api/services/eventService.tsx
import apiClient, {ApiResponse} from '../apiClient';

/**
 * 이벤트 정보
 */
export interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  organizationId: string;
  missions: EventMission[];
  rewards: EventReward[];
  createdAt: string;
}

/**
 * 미션 타입
 */
export enum MissionType {
  BOARDING = 'BOARDING', // 특정 버스 탑승
  VISIT_STATION = 'VISIT_STATION', // 특정 정류장 방문
  AUTO_DETECT_BOARDING = 'AUTO_DETECT_BOARDING', // 자동 승하차 감지 완료
}

/**
 * 이벤트 미션
 */
export interface EventMission {
  id: string;
  eventId: string;
  title: string;
  description: string;
  missionType: MissionType;
  targetValue: string;
  isRequired: boolean;
  order: number;
  isCompleted: boolean;
}

/**
 * 이벤트 상품
 */
export interface EventReward {
  id: string;
  eventId: string;
  rewardName: string;
  rewardGrade: number; // 1~5등
  probability: number; // 확률 (0.0 ~ 1.0)
  totalQuantity: number;
  remainingQuantity: number;
  imageUrl: string;
  description: string;
}

/**
 * 참여 현황
 */
export interface EventParticipation {
  id: string;
  eventId: string;
  userId: string;
  completedMissions: string[];
  isEligibleForDraw: boolean; // 뽑기 자격 여부
  hasDrawn: boolean; // 뽑기 완료 여부
  drawnReward: EventReward | null; // 당첨된 상품
  drawTimestamp: string | null;
}

/**
 * 미션 완료 요청
 */
export interface MissionCompleteRequest {
  eventId: string;
  missionId: string;
  targetValue: string;
}

/**
 * 뽑기 결과
 */
export interface RewardDrawResponse {
  success: boolean;
  reward: EventReward;
  message: string;
}

/**
 * 현재 진행 중인 이벤트 조회
 */
export const getCurrentEvent = async (): Promise<Event> => {
  const response = await apiClient.get<ApiResponse<Event>>('/api/event/current');
  return response.data.data;
};

/**
 * 이벤트 미션 목록 조회
 */
export const getEventMissions = async (eventId: string): Promise<EventMission[]> => {
  const response = await apiClient.get<ApiResponse<EventMission[]>>(
    `/api/event/${eventId}/missions`,
  );
  return response.data.data;
};

/**
 * 이벤트 상품 목록 조회
 */
export const getEventRewards = async (eventId: string): Promise<EventReward[]> => {
  const response = await apiClient.get<ApiResponse<EventReward[]>>(
    `/api/event/${eventId}/rewards`,
  );
  return response.data.data;
};

/**
 * 미션 완료 처리
 */
export const completeMission = async (
  request: MissionCompleteRequest,
): Promise<EventParticipation> => {
  const response = await apiClient.post<ApiResponse<EventParticipation>>(
    '/api/event/complete-mission',
    request,
  );
  return response.data.data;
};

/**
 * 랜덤 뽑기 실행
 */
export const drawReward = async (eventId: string): Promise<RewardDrawResponse> => {
  const response = await apiClient.post<ApiResponse<RewardDrawResponse>>(
    `/api/event/${eventId}/draw-reward`,
  );
  return response.data.data;
};

/**
 * 내 참여 현황 조회
 */
export const getMyParticipation = async (eventId: string): Promise<EventParticipation> => {
  const response = await apiClient.get<ApiResponse<EventParticipation>>(
    `/api/event/${eventId}/my-participation`,
  );
  return response.data.data;
};
