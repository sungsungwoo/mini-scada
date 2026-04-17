# 📊 Mini SCADA for Facility Monitoring ERD

## 전제

* `users`는 시스템의 모든 계정을 통합 관리
* 운영자/관리자 권한은 RBAC(`roles`, `user_roles`)로 관리
* `devices`는 모니터링 대상 설비(노드) 단위
* `device_tags`는 설비에 속한 개별 센서/레지스터 단위
* 저장 시각은 모두 **UTC (`TIMESTAMPTZ`)**
* 실시간 최신 상태와 장기 시계열 데이터는 역할을 분리
* MQTT는 이벤트 전달 계층이고, **DB가 단일 진실 공급원(Source of Truth)**
* 실제 장비 제어(write)는 MVP 범위 밖이므로, 우선은 **수집/상태/알람/이력** 중심으로 설계
* 로그인 식별자는 REST API(`POST /api/v1/auth/login`)의 **`username`** 과 대응하는 `users.username` 을 사용한다(이메일은 선택·연락용으로 둘 수 있음).

---

## 1. 사용자 도메인 (User Domain)

### `users`

시스템의 모든 사용자 기본 정보

| 컬럼명             | 데이터 타입       | 제약조건 및 설명                |
| :-------------- | :----------- | :----------------------- |
| `id`            | UUID         | Primary Key              |
| `username`      | VARCHAR(100) | Not Null, Unique, Index — 로그인 ID (`LoginRequest.username`) |
| `email`         | VARCHAR(255) | Nullable, Unique (값이 있는 경우에만 중복 불가) |
| `password_hash` | VARCHAR(255) | Not Null                 |
| `name`          | VARCHAR(100) | Not Null                 |
| `is_active`     | BOOLEAN      | Not Null, Default `TRUE` |
| `created_at`    | TIMESTAMPTZ  | Not Null, UTC            |
| `updated_at`    | TIMESTAMPTZ  | Not Null, UTC            |

**권장 제약**

* `UNIQUE(username)`
* `UNIQUE(email)` (PostgreSQL에서는 `email` 이 NULL인 행은 Unique 제약에서 서로 구별되지 않으므로, 복수의 미등록 이메일 계정이 가능하다. 필요 시 부분 Unique 인덱스로 보강)

---

### `roles`

시스템 권한 종류 정의

| 컬럼명           | 데이터 타입       | 제약조건 및 설명                              |
| :------------ | :----------- | :------------------------------------- |
| `id`          | INTEGER      | Primary Key (Auto Increment)           |
| `name`        | VARCHAR(50)  | Not Null, Unique (`OPERATOR`, `ADMIN`) |
| `description` | VARCHAR(255) | Nullable                               |

**권장 제약**

* `UNIQUE(name)`

---

### `user_roles`

사용자와 역할의 매핑 테이블

| 컬럼명           | 데이터 타입      | 제약조건 및 설명                          |
| :------------ | :---------- | :--------------------------------- |
| `user_id`     | UUID        | Foreign Key → `users.id`, Not Null |
| `role_id`     | INTEGER     | Foreign Key → `roles.id`, Not Null |
| `assigned_at` | TIMESTAMPTZ | Not Null, UTC                      |

**권장 제약 및 인덱스**

* `PRIMARY KEY (user_id, role_id)`
* Index: `(user_id)`
* Index: `(role_id)`

---

## 2. 설비 설정 도메인 (Device Configuration Domain)

### `device_groups`

설비를 논리적으로 묶는 그룹

| 컬럼명           | 데이터 타입       | 제약조건 및 설명        |
| :------------ | :----------- | :--------------- |
| `id`          | UUID         | Primary Key      |
| `name`        | VARCHAR(100) | Not Null, Unique |
| `description` | VARCHAR(255) | Nullable         |
| `created_at`  | TIMESTAMPTZ  | Not Null, UTC    |
| `updated_at`  | TIMESTAMPTZ  | Not Null, UTC    |

**설명**

* 예: Boiler Room, Chiller Line, Test Bench A

---

### `devices`

