import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import Footer from '../components/Footer';
import { RootStackParamList } from '../App';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

interface Bus {
  busNumber: string;
  // 다른 필요한 버스 속성들
}

interface BusResponse {
  data: Bus[];
  message?: string;
}

type BusListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusList'>;

const BusListPage: React.FC = () => {
  const [busList, setBusList] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<BusListScreenNavigationProp>();

  useEffect(() => {
    fetchBusList();
  }, []);

  const fetchBusList = async () => {
    try {
      setLoading(true);
      const response = await axios.get<BusResponse>(
        'http://localhost:8088/api/bus'
      );
      setBusList(response.data.data);
      setError(null);
    } catch (error) {
      console.error('버스 목록을 가져오는 중 오류 발생:', error);
      setError('버스 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const goToBusDetail = (busNumber: string) => {
    navigation.navigate('BusRoute', { busNumber });
  };

  const renderBusItem = ({ item }: { item: Bus }) => (
    <TouchableOpacity
      style={styles.busItem}
      onPress={() => goToBusDetail(item.busNumber)}
      activeOpacity={0.7}
    >
      <Image
        source={require('../assets/images/busIcon.png')}
        style={styles.busIcon}
        resizeMode="contain"
      />
      <Text style={styles.busNumber}>{item.busNumber}</Text>
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerText}>울산과학대의 버스 목록</Text>
    </View>
  );

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>등록된 버스가 없습니다.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#80CBC4" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchBusList}
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {ListHeader()}
      <FlatList
        data={busList}
        renderItem={renderBusItem}
        keyExtractor={(item) => item.busNumber}
        ListEmptyComponent={EmptyList}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
      />
      <Footer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#80CBC4',
    width: width - 32,
    height: 48,
    borderRadius: 10,
    marginVertical: 16,
    marginHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  busItem: {
    width: (width - 48) / 2,
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  busIcon: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#80CBC4',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

// 애니메이션 래퍼 컴포넌트
export const AnimatedBusListPage: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <BusListPage />
    </Animated.View>
  );
};

export default BusListPage;