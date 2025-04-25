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

  // 데이터 로딩
  const loadData = useCallback(async () => {
    try {
      setError(null);

      // 해당 정류장을 지나는 모든 버스 조회
      const busesData = await busService.getBusesByStation(stationId);

      // 도착 시간 문자열 처리 로직 개선
      const busesWithArrival = await Promise.all(
        busesData.map(async bus => {
          try {
            const arrivalData = await stationService.getArrivalEstimate(
              bus.busNumber,
              stationId,
            );

            // 백엔드에서 "--분 --초" 반환 시 변환 생략
            if (arrivalData.estimatedTime === '--분 --초') {
              return {
                ...bus,
                estimatedTime: arrivalData.estimatedTime,
                remainingSeconds: Number.MAX_SAFE_INTEGER, // 정렬을 위해 큰 값 사용
              };
            }

            // 정상적인 시간 문자열만 변환
            const seconds = convertTimeStringToSeconds(
              arrivalData.estimatedTime,
            );

            return {
              ...bus,
              estimatedTime: arrivalData.estimatedTime, // 원본 문자열 유지
              remainingSeconds: seconds,
            };
          } catch (innerError) {
            console.error(
              `Failed to get arrival estimate for bus ${bus.busNumber}:`,
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

      // 정렬 로직 개선
      const sortedBuses = busesWithArrival.sort((a, b) => {
        const aSeconds = a.remainingSeconds ?? Number.MAX_SAFE_INTEGER;
        const bSeconds = b.remainingSeconds ?? Number.MAX_SAFE_INTEGER;
        return aSeconds - bSeconds;
      });

      setBuses(sortedBuses);
    } catch (error) {
      console.error('Error loading station details:', error);
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

  // 버스 상세 정보로 이동
  const handleBusPress = (busNumber: string) => {
    // @ts-ignore - navigation 타입 정의 필요
    navigation.navigate('BusRoute', {busNumber});
  };

  // 초 변환 함수 개선
  const convertTimeStringToSeconds = (timeString: string): number | null => {
    if (timeString === '--분 --초') {return null;} // 변환 불가 시 null 반환

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
    if (seconds === null || seconds === Number.MAX_SAFE_INTEGER)
      {return '--분 --초';}
    if (seconds <= 0) {return '잠시 후 도착';}

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };
  // 버스 아이템 렌더링
  const renderBusItem = ({item}: {item: BusWithArrival}) => (
    <Card
      variant="filled"
      padding="md"
      style={styles.busCard}
      onPress={() => handleBusPress(item.busNumber)}>
      <View style={styles.busRow}>
        <View style={styles.busNumberContainer}>
          <Text variant="md" weight="bold" style={styles.busNumber}>
            {item.busNumber}
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
              color={theme.colors.system.error}
              style={styles.arrivalTime}>
              {item.estimatedTime}
            </Text>
          </View>

          <View style={styles.seatsContainer}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: `${(item.occupiedSeats / item.totalSeats) * 100}%`},
                ]}
              />
            </View>
            <Text variant="xs" color={theme.colors.gray[600]}>
              {item.availableSeats}/{item.totalSeats}석
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );

  // 빈 목록 처리
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text
        variant="md"
        color={theme.colors.gray[500]}
        style={styles.emptyText}>
        {error || '이 정류장을 지나는 버스가 없습니다.'}
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
  busRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busNumberContainer: {
    width: 80,
    marginRight: theme.spacing.md,
  },
  busNumber: {
    color: theme.colors.primary.default,
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
    backgroundColor: theme.colors.primary.default,
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
  },
});

export default StationDetail;
