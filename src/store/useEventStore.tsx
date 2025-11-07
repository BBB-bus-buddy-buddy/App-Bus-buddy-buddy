import {create} from 'zustand';
import {Event, EventMission, EventReward, EventParticipation} from '../api/services/eventService';

interface EventState {
  // 현재 이벤트 정보
  currentEvent: Event | null;
  // 미션 목록
  missions: EventMission[];
  // 상품 목록
  rewards: EventReward[];
  // 내 참여 현황
  participation: EventParticipation | null;
  // 로딩 상태
  isLoading: boolean;

  // 액션
  setCurrentEvent: (event: Event | null) => void;
  setMissions: (missions: EventMission[]) => void;
  setRewards: (rewards: EventReward[]) => void;
  setParticipation: (participation: EventParticipation | null) => void;
  setLoading: (loading: boolean) => void;

  // 미션 완료 상태 업데이트
  updateMissionCompletion: (missionId: string, isCompleted: boolean) => void;

  // 전체 초기화
  resetEventState: () => void;
}

/**
 * 이벤트 상태 관리 Zustand 스토어
 * CoShow 부스 이벤트의 모든 상태를 관리
 */
const useEventStore = create<EventState>(set => ({
  currentEvent: null,
  missions: [],
  rewards: [],
  participation: null,
  isLoading: false,

  setCurrentEvent: event => {
    console.log('🎉 [EventState] 이벤트 설정:', event?.name);
    set({currentEvent: event});
  },

  setMissions: missions => {
    console.log('📋 [EventState] 미션 목록 설정:', missions.length, '개');
    set({missions});
  },

  setRewards: rewards => {
    console.log('🎁 [EventState] 상품 목록 설정:', rewards.length, '개');
    set({rewards});
  },

  setParticipation: participation => {
    console.log('👤 [EventState] 참여 현황 설정:', participation);
    set({participation});
  },

  setLoading: loading => {
    set({isLoading: loading});
  },

  updateMissionCompletion: (missionId, isCompleted) => {
    set(state => ({
      missions: state.missions.map(mission =>
        mission.id === missionId ? {...mission, isCompleted} : mission,
      ),
    }));
  },

  resetEventState: () => {
    console.log('🔄 [EventState] 이벤트 상태 초기화');
    set({
      currentEvent: null,
      missions: [],
      rewards: [],
      participation: null,
      isLoading: false,
    });
  },
}));

export default useEventStore;
