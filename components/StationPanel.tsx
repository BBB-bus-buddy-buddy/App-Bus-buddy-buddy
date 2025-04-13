import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import Modal from 'react-native-modal';
import useSelectedStationStore from '../store/useSelectedStationStore';
import StationDetail from './StationDetail';
import StationList from './StationList';
import { useModalActions } from '../store/useModalStore';
import Svg, { Circle, Line } from 'react-native-svg';

interface Station {
  id: string;
  name: string;
}

interface StationPanelProps {
  favoriteStations: Station[];
  toggleFavorite: (id: string) => void;
}

const { height } = Dimensions.get('window');

const SNAP_POINTS = {
  TOP: height * 0.8,
  MIDDLE: height * 0.4,
  BOTTOM: height * 0.14,
};

const StationPanel: React.FC<StationPanelProps> = ({
  favoriteStations,
  toggleFavorite,
}) => {
  const { selectedStation, resetSelectedStation } = useSelectedStationStore();
  const { openModal } = useModalActions();
  const [isDragging, setIsDragging] = useState(false);
  const translateY = new Animated.Value(SNAP_POINTS.MIDDLE);
  const lastY = React.useRef(SNAP_POINTS.MIDDLE);
  const lastGestureY = React.useRef(0);

  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [remainingTime, setRemainingTime] = useState(2);
  const buttonOpacity = useState(new Animated.Value(0.5))[0];

  const handlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // 수직 드래그가 수평 드래그보다 명확하게 클 때만 반응
      return (
        Math.abs(gestureState.dy) > 10 && 
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx * 2)
      );
    },
    onPanResponderGrant: (_, gestureState) => {
      lastGestureY.current = gestureState.y0;
      translateY.stopAnimation();
      translateY.setOffset(lastY.current);
      translateY.setValue(0);
      setIsDragging(true);
    },
    onPanResponderMove: (_, gestureState) => {
      const newY = lastY.current - gestureState.dy;
      const clampedY = Math.max(
        SNAP_POINTS.BOTTOM,
        Math.min(SNAP_POINTS.TOP, newY)
      );
      translateY.setValue(clampedY); 
    },

    onPanResponderRelease: (_, gestureState) => {
      translateY.flattenOffset();
      const currentY = lastY.current - gestureState.dy;
      
      // 가장 가까운 스냅 포인트 찾기
      const snapPoints = [SNAP_POINTS.BOTTOM, SNAP_POINTS.MIDDLE, SNAP_POINTS.TOP];
      let targetY;

      // 빠른 스와이프 처리
      if (Math.abs(gestureState.vy) > 0.5) {
        targetY = gestureState.vy > 0 ? SNAP_POINTS.BOTTOM : SNAP_POINTS.TOP;
      } else {
        targetY = snapPoints.reduce((prev, curr) => 
          Math.abs(curr - currentY) < Math.abs(prev - currentY) ? curr : prev
        );
      }

      // 부드러운 애니메이션으로 스냅
      Animated.spring(translateY, {
        toValue: targetY,
        useNativeDriver: false,
        tension: 50,
        friction: 12,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
      }).start(() => {
        lastY.current = targetY;
        setIsDragging(false);
      });
    },
    onPanResponderTerminate: (_, gestureState) => {
      translateY.flattenOffset();
      const currentY = lastY.current - gestureState.dy;
      
      // 가장 가까운 스냅 포인트 찾기
      const snapPoints = [SNAP_POINTS.BOTTOM, SNAP_POINTS.MIDDLE, SNAP_POINTS.TOP];
      const targetY = snapPoints.reduce((prev, curr) => 
        Math.abs(curr - currentY) < Math.abs(prev - currentY) ? curr : prev
      );
    
      // 가장 가까운 지점으로 부드럽게 이동
      Animated.spring(translateY, {
        toValue: targetY,
        useNativeDriver: false,
        tension: 50,
        friction: 12,
      }).start(() => {
        lastY.current = targetY;
        setIsDragging(false);
      });
    },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (selectedStation !== null) {
      setIsButtonEnabled(false);
      setRemainingTime(2);
      buttonOpacity.setValue(0.5);

      timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setIsButtonEnabled(true);
            clearInterval(timer);
            Animated.timing(buttonOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [buttonOpacity, selectedStation]);

  const handleBackBtn = () => {
    if (isButtonEnabled) {
      resetSelectedStation();
    }
  };

  const SearchIcon = () => (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      stroke="#666666"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View 
        style={styles.draggableIconContainer} 
        {...handlePanResponder.panHandlers}
      >
        <View style={styles.draggableIcon} />
      </View>
      
      {selectedStation !== null && (
        <TouchableOpacity
          style={[styles.backButton, { opacity: isButtonEnabled ? 1 : 0.5 }]}
          onPress={handleBackBtn}
          disabled={!isButtonEnabled}
        >
          <Text style={styles.backButtonText}>
            {isButtonEnabled ? "뒤로 가기" : `${remainingTime}초 후 활성화`}
          </Text>
        </TouchableOpacity>
      )}
      
      <Text style={styles.title}>
        {selectedStation ? selectedStation.name : '즐겨찾는 정류장'}
      </Text>
      
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => openModal('minSearchModal')}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <SearchIcon />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      isVisible={true}
      style={styles.modal}
      backdropOpacity={0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hasBackdrop={false}
      useNativeDriver
      useNativeDriverForBackdrop
      coverScreen={false}
      propagateSwipe={!isDragging}
    >
      <Animated.View 
        style={[
          styles.container, 
          { height: translateY }
        ]}
      >
        {renderHeader()}
        <View style={styles.contentContainer}>
          {selectedStation !== null ? (
            <StationDetail />
          ) : (
            <StationList
              favoriteStations={favoriteStations}
              toggleFavorite={toggleFavorite}
            />
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  draggableIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  draggableIcon: {
    width: 40,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007BFF',
    borderRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchButton: {
    padding: 8,
  },
});

export default StationPanel;