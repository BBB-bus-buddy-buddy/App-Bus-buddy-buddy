import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import {authService} from '../api/services/authService';
import {useToast} from '../components/common/Toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import theme from '../theme';
// 네비게이션 타입
type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  EnterCode: undefined;
};

const Ionicons = _Ionicons as unknown as React.ElementType;

const EnterCodePage: React.FC = () => {
  const [schoolCode, setSchoolCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean | null;
    message: string | null;
  }>({isValid: null, message: null});

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {showToast} = useToast();

  const handleCodeVerification = async () => {
    // 입력 유효성 검사
    if (!schoolCode.trim()) {
      showToast('인증 코드를 입력해주세요.', 'warning');
      return;
    }

    try {
      setIsValidating(true);

      // API 호출
      const result = await authService.rankUpUser(schoolCode);

      // 결과 처리
      if (result) {
        setValidationStatus({
          isValid: true,
          message: '인증이 성공적으로 완료되었습니다.',
        });

        showToast('인증이 완료되었습니다.', 'success');

        // 잠시 후 홈 화면으로 이동
        setTimeout(() => {
          navigation.navigate('Home' as never);
        }, 1500);
      } else {
        setValidationStatus({
          isValid: false,
          message: '유효하지 않은 인증 코드입니다.',
        });
      }
    } catch (error) {
      console.error('인증 코드 검증 오류:', error);

      // 오류 메시지 설정
      let errorMessage = '인증 코드를 확인하는 중 오류가 발생했습니다.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setValidationStatus({
        isValid: false,
        message: errorMessage,
      });

      // 특수한 오류 처리
      if (errorMessage.includes('인증')) {
        showToast('로그인이 필요합니다.', 'error');
        navigation.navigate('Login' as never);
      }
    } finally {
      setIsValidating(false);
    }
  };

  // 코드 입력 핸들러
  const handleCodeChange = (text: string) => {
    // 숫자만 허용
    const alphanumericText = text.replace(/[^A-Za-z0-9]/g, '');
    setSchoolCode(alphanumericText);

    // 입력 시작하면 이전 상태 초기화
    if (validationStatus.message) {
      setValidationStatus({isValid: null, message: null});
    }
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
            {/* 로고 */}
            <View style={styles.logoContainer}>
              <Ionicons
                name="bus"
                size={80}
                color={theme.colors.primary.default}
                style={styles.logoIcon}
              />
            </View>

            {/* 타이틀 */}
            <Text style={styles.title}>버스 버디버디</Text>
            <Text style={styles.subtitle}>기관 인증 코드 입력</Text>

            {/* 폼 */}
            <View style={styles.formContainer}>
              <Input
                ref={this}
                value={schoolCode}
                onChangeText={handleCodeChange}
                placeholder="기관의 인증 코드를 입력하세요"
                keyboardType="number-pad"
                hint="관리자로부터 받은 기관 코드를 입력하세요."
                error={
                  validationStatus.isValid === false
                    ? validationStatus.message ?? undefined
                    : undefined
                }
                containerStyle={styles.inputContainer}
                leftIcon={
                  <Ionicons
                    name="keypad"
                    size={20}
                    color={theme.colors.gray[500]}
                  />
                }
              />

              {validationStatus.isValid === true && (
                <View style={styles.successContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.system.success}
                  />
                  <Text style={styles.successText}>
                    {validationStatus.message}
                  </Text>
                </View>
              )}

              <Button
                variant="filled"
                size="large"
                isLoading={isValidating}
                isFullWidth
                style={styles.verifyButton}
                onPress={handleCodeVerification}
                leftIcon={
                  !isValidating ? (
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={theme.colors.white}
                    />
                  ) : undefined
                }>
                인증하기
              </Button>
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
    backgroundColor: theme.colors.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary.light + '10', // 10% 투명도
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  logoIcon: {
    marginBottom: 5, // 약간 위치 조정
  },
  title: {
    ...theme.typography.heading.h2,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
    fontWeight: 'bold', // Ensure fontWeight is compatible
  },
  subtitle: {
    ...theme.typography.text.md,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  verifyButton: {
    marginTop: theme.spacing.md,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  successText: {
    ...theme.typography.text.md,
    color: theme.colors.system.success,
    marginLeft: theme.spacing.xs,
    textAlign: 'center',
  },
});

export default EnterCodePage;
