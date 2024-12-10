import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingPage from '../pages/LoadingPage';
import useSelectedStationStore from '../store/useSelectedStationStore';
import { RootStackParamList } from '../App';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface BusInfo {
  id: string;
  busNumber: string;
  occupiedSeats: number;
  remainingTime: number;
  durationMessage: string;
  location?: {
    x: number;
    y: number;
  };
}

interface BusStationResponse {
  data: BusInfo[];
}

type StationDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const API_BASE_URL = Platform.select({
  ios: 'http://devse.gonetis.com:12589',
  android: 'http://devse.gonetis.com:12589',
});

const StationDetail: React.FC = () => {
  const [busInfo, setBusInfo] = useState<BusInfo[]>([]);
  const [busStationData, setBusStationData] = useState<BusStationResponse>({ data: [] });
  const [stationLoading, setStationLoading] = useState(true);
  const [stationError, setStationError] = useState<string | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [busDestinationData, setBusDestinationData] = useState<any[]>([]);

  const { selectedStation } = useSelectedStationStore();
  const navigation = useNavigation<StationDetailScreenNavigationProp>();

  const parseDurationMessage = (message: string) => {
    const matches = message.match(/(\d+)분\s*(\d+)?초?/);
    if (matches) {
      const minutes = parseInt(matches[1], 10);
      const seconds = matches[2] ? parseInt(matches[2], 10) : 0;
      return minutes * 60 + seconds;
    }
    return 0;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  const fetchBusStationData = useCallback(async () => {
    try {
      setStationLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get<BusStationResponse>(
        `${API_BASE_URL}/api/bus/stations/${selectedStation?.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      setBusStationData(response.data);
      setStationError(null);
    } catch (error) {
      console.error('Error fetching bus station data:', error);
      setStationError('버스 정류장 정보를 불러오는데 실패했습니다.');
    } finally {
      setStationLoading(false);
    }
  }, [selectedStation]);

  const busDestinationFetch = useCallback(async (name: string, x: number, y: number) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/kakao-api/arrival-time/single`,
        {
          params: {
            origin: `${name},${y},${x}`,
            destination: `${selectedStation?.name},${selectedStation?.location?.y},${selectedStation?.location?.x}`,
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      setBusDestinationData(prevData => {
        const newData = response.data.data;
        const newDataArray = Array.isArray(newData) ? newData : [newData];
        
        if (!Array.isArray(prevData)) {
          return newDataArray.map(item => ({
            ...item,
            remainingTime: parseDurationMessage(item.durationMessage)
          }));
        }

        const updatedData = [...prevData];
        newDataArray.forEach(newItem => {
          if (newItem?.name) {
            const existingItemIndex = updatedData.findIndex(item => item.name === newItem.name);
            if (existingItemIndex !== -1) {
              updatedData[existingItemIndex] = {
                ...updatedData[existingItemIndex],
                ...newItem,
                remainingTime: parseDurationMessage(newItem.durationMessage)
              };
            } else {
              updatedData.push({
                ...newItem,
                remainingTime: parseDurationMessage(newItem.durationMessage)
              });
            }
          }
        });
        return updatedData;
      });
    } catch (error) {
      console.error('Error fetching bus destination data:', error);
    }
  }, [selectedStation]);

  useEffect(() => {
    if (selectedStation) {
      fetchBusStationData();
    }
  }, [selectedStation, fetchBusStationData]);

  useEffect(() => {
    if (busStationData.data?.length > 0) {
      const fetchAllDestinations = async () => {
        setDestinationLoading(true);
        try {
          const fetchPromises = busStationData.data.map((item) => {
            if (item.location?.x && item.location?.y) {
              return busDestinationFetch(item.busNumber, item.location.x, item.location.y);
            }
            return Promise.resolve();
          });

          await Promise.all(fetchPromises);
        } catch (error) {
          console.error('Error fetching all destinations:', error);
        } finally {
          setDestinationLoading(false);
        }
      };

      fetchAllDestinations();
    }
  }, [busStationData, busDestinationFetch]);

  useEffect(() => {
    if (busStationData.data && busDestinationData.length > 0) {
      const combinedInfo = busStationData.data.map(bus => ({
        ...bus,
        durationMessage: formatTime(
          busDestinationData.find(item => item.name === bus.busNumber)?.remainingTime ?? 0
        ),
        remainingTime: busDestinationData.find(item => item.name === bus.busNumber)?.remainingTime ?? 0
      }));
      setBusInfo(combinedInfo);
    }
  }, [busStationData, busDestinationData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBusInfo(prevInfo =>
        prevInfo.map(bus => ({
          ...bus,
          remainingTime: Math.max(0, bus.remainingTime - 1),
          durationMessage: formatTime(Math.max(0, bus.remainingTime - 1))
        }))
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (stationLoading || destinationLoading) return <LoadingPage />;
  if (stationError) return <Text style={styles.errorText}>{stationError}</Text>;

  const BusInfoHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>버스 번호</Text>
      <Text style={styles.headerText}>도착 예정</Text>
      <Text style={styles.headerText}>남은 좌석</Text>
    </View>
  );

  const ProgressBar = React.memo(({ progress }: { progress: number }) => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { width: `${progress}%` }]} />
    </View>
  ));

  return (
    <View style={styles.container}>
      <BusInfoHeader />
      <ScrollView style={styles.scrollView}>
        {busInfo.length > 0 ? (
          busInfo.map((bus, index) => (
            <TouchableOpacity
              key={index}
              style={styles.busItem}
              onPress={() => navigation.navigate('BusRoute', { busNumber: bus.busNumber })}
            >
              <Text style={styles.busNumber}>{bus.busNumber}</Text>
              <Text style={styles.arrivalTime}>{bus.durationMessage}</Text>
              <View style={styles.seatsContainer}>
                <ProgressBar progress={(bus.occupiedSeats / 45) * 100} />
                <Text style={styles.seatsText}>{bus.occupiedSeats}석</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noResult}>검색 결과가 없습니다.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  busItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  busNumber: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  arrivalTime: {
    flex: 1,
    textAlign: 'center',
    color: '#E74C3C',
    fontSize: 14,
  },
  seatsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: 50,
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    marginRight: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3498DB',
  },
  seatsText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  noResult: {
    padding: 20,
    textAlign: 'center',
    color: '#7F8C8D',
  },
  errorText: {
    padding: 20,
    textAlign: 'center',
    color: '#E74C3C',
  },
});

export default StationDetail;