import React, { useState, useRef, useEffect } from 'react';
import { TextInput, Keyboard } from 'react-native';
import axios from 'axios';
import CommonSearchBarModule from './CommonSearchBarModule';
import FullScreenSearchModal from './FullScreenSearchModal';
import useSelectedStationStore from '../../store/useSelectedStationStore';

interface SearchResult {
  id: string;
  name: string;
  // 필요한 다른 속성들 추가
}

const SearchBar: React.FC = () => {
  const [searchStationName, setSearchStationName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const searchInputRef = useRef<TextInput>(null);
  const { setSelectedStation } = useSelectedStationStore();

  // 키보드 이벤트 리스너 설정
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // 키보드가 숨겨질 때 필요한 처리
        searchInputRef.current?.blur();
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSearchBarFocus = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSearchStationName('');
    Keyboard.dismiss();
  };

  const handleSearch = async (stationName: string) => {
    if (!stationName.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        'http://localhost:8088/api/station',
        {
          params: {
            name: stationName,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      setSearchResults(response.data.data);
      setSearchStationName(stationName);
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : '정류장 검색에 실패했습니다.'
      );
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStationSelect = (station: SearchResult) => {
    setSelectedStation(station);
    handleModalClose();
  };

  return (
    <>
      <CommonSearchBarModule
        searchStationName={searchStationName}
        setSearchStationName={setSearchStationName}
        onSearch={handleSearch}
        onFocus={handleSearchBarFocus}
        inputRef={searchInputRef}
      />
      <FullScreenSearchModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        initialValue={searchStationName}
        onSearch={handleSearch}
        searchResults={searchResults}
        isLoading={isLoading}
        error={error}
        onStationSelect={handleStationSelect}
      />
    </>
  );
};


export default SearchBar;