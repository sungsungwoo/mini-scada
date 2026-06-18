# Mini SCADA for Facility Monitoring

<p align="center">
  <img src="https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?style=flat-square&logo=springboot&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TimescaleDB-2.14-FDB515?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/MQTT-Mosquitto_2-660066?style=flat-square&logo=eclipse-mosquitto&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=flat-square&logo=nginx&logoColor=white" />
</p>

<p align="center">
  Modbus TCP 수집 · TimescaleDB 시계열 저장 · MQTT 실시간 푸시를 결합한 설비 모니터링 시스템
</p>

<p align="center">
  <strong>Live Demo:</strong> <a href="https://scada.swsung72.site">https://scada.swsung72.site</a>
  &nbsp;|&nbsp;
  <strong>API Docs:</strong> <a href="https://scada.swsung72.site/swagger-ui.html">Swagger UI</a>
</p>

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [데이터 흐름](#데이터-흐름)
- [기술 스택](#기술-스택)
- [데이터베이스 구조](#데이터베이스-구조)
- [설계 포인트](#설계-포인트)
- [로컬 개발 환경 실행](#로컬-개발-환경-실행)
- [프로젝트 구조](#프로젝트-구조)
- [API 엔드포인트](#api-엔드포인트)
- [환경 변수](#환경-변수)
- [배포 구조](#배포-구조)
- [데모 계정](#데모-계정)
- [문서](#문서)

---

## 프로젝트 개요

**Mini SCADA for Facility Monitoring**은 산업 현장의 설비 상태를 원격으로 모니터링하는 **포트폴리오용 SCADA(Supervisory Control and Data Acquisition) 시스템**입니다.

실제 PLC 대신 **Python Modbus TCP 시뮬레이터**로 3대의 가상 설비(`BOILER-01`, `CHILLER-01`, `CHILLER-02`)를 에뮬레이션합니다. 백엔드는 Modbus TCP로 설비 데이터를 주기적으로 수집하고, TimescaleDB에 시계열 데이터로 저장한 뒤 MQTT over WebSocket을 통해 브라우저에 실시간으로 전달합니다.

```text
Modbus TCP polling
  → TimescaleDB hypertable 저장
  → MQTT broker publish
  → React dashboard 실시간 렌더링
```

### 프로젝트 목표

| 관점 | 목표 |
|---|---|
| 기술적 | 수집 → 저장 → 실시간 푸시 → 시각화까지 이어지는 데이터 파이프라인 구현 |
| 백엔드 | Modbus TCP, MQTT, 시계열 DB, 알람 처리, 데이터 보존 정책 등 운영형 서버 기능 구현 |
| 사용자 | 설비 상태, 센서값, 알람을 직관적으로 확인할 수 있는 실시간 대시보드 제공 |
| 운영 | Docker Compose 기반 배포 구조와 Nginx Reverse Proxy를 통한 서비스 운영 |

---

## 주요 기능

### 실시간 모니터링 대시보드

- 연결된 전체 설비의 상태를 **1~5초 주기**로 실시간 표시
- 설비별 온도·압력 등 센서값, 네트워크 상태, 알람 상태 표시
- MQTT over WebSocket 기반 실시간 데이터 수신

### 설비 상세 및 트렌드 차트

- 단일 설비의 현재 태그값 조회
- 최근 시계열 데이터 기반 트렌드 차트 제공
- TimescaleDB 연속 집계를 활용한 장기 데이터 조회 구조
- 장애 이벤트 및 알람 이력 확인

### 알람 관리

- 임계값 초과 및 통신 장애 시 자동 알람 생성
- 알람 심각도 구분: `NORMAL`, `WARNING`, `CRITICAL`
- 알람 개별 확인 및 일괄 확인 처리
- 기간, 심각도, 설비 기준 필터링

### 관리자 기능

- 설비 정보 관리: IP/Host, Port, Slave ID, 폴링 주기
- 태그 정보 관리: Function Code, Register Address, Data Type, 임계값, Deadband
- 설비 연결 테스트
- 설정 변경 이력 관리
- 전역 데이터 보존 정책 관리

### 인증 및 권한

- JWT Access Token + HTTP-only Refresh Token 기반 인증
- RBAC 기반 역할 분리: `ADMIN`, `OPERATOR`
- 401 응답 시 토큰 갱신 및 세션 만료 처리

---

## 시스템 아키텍처

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  React 19 + TypeScript + Tailwind CSS                           │
│                                                                 │
│  REST API 호출                         MQTT over WebSocket       │
└──────────┬──────────────────────────────────────┬───────────────┘
           │ HTTPS /api/*                         │ WSS /mqtt
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Host Nginx Reverse Proxy                      │
│                    scada.swsung72.site                           │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
           ▼                                      ▼
┌─────────────────────┐              ┌────────────────────────────┐
│ Spring Boot Backend │              │ Eclipse Mosquitto MQTT      │
│ Java 17 / Maven     │              │ TCP 1883 / WebSocket 9001   │
│                     │              └──────────────▲─────────────┘
│ Modbus Polling      │                             │ publish
│ REST API            │                             │
│ Alarm Processing    │                             │
│ Retention Scheduler │                             │
└──────────┬──────────┘                             │
           │ Modbus TCP                             │
           ▼                                        │
┌─────────────────────┐                             │
│ Python Modbus       │                             │
│ Simulator           │                             │
│ BOILER / CHILLER    │                             │
└─────────────────────┘                             │
           │                                        │
           ▼                                        │
┌────────────────────────────────────────────────────┘
│ TimescaleDB PostgreSQL
│ hypertable / continuous aggregate / retention policy
└────────────────────────────────────────────────────
```

---

## 데이터 흐름

1. **Modbus 폴링**
   - `DevicePollingScheduler`가 설비별 폴링 주기에 따라 Modbus TCP 요청을 전송합니다.

2. **시계열 저장**
   - 수신한 레지스터 값을 데이터 타입에 맞게 파싱합니다.
   - 원본 데이터는 `tag_readings` hypertable에 저장합니다.
   - 최신값은 `device_tag_latest`에 갱신합니다.

3. **알람 판정**
   - 태그별 임계값과 Deadband 기준으로 `WARNING`, `CRITICAL` 상태를 판단합니다.
   - 알람 발생 및 해제 이벤트를 저장합니다.

4. **MQTT 발행**
   - 저장 및 알람 판정 후 설비 상태와 태그값을 MQTT topic으로 발행합니다.

5. **브라우저 실시간 표시**
   - 프론트엔드의 `useScadaMqtt` 훅이 MQTT 메시지를 수신하여 화면 상태를 갱신합니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript 5, Vite, Tailwind CSS, React Router, mqtt.js |
| Backend | Spring Boot 3.3, Spring Security 6, Spring Data JPA, Spring Integration MQTT |
| Protocol | Modbus TCP, MQTT over WebSocket |
| Database | PostgreSQL 15 + TimescaleDB 2.14 |
| Migration | Flyway |
| Simulator | Python 3, pymodbus |
| API Docs | springdoc-openapi, Swagger UI |
| Test | JUnit 5, Testcontainers |
| Infra | Docker Compose, Host Nginx, Certbot |

---

## 데이터베이스 구조

TimescaleDB(PostgreSQL 확장)를 사용하며, Flyway 마이그레이션으로 스키마를 관리합니다.

```text
users ──── user_roles ──── roles
  │
  └──────── auth_sessions

device_groups ──── devices ──── device_tags ──── device_tag_latest
                     │               │
                     │               ├──── tag_readings          (hypertable)
                     │               ├──── tag_readings_10m      (continuous aggregate)
                     │               └──── alarms ──── alarm_events
                     │
                     ├──── device_change_logs
                     └──── polling_logs

system_data_policy  (전역 데이터 보존 정책)
```

### TimescaleDB 적용 포인트

- `tag_readings`: 원본 시계열 데이터 hypertable
- `tag_readings_10m`: 10분 단위 연속 집계 데이터
- 데이터 보존 정책에 따라 오래된 원본/집계 데이터 자동 정리
- 시계열 조회 성능을 고려한 hypertable 및 time bucket 구조 적용

자세한 ERD는 [`docs/ERD.md`](docs/ERD.md)를 참고하세요.

---

## 설계 포인트

- Docker Compose 내부 DNS를 활용하여 서비스 간 통신을 구성했습니다.
- Modbus TCP 수집, TimescaleDB 저장, MQTT 실시간 발행을 독립된 계층으로 분리했습니다.
- 최신값 테이블과 원본 시계열 테이블을 분리하여 대시보드 조회 성능을 확보했습니다.
- TimescaleDB retention policy와 별도 스케줄러를 통해 장기 운영 시 데이터 증가를 제어합니다.
- MQTT over WebSocket을 사용하여 브라우저에서 실시간 설비 데이터를 직접 수신할 수 있도록 구성했습니다.
- 장비 설정 변경 이력을 남겨 운영 환경에서의 추적성을 확보했습니다.

---

## 로컬 개발 환경 실행

### 사전 요구사항

- Docker Desktop 또는 Docker Engine
- Docker Compose
- Git

### 1. 저장소 클론

```bash
git clone https://github.com/<your-username>/mini-scada.git
cd mini-scada
```

### 2. 환경 변수 설정

공개 저장소에는 실제 운영용 `.env` 파일을 포함하지 않습니다. 로컬 실행 시 `.env.example`을 복사하여 사용합니다.

```bash
cp .env.example .env
```

예시:

```env
DB_USER=scada
DB_PASSWORD=scada1234
DB_NAME=mscada
JWT_SECRET_KEY=change-this-to-a-long-random-secret-key
MQTT_USERNAME=
MQTT_PASSWORD=
```

### 3. 전체 스택 실행

```bash
docker compose up -d --build
```

### 4. 접속 정보

| 서비스 | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| TimescaleDB | localhost:5432 |
| MQTT TCP | localhost:1883 |
| MQTT WebSocket | ws://localhost:9001 |

> 최초 실행 시 Flyway 마이그레이션으로 테이블과 기본 시드 데이터가 자동 생성됩니다.

---

## 프로젝트 구조

```text
mini-scada/
├── backend/                         # Spring Boot 3.3, Java 17
│   ├── src/main/java/com/example/miniscada/
│   │   ├── api/                     # REST Controller, Service
│   │   ├── config/                  # Security, JWT, MQTT, CORS 설정
│   │   ├── domain/                  # JPA Entity, Repository
│   │   ├── polling/                 # Modbus 폴링, 파서
│   │   ├── realtime/                # MQTT 발행
│   │   ├── retention/               # 데이터 보존 스케줄러
│   │   └── security/                # JWT 필터, UserDetails
│   └── src/main/resources/
│       ├── application.yml
│       └── db/migration/            # Flyway SQL
│
├── frontend/                        # Vite + React 19 + TypeScript
│   └── src/
│       ├── auth/                    # AuthContext, JWT 세션 관리
│       ├── pages/                   # Dashboard, Devices, Alarms, Admin
│       ├── hooks/useScadaMqtt.ts    # MQTT 실시간 상태 훅
│       ├── lib/api.ts               # REST Client
│       └── components/scada/        # SCADA UI 컴포넌트
│
├── simulator/                       # Python Modbus TCP 시뮬레이터
│   └── app/simulator.py
│
├── infra/
│   ├── mosquitto/mosquitto.conf     # MQTT 브로커 설정
│   └── nginx/scada                  # Nginx vhost 예시
│
├── docs/                            # PRD, OpenAPI, ERD, 배포 가이드
├── docker-compose.yml               # 로컬 개발용
├── docker-compose-prod.yml          # 프로덕션 배포용
└── README.md
```

---

## API 엔드포인트

기본 경로: `/api/v1`  
인증 방식: `Authorization: Bearer <access_token>`

<details>
<summary><b>인증 Auth</b></summary>

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/login` | 로그인 |
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/refresh` | Access Token 갱신 |
| POST | `/auth/logout` | 로그아웃 |

</details>

<details>
<summary><b>대시보드 및 설비</b></summary>

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/dashboard/overview` | 전체 설비 요약 및 활성 알람 |
| GET | `/devices/{id}` | 설비 상세 조회 |
| GET | `/devices/{id}/timeseries` | 시계열 데이터 조회 |
| GET | `/devices/{id}/tags/current` | 태그 최신값 조회 |

</details>

<details>
<summary><b>알람</b></summary>

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/alarms` | 알람 목록 조회 |
| POST | `/alarms/{id}/ack` | 알람 확인 |
| POST | `/alarms/ack/bulk` | 알람 일괄 확인 |

</details>

<details>
<summary><b>관리자 ADMIN</b></summary>

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET / POST | `/admin/devices` | 설비 목록 조회 / 생성 |
| PATCH / DELETE | `/admin/devices/{id}` | 설비 수정 / 삭제 |
| POST | `/admin/devices/{id}/connection-test` | 설비 연결 테스트 |
| GET | `/admin/devices/{id}/history` | 설비 설정 변경 이력 |
| GET / POST | `/admin/devices/{id}/tags` | 태그 조회 / 생성 |
| PATCH / DELETE | `/admin/tags/{id}` | 태그 수정 / 삭제 |
| GET / PATCH | `/admin/policies/data` | 데이터 보존 정책 조회 / 수정 |

</details>

전체 API 명세는 [`docs/Mini SCADA for Facility Monitoring_OpenAPI.md`](docs/Mini%20SCADA%20for%20Facility%20Monitoring_OpenAPI.md)를 참고하세요.

---

## 환경 변수

### 공통 `.env`

| 변수 | 설명 |
|---|---|
| `DB_USER` | PostgreSQL 사용자 |
| `DB_PASSWORD` | PostgreSQL 비밀번호 |
| `DB_NAME` | 데이터베이스 이름 |
| `JWT_SECRET_KEY` | JWT 서명 키 |
| `MQTT_USERNAME` | MQTT 브로커 사용자, 선택 |
| `MQTT_PASSWORD` | MQTT 브로커 비밀번호, 선택 |

### Backend

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `local` | Spring profile |
| `DB_HOST` | `localhost` | DB host |
| `DB_PORT` | `5432` | DB port |
| `MQTT_HOST` | `localhost` | MQTT broker host |
| `MQTT_PORT` | `1883` | MQTT TCP port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | CORS 허용 출처 |
| `AUTH_COOKIE_SECURE` | `false` | Refresh Cookie Secure 속성 |
| `APP_RETENTION_CRON` | `0 0 3 * * *` | 데이터 보존 정책 실행 주기 |

### Frontend

| 변수 | 설명 |
|---|---|
| `VITE_API_URL` | API 기본 URL |
| `VITE_MQTT_WS_URL` | MQTT WebSocket URL |

프로덕션 예시:

```env
VITE_API_URL=https://scada.example.com/api/v1
VITE_MQTT_WS_URL=wss://scada.example.com/mqtt
```

> 실제 운영 환경의 `.env.prod`에는 민감 정보가 포함되므로 Git 저장소에 커밋하지 않습니다.

---

## 배포 구조

프로덕션 환경은 Docker Compose로 각 서비스를 실행하고, Host Nginx가 외부 HTTPS 요청을 내부 컨테이너 포트로 프록시하는 구조입니다.

```text
Browser
  → https://scada.example.com
  → Host Nginx :443
  → frontend / backend / mqtt container
```

예시 실행:

```bash
docker compose --env-file .env.prod -f docker-compose-prod.yml up -d --build
```

### 프로덕션 포트 구성 예시

| 서비스 | 외부 공개 여부 | 설명 |
|---|---:|---|
| Nginx 80/443 | 공개 | HTTPS Reverse Proxy |
| Frontend | 비공개 | Nginx가 내부 포트로 프록시 |
| Backend | 비공개 | Nginx가 `/api`로 프록시 |
| Mosquitto WebSocket | 비공개 | Nginx가 `/mqtt`로 프록시 |
| TimescaleDB | 비공개 | Docker 내부 네트워크 전용 |
| Simulator | 비공개 | Docker 내부 네트워크 전용 |

Nginx 프록시 경로 예시:

```text
/api/*   → backend
/mqtt    → mosquitto websocket
/*       → frontend
```

---

## 데모 계정

| 역할 | 사용자명 | 비밀번호 | 권한 |
|---|---|---|---|
| ADMIN | `admin` | `admin1234!!` | 설비·태그·정책 관리 |
| OPERATOR | `operator` | `password` | 대시보드 조회, 알람 확인 |

> 공개 데모 환경에서는 데이터가 주기적으로 초기화될 수 있습니다.

---

## 문서

| 파일 | 내용 |
|---|---|
| [`docs/Mini SCADA for Facility Monitoring_PRD.md`](docs/Mini%20SCADA%20for%20Facility%20Monitoring_PRD.md) | 제품 요구사항 정의서 |
| [`docs/ERD.md`](docs/ERD.md) | 데이터베이스 ERD |
| [`docs/Mini SCADA for Facility Monitoring_OpenAPI.md`](docs/Mini%20SCADA%20for%20Facility%20Monitoring_OpenAPI.md) | REST API 명세 |
| [`docs/Mini SCADA for Facility Monitoring_Backend_DA.md`](docs/Mini%20SCADA%20for%20Facility%20Monitoring_Backend_DA.md) | 백엔드 설계 문서 |
| [`docs/How-to-Deploy.md`](docs/How-to-Deploy.md) | 배포 가이드 |
| [`docs/Mini SCADA for Facility Monitoring_dev-env.md`](docs/Mini%20SCADA%20for%20Facility%20Monitoring_dev-env.md) | 개발 환경 설정 가이드 |

---

## 라이선스

본 프로젝트는 포트폴리오 목적으로 제작되었습니다.
