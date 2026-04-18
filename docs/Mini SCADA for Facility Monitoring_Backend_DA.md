# Mini SCADA 백엔드 개발환경 구조 (Directory Architecture)

## 문서 목적

- 아래 트리는 **구현 시 목표로 삼는 구조(Target layout)** 입니다.
- **빈자리 문서와의 차이:** 빈자리는 FastAPI + Alembic + Redis 중심 구조였지만, Mini SCADA는 **Spring Boot + TimescaleDB + MQTT + Modbus Polling** 중심 구조로 설계합니다.
- **빌드 도구:** Spring Boot 백엔드는 **Maven** 기준으로 구성하며, `pom.xml`, `mvnw`, `.mvn/wrapper`를 사용합니다.
- **DB 마이그레이션:** Spring Boot 기준으로 `Flyway`를 기본 전제로 두고, `src/main/resources/db/migration` 아래에 버전 파일을 관리합니다.
- **실시간 처리:** REST API와 MQTT 처리를 분리하여, 초기 화면 진입은 REST, 실시간 반영은 MQTT Publish/Subscribe 구조로 둡니다.
- **Polling / Parsing / Alarm / Realtime 전파**를 컨트롤러와 분리된 별도 계층으로 두어, SCADA 특유의 수집 파이프라인 로직이 API 계층과 섞이지 않도록 합니다.
- **Python Modbus Simulator / Mosquitto / TimescaleDB** 는 로컬 개발용 Docker Compose 스택에 함께 포함합니다.

---

