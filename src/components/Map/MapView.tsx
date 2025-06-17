import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
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
import useSelectedStationStore from '../../store/useSelectedStationStore';
import {useToast} from '../../components/common/Toast';
import MyLocationIcon from '../../../assets/logos/myLocation.svg';

import useBusStore from '../../store/useBusStore';
import useBoardingStore from '../../store/useBoardingStore'; // 탑승 상태 스토어 import

// 지도 카메라 초기 위치 (기본값: 서울)
const DEFAULT_CAMERA: Camera = {
  latitude: 37.5665,
  longitude: 126.978,
  zoom: 15,
};

interface MapViewProps {
  stations?: Station[];
}

type LocationTrackingMode = 'None' | 'NoFollow' | 'Follow' | 'Face';
const DEFAULT_TRACKING_MODE: LocationTrackingMode = 'NoFollow';

const MapView: React.FC<MapViewProps> = ({stations}) => {
  const naverMapRef = useRef<any>(null);

  // 상태 관리
  const [stationPositions, setStationPositions] = useState<Station[]>([]);

  const busPositions = useBusStore(state => state.busPositions);
  const {isBoarded, boardedBusNumber} = useBoardingStore();
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [isMapReady, setIsMapReady] = useState(false);
  const [, setLocationTrackingMode] =
    useState<LocationTrackingMode>(DEFAULT_TRACKING_MODE);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 선택된 정류장 전역 상태 관리
  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const {showToast} = useToast();

    const boardedBus = isBoarded
    ? busPositions.find(bus => bus.busNumber === boardedBusNumber)
    : null;

    useEffect(() => {
    // 탑승 상태이고, 탑승한 버스의 위치 정보가 유효할 때
    if (isBoarded && boardedBus) {
      if (
        typeof boardedBus.latitude === 'number' &&
        typeof boardedBus.longitude === 'number'
      ) {
        console.log(`[MapView] 탑승 버스 카메라 추적:`, boardedBus);
        // camera 상태를 업데이트하여 NaverMapView가 선언적으로 반응하도록 함
        setCamera(prevCamera => ({
          ...prevCamera,
          latitude: boardedBus.latitude,
          longitude: boardedBus.longitude,
          zoom: 17, // 버스를 따라갈 때 좀 더 확대
        }));
      }
    }
  }, [isBoarded, boardedBus]); // 탑승 상태와 버스 정보가 변경될 때마다 실행

  // 버스 표시명 생성 함수
  const getBusDisplayName = (
    busRealNumber: string | null,
    busNumber: string,
  ) => {
    if (busRealNumber && busRealNumber.trim()) {
      return busRealNumber.trim();
    }
    return busNumber || 'N/A';
  };

  // 위치 권한 요청 (이하 다른 함수들은 그대로 유지)
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
                  setSelectedStation({
                    ...station,
                    location: station.location
                      ? {
                          x: station.location.x,
                          y: station.location.y,
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
                bus.operate && // 운행 중인 버스만 필터링
                bus.latitude >= -90 &&
                bus.latitude <= 90 &&
                bus.longitude >= -180 &&
                bus.longitude <= 180,
            )
            .map(bus => {
              const isMyBus = bus.busNumber === boardedBusNumber;
              const captionText = isMyBus
                ? `${getBusDisplayName(
                    bus.busRealNumber,
                    bus.busNumber,
                  )} (탑승중)`
                : getBusDisplayName(bus.busRealNumber, bus.busNumber);
              return (
                <NaverMapMarkerOverlay
                  key={`bus-${bus.busNumber}`}
                  latitude={bus.latitude}
                  longitude={bus.longitude}
                  caption={{
                    text: captionText,
                    color: isMyBus
                      ? theme.colors.system.warning
                      : theme.colors.gray[900],
                    textSize: 12,
                    haloColor: theme.colors.white,
                  }}
                  width={24}
                  height={24}
                  zIndex={isMyBus ? 100 : 10}
                  image={require('../../../assets/images/busIcon.png')}
                />
              );
            })}
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