import React, {useEffect, useState, useCallback, useRef} from 'react';
import {View, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LoadingPage from '../pages/LoadingPage';
import MyLocationIcon from '../assets/logos/myLocation.svg';
import {
  Camera,
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import useSelectedStationStore from '../store/useSelectedStationStore';

interface Station {
  id: string;
  name: string;
  location: {
    x: number;
    y: number;
  };
}

interface BusPosition {
  busNumber: string;
  location: {
    coordinates: [number, number];
  };
}

const MapViewComponent = () => {
  const websocketRef = useRef<WebSocket | null>(null);

  const [myLocation, setMyLocation] = useState<Camera>({
    latitude: 37.50497126,
    longitude: 127.04905021,
    zoom: 15,
  });

  const {selectedStation, setSelectedStation} = useSelectedStationStore();
  const [stationPositions, setStationPositions] = useState<Station[]>([]);
  const [busPositions, setBusPositions] = useState<BusPosition[]>([]);
  const [camera, setCamera] = useState<Camera>({
    latitude: 37.50497126,
    longitude: 127.04905021,
    zoom: 15,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [, setErrMsg] = useState<string | null>(null);

  const initializeLocation = useCallback(() => {
    return new Promise<void>(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          setMyLocation({latitude, longitude});
          resolve();
        },
        error => {
          console.error('Location error:', error);
          setErrMsg('위치 정보를 가져올 수 없습니다.');
          setMyLocation({latitude: 37.5665, longitude: 126.978}); // 기본 위치
          resolve();
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  }, []);

  const fetchStations = useCallback(async () => {
    try {
      const response = await fetch('http://devse.gonetis.com:12589/api/station');
      const data = await response.json();
      setStationPositions(data.data);
    } catch (error) {
      console.error('Station fetch error:', error);
      setErrMsg('정류장 정보를 가져올 수 없습니다.');
    }
  }, []);

  const handleWebSocketMessage = useCallback((event: WebSocketMessageEvent) => {
    try {
      const rows = event.data.split('\n');
      const newBusPositions = rows
        .filter(Boolean)
        .map((row: string) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [busNumber, lng, lat, seats] = row.split(',');
          return {
            busNumber: busNumber.trim(),
            location: {
              coordinates: [parseFloat(lat), parseFloat(lng)],
            },
          };
        })
        .filter(
          (pos: {location: {coordinates: number[]}}): pos is BusPosition =>
            !isNaN(pos.location.coordinates[0]) &&
            !isNaN(pos.location.coordinates[1]),
        );

      setBusPositions(newBusPositions);
    } catch (error) {
      console.error('WebSocket data parsing error:', error);
    }
  }, []);

  const initializeWebSocket = useCallback(() => {
    const ws = new WebSocket('ws://devse.gonetis.com:12599/bus-location');

    ws.onopen = () => {
      console.log('WebSocket Connected');
      ws.send(
        JSON.stringify({
          type: 'SUBSCRIBE',
          destination: '/topic/bus-locations',
        }),
      );
    };

    ws.onmessage = handleWebSocketMessage;
    websocketRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [handleWebSocketMessage]);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        await initializeLocation();
        await fetchStations();
        if (isActive) {
          initializeWebSocket();
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setErrMsg('초기화 중 문제가 발생했습니다.');
      }
    };

    initialize();

    return () => {
      isActive = false;
      websocketRef.current?.close();
    };
  }, [initializeLocation, fetchStations, initializeWebSocket]);

  // useEffect 수정
  useEffect(() => {
    if (selectedStation && selectedStation.location) {
      setCamera({
        latitude: selectedStation.location.x,
        longitude: selectedStation.location.y,
        zoom: 17,
      });
    } else if (myLocation) {
      setCamera({
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        zoom: 15,
      });
    }
  }, [selectedStation, myLocation]);

  // 내 위치 버튼 기능 추가
  const moveToMyLocation = useCallback(() => {
    if (myLocation) {
      const newCamera = {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        zoom: 15,
      };
      setCamera(newCamera);
    }
  }, [myLocation]);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        camera={camera}
        minZoom={5}
        maxZoom={20}
        isShowLocationButton={true}>
        {/* 내 위치 마커 */}
        {myLocation && (
          <NaverMapMarkerOverlay
            width={25}
            height={30}
            longitude={myLocation.longitude}
            latitude={myLocation.latitude}
          />
        )}

        {/* 정류장 마커 */}
        {stationPositions.map(
          (station) =>
            station.location && (
                <NaverMapMarkerOverlay
                  key={station.id}
                  latitude={station.location.x}
                  longitude={station.location.y}
                  caption={{
                    text: station.name,
                    textSize: 14,
                    color: '#000000',
                    haloColor: '#ffffff',
                  }}
                  onTap={()=>setSelectedStation(station)}
                  width={25}
                  height={25}
                  image={require('../assets/images/busStop.png')}
                />
            )
        )}

        {/* 버스 마커 */}
        {busPositions.map((bus, index) => (
          <NaverMapMarkerOverlay
            key={`bus-${index}`}
            latitude={bus.location.coordinates[0]}
            longitude={bus.location.coordinates[1]}
            caption={{
              text: bus.busNumber,
              textSize: 14,
              color: '#000000',
              haloColor: '#ffffff',
            }}
            width={25}
            height={25}
            image={require('../assets/images/busIcon.png')}
          />
        ))}
      </NaverMapView>

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={moveToMyLocation}>
        <MyLocationIcon width={20} height={20} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#fff', // 배경색 추가
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  myLocationButton: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 25,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

export default React.memo(MapViewComponent);
