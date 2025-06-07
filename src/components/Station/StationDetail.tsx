import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Text from '../common/Text';
import Card from '../common/Card';
import theme from '../../theme';
import {busService, BusRealTimeStatus} from '../../api/services/busService';
import {stationService} from '../../api/services/stationService';
import {useToast} from '../common/Toast';

interface StationDetailProps {
  stationId: string;
}

// 타입 정의 보완
interface BusWithArrival extends BusRealTimeStatus {
  estimatedTime: string; // 원본 문자열 유지
  remainingSeconds?: number | null; // null 허용
}

const StationDetail: React.FC<StationDetailProps> = ({stationId}) => {
  const [buses, setBuses] = useState<BusWithArrival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();
  const {showToast} = useToast();

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

  // 데이터 로딩
  const loadData = useCallback(async () => {
    try {
      setError(null);

      console.log(`🏪 정류장 ${stationId} - 운행 중인 버스 조회 시작`);

      // 🔄 해당 정류장을 지나는 운행 중인 버스만 조회
      const busesData = await busService.getBusesByStation(stationId);
      
      console.log(`📊 정류장 ${stationId}를 지나는 운행 중인 버스: ${busesData.length}대`);

      // 추가 필터링: isOperate 확인 (busService에서 이미 필터링되지만 이중 체크)
      const operatingBuses = busesData.filter(bus => {
        if (!bus.operate) {
          console.warn(`⚠️ 운행 중지된 버스 감지: ${getBusDisplayName(bus.busRealNumber, bus.busNumber)}`);
          return false;
        }
        return true;
      });

      console.log(`✅ 최종 운행 중인 버스: ${operatingBuses.length}대`);

      // 도착 시간 문자열 처리 로직
      const busesWithArrival = await Promise.all(
        operatingBuses.map(async bus => {
          try {
            console.log(`🕐 버스 ${getBusDisplayName(bus.busRealNumber, bus.busNumber)} 도착 시간 조회 중...`);
            
            const arrivalData = await stationService.getArrivalEstimate(
              bus.busNumber,
              stationId,
            );

            if (arrivalData.estimatedTime === '--분 --초') {
              return {
                ...bus,
                estimatedTime: arrivalData.estimatedTime,
                remainingSeconds: Number.MAX_SAFE_INTEGER,
              };
            }

            const seconds = convertTimeStringToSeconds(arrivalData.estimatedTime);

            console.log(`⏰ 버스 ${getBusDisplayName(bus.busRealNumber, bus.busNumber)}: ${arrivalData.estimatedTime} (${seconds}초)`);

            return {
              ...bus,
              estimatedTime: arrivalData.estimatedTime,
              remainingSeconds: seconds,
            };
          } catch (innerError) {
            console.error(
              `❌ 버스 ${getBusDisplayName(bus.busRealNumber, bus.busNumber)} 도착 시간 조회 실패:`,
              innerError,
            );
            return {
              ...bus,
              estimatedTime: '--분 --초',
              remainingSeconds: Number.MAX_SAFE_INTEGER,
            };
          }
        }),
      );

      // 정렬 로직
      const sortedBuses = busesWithArrival.sort((a, b) => {
        const aSeconds = a.remainingSeconds ?? Number.MAX_SAFE_INTEGER;
        const bSeconds = b.remainingSeconds ?? Number.MAX_SAFE_INTEGER;
        return aSeconds - bSeconds;
      });

      console.log(`📋 정렬된 버스 목록:`);
      sortedBuses.forEach((bus, index) => {
        console.log(`  ${index + 1}. ${getBusDisplayName(bus.busRealNumber, bus.busNumber)} - ${bus.estimatedTime}`);
      });

      setBuses(sortedBuses);
    } catch (error) {
      console.error('❌ 정류장 상세 정보 로딩 오류:', error);
      setError('버스 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [stationId]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (buses.length > 0) {
      intervalId = setInterval(() => {
        setBuses(prevBuses =>
          prevBuses.map(bus => {
            // remainingSeconds가 null/undefined/Number.MAX_SAFE_INTEGER면 덮어쓰지 않음
            if (
              bus.remainingSeconds &&
              bus.remainingSeconds > 0 &&
              bus.remainingSeconds !== Number.MAX_SAFE_INTEGER
            ) {
              const newSeconds = bus.remainingSeconds - 1;
              return {
                ...bus,
                estimatedTime: formatSecondsToTime(newSeconds),
                remainingSeconds: newSeconds,
              };
            }
            // 변환 불가/특수값이면 estimatedTime을 그대로 유지
            return bus;
          }),
        );
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [buses.length]);

  // 초기 데이터 로딩
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 새로고침 처리
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    showToast('버스 정보가 갱신되었습니다.', 'success');
  };

  // 버스 상세 정보로 이동 (운행 여부 확인)
  const handleBusPress = (busNumber: string, isOperate: boolean) => {
    if (!isOperate) {
      showToast('해당 버스는 현재 운행하지 않습니다.', 'warning');
      return;
    }
    // @ts-ignore
    navigation.navigate('BusRoute', {busNumber});
  };

  // 초 변환 함수 개선
  const convertTimeStringToSeconds = (timeString: string): number | null => {
    if (timeString === '--분 --초') {
      return null;
    } // 변환 불가 시 null 반환

    const match = timeString.match(/(\d+)분\s*(\d+)?초?/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = match[2] ? parseInt(match[2], 10) : 0;
      return minutes * 60 + seconds;
    }
    return null; // 형식 오류 시 null 반환
  };

  // 시간 표시 함수 개선
  const formatSecondsToTime = (seconds: number | null): string => {
    if (seconds === null || seconds === Number.MAX_SAFE_INTEGER) {
      return '--분 --초';
    }
    if (seconds <= 0) {
      return '잠시 후 도착';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };
  // 버스 아이템 렌더링
  const renderBusItem = ({item}: {item: BusWithArrival}) => (
    <Card
      variant="filled"
      padding="md"
      style={[
        styles.busCard,
        // 운행 중지된 버스는 회색 처리 (이론적으로는 표시되지 않아야 함)
        !item.operate && styles.inactiveBusCard
      ]}
      onPress={() => handleBusPress(item.busNumber, item.operate)}>
      <View style={styles.busRow}>
        <View style={styles.busNumberContainer}>
          <View style={styles.busHeaderRow}>
            <Text variant="md" weight="bold" style={[
              styles.busNumber,
              !item.operate && styles.inactiveBusText
            ]}>
              {getBusDisplayName(item.busRealNumber, item.busNumber)}
            </Text>
          </View>
          <Text variant="xs" color={theme.colors.gray[500]} style={styles.busSubtitle}>
            {getBusSubtitle(item.busRealNumber, item.busNumber)}
          </Text>
          <Text variant="xs" color={theme.colors.gray[500]}>
            {item.routeName}
          </Text>
        </View>

        <View style={styles.busInfoContainer}>
          <View style={styles.arrivalTimeContainer}>
            <Text
              variant="md"
              weight="medium"
              color={item.operate ? theme.colors.system.error : theme.colors.gray[400]}
              style={styles.arrivalTime}>
              {item.operate ? item.estimatedTime : '운행 중지'}
            </Text>
          </View>

          <View style={styles.seatsContainer}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${(item.occupiedSeats / item.totalSeats) * 100}%`,
                    backgroundColor: item.operate 
                      ? theme.colors.primary.default 
                      : theme.colors.gray[300]
                  },
                ]}
              />
            </View>
            <Text variant="xs" color={item.operate ? theme.colors.gray[600] : theme.colors.gray[400]}>
              {item.availableSeats}/{item.totalSeats}석
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );


  // 빈 목록 처리 (운행 중인 버스 강조)
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text
        variant="md"
        color={theme.colors.gray[500]}
        style={styles.emptyText}>
        {error || '이 정류장을 지나는 운행 중인 버스가 없습니다.'}
      </Text>
      <Text variant="sm" color={theme.colors.gray[400]} style={styles.emptySubText}>
        현재 시간에 운행하는 버스만 표시됩니다.
      </Text>
    </View>
  );

  // 구분선
  const ItemSeparator = () => <View style={styles.separator} />;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.default} />
      </View>
    );
  }

  return (
    <FlatList
      data={buses}
      renderItem={renderBusItem}
      keyExtractor={item => item.busNumber}
      contentContainerStyle={styles.listContainer}
      ItemSeparatorComponent={ItemSeparator}
      ListEmptyComponent={renderEmptyList}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary.default]}
          tintColor={theme.colors.primary.default}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  // ... 기존 스타일들
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
  },
  listContainer: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  busCard: {
    borderRadius: theme.borderRadius.md,
  },
  // 🔄 운행 중지된 버스 스타일 (이론적으로는 표시되지 않음)
  inactiveBusCard: {
    opacity: 0.6,
    backgroundColor: theme.colors.gray[100],
  },
  busRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busNumberContainer: {
    width: 120,
    marginRight: theme.spacing.md,
  },
  busHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busNumber: {
    color: theme.colors.primary.default,
    flex: 1,
  },
  inactiveBusText: {
    color: theme.colors.gray[500],
  },
  // 🔄 운행 상태 표시 스타일
  operatingIndicator: {
    marginLeft: theme.spacing.xs,
  },
  operatingText: {
    color: theme.colors.system.success,
    fontSize: 12,
  },
  stoppedIndicator: {
    marginLeft: theme.spacing.xs,
  },
  stoppedText: {
    color: theme.colors.system.warning,
    fontSize: 12,
  },
  busSubtitle: {
    marginTop: 2,
    marginBottom: 4,
  },
  busInfoContainer: {
    flex: 1,
  },
  arrivalTimeContainer: {
    marginBottom: theme.spacing.xs,
  },
  arrivalTime: {
    textAlign: 'right',
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  progressBarContainer: {
    height: 6,
    width: 80,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  separator: {
    height: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptySubText: {
    textAlign: 'center',
  },
});

export default StationDetail;