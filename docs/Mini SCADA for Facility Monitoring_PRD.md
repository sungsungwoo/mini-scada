# 📊 [PRD] Mini SCADA for Facility Monitoring v1.0

---

## 1. 서비스 개요 (Service Overview)

**1.1 서비스명:** Mini SCADA for Facility Monitoring
**1.2 서비스 타입:** 반응형 웹 기반 모니터링 시스템
**1.3 핵심 요약:** Modbus 기반 데이터 수집, TSDB 기반 대용량 데이터 처리, MQTT 기반 실시간 이벤트 전파를 결합한 산업용 설비 모니터링 SCADA 시스템

### **1.4 목적**

1. **기술적 측면:** 실시간 데이터 파이프라인의 A to Z(수집-저장-실시간 렌더링) 구축 및 산업용 프로토콜(Modbus) 제어 역량 증명
2. **사용자 측면:** 직관적인 실시간 대시보드를 통한 설비 상태 파악 및 즉각적인 이상 알람 제공
3. **운영 측면:** Docker Compose 기반의 One-Click 배포를 통한 인프라 구성 및 유지보수 효율성 극대화

---

## 2. 제품 범위 및 정책 (Scope & Policies)

### 2.1 타겟 사용자

* **운영자 (Operator):** 실시간 설비 상태 모니터링 및 알람 대응
* **관리자 (Admin):** 설비 네트워크 설정, 센서 맵핑, 임계값 및 데이터 정책 관리

---

### 2.2 MVP 범위

1. **사용자 기능:** 로그인, 대시보드(실시간 상태, 차트), 알람 이력
2. **관리자 기능:** 설비(Node) 관리, 센서(Tag) 메모리 맵 설정, 임계값 설정
3. **시스템 기능:**

   * Python 기반 가상 Modbus Simulator 연동
   * Spring Boot 스케줄러 기반 Polling 수집
   * TSDB 기반 시계열 데이터 저장
   * MQTT over WebSockets 기반 실시간 UI 렌더링

---

### 2.3 MVP 제외 범위

* 실제 PLC 장비 연동 (가상 시뮬레이터로 대체)
* 양방향 제어 로직
* AI 기반 이상 탐지 모델

---

## 3. 사용자 기능 명세

### 3.1 대시보드 (핵심 기능 ⭐️)

* **기능 요약:** 연결된 전체 설비의 상태를 1~5초 주기로 실시간 렌더링
* **표시 항목:**

  * 설비명
  * 실시간 센서 값 (온도/압력 등)
  * 네트워크 상태 (Online/Offline)
  * 알람 상태 (Normal/Warning/Critical)
  * 마지막 수신 시간 (last_seen)

---

### 3.2 설비 상세 화면

* **기능 요약:** 단일 설비의 시계열 트렌드 확인
* **구성:**

  * 실시간 게이지 차트
  * 최근 N시간 데이터 트렌드 라인 차트
  * 장애 이력 로그

---

### 3.3 실시간 알람 시스템

* **기능 요약:** 임계값 초과 및 통신 장애 시 즉각적인 시각적/청각적 알람
* **기능:**

  * 알람 발생 (Toast/팝업)
  * 알람 인지(Ack) 처리
  * 알람 발생 이력(History) 조회

---

## 4. 관리자 기능 명세

### 4.1 설비 네트워크 관리

* 설비 신규 등록 / 수정 / 삭제
* 통신 설정 (IP 주소, Port, Modbus Slave ID)
* Polling 주기 설정 (장비별 개별 설정, 1초~10초)

---

### 4.2 센서(Tag) 및 메모리 맵 설정

* 수집 대상 센서 정의 (예: 온도, 습도, RPM)
* Modbus Register 주소 매핑 (Address, Function Code)
* 데이터 타입 정의 (16-bit Integer, 32-bit Float 등 변환 로직용)

#### 데이터 모델 정의

```text
Device: 물리 설비 단위
Tag: 개별 센서 데이터 단위
```

---

### 4.3 알람 임계값 및 데이터 정책 설정

* Warning / Critical 구간 기준값 설정

#### 데이터 보존 정책

* 원본 데이터 보존 기간 설정
* Downsampling 주기 설정 (예: 10분 평균)

---

## 5. 시스템 핵심 로직 및 엣지 케이스

---

### 5.1 전체 데이터 흐름 구조 ⭐️

