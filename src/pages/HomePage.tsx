/* eslint-disable react-hooks/exhaustive-deps */
import React, {useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Text from '../components/common/Text';
import Button from '../components/common/Button';
import {useToast} from '../components/common/Toast';
import MapView from '../components/Map/MapView';
import StationPanel from '../components/Station/StationPanel';
import SearchStationModal from '../components/Station/SearchStationModal';
import {Station} from '../api/services/stationService';
import {userService} from '../api/services/userService';
import {authService} from '../api/services/authService';
import theme from '../theme';
import IconSearch from '../components/assets/icons/IconSearch';
import Footer from '../components/Footer';

const HomePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);
  const [myStations, setMyStations] = useState<Station[]>([]);
  const [, setUserName] = useState<string>('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const {showToast} = useToast();

  // 페이지 초기 로딩
  const loadData = async () => {
    try {
      setIsLoading(true);

      // 사용자 정보 로드
      const userInfo = await authService.getUserInfo();
      setUserName(userInfo.name);

      // 즐겨찾기 정류장 로드
      const favoriteStations = await userService.getMyStations();
      setMyStations(favoriteStations);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 화면 포커스시 데이터 갱신
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // 새로고침 처리
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadData();
      showToast('정보가 갱신되었습니다.', 'success');
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 즐겨찾기 토글
  const toggleFavorite = async (stationId: string) => {
    try {
      const isFavorite = myStations.some(station => station.id === stationId);

      if (isFavorite) {
        await userService.deleteMyStation(stationId);
        showToast('정류장이 즐겨찾기에서 제거되었습니다.', 'info');
      } else {
        await userService.addMyStation(stationId);
        showToast('정류장이 즐겨찾기에 추가되었습니다.', 'success');
      }

      // 즐겨찾기 목록 갱신
      const updatedStations = await userService.getMyStations();
      setMyStations(updatedStations);
    } catch (error) {
      console.error('Favorite toggle error:', error);
      showToast('요청을 처리하는데 실패했습니다.', 'error');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.default} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* 검색 바 */}
      <View style={styles.searchBarContainer}>
        <Button
          variant="outlined"
          style={styles.searchButton}
          leftIcon={<IconSearch color={theme.colors.gray[500]} size={20} />}
          onPress={() => setSearchModalVisible(true)}>
          <Text color={theme.colors.gray[500]}>정류장을 검색하세요</Text>
        </Button>
      </View>

      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        <MapView stations={myStations} />
      </View>

      {/* 정류장 패널 */}
      <StationPanel
        favoriteStations={myStations}
        toggleFavorite={toggleFavorite}
      />

      {/* 검색 모달 */}
      <SearchStationModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        favoriteStations={myStations}
        toggleFavorite={toggleFavorite}
      />
      <Footer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? theme.spacing.sm : theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
    zIndex: 10,
  },
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 70,
    width: '100%',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 20,
  },
  searchButton: {
    width: '100%',
    justifyContent: 'flex-start',
    backgroundColor: theme.colors.white,
    ...theme.shadows.md,
  },
  mapContainer: {
    flex: 1,
    zIndex: 1,
  },
});

export default HomePage;
