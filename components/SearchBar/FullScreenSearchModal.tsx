import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import CommonSearchBarModule from './CommonSearchBarModule';
import useSelectedStationStore from '../../store/useSelectedStationStore';

const { width } = Dimensions.get('window');

interface Station {
  id: string;
  name: string;
}

interface FullScreenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onSearch: (text: string) => void;
  searchResults: Station[];
  isLoading: boolean;
  error: string | null;
  toggleFavorite?: (station: Station) => void;
  onStationSelect?: (station: Station) => void;
}

const FullScreenSearchModal: React.FC<FullScreenSearchModalProps> = ({
  isOpen,
  onClose,
  initialValue,
  onSearch,
  searchResults,
  isLoading,
  error,
  onStationSelect
}) => {
  const [searchStationName, setSearchStationName] = useState(initialValue);
  const searchInputRef = useRef<TextInput>(null);
  const { setSelectedStation } = useSelectedStationStore();

  useEffect(() => {
    setSearchStationName(initialValue);
  }, [initialValue]);

  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    if (onStationSelect) {
      onStationSelect(station);
    }
    onClose();
  };

  const renderSearchResult = ({ item }: { item: Station }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleStationClick(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.searchResultText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#666666" />
          <Text style={styles.messageText}>검색 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.messageText}>검색 결과가 없습니다.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={searchResults}
        renderItem={renderSearchResult}
        keyExtractor={(item) => item.id}
        style={styles.searchResults}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <CommonSearchBarModule
              searchStationName={searchStationName}
              setSearchStationName={setSearchStationName}
              onSearch={onSearch}
              inputRef={searchInputRef}
            />
            <View style={styles.resultContainer}>
              {renderContent()}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 0, // iOS에서 상단 여백 추가
  },
  resultContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  searchResults: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  searchResultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultText: {
    fontSize: 16,
    color: '#333333',
  },
  messageText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  closeButton: {
    width: width * 0.9,
    padding: 12,
    backgroundColor: '#666666',
    borderRadius: 8,
    marginBottom: Platform.OS === 'ios' ? 34 : 20,
    marginHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default FullScreenSearchModal;