import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Alert, AppState, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createPassengerWebSocket} from '../api/services/websocketService';
import {authService} from '../api/services/authService';
import {useToast} from '../components/common/Toast';
import theme from '../theme';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

// 위치 추적 활성화 상태를 저장하는 AsyncStorage 키
const TRACKING_ACTIVE_KEY = 'location_tracking_active';
const TRACKING_START_TIME_KEY = 'location_tracking_start_time';
const TRACKING_DURATION_MS = 2 * 60 * 60 * 1000; // 2시간을 밀리초로 표현

interface PassengerLocationTrackerProps {
  isEnabled?: boolean;
}

const PassengerLocationTracker: React.FC<PassengerLocationTrackerProps> = ({
  isEnabled = true,
}) => {
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userInfo, setUserInfo] = useState<{
    userId: string;
    organizationId: string;
  } | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingTimeLeft, setTrackingTimeLeft] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('초기화 중...');

  const appState = useRef(AppState.currentState);
  const websocketRef = useRef<ReturnType<
    typeof createPassengerWebSocket
  > | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const {showToast} = useToast();

  // 위치 권한 요청
  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const status = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
      return status === RESULTS.GRANTED;
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 권한',
            message:
              '앱에서 자동 탑승 기능을 사용하기 위해 위치 권한이 필요합니다.',
            buttonNeutral: '나중에 묻기',
            buttonNegative: '취소',
            buttonPositive: '확인',
          },
        );

        // 백그라운드 위치 권한도 요청 (Android 10+)
        if (parseInt(Platform.Version as unknown as string, 10) >= 29) {
          const backgroundGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title: '백그라운드 위치 권한',
              message:
                '앱이 백그라운드에서도 위치를 감지하려면 항상 허용 권한이 필요합니다.',
              buttonNeutral: '나중에 묻기',
              buttonNegative: '취소',
              buttonPositive: '확인',
            },
          );

          return (
            granted === PermissionsAndroid.RESULTS.GRANTED &&
            backgroundGranted === PermissionsAndroid.RESULTS.GRANTED
          );
        }

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }

    return false;
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
        console.log('필요한 사용자 정보가 없습니다');
        return false;
      }
    } catch (error) {
      console.error('사용자 정보 로드 오류:', error);
      return false;
    }
  };

  // WebSocket 초기화
  const initWebSocket = () => {
    if (userInfo?.organizationId) {
      websocketRef.current = createPassengerWebSocket({
        onOpen: () => {
          console.log('WebSocket 연결됨');
          setWebsocketConnected(true);

          // 조직 구독
          if (websocketRef.current) {
            websocketRef.current.subscribeToOrganization(
              userInfo.organizationId,
            );
          }
        },
        onMessage: data => {
          console.log('WebSocket 메시지 수신:', data);
        },
        onError: error => {
          console.error('WebSocket 오류:', error);
          setWebsocketConnected(false);
        },
        onClose: () => {
          console.log('WebSocket 연결 종료');
          setWebsocketConnected(false);
        },
        onBoardingDetected: busNumber => {
          // 자동 탑승 감지 처리
          Alert.alert(
            '자동 탑승 감지됨',
            `${busNumber} 버스에 탑승한 것으로 감지되었습니다.`,
            [{text: '확인', style: 'default'}],
          );
          showToast(
            `${busNumber} 버스에 탑승한 것으로 감지되었습니다.`,
            'success',
          );
        },
      });

      websocketRef.current.connect('/ws/passenger');
    }
  };

  // 위치 추적 상태 저장
  const saveTrackingState = async (active: boolean) => {
    try {
      await AsyncStorage.setItem(
        TRACKING_ACTIVE_KEY,
        active ? 'true' : 'false',
      );
      if (active) {
        // 추적 시작 시간 저장
        await AsyncStorage.setItem(
          TRACKING_START_TIME_KEY,
          Date.now().toString(),
        );
      }
    } catch (error) {
      console.error('추적 상태 저장 오류:', error);
    }
  };

  // 위치 추적 상태 로드
  const loadTrackingState = async (): Promise<{
    active: boolean;
    startTime: number;
  }> => {
    try {
      const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
      const startTimeStr = await AsyncStorage.getItem(TRACKING_START_TIME_KEY);
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0;

      return {
        active: active === 'true',
        startTime,
      };
    } catch (error) {
      console.error('추적 상태 로드 오류:', error);
      return {active: false, startTime: 0};
    }
  };

  // 위치 추적이 유효한지 확인 (시작 시간부터 2시간 이내인지)
  const isTrackingValid = (startTime: number): boolean => {
    const now = Date.now();
    return now - startTime < TRACKING_DURATION_MS;
  };

  // 남은 추적 시간 계산
  const calculateRemainingTime = (startTime: number): string => {
    const now = Date.now();
    const elapsed = now - startTime;
    const remaining = Math.max(0, TRACKING_DURATION_MS - elapsed);

    if (remaining <= 0) {
      return '만료됨';
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}시간 ${minutes}분 남음`;
  };

  // 남은 시간 업데이트 타이머 설정
  const setupTrackingTimer = (startTime: number) => {
    // 이전 타이머 제거
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
    }

    // 새 타이머 설정 (1분마다 업데이트)
    timerIdRef.current = setInterval(() => {
      const remaining = calculateRemainingTime(startTime);
      setTrackingTimeLeft(remaining);

      // 만료 확인
      if (!isTrackingValid(startTime)) {
        stopPositionTracking();
        setTrackingTimeLeft('만료됨');
        showToast('위치 추적 시간이 만료되었습니다.', 'info');

        // 타이머 정리
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
      }
    }, 60000); // 1분마다 업데이트

    // 초기 값 설정
    setTrackingTimeLeft(calculateRemainingTime(startTime));
  };

  // 위치 추적 시작
  const startLocationTracking = async () => {
    try {
      // 사용자 정보와 권한 확인
      const hasInfo = await loadUserInfo();
      const hasPermission = await requestLocationPermission();

      if (!hasInfo) {
        setStatusMessage('사용자 인증이 필요합니다');
        return;
      }

      if (!hasPermission) {
        setStatusMessage(
          '위치 권한이 없어 자동 탑승 기능을 사용할 수 없습니다',
        );

        // 위치 권한이 중요하므로 사용자에게 알림
        Alert.alert(
          '위치 권한 필요',
          '자동 탑승 기능을 사용하려면 위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          [
            {
              text: '확인',
              style: 'default',
            },
          ],
        );
        return;
      }

      // 앱이 활성화될 때마다 추적 시작 시간 갱신
      const now = Date.now();
      await saveTrackingState(true);
      setupTrackingTimer(now);

      // 위치 추적 시작
      startPositionTracking();
    } catch (error) {
      console.error('위치 추적 시작 오류:', error);
      setStatusMessage('위치 추적 초기화 중 오류가 발생했습니다');
    }
  };

  // 실제 위치 추적 시작
  const startPositionTracking = () => {
    if (!websocketConnected || isTracking) return;

    try {
      setIsTracking(true);
      setStatusMessage('위치 추적 중...');

      watchIdRef.current = Geolocation.watchPosition(
        position => {
          const {latitude, longitude} = position.coords;
          setCurrentLocation({latitude, longitude});

          // WebSocket이 연결되어 있으면 위치 정보 전송
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
        error => {
          console.error('위치 추적 오류:', error);
          setStatusMessage(`위치 추적 오류: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // 10미터마다 업데이트
          interval: 5000, // 안드로이드: 5초마다 업데이트
          fastestInterval: 2000, // 안드로이드: 최소 업데이트 간격
        },
      );
    } catch (error) {
      console.error('위치 추적 시작 오류:', error);
      setIsTracking(false);
    }
  };

  // 위치 추적 중지
  const stopPositionTracking = () => {
    if (!isTracking) return;

    try {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      setIsTracking(false);
      setStatusMessage('위치 추적 중지됨');
    } catch (error) {
      console.error('위치 추적 중지 오류:', error);
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
        console.log('App has come to the foreground!');

        // 위치 추적 시간 재설정
        startLocationTracking();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // 앱이 백그라운드로 가는 경우
        console.log('App has gone to the background!');

        // 백그라운드로 가도 위치 추적은 계속됨 (2시간 제한 적용)
        loadTrackingState().then(({startTime}) => {
          // 이미 2시간이 지났는지 확인
          if (!isTrackingValid(startTime)) {
            stopPositionTracking();
            setTrackingTimeLeft('만료됨');
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
      // 사용자 정보 로드 및 WebSocket 연결
      loadUserInfo().then(hasInfo => {
        if (hasInfo) {
          initWebSocket();

          // 기존 추적 상태 로드
          loadTrackingState().then(({active, startTime}) => {
            if (active) {
              // 2시간이 지났는지 확인
              if (isTrackingValid(startTime)) {
                // 아직 유효하면 기존 시간으로 타이머 설정
                setupTrackingTimer(startTime);
                startPositionTracking();
              } else {
                // 2시간이 지났으면 새로 시작
                startLocationTracking();
              }
            } else {
              // 항상 추적 활성화 - 위치 추적 자동 시작
              startLocationTracking();
            }
          });
        } else {
          setStatusMessage('사용자 인증이 필요합니다');
        }
      });
    }

    return () => {
      // 컴포넌트 언마운트 시 정리 (백그라운드에서도 계속 작동)
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  // 상태에 따른 메시지 업데이트
  useEffect(() => {
    if (!isEnabled) {
      setStatusMessage('자동 탑승 기능이 비활성화되었습니다');
    } else if (!websocketConnected) {
      setStatusMessage('서버 연결 중...');
    } else if (isTracking) {
      setStatusMessage(`위치 추적 중 (${trackingTimeLeft})`);
    } else {
      setStatusMessage('위치 추적 중지됨');
    }
  }, [isEnabled, websocketConnected, isTracking, trackingTimeLeft]);

  // isEnabled가 false여도 UI를 숨기지만 실제 추적은 계속 수행
  if (!isEnabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>{statusMessage}</Text>
      {isTracking && currentLocation && (
        <Text style={styles.locationText}>
          {`현재 위치: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: theme.colors.primary.default + '10', // 약간 투명한 배경
    borderRadius: 8,
    margin: 8,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.gray[800],
    fontWeight: '500',
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.gray[600],
    marginTop: 4,
  },
});

export default PassengerLocationTracker;
