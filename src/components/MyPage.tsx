import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import theme from '../theme';
import Footer from '../components/Footer';
import { useToast } from '../components/common/Toast';

const Ionicons = _Ionicons as unknown as React.ElementType;

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

interface UserData {
  name: string;
  organizationId: string;
}

const MyPage: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await axios.get(
        `${process.env.API_BASE_URL || 'http://localhost:8088'}/api/auth/user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      setUserData(response.data.data);
      setError(null);
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Failed to fetch user data:', axiosError);
      setError('사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        throw new Error('No auth token found');
      }

      await axios.post(
        `${process.env.API_BASE_URL || 'http://localhost:8088'}/api/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        },
      );

      await AsyncStorage.removeItem('token');
      showToast('로그아웃 되었습니다.', 'success');
      navigation.navigate('Login');
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('로그아웃 중 오류 발생:', axiosError);
      showToast('로그아웃 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleSendEmail = async () => {
    try {
      const email = 'devhundeveloper@gmail.com';
      const subject = encodeURIComponent('문의사항');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const mailtoUrl = `mailto:${email}?subject=${subject}`;
      
      await AsyncStorage.getItem('can_email').then((canEmail) => {
        if (canEmail) {
          showToast('이메일 앱을 여는 중입니다.', 'info');
        }
      });
    } catch (error) {
      console.error('이메일 열기 실패:', error);
    }
  };

  const menuItems = [
    {
      id: 'profile',
      title: '내 정보',
      content: userData ? `${userData.name} (인증된 코드 : ${userData.organizationId})` : '로딩 중...',
      icon: 'person',
      action: () => {},
    },
    {
      id: 'logout',
      title: '로그아웃',
      content: '',
      icon: 'log-out',
      action: handleLogout,
    },
    {
      id: 'contact',
      title: '문의하기',
      content: 'devhundeveloper@gmail.com',
      icon: 'mail',
      action: handleSendEmail,
    },
  ];

  const renderItem = ({ item }: { item: typeof menuItems[0] }) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={item.action}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={item.icon} size={22} color={theme.colors.gray[700]} />
        <Text style={styles.menuItemTitle}>{item.title}</Text>
      </View>
      
      {item.content ? (
        <Text style={styles.menuItemContent}>{item.content}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.gray[400]} />
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.default} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
      </View>

      <FlatList
        data={menuItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          버스 버디버디 v1.0.0
        </Text>
        <TouchableOpacity onPress={handleSendEmail}>
          <Text style={styles.emailText}>devhundeveloper@gmail.com</Text>
        </TouchableOpacity>
      </View>
      
      <Footer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.gray[900],
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.gray[800],
    marginLeft: theme.spacing.md,
  },
  menuItemContent: {
    fontSize: 14,
    color: theme.colors.gray[500],
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: 60, // Footer 공간 확보
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.gray[500],
    marginBottom: theme.spacing.xs,
  },
  emailText: {
    fontSize: 14,
    color: theme.colors.primary.default,
    textDecorationLine: 'underline',
  },
});

export default MyPage;