import React, {useEffect, useState, useCallback, useRef} from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  Camera,
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';

import theme from '../../theme';
import LoadingPage from '../../pages/LoadingPage';
import {stationService, Station} from '../../api/services/stationService';
import {createPassengerWebSocket} from '../../api/services/websocketService';
import useSelectedStationStore from '../../store/useSelectedStationStore';
import {useToast} from '../../components/common/Toast';
import MyLocationIcon from '../../../assets/logos/myLocation.svg';

// 내 위치 아이콘 이미지 (SVG 대신 이미지 사용)

// 지도 카메라 초기 위치 (기본값: 서울)
const DEFAULT_CAMERA: Camera = {
  latitude: 37.5665,
  longitude: 126.978,
  zoom: 15,
};

interface BusPosition {
  busNumber: string;
  location: {
    coordinates: [number, number];
  };
}

interface MapViewProps {
  stations?: Station[]; // 옵션으로 외부에서 정류장 목록 전달받을 수 있음
}

const MapView: React.FC<MapViewProps> = ({stations}) => {
  // 웹소켓 참조 변수
  const websocketRef = useRef<ReturnType<
    typeof createPassengerWebSocket
  > | null>(null);

  // 상태 관리
  const [myLocation, setMyLocation] = useState<Camera>(DEFAULT_CAMERA);
  const [stationPositions, setStationPositions] = useState<Station[]>([]);
  const [busPositions, setBusPositions] = useState<BusPosition[]>([]);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isLoading, setIsLoading] = useState(true);

  // 선택된 정류장 전역 상태 관리
  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const {showToast} = useToast();

  // 현재 위치 초기화
  const initializeLocation = useCallback(() => {
    return new Promise<void>(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          setMyLocation({latitude, longitude, zoom: 15});
          resolve();
        },
        error => {
          console.error('위치 정보 오류:', error);
          showToast('위치 정보를 가져올 수 없습니다.', 'warning');
          setMyLocation(DEFAULT_CAMERA);
          resolve();
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  }, [showToast]);

  // 정류장 데이터 불러오기
  const fetchStations = useCallback(async () => {
    try {
      // 외부에서 전달받은 정류장이 있으면 사용, 아니면 API 호출
      if (stations && stations.length > 0) {
        setStationPositions(stations);
        return;
      }

      // API 호출로 정류장 데이터 가져오기
      const stationsData = await stationService.getAllStations();
      setStationPositions(stationsData);
    } catch (error) {
      console.error('정류장 정보 조회 오류:', error);
      showToast('정류장 정보를 불러올 수 없습니다.', 'error');
    }
  }, [stations, showToast]);

  // 웹소켓 메시지 처리
  const handleWebSocketMessage = useCallback((data: any) => {
    try {
      if (typeof data === 'string') {
        const rows = data.split('\n');
        const newBusPositions = rows
          .filter(Boolean)
          .map((row: string) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [busNumber, lng, lat, seats] = row.split(',');
            return {
              busNumber: busNumber.trim(),
              location: {
                coordinates: [parseFloat(lat), parseFloat(lng)],
              },
            };
          })
          .filter(
            (pos: {location: {coordinates: number[]}}): pos is BusPosition =>
              !isNaN(pos.location.coordinates[0]) &&
              !isNaN(pos.location.coordinates[1]),
          );

        setBusPositions(newBusPositions);
      }
    } catch (error) {
      console.error('웹소켓 데이터 파싱 오류:', error);
    }
  }, []);

  // 웹소켓 연결 설정
  useEffect(() => {
    // 웹소켓 서비스 인스턴스 생성
    websocketRef.current = createPassengerWebSocket({
      onOpen: () => {
        console.log('버스 위치 웹소켓 연결됨');
      },
      onMessage: handleWebSocketMessage,
      onError: error => {
        console.error('웹소켓 오류:', error);
        showToast('실시간 버스 위치 정보를 받을 수 없습니다.', 'error');
      },
      onClose: () => {
        console.log('버스 위치 웹소켓 연결 종료');
      },
    });

    // 웹소켓 연결
    websocketRef.current.connect('/ws/passenger');

    // 컴포넌트 언마운트 시 웹소켓 연결 종료
    return () => {
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
    };
  }, [handleWebSocketMessage, showToast]);

  // 초기화 (위치, 정류장 데이터)
  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        setIsLoading(true);
        await initializeLocation();
        await fetchStations();

        if (isActive) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('초기화 오류:', error);
        showToast('지도를 초기화하는 중 오류가 발생했습니다.', 'error');

        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isActive = false;
    };
  }, [initializeLocation, fetchStations, showToast]);

  // 선택된 정류장이 변경되면 카메라 이동
  useEffect(() => {
    if (selectedStation && selectedStation.location) {
      setCamera({
        latitude: selectedStation.location.x,
        longitude: selectedStation.location.y,
        zoom: 17,
      });
    } else if (myLocation) {
      setCamera({
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        zoom: 15,
      });
    }
  }, [selectedStation, myLocation]);

  // 내 위치로 이동하는 함수
  const moveToMyLocation = useCallback(() => {
    if (myLocation) {
      setCamera({
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        zoom: 15,
      });
    }
  }, [myLocation]);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        camera={camera}
        minZoom={5}
        maxZoom={20}
        isShowLocationButton={false}
        isLiteModeEnabled={false}>
        {/* 내 위치 마커 */}
        {myLocation && (
          <NaverMapMarkerOverlay
            width={24}
            height={24}
            longitude={myLocation.longitude}
            latitude={myLocation.latitude}
          />
        )}

        {/* 정류장 마커 */}
        {stationPositions.map(
          station =>
            station.location && (
              <NaverMapMarkerOverlay
                key={`station-${station.id}`}
                latitude={station.location.x}
                longitude={station.location.y}
                caption={{
                  text: station.name,
                  textSize: 13,
                  color: theme.colors.gray[900],
                  haloColor: theme.colors.white,
                }}
                onTap={() =>
                  setSelectedStation({
                    ...station,
                    location: station.location
                      ? {
                          x: station.location.coordinates[0],
                          y: station.location.coordinates[1],
                        }
                      : undefined,
                  })
                }
                width={24}
                height={24}
                image={require('../../../assets/images/busStop.png')}
              />
            ),
        )}

        {/* 버스 마커 */}
        {busPositions.map((bus, index) => (
          <NaverMapMarkerOverlay
            key={`bus-${bus.busNumber}-${index}`}
            latitude={bus.location.coordinates[0]}
            longitude={bus.location.coordinates[1]}
            caption={{
              text: bus.busNumber,
              textSize: 13,
              color: theme.colors.gray[900],
              haloColor: theme.colors.white,
            }}
            width={24}
            height={24}
            image={require('../../../assets/images/busIcon.png')}
          />
        ))}
      </NaverMapView>

      {/* 내 위치로 이동하는 버튼 */}
      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={moveToMyLocation}
        activeOpacity={0.7}>
        <MyLocationIcon
          width={22}
          height={22}
          fill={theme.colors.primary.default}
          style={styles.locationIcon}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: theme.colors.white,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.full,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  locationIcon: {
    width: 22,
    height: 22,
    tintColor: theme.colors.primary.default,
  },
});

export default React.memo(MapView);
