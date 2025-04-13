import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from '../App';

interface ApiResponse<T> {
  data: T;
  message: string;
  code: number;
}

const API_BASE_URL = Platform.select({
  ios: 'http://localhost:8088',
  android: 'http://localhost:8088',
});

const EnterCodePage: React.FC = () => {
  const [schoolCode, setSchoolCode] = useState('');
  const [isValidCode, setIsValidCode] = useState<boolean | null>(null);
  const [hasValidCode, setHasValidCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleCodeVerification = async () => {
    if (!schoolCode.trim()) {
      Alert.alert('알림', '인증 코드를 입력해주세요.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await axios.post<ApiResponse<boolean>>(
        `${API_BASE_URL}/api/auth/rankUp`,
        {
          code: schoolCode,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setIsValidCode(response.data.data);
      setHasValidCode(true);
      setCodeMessage(response.data.message);

      // 성공한 경우 (statusCode가 200이고 rankUp이 성공한 경우)
      if (response.data.data) {
        Alert.alert('성공', '인증이 완료되었습니다.', [
          {
            text: '확인',
            onPress: () => navigation.navigate('Home' as never),
          },
        ]);
      } else {
        // 실패한 경우 메시지 표시
        Alert.alert('알림', response.data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ApiResponse<boolean>;
        setIsValidCode(false);
        setHasValidCode(true);
        setCodeMessage(errorData.message);

        // 401 Unauthorized 에러 처리
        if (error.response.status === 401) {
          Alert.alert('오류', '사용자 인증이 필요합니다.', [
            {
              text: '확인',
              onPress: () => navigation.navigate('Login' as never),
            },
          ]);
          return;
        }

        Alert.alert('오류', errorData.message);
      } else {
        setIsValidCode(false);
        setHasValidCode(true);
        setCodeMessage('인증 코드 확인에 실패했습니다.');
        Alert.alert('오류', '인증 코드 확인 중 문제가 발생했습니다.');
      }
      console.error('Code verification error:', error);
    }
  };

  const ValidationMessage: React.FC<{
    show: boolean;
    isValid: boolean | null;
    message?: string | null;
  }> = ({show, isValid, message}) => {
    if (!show || !message) return null;

    return (
      <Text
        style={[
          styles.validationMessage,
          isValid ? styles.successMessage : styles.errorMessage,
        ]}>
        {message}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.contentWrapper}>
            <Image
              source={require('../assets/images/busIcon.png')}
              style={styles.busIcon}
              resizeMode="contain"
            />

            <Text style={styles.title}>버스 버디버디</Text>

            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="기관의 인증 코드를 입력하세요"
                value={schoolCode}
                onChangeText={setSchoolCode}
                placeholderTextColor="#BBB"
                keyboardType="number-pad"
              />

              <ValidationMessage
                show={hasValidCode}
                isValid={isValidCode}
                message={codeMessage}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={handleCodeVerification}>
                <Text style={styles.buttonText}>코드 인증 요청</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  busIcon: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333333',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FBFBFB',
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#80CBC4',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  validationMessage: {
    width: '100%',
    marginBottom: 15,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successMessage: {
    color: '#4CAF50',
  },
  errorMessage: {
    color: '#FF3B30',
  },
});

export default EnterCodePage;