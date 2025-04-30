import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
} from 'react-native';
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

const DEFAULT_CAMERA: Camera = {
  latitude: 37.5665,
  longitude: 126.978,
  zoom: 15,
};

type LocationTrackingMode = 'None' | 'NoFollow' | 'Follow' | 'Face';
const DEFAULT_TRACKING_MODE: LocationTrackingMode = 'NoFollow';

interface BusPosition {
  busNumber: string;
  location: {
    coordinates: [number, number];
  };
}

interface MapViewProps {
  stations?: Station[];
}

const MapView: React.FC<MapViewProps> = ({stations}) => {
  const websocketRef = useRef<ReturnType<typeof createPassengerWebSocket> | null>(null);
  const naverMapRef = useRef<any>(null);

  const [myLocation, setMyLocation] = useState<Camera>(DEFAULT_CAMERA);
  const [stationPositions, setStationPositions] = useState<Station[]>([]);
  const [busPositions, setBusPositions] = useState<BusPosition[]>([]);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isStationFocused, setIsStationFocused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocationTrackingMode] = useState<LocationTrackingMode>(DEFAULT_TRACKING_MODE);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(false);

  // 추가: 사용자의 지도 조작 여부
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);

  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const {showToast} = useToast();

  // 위치 권한 요청
  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 접근 권한',
            message: '버스 위치 서비스를 이용하기 위해 위치 접근 권한이 필요합니다.',
            buttonNeutral: '나중에 묻기',
            buttonNegative: '취소',
            buttonPositive: '확인',
          },
        );
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasLocationPermission(hasPermission);
        return hasPermission;
      } else {
        Geolocation.requestAuthorization();
        setHasLocationPermission(true);
        return true;
      }
    } catch (err) {
      console.warn('위치 권한 요청 중 오류 발생:', err);
      setHasLocationPermission(false);
      return false;
    }
  }, []);

  // 위치 정보 가져오기
  const initializeLocation = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setMyLocation(DEFAULT_CAMERA);
      setCamera(DEFAULT_CAMERA);
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          const newLocation = {latitude, longitude, zoom: 15};
          setMyLocation(newLocation);
          // 정류장에 포커스 중이거나 사용자가 직접 조작 중이 아닐 때만 카메라 이동
          if (!isStationFocused && !isUserInteracting) {
            setCamera(newLocation);
          }
          resolve();
        },
        error => {
          console.error('위치 정보 오류:', error);
          showToast('위치 정보를 가져올 수 없습니다.', 'warning');
          setMyLocation(DEFAULT_CAMERA);
          setCamera(DEFAULT_CAMERA);
          resolve();
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  }, [requestLocationPermission, showToast, isStationFocused, isUserInteracting]);

  const fetchStations = useCallback(async () => {
    try {
      if (stations && stations.length > 0) {
        setStationPositions(stations);
        return;
      }
      const stationsData = await stationService.getAllStations();
      setStationPositions(stationsData);
    } catch (error) {
      console.error('정류장 정보 조회 오류:', error);
      showToast('정류장 정보를 불러올 수 없습니다.', 'error');
    }
  }, [stations, showToast]);

  const handleWebSocketMessage = useCallback((data: any) => {
    try {
      if (typeof data === 'string') {
        const rows = data.split('\n');
        const newBusPositions = rows
          .filter(Boolean)
          .map((row: string) => {
            const [busNumber, lng, lat] = row.split(',');
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

  useEffect(() => {
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
    websocketRef.current.connect('/ws/passenger');
    return () => {
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
    };
  }, [handleWebSocketMessage, showToast]);

  // 추적 모드 설정 함수 - 항상 Follow로 설정
  const setTrackingMode = useCallback(() => {
    setLocationTrackingMode(DEFAULT_TRACKING_MODE);
    if (naverMapRef.current && naverMapRef.current.setLocationTrackingMode) {
      naverMapRef.current.setLocationTrackingMode(DEFAULT_TRACKING_MODE);
    }
  }, []);

  // 내 위치로 카메라 이동
  const moveToMyLocation = useCallback(() => {
    if (myLocation) {
      setCamera({
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        zoom: 15,
      });
      setIsStationFocused(false);
      setIsUserInteracting(false); // 내 위치 버튼 클릭 시 자동 포커싱 재개
      setTrackingMode();
    }
  }, [myLocation, setTrackingMode]);

  // 현재 위치 갱신
  const updateCurrentLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        const newLocation = {latitude, longitude, zoom: 15};
        setMyLocation(newLocation);
        // 정류장 포커스 중이거나 사용자가 직접 조작 중이 아닐 때만 카메라 이동
        if (!isStationFocused && !isUserInteracting) {
          setCamera(newLocation);
        }
        setTrackingMode();
      },
      error => {
        console.error('위치 정보 오류:', error);
        showToast('위치 정보를 가져올 수 없습니다.', 'warning');
      },
      {enableHighAccuracy: true, timeout: 5000},
    );
  }, [isStationFocused, isUserInteracting, setTrackingMode, showToast]);

  // 주기적으로 위치 업데이트
  useEffect(() => {
    if (hasLocationPermission) {
      updateCurrentLocation();
      const locationUpdateTimer = setInterval(() => {
        updateCurrentLocation();
      }, 3000);
      return () => clearInterval(locationUpdateTimer);
    }
  }, [hasLocationPermission, updateCurrentLocation]);

  useEffect(() => {
    let isActive = true;
    const initialize = async () => {
      try {
        setIsLoading(true);
        await initializeLocation();
        await fetchStations();
        if (isActive) {
          setIsLoading(false);
          if (hasLocationPermission) {
            setTrackingMode();
          }
        }
      } catch (error) {
        console.error('초기화 오류:', error);
        showToast('지도를 초기화하는 중 오류가 발생했습니다.', 'error');
        if (isActive) setIsLoading(false);
      }
    };
    initialize();
    return () => {
      isActive = false;
    };
  }, [
    initializeLocation,
    fetchStations,
    showToast,
    hasLocationPermission,
    setTrackingMode,
  ]);

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


  // 위치 버튼 클릭 핸들러
  const handleLocationButtonClick = useCallback(() => {
    if (!hasLocationPermission) {
      requestLocationPermission().then(granted => {
        if (granted) {
          setSelectedStation(null);
          moveToMyLocation();
        } else {
          showToast('위치 추적을 위해 위치 권한이 필요합니다.', 'warning');
        }
      });
      return;
    }
    setSelectedStation(null);
    moveToMyLocation();
  }, [
    hasLocationPermission,
    requestLocationPermission,
    setSelectedStation,
    moveToMyLocation,
    showToast,
  ]);

  // 지도 조작 이벤트 핸들러
  const handleCameraChange = () => {
    setIsUserInteracting(true);
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <View style={styles.container}>
      {/* 위치 버튼 */}
      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={handleLocationButtonClick}
        activeOpacity={0.7}>
        <View style={[styles.locationButtonIcon, styles.locationButtonActive]}>
          <MyLocationIcon width={20} height={20} style={styles.locationIcon} />
        </View>
      </TouchableOpacity>

      <NaverMapView
        ref={naverMapRef}
        style={styles.map}
        camera={camera}
        minZoom={5}
        maxZoom={20}
        isShowLocationButton={true}
        isLiteModeEnabled={false}
        onCameraChanged={handleCameraChange}
        layerGroups={{
          TRANSIT: true,
          BUILDING: true,
          BICYCLE: false,
          CADASTRAL: false,
          MOUNTAIN: false,
          TRAFFIC: false,
        }}>
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
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    ...theme.shadows.md,
  },
  locationButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  locationButtonActive: {
    backgroundColor: 'white',
  },
  locationIcon: {
    width: 20,
    height: 20,
    tintColor: theme.colors.primary.default,
  },
});

export default React.memo(MapView);
