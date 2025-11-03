# BBB (BusBuddyBuddy)

> 실시간 버스 위치 추적 및 탑승 관리 모바일 애플리케이션

BBB는 React Native 기반의 실시간 버스 추적 시스템으로, 자동 탑승 감지, 정류장 관리, 도착 예측 기능을 제공합니다.

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [화면 구성](#화면-구성)
- [핵심 컴포넌트](#핵심-컴포넌트)
- [상태 관리](#상태-관리)
- [API 서비스](#api-서비스)
- [WebSocket 통합](#websocket-통합)
- [설치 및 실행](#설치-및-실행)

---

## 주요 기능

### 1. 실시간 버스 추적
- 네이버 지도 기반 버스 위치 표시
- WebSocket을 통한 실시간 위치 업데이트
- 탑승 중인 버스 자동 카메라 추적

### 2. 자동 탑승 감지
- 10초마다 위치 추적
- 서버 측에서 근접 거리 기반 탑승 감지
- 탑승/하차 시 토스트 알림
- 최대 2시간 자동 추적

### 3. 정류장 관리
- 즐겨찾기 정류장 등록
- 정류장 검색 기능
- 실시간 도착 정보 표시
- 드래그 가능한 바텀 시트 패널

### 4. 노선 및 버스 정보
- 노선별 버스 목록
- 정류장별 타임라인 뷰
- 좌석 혼잡도 시각화 (여유/보통/혼잡)
- 도착 예정 시간 표시

### 5. 사용자 인증
- Google OAuth2 로그인
- 조직 코드 입력 (게스트용)
- 역할 기반 라우팅 (GUEST/USER/ADMIN)

---

## 기술 스택

### 코어 프레임워크
- **React Native** 0.78.0
- **React** 19.0.0
- **TypeScript** 5.0.4

### 내비게이션 & UI
- React Navigation v6 (Native Stack & Stack)
- React Native Modal
- React Native Vector Icons
- React Native SVG
- React Native Safe Area Context

### 지도 & 위치
- Naver Maps SDK (@mj-studio/react-native-naver-map)
- React Native Community Geolocation
- React Native Permissions

### 상태 관리
- **Zustand** 5.0.2 (경량 상태 관리)

### 데이터 & 통신
- **Axios** 1.7.9 (HTTP 클라이언트)
- **WebSocket** (실시간 통신)
- AsyncStorage (로컬 저장소)

### 인증
- Google OAuth2
- React Native InAppBrowser Reborn

### 유틸리티
- use-debounce (검색 최적화)

---

## 프로젝트 구조

```
/src
├── pages/                          # 메인 화면
│   ├── HomePage.tsx               # 메인 지도 & 정류장 뷰
│   ├── LoginPage.tsx              # Google OAuth 로그인
│   ├── EnterCodePage.tsx          # 조직 코드 입력
│   ├── RouteListPage.tsx          # 버스 노선 목록
│   ├── BusListPage.tsx            # 특정 노선의 버스 목록
│   ├── BusRoutePage.tsx           # 개별 버스 노선 상세
│   ├── BusSchedulePage.tsx        # 버스 시간표
│   └── MyPage.tsx                 # 사용자 프로필/설정
│
├── components/
│   ├── Map/
│   │   └── MapView.tsx            # 네이버 지도 통합
│   ├── Station/
│   │   ├── StationPanel.tsx       # 바텀 시트 정류장 정보
│   │   ├── StationList.tsx        # 정류장 목록
│   │   ├── StationDetail.tsx      # 정류장 상세
│   │   └── SearchStationModal.tsx # 정류장 검색 모달
│   ├── SearchBar/                 # 검색 바 컴포넌트
│   └── common/                    # 공통 컴포넌트
│       ├── Button.tsx
│       ├── Text.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       └── Toast.tsx
│
├── api/
│   ├── apiClient.tsx              # Axios 설정
│   └── services/
│       ├── authService.tsx        # 인증 API
│       ├── userService.tsx        # 사용자 관리
│       ├── busService.tsx         # 버스 데이터 API
│       ├── stationService.tsx     # 정류장 API
│       ├── routeService.tsx       # 노선 API
│       └── websocketService.tsx   # WebSocket 클라이언트
│
├── store/                         # Zustand 스토어
│   ├── useBusStore.tsx           # 버스 위치 상태
│   ├── useBoardingStore.tsx      # 탑승 상태
│   ├── useSelectedStationStore.tsx
│   └── useModalStore.tsx
│
├── services/
│   └── globalWebSocketService.tsx # 글로벌 WebSocket 관리자
│
├── providers/
│   └── globalWebSocketProvider.tsx # WebSocket Context
│
└── theme/
    └── index.tsx                  # 디자인 시스템 테마
```

---

## 화면 구성

### 1. LoginPage
- Google OAuth2 인증
- 딥링크 지원
- 역할 기반 라우팅
- 토큰 영속성 (AsyncStorage)

### 2. EnterCodePage
- 게스트 사용자를 위한 조직 코드 입력
- 조직 연결

### 3. HomePage
**핵심 기능:**
- 버스 및 정류장 위치를 보여주는 네이버 지도
- WebSocket을 통한 실시간 버스 추적
- 자동 탑승 감지 (위치 기반, 10초마다)
- 즐겨찾기 정류장 관리
- 검색 기능
- 드래그 가능한 바텀 시트 정류장 패널
- 위치 추적 상태 표시
- 2시간 자동 추적 타이머

**주요 기능:**
- 위치정보 기반 자동 탑승 감지
- WebSocket 연결 상태 표시
- 실시간 버스 위치 업데이트
- 정류장 검색 모달
- 위치 권한 처리
- 추적 재시작 기능

### 4. RouteListPage
- 조직 내 모든 버스 노선 목록
- 노선별 정류장 수 표시
- 특정 노선의 BusListPage로 이동

### 5. BusListPage
**상세 기능:**
- 선택한 노선에서 운행 중인 모든 버스 표시
- 정류장별 도착 예정 시간 표시
- 버스 카드 정보:
  - 버스 표시 이름 (실제 번호 또는 가상 번호)
  - 현재 위치/다음 정류장
  - 좌석 가용성 (색상 코드가 있는 진행 막대)
  - 탑승 중인 버스에 "탑승중" 배지
- 정류장 타임라인 뷰:
  - 지나간/현재/다가오는 정류장 시각적 표시
  - 타임라인의 움직이는 버스 도트
  - 예상 도착 시간
- 필터링:
  - 운행 중인 버스만 표시 (operate: true)
  - 잘못된 좌표를 가진 버스 제외
- 지도 네비게이션이 있는 정류장 상세 모달

### 6. BusRoutePage
- 단일 버스 노선 상세 뷰
- 시각적 진행 상태가 있는 정류장 타임라인
- 현재 버스 위치 표시
- 다음 정류장 예상 도착 시간
- 좌석 점유 상태
- 사용자가 탑승 중이면 "탑승중" 배지
- 30초마다 실시간 업데이트

### 7. BusSchedulePage
- 버스 운행 스케줄
- 시간표 정보

### 8. MyPage
- 사용자 프로필 정보
- 설정 및 환경설정

---

## 핵심 컴포넌트

### MapView (`/src/components/Map/MapView.tsx`)
- 네이버 지도 통합
- 위치 추적이 있는 실시간 버스 마커
- 클릭 가능한 정류장 마커
- 탑승한 버스를 자동으로 카메라 추적
- 커스텀 버튼이 있는 사용자 위치 추적
- 권한 처리
- 마커 표시:
  - 버스 실제 번호 또는 가상 번호
  - 탑승 중인 버스에 "탑승중" 라벨
  - 탑승한 버스와 다른 버스의 다른 스타일링

### StationPanel (`/src/components/Station/StationPanel.tsx`)
- 3개의 스냅 포인트(상단, 중간, 하단)가 있는 드래그 가능한 바텀 시트
- 부드러운 패닝 애니메이션
- 즐겨찾기 정류장 또는 선택된 정류장 상세 표시
- 2초 쿨다운 타이머가 있는 뒤로가기 버튼
- PanResponder를 사용한 부드러운 제스처 처리

### StationDetail (`/src/components/Station/StationDetail.tsx`)
- 특정 정류장에 도착하는 버스 표시
- 실시간 도착 정보
- 즐겨찾기 토글 기능

### StationList (`/src/components/Station/StationList.tsx`)
- 사용자의 즐겨찾기 정류장 목록
- 정류장 상세로 빠른 접근

### SearchStationModal (`/src/components/Station/SearchStationModal.tsx`)
- 정류장 검색을 위한 전체 화면 모달
- 필터/검색 기능
- 빠른 즐겨찾기 관리

---

## 상태 관리

### Zustand 스토어

#### 1. useBusStore (`/src/store/useBusStore.tsx`)
```typescript
interface BusPosition {
  busNumber: string;
  busRealNumber: string | null;
  latitude: number;
  longitude: number;
  operate: boolean;
}
```
- 실시간 버스 위치 관리
- WebSocket을 통한 업데이트
- 운행 중인 버스만 필터링

#### 2. useBoardingStore (`/src/store/useBoardingStore.tsx`)
```typescript
interface BoardingState {
  boardedBusNumber: string | null;
  isBoarded: boolean;
  boardBus: (busNumber: string) => void;
  alightBus: () => void;
}
```
- 사용자의 탑승 상태 추적
- 자동 감지 또는 수동 동작으로 업데이트
- 시각적 표시기에 사용 (배지, 카메라 추적)

#### 3. useSelectedStationStore
- 현재 선택된 정류장 관리
- 지도 카메라 위치 조정에 사용
- MapView와 StationPanel 간 상태 공유

---

## API 서비스

### busService (`/src/api/services/busService.tsx`)
**주요 엔드포인트:**
- `getAllBuses()` - 모든 버스 조회
- `getOperatingBuses()` - 운행 중인 버스만 조회
- `getBusByNumber(busNumber)` - 특정 버스 조회
- `getBusByRealNumber(busRealNumber)` - 실제 번호로 조회
- `getBusSeats(busNumber)` - 좌석 가용성 조회
- `getBusLocation(busNumber)` - 버스 위치 조회
- `getBusStationsDetail(busNumber)` - 상태가 포함된 상세 정류장 목록 조회
- `processBusBoarding(data)` - 탑승/하차 처리
- `getArrivalEstimate(busId, stationId)` - 카카오 API 도착 예측

### stationService (`/src/api/services/stationService.tsx`)
- 정류장 CRUD 작업
- 위치 기반 쿼리

### routeService (`/src/api/services/routeService.tsx`)
- 노선 정보
- 노선-정류장 관계

### userService (`/src/api/services/userService.tsx`)
- 사용자 프로필 관리
- 즐겨찾기 정류장 관리 (`getMyStations`, `addMyStation`, `deleteMyStation`)

### authService (`/src/api/services/authService.tsx`)
- 인증
- 사용자 정보 조회
- 토큰 관리

---

## WebSocket 통합

### GlobalWebSocketService (`/src/services/globalWebSocketService.tsx`)
**싱글톤 서비스 관리:**
- `/ws/passenger`로의 지속적인 WebSocket 연결
- 위치 추적 (Geolocation.getCurrentPosition을 통해 10초마다)
- 지수 백오프를 사용한 자동 재연결
- 조직 채널 구독
- 실시간 버스 위치 업데이트
- 서버로부터 자동 탑승/하차 감지

**메시지 타입:**
- `busUpdate` - 실시간 버스 위치 업데이트
- `boarding_update` - 탑승 상태 변경 (탑승/하차)

**기능:**
- 백그라운드 위치 추적 (최대 2시간)
- 앱 상태 인식 (활성/백그라운드)
- 권한 처리
- 주기적인 전체 버스 목록 동기화 (60초마다)
- 탑승 이벤트에 대한 토스트 알림

### GlobalWebSocketProvider (`/src/providers/globalWebSocketProvider.tsx`)
- WebSocket 서비스를 위한 React Context 래퍼
- 연결 상태 관리
- 훅 제공: `useGlobalWebSocket()`
- 메서드: `restart()`, `ensureConnection()`

---

## 네비게이션 구조

```
Login → EnterCode (GUEST인 경우) → Home
     ↓
     → Home (USER/ADMIN인 경우)

Home에서:
  → RouteList → BusList → BusRoute
  → BusSchedule
  → MyPage
```

**네비게이션 타입:**
```typescript
type RootStackParamList = {
  Login: undefined;
  EnterCode: { token?: string };
  Loading: undefined;
  Home: { token?: string };
  BusDirection: undefined;
  BusList: { routeId: string; routeName: string };
  BusRoute: { busNumber: string };
  RouteList: undefined;
  MyPage: undefined;
  BusSchedule: undefined;
}
```

---

## 디자인 시스템

### 색상 팔레트
- **Primary:** 블루 톤 (#1971C2)
- **Gray Scale:** 50-900
- **System Colors:** success, warning, error, info

### 타이포그래피
- **Headings:** h1-h5
- **Text Sizes:** xl, lg, md, sm, xs
- **Font Weights:** regular, medium, semiBold, bold

### 간격
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48

### 그림자
- sm, md, lg, xl (elevation 지원)

### Border Radius
- xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999

---

## 특별한 기능

### 1. 자동 탑승 감지
- 10초마다 위치 추적
- 버스와의 근접 거리 기반 서버 측 감지
- 탑승/하차 감지 시 WebSocket 알림
- 토스트 알림
- 시각적 표시 (배지, 카메라 추적)
- 재시작 가능한 2시간 추적 윈도우

### 2. 실시간 업데이트
- 실시간 버스 위치를 위한 WebSocket
- 상세 뷰를 위한 30초 폴링
- 낙관적 UI 업데이트

### 3. 스마트 버스 표시 이름
- 가능한 경우 `busRealNumber` 표시 (실제 버스 번호)
- `busNumber`로 대체 (가상/시스템 번호)
- 부제목에 대체 번호 표시

### 4. 좌석 점유 시각화
- 색상 코드가 있는 진행 막대:
  - 녹색: < 70% (여유)
  - 노란색: 70-90% (보통)
  - 빨간색: > 90% (혼잡)

### 5. 타임라인 시각화
- 버스 노선을 위한 수직 타임라인
- 색상 표시: 회색 (다가오는), 녹색 (지나간), 파란색 (현재)
- 현재 위치의 버스 표시
- 정류장 사이를 이동하는 버스의 작은 도트

### 6. 위치 권한
- iOS: LOCATION_WHEN_IN_USE
- Android: ACCESS_FINE_LOCATION
- 기본 위치로 우아한 폴백

### 7. 인증 흐름
- InAppBrowser를 사용한 Google OAuth2
- 콜백을 위한 딥링크
- 역할 기반 라우팅
- 토큰 영속성

---

## 아키텍처 패턴

1. **Context + Singleton 패턴:** React Context 래퍼가 있는 싱글톤 WebSocket 서비스
2. **Zustand 상태 관리:** 경량, 간단한 상태 관리
3. **서비스 레이어:** UI와 API 로직의 명확한 분리
4. **TypeScript 인터페이스:** 전체에 걸친 강력한 타이핑
5. **커스텀 훅:** 재사용 가능한 로직
6. **모듈식 컴포넌트:** Atomic 디자인 원칙
7. **에러 바운더리:** 우아한 에러 처리
8. **로딩 상태:** 일관된 로딩 표시기
9. **낙관적 업데이트:** 즉각적인 UI 피드백
10. **디바운싱:** 검색 입력 최적화

---

## 설치 및 실행

### 사전 요구사항
- Node.js 18+
- React Native 개발 환경 설정
- iOS: Xcode 및 CocoaPods
- Android: Android Studio 및 JDK

### 설치
```bash
# 의존성 설치
npm install

# iOS 의존성 설치
cd ios && pod install && cd ..
```

### 실행
```bash
# iOS 실행
npm run ios

# Android 실행
npm run android

# 개발 서버 시작
npm start
```

---

## 환경 설정

### API Base URL
```typescript
const API_BASE_URL = 'http://devse.kr:12589'
```

### WebSocket URL
```
ws://devse.kr:12589/ws/passenger
```

---

## 주요 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| react-native | 0.78.0 | 코어 프레임워크 |
| react | 19.0.0 | UI 라이브러리 |
| @react-navigation/native | 6.0.8 | 네비게이션 |
| zustand | 5.0.2 | 상태 관리 |
| @mj-studio/react-native-naver-map | 2.3.0 | 네이버 지도 |
| axios | 1.7.9 | HTTP 클라이언트 |
| @react-native-community/geolocation | 3.4.0 | 위치 서비스 |
| @react-native-async-storage/async-storage | 2.0.0 | 로컬 저장소 |

---

## 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.

---

## 개발팀

BBB 앱 개발팀
