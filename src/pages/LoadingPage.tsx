import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BUS_ICON_SIZE = 170; // 17rem을 픽셀로 변환
const ANIMATION_DURATION = 1200; // 1.2초

const LoadingPage: React.FC = () => {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-BUS_ICON_SIZE)).current;

  useEffect(() => {
    const startAnimation = () => {
      // -30%에서 시작하여 화면 너비 + 버스 크기만큼 이동
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: width + BUS_ICON_SIZE,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        // 애니메이션이 끝나면 다시 시작 위치로
        Animated.timing(translateX, {
          toValue: -BUS_ICON_SIZE,
          duration: 0,
          useNativeDriver: true,
        })
      ]).start((result) => {
        if (result.finished) {
          startAnimation();
        }
      });
    };

    startAnimation();

    return () => {
      translateX.stopAnimation();
    };
  }, [translateX]);

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }
    ]}>
      <View style={styles.logoContainer}>
        <Animated.Image
          source={require('../../assets/images/busIcon.png')}
          style={[
            styles.busIcon,
            {
              transform: [{ translateX }],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: '100%',
    height: BUS_ICON_SIZE,
    overflow: 'hidden',
    position: 'relative',
  },
  busIcon: {
    width: BUS_ICON_SIZE,
    height: BUS_ICON_SIZE,
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
});

// 최적화를 위한 메모이제이션
export default React.memo(LoadingPage);

// 커스텀 로딩 컨테이너 컴포넌트
export const LoadingContainer: React.FC<{
  loading: boolean;
  children: React.ReactNode;
}> = ({ loading, children }) => {
  if (loading) {
    return <LoadingPage />;
  }
  return <>{children}</>;
};

// 로딩 오버레이 컴포넌트
export const LoadingOverlay: React.FC<{
  visible: boolean;
}> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={overlayStyles.overlay}>
      <LoadingPage />
    </View>
  );
};

// 오버레이 스타일
const overlayStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

// 로딩 상태 관리를 위한 커스텀 훅
export const useLoading = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  
  const withLoading = async <T extends any>(
    promise: Promise<T>
  ): Promise<T> => {
    setLoading(true);
    try {
      const result = await promise;
      return result;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    setLoading,
    withLoading,
  };
};