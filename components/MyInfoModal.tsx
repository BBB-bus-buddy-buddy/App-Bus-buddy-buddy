import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import axios, { AxiosError } from 'axios';
import { useModalActions, useModalState } from '../store/useModalStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

interface UserData {
  name: string;
  school: string;
  picture: string;
}

interface ApiResponse {
  data: UserData;
  message: string;
}

const API_BASE_URL = Platform.select({
  ios: 'http://devse.gonetis.com:12589',
  android: 'http://devse.gonetis.com:12589'
});

const MyInfoModal: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isModal, modalName } = useModalState();
  const { closeModal } = useModalActions();
  const slideAnim = useRef(new Animated.Value(-width)).current;

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await axios.get<ApiResponse>(
        `${API_BASE_URL}/api/auth/user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
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

  useEffect(() => {
    if (isModal && modalName === 'myInfoModal') {
      fetchUserData();
    }
  }, [isModal, modalName]);

  useEffect(() => {
    if (isModal && modalName === 'myInfoModal' && !isAnimating) {
      setIsVisible(true);
      setIsAnimating(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => {
        setIsAnimating(false);
      });
    }

    return () => {
      slideAnim.setValue(-width);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModal, modalName, slideAnim]);

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('No auth token found');
      }

      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        }
      );

      await AsyncStorage.removeItem('token');
      handleClose();
      navigation.navigate('Login');
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('로그아웃 중 오류 발생:', axiosError);
    }
  };

  const handleSendEmail = async () => {
    try {
      const email = 'devhundeveloper@gmail.com';
      const subject = encodeURIComponent('문의사항');
      const mailtoUrl = `mailto:${email}?subject=${subject}`;
      
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        console.warn('메일 앱을 열 수 없습니다.');
        return;
      }
      
      await Linking.openURL(mailtoUrl);
    } catch (error) {
      console.error('이메일 열기 실패:', error);
    }
  };

  const handleClose = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      setIsAnimating(false);
      closeModal();
    });
  };

  const handleContentPress = (e: any) => {
    e.stopPropagation();
  };

  const renderModalContent = () => (
    <Animated.View
      style={[
        styles.modalContent,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
      onStartShouldSetResponder={() => true}
      onTouchEnd={(e) => {
        e.stopPropagation();
      }}
    >
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>

      <View style={styles.modalHeader}>
        <Text style={styles.headerText}>
          환영합니다{'\n'}
          {userData?.name}님!
        </Text>
      </View>

      <View style={styles.profileImageContainer}>
        {userData?.picture && (
          <Image
            source={{ uri: userData.picture }}
            style={styles.profileImage}
          />
        )}
      </View>

      <View style={styles.modalBody}>
        <Text style={styles.schoolText}>
          [{userData?.school}] 접속 상태
        </Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modalFooter}>
        <Text style={styles.footerText}>
          잘 이용해주셔서 감사합니다. 버그, 문의, 개선사항 등은{'\n'}
          <Text style={styles.emailText} onPress={handleSendEmail}>
            devhundeveloper@gmail.com
          </Text>
          으로 보내주세요!
        </Text>
      </View>
    </Animated.View>
  );

  if (error) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={handleContentPress}
        >
          {renderModalContent()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '65%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 4,
          height: 0,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 30,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 35,
    color: '#CC0000',
  },
  modalHeader: {
    marginBottom: 24,
    alignItems: 'center',
    marginTop: 48,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#007bff',
  },
  modalBody: {
    alignItems: 'center',
    gap: 16,
  },
  schoolText: {
    fontSize: 16,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#69F0AE',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalFooter: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
  },
  emailText: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
});

export default MyInfoModal;