모니터링 대상 물리 설비

| 컬럼명                     | 데이터 타입       | 제약조건 및 설명                                            |
| :---------------------- | :----------- | :--------------------------------------------------- |
| `id`                    | UUID         | Primary Key                                          |
| `device_group_id`       | UUID         | Foreign Key → `device_groups.id`, Nullable, Index    |
| `name`                  | VARCHAR(150) | Not Null                                             |
| `code`                  | VARCHAR(100) | Not Null, Unique, 설비 식별 코드                           |
| `description`           | TEXT         | Nullable                                             |
| `protocol_type`         | VARCHAR(20)  | Not Null, `MODBUS_TCP`, `MODBUS_RTU`, `SIMULATOR`    |
| `ip_address`            | VARCHAR(64)  | Nullable                                             |
| `port`                  | INTEGER      | Nullable                                             |
| `slave_id`              | INTEGER      | Nullable                                             |
| `unit_identifier`       | INTEGER      | Nullable, Modbus TCP 확장 고려                           |
| `polling_interval_sec`  | INTEGER      | Not Null, Default `5`                                |
| `timeout_ms`            | INTEGER      | Not Null, Default `2000`                             |
| `retry_count`           | INTEGER      | Not Null, Default `3`                                |
| `offline_threshold_sec` | INTEGER      | Not Null, Default `15`                               |
| `status`                | VARCHAR(20)  | Not Null, `ONLINE`, `OFFLINE`, `UNKNOWN`, `DISABLED` |
| `last_seen_at`          | TIMESTAMPTZ  | Nullable, UTC                                        |
| `is_active`             | BOOLEAN      | Not Null, Default `TRUE`                             |
| `created_at`            | TIMESTAMPTZ  | Not Null, UTC                                        |
| `updated_at`            | TIMESTAMPTZ  | Not Null, UTC                                        |

**권장 제약**

* `UNIQUE(code)`
* `CHECK (protocol_type IN ('MODBUS_TCP', 'MODBUS_RTU', 'SIMULATOR'))`
* `CHECK (polling_interval_sec >= 1)`
* `CHECK (timeout_ms > 0)`
* `CHECK (retry_count >= 0)`
* `CHECK (offline_threshold_sec >= 1)`
* `CHECK (status IN ('ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED'))`

**설명**

* `devices.status`는 현재 설비의 대표 상태
* `last_seen_at` 기준으로 Online/Offline 판단 가능

#### Modbus RTU 확장 고려

`protocol_type`이 `MODBUS_RTU`인 경우를 대비하여 향후 아래 컬럼 확장이 필요하다.

- serial_port (예: /dev/ttyUSB0)
- baud_rate
- data_bits
- stop_bits
- parity

MVP 단계에서는 Modbus TCP 중심으로 구현하며,
RTU는 향후 확장 포인트로 고려한다.

---

### `device_change_logs`

관리자 화면용 **설비 설정 변경 이력** (감사 추적). `devices` 행과는 **외래키로 연결하지 않는다**. 설비 삭제 후에도 해당 설비에 대한 과거 로그 행을 보존하기 위함이다.

| 컬럼명           | 데이터 타입       | 제약조건 및 설명 |
| :------------ | :----------- | :---------- |
| `id`          | UUID         | Primary Key |
| `device_id`   | UUID         | Not Null, Index — 대상 설비 ID (삭제된 설비도 참조 가능) |
| `occurred_at` | TIMESTAMPTZ  | Not Null, UTC |
| `actor_user_id` | UUID      | Nullable, FK → `users.id` ON DELETE SET NULL |
| `action`      | VARCHAR(20)  | Not Null, `CREATE`, `UPDATE`, `ENABLE`, `DISABLE`, `DELETE` |
| `summary`     | TEXT         | Not Null — 사람이 읽을 수 있는 변경 요약(영문 문구 위주) |

**인덱스**

* `(device_id, occurred_at DESC)` — 설비별 최신순 목록 조회

---

### `device_tags`

설비에 속한 개별 센서/레지스터 정의

