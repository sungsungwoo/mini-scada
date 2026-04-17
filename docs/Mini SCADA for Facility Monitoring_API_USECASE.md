# Mini SCADA for Facility Monitoring API 유스케이스 표

## 1. 인증 / 공통

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 로그인 | `POST /api/v1/auth/login` | `username`, `password` | `200 OK`, `user`, `accessToken` | `401 INVALID_CREDENTIALS`, `403 USER_INACTIVE` |
| 내 정보 조회 | `GET /api/v1/users/me` | Authorization Header | `200 OK`, 현재 로그인 사용자 정보 (`id`, `name`, `role`) | `401 UNAUTHORIZED` |
| 로그아웃 | `POST /api/v1/auth/logout` | Authorization Header | `200 OK`, 로그아웃 완료 메시지 | `401 UNAUTHORIZED` |

시스템은 `OPERATOR`, `ADMIN` 역할 기반으로 메뉴와 API 접근 범위를 분리한다. 운영자는 모니터링/알람 대응 API를 사용하고, 관리자는 설비/Tag/정책 설정 API까지 추가로 사용한다.

### 공통 권한 / 예외 정책

- 보호된 관리자 API에 운영자가 접근하면 `403 FORBIDDEN`
- 존재하지 않는 리소스를 조회하면 `404 RESOURCE_NOT_FOUND`
- 인증 토큰이 없거나 만료된 경우 `401 UNAUTHORIZED`

---

## 2. 대시보드 / 전체 설비 상태 조회

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 대시보드 초기 데이터 조회 | `GET /api/v1/dashboard/overview` | Authorization Header, optional query: `includeActiveAlarms=true` | `200 OK`, 요약 카드 정보(`deviceCount`, `onlineCount`, `offlineCount`, `warningCount`, `criticalCount`), 설비 목록, 활성 알람 목록 | `401 UNAUTHORIZED` |
| 대시보드 설비 목록 재조회 | `GET /api/v1/dashboard/devices` | Authorization Header, optional query: `status`, `alarmState`, `keyword` | `200 OK`, `devices[]` | `401 UNAUTHORIZED` |
| 대시보드 활성 알람 패널 조회 | `GET /api/v1/dashboard/active-alarms` | Authorization Header, optional query: `limit` | `200 OK`, `alarms[]` | `401 UNAUTHORIZED` |
| System Health 요약 조회(선택 기능) | `GET /api/v1/system/health/summary` | Authorization Header | `200 OK`, `api`, `mqttBroker`, `tsdb` 상태 요약 | `401 UNAUTHORIZED` |

대시보드는 로그인 후 첫 진입 화면이며, 전체 설비 상태를 1차로 REST API로 로딩한 뒤 이후 변경분은 MQTT over WebSockets로 반영하는 구조가 적합하다. `System Health`는 IA상 선택형 보조 기능이므로, 핵심 MVP API와 분리된 선택 구현으로 두는 편이 자연스럽다.

---

## 3. 설비 상세 / 시계열 / 이벤트 조회

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 설비 상세 조회 | `GET /api/v1/devices/{deviceId}` | Authorization Header, path: `deviceId` | `200 OK`, 설비 기본 정보, `status`, `last_seen`, `stale`, 현재 Tag 값 목록 | `401 UNAUTHORIZED`, `404 DEVICE_NOT_FOUND` |
| 설비 시계열 데이터 조회 | `GET /api/v1/devices/{deviceId}/timeseries?from=...&to=...&bucket=...` | Authorization Header, path: `deviceId`, query: `from`, `to`, `bucket`, `tagIds` | `200 OK`, `series[]` | `401 UNAUTHORIZED`, `404 DEVICE_NOT_FOUND`, `400 INVALID_DATE_RANGE` |
| 설비 최근 이벤트 조회 | `GET /api/v1/devices/{deviceId}/events?types=ALARM,FAULT&limit=20` | Authorization Header, path: `deviceId`, query: `types`, `limit` | `200 OK`, 최근 알람/장애 이력 배열 | `401 UNAUTHORIZED`, `404 DEVICE_NOT_FOUND` |
| 설비 현재 Tag 값 재조회 | `GET /api/v1/devices/{deviceId}/tags/current` | Authorization Header, path: `deviceId` | `200 OK`, `tags[]` | `401 UNAUTHORIZED`, `404 DEVICE_NOT_FOUND` |

