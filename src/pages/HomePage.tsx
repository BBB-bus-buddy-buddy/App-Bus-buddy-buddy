import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Text from '../components/common/Text';
import Button from '../components/common/Button';
import {useToast} from '../components/common/Toast';
import MapView from '../components/Map/MapView';
import StationPanel from '../components/Station/StationPanel';
import SearchStationModal from '../components/Station/SearchStationModal';
import {Station, stationService} from '../api/services/stationService';
import {userService} from '../api/services/userService';
import {authService} from '../api/services/authService';
import { useGlobalWebSocket } from '../providers/GlobalWebSocketProvider';
import theme from '../theme';
import IconSearch from '../components/assets/icons/IconSearch';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import Footer from '../components/Footer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Ionicons = _Ionicons as unknown as React.ElementType;

const HomePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);
  const [myStations, setMyStations] = useState<Station[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [allStations, setAllStations] = useState<Station[]>([]);

  // 전역 웹소켓 상태
  const { isConnected, restart, ensureConnection } = useGlobalWebSocket();

  // 추적 정보 상태
  const [trackingInfo, setTrackingInfo] = useState<{
    active: boolean;
    timeLeft: string;
  }>({
    active: false,
    timeLeft: '',
  });
  const {showToast} = useToast();

  // 추적 정보 로드
  const loadTrackingInfo = async () => {
    try {
      // 추적 상태 정보 로드
      const active = await AsyncStorage.getItem('location_tracking_active');
      const startTimeStr = await AsyncStorage.getItem(
        'location_tracking_start_time',
      );
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0;

      if (active === 'true' && startTime > 0) {
        const timeLeft = calculateRemainingTime(startTime);
        setTrackingInfo({
          active: true,
          timeLeft,
        });
      } else {
        setTrackingInfo({
          active: false,
          timeLeft: '',
        });
      }
    } catch (error) {
      console.error('Failed to load tracking info:', error);
    }
  };

  // 남은 시간 계산
  const calculateRemainingTime = (startTime: number): string => {
    const now = Date.now();
    const elapsed = now - startTime;
    const remaining = Math.max(0, 2 * 60 * 60 * 1000 - elapsed); // 2시간을 밀리초로

    if (remaining <= 0) {
      return '만료됨';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}시간 ${minutes}분 남음`;
  };

  // 위치 추적 재시작 (전역 웹소켓 재시작)
  const handleRestartTracking = async () => {
    try {
      // 새로운 시작 시간 설정
      const now = Date.now();
      await AsyncStorage.setItem('location_tracking_start_time', now.toString());
      await AsyncStorage.setItem('location_tracking_active', 'true');

      // 전역 웹소켓 서비스 재시작
      const success = await restart();
      
      if (success) {
        // 추적 정보 갱신
        setTrackingInfo({
          active: true,
          timeLeft: calculateRemainingTime(now),
        });

        showToast(
          '위치 추적이 재시작되었습니다. 2시간 동안 위치를 공유합니다.',
          'success',
        );
      } else {
        showToast('위치 추적 재시작에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Restart tracking error:', error);
      showToast('위치 추적 재시작 중 오류가 발생했습니다.', 'error');
    }
  };

  // 페이지 초기 로딩
  const loadData = async () => {
    try {
      setIsLoading(true);

      // 사용자 정보 로드
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const userInfo = await authService.getUserInfo();

      // 추적 정보 로드
      await loadTrackingInfo();

      // 자동 추적 항상 활성화 상태로 설정
      await AsyncStorage.setItem('auto_tracking_enabled', 'true');
      await AsyncStorage.setItem('location_tracking_active', 'true');

      const stationsData = await stationService.getAllStations();
      setAllStations(stationsData);

      // 즐겨찾기 정류장 로드
      const favoriteStations = await userService.getMyStations();
      setMyStations(favoriteStations);

      // 전역 웹소켓 연결 확인
      await ensureConnection();
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // 자동 탑승 기능 설정 변경 시 안내 표시
  useEffect(() => {
    // 최초 앱 실행 시 자동 탑승 기능 안내
    const showAutoTrackingInfo = async () => {
      const hasShownInfo = await AsyncStorage.getItem(
        'location_tracking_info_shown',
      );
      if (hasShownInfo !== 'true') {
        Alert.alert(
          '자동 탑승 기능 안내',
          '위치 기반 자동 탑승 기능은 앱 사용 시 항상 활성화되며, 앱을 닫아도 최대 2시간 동안 백그라운드에서 계속 작동합니다.\n\n' +
            '앱을 다시 열면 2시간 타이머가 초기화됩니다.\n\n' +
            '10초마다 위치를 확인하여 자동 탑승을 감지합니다.',
          [{text: '확인', style: 'default'}],
        );
        await AsyncStorage.setItem('location_tracking_info_shown', 'true');
      }
    };

    showAutoTrackingInfo();
  }, []);

  // 추적 상태 정보 1분마다 갱신
  useEffect(() => {
    const timer = setInterval(async () => {
      const startTimeStr = await AsyncStorage.getItem(
        'location_tracking_start_time',
      );
      if (startTimeStr) {
        const startTime = parseInt(startTimeStr, 10);
        const timeLeft = calculateRemainingTime(startTime);
        setTrackingInfo(prev => ({
          ...prev,
          timeLeft,
        }));
      }
    }, 60000); // 1분마다 업데이트

    return () => clearInterval(timer);
  }, []);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* 상단 고정 영역 */}
      <View style={styles.topContainer}>
        {/* 자동 탑승 기능 상태 표시 */}
        <View style={styles.autoTrackingContainer}>
          <View style={styles.autoTrackingContent}>
            <View style={styles.trackingTitleContainer}>
              <Text variant="md" weight="semiBold">
                자동 탑승 감지
              </Text>
              {/* 웹소켓 연결 상태 표시 */}
              <View style={[
                styles.statusDot, 
                { backgroundColor: isConnected ? theme.colors.system.success : theme.colors.system.error }
              ]} />
              <Text variant="sm" color={isConnected ? theme.colors.system.success : theme.colors.system.error}>
                {isConnected ? '연결됨' : '연결 끊김'}
              </Text>
              {trackingInfo.active && isConnected && (
                <>
                  <View style={styles.statusDot} />
                  <Text variant="sm" color={theme.colors.system.info}>
                    {trackingInfo.timeLeft}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.autoTrackingDescContainer}>
              <Text variant="xs" color={theme.colors.gray[600]} style={styles.autoTrackingDesc}>
                10초마다 위치를 확인하여 자동 탑승을 감지합니다
              </Text>
            </View>
          </View>
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.restartButton}
              onPress={handleRestartTracking}
              activeOpacity={0.7}>
              <Ionicons
                name="refresh"
                size={14}
                color={theme.colors.system.info}
              />
            </TouchableOpacity>
            <View style={[
              styles.activeIndicator,
              { backgroundColor: isConnected ? theme.colors.system.success + '20' : theme.colors.system.error + '20' }
            ]}>
              <Text
                variant="sm"
                weight="medium"
                color={isConnected ? theme.colors.system.success : theme.colors.system.error}>
                {isConnected ? '활성화됨' : '비활성화됨'}
              </Text>
            </View>
          </View>
        </View>

        {/* 검색 바 */}
        <View style={styles.searchBarContainer}>
          <Button
            variant="outlined"
            style={styles.searchButton}
            leftIcon={<IconSearch color={theme.colors.gray[500]} size={18} />}
            onPress={() => setSearchModalVisible(true)}>
            <Text color={theme.colors.gray[500]}>정류장을 검색하세요</Text>
          </Button>
        </View>
      </View>

      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        <MapView stations={allStations}/>
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
  topContainer: {
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
    zIndex: 10,
  },
  autoTrackingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  autoTrackingContent: {
    flex: 1,
  },
  trackingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoTrackingDescContainer: {
    marginTop: 2,
  },
  autoTrackingDesc: {
    lineHeight: 18,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 6,
  },
  restartButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.xs,
  },
  activeIndicator: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  searchBarContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.white,
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