```text
backend/
├── Dockerfile                         # Spring Boot 백엔드 개발/배포용 Docker 이미지 정의
├── docker-compose.dev.yml             # 로컬 개발용 전체 스택 (backend + timescaledb + mosquitto + simulator)
├── pom.xml                            # Maven 빌드 설정
├── mvnw                               # Maven Wrapper (Linux/Mac)
├── mvnw.cmd                           # Maven Wrapper (Windows)
├── .mvn/
│   └── wrapper/                       # Maven Wrapper 설정 파일
├── .env.example                       # 개발 환경변수 예시
├── README.md                          # 실행 방법, 로컬 개발 절차, 주요 명령어
│
├── infra/                             # 개발환경 보조 리소스
│   ├── mosquitto/
│   │   └── mosquitto.conf             # MQTT Broker 설정 (TCP 1883 및 WebSocket 9001 리스너 포함)
│   ├── timescaledb/
│   │   └── init/
│   │       └── 001_init_extensions.sql # TimescaleDB extension 초기화 SQL
│   └── simulator/
│       ├── Dockerfile                 # Python Modbus Simulator 이미지 정의
│       ├── requirements.txt           # pymodbus 등 simulator 의존성
│       └── app/
│           └── simulator.py           # 가상 설비 데이터/에러 모사용 Modbus 서버
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/miniscada/
│   │   │       ├── MiniScadaApplication.java   # Spring Boot 진입점
│   │   │       │
│   │   │       ├── config/                     # 공통 설정
│   │   │       │   ├── properties/             # application.yml 커스텀 속성 바인딩
│   │   │       │   │   ├── ModbusProperties.java
│   │   │       │   │   └── MqttProperties.java
│   │   │       │   ├── SecurityConfig.java     # 인증/인가 설정
│   │   │       │   ├── OpenApiConfig.java      # Swagger / OpenAPI 설정
│   │   │       │   ├── WebConfig.java          # CORS, Jackson, MVC 설정
│   │   │       │   ├── MqttConfig.java         # MQTT 클라이언트 / Publisher Bean 설정
│   │   │       │   ├── ModbusConfig.java       # Modbus Client / Timeout / Retry 관련 Bean 설정
│   │   │       │   ├── SchedulerConfig.java    # 스케줄러/비동기 Executor 설정
│   │   │       │   ├── DatabaseConfig.java     # DataSource / JPA / TimescaleDB 관련 설정
│   │   │       │   └── JacksonConfig.java      # JSON 직렬화/역직렬화 설정
│   │   │       │
│   │   │       ├── common/                     # 전역 공통 모듈
│   │   │       │   ├── code/
│   │   │       │   │   └── ErrorCode.java      # API 에러 코드 정의
│   │   │       │   ├── constant/
│   │   │       │   │   └── TopicNames.java     # MQTT Topic 상수
│   │   │       │   ├── dto/
│   │   │       │   │   ├── ApiResponse.java    # 공통 성공 응답 래퍼
│   │   │       │   │   ├── ErrorResponse.java  # 공통 실패 응답 래퍼
│   │   │       │   │   └── PageResponse.java   # 공통 페이지네이션 응답
│   │   │       │   ├── entity/
│   │   │       │   │   └── BaseTimeEntity.java # createdAt / updatedAt 공통 엔티티
│   │   │       │   ├── enums/
│   │   │       │   │   ├── UserRole.java
│   │   │       │   │   ├── DeviceStatus.java
│   │   │       │   │   ├── AlarmSeverity.java
│   │   │       │   │   ├── AlarmState.java
│   │   │       │   │   └── DataQuality.java
│   │   │       │   ├── exception/
│   │   │       │   │   ├── BusinessException.java
│   │   │       │   │   ├── NotFoundException.java
│   │   │       │   │   ├── ForbiddenException.java
│   │   │       │   │   └── GlobalExceptionHandler.java # 전역 예외 처리
│   │   │       │   └── util/
│   │   │       │       ├── TimeUtils.java      # UTC / timezone 변환 유틸
│   │   │       │       ├── JsonUtils.java      # JSON 변환 유틸
│   │   │       │       └── PaginationUtils.java
│   │   │       │
│   │   │       ├── auth/                       # 인증/인가 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   └── AuthController.java
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   └── LoginRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       ├── LoginResponse.java
│   │   │       │   │       └── MeResponse.java
│   │   │       │   ├── entity/
│   │   │       │   │   └── User.java
│   │   │       │   ├── repository/
│   │   │       │   │   └── UserRepository.java
│   │   │       │   ├── security/
│   │   │       │   │   ├── JwtTokenProvider.java
│   │   │       │   │   ├── JwtAuthenticationFilter.java
│   │   │       │   │   └── CustomUserDetailsService.java
│   │   │       │   └── service/
│   │   │       │       └── AuthService.java
│   │   │       │
│   │   │       ├── dashboard/                  # 대시보드 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   └── DashboardController.java
│   │   │       │   ├── dto/
│   │   │       │   │   └── response/
│   │   │       │   │       ├── DashboardOverviewResponse.java
│   │   │       │   │       ├── DashboardDeviceSummary.java
│   │   │       │   │       ├── ActiveAlarmSummary.java
│   │   │       │   │       └── SystemHealthSummaryResponse.java
│   │   │       │   └── service/
│   │   │       │       └── DashboardService.java
│   │   │       │
│   │   │       ├── device/                     # 설비(Device) 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   ├── DeviceQueryController.java     # 운영자용 설비 조회 API
│   │   │       │   │   └── AdminDeviceController.java     # 관리자용 설비 관리 API
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   ├── AdminDeviceCreateRequest.java
│   │   │       │   │   │   ├── AdminDeviceUpdateRequest.java
│   │   │       │   │   │   └── TestConnectionRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       ├── DeviceDetailResponse.java
│   │   │       │   │       ├── AdminDeviceResponse.java
│   │   │       │   │       └── TestConnectionResponse.java
│   │   │       │   ├── entity/
│   │   │       │   │   └── Device.java
│   │   │       │   ├── repository/
│   │   │       │   │   └── DeviceRepository.java
│   │   │       │   └── service/
│   │   │       │       ├── DeviceService.java
│   │   │       │       └── DeviceConnectionTestService.java
│   │   │       │
│   │   │       ├── tag/                        # Tag 및 임계값 통합 설정 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   └── AdminTagController.java
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   ├── TagCreateRequest.java
│   │   │       │   │   │   └── TagUpdateRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       └── TagResponse.java
│   │   │       │   ├── entity/
│   │   │       │   │   └── Tag.java
│   │   │       │   ├── repository/
│   │   │       │   │   └── TagRepository.java
│   │   │       │   └── service/
│   │   │       │       └── TagService.java
│   │   │       │
│   │   │       ├── alarm/                      # 알람 조회 / Ack 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   └── AlarmController.java
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   └── BulkAckRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       ├── AlarmListResponse.java
│   │   │       │   │       ├── AlarmDetailResponse.java
│   │   │       │   │       ├── AckAlarmResponse.java
│   │   │       │   │       └── BulkAckResponse.java
│   │   │       │   ├── entity/
│   │   │       │   │   └── Alarm.java
│   │   │       │   ├── repository/
│   │   │       │   │   └── AlarmRepository.java
│   │   │       │   └── service/
│   │   │       │       └── AlarmService.java
│   │   │       │
│   │   │       ├── policy/                     # 전역 데이터 정책 도메인
│   │   │       │   ├── controller/
│   │   │       │   │   └── DataPolicyController.java
│   │   │       │   ├── dto/
│   │   │       │   │   ├── request/
│   │   │       │   │   │   └── DataPolicyUpdateRequest.java
│   │   │       │   │   └── response/
│   │   │       │   │       └── DataPolicyResponse.java
│   │   │       │   ├── entity/
│   │   │       │   │   └── DataPolicy.java
│   │   │       │   ├── repository/
│   │   │       │   │   └── DataPolicyRepository.java
│   │   │       │   └── service/
│   │   │       │       └── DataPolicyService.java
│   │   │       │
│   │   │       ├── timeseries/                 # 시계열 조회/저장 도메인
│   │   │       │   ├── dto/
│   │   │       │   │   └── response/
│   │   │       │   │       ├── TimeseriesPointResponse.java
│   │   │       │   │       └── TimeseriesSeriesResponse.java
│   │   │       │   ├── repository/
│   │   │       │   │   ├── TimeseriesQueryRepository.java # native query / projection 중심
│   │   │       │   │   └── TimeseriesSaveRepository.java  # 시계열 데이터 고속 Insert (JdbcTemplate 등 활용)
│   │   │       │   └── service/
│   │   │       │       ├── TimeseriesQueryService.java    # 대시보드 및 상세 화면 조회용
│   │   │       │       └── TimeseriesSaveService.java     # Polling 파이프라인에서 호출되는 저장 로직
│   │   │       │
│   │   │       ├── polling/                    # Modbus Polling 파이프라인
│   │   │       │   ├── client/
│   │   │       │   │   └── ModbusPollingClient.java       # Modbus TCP 요청/응답
│   │   │       │   ├── dto/
│   │   │       │   │   └── PollingResult.java
│   │   │       │   ├── parser/
│   │   │       │   │   └── ModbusValueParser.java         # INT16/FLOAT32/ByteSwap/WordSwap 처리
│   │   │       │   ├── scheduler/
│   │   │       │   │   └── DevicePollingScheduler.java    # 주기적 Polling 실행
│   │   │       │   └── service/
│   │   │       │       ├── PollingOrchestrator.java       # 설비별 Polling 총괄
│   │   │       │       ├── DeviceStatusEvaluator.java     # last_seen 기반 Online/Offline 판단
│   │   │       │       └── AlarmEvaluationService.java    # 임계값/Deadband 비교
│   │   │       │
│   │   │       ├── realtime/                   # MQTT / bootstrap / 상태 전파
│   │   │       │   ├── controller/
│   │   │       │   │   └── RealtimeController.java       # /realtime/bootstrap
│   │   │       │   ├── dto/
│   │   │       │   │   └── response/
│   │   │       │   │       └── RealtimeBootstrapResponse.java
│   │   │       │   ├── publisher/
│   │   │       │   │   └── MqttEventPublisher.java       # topic publish
│   │   │       │   └── service/
│   │   │       │       └── RealtimeBootstrapService.java
│   │   │       │
│   │   │       └── health/                     # 선택 기능: System Health
│   │   │           ├── controller/
│   │   │           │   └── SystemHealthController.java
│   │   │           └── service/
│   │   │               └── SystemHealthService.java
│   │   │
│   │   └── resources/
│   │       ├── application.yml                 # 공통 설정
│   │       ├── application-local.yml           # 로컬 개발 설정
│   │       ├── application-docker.yml          # Docker 실행 설정
│   │       ├── application-test.yml            # 테스트 실행 설정
│   │       ├── logback-spring.xml              # 로그 설정
│   │       └── db/
│   │           └── migration/                  # Flyway 마이그레이션 파일
│   │               ├── V1__init_schema.sql
│   │               ├── V2__create_timeseries_tables.sql    # 일반 테이블 생성 및 create_hypertable() 적용
│   │               ├── V3__create_alarm_tables.sql
│   │               └── V4__seed_default_policy.sql
│   │
│   └── test/
│       └── java/
│           └── com/example/miniscada/
│               ├── auth/AuthControllerTest.java
│               ├── dashboard/DashboardControllerTest.java
│               ├── device/DeviceControllerTest.java
│               ├── alarm/AlarmControllerTest.java
│               ├── tag/AdminTagControllerTest.java
│               ├── policy/DataPolicyControllerTest.java
│               ├── realtime/RealtimeControllerTest.java
│               ├── polling/AlarmEvaluationServiceTest.java
│               ├── polling/DevicePollingSchedulerTest.java
│               └── integration/
│                   ├── DevicePollingIntegrationTest.java
│                   ├── MqttPublishIntegrationTest.java
│                   └── TimeseriesQueryIntegrationTest.java
│
└── scripts/
    ├── run-local.sh                    # 로컬 개발 실행
    ├── run-docker.sh                   # docker-compose.dev.yml 실행
    ├── migrate.sh                      # Flyway 마이그레이션 실행
    └── seed-demo-data.sh               # 데모용 설비/Tag/정책 초기 데이터 적재
```
---

