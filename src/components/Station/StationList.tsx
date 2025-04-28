import React from 'react';
import {View, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import Text from '../common/Text';
import Card from '../common/Card';
import theme from '../../theme';
import {Station} from '../../api/services/stationService';
import useSelectedStationStore from '../../store/useSelectedStationStore';

interface StationListProps {
  stations: Station[];
  toggleFavorite: (id: string) => void;
}

const StationList: React.FC<StationListProps> = ({
  stations,
  toggleFavorite,
}) => {
  const {selectedStation, setSelectedStation} = useSelectedStationStore();

  // 빈 목록 처리
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text
        variant="md"
        color={theme.colors.gray[500]}
        style={styles.emptyText}>
        즐겨찾는 정류장이 없습니다.{'\n'}
        검색을 통해 정류장을 추가해보세요.
      </Text>
    </View>
  );

  // 정류장 아이템 렌더링
  const renderStationItem = ({item}: {item: Station}) => (
    <Card
      variant="filled"
      padding="md"
      style={[
        styles.stationCard,
        selectedStation?.id === item.id && styles.selectedCard,
      ]}
      onPress={() =>
        setSelectedStation({
          ...item,
          location: item.location
            ? {x: item.location.coordinates[0], y: item.location.coordinates[1]}
            : undefined,
        })
      }>
      <View style={styles.stationRow}>
        <View style={styles.stationInfo}>
          <Text
            variant="md"
            weight="semiBold"
            color={
              selectedStation?.id === item.id
                ? theme.colors.primary.default
                : theme.colors.gray[900]
            }
            numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Text style={styles.favoriteIcon}>★</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  // 구분선
  const ItemSeparator = () => <View style={styles.separator} />;

  return (
    <FlatList
      data={stations}
      renderItem={renderStationItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContainer}
      ItemSeparatorComponent={ItemSeparator}
      ListEmptyComponent={renderEmptyList}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  stationCard: {
    borderRadius: theme.borderRadius.md,
  },
  selectedCard: {
    backgroundColor: theme.colors.primary.light + '10',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary.default,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  favoriteButton: {
    padding: theme.spacing.xs,
  },
  favoriteIcon: {
    fontSize: 20,
    color: theme.colors.system.warning,
  },
  separator: {
    height: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default StationList;
