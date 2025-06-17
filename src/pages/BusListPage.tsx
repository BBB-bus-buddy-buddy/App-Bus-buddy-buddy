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
import useBoardingStore from '../store/useBoardingStore'; // 1. useBoardingStore import

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
    busRealNumber: string | null;
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
  const [stationsWithBuses, setStationsWithBuses] = useState<
    StationWithBuses[]
  >([]);
  const [activeBuses, setActiveBuses] = useState<EnhancedBusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const route = useRoute<BusListScreenRouteProp>();
  const navigation = useNavigation();
  const {routeId, routeName} = route.params;
  const {showToast} = useToast();
  const {setSelectedStation} = useSelectedStationStore();
  // 2. 탑승 중인 버스 번호 가져오기
  const {boardedBusNumber} = useBoardingStore();

  // 버스 표시명 생성 함수
  const getBusDisplayName = (
    busRealNumber: string | null,
    busNumber: string,
  ) => {
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

  // 노선 정보와 버스 정보를 통합해서 가져오기
  const fetchRouteData = useCallback(async () => {
    try {
      setLoading(!refreshing);

      // 1. 노선 정보 가져오기 (정류장 목록 포함)
      const routeData = await routeService.getRouteById(routeId);
      setRouteInfo(routeData);

      // 2. 모든 정류장 정보 가져오기 (location 포함)
      const allStations = await stationService.getAllStations();

      // 3. 해당 노선을 운행하는 버스들 가져오기
      const allBuses = await busService.getOperatingBuses(); // ← 변경점
      const routeBuses = allBuses.filter(bus => bus.routeName === routeName);

      console.log(
        `📊 노선 ${routeName}: 전체 운행 중인 버스 ${routeBuses.length}대`,
      );

      // 운행 중지된 버스 필터링 확인
      const operatingBuses = routeBuses.filter(bus => bus.operate);
      const stoppedBuses = routeBuses.filter(bus => !bus.operate);

      if (stoppedBuses.length > 0) {
        console.warn(
          `⚠️ 운행 중지된 버스 ${
            stoppedBuses.length
          }대가 감지되었습니다:`,
          stoppedBuses.map(bus =>
            getBusDisplayName(bus.busRealNumber, bus.busNumber),
          ),
        );
      }

      console.log(`✅ 실제 운행 중인 버스: ${operatingBuses.length}대`);

      // 각 버스의 다음 정류장 도착 예정 시간 추가
      const busesWithNextArrival = await Promise.all(
        routeBuses.map(async bus => {
          try {
            const busStations = await busService.getBusStationsDetail(
              bus.busNumber,
            );
            const currentStationIndex = busStations.findIndex(
              station => station.isCurrentStation,
            );
            const nextStation =
              currentStationIndex >= 0 &&
              currentStationIndex < busStations.length - 1
                ? busStations[currentStationIndex + 1]
                : null;

            return {
              ...bus,
              nextStationName: nextStation?.name || null,
              nextStationArrivalTime: nextStation?.estimatedArrivalTime || null,
              // 현재 위치는 다음에 향하고 있는 정류장으로 표시
              currentStationName:
                busStations.find(s => s.isCurrentStation)?.name || '이동 중',
            };
          } catch (error) {
            console.error(
              `Error fetching next station for bus ${bus.busNumber}:`,
              error,
            );
            return {
              ...bus,
              nextStationName: null,
              nextStationArrivalTime: null,
              currentStationName: '이동 중',
            };
          }
        }),
      );

      // 5. 최종 확인: 운행 중인 버스만 설정
      const finalOperatingBuses = busesWithNextArrival.filter(
        bus => bus.operate,
      );
      setActiveBuses(finalOperatingBuses);

      console.log('🚌 최종 운행 중인 버스들:');
      finalOperatingBuses.forEach(bus => {
        console.log(`  ✅ ${getBusDisplayName(
          bus.busRealNumber,
          bus.busNumber,
        )}: 
          향하는곳=${bus.currentStationName}, 그다음=${bus.nextStationName}, 
          운행상태=${bus.operate ? '운행중' : '중지'}`);
      });

      // 4. 각 정류장별로 버스 정보 매핑 - location 정보 포함
      const stationsWithBusData: StationWithBuses[] = await Promise.all(
        routeData.stations
          .sort((a, b) => a.sequence - b.sequence)
          .map(async station => {
            console.log('🗺️ 처리 중인 station:', station);

            // 해당 정류장의 전체 정보 찾기 (location 포함)
            const fullStationInfo = allStations.find(
              s => s.id === station.stationId,
            );
            console.log('🗺️ 찾은 fullStationInfo:', fullStationInfo);

            const busInfoForStation = await Promise.all(
              finalOperatingBuses.map(async bus => {
                try {
                  // 운행 중지된 버스는 제외
                  if (!bus.operate) {
                    console.log(
                      `⏹️ 버스 ${getBusDisplayName(
                        bus.busRealNumber,
                        bus.busNumber,
                      )} 운행 중지로 제외`,
                    );
                    return null;
                  }

                  // 각 버스의 정류장 상세 정보 가져오기
                  const busStations = await busService.getBusStationsDetail(
                    bus.busNumber,
                  );

                  // 해당 정류장이 이 버스의 경로에 있는지 확인
                  const targetStation = busStations.find(
                    s => s.name === station.stationName,
                  );

                  let estimatedTime: string | undefined = undefined;

                  if (targetStation) {
                    // 이미 지나간 정류장이면 제외 (isPassed: true)
                    if (targetStation.isPassed) {
                      return null; // 이미 지나간 정류장은 정보 제공하지 않음
                    }

                    // 다음에 향하고 있는 정류장 (isCurrentStation: true)
                    if (targetStation.isCurrentStation) {
                      try {
                        const arrivalData =
                          await stationService.getArrivalEstimate(
                            bus.busNumber,
                            station.stationId,
                          );

                        if (arrivalData.estimatedTime === '--분 --초') {
                          estimatedTime = '--분 --초';
                        } else {
                          estimatedTime = arrivalData.estimatedTime;
                        }
                      } catch (arrivalError) {
                        console.error(
                          `카카오 API 호출 실패 for bus ${bus.busNumber} to station ${station.stationName}:`,
                          arrivalError,
                        );
                        estimatedTime = '--분 --초';
                      }
                    }
                    // 아직 가지 않은 미래 정류장 (isCurrentStation: false && isPassed: false)
                    else if (
                      !targetStation.isCurrentStation &&
                      !targetStation.isPassed
                    ) {
                      try {
                        const arrivalData =
                          await stationService.getArrivalEstimate(
                            bus.busNumber,
                            station.stationId,
                          );
                        if (arrivalData.estimatedTime !== '--분 --초') {
                          estimatedTime = arrivalData.estimatedTime;
                        }
                      } catch (arrivalError) {
                        // 먼 정류장의 경우 API 실패 시 시간 없음으로 처리
                        console.error(
                          `카카오 API 호출 실패 for future station ${bus.busNumber} to ${station.stationName}:`,
                          arrivalError,
                        );
                        estimatedTime = undefined;
                      }
                    }
                  }

                  // 도착 예정 시간이 있는 경우만 반환
                  if (estimatedTime) {
                    return {
                      busNumber: bus.busNumber,
                      busRealNumber: bus.busRealNumber,
                      estimatedArrivalTime: estimatedTime,
                      occupiedSeats: bus.occupiedSeats,
                      totalSeats: bus.totalSeats,
                    };
                  }

                  return null; // 도착 예정 시간이 없으면 null
                } catch (error) {
                  console.error(
                    `Error fetching station info for bus ${bus.busNumber}:`,
                    error,
                  );
                  return null;
                }
              }),
            );

            // null 값들을 필터링하고 유효한 버스 정보만 포함
            const validBusInfo = busInfoForStation.filter(
              busInfo => busInfo !== null,
            );

            // location 처리 개선
            let processedLocation = undefined;

            if (fullStationInfo?.location) {
              if (
                fullStationInfo.location.coordinates &&
                Array.isArray(fullStationInfo.location.coordinates) &&
                fullStationInfo.location.coordinates.length >= 2
              ) {
                // coordinates 배열이 있는 경우
                processedLocation = {
                  x: fullStationInfo.location.coordinates[0], // 경도
                  y: fullStationInfo.location.coordinates[1], // 위도
                  coordinates: fullStationInfo.location.coordinates,
                  type: fullStationInfo.location.type || 'Point',
                };
                console.log('✅ coordinates 배열 사용:', processedLocation);
              } else if (
                fullStationInfo.location.x &&
                fullStationInfo.location.y
              ) {
                // x, y 직접 값이 있는 경우
                processedLocation = {
                  x: fullStationInfo.location.x,
                  y: fullStationInfo.location.y,
                  coordinates: [
                    fullStationInfo.location.x,
                    fullStationInfo.location.y,
                  ],
                  type: fullStationInfo.location.type || 'Point',
                };
                console.log('✅ x,y 직접값 사용:', processedLocation);
              } else {
                console.log(
                  '⚠️ location 형식이 예상과 다름:',
                  fullStationInfo.location,
                );
              }
            } else {
              console.log('⚠️ fullStationInfo에 location이 없음');
            }

            console.log('🔍 최종 processedLocation:', processedLocation);

            return {
              id: station.stationId,
              name: station.stationName,
              sequence: station.sequence,
              location: processedLocation, // 처리된 location 사용
              buses: validBusInfo,
            };
          }),
      );

      console.log('🔍 최종 stationsWithBusData:');
      stationsWithBusData.forEach((station, index) => {
        console.log(`  [${index}] ${station.name}:`);
        console.log(`    - ID: ${station.id}`);
        console.log(`    - location:`, station.location);
        console.log(`    - buses: ${station.buses.length}대`);
        station.buses.forEach(bus => {
          console.log(
            `      * ${getBusDisplayName(
              bus.busRealNumber,
              bus.busNumber,
            )}: ${bus.estimatedArrivalTime}`,
          );
        });
        if (station.location) {
          console.log(`    - coordinates:`, station.location.coordinates);
          console.log(`    - x:`, station.location.x);
          console.log(`    - y:`, station.location.y);
        }
        console.log('    ---');
      });

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
  const [selectedStationDetail, setSelectedStationDetail] =
    useState<StationWithBuses | null>(null);

  const handleStationClick = (station: StationWithBuses) => {
    setSelectedStationDetail(station);
  };

  const handleStationDetailClose = () => {
    setSelectedStationDetail(null);
  };

  const handleGoToMap = (station: StationWithBuses) => {
    console.log('🚌 BusListPage - handleGoToMap 호출됨');
    console.log('🚌 원본 station 데이터:', station);
    console.log('🚌 location 상세:', station.location);

    try {
      // 필수 정보 확인
      if (!station.id || !station.name) {
        console.error('❌ 필수 정보 누락:', {
          id: station.id,
          name: station.name,
        });
        showToast('정류장 정보가 올바르지 않습니다.', 'error');
        return;
      }

      // 기본 station 정보 (필수 필드만)
      const baseStation: {
        id: string;
        name: string;
        location?: {x: number; y: number};
      } = {
        id: station.id,
        name: station.name,
      };

      // location이 있는 경우에만 추가
      if (station.location) {
        if (
          station.location.coordinates &&
          Array.isArray(station.location.coordinates) &&
          station.location.coordinates.length >= 2
        ) {
          baseStation.location = {
            x: Number(station.location.coordinates[0]), // 경도
            y: Number(station.location.coordinates[1]), // 위도
          };
          console.log('✅ location 있음 - coordinates 사용');
        } else if (
          typeof station.location.x === 'number' &&
          typeof station.location.y === 'number'
        ) {
          baseStation.location = {
            x: station.location.x,
            y: station.location.y,
          };
          console.log('✅ location 있음 - x,y 직접 사용');
        } else {
          console.log('⚠️ location 형식이 예상과 다름, 기본 정보만 사용');
        }
      } else {
        console.log('⚠️ location 없음 - 기본 정보만 저장');
      }

      console.log('🚌 최종 변환된 station:', baseStation);

      // Store에 저장
      setSelectedStation(baseStation);

      // 저장 확인 (동기적으로)
      setTimeout(() => {
        const currentState =
          useSelectedStationStore.getState().selectedStation;
        console.log('🚌 Store 확인 - 저장 후 selectedStation:', currentState);

        if (currentState && currentState.id === baseStation.id) {
          console.log('✅ Store 저장 성공 확인됨');

          // 모달 닫기
          setSelectedStationDetail(null);

          // 네비게이션
          console.log('🚌 Home으로 네비게이션 시작');
          navigation.navigate('Home' as never);
        } else {
          console.error('❌ Store 저장 실패');
          showToast('정류장 선택에 실패했습니다.', 'error');
        }
      }, 100);
    } catch (error) {
      console.error('❌ handleGoToMap 에러:', error);
      showToast('예상치 못한 오류가 발생했습니다.', 'error');
    }
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
    console.log('🔍 renderOverallSituation 호출됨');
    console.log('🔍 stationsWithBuses 길이:', stationsWithBuses.length);

    // 도착 예정인 버스들 수집 ("해당 정류장으로 가고있어요")
    const allIncomingBuses: {stationName: string; buses: any[]}[] = [];

    stationsWithBuses.forEach(station => {
      console.log(`🔍 정류장 ${station.name} 체크 중...`);
      console.log(`🔍 정류장 ${station.name}의 버스들:`, station.buses);

      const incomingBuses = station.buses.filter(bus => {
        const hasTime =
          bus.estimatedArrivalTime && bus.estimatedArrivalTime !== '--분 --초';
        const withinTime =
          hasTime && extractMinutes(bus.estimatedArrivalTime) <= 30;

        console.log(
          `  버스 ${getBusDisplayName(
            bus.busRealNumber,
            bus.busNumber,
          )}: 시간=${bus.estimatedArrivalTime}, 30분내=${withinTime}`,
        );

        return hasTime && withinTime;
      });

      console.log(
        `🔍 정류장 ${station.name}의 도착예정 버스: ${incomingBuses.length}대`,
      );

      if (incomingBuses.length > 0) {
        allIncomingBuses.push({
          stationName: station.name,
          buses: incomingBuses.sort(
            (a, b) =>
              extractMinutes(a.estimatedArrivalTime) -
              extractMinutes(b.estimatedArrivalTime),
          ),
        });
      }
    });

    console.log('🔍 총 도착예정 정류장 수:', allIncomingBuses.length);

    if (allIncomingBuses.length === 0) {
      console.log('🔍 도착예정 버스 없음 - 현재 운행중 버스 표시');

      // 도착 예정 버스가 없어도 현재 운행중인 버스 정보는 표시
      if (activeBuses.length > 0) {
        return (
          <View style={styles.overallSituationContainer}>
            <Text style={styles.overallSituationTitle}>
              🚌 현재 운행 중인 버스
            </Text>

            {activeBuses.map((bus, index) => (
              <View key={index} style={styles.situationStationGroup}>
                <Text style={styles.situationStationName}>
                  {getBusDisplayName(bus.busRealNumber, bus.busNumber)} -{' '}
                  {bus.currentStationName}으로 이동 중
                </Text>
                <Text style={styles.situationBusSubtitle}>
                  {getBusSubtitle(bus.busRealNumber, bus.busNumber)}
                </Text>
                <View style={styles.situationBusList}>
                  <View style={styles.situationBusItem}>
                    <Text style={styles.situationBusNumber}>
                      그 다음: {bus.nextStationName || '종점'}
                    </Text>
                    <View style={styles.situationArrivalInfo}>
                      {bus.nextStationArrivalTime && (
                        <Text style={styles.situationArrivalTime}>
                          약 {extractMinutes(bus.nextStationArrivalTime)}분 후
                        </Text>
                      )}
                      <View style={styles.situationSeatInfo}>
                        <View
                          style={[
                            styles.situationSeatIndicator,
                            {
                              backgroundColor: getOccupancyColor(
                                calculateOccupancyRate(
                                  bus.occupiedSeats,
                                  bus.totalSeats,
                                ),
                              ),
                            },
                          ]}
                        />
                        <Text style={styles.situationSeatText}>
                          {bus.totalSeats - bus.occupiedSeats}석
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );
      }

      return null;
    }

    console.log('🔍 도착예정 정보 렌더링');

    return (
      <View style={styles.overallSituationContainer}>
        <Text style={styles.overallSituationTitle}>
          🚌 해당 정류장으로 가고있어요
        </Text>

        {allIncomingBuses.map((stationData, index) => (
          <View key={index} style={styles.situationStationGroup}>
            <Text style={styles.situationStationName}>
              {stationData.stationName}
            </Text>
            <View style={styles.situationBusList}>
              {stationData.buses.map(bus => (
                <View key={bus.busNumber} style={styles.situationBusItem}>
                  <View style={styles.situationBusMainInfo}>
                    <Text style={styles.situationBusNumber}>
                      {getBusDisplayName(bus.busRealNumber, bus.busNumber)}
                    </Text>
                    <Text style={styles.situationBusSubtitle}>
                      {getBusSubtitle(bus.busRealNumber, bus.busNumber)}
                    </Text>
                  </View>
                  <View style={styles.situationArrivalInfo}>
                    <Text style={styles.situationArrivalTime}>
                      약 {extractMinutes(bus.estimatedArrivalTime)}분 후
                    </Text>
                    <View style={styles.situationSeatInfo}>
                      <View
                        style={[
                          styles.situationSeatIndicator,
                          {
                            backgroundColor: getOccupancyColor(
                              calculateOccupancyRate(
                                bus.occupiedSeats,
                                bus.totalSeats,
                              ),
                            ),
                          },
                        ]}
                      />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.busCardsContainer}>
        {activeBuses.map(bus => {
          // 3. 탑승 여부 확인
          const isBoarded = bus.busNumber === boardedBusNumber;
          return (
            <View key={bus.busNumber} style={styles.busCard}>
              <View style={styles.busCardHeader}>
                <Ionicons
                  name="bus"
                  size={20}
                  color={theme.colors.primary.default}
                />
                <View style={styles.busCardTitleContainer}>
                  <Text style={styles.busCardNumber}>
                    {getBusDisplayName(bus.busRealNumber, bus.busNumber)}
                  </Text>
                  <Text style={styles.busCardSubtitle}>
                    {getBusSubtitle(bus.busRealNumber, bus.busNumber)}
                  </Text>
                </View>
                {/* 4. 탑승 중 배지 추가 */}
                {isBoarded && (
                  <View style={styles.boardingBadge}>
                    <Text style={styles.boardingBadgeText}>탑승중</Text>
                  </View>
                )}
              </View>
              <Text style={styles.busCardLocation}>
                {bus.currentStationName}으로 이동 중
                {bus.nextStationName && bus.nextStationArrivalTime && (
                  <Text style={styles.nextArrivalText}>
                    {'\n'}그 다음: {bus.nextStationName} (
                    {extractMinutes(bus.nextStationArrivalTime)}분 후)
                  </Text>
                )}
              </Text>
              <View style={styles.busCardSeats}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${calculateOccupancyRate(
                        bus.occupiedSeats,
                        bus.totalSeats,
                      )}%`,
                    },
                    {
                      backgroundColor: getOccupancyColor(
                        calculateOccupancyRate(
                          bus.occupiedSeats,
                          bus.totalSeats,
                        ),
                      ),
                    },
                  ]}
                />
                <Text style={styles.busCardSeatsText}>
                  {bus.totalSeats - bus.occupiedSeats}석 여유
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  // 정류장 상세 모달 렌더링
  const renderStationDetailModal = () => {
    if (!selectedStationDetail) return null;

    const upcomingBuses = selectedStationDetail.buses.filter(
      bus =>
        bus.estimatedArrivalTime &&
        bus.estimatedArrivalTime !== '--분 --초' &&
        extractMinutes(bus.estimatedArrivalTime) <= 60,
    );

    return (
      <Modal
        visible={!!selectedStationDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={handleStationDetailClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedStationDetail.name}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedStationDetail.sequence}번째 정류장
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleStationDetailClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.gray[600]}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}>
              {/* 도착 예정 버스들 */}
              {upcomingBuses.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    🚌 해당 정류장으로 가고있어요
                  </Text>
                  {upcomingBuses
                    .sort(
                      (a, b) =>
                        extractMinutes(a.estimatedArrivalTime) -
                        extractMinutes(b.estimatedArrivalTime),
                    )
                    .map(bus => {
                      // 5. 모달 내에서도 탑승 여부 확인
                      const isBoarded = bus.busNumber === boardedBusNumber;
                      return (
                        <View key={bus.busNumber} style={styles.modalBusItem}>
                          <View style={styles.modalBusHeader}>
                            <View style={styles.modalBusMainInfo}>
                              <Text style={styles.modalBusNumber}>
                                {getBusDisplayName(
                                  bus.busRealNumber,
                                  bus.busNumber,
                                )}
                              </Text>
                              <Text style={styles.modalBusSubtitle}>
                                {getBusSubtitle(
                                  bus.busRealNumber,
                                  bus.busNumber,
                                )}
                              </Text>
                            </View>
                            {/* 6. 모달 내 탑승 중 배지 추가 */}
                            {isBoarded && (
                              <View style={styles.boardingBadge}>
                                <Text style={styles.boardingBadgeText}>
                                  탑승중
                                </Text>
                              </View>
                            )}
                            <View style={styles.modalArrivalContainer}>
                              <Text style={styles.modalArrivalTime}>
                                약 {extractMinutes(bus.estimatedArrivalTime)}분 후
                              </Text>
                              <View style={styles.modalSeatInfo}>
                                <View
                                  style={[
                                    styles.modalSeatIndicator,
                                    {
                                      backgroundColor: getOccupancyColor(
                                        calculateOccupancyRate(
                                          bus.occupiedSeats,
                                          bus.totalSeats,
                                        ),
                                      ),
                                    },
                                  ]}
                                />
                                <Text style={styles.modalSeatText}>
                                  {bus.totalSeats - bus.occupiedSeats}석
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}

              {/* 버스가 없는 경우 */}
              {upcomingBuses.length === 0 && (
                <View style={styles.modalEmptyState}>
                  <Ionicons
                    name="bus-outline"
                    size={48}
                    color={theme.colors.gray[300]}
                  />
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
                onPress={() => handleGoToMap(selectedStationDetail)}>
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
    // 도착 예정 버스들만 체크 (30분 이내)
    const incomingBuses = item.buses.filter(
      bus =>
        bus.estimatedArrivalTime &&
        bus.estimatedArrivalTime !== '--분 --초' &&
        extractMinutes(bus.estimatedArrivalTime) <= 30,
    );

    // 이 정류장으로 향하고 있는 버스들 찾기
    const movingToBuses = activeBuses.filter(
      bus => bus.currentStationName === item.name,
    );

    console.log(
      `🔍 정류장 ${item.name}: incomingBuses=${incomingBuses.length}대, movingToBuses=${movingToBuses.length}대`,
    );

    return (
      <TouchableOpacity
        style={styles.stationItem}
        onPress={() => handleStationClick(item)}
        activeOpacity={0.7}>
        {/* 정류장 정보 */}
        <View style={styles.stationHeader}>
          <View style={styles.stationLineContainer}>
            {/* 수직 라인 */}
            <View
              style={[
                styles.verticalLine,
                item.sequence === 0 && styles.firstLine,
                item.sequence === stationsWithBuses.length && styles.lastLine,
              ]}
            />

            {/* 이 정류장으로 향하는 버스가 있다면 작은 점 표시 (정류장 도트 위쪽) */}
            {movingToBuses.length > 0 && item.sequence > 0 && (
              <View style={styles.movingBusContainer}>
                <View style={styles.movingBusDot} />
                {movingToBuses.length > 1 && (
                  <Text style={styles.movingBusCount}>
                    {movingToBuses.length}
                  </Text>
                )}
              </View>
            )}

            {/* 정류장 도트 */}
            <View
              style={[
                styles.stationDot,
                incomingBuses.length > 0 && styles.activeDot,
              ]}
            />
          </View>

          <View style={styles.stationInfo}>
            <Text
              style={[
                styles.stationName,
                incomingBuses.length > 0 && styles.activeStationName,
              ]}>
              {item.name}
            </Text>
            <Text style={styles.stationSequence}>
              {item.sequence}번째 정류장
            </Text>

            {/* 이동 중인 버스 정보 */}
            {movingToBuses.length > 0 && (
              <Text style={styles.movingBusStatus}>
                🚌{' '}
                {movingToBuses
                  .map(bus => getBusDisplayName(bus.busRealNumber, bus.busNumber))
                  .join(', ')}
                번 버스가 이동 중
              </Text>
            )}

            {/* 도착 예정 버스 정보 */}
            {incomingBuses.length > 0 && (
              <Text style={styles.stationStatus}>
                📍 {incomingBuses.length}대 도착 예정 (
                {Math.min(
                  ...incomingBuses.map(bus =>
                    extractMinutes(bus.estimatedArrivalTime),
                  ),
                )}
                분 후)
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchRouteData}>
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
                {stationsWithBuses.length}개 정류장 • {activeBuses.length}대
                운행
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

// 7. 스타일시트에 배지 스타일 추가
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
    minWidth: 150,
    ...theme.shadows.sm,
  },
  busCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  busCardTitleContainer: {
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  busCardNumber: {
    ...theme.typography.text.md,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.gray[900],
  },
  busCardSubtitle: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[500],
    marginTop: 1,
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
  situationBusSubtitle: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[500],
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
  situationBusMainInfo: {
    flex: 1,
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

  // 이동 중인 버스 표시 (정류장 도트 위쪽 구간)
  movingBusContainer: {
    position: 'absolute',
    top: 8, // 정류장 도트 위쪽
    left: '50%',
    marginLeft: -4,
    alignItems: 'center',
    zIndex: 2,
  },
  movingBusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.system.warning,
    borderWidth: 1,
    borderColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  movingBusCount: {
    ...theme.typography.text.xs,
    color: theme.colors.system.warning,
    fontWeight: theme.typography.fontWeight.bold as TextStyle['fontWeight'],
    fontSize: 8,
    marginTop: 1,
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
    ...theme.shadows.sm,
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
  movingBusStatus: {
    ...theme.typography.text.xs,
    color: theme.colors.system.warning,
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
    alignItems: 'flex-start',
  },
  modalBusMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  modalBusNumber: {
    ...theme.typography.text.lg,
    fontWeight: theme.typography.fontWeight.semiBold as TextStyle['fontWeight'],
    color: theme.colors.primary.default,
  },
  modalBusSubtitle: {
    ...theme.typography.text.xs,
    color: theme.colors.gray[500],
    marginTop: 2,
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
  boardingBadge: {
    backgroundColor: theme.colors.primary.default,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 'auto', // 오른쪽으로 붙임
  },
  boardingBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default BusListPage;