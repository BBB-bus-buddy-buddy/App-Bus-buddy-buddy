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
import PassengerLocationTracker from '../components/PassengerLocationTracker';
import {Station, stationService} from '../api/services/stationService';
import {userService} from '../api/services/userService';
import {authService} from '../api/services/authService';
import theme from '../theme';
import IconSearch from '../components/assets/icons/IconSearch';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import Footer from '../components/Footer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Ionicons = _Ionicons as unknown as React.ElementType;

const HomePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [myStations, setMyStations] = useState<Station[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [userInfo, setUserInfo] = useState<{organizationId: string} | null>(null);

  // 자동 탑승 감지 추적 상태
  const [trackingInfo, setTrackingInfo] = useState<{
    active: boolean;
    timeLeft: string;
  }>({
    active: false,
    timeLeft: '',
  });
  
  const {showToast} = useToast();

  // 사용자 정보 로드
  const loadUserInfo = useCallback(async () => {
    try {
      const userData = await authService.getUserInfo();
      if (userData && userData.organizationId) {
        setUserInfo({organizationId: userData.organizationId});
        return userData;
      }
      return null;
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      return null;
    }
  }, []);

  // 자동 탑승 감지 추적 정보 로드
  const loadTrackingInfo = async () => {
    try {
      const active = await AsyncStorage.getItem('location_tracking_active');
      const startTimeStr = await AsyncStorage.getItem('location_tracking_start_time');
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
      console.error('추적 정보 로드 실패:', error);
    }
  };

  // 남은 시간 계산
  const calculateRemainingTime = (startTime: number): string => {
    const now = Date.now();
    const elapsed = now - startTime;
    const remaining = Math.max(0, 2 * 60 * 60 * 1000 - elapsed); // 2시간

    if (remaining <= 0) {
      return '만료됨';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}시간 ${minutes}분 남음`;
  };

  // 자동 탑승 감지 재시작
  const handleRestartTracking = async () => {
    try {
      const now = Date.now();
      await AsyncStorage.setItem('location_tracking_start_time', now.toString());
      await AsyncStorage.setItem('location_tracking_active', 'true');

      setTrackingInfo({
        active: true,
        timeLeft: calculateRemainingTime(now),
      });

      showToast(
        '자동 탑승 감지가 재시작되었습니다. 2시간 동안 작동합니다.',
        'success',
      );

      // 데이터 새로고침
      setIsLoading(true);
      setTimeout(() => {
        loadData();
      }, 500);
    } catch (error) {
      console.error('추적 재시작 실패:', error);
      showToast('자동 탑승 감지 재시작에 실패했습니다.', 'error');
    }
  };

  // 페이지 데이터 로드
  const loadData = async () => {
    try {
      setIsLoading(true);

      // 1. 사용자 정보 로드
      const userData = await loadUserInfo();
      if (!userData) {
        showToast('사용자 정보를 불러올 수 없습니다.', 'error');
        return;
      }

      // 2. 자동 탑승 감지 추적 정보 로드
      await loadTrackingInfo();

      // 3. 자동 탑승 감지 활성화 설정
      await AsyncStorage.setItem('auto_tracking_enabled', 'true');
      await AsyncStorage.setItem('location_tracking_active', 'true');

      // 4. 정류장 데이터 로드
      const stationsData = await stationService.getAllStations();
      setAllStations(stationsData);

      // 5. 즐겨찾기 정류장 로드
      const favoriteStations = await userService.getMyStations();
      setMyStations(favoriteStations);

      console.log('승객 앱 데이터 로드 완료');
    } catch (error) {
      console.error('데이터 로드 오류:', error);
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

  // 자동 탑승 기능 안내 (최초 실행시)
  useEffect(() => {
    const showAutoTrackingInfo = async () => {
      const hasShownInfo = await AsyncStorage.getItem('location_tracking_info_shown');
      if (hasShownInfo !== 'true') {
        Alert.alert(
          '자동 탑승 감지 기능',
          '이 앱은 버스 근처에 있을 때 자동으로 탑승을 감지합니다.\n\n' +
            '• 앱 사용 시 항상 활성화됩니다\n' +
            '• 백그라운드에서 최대 2시간 작동합니다\n' +
            '• 앱을 다시 열면 2시간이 초기화됩니다\n' +
            '• 배터리 효율을 위해 최적화되어 있습니다',
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
      const startTimeStr = await AsyncStorage.getItem('location_tracking_start_time');
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
  // const handleRefresh = async () => {
  //   try {
  //     setIsRefreshing(true);
  //     await loadData();
  //     showToast('정보가 갱신되었습니다.', 'success');
  //   } catch (error) {
  //     console.error('새로고침 오류:', error);
  //   } finally {
  //     setIsRefreshing(false);
  //   }
  // };

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
      console.error('즐겨찾기 토글 오류:', error);
      showToast('요청을 처리하는데 실패했습니다.', 'error');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.default} />
        <Text style={styles.loadingText}>승객 앱 로딩 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* 상단 고정 영역 */}
      <View style={styles.topContainer}>
        {/* 자동 탑승 감지 상태 표시 */}
        <View style={styles.autoTrackingContainer}>
          <View style={styles.autoTrackingContent}>
            <View style={styles.trackingTitleContainer}>
              <Text variant="md" weight="semiBold">
                🚌 자동 탑승 감지
              </Text>
              {trackingInfo.active && (
                <>
                  <View style={styles.statusDot} />
                  <Text variant="sm" color={theme.colors.system.info}>
                    {trackingInfo.timeLeft}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.autoTrackingDescContainer}>
              <Text 
                variant="xs" 
                color={theme.colors.gray[600]}
                style={styles.autoTrackingDesc}>
                버스 근처에서 자동으로 탑승을 감지합니다
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
            <View style={styles.activeIndicator}>
              <Text
                variant="sm"
                weight="medium"
                color={theme.colors.system.success}>
                활성
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

      {/* 자동 탑승 감지 위치 추적 컴포넌트 (백그라운드에서 작동) */}
      <PassengerLocationTracker isEnabled={true} />

      {/* 지도 영역 - 실시간 버스 위치 표시 */}
      <View style={styles.mapContainer}>
        {userInfo && (
          <MapView stations={allStations} />
        )}
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
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.gray[600],
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
    backgroundColor: theme.colors.system.info,
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
    backgroundColor: theme.colors.system.success + '20',
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