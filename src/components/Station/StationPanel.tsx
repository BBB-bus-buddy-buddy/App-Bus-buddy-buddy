import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import Text from '../common/Text';
import theme from '../../theme';
import { Station } from '../../api/services/stationService';
import StationList from './StationList';
import StationDetail from './StationDetail';
import useSelectedStationStore from '../../store/useSelectedStationStore';

const { height } = Dimensions.get('window');

// 패널 높이 설정
const SNAP_POINTS = {
  TOP: height * 0.9,
  MIDDLE: height * 0.6,
  BOTTOM: height * 0.3,
};

interface StationPanelProps {
  favoriteStations: Station[];
  toggleFavorite: (id: string) => void;
}

const StationPanel: React.FC<StationPanelProps> = ({
  favoriteStations,
  toggleFavorite,
}) => {
  const { selectedStation, resetSelectedStation } = useSelectedStationStore();
  const [panelHeight, setPanelHeight] = useState(SNAP_POINTS.MIDDLE);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDragging, setIsDragging] = useState(false);
  const translateY = useRef(new Animated.Value(height - SNAP_POINTS.MIDDLE)).current;
  const lastOffset = useRef(height - SNAP_POINTS.MIDDLE);

  // 버튼 비활성화 상태 관리 (뒤로 가기 버튼)
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [remainingTime, setRemainingTime] = useState(2);

  // 패널 높이 변경 시 애니메이션 처리
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: height - panelHeight,
      useNativeDriver: true,
      tension: 50,
      friction: 12,
    }).start();
    lastOffset.current = height - panelHeight;
  }, [panelHeight, translateY]);

  // 선택된 정류장 변경 시 버튼 비활성화 타이머 설정
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (selectedStation) {
      setIsButtonEnabled(false);
      setRemainingTime(2);
      
      timer = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            setIsButtonEnabled(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedStation]);

  // 패널 드래그 핸들러
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 수직 드래그가 수평 드래그보다 명확하게 클 때만 반응
        return (
          Math.abs(gestureState.dy) > 10 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx * 2)
        );
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        translateY.stopAnimation();
        translateY.setOffset(lastOffset.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // 패널 이동 제한 (최대 높이와 최소 높이 사이)
        const newTranslateY = Math.max(
          height - SNAP_POINTS.TOP,
          Math.min(height - SNAP_POINTS.BOTTOM, lastOffset.current + gestureState.dy)
        );
        translateY.setValue(newTranslateY - lastOffset.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        setIsDragging(false);
        
        const currentPosition = lastOffset.current + gestureState.dy;
        
        // 스냅 포인트 결정
        let snapPoint;
        
        // 빠른 스와이프 처리
        if (Math.abs(gestureState.vy) > 0.5) {
          snapPoint = gestureState.vy > 0 ? SNAP_POINTS.BOTTOM : SNAP_POINTS.TOP;
        } else {
          // 가장 가까운 스냅 포인트 찾기
          const distanceToBottom = Math.abs(height - SNAP_POINTS.BOTTOM - currentPosition);
          const distanceToMiddle = Math.abs(height - SNAP_POINTS.MIDDLE - currentPosition);
          const distanceToTop = Math.abs(height - SNAP_POINTS.TOP - currentPosition);
          
          const minDistance = Math.min(distanceToBottom, distanceToMiddle, distanceToTop);
          
          if (minDistance === distanceToBottom) {
            snapPoint = SNAP_POINTS.BOTTOM;
          } else if (minDistance === distanceToMiddle) {
            snapPoint = SNAP_POINTS.MIDDLE;
          } else {
            snapPoint = SNAP_POINTS.TOP;
          }
        }
        
        // 애니메이션으로 스냅 포인트로 이동
        setPanelHeight(snapPoint);
      },
    })
  ).current;

  const handleBackButton = () => {
    if (isButtonEnabled) {
      resetSelectedStation();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] }
      ]}
    >
      {/* 패널 핸들 */}
      <View
        style={styles.headerContainer}
        {...panResponder.panHandlers}
      >
        <View style={styles.panelHandle} />
      </View>
      
      {/* 패널 헤더 */}
      <View style={styles.header}>
        {selectedStation ? (
          <>
            <TouchableOpacity
              style={[
                styles.backButton,
                !isButtonEnabled && styles.backButtonDisabled
              ]}
              onPress={handleBackButton}
              disabled={!isButtonEnabled}
            >
              <Text
                variant="sm"
                color={isButtonEnabled ? theme.colors.primary.default : theme.colors.gray[400]}
              >
                {isButtonEnabled ? '뒤로' : `${remainingTime}초`}
              </Text>
            </TouchableOpacity>
            
            <Text
              variant="h5"
              weight="semiBold"
              style={styles.title}
              numberOfLines={1}
            >
              {selectedStation.name}
            </Text>
          </>
        ) : (
          <Text
            variant="h5"
            weight="semiBold"
            style={styles.title}
          >
            내 정류장
          </Text>
        )}
      </View>
      
      {/* 패널 콘텐츠 */}
      <View style={styles.content}>
        {selectedStation ? (
          <StationDetail stationId={selectedStation.id} />
        ) : (
          <StationList
            stations={favoriteStations}
            toggleFavorite={toggleFavorite}
          />
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SNAP_POINTS.TOP,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    ...theme.shadows.lg,
    overflow: 'hidden',
    zIndex: 100,

  },
  headerContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray[300],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  backButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
});

export default StationPanel;