import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextStyle,
} from 'react-native';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import useSelectedStationStore from '../store/useSelectedStationStore';
import theme from '../theme';
import {busService, BusRealTimeStatus} from '../api/services/busService';
import {LoadingContainer} from './LoadingPage';

// 네비게이션 타입 정의
type RootStackParamList = {
  BusRoute: {busNumber: string};
  Home: undefined;
};

// 백엔드에서 반환하는 정류장 인터페이스
interface Station {
  id: string;
  name: string;
  location: {
    coordinates: number[];
    type: string;
  };
  organizationId: string;
  sequence: number;
  isPassed: boolean;
  isCurrentStation: boolean;
  estimatedArrivalTime?: string | null;
}

const BusRoutePage: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'BusRoute'>>();
  const [stationList, setStationList] = useState<Station[]>([]);
  const [busInfo, setBusInfo] = useState<BusRealTimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const {setSelectedStation} = useSelectedStationStore();
  const navigation = useNavigation();

  const busNumber = route.params.busNumber;

  // 버스 표시명 생성 함수
  const getBusDisplayName = (busRealNumber: string | null, busNumber: string) => {
    if (busRealNumber) {
      return busRealNumber;
    }
    return `${busNumber} (가상번호)`;
  };

  // 버스 부제목 생성 함수
  const getBusSubtitle = (busRealNumber: string | null, busNumber: string) => {
    if (busRealNumber) {
      return `판별 번호: ${busNumber}`;
    }
    return '실제 번호 미지정';
  };

  // 좌석 사용률 계산
  const calculateOccupancyRate = (occupied: number, total: number) => {
    return total > 0 ? (occupied / total) * 100 : 0;
  };

  // 좌석 사용률에 따른 색상 반환
  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return theme.colors.system.error;
    if (rate >= 70) return theme.colors.system.warning;
    return theme.colors.system.success;
  };

  // 좌석 상태 텍스트 반환
  const getSeatStatusText = (rate: number) => {
    if (rate >= 90) return '혼잡';
    if (rate >= 70) return '보통';
    return '여유';
  };

  // 버스 정류장 정보 가져오기
  const fetchBusStations = useCallback(async () => {
    try {
      setLoading(true);

      // 1. 정류장 상세 정보 가져오기
      const stationsDetail = await busService.getBusStationsDetail(busNumber);
      console.log('Fetched stations:', stationsDetail);

      // 2. 버스 실시간 정보 가져오기 (좌석 정보 포함)
      const allBuses = await busService.getAllBuses();
      const currentBus = allBuses.find(bus => bus.busNumber === busNumber);
      setBusInfo(currentBus || null);
      console.log('Fetched bus info:', currentBus);

      // 정류장 목록 정렬 (sequence 기준)
      const sortedStations = [...stationsDetail].sort(
        (a, b) => a.sequence - b.sequence,
      );
      setStationList(sortedStations);

      // 현재 정류장의 도착 예정 시간 찾기
      const currentStation = sortedStations.find(
        station => station.isCurrentStation,
      );
      if (currentStation && currentStation.estimatedArrivalTime) {
        setEstimatedTime(currentStation.estimatedArrivalTime);
      } else {
        setEstimatedTime(null);
      }

      setError(null);
    } catch (error) {
      console.error('정류장 정보를 불러오는 중 오류 발생:', error);
      setError('정류장 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [busNumber]);

  // 시간 문자열에서 분 추출
  const extractMinutes = (timeString?: string): number => {
    if (!timeString) return 0;

    const matches = timeString.match(/(\d+)분/);
    if (matches && matches[1]) {
      return parseInt(matches[1], 10);
    }
    return 0;
  };

  // 초기 데이터 로딩
  useEffect(() => {
    fetchBusStations();
  }, [fetchBusStations]);

  // 주기적 업데이트 (30초마다)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchBusStations();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchBusStations]);

  // 정류장 클릭 핸들러
  const handleStationClick = useCallback(
    (station: Station) => {
      const convertedStation = {
        id: station.id,
        name: station.name,
        location:
          station.location && station.location.coordinates
            ? {
                x: station.location.coordinates[0], // 경도
                y: station.location.coordinates[1], // 위도
              }
            : undefined,
      };

      setSelectedStation(convertedStation);
      navigation.navigate('Home' as never);
    },
    [navigation, setSelectedStation],
  );

  // 정류장 아이템 렌더링
  const renderStationItem = useCallback(
    ({item}: {item: Station}) => {
      const isBusHere = item.isCurrentStation;
      const index = item.sequence;

      return (
        <TouchableOpacity
          onPress={() => handleStationClick(item)}
          activeOpacity={0.7}>
          <View style={styles.stationItem}>
            <View style={styles.stationLineContainer}>
              <View
                style={[
                  styles.verticalLine,
                  item.isPassed && styles.passedLine,
                  isBusHere && styles.currentLine,
                  index === 0 && styles.firstLine,
                  index === stationList.length - 1 && styles.lastLine,
                ]}>
                {isBusHere && (
                  <View style={styles.busIndicatorContainer}>
                    <View style={styles.busIndicator}>
                      <Text style={styles.busEmoji}>🚌</Text>
                    </View>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.stationDot,
                  item.isPassed && styles.passedDot,
                  isBusHere && styles.currentDot,
                ]}
              />
            </View>

            <View style={styles.stationInfoContainer}>
              <Text
                style={[
                  styles.stationName,
                  isBusHere && styles.currentStationName,
                ]}>
                {item.name}
              </Text>
              {isBusHere && item.estimatedArrivalTime && (
                <Text style={styles.remainingTime}>
                  {extractMinutes(item.estimatedArrivalTime)}분 후 도착
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [stationList.length, handleStationClick],
  );

  // 좌석 정보 헤더 렌더링
  const renderSeatInfo = () => {
    if (!busInfo) return null;

    const occupancyRate = calculateOccupancyRate(busInfo.occupiedSeats, busInfo.totalSeats);
    const occupancyColor = getOccupancyColor(occupancyRate);
    const seatStatusText = getSeatStatusText(occupancyRate);

    return (
      <View style={styles.seatInfoContainer}>
        <View style={styles.seatProgressContainer}>
          <View style={styles.seatProgressBackground}>
            <View 
              style={[
                styles.seatProgressBar,
                {
                  width: `${occupancyRate}%`,
                  backgroundColor: occupancyColor,
                }
              ]} 
            />
          </View>
          <View style={styles.seatTextContainer}>
            <Text style={styles.seatStatusText}>
              좌석 상황: <Text style={[styles.seatStatus, {color: occupancyColor}]}>{seatStatusText}</Text>
            </Text>
            <Text style={styles.seatDetailText}>
              {busInfo.totalSeats - busInfo.occupiedSeats}석 여유 ({busInfo.occupiedSeats}/{busInfo.totalSeats})
            </Text>
          </View>
        </View>
        <View style={[styles.seatIndicator, {backgroundColor: occupancyColor}]} />
      </View>
    );
  };

  // 로딩 및 에러 상태 처리
  if (loading) {
    return (
      <LoadingContainer loading={loading}>
        <View />
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* 메인 타이틀 - busRealNumber 중심 */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerMainTitle}>
            {getBusDisplayName(busInfo?.busRealNumber || null, busNumber)}
          </Text>
          <Text style={styles.headerSubtitle}>
            {getBusSubtitle(busInfo?.busRealNumber || null, busNumber)}
          </Text>
        </View>
        
        {/* 도착 시간 정보 */}
        {estimatedTime && (
          <Text style={styles.headerArrivalTime}>
            약 {extractMinutes(estimatedTime)}분 후 도착
          </Text>
        )}
        
        {/* 좌석 정보 표시 */}
        {renderSeatInfo()}
      </View>

      <FlatList
        data={stationList}
        renderItem={renderStationItem}
        keyExtractor={item => item.id}
        style={styles.stationList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
    backgroundColor: theme.colors.white,
  },
  headerTitleContainer: {
    marginBottom: theme.spacing.sm,
  },
  headerMainTitle: {
    fontSize: theme.typography.text.xl.fontSize,
    fontWeight: theme.typography.fontWeight.bold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: theme.typography.text.sm.fontSize,
    color: theme.colors.gray[600],
  },
  headerArrivalTime: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.system.warning,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
    marginBottom: theme.spacing.sm,
  },
  
  // 좌석 정보 스타일
  seatInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  seatProgressContainer: {
    flex: 1,
  },
  seatProgressBackground: {
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.xs,
    marginBottom: theme.spacing.xs,
  },
  seatProgressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.xs,
  },
  seatTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seatStatusText: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
  },
  seatStatus: {
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
  },
  seatDetailText: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[600],
  },
  seatIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: theme.spacing.sm,
  },
  
  stationList: {
    flex: 1,
  },
  listContent: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  stationLineContainer: {
    width: 24,
    alignItems: 'center',
    height: 50,
    position: 'relative',
  },
  verticalLine: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.gray[200],
    left: '50%',
    marginLeft: -1,
  },
  firstLine: {
    top: '50%',
  },
  lastLine: {
    bottom: '50%',
  },
  passedLine: {
    backgroundColor: theme.colors.system.success,
  },
  currentLine: {
    backgroundColor: theme.colors.primary.default,
  },
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.gray[200],
    borderWidth: 2,
    borderColor: theme.colors.white,
    marginTop: 19,
    zIndex: 1,
  },
  passedDot: {
    backgroundColor: theme.colors.system.success,
  },
  currentDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary.default,
    borderWidth: 3,
    marginTop: 17,
  },
  busIndicatorContainer: {
    position: 'absolute',
    left: -11,
    top: 0,
    transform: [{translateY: -12}],
    zIndex: 2,
  },
  busIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary.default,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  busEmoji: {
    fontSize: 14,
    color: theme.colors.white,
  },
  stationInfoContainer: {
    flex: 1,
    paddingVertical: 4,
    marginLeft: 12,
  },
  stationName: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.gray[800],
    marginTop: 15,
  },
  currentStationName: {
    color: theme.colors.primary.default,
    fontWeight: theme.typography.fontWeight.bold as TextStyle['fontWeight'],
  },
  remainingTime: {
    fontSize: theme.typography.text.sm.fontSize,
    color: theme.colors.gray[600],
    marginTop: 4,
  },
  errorText: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.system.error,
    textAlign: 'center',
    padding: theme.spacing.md,
  },
});

export default BusRoutePage;