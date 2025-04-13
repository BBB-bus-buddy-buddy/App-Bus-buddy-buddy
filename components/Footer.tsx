import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import axios from 'axios';
import { useModalActions } from '../store/useModalStore';

// 네비게이션 타입 정의
type RootStackParamList = {
  Home: undefined;
  BusList: undefined;
  Admin: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// 이미지 import
const images = {
  hamburger: require('../assets/images/hamburgerIcon.png'),
  home: require('../assets/images/homeIcon.png'),
  busStop: require('../assets/images/busStop.png'),
  admin: require('../assets/images/adminIcon.png'),
};

interface UserInfo {
  role: string;
  // 다른 필요한 유저 정보 타입 정의
}

const Footer: React.FC = () => {
  const [, setUserInfo] = useState<UserInfo | null>(null);
  const { openModal, setModalName } = useModalActions();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    let isMounted = true;

    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(
          'http://localhost:8088/api/auth/user'
        );
        if (isMounted) {
          setUserInfo(response.data.data);
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

  const handleModal = () => {
    setModalName('myInfoModal');
    openModal('myInfoModal');
  };

  const FooterButton: React.FC<{
    onPress: () => void;
    icon: number;
    label: string;
  }> = ({ onPress, icon, label }) => (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={icon}
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.footer]}>
      <FooterButton
        onPress={handleModal}
        icon={images.hamburger}
        label="내 정보"
      />
      <FooterButton
        onPress={() => navigation.navigate('Home')}
        icon={images.home}
        label="홈"
      />
      <FooterButton
        onPress={() => navigation.navigate('BusList')}
        icon={images.busStop}
        label="버스 노선"
      />
      {/* {userInfo?.role === 'ADMIN' && (
        <FooterButton
          onPress={() => navigation.navigate('Admin')}
          icon={images.admin}
          label="관리자 페이지"
        />
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#FFFFFF', // var(--main-white-bright)
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 8,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    height: 28,
    // React Native에서는 filter: drop-shadow 대신 shadow 속성 사용
    ...Platform.select({
      ios: {
        shadowColor: '#525252',
        shadowOffset: {
          width: 1,
          height: 1,
        },
        shadowOpacity: 0.5,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    color: '#000000',
    textAlign: 'center',
  },
});

export default Footer;