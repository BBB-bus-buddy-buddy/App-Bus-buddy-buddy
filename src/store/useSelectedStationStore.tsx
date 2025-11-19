import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Station {
  id: string;
  name: string;
  location?: { 
    x: number;
    y: number;
  };
}

interface SelectedStationState {
  selectedStation: Station | null;
  setSelectedStation: (station: Station | null) => void;
  resetSelectedStation: () => void;

  // 현재 위치 저장 (페이지 이동 시 유지)
  currentLocation: { latitude: number; longitude: number } | null;
  setCurrentLocation: (location: { latitude: number; longitude: number } | null) => void;
}

const useSelectedStationStore = create<SelectedStationState>()(
  persist(
    set => ({
      selectedStation: null,
      currentLocation: null,

      setSelectedStation: station => {
        set({selectedStation: station});
      },

      resetSelectedStation: () => {
        set({selectedStation: null});
      },

      setCurrentLocation: location => {
        set({currentLocation: location});
      },
    }),
    {
      name: 'selected-station-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSelectedStationStore;