import { create } from 'zustand';

// 핵심 타입 정의
export interface Station {
  id: string;
  name: string;
  location?: {
    x: number;
    y: number;
  };
}

// 스토어 상태 타입 정의 (필수 기능만)
interface StoreState {
  stations: Station[];
  setStations: (stations: Station[]) => void;
  
  // 검색 관련
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // 필터링된 결과
  filteredStations: Station[];
  setFilteredStations: (stations: Station[]) => void;
}

// 스토어 생성
const useStore = create<StoreState>((set) => ({
  // 초기 상태
  stations: [],
  searchQuery: '',
  filteredStations: [],

  // 액션
  setStations: (stations) => set({ stations }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilteredStations: (stations) => set({ filteredStations: stations }),
}));

export default useStore;