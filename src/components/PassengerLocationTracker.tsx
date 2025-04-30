import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPassengerWebSocket } from '../api/services/websocketService';
import { authService } from '../api/services/authService';
import { useToast } from '../components/common/Toast';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const TRACKING_ACTIVE_KEY = 'location_tracking_active';
const TRACKING_START_TIME_KEY = 'location_tracking_start_time';
const TRACKING_DURATION_MS = 2 * 60 * 60 * 1000; // 2시간

interface PassengerLocationTrackerProps {
  isEnabled?: boolean;
}

const PassengerLocationTracker: React.FC<PassengerLocationTrackerProps> = ({
  isEnabled = true,
}) => {
  const [userInfo, setUserInfo] = useState<{ userId: string; organizationId: string } | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const appState = useRef(AppState.currentState);
  const websocketRef = useRef<ReturnType<typeof createPassengerWebSocket> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  // 위치 권한 요청
  const requestLocationPermission = async () => {
    try {
      let permissionStatus;
      if (Platform.OS === 'ios') {
        permissionStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        if (permissionStatus === RESULTS.GRANTED) {
          await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
        }
        return permissionStatus === RESULTS.GRANTED;
      } else {
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 권한',
            message: '앱에서 자동 탑승 기능을 사용하기 위해 위치 권한이 필요합니다.',
            buttonNeutral: '나중에 묻기',
            buttonNegative: '취소',
            buttonPositive: '확인',
          }
        );
        if (
          fineLocation === PermissionsAndroid.RESULTS.GRANTED &&
          parseInt(Platform.Version as string, 10) >= 30
        ) {
          Alert.alert(
            '백그라운드 위치 권한 필요',
            '자동 탑승 기능을 계속 사용하려면 항상 허용 권한이 필요합니다. 설정에서 "항상 허용"을 선택해주세요.',
            [
              { text: '취소', style: 'cancel' },
              {
                text: '설정으로 이동',
                onPress: async () => {
                  try {
                    await PermissionsAndroid.request(
                      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                      {
                        title: '백그라운드 위치 권한',
                        message: '앱이 백그라운드에서도 위치를 추적할 수 있도록 "항상 허용"을 선택해주세요.',
                        buttonNeutral: '나중에 묻기',
                        buttonNegative: '취소',
                        buttonPositive: '확인',
                      }
                    );
                  } catch (err) {
                    console.error(err);
                  }
                },
              },
            ]
          );
        }
        return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  // 사용자 정보 로드
  const loadUserInfo = async () => {
    try {
      const userData = await authService.getUserInfo();
      if (userData && userData.email && userData.organizationId) {
        setUserInfo({
          userId: userData.email,
          organizationId: userData.organizationId,
        });
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  };

  // WebSocket 연결 후 위치 추적 시작
  useEffect(() => {
    if (websocketConnected && !isTracking) {
      loadTrackingState().then(({ active, startTime }) => {
        if (active && isTrackingValid(startTime)) {
          setupTrackingTimer(startTime);
          startPositionTracking();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websocketConnected]);

  // WebSocket 초기화
  useEffect(() => {
    if (!userInfo) return;
    websocketRef.current = createPassengerWebSocket({
      onOpen: () => {
        setWebsocketConnected(true);
        if (websocketRef.current) {
          websocketRef.current.subscribeToOrganization(userInfo.organizationId);
        }
      },
      onMessage: () => {},
      onError: () => setWebsocketConnected(false),
      onClose: () => setWebsocketConnected(false),
      onBoardingDetected: busNumber => {
        showToast(`${busNumber} 버스에 탑승한 것으로 감지되었습니다.`, 'success');
      },
    });
    websocketRef.current.connect('/ws/passenger');
    return () => {
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo]);

  // 위치 추적 상태 저장
  const saveTrackingState = async (active: boolean) => {
    try {
      await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, active ? 'true' : 'false');
      if (active) {
        await AsyncStorage.setItem(TRACKING_START_TIME_KEY, Date.now().toString());
      }
    } catch {}
  };

  const loadTrackingState = async (): Promise<{ active: boolean; startTime: number }> => {
    try {
      const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
      const startTimeStr = await AsyncStorage.getItem(TRACKING_START_TIME_KEY);
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0;
      return {
        active: active === 'true',
        startTime,
      };
    } catch {
      return { active: false, startTime: 0 };
    }
  };

  const isTrackingValid = (startTime: number): boolean => {
    const now = Date.now();
    return now - startTime < TRACKING_DURATION_MS;
  };

  const setupTrackingTimer = (startTime: number) => {
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
    }
    timerIdRef.current = setInterval(() => {
      if (!isTrackingValid(startTime)) {
        stopPositionTracking();
        showToast('위치 추적 시간이 만료되었습니다.', 'info');
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
      }
    }, 60000);
  };

  // 위치 추적 시작
  const startLocationTracking = async () => {
    try {
      const hasInfo = userInfo || (await loadUserInfo());
      const hasPermission = await requestLocationPermission();
      if (!hasInfo || !hasPermission) return;
      const now = Date.now();
      await saveTrackingState(true);
      setupTrackingTimer(now);
      startPositionTracking();
    } catch {}
  };

  // 실제 위치 추적 시작
  const startPositionTracking = () => {
    if (!websocketConnected || isTracking) return;
    try {
      setIsTracking(true);
      watchIdRef.current = Geolocation.watchPosition(
        position => {
          const { latitude, longitude } = position.coords;
          if (websocketConnected && websocketRef.current && userInfo) {
            websocketRef.current.sendLocationUpdate({
              userId: userInfo.userId,
              organizationId: userInfo.organizationId,
              latitude,
              longitude,
              timestamp: Date.now(),
            });
          }
        },
        () => {},
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 2000,
        }
      );
    } catch {
      setIsTracking(false);
    }
  };

  const stopPositionTracking = () => {
    if (!isTracking) return;
    try {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
    } catch {}
  };

  // 앱 상태 변화 감지
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        startLocationTracking();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        loadTrackingState().then(({ startTime }) => {
          if (!isTrackingValid(startTime)) {
            stopPositionTracking();
            showToast('위치 추적 시간이 만료되었습니다.', 'info');
          }
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websocketConnected, userInfo, isTracking]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    if (isEnabled) {
      loadUserInfo().then(hasInfo => {
        if (hasInfo) {
          loadTrackingState().then(({ active, startTime }) => {
            if (active) {
              if (isTrackingValid(startTime)) {
                setupTrackingTimer(startTime);
                startPositionTracking();
              } else {
                startLocationTracking();
              }
            } else {
              startLocationTracking();
            }
          });
        }
      });
    }

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  // UI 완전 제거 (렌더링 없음)
  return null;
};

export default PassengerLocationTracker;