설비 상세 화면은 현재 통신 상태, Tag별 현재 값, 최근 N시간 트렌드 차트, 최근 알람/장애 로그를 함께 보여주는 구조다. Offline 전환 시 마지막 수집값은 유지하되 `stale=true` 같은 형태로 프론트가 회색 음영 등 시각적 구분을 할 수 있게 내려주는 것이 Usecase와 IA에 맞다. 장기 구간 조회는 Downsampling 데이터를 사용할 수 있어야 한다.

---

## 4. 알람 조회 / Ack 처리

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 알람 이력 목록 조회 | `GET /api/v1/alarms` | Authorization Header, query: `severity`, `acknowledged`, `deviceId`, `from`, `to`, `page`, `size` | `200 OK`, `items[]`, `pageInfo` | `401 UNAUTHORIZED` |
| 알람 상세 조회 | `GET /api/v1/alarms/{alarmId}` | Authorization Header, path: `alarmId` | `200 OK`, 알람 상세, 발생값, 임계값 스냅샷, Ack 여부, 전후 시점 데이터 | `401 UNAUTHORIZED`, `404 ALARM_NOT_FOUND` |
| 단건 Ack 처리 | `POST /api/v1/alarms/{alarmId}/ack` | Authorization Header, path: `alarmId` | `200 OK`, `alarmId`, `acknowledged=true`, `acknowledgedAt` | `401 UNAUTHORIZED`, `404 ALARM_NOT_FOUND` |
| 일괄 Bulk Ack 처리 | `POST /api/v1/alarms/ack/bulk` | Authorization Header, body: `alarm_ids[]` | `200 OK`, `acked_count`, `skipped_count`, `items[]` | `401 UNAUTHORIZED`, `422 INVALID_REQUEST` |

알람은 Warning/Critical 상태 변화 중심으로 생성하고, Ack 이후에는 점멸/경고음 같은 시각·청각 효과를 중단하되 실제 센서 상태가 Normal로 복귀하기 전까지는 설비 상태색은 유지해야 한다.

### Quick Ack 적용 규칙

- 대시보드의 `Quick Ack`는 **별도 전용 API를 만들지 않고** `POST /api/v1/alarms/{alarmId}/ack` 를 재사용한다.
- 즉, **같은 비즈니스 액션(Ack)** 은 화면 위치와 무관하게 동일 엔드포인트를 사용한다.
- `Quick Ack`는 프론트엔드 UX 개념이며, 서버 API는 단건 Ack와 동일하게 처리한다.
- 이미 Ack된 알람에 대해 다시 Ack 요청이 들어오면 에러 대신 **멱등하게 `200 OK` + 현재 Ack 상태 반환**으로 처리하는 것을 권장한다.

---