| 컬럼명             | 데이터 타입        | 제약조건 및 설명                                                                  |
| :-------------- | :------------ | :------------------------------------------------------------------------- |
| `id`            | UUID          | Primary Key                                                                |
| `device_id`     | UUID          | Foreign Key → `devices.id`, Not Null, Index                                |
| `name`          | VARCHAR(100)  | Not Null                                                                   |
| `code`          | VARCHAR(100)  | Not Null                                                                   |
| `description`   | VARCHAR(255)  | Nullable                                                                   |
| `tag_type`      | VARCHAR(30)   | Not Null, `TEMPERATURE`, `PRESSURE`, `HUMIDITY`, `RPM`, `STATUS`, `CUSTOM` |
| `function_code` | INTEGER       | Not Null, 예: `1`, `2`, `3`, `4`                                            |
| `address`       | INTEGER       | Not Null                                                                   |
| `quantity`      | INTEGER       | Not Null, Default `1`                                                      |
| `data_type`     | VARCHAR(30)   | Not Null, `BOOL`, `INT16`, `UINT16`, `INT32`, `UINT32`, `FLOAT32`          |
| `byte_order`    | VARCHAR(20)   | Nullable, `BIG`, `LITTLE`, `BIG_SWAP`, `LITTLE_SWAP`                       |
| `unit`          | VARCHAR(30)   | Nullable, 예: `°C`, `bar`, `%`                                              |
| `scale_factor`  | NUMERIC(18,6) | Not Null, Default `1.0`                                                    |
| `offset_value`  | NUMERIC(18,6) | Not Null, Default `0.0`                                                    |
| `warning_min`   | NUMERIC(18,6) | Nullable                                                                   |
| `warning_max`   | NUMERIC(18,6) | Nullable                                                                   |
| `critical_min`  | NUMERIC(18,6) | Nullable                                                                   |
| `critical_max`  | NUMERIC(18,6) | Nullable                                                                   |
| `deadband`      | NUMERIC(18,6) | Nullable — 알람 히스테리시스(OpenAPI `deadband`)                           |
| `is_enabled`    | BOOLEAN       | Not Null, Default `TRUE`                                                   |
| `display_order` | INTEGER       | Not Null, Default `0`                                                      |
| `created_at`    | TIMESTAMPTZ   | Not Null, UTC                                                              |
| `updated_at`    | TIMESTAMPTZ   | Not Null, UTC                                                              |

**권장 제약 및 인덱스**

* `UNIQUE(device_id, code)`
* `UNIQUE(device_id, function_code, address)`
* `CHECK (address >= 0)`
* `CHECK (quantity >= 1)`
* `CHECK (function_code IN (1, 2, 3, 4))`
* `CHECK (data_type IN ('BOOL', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32'))`

#### 주소 범위 충돌 방지 정책

`quantity`가 1보다 큰 경우, 하나의 Tag는 여러 Register 주소를 점유한다.

예:
- address = 100, quantity = 2 → 100, 101 사용

따라서 단순 UNIQUE(device_id, function_code, address) 제약만으로는
주소 범위 충돌을 완전히 방지할 수 없다.

→ 주소 범위 충돌 검증은 애플리케이션 레벨에서 수행한다.

#### MVP/API와 임계값 컬럼 매핑

OpenAPI·IA의 MVP는 Tag당 **`warning_threshold` / `critical_threshold` / `deadband`** 단일값 모델을 사용한다. 본 ERD의 `warning_min` / `warning_max` / `critical_min` / `critical_max` 는 **구간(상·하한) 알람**까지 확장할 때를 대비한 형태이며, MVP에서는 아래처럼 매핑하면 API와 일치시킬 수 있다.

* **상한 초과 감시(일반적인 온도·압력 상한):** `warning_max` ← `warning_threshold`, `critical_max` ← `critical_threshold`, `deadband` ← `deadband`, 나머지 min 컬럼은 NULL.
* **하한 미만 감시:** `warning_min` / `critical_min` 에 각각 매핑하고 max 쪽은 NULL.
* 이후 제품에서 구간 알람이 필요하면 동일 컬럼을 채워 확장하면 된다.

