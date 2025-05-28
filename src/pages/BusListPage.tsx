import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextStyle,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import _Ionicons from 'react-native-vector-icons/Ionicons';

import Footer from '../components/Footer';
import {useToast} from '../components/common/Toast';
import {busService, BusRealTimeStatus} from '../api/services/busService';
import {routeService, Route} from '../api/services/routeService';
import {stationService} from '../api/services/stationService';
import useSelectedStationStore from '../store/useSelectedStationStore';
import theme from '../theme';

const Ionicons = _Ionicons as unknown as React.ElementType;

// 네비게이션 타입 정의
type RootStackParamList = {
  BusList: {routeId: string; routeName: string};
  Home: undefined;
};

type BusListScreenRouteProp = RouteProp<RootStackParamList, 'BusList'>;

interface StationWithBuses {
  id: string;
  name: string;
  sequence: number;
  location?: {
    x: number;
    y: number;
    coordinates: number[];
    type: string;
  };
  buses: {
    busNumber: string;
    estimatedArrivalTime?: string;
    occupiedSeats: number;
    totalSeats: number;
  }[];
}

interface EnhancedBusInfo extends BusRealTimeStatus {
  nextStationName?: string | null;
  nextStationArrivalTime?: string | null;
}

const BusListPage: React.FC = () => {
  const [, setRouteInfo] = useState<Route | null>(null);
  const [stationsWithBuses, setStationsWithBuses] = useState<StationWithBuses[]>([]);
  const [activeBuses, setActiveBuses] = useState<EnhancedBusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const route = useRoute<BusListScreenRouteProp>();
  const navigation = useNavigation();
  const {routeId, routeName} = route.params;
  const {showToast} = useToast();
  const {setSelectedStation} = useSelectedStationStore();

  // 노선 정보와 버스 정보를 통합해서 가져오기
  const fetchRouteData = useCallback(async () => {
    try {
      setLoading(!refreshing);
      
      // 1. 노선 정보 가져오기 (정류장 목록 포함)
      const routeData = await routeService.getRouteById(routeId);
      setRouteInfo(routeData);

      // 2. 해당 노선을 운행하는 버스들 가져오기
      const allBuses = await busService.getAllBuses();
      const routeBuses = allBuses.filter(bus => bus.routeName === routeName);
      
      // 각 버스의 다음 정류장 도착 예정 시간 추가
      const busesWithNextArrival = await Promise.all(
        routeBuses.map(async (bus) => {
          try {
            const busStations = await busService.getBusStationsDetail(bus.busNumber);
            const currentStationIndex = busStations.findIndex(station => station.isCurrentStation);
            const nextStation = currentStationIndex >= 0 && currentStationIndex < busStations.length - 1 
              ? busStations[currentStationIndex + 1] 
              : null;
            
            return {
              ...bus,
              nextStationName: nextStation?.name || null,
              nextStationArrivalTime: nextStation?.estimatedArrivalTime || null,
              currentStationName: bus.currentStationName || busStations.find(s => s.isCurrentStation)?.name || '위치 확인 중',
            };
          } catch (error) {
            console.error(`Error fetching next station for bus ${bus.busNumber}:`, error);
            return {
              ...bus,
              nextStationName: null,
              nextStationArrivalTime: null,
              currentStationName: bus.currentStationName || '위치 확인 중',
            };
          }
        })
      );
      
      setActiveBuses(busesWithNextArrival);

      // 3. 각 정류장별로 버스 정보 매핑 - 새로운 데이터 구조 반영
      const stationsWithBusData: StationWithBuses[] = await Promise.all(
        routeData.stations
          .sort((a, b) => a.sequence - b.sequence)
          .map(async (station) => {
            const busInfoForStation = await Promise.all(
              routeBuses.map(async (bus) => {
                try {
                  // 각 버스의 정류장 상세 정보 가져오기
                  const busStations = await busService.getBusStationsDetail(bus.busNumber);
                  
                  // 해당 정류장이 이 버스의 경로에 있는지 확인
                  const targetStation = busStations.find(s => s.name === station.stationName);
                  
                  let estimatedTime: string | undefined = undefined;
                  
                  if (targetStation) {
                    // 이미 지나간 정류장이면 제외
                    if (targetStation.isPassed) {
                      return null; // 이미 지나간 정류장은 정보 제공하지 않음
                    }
                    
                    // 다음에 향하고 있는 정류장 (isCurrentStation: true)
                    if (targetStation.isCurrentStation) {
                      try {
                        const arrivalData = await stationService.getArrivalEstimate(bus.busNumber, station.stationId);
                        
                        if (arrivalData.estimatedTime === '--분 --초') {
                          estimatedTime = '--분 --초';
                        } else {
                          estimatedTime = arrivalData.estimatedTime;
                        }
                      } catch (arrivalError) {
                        console.error(`카카오 API 호출 실패 for bus ${bus.busNumber} to station ${station.stationName}:`, arrivalError);
                        estimatedTime = '--분 --초';
                      }
                    }
                    // 아직 가지 않은 미래 정류장 (isCurrentStation: false && isPassed: false)
                    else if (!targetStation.isCurrentStation && !targetStation.isPassed) {
                      try {
                        const arrivalData = await stationService.getArrivalEstimate(bus.busNumber, station.stationId);
                        if (arrivalData.estimatedTime !== '--분 --초') {
                          estimatedTime = arrivalData.estimatedTime;
                        }
                      } catch (arrivalError) {
                        // 먼 정류장의 경우 API 실패 시 시간 없음으로 처리
                        console.error(`카카오 API 호출 실패 for future station ${bus.busNumber} to ${station.stationName}:`, arrivalError);
                        estimatedTime = undefined;
                      }
                    }
                  }
                  
                  // 도착 예정 시간이 있는 경우만 반환
                  if (estimatedTime) {
                    return {
                      busNumber: bus.busNumber,
                      estimatedArrivalTime: estimatedTime,
                      occupiedSeats: bus.occupiedSeats,
                      totalSeats: bus.totalSeats,
                    };
                  }
                  
                  return null; // 도착 예정 시간이 없으면 null
                } catch (error) {
                  console.error(`Error fetching station info for bus ${bus.busNumber}:`, error);
                  return null;
                }
              })
            );

            // null 값들을 필터링하고 유효한 버스 정보만 포함
            const validBusInfo = busInfoForStation.filter(busInfo => busInfo !== null);

            return {
              id: station.stationId,
              name: station.stationName,
              sequence: station.sequence,
              location: station.location ? {
                x: station.location.coordinates ? station.location.coordinates[0] : station.location.x,
                y: station.location.coordinates ? station.location.coordinates[1] : station.location.y,
                coordinates: station.location.coordinates || [station.location.x, station.location.y],
                type: station.location.type || 'Point',
              } : undefined,
              buses: validBusInfo,
            };
          })
      );

      setStationsWithBuses(stationsWithBusData);
      setError(null);
    } catch (error) {
      console.error('노선 데이터를 가져오는 중 오류 발생:', error);
      setError('노선 정보를 불러오는데 실패했습니다.');
      if (!refreshing) {
        showToast('노선 정보를 불러오는데 실패했습니다.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId, routeName, refreshing, showToast]);

  // 초기 로딩
  useEffect(() => {
    fetchRouteData();
  }, [fetchRouteData]);

  // 새로고침 처리
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRouteData();
  };

  // 정류장 클릭 시 상세 모달 표시
  const [selectedStationDetail, setSelectedStationDetail] = useState<StationWithBuses | null>(null);
  
  const handleStationClick = (station: StationWithBuses) => {
    setSelectedStationDetail(station);
  };

  const handleStationDetailClose = () => {
    setSelectedStationDetail(null);
  };

  const handleGoToMap = (station: StationWithBuses) => {
    // location 정보 처리 개선
    const convertedStation = {
      id: station.id,
      name: station.name,
      // location이 undefined면 아예 포함하지 않음
      ...(station.location && station.location.coordinates ? {
        location: {
          x: station.location.coordinates[0], // 경도
          y: station.location.coordinates[1], // 위도
        }
      } : {})
    };

    console.log('🚌 BusListPage - handleGoToMap 호출됨');
    console.log('🚌 설정할 station:', convertedStation);
    console.log('🚌 location 체크:', station.location);
    
    setSelectedStation(convertedStation);
    
    // Store에 저장되었는지 확인을 위한 setTimeout
    setTimeout(() => {
      const currentState = useSelectedStationStore.getState().selectedStation;
      console.log('🚌 Store 확인 - 설정 후 selectedStation:', currentState);
      if (!currentState) {
        console.error('❌ Store에 저장 실패! location 문제일 수 있음');
        // location 없이 다시 시도
        const simpleStation = {
          id: station.id,
          name: station.name,
        };
        console.log('🚌 location 없이 재시도:', simpleStation);
        setSelectedStation(simpleStation);
      }
    }, 100);
    
    setSelectedStationDetail(null);
    
    console.log('🚌 Home으로 네비게이션 시작');
    navigation.navigate('Home' as never);
  };

  // 버스별 좌석 사용률 계산
  const calculateOccupancyRate = (occupied: number, total: number) => {
    return total > 0 ? (occupied / total) * 100 : 0;
  };

  // 좌석 사용률에 따른 색상 반환
  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return theme.colors.system.error;
    if (rate >= 70) return theme.colors.system.warning;
    return theme.colors.system.success;
  };

  // 시간 문자열에서 분 추출
  const extractMinutes = (timeString?: string | null): number => {
    if (!timeString) return 0;
    const matches = timeString.match(/(\d+)분/);
    return matches && matches[1] ? parseInt(matches[1], 10) : 0;
  };

  // 전체 운행 상황 요약 (정류장 목록 위에 표시)
  const renderOverallSituation = () => {
    // 도착 예정인 버스들 수집 ("해당 정류장으로 가고있어요")
    const allIncomingBuses: {stationName: string; buses: any[]}[] = [];
    
    stationsWithBuses.forEach(station => {
      const incomingBuses = station.buses.filter(bus => 
        bus.estimatedArrivalTime && bus.estimatedArrivalTime !== '--분 --초' && extractMinutes(bus.estimatedArrivalTime) <= 30
      );

      if (incomingBuses.length > 0) {
        allIncomingBuses.push({
          stationName: station.name,
          buses: incomingBuses.sort((a, b) => extractMinutes(a.estimatedArrivalTime) - extractMinutes(b.estimatedArrivalTime))
        });
      }
    });

    if (allIncomingBuses.length === 0) {
      return null;
    }

    return (
      <View style={styles.overallSituationContainer}>
        <Text style={styles.overallSituationTitle}>🚌 해당 정류장으로 가고있어요</Text>
        
        {allIncomingBuses.map((stationData, index) => (
          <View key={index} style={styles.situationStationGroup}>
            <Text style={styles.situationStationName}>{stationData.stationName}</Text>
            <View style={styles.situationBusList}>
              {stationData.buses.map((bus) => (
                <View key={bus.busNumber} style={styles.situationBusItem}>
                  <Text style={styles.situationBusNumber}>{bus.busNumber}</Text>
                  <View style={styles.situationArrivalInfo}>
                    <Text style={styles.situationArrivalTime}>
                      약 {extractMinutes(bus.estimatedArrivalTime)}분 후
                    </Text>
                    <View style={styles.situationSeatInfo}>
                      <View style={[
                        styles.situationSeatIndicator,
                        {backgroundColor: getOccupancyColor(calculateOccupancyRate(bus.occupiedSeats, bus.totalSeats))}
                      ]} />
                      <Text style={styles.situationSeatText}>
                        {bus.totalSeats - bus.occupiedSeats}석
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 운행 중인 버스 요약 정보
  const renderBusSummary = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>운행 현황</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.busCardsContainer}>
        {activeBuses.map((bus) => (
          <View key={bus.busNumber} style={styles.busCard}>
            <View style={styles.busCardHeader}>
              <Ionicons name="bus" size={20} color={theme.colors.primary.default} />
              <Text style={styles.busCardNumber}>{bus.busNumber}</Text>
            </View>
            <Text style={styles.busCardLocation}>
              {bus.currentStationName}
              {bus.nextStationName && bus.nextStationArrivalTime && (
                <Text style={styles.nextArrivalText}>
                  {'\n'}→ {bus.nextStationName} ({extractMinutes(bus.nextStationArrivalTime)}분 후)
                </Text>
              )}
            </Text>
            <View style={styles.busCardSeats}>
              <View style={[
                styles.progressBar,
                {width: `${calculateOccupancyRate(bus.occupiedSeats, bus.totalSeats)}%`},
                {backgroundColor: getOccupancyColor(calculateOccupancyRate(bus.occupiedSeats, bus.totalSeats))}
              ]} />
              <Text style={styles.busCardSeatsText}>
                {bus.totalSeats - bus.occupiedSeats}석 여유
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  // 정류장 상세 모달 렌더링
  const renderStationDetailModal = () => {
    if (!selectedStationDetail) return null;

    const upcomingBuses = selectedStationDetail.buses.filter(bus => 
      bus.estimatedArrivalTime && bus.estimatedArrivalTime !== '--분 --초' && extractMinutes(bus.estimatedArrivalTime) <= 60
    );

    return (
      <Modal
        visible={!!selectedStationDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={handleStationDetailClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStationDetail.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedStationDetail.sequence}번째 정류장</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleStationDetailClose}
              >
                <Ionicons name="close" size={24} color={theme.colors.gray[600]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 도착 예정 버스들 */}
              {upcomingBuses.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>🚌 해당 정류장으로 가고있어요</Text>
                  {upcomingBuses
                    .sort((a, b) => extractMinutes(a.estimatedArrivalTime) - extractMinutes(b.estimatedArrivalTime))
                    .map((bus) => (
                      <View key={bus.busNumber} style={styles.modalBusItem}>
                        <View style={styles.modalBusHeader}>
                          <Text style={styles.modalBusNumber}>{bus.busNumber}</Text>
                          <View style={styles.modalArrivalContainer}>
                            <Text style={styles.modalArrivalTime}>
                              약 {extractMinutes(bus.estimatedArrivalTime)}분 후
                            </Text>
                            <View style={styles.modalSeatInfo}>
                              <View style={[
                                styles.modalSeatIndicator,
                                {backgroundColor: getOccupancyColor(calculateOccupancyRate(bus.occupiedSeats, bus.totalSeats))}
                              ]} />
                              <Text style={styles.modalSeatText}>
                                {bus.totalSeats - bus.occupiedSeats}석
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                  ))}
                </View>
              )}

              {/* 버스가 없는 경우 */}
              {upcomingBuses.length === 0 && (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="bus-outline" size={48} color={theme.colors.gray[300]} />
                  <Text style={styles.modalEmptyText}>
                    현재 이 정류장에 도착 예정인 버스가 없습니다.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* 모달 하단 버튼 */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => handleGoToMap(selectedStationDetail)}
              >
                <Ionicons name="map" size={20} color={theme.colors.white} />
                <Text style={styles.mapButtonText}>지도에서 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // 정류장 아이템 렌더링
  const renderStationItem = ({item}: {item: StationWithBuses}) => {
    const incomingBuses = item.buses.filter(bus => 
      bus.estimatedArrivalTime && bus.estimatedArrivalTime !== '--분 --초' && extractMinutes(bus.estimatedArrivalTime) <= 30
    );

    return (
      <TouchableOpacity
        style={styles.stationItem}
        onPress={() => handleStationClick(item)}
        activeOpacity={0.7}>
        
        {/* 정류장 정보 */}
        <View style={styles.stationHeader}>
          <View style={styles.stationLineContainer}>
            <View
              style={[
                styles.verticalLine,
                item.sequence === 0 && styles.firstLine,
                item.sequence === stationsWithBuses.length - 1 && styles.lastLine,
              ]}
            />
            <View style={[
              styles.stationDot,
              incomingBuses.length > 0 && styles.activeDot,
            ]} />
          </View>
          
          <View style={styles.stationInfo}>
            <Text style={[
              styles.stationName,
              incomingBuses.length > 0 && styles.activeStationName,
            ]}>
              {item.name}
            </Text>
            <Text style={styles.stationSequence}>
              {item.sequence}번째 정류장
            </Text>
            {incomingBuses.length > 0 && (
              <Text style={styles.stationStatus}>
                🚌 {incomingBuses.length}대 도착 예정 ({Math.min(...incomingBuses.map(bus => extractMinutes(bus.estimatedArrivalTime)))}분 후)
              </Text>
            )}
          </View>
          
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.gray[400]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // 빈 목록 컴포넌트
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bus-outline" size={50} color={theme.colors.gray[300]} />
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
          onPress={fetchRouteData}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={() => (
          <View>
            {/* 헤더 */}
            <View style={styles.header}>
              <Text style={styles.headerText}>{routeName}</Text>
              <Text style={styles.subHeaderText}>
                {stationsWithBuses.length}개 정류장 • {activeBuses.length}대 운행
              </Text>
            </View>
            
            {/* 버스 요약 정보 */}
            {activeBuses.length > 0 && renderBusSummary()}
            
            {/* 전체 운행 상황 */}
            {renderOverallSituation()}
            
            {/* 정류장 목록 제목 */}
            <View style={styles.stationListHeader}>
              <Text style={styles.stationListTitle}>정류장별 실시간 정보</Text>
            </View>
          </View>
        )}
        data={stationsWithBuses}
        renderItem={renderStationItem}
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
      
      {/* 정류장 상세 모달 */}
      {renderStationDetailModal()}
      
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
    opacity: 0.9,
  },
  summaryContainer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  summaryTitle: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  busCardsContainer: {
    flexDirection: 'row',
  },
  busCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    minWidth: 120,
    ...theme.shadows.sm,
  },
  busCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  busCardNumber: {
    ...theme.typography.text.md,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
    marginLeft: theme.spacing.xs,
  },
  busCardLocation: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
  },
  nextArrivalText: {
    ...theme.typography.text.xs,
    color: theme.colors.system.info,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
  },
  busCardSeats: {
    position: 'relative',
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.xs,
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.xs,
  },
  busCardSeatsText: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[600],
  },
  
  // 전체 운행 상황 스타일
  overallSituationContainer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  overallSituationTitle: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.primary.dark,
    marginBottom: theme.spacing.md,
  },
  situationStationGroup: {
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  situationStationName: {
    ...theme.typography.text.sm,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  situationBusList: {
    gap: theme.spacing.xs,
  },
  situationBusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  situationBusNumber: {
    ...theme.typography.text.sm,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
    color: theme.colors.primary.default,
  },
  situationArrivalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  situationArrivalTime: {
    ...theme.typography.text.sm,
    color: theme.colors.system.warning,
    marginRight: theme.spacing.sm,
  },
  situationSeatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  situationSeatIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  situationSeatText: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[600],
  },
  
  stationListHeader: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  stationListTitle: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 80, // Footer 공간 확보
  },
  stationItem: {
    backgroundColor: theme.colors.white,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  stationLineContainer: {
    width: 24,
    alignItems: 'center',
    height: 50,
    position: 'relative',
    marginRight: theme.spacing.md,
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
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.gray[300],
    borderWidth: 2,
    borderColor: theme.colors.white,
    marginTop: 19,
    zIndex: 1,
  },
  activeDot: {
    backgroundColor: theme.colors.primary.default,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 17,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    ...theme.typography.text.md,
    color: theme.colors.gray[800],
    marginBottom: 2,
  },
  activeStationName: {
    color: theme.colors.primary.default,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
  },
  stationSequence: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[500],
  },
  stationStatus: {
    ...theme.typography.text.xs,
    color: theme.colors.primary.default,
    marginTop: 2,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
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
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.8,
    minHeight: Dimensions.get('window').height * 0.4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  modalTitle: {
    ...theme.typography.heading.h4,
    color: theme.colors.gray[900],
  } as TextStyle,
  modalSubtitle: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
    marginTop: 2,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  modalBody: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  modalSection: {
    marginBottom: theme.spacing.lg,
  },
  modalSectionTitle: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[800],
    marginBottom: theme.spacing.md,
  },
  modalBusItem: {
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  modalBusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBusNumber: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.primary.default,
  },
  modalArrivalContainer: {
    alignItems: 'flex-end',
  },
  modalArrivalTime: {
    ...theme.typography.text.md,
    color: theme.colors.system.warning,
    marginBottom: theme.spacing.xs,
  },
  modalSeatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSeatIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  modalSeatText: {
    ...theme.typography.text.sm,
    color: theme.colors.gray[600],
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  modalEmptyText: {
    ...theme.typography.text.md,
    color: theme.colors.gray[500],
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  modalFooter: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[100],
  },
  mapButton: {
    backgroundColor: theme.colors.primary.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  mapButtonText: {
    ...theme.typography.text.md,
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.medium as TextStyle['fontWeight'],
  },
});

export default BusListPage;