## 5. 관리자 설비(Device) 관리

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 설비 목록 조회 | `GET /api/v1/admin/devices` | Authorization Header | `200 OK`, `devices[]` | `401 UNAUTHORIZED`, `403 FORBIDDEN` |
| 설비 등록 | `POST /api/v1/admin/devices` | Authorization Header, body: `name`, `ip`, `port`, `slave_id`, `polling_interval_sec` | `201 Created`, `device` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 DEVICE_DUPLICATED`, `422 INVALID_INPUT` |
| 설비 상세 조회(관리자) | `GET /api/v1/admin/devices/{deviceId}` | Authorization Header, path: `deviceId` | `200 OK`, `device` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND` |
| 설비 설정 변경 이력 | `GET /api/v1/admin/devices/{deviceId}/history` | Authorization Header, query: `page`, `size` | `200 OK`, `entries[]` (시각 `when`, `actor`, `action`, `summary`), `pageInfo` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND` |
| 설비 수정 | `PATCH /api/v1/admin/devices/{deviceId}` | Authorization Header, partial body | `200 OK`, 수정된 `device` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND`, `409 DEVICE_DUPLICATED` |
| 설비 삭제 | `DELETE /api/v1/admin/devices/{deviceId}` | Authorization Header, path: `deviceId` | `204 No Content` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND`, `409 DEVICE_IN_USE` |
| 설비 통신 테스트 | `POST /api/v1/admin/devices/test-connection` | Authorization Header, body: `ip`, `port`, `slave_id`, optional `timeout_sec` | `200 OK`, `reachable`, `response_time_ms`, `message` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `503 CONNECTION_TEST_FAILED`, `422 INVALID_INPUT` |

관리자는 설비 등록 시 저장 전에 **통신 테스트**를 먼저 수행하는 흐름을 가진다. 중복 기준은 `IP + Port + Slave ID` 조합이 적절하고, 통신 테스트 실패 시에는 방화벽/잘못된 Slave ID/네트워크 단절 등을 분리해 메시지화하는 것이 Usecase와 맞다. Polling 주기는 장비별 개별 설정 대상이다.

**설비 변경 이력:** `POST /admin/devices`(등록), `PATCH`(설정 변경·활성/비활성), `DELETE`(삭제) 성공 시 서버가 `device_change_logs`에 한 줄씩 적재한다. 행위 주체는 JWT의 사용자 ID로 조회한 `users.username`을 `actor`로 노출한다. 활성/비활성만 바뀐 경우 `action`은 `ENABLE` 또는 `DISABLE`, 그 외 필드 변경은 `UPDATE`와 요약 문자열(`summary`)로 구분한다.

---

## 6. 관리자 Tag 및 알람 임계값 통합 설정

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| Tag 목록 조회 | `GET /api/v1/admin/devices/{deviceId}/tags` | Authorization Header, path: `deviceId` | `200 OK`, `tags[]` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND` |
| Tag + 임계값 통합 생성 | `POST /api/v1/admin/devices/{deviceId}/tags` | Authorization Header, body: `name`, `address`, `function_code`, `data_type`, `unit`, `display_order`, `byte_swap`, `word_swap`, `warning_threshold`, `critical_threshold`, `deadband` | `201 Created`, `tag` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 DEVICE_NOT_FOUND`, `409 TAG_DUPLICATED`, `422 INVALID_INPUT` |
| Tag + 임계값 통합 수정 | `PATCH /api/v1/admin/tags/{tagId}` | Authorization Header, partial body | `200 OK`, 수정된 `tag` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TAG_NOT_FOUND`, `422 INVALID_INPUT` |
| Tag 삭제 | `DELETE /api/v1/admin/tags/{tagId}` | Authorization Header, path: `tagId` | `204 No Content` | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TAG_NOT_FOUND`, `409 TAG_REFERENCED` |
| Tag 설정 단건 조회 | `GET /api/v1/admin/tags/{tagId}` | Authorization Header, path: `tagId` | `200 OK`, `tag` + 임계값 정보 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 TAG_NOT_FOUND` |

PRD는 센서(Tag) 및 메모리 맵 설정과 알람 임계값 설정을 별도 기능으로 설명하지만, IA에서는 이를 **하나의 관리자 화면에서 통합 관리**하도록 정리했다. 따라서 API도 Tag 생성/수정 시 임계값(`warning`, `critical`, `deadband`)을 함께 저장하는 방식이 화면 흐름과 가장 잘 맞는다. `32-bit Float` 등 변환 로직을 고려하면 `byte_swap`, `word_swap` 같은 엔디안 매핑 옵션도 포함하는 편이 좋다.

---

## 7. 관리자 데이터 정책 관리