**설명**

* Device = 물리 설비
* Tag = 설비에 속한 개별 센서 데이터 단위

---

### `system_data_policy`

**시스템 전역** 데이터 보존·다운샘플링 정책(MVP: IA `/admin/policies/data`, API `GET/PATCH /api/v1/admin/policies/data` 와 대응). 행은 통상 **1건(싱글톤)** 만 둔다.

| 컬럼명                       | 데이터 타입      | 제약조건 및 설명                                    |
| :------------------------ | :---------- | :------------------------------------------- |
| `id`                      | INTEGER     | Primary Key, 고정값 `1` (singleton) 권장      |
| `raw_retention_days`      | INTEGER     | Not Null                                     |
| `aggregate_retention_days`| INTEGER     | Not Null                                     |
| `downsampling_interval`   | VARCHAR(32) | Not Null, 예 `10m` (운영·배치에서 해석)       |
| `updated_at`              | TIMESTAMPTZ | Not Null, UTC                                |

**권장 제약**

* `CHECK (id = 1)` (선택) 또는 애플리케이션에서 단일 행만 유지
* `CHECK (raw_retention_days >= 1)`
* `CHECK (aggregate_retention_days >= 1)`

---

### `device_retention_policies` (후속 확장 · 설비별)

설비별 데이터 보존 정책. **MVP(IA/API)는 전역 `system_data_policy`만 사용**하므로, 본 테이블은 멀티 사이트·설비별 SLA 분리 등 **후속 단계**에서 도입할 후보로 둔다.

| 컬럼명                       | 데이터 타입      | 제약조건 및 설명                                    |
| :------------------------ | :---------- | :------------------------------------------- |
| `id`                      | UUID        | Primary Key                                  |
| `device_id`               | UUID        | Foreign Key → `devices.id`, Not Null, Unique |
| `raw_retention_days`      | INTEGER     | Not Null, Default `7`                        |
| `rollup_interval_minutes` | INTEGER     | Not Null, Default `10`                       |
| `rollup_retention_days`   | INTEGER     | Not Null, Default `365`                      |
| `created_at`              | TIMESTAMPTZ | Not Null, UTC                                |
| `updated_at`              | TIMESTAMPTZ | Not Null, UTC                                |

**권장 제약**

* `CHECK (raw_retention_days >= 1)`
* `CHECK (rollup_interval_minutes >= 1)`
* `CHECK (rollup_retention_days >= raw_retention_days)`

**설명**

#### 확장 고려 사항

설비 단위로 데이터 보존 정책을 분리할 때 사용한다. MVP 이후 필요 시 `system_data_policy` 와의 우선순위(전역 기본값 + 설비 override 등)를 정의하면 된다.

---

## 3. 실시간 상태 도메인 (Realtime State Domain)

### `device_tag_latest`

각 Tag의 최신값 스냅샷

| 컬럼명             | 데이터 타입        | 제약조건 및 설명                                            |
| :-------------- | :------------ | :--------------------------------------------------- |
| `tag_id`        | UUID          | Primary Key, Foreign Key → `device_tags.id`          |
| `device_id`     | UUID          | Foreign Key → `devices.id`, Not Null, Index          |
| `value_numeric` | NUMERIC(24,8) | Nullable                                             |
| `value_text`    | VARCHAR(255)  | Nullable                                             |
| `quality`       | VARCHAR(20)   | Not Null, `GOOD`, `BAD`, `UNCERTAIN`, `TIMEOUT`      |
| `alarm_state`   | VARCHAR(20)   | Not Null, `NORMAL`, `WARNING`, `CRITICAL`, `UNKNOWN` |
| `collected_at`  | TIMESTAMPTZ   | Not Null, UTC                                        |
| `updated_at`    | TIMESTAMPTZ   | Not Null, UTC                                        |

**권장 제약**

* `CHECK (quality IN ('GOOD', 'BAD', 'UNCERTAIN', 'TIMEOUT'))`
* `CHECK (alarm_state IN ('NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN'))`

