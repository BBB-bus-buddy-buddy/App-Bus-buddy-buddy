import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../App';

interface ValidationResponse {
  data: boolean;
  message: string;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
  code: number;
}

const API_BASE_URL = Platform.select({
  ios: 'http://devse.gonetis.com:12589',
  android: 'http://devse.gonetis.com:12589',
});

const EnterCodePage: React.FC = () => {
  const [schoolName, setSchoolName] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  
  const [isValidSchool, setIsValidSchool] = useState<boolean | null>(null);
  const [hasValidSchool, setHasValidSchool] = useState(false);
  const [isValidMail, setIsValidMail] = useState<boolean | null>(null);
  const [hasValidMail, setHasValidMail] = useState(false);
  const [isValidCode, setIsValidCode] = useState<boolean | null>(null);
  const [hasValidCode, setHasValidCode] = useState(false);

  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [mailMessage, setMailMessage] = useState<string | null>(null);
  const [codeMessage, setCodeMessage] = useState<string | null>(null);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleSchoolVerification = async () => {
    if (!schoolName.trim()) {
      Alert.alert('알림', '학교명을 입력해주세요.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post<ValidationResponse>(
        `${API_BASE_URL}/api/school/validation`,
        { schoolName },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setIsValidSchool(response.data.data);
      setHasValidSchool(true);
      setNameMessage(response.data.message);
    } catch (error) {
      console.error('School validation error:', error);
      setIsValidSchool(false);
      setHasValidSchool(true);
      setNameMessage('학교 인증에 실패했습니다.');
    }
  };

  const handleEmailVerification = async () => {
    if (!isValidSchool) {
      Alert.alert('알림', '학교명을 인증 후 메일을 인증해주세요!');
      return;
    }
    if (!schoolEmail.trim()) {
      Alert.alert('알림', '학교 메일을 입력해주세요.');
      return;
    }
  
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post<ApiResponse<boolean>>(
        `${API_BASE_URL}/api/school/mail`,
        {
          schoolName,
          schoolEmail,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
  
      setIsValidMail(response.data.success);
      setHasValidMail(true);
      setMailMessage(response.data.message);
  
      // 성공일 경우에만 Alert로 알림
      if (response.data.success && response.data.code === 200) {
        Alert.alert('알림', response.data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as ApiResponse<boolean>;
        setIsValidMail(false);
        setHasValidMail(true);
        setMailMessage(errorData.message);
  
        // 에러 메시지를 Alert로 표시
        Alert.alert('오류', errorData.message);
      } else {
        setIsValidMail(false);
        setHasValidMail(true);
        setMailMessage('메일 인증에 실패했습니다.');
        Alert.alert('오류', '메일 인증 중 문제가 발생했습니다.');
      }
      console.error('Email verification error:', error);
    }
  };

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
        `${API_BASE_URL}/api/school/code`,
        {
          schoolName,
          schoolEmail,
          code: schoolCode,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
  
      setIsValidCode(response.data.success);
      setHasValidCode(true);
      setCodeMessage(response.data.message);
  
      // 성공한 경우 (statusCode가 200이고 rankUp이 성공한 경우)
      if (response.data.success) {
        Alert.alert('성공', '인증이 완료되었습니다.', [
          {
            text: '확인',
            onPress: () => navigation.navigate('Home' as never)
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
              onPress: () => navigation.navigate('Login' as never)
            }
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
  }> = ({ show, isValid, message }) => {
    if (!show || !message) return null;

    return (
      <Text
        style={[
          styles.validationMessage,
          isValid ? styles.successMessage : styles.errorMessage,
        ]}
      >
        {message}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../assets/images/busIcon.png')}
            style={styles.busIcon}
            resizeMode="contain"
          />
          
          <Text style={styles.title}>버스 버디버디</Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="학교명을 입력하세요."
                value={schoolName}
                onChangeText={setSchoolName}
                placeholderTextColor="#BBB"
              />
              <TouchableOpacity
                style={styles.validButton}
                onPress={handleSchoolVerification}
              >
                <Text style={styles.buttonText}>인증 가능 여부</Text>
              </TouchableOpacity>
            </View>

            <ValidationMessage
              show={hasValidSchool}
              isValid={isValidSchool}
              message={nameMessage}
            />

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="학교 메일을 입력하세요."
                value={schoolEmail}
                onChangeText={setSchoolEmail}
                placeholderTextColor="#BBB"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.validButton}
                onPress={handleEmailVerification}
              >
                <Text style={styles.buttonText}>인증 메일 전송</Text>
              </TouchableOpacity>
            </View>

            <ValidationMessage
              show={hasValidMail}
              isValid={isValidMail}
              message={mailMessage}
            />

            <TextInput
              style={[styles.input, styles.fullWidthInput]}
              placeholder="메일 인증 코드를 입력하세요."
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
              style={[styles.button, styles.fullWidthButton]}
              onPress={handleCodeVerification}
            >
              <Text style={styles.buttonText}>메일 인증</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  inputGroup: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 15,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#FBFBFB',
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
  fullWidthInput: {
    width: '100%',
    marginBottom: 15,
  },
  validButton: {
    backgroundColor: '#80CBC4',
    padding: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
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
    backgroundColor: '#80CBC4',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  fullWidthButton: {
    width: '100%',
    marginTop: 15,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  validationMessage: {
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