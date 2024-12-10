import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import Footer from '../components/Footer';
import SearchBar from '../components/SearchBar/SearchBar';
import MapViewComponent from '../components/MapView';
import StationPanel from '../components/StationPanel';
import SearchStationModal from '../components/SearchStationModal';
import LoadingPage from './LoadingPage';

interface Station {
  id: string;
  name: string;
  // 다른 필요한 정류장 속성들
}

const API_BASE_URL = Platform.select({
  ios: 'http://devse.gonetis.com:12589',
  android: 'http://devse.gonetis.com:12589',
});

const HomePage: React.FC = () => {
  const [myStationData, setMyStationData] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 즐겨찾기 정류장 목록 조회
  const fetchMyStations = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/user/my-station`);
      setMyStationData(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching stations:', err);
      setError('정류장 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 즐겨찾기 추가
  const addFavoriteStation = async (stationId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/user/my-station`, {
        stationId: stationId
      });
      Alert.alert('알림', '정류장이 즐겨찾기에 추가되었습니다.');
      await fetchMyStations(); // 목록 갱신
    } catch (err) {
      console.error('Error adding favorite:', err);
      Alert.alert('오류', '즐겨찾기 추가에 실패했습니다.');
    }
  };

  // 즐겨찾기 제거
  const removeFavoriteStation = async (stationId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/user/my-station/${stationId}`);
      Alert.alert('알림', '정류장이 즐겨찾기에서 제거되었습니다.');
      await fetchMyStations(); // 목록 갱신
    } catch (err) {
      console.error('Error removing favorite:', err);
      Alert.alert('오류', '즐겨찾기 제거에 실패했습니다.');
    }
  };

  // 즐겨찾기 토글
  const toggleFavorite = async (id: string) => {
    try {
      const isFavorite = myStationData.some(station => station.id === id);
      if (isFavorite) {
        await removeFavoriteStation(id);
      } else {
        await addFavoriteStation(id);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      Alert.alert('오류', '작업 중 오류가 발생했습니다.');
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetchMyStations();
  }, []);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor="#FFFFFF"
      />
      
      <View style={styles.searchBarContainer}>
        <SearchBar />
      </View>

      <View style={styles.mapContainer}>
        <MapViewComponent />
      </View>

      <StationPanel
        favoriteStations={myStationData}
        toggleFavorite={toggleFavorite}
      />

      <SearchStationModal
        favoriteStations={myStationData}
        toggleFavorite={toggleFavorite}
      />

      <Footer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    width: '100%',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  mapContainer: {
    flex: 1,
    zIndex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
});

export default HomePage;