**설명**

* 대시보드 실시간 조회 최적화용
* 최신값만 빠르게 조회하는 테이블
* 장기 이력은 `tag_readings`가 담당

#### 데이터 정합성 보장 정책

본 테이블의 `device_id`는 조회 성능 최적화를 위한 중복 저장 컬럼이다.

- 실제 정합성 기준은 `tag_id → device_tags.device_id` 관계를 따른다.
- 데이터 저장 시 애플리케이션 레벨에서 `tag_id`와 `device_id`의 일치 여부를 검증한다.
- 불일치 데이터는 저장되지 않도록 한다.

---

## 4. 시계열 데이터 도메인 (Timeseries Domain)

### `tag_readings`

원천 시계열 데이터 저장의 핵심 테이블

| 컬럼명             | 데이터 타입        | 제약조건 및 설명                                            |
| :-------------- | :------------ | :--------------------------------------------------- |
| `time`          | TIMESTAMPTZ   | Not Null, UTC, Index                                 |
| `tag_id`        | UUID          | Foreign Key → `device_tags.id`, Not Null, Index      |
| `device_id`     | UUID          | Foreign Key → `devices.id`, Not Null, Index          |
| `value_numeric` | NUMERIC(24,8) | Nullable                                             |
| `value_text`    | VARCHAR(255)  | Nullable                                             |
| `quality`       | VARCHAR(20)   | Not Null, `GOOD`, `BAD`, `UNCERTAIN`, `TIMEOUT`      |
| `alarm_state`   | VARCHAR(20)   | Not Null, `NORMAL`, `WARNING`, `CRITICAL`, `UNKNOWN` |
| `raw_payload`   | JSONB         | Nullable, 원본 Modbus 응답 보관용                           |
| `created_at`    | TIMESTAMPTZ   | Not Null, UTC                                        |

**권장 제약 및 인덱스**

* Composite Index: `(tag_id, time DESC)`
* Composite Index: `(device_id, time DESC)`
* `CHECK (quality IN ('GOOD', 'BAD', 'UNCERTAIN', 'TIMEOUT'))`
* `CHECK (alarm_state IN ('NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN'))`

**중요 정책**

* TimescaleDB 사용 시 이 테이블을 **hypertable**로 변환
* 장기 운영 시 retention + rollup 대상

#### 데이터 정합성 보장 정책

본 테이블의 `device_id`는 조회 성능 최적화를 위한 중복 저장 컬럼이다.

- 실제 정합성 기준은 `tag_id → device_tags.device_id` 관계를 따른다.
- 데이터 저장 시 애플리케이션 레벨에서 `tag_id`와 `device_id`의 일치 여부를 검증한다.
- 불일치 데이터는 저장되지 않도록 한다.

---

### `tag_reading_rollups`

다운샘플링 집계 데이터

| 컬럼명                | 데이터 타입        | 제약조건 및 설명                                |
| :----------------- | :------------ | :--------------------------------------- |
| `bucket_time`      | TIMESTAMPTZ   | Not Null, UTC                            |
| `tag_id`           | UUID          | Foreign Key → `device_tags.id`, Not Null |
| `device_id`        | UUID          | Foreign Key → `devices.id`, Not Null     |
| `interval_minutes` | INTEGER       | Not Null                                 |
| `min_value`        | NUMERIC(24,8) | Nullable                                 |
| `max_value`        | NUMERIC(24,8) | Nullable                                 |
| `avg_value`        | NUMERIC(24,8) | Nullable                                 |
| `sample_count`     | INTEGER       | Not Null                                 |
| `created_at`       | TIMESTAMPTZ   | Not Null, UTC                            |

**권장 제약 및 인덱스**

* `PRIMARY KEY (bucket_time, tag_id, interval_minutes)`
* `CHECK (interval_minutes >= 1)`
* `CHECK (sample_count >= 0)`

---

## 5. 알람 도메인 (Alarm Domain)

### `alarms`

알람 이벤트의 대표 테이블

