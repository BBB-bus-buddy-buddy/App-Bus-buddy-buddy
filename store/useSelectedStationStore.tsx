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
}

const useSelectedStationStore = create<SelectedStationState>()(
  persist(
    set => ({
      selectedStation: null,

      setSelectedStation: station => {
        set({selectedStation: station});
      },

      resetSelectedStation: () => {
        set({selectedStation: null});
      },
    }),
    {
      name: 'selected-station-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSelectedStationStore;