import React, {useEffect, useRef, useState} from 'react';
import {View, StyleSheet, Animated, Dimensions, Easing} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import Text from '../components/common/Text';
import Button from '../components/common/Button';
import {useToast} from '../components/common/Toast';
import theme from '../theme';
import {drawReward, EventReward} from '../api/services/eventService';
import ConfettiCannon from 'react-native-confetti-cannon';
import LinearGradient from 'react-native-linear-gradient';
import _Ionicons from 'react-native-vector-icons/Ionicons';

const Ionicons = _Ionicons as unknown as React.ElementType;
const {width, height} = Dimensions.get('window');

type RootStackParamList = {
  RewardDraw: {eventId: string};
};

type RewardDrawRouteProp = RouteProp<RootStackParamList, 'RewardDraw'>;

const RewardDrawPage: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RewardDrawRouteProp>();
  const {eventId} = route.params;
  const {showToast} = useToast();

  // 애니메이션 상태
  const [drawingState, setDrawingState] = useState<'idle' | 'drawing' | 'revealing' | 'complete'>('idle');
  const [drawnReward, setDrawnReward] = useState<EventReward | null>(null);

  // Animated 값들
  const boxScale = useRef(new Animated.Value(0)).current;
  const boxRotate = useRef(new Animated.Value(0)).current;
  const boxShake = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const lidTranslateY = useRef(new Animated.Value(0)).current;
  const rewardScale = useRef(new Animated.Value(0)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  // Confetti ref
  const confettiRef = useRef<any>(null);

  // 등급별 색상
  const getGradeColor = (grade: number) => {
    const colors = {
      1: ['#FFD700', '#FFA500'], // 금색 그라디언트
      2: ['#C0C0C0', '#A8A8A8'], // 은색 그라디언트
      3: ['#CD7F32', '#8B4513'], // 동색 그라디언트
      4: ['#4A90E2', '#2E5F8A'], // 파랑 그라디언트
      5: ['#50C878', '#2E7D4E'], // 초록 그라디언트
    };
    return colors[grade as keyof typeof colors] || ['#888', '#666'];
  };

  // 뽑기 시작
  const startDraw = async () => {
    setDrawingState('drawing');

    // Phase 1: 박스 등장 (0.5초)
    Animated.sequence([
      Animated.spring(boxScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2: 긴장감 조성 (2초) - 흔들림 + 반짝임
    setTimeout(() => {
      // 좌우 흔들림
      Animated.loop(
        Animated.sequence([
          Animated.timing(boxShake, {
            toValue: 10,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(boxShake, {
            toValue: -10,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(boxShake, {
            toValue: 0,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // 펄스 효과
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // 반짝임
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // 회전
      Animated.loop(
        Animated.timing(boxRotate, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }, 500);

    // API 호출
    try {
      const result = await drawReward(eventId);
      setDrawnReward(result.reward);

      // Phase 3: 오픈 (0.5초 후)
      setTimeout(() => {
        setDrawingState('revealing');

        // 모든 루프 애니메이션 정지
        boxShake.stopAnimation();
        pulseAnim.stopAnimation();
        sparkleAnim.stopAnimation();
        boxRotate.stopAnimation();

        // 박스 뚜껑 날아가는 애니메이션
        Animated.parallel([
          Animated.timing(lidTranslateY, {
            toValue: -height,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(boxRotate, {
            toValue: 2,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();

        // 상품 등장
        setTimeout(() => {
          Animated.parallel([
            Animated.spring(rewardScale, {
              toValue: 1,
              friction: 6,
              tension: 40,
              useNativeDriver: true,
            }),
            Animated.timing(rewardOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();

          // Confetti 발사
          if (confettiRef.current) {
            confettiRef.current.start();
          }

          // Phase 4: 완료 상태로 전환
          setTimeout(() => {
            setDrawingState('complete');
          }, 500);
        }, 300);
      }, 2500);
    } catch (error: any) {
      console.error('뽑기 실패:', error);
      showToast(error.message || '뽑기에 실패했습니다.', 'error');
      navigation.goBack();
    }
  };

  // 컴포넌트 마운트 시 자동 시작
  useEffect(() => {
    startDraw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateInterpolate = boxRotate.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '360deg', '720deg'],
  });

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={drawnReward ? getGradeColor(drawnReward.rewardGrade) : [theme.colors.primary.default, '#8B5CF6']}
        style={styles.gradient}>
        {/* 타이틀 */}
        {drawingState === 'idle' || drawingState === 'drawing' ? (
          <View style={styles.header}>
            <Text style={styles.headerText}>행운의 뽑기</Text>
            <Text style={styles.subHeaderText}>두근두근... 기대해주세요!</Text>
          </View>
        ) : null}

        {/* 박스 애니메이션 영역 */}
        <View style={styles.boxContainer}>
          {drawingState !== 'complete' && (
            <Animated.View
              style={[
                styles.box,
                {
                  transform: [
                    {scale: Animated.multiply(boxScale, pulseAnim)},
                    {translateX: boxShake},
                    {rotate: rotateInterpolate},
                  ],
                },
              ]}>
              {/* 박스 본체 */}
              <View style={styles.boxBody}>
                <Ionicons name="gift" size={120} color={theme.colors.white} />
              </View>

              {/* 박스 뚜껑 */}
              <Animated.View
                style={[
                  styles.boxLid,
                  {
                    transform: [{translateY: lidTranslateY}],
                  },
                ]}>
                <View style={styles.lidRibbon} />
              </Animated.View>

              {/* 반짝임 효과 */}
              <Animated.View
                style={[
                  styles.sparkle,
                  {
                    opacity: sparkleOpacity,
                  },
                ]}>
                {[...Array(8)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.sparkleRay,
                      {
                        transform: [
                          {rotate: `${i * 45}deg`},
                          {translateX: 80},
                        ],
                      },
                    ]}
                  />
                ))}
              </Animated.View>
            </Animated.View>
          )}

          {/* 상품 표시 */}
          {drawingState === 'revealing' || drawingState === 'complete' ? (
            <Animated.View
              style={[
                styles.rewardContainer,
                {
                  transform: [{scale: rewardScale}],
                  opacity: rewardOpacity,
                },
              ]}>
              {drawnReward && (
                <>
                  {/* 등급 배지 */}
                  <View
                    style={[
                      styles.gradeBadge,
                      {backgroundColor: getGradeColor(drawnReward.rewardGrade)[0]},
                    ]}>
                    <Text style={styles.gradeText}>{drawnReward.rewardGrade}등</Text>
                  </View>

                  {/* 축하 메시지 */}
                  <Text style={styles.congratsText}>축하합니다! 🎉</Text>

                  {/* 상품 정보 */}
                  <View style={styles.rewardCard}>
                    <Ionicons name="trophy" size={80} color={getGradeColor(drawnReward.rewardGrade)[0]} />
                    <Text style={styles.rewardName}>{drawnReward.rewardName}</Text>
                    {drawnReward.description && (
                      <Text style={styles.rewardDescription}>{drawnReward.description}</Text>
                    )}
                  </View>
                </>
              )}
            </Animated.View>
          ) : null}
        </View>

        {/* 완료 버튼 */}
        {drawingState === 'complete' && (
          <View style={styles.footer}>
            <Button
              onPress={() => navigation.goBack()}
              variant="filled"
              isFullWidth
              style={styles.completeButton}>
              확인
            </Button>
          </View>
        )}

        {/* Confetti */}
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{x: width / 2, y: height / 2}}
          autoStart={false}
          fadeOut={true}
          fallSpeed={3000}
        />
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },
  headerText: {
    fontSize: theme.typography.heading.h1.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  subHeaderText: {
    fontSize: theme.typography.text.lg.fontSize,
    color: theme.colors.white,
    opacity: 0.9,
  },
  boxContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxBody: {
    width: 180,
    height: 180,
    backgroundColor: theme.colors.primary.default,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  boxLid: {
    position: 'absolute',
    top: -10,
    width: 180,
    height: 40,
    backgroundColor: theme.colors.primary.default,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -5},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  lidRibbon: {
    width: '100%',
    height: 10,
    backgroundColor: '#FFD700',
    position: 'absolute',
    top: '50%',
  },
  sparkle: {
    position: 'absolute',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleRay: {
    position: 'absolute',
    width: 4,
    height: 30,
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  rewardContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  gradeBadge: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradeText: {
    fontSize: theme.typography.heading.h2.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.white,
  },
  congratsText: {
    fontSize: theme.typography.heading.h1.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.white,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  rewardCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    width: '100%',
  },
  rewardName: {
    fontSize: theme.typography.heading.h2.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  rewardDescription: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  footer: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  completeButton: {
    backgroundColor: theme.colors.white,
  },
});

export default RewardDrawPage;