| 컬럼명               | 데이터 타입        | 제약조건 및 설명                                                              |
| :---------------- | :------------ | :--------------------------------------------------------------------- |
| `id`              | UUID          | Primary Key                                                            |
| `device_id`       | UUID          | Foreign Key → `devices.id`, Not Null, Index                            |
| `tag_id`          | UUID          | Foreign Key → `device_tags.id`, Nullable, Index                        |
| `alarm_type`      | VARCHAR(30)   | Not Null, `THRESHOLD`, `DEVICE_OFFLINE`, `COMM_TIMEOUT`, `QUALITY_BAD` |
| `severity`        | VARCHAR(20)   | Not Null, `WARNING`, `CRITICAL`                                        |
| `status`          | VARCHAR(20)   | Not Null, `OPEN`, `ACKED`, `CLEARED`                                   |
| `message`         | VARCHAR(255)  | Not Null                                                               |
| `triggered_value` | NUMERIC(24,8) | Nullable                                                               |
| `threshold_value` | NUMERIC(24,8) | Nullable                                                               |
| `started_at`      | TIMESTAMPTZ   | Not Null, UTC                                                          |
| `acked_at`        | TIMESTAMPTZ   | Nullable, UTC                                                          |
| `cleared_at`      | TIMESTAMPTZ   | Nullable, UTC                                                          |
| `acked_by`        | UUID          | Foreign Key → `users.id`, Nullable                                     |
| `created_at`      | TIMESTAMPTZ   | Not Null, UTC                                                          |
| `updated_at`      | TIMESTAMPTZ   | Not Null, UTC                                                          |

**권장 제약**

* `CHECK (alarm_type IN ('THRESHOLD', 'DEVICE_OFFLINE', 'COMM_TIMEOUT', 'QUALITY_BAD'))`
* `CHECK (severity IN ('WARNING', 'CRITICAL'))`
* `CHECK (status IN ('OPEN', 'ACKED', 'CLEARED'))`

**설명**

#### 활성 알람 중복 방지 정책

동일한 조건의 알람이 중복 생성되는 것을 방지한다.

조건:
- device_id
- tag_id
- alarm_type
- status = 'OPEN'

→ 동일 조건의 OPEN 상태 알람이 존재할 경우
새로운 알람을 생성하지 않고 기존 알람을 유지한다.

---

### `alarm_events`

알람 상태 변화 이력

| 컬럼명             | 데이터 타입       | 제약조건 및 설명                                  |
| :-------------- | :----------- | :----------------------------------------- |
| `id`            | UUID         | Primary Key                                |
| `alarm_id`      | UUID         | Foreign Key → `alarms.id`, Not Null, Index |
| `event_type`    | VARCHAR(20)  | Not Null, `TRIGGERED`, `ACKED`, `CLEARED`  |
| `event_message` | VARCHAR(255) | Nullable                                   |
| `actor_user_id` | UUID         | Foreign Key → `users.id`, Nullable         |
| `created_at`    | TIMESTAMPTZ  | Not Null, UTC                              |

**권장 제약**

* `CHECK (event_type IN ('TRIGGERED', 'ACKED', 'CLEARED'))`

---

## 6. 통신 및 운영 로그 도메인 (Communication / Ops Domain)

### `polling_logs`

수집 주기 실행 결과 로그

| 컬럼명             | 데이터 타입      | 제약조건 및 설명                                                  |
| :-------------- | :---------- | :--------------------------------------------------------- |
| `id`            | UUID        | Primary Key                                                |
| `device_id`     | UUID        | Foreign Key → `devices.id`, Not Null, Index                |
| `started_at`    | TIMESTAMPTZ | Not Null, UTC                                              |
| `finished_at`   | TIMESTAMPTZ | Nullable, UTC                                              |
| `result`        | VARCHAR(20) | Not Null, `SUCCESS`, `TIMEOUT`, `ERROR`, `PARTIAL_SUCCESS` |
| `error_code`    | VARCHAR(50) | Nullable                                                   |
| `error_message` | TEXT        | Nullable                                                   |
| `latency_ms`    | INTEGER     | Nullable                                                   |
| `created_at`    | TIMESTAMPTZ | Not Null, UTC                                              |

