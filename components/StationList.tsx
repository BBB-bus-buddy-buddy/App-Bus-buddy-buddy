import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import useSelectedStationStore from '../store/useSelectedStationStore';

interface Station {
  id: string;
  name: string;
  // 추가 필요한 속성들
}

interface StationListProps {
  favoriteStations: Station[];
  toggleFavorite: (id: string) => void;
}

const StationList: React.FC<StationListProps> = ({
  favoriteStations,
  toggleFavorite,
}) => {
  const { selectedStation, setSelectedStation } = useSelectedStationStore();

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        즐겨찾는 정류장이 없습니다. 정류장을 등록해 주세요.
      </Text>
    </View>
  );

  const renderStationItem = ({ item }: { item: Station }) => {
    const isSelected = selectedStation?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.stationItem,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => setSelectedStation(item)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.stationName,
            isSelected && styles.selectedText,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <TouchableOpacity
          style={styles.starButton}
          onPress={() => toggleFavorite(item.id)}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={styles.starIcon}>★</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={favoriteStations}
        renderItem={renderStationItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContainer: {
    padding: 8,
    flexGrow: 1,
  },
  stationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 35,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 4,
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
        elevation: 2,
      },
    }),
  },
  selectedItem: {
    backgroundColor: '#D0E0E3',
  },
  stationName: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginRight: 8,
  },
  selectedText: {
    fontWeight: '600',
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 24,
    color: '#FFD700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default StationList;