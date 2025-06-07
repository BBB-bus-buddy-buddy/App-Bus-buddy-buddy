import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import _Ionicons from 'react-native-vector-icons/Ionicons';

import Footer from '../components/Footer';
import {useToast} from '../components/common/Toast';
import {operationPlanService, BusSchedule} from '../api/services/operationPlanService';
import theme from '../theme';

const Ionicons = _Ionicons as unknown as React.ElementType;

const BusSchedulePage: React.FC = () => {
  const [busSchedules, setBusSchedules] = useState<BusSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {showToast} = useToast();

  // 오늘 날짜 포맷팅
  const formatTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const weekDay = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
    return `${year}.${month}.${day} (${weekDay})`;
  };

  // 현재 시간 확인
  const getCurrentTime = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes(); // 분 단위로 변환
  };

  // 시간 문자열을 분으로 변환
  const timeToMinutes = (timeString: string) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // 버스 시간표 데이터 로딩
  const fetchBusSchedules = useCallback(async () => {
    try {
      setLoading(!refreshing);
      setError(null);
      
      const schedules = await operationPlanService.getTodayBusSchedule();
      
      // 시작 시간 순으로 정렬
      const sortedSchedules = schedules.sort((a, b) => {
        return a.startTime.localeCompare(b.startTime);
      });
      
      setBusSchedules(sortedSchedules);
      
      console.log('버스 시간표 로딩 성공:', sortedSchedules.length, '개');
    } catch (error: any) {
      console.error('버스 시간표를 가져오는 중 오류 발생:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '버스 시간표를 불러오는데 실패했습니다.';
      setError(errorMessage);
      
      if (!refreshing) {
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, showToast]);

  // 초기 로딩
  useEffect(() => {
    fetchBusSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 새로고침 처리
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBusSchedules();
  }, [fetchBusSchedules]);

  // 상태별 정보 반환
  const getScheduleStatus = (schedule: BusSchedule) => {
    const currentTime = getCurrentTime();
    const startTime = timeToMinutes(schedule.startTime);
    const endTime = timeToMinutes(schedule.endTime);

    if (schedule.status === 'CANCELLED') {
      return {
        text: '운행 취소',
        color: theme.colors.system.error,
        backgroundColor: theme.colors.system.error + '10',
        icon: 'close-circle-outline',
      };
    }

    if (schedule.status === 'IN_PROGRESS') {
      return {
        text: '운행 중',
        color: theme.colors.system.success,
        backgroundColor: theme.colors.system.success + '10',
        icon: 'checkmark-circle-outline',
      };
    }

    if (schedule.status === 'COMPLETED') {
      return {
        text: '운행 완료',
        color: theme.colors.gray[600],
        backgroundColor: theme.colors.gray[100],
        icon: 'checkmark-done-outline',
      };
    }

    // 시간 기반 상태 판단 (SCHEDULED인 경우)
    if (currentTime < startTime) {
      return {
        text: '운행 예정',
        color: theme.colors.system.info,
        backgroundColor: theme.colors.system.info + '10',
        icon: 'time-outline',
      };
    } else if (currentTime >= startTime && currentTime <= endTime) {
      return {
        text: '운행 중',
        color: theme.colors.system.success,
        backgroundColor: theme.colors.system.success + '10',
        icon: 'checkmark-circle-outline',
      };
    } else {
      return {
        text: '운행 완료',
        color: theme.colors.gray[600],
        backgroundColor: theme.colors.gray[100],
        icon: 'checkmark-done-outline',
      };
    }
  };

  // 버스 시간표 아이템 렌더링
  const renderScheduleItem = ({item}: {item: BusSchedule}) => {
    const statusInfo = getScheduleStatus(item);

    return (
      <View style={styles.scheduleItem}>
        <View style={styles.timeSection}>
          <Text style={styles.timeText}>{item.startTime}</Text>
          <View style={styles.timeDivider}>
            <View style={styles.timeLine} />
            <Ionicons
              name="arrow-forward"
              size={12}
              color={theme.colors.gray[400]}
            />
            <View style={styles.timeLine} />
          </View>
          <Text style={styles.timeText}>{item.endTime}</Text>
        </View>

        <View style={styles.busInfoSection}>
          <View style={styles.busHeader}>
            <View style={styles.busNumberContainer}>
              <Ionicons
                name="bus-outline"
                size={18}
                color={theme.colors.primary.default}
              />
              <Text style={styles.busNumber}>
                {item.busRealNumber || item.busNumber}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: statusInfo.backgroundColor},
              ]}>
              <Ionicons
                name={statusInfo.icon}
                size={14}
                color={statusInfo.color}
              />
              <Text style={[styles.statusText, {color: statusInfo.color}]}>
                {statusInfo.text}
              </Text>
            </View>
          </View>

          <View style={styles.routeInfo}>
            <Ionicons
              name="location-outline"
              size={16}
              color={theme.colors.gray[600]}
            />
            <Text style={styles.routeName} numberOfLines={1}>
              {item.routeName}
            </Text>
          </View>

          <View style={styles.driverInfo}>
            <Ionicons
              name="person-outline"
              size={16}
              color={theme.colors.gray[600]}
            />
            <Text style={styles.driverName} numberOfLines={1}>
              기사: {item.driverName}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // 헤더 컴포넌트
  const ListHeader = () => {
    const upcomingBuses = busSchedules.filter(schedule => {
      const currentTime = getCurrentTime();
      const startTime = timeToMinutes(schedule.startTime);
      return currentTime < startTime && schedule.status !== 'CANCELLED';
    }).length;

    const runningBuses = busSchedules.filter(schedule => {
      if (schedule.status === 'IN_PROGRESS') return true;
      
      const currentTime = getCurrentTime();
      const startTime = timeToMinutes(schedule.startTime);
      const endTime = timeToMinutes(schedule.endTime);
      return currentTime >= startTime && currentTime <= endTime && 
          schedule.status === 'SCHEDULED';
    }).length;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const completedBuses = busSchedules.filter(schedule => {
      if (schedule.status === 'COMPLETED') {return true;}
      
      const currentTime = getCurrentTime();
      const endTime = timeToMinutes(schedule.endTime);
      return currentTime > endTime && schedule.status === 'SCHEDULED';
    }).length;

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>오늘의 버스 시간표</Text>
        <Text style={styles.headerDate}>{formatTodayDate()}</Text>
        
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{busSchedules.length}</Text>
            <Text style={styles.summaryLabel}>총 운행</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, {color: theme.colors.system.success}]}>
              {runningBuses}
            </Text>
            <Text style={styles.summaryLabel}>운행 중</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, {color: theme.colors.system.info}]}>
              {upcomingBuses}
            </Text>
            <Text style={styles.summaryLabel}>운행 예정</Text>
          </View>
        </View>
      </View>
    );
  };

  // 빈 목록 컴포넌트
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="calendar-outline"
        size={50}
        color={theme.colors.gray[300]}
      />
      <Text style={styles.emptyText}>오늘 운행 예정인 버스가 없습니다.</Text>
      <Text style={styles.emptySubText}>
        운행 일정은 관리자에 의해 등록됩니다.
      </Text>
    </View>
  );

  // 로딩 상태
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.default} />
          <Text style={styles.loadingText}>운행 일정을 불러오는 중...</Text>
        </View>
        <Footer />
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error && !refreshing && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={50}
            color={theme.colors.system.error}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubText}>
            새로고침을 시도하거나 잠시 후 다시 확인해주세요.
          </Text>
        </View>
        <Footer />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={ListHeader}
        data={busSchedules}
        renderItem={renderScheduleItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={EmptyList}
        contentContainerStyle={[
          styles.listContent,
          busSchedules.length === 0 && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary.default]}
            tintColor={theme.colors.primary.default}
            title="새로고침 중..."
            titleColor={theme.colors.gray[600]}
          />
        }
      />
      <Footer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  headerTitle: {
    ...theme.typography.heading.h3,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  } as TextStyle,
  headerDate: {
    ...theme.typography.text.md,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.bold as TextStyle['fontWeight'],
    color: theme.colors.primary.default,
    marginBottom: 2,
  },
  summaryLabel: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[600],
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.gray[200],
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 80, // Footer 공간 확보
  },
  emptyListContent: {
    flexGrow: 1,
  },
  scheduleItem: {
    backgroundColor: theme.colors.white,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    ...theme.shadows.sm,
  },
  timeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    minWidth: 80,
  },
  timeText: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
  },
  timeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  timeLine: {
    width: 12,
    height: 1,
    backgroundColor: theme.colors.gray[300],
  },
  busInfoSection: {
    flex: 1,
  },
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  busNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  busNumber: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginLeft: theme.spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  statusText: {
    ...theme.typography.text.xs,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
    marginLeft: 2,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  routeName: {
    ...theme.typography.text.md,
    color: theme.colors.gray[700],
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...theme.typography.text.md,
    color: theme.colors.gray[500],
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  emptySubText: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[400],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  loadingText: {
    ...theme.typography.text.md,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.text.md,
    color: theme.colors.system.error,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  errorSubText: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
});

export default BusSchedulePage;