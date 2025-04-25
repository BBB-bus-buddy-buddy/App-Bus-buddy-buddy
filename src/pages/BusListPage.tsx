import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  RefreshControl,
  TextStyle,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import _Ionicons from 'react-native-vector-icons/Ionicons';

import Footer from '../components/Footer';
import { useToast } from '../components/common/Toast';
import { busService, BusRealTimeStatus } from '../api/services/busService';
import theme from '../theme';


Dimensions.get('window');
const Ionicons = _Ionicons as unknown as React.ElementType;

// 네비게이션 타입 정의
type RootStackParamList = {
  BusList: { routeId: string; routeName: string };
  BusRoute: { busNumber: string };
};

type BusListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusRoute'>;
type BusListScreenRouteProp = RouteProp<RootStackParamList, 'BusList'>;

const BusListPage: React.FC = () => {
  const [busList, setBusList] = useState<BusRealTimeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigation = useNavigation<BusListScreenNavigationProp>();
  const route = useRoute<BusListScreenRouteProp>();
  const { routeId, routeName } = route.params;
  const { showToast } = useToast();

  // 해당 노선의 버스 목록 불러오기
  const fetchBusesByRoute = async () => {
    try {
      setLoading(true);
      // API가 노선별 버스 조회를 지원하는 경우 해당 API 사용
      // 현재 API 구조에서는 모든 버스를 불러온 후 필터링하는 방식으로 구현
      const allBuses = await busService.getAllBuses();
      
      // 해당 노선의 버스만 필터링
      // 실제 API에서는 이 로직이 서버측에서 처리되어야 함
      const busesInRoute = allBuses.filter(bus => 
        // 여기서는 임시로 라우트 이름이 일치하는 버스를 필터링
        // 실제로는 버스 객체에 routeId 필드가 있어야 함
        bus.routeName === routeName
      );
      
      setBusList(busesInRoute);
      setError(null);
    } catch (error) {
      console.error('버스 목록을 가져오는 중 오류 발생:', error);
      setError('버스 정보를 불러오는데 실패했습니다.');
      if (!refreshing) {
        showToast('버스 정보를 불러오는데 실패했습니다.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 초기 로딩
  useEffect(() => {
    fetchBusesByRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // 새로고침 처리
  const handleRefresh = () => {
    setRefreshing(true);
    fetchBusesByRoute();
  };

  // 버스 선택 시 해당 버스의 상세 페이지로 이동
  const goToBusDetail = (busNumber: string) => {
    navigation.navigate('BusRoute', { busNumber });
  };

  // 시간 포맷팅 함수 (타임스탬프 -> 시간)
  const formatLastUpdateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 버스 아이템 렌더링
  const renderBusItem = ({ item }: { item: BusRealTimeStatus }) => (
    <TouchableOpacity
      style={styles.busItem}
      onPress={() => goToBusDetail(item.busNumber)}
      activeOpacity={0.7}
    >
      <View style={styles.busIconContainer}>
        <Ionicons 
          name="bus" 
          size={30} 
          color={theme.colors.primary.default} 
        />
      </View>
      
      <View style={styles.busInfo}>
        <Text style={styles.busNumber}>{item.busNumber}</Text>
        <Text style={styles.currentStationText}>
          {item.currentStationName || '정보 없음'}
        </Text>
      </View>
      
      <View style={styles.statusInfo}>
        <View style={styles.seatsContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${(item.occupiedSeats / item.totalSeats) * 100}%` }
              ]}
            />
          </View>
          <Text style={styles.seatsText}>
            {item.availableSeats}/{item.totalSeats}석
          </Text>
        </View>
        <Text style={styles.lastUpdateText}>
          {formatLastUpdateTime(item.lastUpdateTime)}
        </Text>
      </View>
      
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={theme.colors.gray[400]} 
      />
    </TouchableOpacity>
  );

  // 헤더 컴포넌트
  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerText}>{routeName}</Text>
      <Text style={styles.subHeaderText}>운행 중인 버스 ({busList.length})</Text>
    </View>
  );

  // 빈 목록 컴포넌트
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="bus-outline" 
        size={50} 
        color={theme.colors.gray[300]} 
      />
      <Text style={styles.emptyText}>현재 운행 중인 버스가 없습니다.</Text>
    </View>
  );

  // 로딩 상태
  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.default} />
      </View>
    );
  }

  // 에러 상태
  if (error && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons 
          name="alert-circle-outline" 
          size={50} 
          color={theme.colors.system.error} 
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchBusesByRoute}
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={ListHeader}
        data={busList}
        renderItem={renderBusItem}
        keyExtractor={(item) => item.busNumber}
        ListEmptyComponent={EmptyList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary.default]}
            tintColor={theme.colors.primary.default}
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
    backgroundColor: theme.colors.white,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    backgroundColor: theme.colors.primary.default,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  headerText: {
    ...theme.typography.heading.h3,
    color: theme.colors.white,
    textAlign: 'center',
  } as TextStyle,
  subHeaderText: {
    ...theme.typography.text.md,
    color: theme.colors.white,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    opacity: 0.8,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 80, // Footer 공간 확보
  },
  busItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginVertical: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  busIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary.light + '10', // 10% 투명도
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  busInfo: {
    flex: 1,
  },
  statusInfo: {
    marginRight: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  busNumber: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginBottom: 4,
  },
  currentStationText: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBarContainer: {
    width: 50,
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary.default,
  },
  seatsText: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[600],
  },
  lastUpdateText: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[500],
  },
  emptyContainer: {
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
  errorText: {
    ...theme.typography.text.md,
    color: theme.colors.system.error,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary.default,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  retryText: {
    ...theme.typography.text.md,
    color: theme.colors.white,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
  },
});

// 애니메이션 래퍼 컴포넌트
export const AnimatedBusListPage: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <BusListPage />
    </Animated.View>
  );
};

export default BusListPage;