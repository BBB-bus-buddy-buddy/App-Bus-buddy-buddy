import React, {useEffect, useRef, useState} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import _Ionicons from 'react-native-vector-icons/Ionicons';

import Footer from '../components/Footer';
import {useToast} from '../components/common/Toast';
import {routeService, Route} from '../api/services/routeService';
import theme from '../theme';

Dimensions.get('window');
const Ionicons = _Ionicons as unknown as React.ElementType;

// 네비게이션 타입 정의
type RootStackParamList = {
  BusList: {routeId: string; routeName: string};
  BusRoute: {busNumber: string};
};

type RouteListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BusList'
>;

const RouteListPage: React.FC = () => {
  const [routeList, setRouteList] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<RouteListScreenNavigationProp>();
  const {showToast} = useToast();

  // 노선 목록 불러오기
  const fetchRouteList = async () => {
    try {
      setLoading(true);
      const routes = await routeService.getAllRoutes();
      setRouteList(routes);
      setError(null);
    } catch (error) {
      console.error('노선 목록을 가져오는 중 오류 발생:', error);
      setError('노선 정보를 불러오는데 실패했습니다.');
      if (!refreshing) {
        showToast('노선 정보를 불러오는데 실패했습니다.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 초기 로딩
  useEffect(() => {
    fetchRouteList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 새로고침 처리
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRouteList();
  };

  // 노선 선택 시 해당 노선의 버스 목록 페이지로 이동
  const goToBusList = (route: Route) => {
    navigation.navigate('BusList', {
      routeId: route.id,
      routeName: route.routeName,
    });
  };

  // 노선 아이템 렌더링
  const renderRouteItem = ({item}: {item: Route}) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => goToBusList(item)}
      activeOpacity={0.7}>
      <View style={styles.routeIconContainer}>
        <Ionicons
          name="git-branch"
          size={30}
          color={theme.colors.primary.default}
        />
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.routeName}</Text>
        <Text style={styles.stationsCount}>
          {item.stations.length}개 정류장
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
      <Text style={styles.headerText}>노선 목록</Text>
    </View>
  );

  // 빈 목록 컴포넌트
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bus-outline" size={50} color={theme.colors.gray[300]} />
      <Text style={styles.emptyText}>등록된 노선이 없습니다.</Text>
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchRouteList}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={ListHeader}
        data={routeList}
        renderItem={renderRouteItem}
        keyExtractor={item => item.id}
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
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  headerText: {
    ...theme.typography.heading.h3,
    color: theme.colors.white,
    textAlign: 'center',
  } as TextStyle,
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 80, // Footer 공간 확보
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginVertical: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  routeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary.light + '10', // 10% 투명도
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginBottom: 4,
  },
  stationsCount: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
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
export const AnimatedRouteListPage: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={{flex: 1, opacity: fadeAnim}}>
      <RouteListPage />
    </Animated.View>
  );
};

export default RouteListPage;
