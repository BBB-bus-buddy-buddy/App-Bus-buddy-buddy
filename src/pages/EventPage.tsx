import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Text from '../components/common/Text';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import {useToast} from '../components/common/Toast';
import theme from '../theme';
import useEventStore from '../store/useEventStore';
import {
  getCurrentEvent,
  getEventMissions,
  getEventRewards,
  getMyParticipation,
  completeMission,
  MissionType,
} from '../api/services/eventService';
import _Ionicons from 'react-native-vector-icons/Ionicons';
import useBoardingStore from '../store/useBoardingStore';

const Ionicons = _Ionicons as unknown as React.ElementType;

type RootStackParamList = {
  RewardDraw: {eventId: string};
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EventPage: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {showToast} = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Zustand store
  const {
    currentEvent,
    missions,
    rewards,
    participation,
    setCurrentEvent,
    setMissions,
    setRewards,
    setParticipation,
  } = useEventStore();

  // 탑승 상태 (미션 완료 자동 감지용)
  const {boardedBusNumber, isBoarded} = useBoardingStore();

  // 데이터 로드
  useEffect(() => {
    loadEventData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탑승 상태 변경 감지 (자동 미션 완료)
  useEffect(() => {
    if (isBoarded && currentEvent) {
      // AUTO_DETECT_BOARDING 미션 자동 완료
      autoCompleteBoardingMission();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoarded, currentEvent]);

  const loadEventData = async () => {
    try {
      setIsLoading(true);

      // 현재 이벤트 조회
      const event = await getCurrentEvent();
      setCurrentEvent(event);

      // 미션 목록 조회
      const missionList = await getEventMissions(event.id);
      setMissions(missionList);

      // 상품 목록 조회
      const rewardList = await getEventRewards(event.id);
      setRewards(rewardList);

      // 내 참여 현황 조회
      const myParticipation = await getMyParticipation(event.id);
      setParticipation(myParticipation);
    } catch (error: any) {
      console.error('이벤트 데이터 로드 실패:', error);
      showToast(error.message || '이벤트 정보를 불러올 수 없습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 자동 승하차 미션 완료
  const autoCompleteBoardingMission = async () => {
    try {
      const boardingMission = missions.find(
        m => m.missionType === MissionType.AUTO_DETECT_BOARDING && !m.isCompleted,
      );

      if (boardingMission && currentEvent) {
        await completeMission({
          eventId: currentEvent.id,
          missionId: boardingMission.id,
          targetValue: boardedBusNumber || '',
        });
        showToast('✅ 자동 승하차 감지 미션 완료!', 'success');
        loadEventData(); // 새로고침
      }
    } catch (error: any) {
      console.error('자동 미션 완료 실패:', error);
    }
  };

  // 뽑기 화면으로 이동
  const handleDrawReward = () => {
    if (!currentEvent) return;

    if (!participation?.isEligibleForDraw) {
      showToast('모든 필수 미션을 완료해주세요!', 'warning');
      return;
    }

    if (participation?.hasDrawn) {
      showToast('이미 뽑기를 완료하였습니다!', 'info');
      return;
    }

    navigation.navigate('RewardDraw', {eventId: currentEvent.id});
  };

  // 등급별 색상
  const getGradeColor = (grade: number) => {
    const colors = {
      1: '#FFD700', // 금색
      2: '#C0C0C0', // 은색
      3: '#CD7F32', // 동색
      4: '#4A90E2', // 파랑
      5: '#50C878', // 초록
    };
    return colors[grade as keyof typeof colors] || theme.colors.gray[300];
  };

  // 미션 아이콘
  const getMissionIcon = (missionType: MissionType) => {
    const icons = {
      [MissionType.BOARDING]: 'bus',
      [MissionType.VISIT_STATION]: 'location',
      [MissionType.AUTO_DETECT_BOARDING]: 'bluetooth',
    };
    return icons[missionType] || 'checkmark-circle';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.default} />
          <Text style={styles.loadingText}>이벤트 정보 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={theme.colors.gray[400]} />
          <Text style={styles.emptyText}>진행 중인 이벤트가 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>{currentEvent.name}</Text>
          <Text style={styles.description}>{currentEvent.description}</Text>
        </View>

        {/* 참여 현황 카드 */}
        <Card style={styles.participationCard}>
          <View style={styles.participationHeader}>
            <Ionicons name="trophy" size={24} color={theme.colors.primary.default} />
            <Text style={styles.participationTitle}>내 참여 현황</Text>
          </View>
          <View style={styles.participationStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {participation?.completedMissions.length || 0}/{missions.length}
              </Text>
              <Text style={styles.statLabel}>완료한 미션</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statValue,
                  {color: participation?.isEligibleForDraw ? theme.colors.system.success : theme.colors.gray[400]},
                ]}>
                {participation?.isEligibleForDraw ? '가능' : '불가능'}
              </Text>
              <Text style={styles.statLabel}>뽑기 자격</Text>
            </View>
          </View>

          {participation?.hasDrawn && participation.drawnReward && (
            <View style={styles.drawnRewardContainer}>
              <Text style={styles.drawnRewardText}>
                🎉 {participation.drawnReward.rewardGrade}등 당첨!
              </Text>
              <Text style={styles.drawnRewardName}>
                {participation.drawnReward.rewardName}
              </Text>
            </View>
          )}
        </Card>

        {/* 미션 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 미션 목록</Text>
          {missions.map((mission) => (
            <Card key={mission.id} style={styles.missionCard}>
              <View style={styles.missionHeader}>
                <View style={styles.missionIconContainer}>
                  <Ionicons
                    name={getMissionIcon(mission.missionType)}
                    size={24}
                    color={mission.isCompleted ? theme.colors.system.success : theme.colors.primary.default}
                  />
                </View>
                <View style={styles.missionInfo}>
                  <Text style={styles.missionTitle}>
                    {mission.isRequired && <Text style={styles.requiredBadge}>필수 </Text>}
                    {mission.title}
                  </Text>
                  <Text style={styles.missionDescription}>{mission.description}</Text>
                </View>
                {mission.isCompleted && (
                  <Ionicons name="checkmark-circle" size={28} color={theme.colors.system.success} />
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* 상품 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎁 상품 목록</Text>
          {rewards.map((reward) => (
            <Card key={reward.id} style={styles.rewardCard}>
              <View
                style={[
                  styles.rewardGradeBadge,
                  {backgroundColor: getGradeColor(reward.rewardGrade)},
                ]}>
                <Text style={styles.rewardGradeText}>{reward.rewardGrade}등</Text>
              </View>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>{reward.rewardName}</Text>
                <Text style={styles.rewardDescription}>{reward.description}</Text>
                <View style={styles.rewardMeta}>
                  <Text style={styles.rewardProbability}>
                    당첨 확률: {(reward.probability * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.rewardQuantity}>
                    남은 수량: {reward.remainingQuantity}/{reward.totalQuantity}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* 뽑기 버튼 */}
        <View style={styles.footer}>
          <Button
            onPress={handleDrawReward}
            disabled={!participation?.isEligibleForDraw || participation?.hasDrawn}
            variant={participation?.isEligibleForDraw && !participation?.hasDrawn ? 'filled' : 'tonal'}
            isFullWidth>
            {participation?.hasDrawn
              ? '이미 뽑기 완료'
              : participation?.isEligibleForDraw
              ? '🎲 행운의 뽑기 시작!'
              : '미션을 완료해주세요'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.gray[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.text.lg.fontSize,
    color: theme.colors.gray[600],
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  title: {
    fontSize: theme.typography.heading.h2.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.gray[600],
  },
  participationCard: {
    margin: theme.spacing.md,
  },
  participationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  participationTitle: {
    fontSize: theme.typography.text.lg.fontSize,
    fontWeight: theme.typography.fontWeight.semiBold as any,
    marginLeft: theme.spacing.sm,
  },
  participationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: theme.typography.heading.h3.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.primary.default,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.text.sm.fontSize,
    color: theme.colors.gray[600],
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.gray[200],
  },
  drawnRewardContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.system.success + '20',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  drawnRewardText: {
    fontSize: theme.typography.text.lg.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.system.success,
    marginBottom: theme.spacing.xs,
  },
  drawnRewardName: {
    fontSize: theme.typography.text.md.fontSize,
    color: theme.colors.gray[900],
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.text.lg.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    marginBottom: theme.spacing.md,
  },
  missionCard: {
    marginBottom: theme.spacing.sm,
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary.default + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontSize: theme.typography.text.md.fontSize,
    fontWeight: theme.typography.fontWeight.semiBold as any,
    marginBottom: theme.spacing.xs,
  },
  requiredBadge: {
    color: theme.colors.system.error,
    fontWeight: theme.typography.fontWeight.bold as any,
  },
  missionDescription: {
    fontSize: theme.typography.text.sm.fontSize,
    color: theme.colors.gray[600],
  },
  rewardCard: {
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardGradeBadge: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  rewardGradeText: {
    fontSize: theme.typography.text.md.fontSize,
    fontWeight: theme.typography.fontWeight.bold as any,
    color: theme.colors.white,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: theme.typography.text.md.fontSize,
    fontWeight: theme.typography.fontWeight.semiBold as any,
    marginBottom: theme.spacing.xs,
  },
  rewardDescription: {
    fontSize: theme.typography.text.sm.fontSize,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.xs,
  },
  rewardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardProbability: {
    fontSize: theme.typography.text.xs.fontSize,
    color: theme.colors.primary.default,
  },
  rewardQuantity: {
    fontSize: theme.typography.text.xs.fontSize,
    color: theme.colors.gray[600],
  },
  footer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
});

export default EventPage;
