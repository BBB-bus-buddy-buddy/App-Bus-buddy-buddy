import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import axios from 'axios';
import GoogleLogo from '../assets/logos/google.svg';

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
  ios: 'http://devse.gonetis.com:12589',
  android: 'http://devse.gonetis.com:12589',
});

const LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/google`;

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // 초기 토큰 체크 및 라우팅
  useEffect(() => {
    checkTokenAndNavigate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkTokenAndNavigate = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      if (token) {
        const userRole = await fetchUserRole(token);
        await handleRoleBasedNavigation(userRole);
      }
    } catch (error) {
      console.error('Token check error:', error);
      // 토큰이 유효하지 않은 경우 삭제
      await AsyncStorage.removeItem('token');
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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.data.role;
    } catch (error) {
      console.error('Role fetch error:', error);
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

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      const available = await InAppBrowser.isAvailable();
      
      if (available) {
        Linking.addEventListener('url', handleDeepLink);
        
        const result = await InAppBrowser.openAuth(
          LOGIN_URL,
          'org.reactjs.native.example.capstonBBBBNative:/oauth2callback', //ios
          {
            ephemeralWebSession: false,
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
          }
        );
        
        if (result.type === 'success' && result.url) {
          await handleUrl(result.url);
        }
      } else {
        await Linking.openURL(LOGIN_URL);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
      Linking.removeAllListeners('url');
    }
  };

  const handleDeepLink = ({ url }: { url: string }) => {
    handleUrl(url);
  };

  const handleUrl = async (url: string) => {
    if (url.includes('token=')) {
      const token = url.split('token=')[1].split('&')[0];
      await handleLoginSuccess(token);
    }
  };

  const handleLoginSuccess = async (token: string) => {
    try {
      await AsyncStorage.setItem('token', token);
      onLoginSuccess?.();
      
      // 로그인 성공 후 역할 확인 및 라우팅
      const userRole = await fetchUserRole(token);
      await handleRoleBasedNavigation(userRole);
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
          source={require('../assets/images/busIcon.png')}
          style={styles.busIcon}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>버스 버디버디</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <View style={styles.loginButtons}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              <GoogleLogo
                style={styles.logo}
                width={20}
                height={20}
              />
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
});

export default LoginPage;