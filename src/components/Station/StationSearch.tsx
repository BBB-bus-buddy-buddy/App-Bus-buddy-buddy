import React, {useState} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import useStore from '../../store/useStore';

export interface Station {
  id: string;
  name: string;
  location?: {
    x: number;
    y: number;
  };
  type?: string;
  favorite?: boolean;
}

const StationSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const stations = useStore(state => state.stations);
  const setFilteredStations = useStore(state => state.setFilteredStations);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    const filtered = stations.filter(station =>
      station.name.toLowerCase().includes(text.toLowerCase()),
    );
    setFilteredStations(filtered);
  };

  const handleClear = () => {
    setSearchTerm('');
    setFilteredStations(stations);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="정류장을 검색하세요"
          placeholderTextColor="#999999"
          value={searchTerm}
          onChangeText={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            hitSlop={{
              top: 10,
              right: 10,
              bottom: 10,
              left: 10,
            }}></TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    width: '100%',
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
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    padding: 0,
    ...Platform.select({
      android: {
        paddingVertical: 8,
      },
    }),
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default StationSearch;