```text
수집: Modbus (Polling / Pull)
전파: MQTT (Event / Push)
저장: TSDB (Source of Truth)
```

---

### 5.2 데이터 수집 (Modbus Polling)

* `Spring Scheduler`를 이용하여 설정된 주기마다 비동기 스레드 풀에서 타겟 장비로 Modbus Request 발송

---

### 5.3 데이터 파이프라인 및 저장 (TSDB)

* 시계열 데이터 특성(고빈도 Insert, 시간 기반 조회 최적화)을 고려하여 TSDB 사용
* 백그라운드 배치를 통해 오래된 원천 데이터는 Downsampling 처리

#### TSDB 도입 이유

* 고빈도 데이터 삽입 성능 최적화
* 시간 기반 조회 성능 확보
* 장기 운영 시 저장 비용 최적화

---

### 5.4 실시간 이벤트 전파 (MQTT)

#### 역할 정의

* MQTT는 실시간 이벤트 전달 계층
* DB는 단일 진실 공급원(Source of Truth)

```text
MQTT ≠ 저장
MQTT = 이벤트 전달
DB = 데이터 저장
```

#### 동작 방식

* DB 저장 이후 MQTT Publish 수행
* 다수의 Subscriber가 동시에 데이터 수신

---

### 5.5 MQTT Topic 설계

```text
/scada/{deviceId}/{tag}
/scada/{deviceId}/status
/scada/alarm
```

---

### 5.6 Online / Offline 판단 로직

```text
last_seen > threshold → ONLINE
last_seen <= threshold → OFFLINE
```

---

### 5.7 알람 처리 로직

* 데이터 수집 시 임계값 비교
* 상태 변화 발생 시 알람 생성

---

### 5.8 예외 및 장애 처리 로직 (신뢰성) ⭐️

#### 네트워크 Timeout

* Modbus 응답이 설정된 타임아웃(예: 2초)을 초과하면 실패 처리
* 일정 횟수 누적 시 해당 설비 Offline 전환

#### UI 재연결

* MQTT WebSocket 끊김 시 자동 재연결 (Exponential Backoff)

---

## 6. 기술 스택 제안

* **Backend:** Java 17+, Spring Boot, Spring Data JPA
* **Frontend:** React, TypeScript, Recharts (또는 ECharts), MQTT.js
* **Database:** **TimescaleDB**
* **Messaging:** Eclipse Mosquitto
* **Simulator:** Python (`pymodbus`)
* **DevOps:** Docker & Docker Compose

---

## 7. 시스템 아키텍처

```text
┌───────────────── [Docker Compose Network Boundary] ─────────────────┐
│                                                                   │
│  [Python Modbus Simulator] ──(랜덤 센서 데이터 및 에러 모사)──┐        │
│                                                                   │
│                               ↓ (Modbus TCP / Port 502)           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     [Spring Boot SCADA 서버]                  │  │
│  │ 1. Modbus Polling (Scheduler + Async)                       │  │
│  │ 2. 임계값 비교 및 알람 판별                                     │  │
│  │ 3. 데이터 파싱 및 정제                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│           ↓ (JPA / JDBC)                      ↓ (MQTT Publish)    │
│           ↓                                   ↓                   │
│  ┌────────────────────┐              ┌───────────────────────┐    │
│  │   [TimescaleDB]    │  (Roll-up)   │  [Mosquitto Broker]   │    │
│  │ (시계열 데이터 저장)  │ <───────── │ (Topic: /scada/live)  │    │
│  └────────────────────┘              └───────────────────────┘    │
│                                               │                   │
└───────────────────────────────────────────────┼───────────────────┘
                                                │
                                                ↓ (MQTT over WebSockets)
                                                │
                                       ┌────────────────────┐
                                       │  [React Dashboard] │
                                       │ (실시간 UI 렌더링)   │
                                       └────────────────────┘
```

---

## 8. 성능 및 비기능 요구사항

### 성능

* 최대 50 Device / 500 Tag 기준
* 초당 500~1000 데이터 처리

---

### 실시간성

* 데이터 수집 주기: 1~5초
* UI 반영 지연: 1초 이내

---

### 가용성

* Docker Compose 기반 One-Click 실행

---

## 9. 성공 지표

* 실시간 데이터 반영 정확도
* 알람 감지 정확도
* Offline 판단 정확도
* UI 응답 속도
* MQTT/TSDB 설계 의사결정에 대한 기술적 설명 가능 여부

---