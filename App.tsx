import React, {useEffect} from 'react';
import {
  NavigationContainer,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// 페이지 imports
import LoginPage from './src/pages/LoginPage';
import EnterCodePage from './src/pages/EnterCodePage';
import LoadingPage from './src/pages/LoadingPage';
import HomePage from './src/pages/HomePage';
import BusListPage from './src/pages/BusListPage';
import BusRoutePage from './src/pages/BusRoutePage';
import {Alert} from 'react-native';
import { ToastProvider } from './src/components/common/Toast';
import RouteListPage from './src/pages/RouteListPage';
import MyPage from './src/components/MyPage';
import BusSchedulePage from './src/pages/BusSchedulePage';
import { GlobalWebSocketProvider } from './src/providers/globalWebSocketProvider'; // 수정된 경로

// 네비게이션 타입 정의
export type RootStackParamList = {
  Login: undefined;
  EnterCode: {token?: string};
  Loading: undefined;
  Home: {token?: string};
  BusDirection: undefined;
  BusList: {routeId: string; routeName: string}; // routeId, routeName 추가
  BusRoute: {busNumber: string};
  RouteList: undefined;
  MyPage: undefined; // Added MyPage to the type definition
  BusSchedule: undefined; // Added BusSchedule to the type definition
  Admin: undefined;
  AdminBusStation: undefined;
  AdminBusStationCreate: undefined;
  AdminBusStationEdit: {stationId: string};
  AdminBusList: undefined;
  AdminBusCreate: undefined;
  AdminBusEdit: {busNumber: string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Axios 인터셉터 설정
axios.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Token fetch error:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

const App = () => {

  return (
      <SafeAreaProvider>
          <ToastProvider>
            <GlobalWebSocketProvider>
          <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
              headerShown: false,
            }}>
            <Stack.Screen name="Login" component={LoginPage} />
            <Stack.Screen name="EnterCode" component={EnterCodePage} />
            <Stack.Screen name="Loading" component={LoadingPage} />
            <Stack.Screen name="Home" component={HomePage} />
            <Stack.Screen name="RouteList" component={RouteListPage} />
            <Stack.Screen name="BusList" component={BusListPage} />
            <Stack.Screen name="MyPage" component={MyPage} />
            <Stack.Screen name="BusSchedule" component={BusSchedulePage} />
            <Stack.Screen
              name="BusRoute"
              component={BusRoutePage}
              options={({route}: any) => ({
                title: `${route.params.busNumber} 버스`,
                headerShown: true,
              })}
            />
          </Stack.Navigator>
        </NavigationContainer>
        </GlobalWebSocketProvider>
        </ToastProvider>
      </SafeAreaProvider>
  );
};

// 인증 체크 HOC
export const withAuth = (WrappedComponent: React.ComponentType) => {
  return function WithAuthComponent(props: any) {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    useEffect(() => {
      const checkAuth = async () => {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          navigation.navigate('Login');
        }
      };

      checkAuth();
    }, [navigation]);

    return <WrappedComponent {...props} />;
  };
};

// 관리자 권한 체크 HOC
export const withAdmin = (WrappedComponent: React.ComponentType) => {
  return function WithAdminComponent(props: any) {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();

    useEffect(() => {
      const checkAdminAuth = async () => {
        try {
          const response = await axios.get(
            'http://localhost:8088/api/auth/user',
          );
          if (response.data?.role !== 'ADMIN') {
            Alert.alert('권한 없음', '관리자 권한이 필요합니다.');
            navigation.goBack();
          }
        } catch (error) {
          console.error('Admin check error:', error);
          navigation.navigate('Login');
        }
      };

      checkAdminAuth();
    }, [navigation]);

    return <WrappedComponent {...props} />;
  };
};

export default App;
