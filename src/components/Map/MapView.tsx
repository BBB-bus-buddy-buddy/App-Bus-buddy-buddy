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
import {authService} from '../../api/services/authService';
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

// 백엔드 BusRealTimeStatusDTO와 일치하는 인터페이스 (승객이 받는 버스 정보)
interface BusRealTimeStatus {
  busId: string;
  busNumber: string;
  busRealNumber: string | null;
  routeName: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  currentStationName: string;
  lastUpdateTime: number;
  currentStationIndex: number;
  totalStations: number;
  operate: boolean; // 운행 여부
}

interface MapViewProps {
  stations?: Station[];
}

type LocationTrackingMode = 'None' | 'NoFollow' | 'Follow' | 'Face';
const DEFAULT_TRACKING_MODE: LocationTrackingMode = 'NoFollow';

const MapView: React.FC<MapViewProps> = ({stations}) => {
  // 승객용 웹소켓 참조 변수
  const websocketRef = useRef<ReturnType<
    typeof createPassengerWebSocket
  > | null>(null);

  const naverMapRef = useRef<any>(null);

  // 상태 관리
  const [stationPositions, setStationPositions] = useState<Station[]>([]);
  const [busPositions, setBusPositions] = useState<BusRealTimeStatus[]>([]);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isMapReady, setIsMapReady] = useState(false);
  const [, setLocationTrackingMode] = useState<LocationTrackingMode>(
    DEFAULT_TRACKING_MODE,
  );
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [, setUserInfo] = useState<{organizationId: string} | null>(null);

  // 선택된 정류장 전역 상태 관리
  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const {showToast} = useToast();

  // 버스 표시명 생성 함수 - null/undefined 처리 추가
  const getBusDisplayName = (
    busRealNumber: string | null,
    busNumber: string,
  ) => {
    if (busRealNumber && busRealNumber.trim()) {
      return busRealNumber.trim();
    }
    return busNumber || 'N/A';
  };

  // 사용자 정보 로드
  const loadUserInfo = useCallback(async () => {
    try {
      const userData = await authService.getUserInfo();
      if (userData && userData.organizationId) {
        setUserInfo({organizationId: userData.organizationId});
        return userData.organizationId;
      }
      return null;
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      return null;
    }
  }, []);

  // 위치 권한 요청
  const requestLocationPermission = useCallback(async () => {
    try {
      let status;

      if (Platform.OS === 'ios') {
        status = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      } else {
        status = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
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

  // 초기 위치로 카메라 설정
  const initializeCamera = useCallback(() => {
    if (hasLocationPermission) {
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
          enableHighAccuracy: false,
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

  // 버스 상태 업데이트 처리 (승객이 받는 실시간 버스 정보)
  const handleBusUpdate = useCallback((busStatus: BusRealTimeStatus) => {
    console.log('🚌 버스 상태 업데이트 수신:', {
      busNumber: busStatus.busNumber,
      operate: busStatus.operate,
      latitude: busStatus.latitude, // ← 이 값들 확인 필요
      longitude: busStatus.longitude, // ← 이 값들 확인 필요
      lastUpdateTime: busStatus.lastUpdateTime,
    });
    setBusPositions(prevBuses => {
      const existingIndex = prevBuses.findIndex(
        bus => bus.busNumber === busStatus.busNumber,
      );

      if (existingIndex >= 0) {
        // 기존 버스 정보 업데이트
        const updatedBuses = [...prevBuses];
        updatedBuses[existingIndex] = busStatus;
        return updatedBuses;
      } else {
        // 새 버스 추가 (운행 중인 경우만)
        if (busStatus.operate) {
          return [...prevBuses, busStatus];
        }
        return prevBuses;
      }
    });
  }, []);

  // 웹소켓 메시지 처리 - 승객 앱 전용
  const handleWebSocketMessage = useCallback(
    (data: any) => {
      try {
        // 버스 상태 업데이트 메시지 처리
        if (data.type === 'busUpdate' && data.data) {
          handleBusUpdate(data.data);
        }
        // 연결 확인 메시지
        else if (data.type === 'connection_established') {
          console.log('승객 WebSocket 연결 확인됨');
        }
        // 에러 메시지
        else if (data.status === 'error') {
          console.error('WebSocket 오류:', data.message);
        }
      } catch (error) {
        console.error('웹소켓 메시지 처리 오류:', error);
      }
    },
    [handleBusUpdate],
  );

  // 승객용 웹소켓 연결 설정
  useEffect(() => {
    const initializeWebSocket = async () => {
      const organizationId = await loadUserInfo();

      if (!organizationId) {
        console.error('승객 앱: Organization ID를 찾을 수 없습니다');
        return;
      }

      websocketRef.current = createPassengerWebSocket({
        onOpen: () => {
          console.log('승객용 실시간 버스 정보 WebSocket 연결됨');
        },
        onMessage: handleWebSocketMessage,
        onBusUpdate: handleBusUpdate, // 버스 업데이트 전용 핸들러
        onError: error => {
          console.error('승객 WebSocket 오류:', error);
          showToast('실시간 버스 정보를 받을 수 없습니다.', 'error');
        },
        onClose: () => {
          console.log('승객용 버스 정보 WebSocket 연결 종료');
        },
        onBoardingDetected: busNumber => {
          showToast(`${busNumber} 버스 탑승이 감지되었습니다.`, 'success');
        },
      });

      // 조직 ID와 함께 승객용 WebSocket 연결
      await websocketRef.current.connect('/ws/passenger', organizationId);
    };

    initializeWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
    };
  }, [handleWebSocketMessage, handleBusUpdate, loadUserInfo, showToast]);

  // 초기화
  useEffect(() => {
    const initialize = async () => {
      // 1. 위치 권한 확인
      const hasPermission = await requestLocationPermission();
      setHasLocationPermission(hasPermission);

      // 2. 정류장 데이터 로드
      await fetchStations();

      // 3. 카메라 초기화
      initializeCamera();
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 권한 상태 변경시 카메라 재설정
  useEffect(() => {
    if (hasLocationPermission && isMapReady) {
      initializeCamera();
    }
  }, [hasLocationPermission, isMapReady, initializeCamera]);

  // 내 위치로 이동
  const moveToMyLocation = useCallback(async () => {
    if (!hasLocationPermission) {
      const granted = await requestLocationPermission();
      if (!granted) return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setSelectedStation(null);
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
  }, [
    hasLocationPermission,
    setSelectedStation,
    moveToMyLocation,
    setTrackingMode,
    requestLocationPermission,
    showToast,
  ]);

  // 지도가 준비되면 표시
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);

  // 초기 로딩
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
        isShowLocationButton={false} // 커스텀 위치 버튼 사용
        isLiteModeEnabled={false}
        onInitialized={handleMapReady}
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
                onTap={() => {
                  console.log(
                    '정류장 클릭:',
                    station.name,
                    'location:',
                    station.location,
                  );
                  setSelectedStation({
                    ...station,
                    location: station.location
                      ? {
                          x: station.location.coordinates[0],
                          y: station.location.coordinates[1],
                        }
                      : undefined,
                  });
                }}
                width={24}
                height={24}
                image={require('../../../assets/images/busStop.png')}
              />
            ),
        )}

        {/* 운행 중인 버스 마커만 표시 */}
        {busPositions.length > 0 &&
          busPositions
            .filter(
              bus =>
                bus.operate && // 운행 중인 버스만
                bus.latitude !== 0 &&
                bus.longitude !== 0 && // 유효한 위치
                bus.latitude >= -90 &&
                bus.latitude <= 90 && // 위도 범위 검증
                bus.longitude >= -180 &&
                bus.longitude <= 180, // 경도 범위 검증
            )
            .map(bus => (
              <NaverMapMarkerOverlay
                key={`bus-${bus.busNumber}`}
                latitude={bus.latitude}
                longitude={bus.longitude}
                caption={{
                  text: getBusDisplayName(bus.busRealNumber, bus.busNumber),
                  textSize: 12,
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
    width: 22,
    height: 22,
  },
});

export default React.memo(MapView);