**권장 제약**

* `CHECK (result IN ('SUCCESS', 'TIMEOUT', 'ERROR', 'PARTIAL_SUCCESS'))`

**설명**

* 필수는 아니지만, 포트폴리오에서 운영성/디버깅 설명에 매우 좋음

#### 로그 데이터 보존 정책

`polling_logs`는 고빈도 데이터 생성 테이블이므로
장기 저장 시 용량 증가를 유발할 수 있다.

→ 최근 N일(예: 7일 또는 30일) 데이터만 유지하도록
주기적인 삭제 또는 TTL 정책을 적용한다.

---

## 7. 핵심 무결성 규칙

### 7.1 Device와 Tag의 관계는 명확히 1:N

* 하나의 Device는 여러 Tag를 가질 수 있음
* 하나의 Tag는 반드시 하나의 Device에만 속함
* 따라서 `device_tags.device_id`는 Not Null

---

### 7.2 Tag 주소 중복 방지

PostgreSQL 기준 권장 유니크 제약:

```sql
UNIQUE(device_id, function_code, address)
```

의미:

* 동일 설비 내에서
* 같은 Function Code + Register Address 조합은
* 하나의 Tag만 매핑 가능

---

### 7.3 최신 상태와 이력의 역할 분리

* `device_tag_latest`

  * 대시보드용 최신 상태
  * 빠른 조회 최적화
* `tag_readings`

  * 시계열 이력
  * 분석/트렌드/리포트용

빈자리에서 `slots.status`와 `bookings.status`의 역할을 분리한 것처럼, 여기서는 **최신 상태와 이력 상태를 분리**하는 것이 핵심입니다. 

---

### 7.4 MQTT는 저장소가 아님

* MQTT는 실시간 이벤트 전달만 담당
* DB 저장 성공 이후 publish
* 화면 복구 시에는 DB 재조회로 정합성 회복

이것은 현재 PRD의 “MQTT 실시간 전파 + TSDB 저장” 구조와 일치합니다. 

---

### 7.5 Online / Offline 판단은 last_seen 기반

* `devices.last_seen_at`를 기준으로 상태 판단
* 일정 시간 초과 시 `OFFLINE`
* 실시간 계산 또는 배치 갱신 모두 가능

---

## 8. 관계 요약

* `users (1) ── (N) user_roles`
* `roles (1) ── (N) user_roles`
* `device_groups (1) ── (N) devices`
* `devices (1) ── (N) device_tags`
* `system_data_policy` — 싱글톤(전역 정책, MVP)
* `devices (1) ── (0..1) device_retention_policies` (후속 확장 시)
* `devices (1) ── (N) polling_logs`
* `devices (1) ── (N) alarms`
* `device_tags (1) ── (1) device_tag_latest`
* `device_tags (1) ── (N) tag_readings`
* `device_tags (1) ── (N) tag_reading_rollups`
* `device_tags (1) ── (N) alarms`
* `alarms (1) ── (N) alarm_events`

---

## 9. 최종 설계 포인트 요약

이 설계안의 핵심은 아래입니다.

* 빈자리 ERD처럼 `users`와 권한을 분리한 RBAC 구조 유지
* 설정 도메인(`devices`, `device_tags`, MVP 전역 `system_data_policy`)과 트랜잭션/이력 도메인(`tag_readings`, `alarms`) 분리 — 설비별 `device_retention_policies` 는 후속
* 저장 시각은 모두 UTC 기준
* Modbus 메모리 맵은 `function_code + address + data_type` 중심으로 설계
* 최신값 조회 최적화를 위해 `device_tag_latest` 별도 분리
* 장기 이력은 `tag_readings`/`tag_reading_rollups`로 분리
* 알람은 현재 상태(`alarms`)와 상태 변화 이력(`alarm_events`) 분리
* MQTT는 비동기 전파, DB는 Source of Truth 역할 유지
* TimescaleDB 적용 시 실무적으로 가장 설명력 좋은 구조

---
