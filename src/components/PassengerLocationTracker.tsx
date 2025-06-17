import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createPassengerWebSocket} from '../api/services/websocketService';
import {authService} from '../api/services/authService';
import {useToast} from '../components/common/Toast';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

const TRACKING_ACTIVE_KEY = 'location_tracking_active';
const TRACKING_START_TIME_KEY = 'location_tracking_start_time';
const TRACKING_DURATION_MS = 2 * 60 * 60 * 1000; // 2시간

interface PassengerLocationTrackerProps {
  isEnabled?: boolean;
}

const PassengerLocationTracker: React.FC<PassengerLocationTrackerProps> = ({
  isEnabled = true,
}) => {
  const [userInfo, setUserInfo] = useState<{
    userId: string;
    organizationId: string;
  } | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const appState = useRef(AppState.currentState);
  const websocketRef = useRef<ReturnType<
    typeof createPassengerWebSocket
  > | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const {showToast} = useToast();

  // 위치 권한 요청 (승객 앱용)
  const requestLocationPermission = async () => {
    console.log('📍 [위치권한] 위치 권한 요청 시작 - Platform:', Platform.OS);

    try {
      let permissionStatus;
      if (Platform.OS === 'ios') {
        console.log('🍎 [위치권한] iOS 권한 요청 시작');

        // iOS는 기본적으로 사용 중 권한만 요청
        permissionStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        console.log(
          '📱 [위치권한] iOS WHEN_IN_USE 권한 결과:',
          permissionStatus,
        );

        // 자동 탑승 기능을 위해 백그라운드 권한도 요청
        if (permissionStatus === RESULTS.GRANTED) {
          console.log('✅ [위치권한] WHEN_IN_USE 승인됨 - ALWAYS 권한 요청');
          await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
        }
        return permissionStatus === RESULTS.GRANTED;
      } else {
        console.log('🤖 [위치권한] Android 권한 요청 시작');

        // Android
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '위치 권한',
            message:
              '실시간 버스 위치와 자동 탑승 기능을 위해 위치 권한이 필요합니다.',
            buttonNeutral: '나중에 묻기',
            buttonNegative: '취소',
            buttonPositive: '확인',
          },
        );

        console.log('📍 [위치권한] Android FINE_LOCATION 결과:', fineLocation);

        // Android 11+ 백그라운드 위치 권한
        if (
          fineLocation === PermissionsAndroid.RESULTS.GRANTED &&
          parseInt(Platform.Version as string, 10) >= 30
        ) {
          console.log('🔄 [위치권한] Android 11+ 감지 - 백그라운드 권한 요청');

          Alert.alert(
            '백그라운드 위치 권한',
            '자동 탑승 기능을 위해 "항상 허용"을 선택해주세요.',
            [
              {text: '취소', style: 'cancel'},
              {
                text: '설정으로 이동',
                onPress: async () => {
                  try {
                    console.log('⚙️ [위치권한] 백그라운드 권한 설정 이동');
                    await PermissionsAndroid.request(
                      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                      {
                        title: '백그라운드 위치 권한',
                        message:
                          '앱이 백그라운드에서도 자동 탑승을 감지할 수 있도록 "항상 허용"을 선택해주세요.',
                        buttonNeutral: '나중에 묻기',
                        buttonNegative: '취소',
                        buttonPositive: '확인',
                      },
                    );
                    console.log('🏃 [위치권한] 백그라운드 권한 요청 완료');
                  } catch (err) {
                    console.error(
                      '❌ [위치권한] 백그라운드 위치 권한 요청 실패:',
                      err,
                    );
                  }
                },
              },
            ],
          );
        }
        return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('❌ [위치권한] 위치 권한 요청 오류:', err);
      return false;
    }
  };

  // 사용자 정보 로드
  const loadUserInfo = async () => {
    console.log('👤 [사용자정보] 사용자 정보 로드 시작');

    try {
      const userData = await authService.getUserInfo();
      console.log('👤 [위치추적] 사용자 정보 로드:', userData);

      if (userData && userData.email && userData.organizationId) {
        const userInfo = {
          userId: userData.email,
          organizationId: userData.organizationId,
        };

        console.log('✅ [사용자정보] 사용자 정보 설정 완료:', {
          userId: userInfo.userId.substring(0, 10) + '***',
          organizationId: userInfo.organizationId,
        });

        setUserInfo(userInfo);
        return userInfo;
      } else {
        console.error('❌ [사용자정보] 사용자 정보 불완전:', userData);
        return null;
      }
    } catch (error) {
      console.error('❌ [사용자정보] 사용자 정보 로드 실패:', error);
      return null;
    }
  };

  // 승객용 WebSocket 초기화 (자동 탑승 감지용)
  useEffect(() => {
    console.log(
      '🌐 [WebSocket초기화] WebSocket 초기화 useEffect 시작 - isEnabled:',
      isEnabled,
    );

    const initializeWebSocket = async () => {
      console.log('🚀 [WebSocket초기화] WebSocket 초기화 함수 시작');

      const userData = userInfo || (await loadUserInfo());
      if (!userData) {
        console.error(
          '❌ [WebSocket초기화] 자동 탑승: 사용자 정보를 찾을 수 없습니다',
        );
        return;
      }

      if (!userInfo) {
        console.log('📝 [WebSocket초기화] 사용자 정보 상태 업데이트');
        setUserInfo(userData);
      }

      console.log('🔌 [WebSocket초기화] WebSocket 인스턴스 생성');
      websocketRef.current = createPassengerWebSocket({
        onOpen: () => {
          console.log('✅ [WebSocket] 자동 탑승 감지용 WebSocket 연결됨');
          setWebsocketConnected(true);
        },
        onMessage: data => {
          console.log('📨 [WebSocket] 메시지 수신:', data);

          // 자동 탑승/하차 관련 메시지만 처리
          if (data.status === 'success' && data.message) {
            if (
              data.message.includes('탑승') ||
              data.message.includes('하차')
            ) {
              console.log('🎉 [WebSocket] 자동 탑승/하차 응답:', data.message);
            }
          }
        },
        onError: error => {
          console.error('❌ [WebSocket] 자동 탑승 WebSocket 오류:', error);
          setWebsocketConnected(false);
        },
        onClose: () => {
          console.log('🔴 [WebSocket] 자동 탑승 WebSocket 연결 종료');
          setWebsocketConnected(false);
        },
        onBoardingDetected: busNumber => {
          console.log('🎉 [WebSocket] 탑승 감지 콜백 호출:', busNumber);
          showToast(
            `${busNumber} 버스 탑승이 자동으로 감지되었습니다!`,
            'success',
          );
        },
      });

      console.log('🚀 [WebSocket초기화] WebSocket 연결 시도');
      // 자동 탑승 감지용 WebSocket 연결
      await websocketRef.current.connect(
        '/ws/passenger',
        userData.organizationId,
      );
      console.log('✅ [WebSocket초기화] WebSocket 연결 완료');
    };

    if (isEnabled) {
      console.log(
        '▶️ [WebSocket초기화] isEnabled=true - WebSocket 초기화 시작',
      );
      initializeWebSocket();
    } else {
      console.log(
        '⏸️ [WebSocket초기화] isEnabled=false - WebSocket 초기화 스킵',
      );
    }

    return () => {
      console.log('🧹 [WebSocket초기화] WebSocket 정리 시작');
      if (websocketRef.current) {
        websocketRef.current.disconnect();
        websocketRef.current = null;
        console.log('✅ [WebSocket초기화] WebSocket 정리 완료');
      }
    };
  }, [userInfo, isEnabled, showToast]);

  // WebSocket 연결 후 추적 시작
  useEffect(() => {
    console.log(
      '🔄 [추적시작] WebSocket 연결 상태 확인 useEffect - websocketConnected:',
      websocketConnected,
      'isTracking:',
      isTracking,
    );

    if (websocketConnected && !isTracking) {
      console.log('📋 [추적시작] 추적 상태 로드 시작');

      loadTrackingState().then(({active, startTime}) => {
        console.log('📊 [추적시작] 로드된 추적 상태:', {
          active,
          startTime: new Date(startTime).toLocaleString(),
          isValid: isTrackingValid(startTime),
        });

        if (active && isTrackingValid(startTime)) {
          console.log('▶️ [추적시작] 유효한 추적 상태 - 추적 재시작');
          setupTrackingTimer(startTime);
          startPositionTracking();
        } else {
          console.log('⏰ [추적시작] 무효한 추적 상태 또는 비활성 상태');
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websocketConnected]);

  // 추적 상태 관리
  const saveTrackingState = async (active: boolean) => {
    console.log('💾 [추적상태] 추적 상태 저장:', active);

    try {
      await AsyncStorage.setItem(
        TRACKING_ACTIVE_KEY,
        active ? 'true' : 'false',
      );
      if (active) {
        const now = Date.now();
        await AsyncStorage.setItem(TRACKING_START_TIME_KEY, now.toString());
        console.log(
          '✅ [추적상태] 시작 시간 저장:',
          new Date(now).toLocaleString(),
        );
      }
      console.log('✅ [추적상태] 추적 상태 저장 완료');
    } catch (error) {
      console.error('❌ [추적상태] 추적 상태 저장 실패:', error);
    }
  };

  const loadTrackingState = async (): Promise<{
    active: boolean;
    startTime: number;
  }> => {
    console.log('📖 [추적상태] 추적 상태 로드 시작');

    try {
      const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
      const startTimeStr = await AsyncStorage.getItem(TRACKING_START_TIME_KEY);
      const startTime = startTimeStr ? parseInt(startTimeStr, 10) : 0;

      const result = {
        active: active === 'true',
        startTime,
      };

      console.log('📋 [추적상태] 로드된 추적 상태:', {
        ...result,
        startTimeFormatted: startTime
          ? new Date(startTime).toLocaleString()
          : 'N/A',
      });

      return result;
    } catch (error) {
      console.error('❌ [추적상태] 추적 상태 로드 실패:', error);
      return {active: false, startTime: 0};
    }
  };

  const isTrackingValid = (startTime: number): boolean => {
    const now = Date.now();
    const elapsed = now - startTime;
    const isValid = elapsed < TRACKING_DURATION_MS;

    console.log('⏰ [추적유효성] 추적 유효성 검사:', {
      startTime: new Date(startTime).toLocaleString(),
      now: new Date(now).toLocaleString(),
      elapsed: Math.round(elapsed / 1000 / 60) + '분',
      duration: Math.round(TRACKING_DURATION_MS / 1000 / 60) + '분',
      isValid,
    });

    return isValid;
  };

  const setupTrackingTimer = (startTime: number) => {
    console.log('⏲️ [추적타이머] 추적 타이머 설정');

    if (timerIdRef.current) {
      console.log('🧹 [추적타이머] 기존 타이머 정리');
      clearInterval(timerIdRef.current);
    }

    timerIdRef.current = setInterval(() => {
      console.log('🔍 [추적타이머] 추적 유효성 주기적 검사');

      if (!isTrackingValid(startTime)) {
        console.log('⏰ [추적타이머] 추적 시간 만료 - 중지');
        stopPositionTracking();
        showToast('자동 탑승 감지 시간이 만료되었습니다.', 'info');
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
          console.log('✅ [추적타이머] 타이머 정리 완료');
        }
      }
    }, 60000); // 1분마다 체크

    console.log('✅ [추적타이머] 타이머 설정 완료 (1분 간격)');
  };

  // 위치 추적 시작
  const startLocationTracking = async () => {
    console.log('🚀 [위치추적] 위치 추적 시작 프로세스 시작');

    try {
      const userData = userInfo || (await loadUserInfo());
      const hasPermission = await requestLocationPermission();

      if (!userData || !hasPermission) {
        console.log('❌ [위치추적] 자동 탑승: 사용자 정보 또는 권한 없음');
        return;
      }

      console.log('✅ [위치추적] 사용자 정보 및 권한 확인 완료');

      const now = Date.now();
      await saveTrackingState(true);
      setupTrackingTimer(now);
      startPositionTracking();

      console.log('✅ [위치추적] 위치 추적 시작 완료');
    } catch (error) {
      console.error('❌ [위치추적] 위치 추적 시작 실패:', error);
    }
  };

  // 실제 위치 추적 시작 (자동 탑승 감지용)
  const startPositionTracking = () => {
    if (!websocketConnected || isTracking) {
      console.warn('⚠️ [위치추적] 추적 시작 조건 미충족:', {
        websocketConnected,
        isTracking,
      });
      return;
    }

    console.log('🎯 [위치추적] 실제 위치 추적 시작');

    try {
      setIsTracking(true);
      console.log('🔍 [위치추적] 위치 추적 시작됨');

      const watchOptions = {
        enableHighAccuracy: true,
        interval: 5000,
        fastestInterval: 2000,
      };

      console.log('⚙️ [위치추적] Watch 옵션:', watchOptions);

      watchIdRef.current = Geolocation.watchPosition(
        position => {
          const {latitude, longitude} = position.coords;
          console.log('📍 [위치추적] 새 위치 수집:', {
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            accuracy: Math.round(position.coords.accuracy) + 'm',
          });

          if (websocketConnected && websocketRef.current && userInfo) {
            const locationData = {
              userId: userInfo.userId,
              organizationId: userInfo.organizationId,
              latitude,
              longitude,
              timestamp: Date.now(),
            };

            console.log('🚀 [위치추적] WebSocket으로 위치 전송 시도:', {
              ...locationData,
              userId: locationData.userId.substring(0, 10) + '***',
            });

            websocketRef.current.sendLocationUpdate(locationData);

            console.log('✅ [위치추적] 위치 전송 완료');
          } else {
            console.error('❌ [위치추적] 전송 실패 - 연결상태:', {
              websocketConnected,
              hasWebsocketRef: !!websocketRef.current,
              hasUserInfo: !!userInfo,
            });
          }
        },
        error => {
          console.error('❌ [위치추적] GPS 오류:', {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.code === 1,
            POSITION_UNAVAILABLE: error.code === 2,
            TIMEOUT: error.code === 3,
          });
        },
        watchOptions,
      );

      console.log(
        '👀 [위치추적] Geolocation.watchPosition 설정 완료 - watchId:',
        watchIdRef.current,
      );
    } catch (error) {
      console.error('❌ [위치추적] 추적 시작 실패:', error);
      setIsTracking(false);
    }
  };

  const stopPositionTracking = () => {
    if (!isTracking) {
      console.log('⏸️ [위치중지] 이미 추적 중지됨');
      return;
    }

    console.log('⏹️ [위치중지] 위치 추적 중지 시작');

    try {
      if (watchIdRef.current !== null) {
        console.log(
          '🛑 [위치중지] Geolocation.clearWatch 호출 - watchId:',
          watchIdRef.current,
        );
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      console.log('✅ [위치중지] 자동 탑승 감지 위치 추적 중지됨');
    } catch (error) {
      console.error('❌ [위치중지] 위치 추적 중지 중 오류:', error);
    }
  };

  // 앱 상태 변화 감지
  useEffect(() => {
    console.log('📱 [앱상태] AppState 리스너 설정');

    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log(
        '🔄 [앱상태] 앱 상태 변경:',
        appState.current,
        '->',
        nextAppState,
      );

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // 앱이 포그라운드로 돌아올 때
        console.log(
          '🌅 [앱상태] 승객 앱이 포그라운드로 돌아옴 - 자동 탑승 감지 재시작',
        );
        startLocationTracking();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // 앱이 백그라운드로 갈 때
        console.log(
          '🌙 [앱상태] 승객 앱이 백그라운드로 이동 - 자동 탑승 감지 유지',
        );
        loadTrackingState().then(({startTime}) => {
          const isValid = isTrackingValid(startTime);
          console.log('⏰ [앱상태] 백그라운드 전환 시 추적 유효성:', isValid);

          if (!isValid) {
            console.log('⏰ [앱상태] 추적 시간 만료로 중지');
            stopPositionTracking();
            showToast('자동 탑승 감지 시간이 만료되었습니다.', 'info');
          }
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      console.log('🧹 [앱상태] AppState 리스너 정리');
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websocketConnected, userInfo, isTracking]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    console.log(
      '🔄 [컴포넌트초기화] 컴포넌트 마운트 useEffect - isEnabled:',
      isEnabled,
    );

    if (isEnabled) {
      console.log('🚀 [컴포넌트초기화] 초기화 시작');

      loadUserInfo().then(userData => {
        if (userData) {
          console.log('👤 [컴포넌트초기화] 사용자 정보 로드 완료');

          loadTrackingState().then(({active, startTime}) => {
            console.log('📊 [컴포넌트초기화] 추적 상태:', {
              active,
              startTime: new Date(startTime).toLocaleString(),
              isValid: isTrackingValid(startTime),
            });

            if (active) {
              if (isTrackingValid(startTime)) {
                console.log(
                  '▶️ [컴포넌트초기화] 유효한 추적 상태 - 타이머 설정',
                );
                setupTrackingTimer(startTime);
                // WebSocket 연결 후 자동으로 추적 시작
              } else {
                console.log('🔄 [컴포넌트초기화] 만료된 추적 상태 - 새로 시작');
                startLocationTracking();
              }
            } else {
              console.log('🆕 [컴포넌트초기화] 비활성 상태 - 새로 시작');
              startLocationTracking();
            }
          });
        } else {
          console.error('❌ [컴포넌트초기화] 사용자 정보 로드 실패');
        }
      });
    } else {
      console.log('⏸️ [컴포넌트초기화] isEnabled=false - 초기화 스킵');
    }

    return () => {
      console.log('🧹 [컴포넌트정리] 컴포넌트 언마운트 - 정리 시작');

      // 컴포넌트 언마운트 시 정리
      if (watchIdRef.current !== null) {
        console.log('🛑 [컴포넌트정리] Geolocation watch 정리');
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (websocketRef.current) {
        console.log('🔌 [컴포넌트정리] WebSocket 연결 해제');
        websocketRef.current.disconnect();
        websocketRef.current = null;
      }
      if (timerIdRef.current) {
        console.log('⏲️ [컴포넌트정리] 추적 타이머 정리');
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }

      console.log('✅ [컴포넌트정리] 컴포넌트 정리 완료');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  // 승객 앱이므로 UI는 렌더링하지 않음 (백그라운드에서 작동)
  console.log('🎨 [렌더링] PassengerLocationTracker 렌더링 (UI 없음)');
  return null;
};

export default PassengerLocationTracker;