| 행위 | 엔드포인트 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 데이터 정책 조회 | `GET /api/v1/admin/policies/data` | Authorization Header | `200 OK`, `raw_retention_days`, `aggregate_retention_days`, `downsampling_interval` | `401 UNAUTHORIZED`, `403 FORBIDDEN` |
| 데이터 정책 수정 | `PATCH /api/v1/admin/policies/data` | Authorization Header, body: `raw_retention_days`, `aggregate_retention_days`, `downsampling_interval` | `200 OK`, 수정된 정책 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `422 INVALID_POLICY` |
| 데이터 정책 초기화 | `POST /api/v1/admin/policies/data/reset` | Authorization Header | `200 OK`, 기본 정책값 | `401 UNAUTHORIZED`, `403 FORBIDDEN` |

IA 기준으로 데이터 정책은 MVP 단계에서 **시스템 전역(Global) 정책**이다. 즉, `/api/v1/admin/policies/data` 에서 설정한 값은 전체 Device와 전체 시계열 데이터 처리 기준에 공통 적용된다. 설비별/Tag별 정책 분리는 후속 확장 범위다.

---

## 8. 실시간 상태 동기화 / MQTT over WebSockets

| 행위 | 엔드포인트 또는 채널 | 요청 | 응답 | 실패 케이스 |
| --- | --- | --- | --- | --- |
| 실시간 bootstrap 조회 | `GET /api/v1/realtime/bootstrap` | Authorization Header | `200 OK`, 마지막 상태 스냅샷, 구독 대상 topic 목록(optional) | `401 UNAUTHORIZED` |
| MQTT over WebSockets 연결 | `wss://{broker-host}/mqtt` | WebSocket + 인증 토큰 또는 세션 기반 인증 | MQTT 연결 완료 | 인증 실패, 브로커 연결 실패 |
| 설비 상태 구독 | topic: `/scada/{deviceId}/status` | MQTT subscribe | 상태 변경 이벤트 수신 | 브로커 미연결 |
| Tag 값 구독 | topic: `/scada/{deviceId}/{tag}` | MQTT subscribe | 실시간 센서 값 이벤트 수신 | 브로커 미연결 |
| 알람 이벤트 구독 | topic: `/scada/alarm` | MQTT subscribe | 알람 생성/변경 이벤트 수신 | 브로커 미연결 |

PRD에서 실시간 전파는 MQTT이며, Topic 설계도 `/scada/{deviceId}/{tag}`, `/scada/{deviceId}/status`, `/scada/alarm` 으로 정의되어 있다. 클라이언트는 화면 진입 시 REST bootstrap으로 초기 상태를 가져오고, 이후 MQTT 메시지로 증분 반영하며, 연결이 끊겼다가 복구되면 다시 REST 재조회로 상태를 맞춘다. MQTT는 저장소가 아니라 **이벤트 전달 계층**이라는 원칙을 유지해야 한다.

---

## 9. 공통 응답/에러 규격 예시

## 성공 응답 예시

```json
{
  "success": true,
  "data": {
    "deviceId": "d1",
    "status": "ONLINE"
  }
}
````

## 실패 응답 예시

```json
{
  "success": false,
  "error_code": "DEVICE_DUPLICATED",
  "message": "동일한 IP, Port, Slave ID 조합의 설비가 이미 존재합니다."
}
```

에러 응답은 전역 예외 처리 방식으로 통일하고, 입력 오류와 비즈니스 충돌, 권한 오류를 구분하는 것이 이후 프론트 처리와 운영 메시지 품질에 유리하다. 이런 정규화된 응답 구조는 빈자리 표 형식과도 잘 맞는다.

---

## 10. 우선 구현 순서 추천

1. **인증 API**
2. **대시보드 / 설비 상세 조회 API**
3. **알람 조회 / Ack API**
4. **관리자 설비(Device) 관리 API**
5. **Tag 및 임계값 통합 설정 API**
6. **데이터 정책 API**
7. **실시간 bootstrap + MQTT 연동**
8. **System Health 요약 API(선택 기능)**
