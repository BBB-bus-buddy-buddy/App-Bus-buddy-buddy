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
// 네비게이션 타입 정의
export type RootStackParamList = {
  Login: undefined;
  EnterCode: {token?: string};
  Loading: undefined;
  Home: {token?: string};
  BusDirection: undefined;
  BusList: undefined;
  BusRoute: {busNumber: string};
  RouteList: undefined;
  MyPage: undefined; // Added MyPage to the type definition
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
            <Stack.Screen
              name="BusRoute"
              component={BusRoutePage}
              options={({route}: any) => ({
                title: `${route.params.busNumber} 버스`,
                headerShown: true,
              })}
            />

            {/* Admin Routes
          <Stack.Screen 
            name="Admin"
            component={AdminPage}
            options={{ headerShown: true, title: '관리자 페이지' }}
          />
          <Stack.Screen
            name="AdminBusStation"
            component={BusStationPage}
            options={{ headerShown: true, title: '정류장 관리' }}
          />
          <Stack.Screen
            name="AdminBusStationCreate"
            component={AdminBusStationCreatePage}
            options={{ headerShown: true, title: '정류장 추가' }}
          />
          <Stack.Screen
            name="AdminBusStationEdit"
            component={BusStationEditPage}
            options={{ headerShown: true, title: '정류장 수정' }}
          />
          <Stack.Screen
            name="AdminBusList"
            component={AdminBusListPage}
            options={{ headerShown: true, title: '버스 관리' }}
          />
          <Stack.Screen
            name="AdminBusCreate"
            component={AdminBusCreatePage}
            options={{ headerShown: true, title: '버스 추가' }}
          />
          <Stack.Screen
            name="AdminBusEdit"
            component={AdminBusEditPage}
            options={{ headerShown: true, title: '버스 수정' }}
          /> */}
          </Stack.Navigator>
        </NavigationContainer>
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
