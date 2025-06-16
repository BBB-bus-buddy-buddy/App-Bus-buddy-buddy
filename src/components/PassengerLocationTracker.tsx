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

  // 위치 권한 요청 (승객 앱용)
  const requestLocationPermission = async () => {
    try {
      let permissionStatus;
      if (Platform.OS === 'ios') {
        // iOS는 기본적으로 사용 중 권한만 요청
        permissionStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        // 자동 탑승 기능을 위해 백그라운드 권한도 요청
        if (permissionStatus === RESULTS.GRANTED) {
          await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
        }
        return permissionStatus === RESULTS.GRANTED;
      } else {
        // Android
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 권한',
            message: '실시간 버스 위치와 자동 탑승 기능을 위해 위치 권한이 필요합니다.',
            buttonNeutral: '나중에 묻기',
            buttonNegative: '취소',
            buttonPositive: '확인',
          }
        );
        
        // Android 11+ 백그라운드 위치 권한
        if (
          fineLocation === PermissionsAndroid.RESULTS.GRANTED &&
          parseInt(Platform.Version as string, 10) >= 30
        ) {
          Alert.alert(
            '백그라운드 위치 권한',
            '자동 탑승 기능을 위해 "항상 허용"을 선택해주세요.',
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
                        message: '앱이 백그라운드에서도 자동 탑승을 감지할 수 있도록 "항상 허용"을 선택해주세요.',
                        buttonNeutral: '나중에 묻기',
                        buttonNegative: '취소',
                        buttonPositive: '확인',
                      }
                    );
                  } catch (err) {
                    console.error('백그라운드 위치 권한 요청 실패:', err);
                  }
                },
              },
            ]
          );
        }
        return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('위치 권한 요청 오류:', err);
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
        return { userId: userData.email, organizationId: userData.organizationId };
      } else {
        console.error('사용자 정보 불완전:', userData);
        return null;
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      return null;
    }
  };

  // 승객용 WebSocket 초기화 (자동 탑승 감지용)
  useEffect(() => {
    const initializeWebSocket = async () => {
      const userData = userInfo || await loadUserInfo();
      if (!userData) {
        console.error('자동 탑승: 사용자 정보를 찾을 수 없습니다');
        return;
      }

      if (!userInfo) {
        setUserInfo(userData);
      }

      websocketRef.current = createPassengerWebSocket({
        onOpen: () => {
          console.log('자동 탑승 감지용 WebSocket 연결됨');
          setWebsocketConnected(true);
        },
        onMessage: (data) => {
          // 자동 탑승/하차 관련 메시지만 처리
          if (data.status === 'success' && data.message) {
            if (data.message.includes('탑승') || data.message.includes('하차')) {
              console.log('자동 탑승/하차 응답:', data.message);
            }
          }
        },
        onError: (error) => {
          console.error('자동 탑승 WebSocket 오류:', error);
          setWebsocketConnected(false);
        },
        onClose: () => {
          console.log('자동 탑승 WebSocket 연결 종료');
          setWebsocketConnected(false);
        },
        onBoardingDetected: (busNumber) => {
          showToast(`${busNumber} 버스 탑승이 자동으로 감지되었습니다!`, 'success');
        },
      });

      // 자동 탑승 감지용 WebSocket 연결
      await websocketRef.current.connect('/ws/passenger', userData.organizationId);
    };

    if (isEnabled) {
      initializeWebSocket();
    }

    return () => {
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
    };
  }, [userInfo, isEnabled, showToast]);

  // WebSocket 연결 후 추적 시작
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

  // 추적 상태 관리
  const saveTrackingState = async (active: boolean) => {
    try {
      await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, active ? 'true' : 'false');
      if (active) {
        await AsyncStorage.setItem(TRACKING_START_TIME_KEY, Date.now().toString());
      }
    } catch (error) {
      console.error('추적 상태 저장 실패:', error);
    }
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
    } catch (error) {
      console.error('추적 상태 로드 실패:', error);
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
        showToast('자동 탑승 감지 시간이 만료되었습니다.', 'info');
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
      }
    }, 60000); // 1분마다 체크
  };

  // 위치 추적 시작
  const startLocationTracking = async () => {
    try {
      const userData = userInfo || await loadUserInfo();
      const hasPermission = await requestLocationPermission();
      if (!userData || !hasPermission) {
        console.log('자동 탑승: 사용자 정보 또는 권한 없음');
        return;
      }

      const now = Date.now();
      await saveTrackingState(true);
      setupTrackingTimer(now);
      startPositionTracking();
    } catch (error) {
      console.error('위치 추적 시작 실패:', error);
    }
  };

  // 실제 위치 추적 시작 (자동 탑승 감지용)
  const startPositionTracking = () => {
    if (!websocketConnected || isTracking || !userInfo) return;
    
    try {
      setIsTracking(true);
      console.log('자동 탑승 감지를 위한 위치 추적 시작');

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          if (websocketConnected && websocketRef.current && userInfo) {
            // 자동 탑승 감지를 위한 위치 데이터 전송
            websocketRef.current.sendLocationUpdate({
              userId: userInfo.userId,
              organizationId: userInfo.organizationId,
              latitude,
              longitude,
              timestamp: Date.now(),
            });
          }
        },
        (error) => {
          console.error('위치 추적 오류:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 15, // 15미터 이동시 업데이트 (배터리 최적화)
          interval: 10000, // 10초마다 체크 (자동 탑승 감지에 적합)
          fastestInterval: 5000, // 최소 5초 간격
        }
      );
    } catch (error) {
      console.error('위치 추적 시작 중 오류:', error);
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
      console.log('자동 탑승 감지 위치 추적 중지됨');
    } catch (error) {
      console.error('위치 추적 중지 중 오류:', error);
    }
  };

  // 앱 상태 변화 감지
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // 앱이 포그라운드로 돌아올 때
        console.log('승객 앱이 포그라운드로 돌아옴 - 자동 탑승 감지 재시작');
        startLocationTracking();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // 앱이 백그라운드로 갈 때
        console.log('승객 앱이 백그라운드로 이동 - 자동 탑승 감지 유지');
        loadTrackingState().then(({ startTime }) => {
          if (!isTrackingValid(startTime)) {
            stopPositionTracking();
            showToast('자동 탑승 감지 시간이 만료되었습니다.', 'info');
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
      loadUserInfo().then(userData => {
        if (userData) {
          loadTrackingState().then(({ active, startTime }) => {
            if (active) {
              if (isTrackingValid(startTime)) {
                setupTrackingTimer(startTime);
                // WebSocket 연결 후 자동으로 추적 시작
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
      // 컴포넌트 언마운트 시 정리
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

  // 승객 앱이므로 UI는 렌더링하지 않음 (백그라운드에서 작동)
  return null;
};

export default PassengerLocationTracker;