## 구조 설계 메모

### 1. 도메인 기준 + 기술 파이프라인 기준을 함께 사용

Mini SCADA는 일반 CRUD 서비스와 달리
**API 계층(대시보드, 설비, 알람)** 과
**수집 파이프라인 계층(Polling, Parsing, Alarm Evaluation, MQTT Publish)** 가 동시에 중요하다.
그래서 `device`, `tag`, `alarm`, `policy` 같은 도메인 패키지와 별도로 `polling`, `realtime`, `timeseries`를 분리하는 편이 유지보수에 유리하다.

### 2. Tag와 임계값은 하나의 서비스 흐름으로 관리

IA와 API 유스케이스 문서에서 **Tag 설정과 알람 임계값 설정을 통합**했기 때문에, 백엔드 구조도 `tag/` 도메인 안에서 메모리 맵과 임계값 저장을 함께 처리하는 방식이 자연스럽다.

### 3. 실시간 구조는 REST와 MQTT를 분리

초기 화면 진입과 재연결 복구는 REST bootstrap API가 담당하고,
실시간 상태 변경 이벤트는 MQTT Topic(`/scada/{deviceId}/status`, `/scada/{deviceId}/{tag}`, `/scada/alarm`)로 전파하는 구조가 PRD 및 유스케이스와 일치한다. 따라서 `realtime/controller`와 `realtime/publisher`를 분리한다.

