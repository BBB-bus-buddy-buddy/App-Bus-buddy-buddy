# CoShow 부스 이벤트 기능 - 설정 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [설치 방법](#설치-방법)
3. [데이터베이스 설정](#데이터베이스-설정)
4. [백엔드 설정](#백엔드-설정)
5. [프론트엔드 설정](#프론트엔드-설정)
6. [테스트 방법](#테스트-방법)

---

## 🎯 프로젝트 개요

CoShow 부스 참여자를 위한 미션 기반 랜덤 뽑기 이벤트 시스템입니다.

### 주요 기능
- ✅ **3가지 미션 타입**: 특정 버스 탑승, 특정 정류장 방문, 자동 승하차 감지
- 🎁 **5등급 상품 시스템**: 1등(5%) ~ 5등(50%) 확률 기반 랜덤 뽑기
- 🎨 **화려한 애니메이션**: 3초 대기 + 랜덤박스 오픈 이펙트
- 🔒 **중복 방지**: 1인 1회 제한
- 📊 **실시간 재고 관리**: 상품 수량 자동 감소

---

## 📦 설치 방법

### 1. 프론트엔드 (React Native)

```bash
cd __BBBApp

# 의존성 설치
npm install

# iOS 추가 설정
cd ios
pod install
cd ..

# 실행
npm run ios
# 또는
npm run android
```

### 2. 백엔드 (Spring Boot)

```bash
cd _AppBackendBBB

# Gradle 빌드
./gradlew clean build

# 실행
./gradlew bootRun
```

---

## 🗄️ 데이터베이스 설정

### MongoDB 샘플 데이터 삽입

MongoDB에 접속하여 아래 샘플 데이터를 삽입합니다.

#### 1. 이벤트 생성

```javascript
db.events.insertOne({
  "name": "CoShow 2024 부스 이벤트",
  "description": "부스 방문 미션을 완료하고 경품을 받으세요!",
  "startDate": new Date("2024-01-01T00:00:00Z"),
  "endDate": new Date("2024-12-31T23:59:59Z"),
  "isActive": true,
  "organizationId": "YOUR_ORGANIZATION_ID", // 실제 조직 ID로 변경
  "createdAt": new Date(),
  "updatedAt": new Date()
});
```

이벤트 ID를 복사해둡니다. (예: `EVENT_ID`)

#### 2. 미션 생성

```javascript
// 미션 1: 특정 버스 탑승
db.event_missions.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "title": "1번 버스 탑승하기",
  "description": "1번 노선 버스에 탑승하세요",
  "missionType": "BOARDING",
  "targetValue": "1", // busNumber
  "isRequired": true,
  "order": 1,
  "createdAt": new Date()
});

// 미션 2: 특정 정류장 방문
db.event_missions.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "title": "중앙 정류장 방문하기",
  "description": "중앙 정류장을 방문하세요",
  "missionType": "VISIT_STATION",
  "targetValue": "STATION_ID", // 실제 정류장 ID로 변경
  "isRequired": true,
  "order": 2,
  "createdAt": new Date()
});

// 미션 3: 자동 승하차 감지
db.event_missions.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "title": "자동 승하차 감지 체험",
  "description": "앱의 자동 승하차 감지 기능을 체험하세요",
  "missionType": "AUTO_DETECT_BOARDING",
  "targetValue": null,
  "isRequired": true,
  "order": 3,
  "createdAt": new Date()
});
```

#### 3. 상품 생성

```javascript
// 1등상: 에어팟 프로
db.event_rewards.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "rewardName": "에어팟 프로",
  "rewardGrade": 1,
  "probability": 0.05, // 5%
  "totalQuantity": 10,
  "remainingQuantity": 10,
  "imageUrl": "",
  "description": "애플 에어팟 프로 (최신형)",
  "createdAt": new Date(),
  "updatedAt": new Date()
});

// 2등상: 스타벅스 기프티콘 (5만원)
db.event_rewards.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "rewardName": "스타벅스 기프티콘 (5만원)",
  "rewardGrade": 2,
  "probability": 0.10, // 10%
  "totalQuantity": 20,
  "remainingQuantity": 20,
  "imageUrl": "",
  "description": "스타벅스 기프티콘 5만원권",
  "createdAt": new Date(),
  "updatedAt": new Date()
});

// 3등상: 편의점 기프티콘 (2만원)
db.event_rewards.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "rewardName": "편의점 기프티콘 (2만원)",
  "rewardGrade": 3,
  "probability": 0.15, // 15%
  "totalQuantity": 30,
  "remainingQuantity": 30,
  "imageUrl": "",
  "description": "GS25/CU 기프티콘 2만원권",
  "createdAt": new Date(),
  "updatedAt": new Date()
});

// 4등상: 카페 아메리카노 쿠폰
db.event_rewards.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "rewardName": "카페 아메리카노 쿠폰",
  "rewardGrade": 4,
  "probability": 0.20, // 20%
  "totalQuantity": 50,
  "remainingQuantity": 50,
  "imageUrl": "",
  "description": "스타벅스/투썸플레이스 아메리카노",
  "createdAt": new Date(),
  "updatedAt": new Date()
});

// 5등상: 부스 기념품
db.event_rewards.insertOne({
  "eventId": DBRef("events", ObjectId("EVENT_ID")),
  "rewardName": "부스 기념품",
  "rewardGrade": 5,
  "probability": 0.50, // 50%
  "totalQuantity": 100,
  "remainingQuantity": 100,
  "imageUrl": "",
  "description": "CoShow 2024 기념 굿즈",
  "createdAt": new Date(),
  "updatedAt": new Date()
});
```

---

## ⚙️ 백엔드 설정

### 1. application.properties 확인

```properties
# MongoDB 설정
spring.data.mongodb.uri=mongodb://localhost:27017
spring.data.mongodb.database=bustracker

# 서버 포트
server.port=8088

# OAuth2 설정 (기존 설정 유지)
spring.security.oauth2.client.registration.google.client-id=${OAUTH_CLIENT_ID}
spring.security.oauth2.client.registration.google.client-secret=${OAUTH_SECRET_KEY}
```

### 2. Swagger API 문서 확인

서버 실행 후 아래 URL에서 API 문서 확인:
```
http://localhost:8088/swagger-ui.html
```

### 3. API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/event/current` | 현재 진행 중인 이벤트 조회 |
| GET | `/api/event/{eventId}/missions` | 미션 목록 조회 |
| GET | `/api/event/{eventId}/rewards` | 상품 목록 조회 |
| POST | `/api/event/complete-mission` | 미션 완료 처리 |
| POST | `/api/event/{eventId}/draw-reward` | 랜덤 뽑기 실행 |
| GET | `/api/event/{eventId}/my-participation` | 내 참여 현황 조회 |

---

## 📱 프론트엔드 설정

### 1. 이벤트 페이지 접근

앱 실행 후 아래 방법으로 이벤트 페이지 접근:

```typescript
// 네비게이션 사용 예시
navigation.navigate('Event');
```

### 2. 애니메이션 라이브러리 확인

package.json에 다음 라이브러리가 추가되었는지 확인:

```json
{
  "dependencies": {
    "react-native-reanimated": "^3.16.5",
    "lottie-react-native": "^7.2.0",
    "react-native-confetti-cannon": "^1.5.2",
    "react-native-linear-gradient": "^2.8.3"
  }
}
```

### 3. iOS 추가 설정 (Reanimated)

`ios/Podfile`에 다음 추가:

```ruby
# Reanimated 설정
post_install do |installer|
  react_native_post_install(installer)
  __apply_Xcode_12_5_M1_post_install_workaround(installer)
end
```

`babel.config.js`에 플러그인 추가:

```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin', // 추가
  ],
};
```

---

## 🧪 테스트 방법

### 1. 백엔드 API 테스트

#### Postman 또는 curl 사용:

```bash
# 1. 현재 이벤트 조회
curl -X GET http://localhost:8088/api/event/current \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. 미션 완료
curl -X POST http://localhost:8088/api/event/complete-mission \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "EVENT_ID",
    "missionId": "MISSION_ID",
    "targetValue": "1"
  }'

# 3. 랜덤 뽑기
curl -X POST http://localhost:8088/api/event/EVENT_ID/draw-reward \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. 프론트엔드 테스트

#### 시나리오:

1. **이벤트 페이지 진입**
   - 앱 실행 → 이벤트 메뉴 클릭
   - 현재 이벤트 정보, 미션 목록, 상품 목록 확인

2. **미션 완료**
   - 자동 승하차 감지: 버스 탑승 시 자동 완료
   - 특정 버스 탑승: 해당 버스 탑승
   - 특정 정류장 방문: 해당 정류장 근처 방문

3. **뽑기 실행**
   - 모든 미션 완료 후 "행운의 뽑기 시작!" 버튼 클릭
   - 3초 대기 애니메이션 확인
   - 박스 오픈 + Confetti 효과 확인
   - 당첨 상품 확인

### 3. 확률 검증 (개발자 도구)

```javascript
// 100회 뽑기 시뮬레이션
const rewards = [
  { grade: 1, prob: 0.05 },
  { grade: 2, prob: 0.10 },
  { grade: 3, prob: 0.15 },
  { grade: 4, prob: 0.20 },
  { grade: 5, prob: 0.50 },
];

let counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

for (let i = 0; i < 100; i++) {
  const random = Math.random();
  let cumulative = 0;
  for (const reward of rewards) {
    cumulative += reward.prob;
    if (random <= cumulative) {
      counts[reward.grade]++;
      break;
    }
  }
}

console.log('100회 뽑기 결과:', counts);
// 예상: {1: ~5, 2: ~10, 3: ~15, 4: ~20, 5: ~50}
```

---

## 🎨 랜덤박스 애니메이션 상세

### 애니메이션 시퀀스 (총 3.3초)

1. **Phase 1: 박스 등장 (0.5초)**
   - Scale 0 → 1 (Spring 애니메이션)
   - Fade In

2. **Phase 2: 긴장감 조성 (2초)**
   - 좌우 흔들림 (Shake)
   - 펄스 효과 (Scale 1.0 ↔ 1.1)
   - 반짝임 (Sparkle)
   - 회전 (360도)

3. **Phase 3: 박스 오픈 (0.5초)**
   - 뚜껑 위로 날아감
   - 상품 튀어나옴 (Spring)
   - Confetti 발사 (200개)

4. **Phase 4: 결과 표시 (0.3초~)**
   - 등급 배지 표시
   - 축하 메시지
   - 상품 정보 카드

---

## 🔧 커스터마이징 가이드

### 1. 미션 타입 추가

`EventMission.java`에 새로운 MissionType 추가:

```java
public enum MissionType {
    BOARDING,
    VISIT_STATION,
    AUTO_DETECT_BOARDING,
    YOUR_NEW_TYPE // 추가
}
```

### 2. 상품 등급 변경

현재 1~5등급. 등급 수 변경하려면:
- `EventReward` entity
- `RewardDrawPage` 등급별 색상 함수 수정
- 확률 재조정

### 3. 확률 변경

MongoDB에서 직접 수정:

```javascript
db.event_rewards.updateOne(
  { _id: ObjectId("REWARD_ID") },
  { $set: { probability: 0.10 } } // 10%로 변경
);
```

**⚠️ 주의: 모든 상품의 확률 합이 1.0 (100%)이 되도록 조정**

---

## 📊 모니터링

### 1. 이벤트 통계 조회

```javascript
// MongoDB 쿼리
db.event_participations.aggregate([
  {
    $match: {
      "eventId.$id": ObjectId("EVENT_ID")
    }
  },
  {
    $group: {
      _id: "$drawnRewardId.$id",
      count: { $sum: 1 }
    }
  }
]);
```

### 2. 로그 확인

백엔드 로그:
```
🎉 [EventService] 뽑기 완료: userId=123, reward=에어팟 프로 (1등)
```

프론트엔드 로그:
```
🎁 [EventState] 상품 목록 설정: 5개
📋 [EventState] 미션 목록 설정: 3개
```

---

## 🐛 트러블슈팅

### 문제 1: 이벤트 조회 실패

**원인**: organizationId 불일치

**해결**:
```javascript
// MongoDB에서 organization ID 확인
db.events.find().pretty();
```

### 문제 2: 뽑기 버튼 비활성화

**원인**: 미션 완료 상태 동기화 안됨

**해결**:
```javascript
// 참여 현황 재조회
await loadEventData();
```

### 문제 3: 애니메이션 작동 안함

**원인**: Reanimated 설정 누락

**해결**:
```bash
# iOS
cd ios && pod install && cd ..

# babel.config.js 확인
# 앱 재시작
```

---

## 📝 참고사항

1. **중복 방지**: 한 사용자당 1회만 뽑기 가능 (hasDrawn 체크)
2. **재고 관리**: 상품 재고가 0이 되면 자동으로 제외
3. **미션 순서**: order 필드로 UI 표시 순서 결정
4. **필수 미션**: isRequired=true인 미션만 완료해도 뽑기 가능

---

## 🎯 다음 단계

1. ✅ 이벤트 데이터 DB에 삽입
2. ✅ 백엔드 서버 실행
3. ✅ 프론트엔드 앱 실행
4. ✅ 테스트 진행
5. 🚀 CoShow 부스 전시!

---

**문의사항이 있으시면 개발팀에 연락주세요!** 🎉
