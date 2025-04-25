import React, { useEffect, createContext, useContext, useState, forwardRef, useImperativeHandle } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity, Platform, Dimensions, View } from 'react-native';
import theme from '../../theme';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  type?: ToastType;
  message: string;
  duration?: number;
  onDismiss?: () => void;
}

// forwardRef 추가
const Toast = forwardRef<{}, ToastProps>(({
  visible,
  type = 'info',
  message,
  duration = 3000,
  onDismiss,
}, ref) => {
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  
  // ref를 통해 외부에서 메서드 호출 가능하도록 설정
  useImperativeHandle(ref, () => ({
    hideToast: () => hideToast()
  }));
  
  useEffect(() => {
    // 이전 애니메이션 중단을 위한 변수
    let animationSet: Animated.CompositeAnimation | null = null as any;
    
    if (visible) {
      // 이전 애니메이션이 있으면 중단
      if (animationSet) {
        animationSet.stop(); // 정상 작동
      }
      
      animationSet = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);
      
      animationSet.start();
      
      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      
      return () => {
        clearTimeout(timer);
        if (animationSet) {
          animationSet.stop();
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);
  
  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) {
        onDismiss();
      }
    });
  };
  
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return styles.success;
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      case 'info':
      default:
        return styles.info;
    }
  };
  
  if (!visible) return null;
  
  return (
    <Animated.View
      style={[
        styles.container,
        getTypeStyles(),
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={hideToast} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.closeButton}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: 16,
    right: 16,
    maxWidth: width - 32,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.md,
    zIndex: 1000, // zIndex 값 명시적으로 설정
  },
  success: {
    backgroundColor: '#E6F7EF',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.system.success,
  },
  error: {
    backgroundColor: '#FFEFEF',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.system.error,
  },
  warning: {
    backgroundColor: '#FFF8E6',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.system.warning,
  },
  info: {
    backgroundColor: '#E6F2FF',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.system.info,
  },
  message: {
    flex: 1,
    ...theme.typography.text.md,
    color: theme.colors.gray[900],
  },
  closeButton: {
    fontSize: 20,
    marginLeft: theme.spacing.sm,
    color: theme.colors.gray[600],
  },
});

// 컨텍스트 관련 코드는 별도 파일로 분리하는 것이 좋습니다
interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

// 기본값 제공
const defaultToastContext: ToastContextProps = {
  showToast: () => {},
  hideToast: () => {},
};

const ToastContext = createContext<ToastContextProps>(defaultToastContext);

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });
  
  const toastRef = React.useRef(null);
  
  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    // 이미 표시 중인 토스트가 있으면 먼저 닫기
    if (toast.visible) {
      hideToast();
      // 약간의 지연 후 새 토스트 표시
      setTimeout(() => {
        setToast({
          visible: true,
          message,
          type,
          duration,
        });
      }, 100);
    } else {
      setToast({
        visible: true,
        message,
        type,
        duration,
      });
    }
  };
  
  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };
  
  // 값을 메모이제이션하여 불필요한 리렌더링 방지
  const contextValue = React.useMemo(() => ({ 
    showToast, 
    hideToast 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  
  return (
    <ToastContext.Provider value={contextValue}>
      <View style={{ flex: 1 }}>
        {children}
        <Toast
          ref={toastRef}
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={hideToast}
        />
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextProps => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default Toast;
