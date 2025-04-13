import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface CommonSearchBarModuleProps {
  searchStationName: string;
  setSearchStationName: (text: string) => void;
  onSearch: (text: string) => void;
  onFocus?: () => void;
  inputRef?: React.RefObject<TextInput>;
}

const CommonSearchBarModule: React.FC<CommonSearchBarModuleProps> = ({
  searchStationName,
  setSearchStationName,
  onSearch,
  onFocus,
  inputRef,
}) => {
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

  return (
    <View style={styles.searchBarWrapper}>
      <TextInput
        style={styles.searchInput}
        placeholder="검색할 정류장을 입력해주세요."
        placeholderTextColor="#999999"
        value={searchStationName}
        onChangeText={setSearchStationName}
        onFocus={onFocus}
        ref={inputRef}
        returnKeyType="search"
        onSubmitEditing={() => onSearch(searchStationName)}
      />
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => onSearch(searchStationName)}
        activeOpacity={0.7}
      >
        <SearchIcon />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  searchBarWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // var(--main-white-bright-more)
    width: width * 0.85,
    borderRadius: 20,
    margin: 10,
    paddingHorizontal: 15,
    paddingVertical: 5,
    zIndex: 150,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.select({
      ios: 10,
      android: 8,
    }),
    paddingHorizontal: 5,
    fontSize: 16,
    color: '#333333',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  },
  searchButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CommonSearchBarModule;