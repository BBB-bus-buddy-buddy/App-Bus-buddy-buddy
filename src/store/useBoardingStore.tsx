import { create } from 'zustand';

interface BoardingState {
  // 내가 현재 탑승한 버스의 번호. 안 탔으면 null
  boardedBusNumber: string | null;
  // 탑승 여부를 쉽게 확인하기 위한 boolean 값
  isBoarded: boolean;
  // 특정 버스에 탑승했음을 상태에 기록하는 액션
  boardBus: (busNumber: string) => void;
  // 버스에서 하차했음을 상태에 기록하는 액션
  alightBus: () => void;
}

/**
 * 사용자의 버스 탑승 상태를 관리하는 Zustand 스토어
 */
const useBoardingStore = create<BoardingState>((set) => ({
  boardedBusNumber: null,
  isBoarded: false,
  boardBus: (busNumber) => {
    console.log(`🚌 [BoardingState] ${busNumber} 버스에 탑승합니다.`);
    set({ boardedBusNumber: busNumber, isBoarded: true });
  },
  alightBus: () => {
    console.log(`🚶 [BoardingState] 버스에서 하차합니다.`);
    set({ boardedBusNumber: null, isBoarded: false });
  },
}));

export default useBoardingStore;