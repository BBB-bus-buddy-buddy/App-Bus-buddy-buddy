import React, {useEffect, useState} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Platform} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import {authService} from '../api/services/authService';
import {useModalActions} from '../store/useModalStore';
import theme from '../theme';

// 네비게이션 타입 정의
type RootStackParamList = {
  Home: undefined;
  RouteList: undefined;
  Admin: undefined;
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
  routeName: keyof RootStackParamList | 'Modal';
  label: string;
  icon: string;
  activeIcon: string;
  requiresAdmin?: boolean;
}

const Footer: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const {openModal, setModalName} = useModalActions();
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
      key: 'routeList', // BusList -> RouteList 변경
      routeName: 'RouteList', // BusList -> RouteList 변경
      label: '노선 목록', // '버스 노선' -> '노선 목록' 변경
      icon: 'git-branch-outline',
      activeIcon: 'git-branch',
    },
    // {
    //   key: 'myInfo',
    //   routeName: '',
    //   label: '내 정보',
    //   icon: 'person-outline',
    //   activeIcon: 'person',
    // },
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
    if (tabRouteName === 'Modal') {
      return false; // 모달은 활성화 상태가 없음
    }
    return route.name === tabRouteName;
  };

  // 탭 클릭 핸들러
  const handleTabPress = (tab: TabItem) => {
    if (tab.routeName === 'Modal') {
      setModalName('myInfoModal');
      openModal('myInfoModal');
    } else {
      navigation.navigate(tab.routeName);
    }
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
