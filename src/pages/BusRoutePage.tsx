import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useSelectedStationStore from '../store/useSelectedStationStore';

const API_BASE_URL = Platform.select({
  ios: 'http://localhost:8088',
  android: 'http://localhost:8088',
});

type RootStackParamList = {
  BusRoute: {busNumber: string};
};

interface Station {
  idx?: number | undefined;
  id: string;
  name: string;
  isCurrentStation?: boolean;
  isPassed?: boolean;
  remainingTime?: number;
  location?: {
    coordinates: number[];
    type: string;
  };
}

interface BusInfo {
  id: string;
  busNumber: string;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  location: {
    coordinates: number[];
    type: string;
  };
  stationNames: string[];
  timestamp: string;
  position?: number;
  prevStationIdx: number;
  prevStationId: string;
  lastStationTime: string;
  indicatorStyle?: {
    top: number;
  };
}

const BusRoutePage: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'BusRoute'>>();
  const [stationList, setStationList] = useState<Station[]>([]);
  const [busInfo, setBusInfo] = useState<BusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeToNextStation, setTimeToNextStation] = useState<number>(0);
  const {setSelectedStation} = useSelectedStationStore();
  const navigation = useNavigation();

  const busNumber = route.params.busNumber;

  const fetchStationDetail = async (stationName: string, index: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/station`, {
        params: {stationName},
      });

      // stationName에 해당하는 정류장 데이터 찾기
      const matchedStation = response.data.data.find(
        (station: {name: string}) => station.name === stationName,
      );

      if (!matchedStation) {
        console.error(`Station not found for name: ${stationName}`);
        return null;
      }

      return {
        ...matchedStation,
        idx: index,
      };
    } catch (error) {
      console.error('정류장 상세 정보 조회 실패:', error);
      return null;
    }
  };

  // const calculatePosition = (prevTime: number, nextTime: number): number => {
  //   const totalTime = prevTime + nextTime;
  //   return Math.floor((prevTime * 50) / totalTime);
  // };

  const fetchStationList = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/api/bus/stationNames/${busNumber}`,
      );
      const stationNames = response.data.data;

      const stationsWithDetails = await Promise.all(
        stationNames.map(async (name: string, index: number) => {
          const stationDetail = await fetchStationDetail(name, index);
          return {
            ...stationDetail,
          };
        }),
      );

      setStationList(stationsWithDetails);
      setError(null);
    } catch (error) {
      console.error('정류장 목록을 불러오는 중 오류 발생:', error);
      setError('정류장 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [busNumber]);
  
  //-----------------------------------------------------
  
  const fetchBusInfo = useCallback(async () => {
    // parseDurationToSeconds 함수를 내부로 이동
    const parseDurationToSeconds = (durationMessage: string) => {
      const matches = durationMessage.match(/(\d+)분\s*(\d+)?초?/);
      if (matches) {
        const minutes = parseInt(matches[1], 10);
        const seconds = matches[2] ? parseInt(matches[2], 10) : 0;
        return minutes * 60 + seconds;
      }
      return 0;
    };
  
    // calculateArrivalTime 함수도 내부에 위치
    const calculateArrivalTime = async (busId: string, stationId: string | undefined) => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get(
          `${API_BASE_URL}/api/kakao-api/arrival-time/multi`,
          {
            params: {
              busId: busId,
              stationId: stationId,
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
  
        return response.data.data;
      } catch (error) {
        return null;
      }
    };
  
    try {
      const response = await axios.get<{data: BusInfo}>(
        `${API_BASE_URL}/api/bus/${busNumber}`,
      );
      const busData = response.data.data;
  
      if (!busData?.location || stationList.length === 0) return;
  
      const nextStation = stationList.find((item) => item?.idx === (busData?.prevStationIdx + 1));
      
      if (!nextStation) return;
  
      const arrivalTimeData = await calculateArrivalTime(busData.id, nextStation.id);
      const estimatedTime = arrivalTimeData?.estimatedTime;
      
      if (!estimatedTime) return;
  
      const remainingSeconds = parseDurationToSeconds(estimatedTime);
      setTimeToNextStation(remainingSeconds);
  
      setStationList(prevList => {
        const updatedList = prevList.map((station, index) => ({
          ...station,
          isPassed: index <= busData.prevStationIdx,
          isCurrentStation: index === busData.prevStationIdx+1,
          remainingTime: index === busData.prevStationIdx+1 ? remainingSeconds : undefined,
        }));
  
        if (JSON.stringify(updatedList) !== JSON.stringify(prevList)) {
          return updatedList;
        }
        return prevList;
      });
  
      // 항상 25로 고정 (전체 높이 50의 중간 지점)
      const fixedPosition = 0;

      setBusInfo({
        ...busData,
        position: fixedPosition,
        indicatorStyle: {
          top: fixedPosition,
        },
      });
    } catch (error) {
      console.error('버스 정보를 불러오는 중 오류 발생:', error);
    }
  }, [busNumber, stationList]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (mounted) {
        await fetchStationList();
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchStationList]);

  useEffect(() => {
    let isSubscribed = true;

    const updateBusInfo = async () => {
      if (isSubscribed && stationList.length > 0) {
        await fetchBusInfo();
      }
    };

    updateBusInfo();

    return () => {
      isSubscribed = false;
    };
  }, [fetchBusInfo, stationList]);

  const handleStationClick = useCallback(
    (station: Station) => {
      const convertedStation: {
        id: string;
        name: string;
        location?: {
          x: number;
          y: number;
        };
      } = {
        id: station.id,
        name: station.name,
        location: station.location
          ? {
              x: station.location.coordinates[0],
              y: station.location.coordinates[1],
            }
          : undefined,
      };

      setSelectedStation(convertedStation);
      navigation.navigate('Home' as never);
    },
    [navigation, setSelectedStation],
  );

  const renderStationItem = useCallback(
    ({item, index}: {item: Station; index: number}) => {
      const isBusHere = busInfo && index === busInfo.prevStationIdx+1;
      const shouldShowBus = busInfo && index === busInfo.prevStationIdx+1 &&
        typeof busInfo.position === 'number';

      return (
        <TouchableOpacity onPress={() => handleStationClick(item)}>
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
                {shouldShowBus && busInfo.indicatorStyle && (
                  <View
                    style={[
                      styles.busIndicatorContainer,
                      {top: busInfo.indicatorStyle.top},
                    ]}>
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
              {item.remainingTime && (
                <Text style={styles.remainingTime}>
                  {Math.ceil(item.remainingTime / 60)}분 후 도착
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busInfo],
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F05034" />
      </View>
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
        <Text style={styles.headerText}>
          <Text style={styles.busNumber}>{busNumber}</Text>
          {timeToNextStation > 0 && (
            <Text style={styles.headerRoute}>
              {` | 약 ${Math.ceil(timeToNextStation / 60)}분 후 도착`}
            </Text>
          )}
        </Text>
      </View>

      <FlatList
        data={stationList}
        renderItem={renderStationItem}
        keyExtractor={(item, index) => index.toString()}
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
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerText: {
    fontSize: 18,
    color: '#333333',
  },
  busNumber: {
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRoute: {
    fontSize: 16,
    color: '#666666',
  },
  stationList: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
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
    backgroundColor: '#E5E5E5',
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
    backgroundColor: '#4CAF50',
  },
  currentLine: {
    backgroundColor: '#F05034',
  },
  stationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: 19,
    zIndex: 1,
  },
  passedDot: {
    backgroundColor: '#4CAF50',
  },
  currentDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F05034',
    borderWidth: 3,
    marginTop: 17,
  },
  busIndicatorContainer: {
    position: 'absolute',
    left: -11,
    transform: [{translateY: -12}],
    zIndex: 2,
  },
  busIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F05034',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  busEmoji: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  stationInfoContainer: {
    flex: 1,
    paddingVertical: 4,
    marginLeft: 12,
  },
  stationName: {
    fontSize: 16,
    color: '#333333',
    marginTop: 15,
  },
  currentStationName: {
    color: '#F05034',
    fontWeight: 'bold',
  },
  remainingTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#F05034',
    textAlign: 'center',
    padding: 16,
  },
});

export default BusRoutePage;
