import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import axios from 'axios';
import GoogleLogo from '../../assets/logos/google.svg';
import AppleLogo from '../../assets/logos/apple.svg';
import {appleAuth} from '@invertase/react-native-apple-authentication';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

type UserRole = 'ROLE_GUEST' | 'ROLE_USER' | 'ADMIN';

interface UserResponse {
  data: {
    role: UserRole;
  };
  message: string;
}

const API_BASE_URL = Platform.select({
  ios: 'http://devse.kr:23589',
  android: 'http://devse.kr:23589', // Android 에뮬레이터에서 localhost 접근용
}) as string;

const GOOGLE_LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/google`;

// 플랫폼별 앱 스킴 URL 설정 - 타입 assertion으로 string 타입 보장
const APP_SCHEME_URL = Platform.select({
  ios: 'kr.devse.bbb.Busbuddybuddy:/oauth2callback',
  android: 'com.busbuddybuddy://oauth2callback',
}) as string;

const LoginPage: React.FC<LoginPageProps> = ({onLoginSuccess}) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // 초기 토큰 체크 및 라우팅
  useEffect(() => {
    checkTokenAndNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUrl = useCallback(async (url: string) => {
    if (url.includes('token=')) {
      const token = url.split('token=')[1].split('&')[0];
      await handleLoginSuccess(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // onLoginSuccess와 fetchUserRole, handleRoleBasedNavigation도 의존성에 추가해야 하지만
  // 이 함수들은 컴포넌트 내부에 정의되어 있어 useCallback의 의존성 배열에 추가하면 순환 참조가 발생할 수 있음
  // 실제 프로덕션 코드에서는 이 함수들을 컴포넌트 외부로 이동하거나 useReducer를 사용하는 것이 좋음

  // 딥링크 이벤트 리스너 설정 - handleUrl을 의존성 배열에 추가
  useEffect(() => {
    // 앱이 실행 중이지 않을 때 열린 URL 처리
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl(url);
      }
    });

    // 앱이 실행 중일 때의 URL 처리를 위한 리스너
    const linkingListener = Linking.addEventListener('url', ({url}) => {
      handleUrl(url);
    });

    return () => {
      linkingListener.remove();
    };
  }, [handleUrl]); // handleUrl을 의존성 배열에 추가

  const checkTokenAndNavigate = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      if (token) {
        try {
          const userRole = await fetchUserRole(token);
          await handleRoleBasedNavigation(userRole);
        } catch (error) {
          console.error('Token validation error:', error);
          // 네트워크 에러 또는 토큰 만료 시 토큰 삭제하고 로그인 화면 유지
          await AsyncStorage.removeItem('token');
          // 로그인 화면에 그대로 유지됨
        }
      } else {
        await AsyncStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Token check error:', error);
      await AsyncStorage.removeItem('token');
      // AsyncStorage 접근 실패 시에도 앱은 계속 실행
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async (token: string): Promise<UserRole> => {
    try {
      const response = await axios.get<UserResponse>(
        `${API_BASE_URL}/api/auth/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10초 타임아웃
        },
      );
      return response.data.data.role;
    } catch (error) {
      console.error('Role fetch error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          console.error('Request timeout - server not responding');
        } else if (error.code === 'ERR_NETWORK') {
          console.error('Network error - cannot reach server');
        }
      }
      throw error;
    }
  };

  const handleRoleBasedNavigation = async (role: UserRole) => {
    switch (role) {
      case 'ROLE_GUEST':
        navigation.navigate('EnterCode' as never);
        break;
      case 'ROLE_USER':
      case 'ADMIN':
        navigation.navigate('Home' as never);
        break;
      default:
        console.warn('Unknown role:', role);
        // 알 수 없는 역할의 경우 토큰 삭제
        await AsyncStorage.removeItem('token');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      const available = await InAppBrowser.isAvailable();

      if (available) {
        // URL 리스너는 이미 useEffect에서 설정되어 있음

        const result = await InAppBrowser.openAuth(
          GOOGLE_LOGIN_URL,
          APP_SCHEME_URL, // 플랫폼별 앱 스킴 URL 사용
          {
            ephemeralWebSession: false,
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
          },
        );

        if (result.type === 'success' && result.url) {
          await handleUrl(result.url);
        } else if (result.type === 'cancel') {
          console.log('User cancelled Google login');
        }
      } else {
        await Linking.openURL(GOOGLE_LOGIN_URL);
      }
    } catch (error) {
      console.error('Google login error:', error);
      // 에러 발생해도 앱은 계속 실행되어야 함
      Alert.alert('로그인 실패', '구글 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    // iOS에서만 Sign in with Apple 사용 가능
    if (Platform.OS !== 'ios') {
      Alert.alert('알림', 'Sign in with Apple은 iOS에서만 사용 가능합니다.');
      return;
    }

    try {
      setLoading(true);

      // Apple 로그인 요청
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // 자격 증명 상태 확인
      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthRequestResponse.user,
      );

      if (credentialState === appleAuth.State.AUTHORIZED) {
        // Apple에서 받은 identityToken을 백엔드로 전달
        const {identityToken, user} = appleAuthRequestResponse;

        if (identityToken) {
          // 백엔드에 Apple 토큰 전달하여 인증 처리
          await sendAppleTokenToBackend(identityToken, user);
        } else {
          throw new Error('Apple identity token is missing');
        }
      }
    } catch (error: any) {
      if (error.code === appleAuth.Error.CANCELED) {
        console.log('User cancelled Apple Sign in');
      } else {
        console.error('Apple login error:', error);
        Alert.alert(
          '로그인 실패',
          'Apple 로그인에 실패했습니다. 다시 시도해주세요.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const sendAppleTokenToBackend = async (
    identityToken: string,
    userId: string,
  ) => {
    try {
      // 백엔드의 Apple OAuth 엔드포인트로 토큰 전송
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/apple`,
        {
          identityToken,
          userId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      // 백엔드로부터 받은 JWT 토큰으로 로그인 처리
      if (response.data && response.data.token) {
        await handleLoginSuccess(response.data.token);
      } else if (response.data && response.data.data && response.data.data.token) {
        await handleLoginSuccess(response.data.data.token);
      } else {
        throw new Error('No token received from backend');
      }
    } catch (error) {
      console.error('Failed to send Apple token to backend:', error);
      throw error;
    }
  };

  const handleLoginSuccess = async (token: string) => {
    try {
      await AsyncStorage.setItem('token', token);
      onLoginSuccess?.();

      // 로그인 성공 후 역할 확인 및 라우팅
      try {
        const userRole = await fetchUserRole(token);
        await handleRoleBasedNavigation(userRole);
      } catch (error) {
        console.error('Role fetch failed after login:', error);
        // 역할 조회 실패 시 토큰 삭제하고 로그인 화면 유지
        await AsyncStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Login success handling error:', error);
      // 에러 발생 시 토큰 삭제
      await AsyncStorage.removeItem('token');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/BBB_Logo_Nomark.png')}
          style={styles.busIcon}
          resizeMode="contain"
        />

        <Text style={styles.title}>BBB - 버스 버디버디</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <View style={styles.loginButtons}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleAppleLogin}
                activeOpacity={0.8}
                disabled={loading}>
                <AppleLogo style={styles.logo} width={20} height={20} />
                <Text style={styles.buttonText}>
                  Apple로 로그인
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={loading}>
              <GoogleLogo style={styles.logo} width={20} height={20} />
              <Text style={styles.buttonText}>구글 계정으로 로그인</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  busIcon: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
  },
  loginButtons: {
    width: '100%',
    marginTop: 40,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    margin: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonText: {
    fontSize: 16,
    color: '#333333',
  },
  logo: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
});

export default LoginPage;
