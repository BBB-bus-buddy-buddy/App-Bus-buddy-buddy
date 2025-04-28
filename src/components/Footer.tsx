import React, {useEffect, useState} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Platform} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import {authService} from '../api/services/authService';
import theme from '../theme';

// 네비게이션 타입 정의
type RootStackParamList = {
  Home: undefined;
  RouteList: undefined;
  MyPage: undefined;  // MyPage 추가
};

const Ionicons = _Ionicons as unknown as React.ElementType;

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface UserInfo {
  role?: string;
  name?: string;
  email?: string;
  organizationId?: string;
}

// 탭 정의
interface TabItem {
  key: string;
  routeName: keyof RootStackParamList;
  label: string;
  icon: string;
  activeIcon: string;
  requiresAdmin?: boolean;
}

const Footer: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  // 탭 아이템 정의
  const tabs: TabItem[] = [
    {
      key: 'home',
      routeName: 'Home',
      label: '홈',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      key: 'routeList',
      routeName: 'RouteList',
      label: '노선 목록',
      icon: 'git-branch-outline',
      activeIcon: 'git-branch',
    },
    {
      key: 'mypage',
      routeName: 'MyPage',  // MyPage로 변경
      label: '마이페이지',  // label 변경
      icon: 'person-outline',
      activeIcon: 'person',
    },
  ];

  // 사용자 정보 가져오기
  useEffect(() => {
    let isMounted = true;

    const fetchUserInfo = async () => {
      try {
        const userData = await authService.getUserInfo();
        if (isMounted) {
          setUserInfo(userData);
        }
      } catch (error) {
        console.error('유저 정보를 가져오는 중 오류 발생:', error);
      }
    };

    fetchUserInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  // 현재 활성화된 탭 확인
  const isTabActive = (tabRouteName: string) => {
    return route.name === tabRouteName;
  };

  // 탭 클릭 핸들러
  const handleTabPress = (tab: TabItem) => {
    navigation.navigate(tab.routeName);
  };

  // 탭 버튼 렌더링
  const renderTabButton = (tab: TabItem) => {
    // 관리자 권한이 필요한 탭이면서 관리자가 아닌 경우 렌더링하지 않음
    if (tab.requiresAdmin && userInfo?.role !== 'STAFF') {
      return null;
    }

    const isActive = isTabActive(tab.routeName);
    const iconName = isActive ? tab.activeIcon : tab.icon;

    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.button}
        onPress={() => handleTabPress(tab)}
        activeOpacity={0.7}>
        <Ionicons
          name={iconName}
          size={24}
          color={
            isActive ? theme.colors.primary.default : theme.colors.gray[500]
          }
        />
        <Text style={[styles.buttonText, isActive && styles.activeButtonText]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.footer}>{tabs.map(tab => renderTabButton(tab))}</View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: theme.colors.white,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15, // iOS에서는 하단 Safe Area 고려
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[100],
    zIndex: 100,
    ...theme.shadows.md,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  activeButtonText: {
    color: theme.colors.primary.default,
    fontWeight: '600',
  },
});

export default Footer;