### 4. 개발환경은 backend 단독이 아니라 infra 포함이 중요

Mini SCADA는 백엔드만 띄운다고 동작하는 구조가 아니라,
**TimescaleDB + Mosquitto + Python Modbus Simulator** 가 함께 떠야 진짜 개발/테스트가 가능하다.
그래서 `docker-compose.dev.yml` 과 `infra/` 디렉터리를 백엔드 구조 안에 함께 두는 게 개발환경 문서로서 더 실용적이다. 

### 5. 처음에는 단순하게 시작하고, 이후 분리 가능

초기에는 `device`, `tag`, `alarm`의 entity/dto/service 수를 줄여 단순하게 시작해도 괜찮다.
다만 문서상 목표 구조는 위처럼 잡아두는 편이, 기능이 늘어나도 무너지지 않는다.

---

## 인증 · 리프레시 세션 (Access / Refresh / 슬라이딩)

### 정책 요약

| 항목 | 기본값 | 설명 |
|------|--------|------|
| Access token (JWT) | 1시간 | `Authorization: Bearer`. 클레임 `sid`로 서버 세션 행과 연결. |
| Refresh token | HttpOnly 쿠키 `mini_scada_refresh` | DB에는 SHA-256 해시만 저장. 성공 시 로테이션되며 `refresh_expires_at`이 연장됨. |
| 유휴 (idle) | 1시간 | `last_activity_at` 기준. 이 시간을 넘기면 `POST /api/v1/auth/refresh`가 거부된다. |
| 절대 만료 | 로그인(또는 회원가입) 시점 + 24시간 | `absolute_expires_at`은 갱신되지 않음. |
| 활동 반영 | 인증된 API 요청마다 | JWT 검증 후 `auth_sessions.last_activity_at` 갱신. |

### 저장소

- 테이블 `auth_sessions` (Flyway `V11__auth_sessions.sql`): `user_id`, `refresh_token_hash`, `last_activity_at`, `absolute_expires_at`, `refresh_expires_at`.

### 엔드포인트

- `POST /api/v1/auth/login`, `/register`: 응답 본문에 `accessToken`, `Set-Cookie`에 refresh.
- `POST /api/v1/auth/refresh`: 쿠키만으로 새 access + refresh 로테이션 (본문 동일 형식).
- `POST /api/v1/auth/logout`: 선택적으로 `Authorization`으로 세션 행 삭제 + 쿠키 무효화.

### 설정 키 (`application.yml`)

- `app.jwt.expiration-ms`: 액세스 JWT TTL.
- `app.auth-session.idle-timeout-ms`, `absolute-max-ms`, `refresh-expiration-ms`.
- `app.auth-cookie.secure`, `app.auth-cookie.same-site`: 프로덕션 HTTPS·크로스 사이트 시 `secure: true`, 필요 시 `SameSite=None`.

### 프론트엔드

- 모든 API `fetch`에 `credentials: 'include'` (쿠키 전송).
- 401 시 `/auth/login`·`/register` 제외하고 `POST /auth/refresh` 한 번 재시도 후 원 요청 재실행.

통합 테스트(`MiniScadaApiIntegrationTest`)는 Testcontainers(PostgreSQL/Timescale)가 있을 때만 실행되며, 로그인 → 리프레시 → 유휴 시 리프레시 거부 시나리오를 포함한다.

---