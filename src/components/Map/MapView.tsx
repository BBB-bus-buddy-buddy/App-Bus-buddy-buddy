import React, {useEffect, useState, useCallback, useRef} from 'react';
import {View, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  Camera,
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import theme from '../../theme';
import LoadingPage from '../../pages/LoadingPage';
import {stationService, Station} from '../../api/services/stationService';
import {createPassengerWebSocket} from '../../api/services/websocketService';
import useSelectedStationStore from '../../store/useSelectedStationStore';
import {useToast} from '../../components/common/Toast';
import MyLocationIcon from '../../../assets/logos/myLocation.svg';

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

type LocationTrackingMode = 'None' | 'NoFollow' | 'Follow' | 'Face';
const DEFAULT_TRACKING_MODE: LocationTrackingMode = 'NoFollow';

const MapView: React.FC<MapViewProps> = ({stations}) => {
  // 웹소켓 참조 변수
  const websocketRef = useRef<ReturnType<
    typeof createPassengerWebSocket
  > | null>(null);

  const naverMapRef = useRef<any>(null);

  // 상태 관리 최소화
  const [stationPositions, setStationPositions] = useState<Station[]>([]);
  const [busPositions, setBusPositions] = useState<BusPosition[]>([]);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isMapReady, setIsMapReady] = useState(false);
  const [, setLocationTrackingMode] = useState<LocationTrackingMode>(
    DEFAULT_TRACKING_MODE,
  );
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 선택된 정류장 전역 상태 관리
  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const {showToast} = useToast();

  // 위치 권한 요청
  const requestLocationPermission = useCallback(async () => {
    try {
      let status;

      if (Platform.OS === 'ios') {
        status = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);

      } else {
        status = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      }

      const granted = status === RESULTS.GRANTED;
      setHasLocationPermission(granted);

      if (!granted) {
        showToast('위치 권한이 필요합니다.', 'warning');
      }

      return granted;
    } catch (error) {
      console.error('위치 권한 요청 오류:', error);
      return false;
    }
  }, [showToast]);

  // 추적 모드 설정 함수
  const setTrackingMode = useCallback(() => {
    setLocationTrackingMode(DEFAULT_TRACKING_MODE);
    if (naverMapRef.current && naverMapRef.current.setLocationTrackingMode) {
      naverMapRef.current.setLocationTrackingMode('Follow');
    }
  }, []);

  // 초기 위치로 카메라 설정 (권한이 있으면 현재 위치로)
  const initializeCamera = useCallback(() => {
    if (hasLocationPermission) {
      // 권한이 있으면 네이버맵이 자동으로 현재 위치로 이동
      // 초기 로딩시에만 현재 위치 가져오기
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          if (!selectedStation && isInitialLoad) {
            setCamera({latitude, longitude, zoom: 15});
            setIsInitialLoad(false);
            setTrackingMode();
          }
        },
        error => {
          console.error('초기 위치 설정 오류:', error);
          setCamera(DEFAULT_CAMERA);
        },
        {
          enableHighAccuracy: false, // 초기 로딩시 빠른 응답 우선
          timeout: 3000,
          maximumAge: 10000,
        },
      );
    } else {
      setCamera(DEFAULT_CAMERA);
    }
  }, [hasLocationPermission, setTrackingMode, selectedStation, isInitialLoad]);

  // 정류장 데이터 불러오기
  const fetchStations = useCallback(async () => {
    try {
      if (stations && stations.length > 0) {
        setStationPositions(stations);
      } else {
        const stationsData = await stationService.getAllStations();
        setStationPositions(stationsData);
      }
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

  // 웹소켓 연결 설정
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

  // 초기화 - 권한 확인 후 데이터 로드
  useEffect(() => {
    const initialize = async () => {
      // 1. 위치 권한 확인
      const hasPermission = await requestLocationPermission();
      setHasLocationPermission(hasPermission);

      // 2. 정류장 데이터 로드 (권한과 무관하게 진행)
      await fetchStations();

      // 3. 카메라 초기화
      initializeCamera();
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회만 실행

  // 권한 상태 변경시 카메라 재설정
  useEffect(() => {
    if (hasLocationPermission && isMapReady) {
      initializeCamera();
    }
  }, [hasLocationPermission, isMapReady, initializeCamera]);

  // 내 위치로 이동 (네이버맵의 내 위치 버튼 대체)
  const moveToMyLocation = useCallback(async () => {
    if (!hasLocationPermission) {
      const granted = await requestLocationPermission();
      if (!granted) return;
    }

    // 현재 위치 가져오기
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setSelectedStation(null); // 선택된 정류장 해제
        setCamera({
          latitude,
          longitude,
          zoom: 15,
        });
        setTrackingMode();
      },
      error => {
        console.error('위치 정보 오류:', error);
        showToast('현재 위치를 가져올 수 없습니다.', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      },
    );
  }, [
    hasLocationPermission,
    requestLocationPermission,
    setSelectedStation,
    setTrackingMode,
    showToast,
  ]);

  // 선택된 정류장이 변경되면 카메라 이동
  useEffect(() => {
    if (selectedStation && selectedStation.location) {
      setCamera({
        latitude: selectedStation.location.x,
        longitude: selectedStation.location.y,
        zoom: 17,
      });
    } else {
      setTrackingMode();
      moveToMyLocation();
    }
  }, [moveToMyLocation, selectedStation, setTrackingMode]);

    // 위치 버튼 클릭 핸들러
    const handleLocationButtonClick = useCallback(() => {
      if (!hasLocationPermission) {
        requestLocationPermission().then(granted => {
          if (granted) {
            setSelectedStation(null);
            moveToMyLocation();
            setTrackingMode();
          } else {
            showToast('위치 추적을 위해 위치 권한이 필요합니다.', 'warning');
          }
        });
        return;
      } else {
        setSelectedStation(null);
        moveToMyLocation();
        setTrackingMode();
      }
    }, [hasLocationPermission, setSelectedStation, moveToMyLocation, setTrackingMode, requestLocationPermission, showToast]);


  // 지도가 준비되면 표시
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);
  
  // 초기 로딩시에만 로딩 화면 표시
  if (!isMapReady && stationPositions.length === 0) {
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
        // 네이버맵의 기본 위치 표시 기능 사용 (권한이 있을 때만)
        isShowLocationButton={hasLocationPermission}
        isLiteModeEnabled={false}
        onInitialized={handleMapReady}
        // 레이어 설정
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
  myLocationButtonDisabled: {
    opacity: 0.7,
  },
  locationIcon: {
    width: 22,
    height: 22,
  },
});

export default React.memo(MapView);