import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDebounce} from 'use-debounce';
import Text from '../common/Text';
import Input from '../common/Input';
import Button from '../common/Button';
import theme from '../../theme';
import {Station, stationService} from '../../api/services/stationService';
import useSelectedStationStore from '../../store/useSelectedStationStore';
import IconSearch from '../assets/icons/IconSearch'; // Ensure this file exists at the specified path

interface SearchStationModalProps {
  visible: boolean;
  onClose: () => void;
  favoriteStations: Station[];
  toggleFavorite: (id: string) => void;
}

const SearchStationModal: React.FC<SearchStationModalProps> = ({
  visible,
  onClose,
  favoriteStations,
  toggleFavorite,
}) => {
  const insets = useSafeAreaInsets();
  const {setSelectedStation} = useSelectedStationStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Station[]>([]);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const searchStations = async () => {
      // 검색어가 비어있을 때 전체 정류장 로드
      if (!debouncedSearchTerm.trim()) {
        try {
          setIsLoading(true);
          const allStations = await stationService.getAllStations();
          setSearchResults(allStations);
        } catch (error) {
          console.error('Failed to load all stations:', error);
          setError('전체 정류장 목록을 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // 검색어가 있을 때 검색 수행
      try {
        setIsLoading(true);
        setError(null);
        const results = await stationService.searchStationsByName(
          debouncedSearchTerm,
        );
        setSearchResults(results);
      } catch (error) {
        console.error('Station search error:', error);
        setError('정류장 검색 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    searchStations();
  }, [debouncedSearchTerm]);

  // 모달 열릴 때 초기화 및 전체 정류장 로드
  useEffect(() => {
    if (visible) {
      const loadInitialData = async () => {
        try {
          setIsLoading(true);
          const allStations = await stationService.getAllStations();
          setSearchResults(allStations);
        } catch (error) {
          console.error('Failed to load initial stations:', error);
          setError('초기 데이터를 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      loadInitialData();
      inputRef.current?.focus();
    }
  }, [visible]);

  // 정류장 선택 처리
  const handleStationSelect = (station: Station) => {
    setSelectedStation({
      ...station,
      location: station.location
        ? {
            x: station.location.coordinates[0],
            y: station.location.coordinates[1],
          }
        : undefined,
    });
    onClose();
  };

  // 즐겨찾기 상태 확인
  const isStationFavorite = (stationId: string) => {
    return favoriteStations.some(station => station.id === stationId);
  };

  // 정류장 아이템 렌더링
  const renderStationItem = ({item}: {item: Station}) => {
    const isFavorite = isStationFavorite(item.id);

    return (
      <TouchableOpacity
        style={styles.stationItem}
        onPress={() => handleStationSelect(item)}
        activeOpacity={0.7}>
        <View style={styles.stationInfo}>
          <Text variant="md" weight="medium">
            {item.name}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}>
          <Text
            style={[
              styles.favoriteIcon,
              isFavorite && styles.favoriteIconActive,
            ]}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 결과 렌더링
  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primary.default}
          />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredContent}>
          <Text variant="md" color={theme.colors.system.error}>
            {error}
          </Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      if (debouncedSearchTerm.trim()) {
        return (
          <View style={styles.centeredContent}>
            <Text variant="md" color={theme.colors.gray[500]}>
              검색 결과가 없습니다.
            </Text>
          </View>
        );
      } else {
        return (
          <View style={styles.centeredContent}>
            <Text variant="md" color={theme.colors.gray[500]}>
              정류장 이름을 입력해주세요.
            </Text>
          </View>
        );
      }
    }

    return (
      <FlatList
        data={searchResults}
        renderItem={renderStationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, {paddingTop: insets.top}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.searchInputContainer}>
            <Input
              ref={inputRef}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="정류장 이름 검색"
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<IconSearch size={20} color={theme.colors.gray[500]} />}
              inputStyle={styles.searchInput}
              containerStyle={styles.searchInputWrapper}
            />
          </View>

          <Button
            variant="text"
            size="small"
            onPress={onClose}
            style={styles.cancelButton}>
            취소
          </Button>
        </View>

        <View style={styles.content}>{renderContent()}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  searchInputContainer: {
    flex: 1,
  },
  searchInputWrapper: {
    marginBottom: 0,
  },
  searchInput: {
    height: 40,
  },
  cancelButton: {
    marginLeft: theme.spacing.sm,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  listContent: {
    paddingVertical: theme.spacing.sm,
  },
  stationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  stationInfo: {
    flex: 1,
  },
  favoriteButton: {
    padding: theme.spacing.sm,
  },
  favoriteIcon: {
    fontSize: 24,
    color: theme.colors.gray[300],
  },
  favoriteIconActive: {
    color: theme.colors.system.warning,
  },
});

export default SearchStationModal;
