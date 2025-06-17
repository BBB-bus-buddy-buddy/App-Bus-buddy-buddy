// src/store/useBusStore.tsx

import { create } from 'zustand';

// 버스 위치 데이터 타입 정의
export interface BusPosition {
  busNumber: string;
  busRealNumber: string | null;
  latitude: number;
  longitude: number;
  operate: boolean;
}

// 스토어 상태 및 액션 타입 정의
interface BusState {
  busPositions: BusPosition[];
  setBusPositions: (positions: BusPosition[]) => void;
  clearBusPositions: () => void;
}

// 버스 위치 정보 스토어 생성
const useBusStore = create<BusState>((set) => ({
  // 초기 상태
  busPositions: [],

  // 액션
  setBusPositions: (positions) => set({ busPositions: positions }),
  clearBusPositions: () => set({ busPositions: [] }),
}));

export default useBusStore;