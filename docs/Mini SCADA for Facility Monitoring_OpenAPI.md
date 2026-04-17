openapi: 3.1.0
info:
  title: Mini SCADA for Facility Monitoring API
  version: 1.0.0
  summary: REST API specification for Mini SCADA MVP
  description: |
    Mini SCADA for Facility Monitoring의 MVP REST API 명세입니다.

    범위
    - 인증 / 사용자 정보
    - 대시보드 / 설비 상태 조회
    - 설비 상세 / 시계열 / 이벤트 조회
    - 알람 조회 / Ack 처리
    - 관리자 설비(Device) 관리
    - 관리자 Tag 및 알람 임계값 통합 설정
    - 관리자 데이터 정책 관리
    - 실시간 bootstrap 조회

    참고
    - 실시간 MQTT/WebSocket 구독 자체는 OpenAPI의 직접 표현 범위를 벗어나므로,
      본 문서에는 REST bootstrap API만 포함하고 MQTT topic 정보는 x-realtime-topics에 별도 표기합니다.

x-naming-convention:
  requestBody: snake_case
  responseBody: camelCase
  queryParameters: camelCase
  pathParameters: camelCase

servers:
  - url: https://api.example.com
    description: Production
  - url: http://localhost:8080
    description: Local

tags:
  - name: Auth
  - name: Users
  - name: Dashboard
  - name: Devices
  - name: Alarms
  - name: Admin Devices
  - name: Admin Tags
  - name: Admin Policies
  - name: Realtime

x-realtime-topics:
  description: MQTT over WebSockets topics used by the frontend after initial REST bootstrap.
  topics:
    - topic: /scada/{deviceId}/status
      purpose: 설비 Online/Offline 상태 변경 이벤트
    - topic: /scada/{deviceId}/{tag}
      purpose: 설비 Tag 실시간 값 변경 이벤트
    - topic: /scada/alarm
      purpose: 알람 생성/변경 이벤트

security:
  - bearerAuth: []

paths:
  /api/v1/auth/login:
    post:
      tags: [Auth]
      summary: 로그인
      operationId: login
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: 로그인 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponseEnvelope'
        '401':
          $ref: '#/components/responses/InvalidCredentials'
        '403':
          $ref: '#/components/responses/UserInactive'

  /api/v1/auth/logout:
    post:
      tags: [Auth]
      summary: 로그아웃
      operationId: logout
      responses:
        '200':
          description: 로그아웃 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/users/me:
    get:
      tags: [Users]
      summary: 내 정보 조회
      operationId: getMe
      responses:
        '200':
          description: 현재 로그인 사용자 정보
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/dashboard/overview:
    get:
      tags: [Dashboard]
      summary: 대시보드 초기 데이터 조회
      operationId: getDashboardOverview
      parameters:
        - in: query
          name: includeActiveAlarms
          required: false
          schema:
            type: boolean
            default: true
      responses:
        '200':
          description: 대시보드 요약, 설비 목록, 활성 알람 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DashboardOverviewResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/dashboard/devices:
    get:
      tags: [Dashboard]
      summary: 대시보드 설비 목록 재조회
      operationId: getDashboardDevices
      parameters:
        - in: query
          name: status
          schema:
            $ref: '#/components/schemas/DeviceStatus'
        - in: query
          name: alarmState
          schema:
            $ref: '#/components/schemas/AlarmSeverity'
        - in: query
          name: keyword
          schema:
            type: string
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: size
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 20
      responses:
        '200':
          description: 설비 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DashboardDevicesResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/dashboard/active-alarms:
    get:
      tags: [Dashboard]
      summary: 대시보드 활성 알람 패널 조회
      operationId: getDashboardActiveAlarms
      parameters:
        - in: query
          name: limit
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 20
      responses:
        '200':
          description: 활성 알람 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ActiveAlarmsResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/system/health/summary:
    get:
      tags: [Dashboard]
      summary: System Health 요약 조회
      description: 선택형 보조 기능. 인증된 사용자가 시스템 구성요소 상태를 요약 조회한다.
      operationId: getSystemHealthSummary
      responses:
        '200':
          description: API, MQTT 브로커, TSDB 연결 상태 요약
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemHealthResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/devices/{deviceId}:
    get:
      tags: [Devices]
      summary: 설비 상세 조회
      operationId: getDeviceDetail
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: 설비 상세 정보
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeviceDetailResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/DeviceNotFound'

  /api/v1/devices/{deviceId}/timeseries:
    get:
      tags: [Devices]
      summary: 설비 시계열 데이터 조회
      operationId: getDeviceTimeseries
      parameters:
        - $ref: '#/components/parameters/DeviceId'
        - in: query
          name: from
          required: true
          schema:
            type: string
            format: date-time
        - in: query
          name: to
          required: true
          schema:
            type: string
            format: date-time
        - in: query
          name: bucket
          required: false
          description: "집계 버킷. 예: 1m, 5m, 1h"
          schema:
            type: string
        - in: query
          name: agg
          required: false
          description: "집계 함수. 예: avg, max, min, sum"
          schema:
            type: string
            enum: [avg, max, min, sum]
        - in: query
          name: tagIds
          required: false
          description: 쉼표로 구분한 Tag ID 목록
          schema:
            type: string
      responses:
        '200':
          description: 시계열 데이터 조회 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TimeseriesResponseEnvelope'
        '400':
          $ref: '#/components/responses/InvalidDateRange'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/DeviceNotFound'

  /api/v1/devices/{deviceId}/events:
    get:
      tags: [Devices]
      summary: 설비 최근 이벤트 조회
      operationId: getDeviceEvents
      parameters:
        - $ref: '#/components/parameters/DeviceId'
        - in: query
          name: types
          required: false
          schema:
            type: string
            description: "쉼표로 구분한 이벤트 타입. 예: ALARM,FAULT"
        - in: query
          name: limit
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 20
      responses:
        '200':
          description: 최근 이벤트 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeviceEventsResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/DeviceNotFound'

  /api/v1/devices/{deviceId}/tags/current:
    get:
      tags: [Devices]
      summary: 설비 현재 Tag 값 재조회
      operationId: getDeviceCurrentTags
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: 현재 Tag 값 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CurrentTagsResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/DeviceNotFound'

  /api/v1/alarms:
    get:
      tags: [Alarms]
      summary: 알람 이력 목록 조회
      operationId: getAlarms
      parameters:
        - in: query
          name: severity
          schema:
            $ref: '#/components/schemas/AlarmSeverity'
        - in: query
          name: acknowledged
          schema:
            type: boolean
        - in: query
          name: deviceId
          schema:
            type: string
        - in: query
          name: from
          schema:
            type: string
            format: date-time
        - in: query
          name: to
          schema:
            type: string
            format: date-time
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: size
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 20
      responses:
        '200':
          description: 알람 이력 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AlarmListResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/v1/alarms/{alarmId}:
    get:
      tags: [Alarms]
      summary: 알람 상세 조회
      operationId: getAlarmDetail
      parameters:
        - $ref: '#/components/parameters/AlarmId'
      responses:
        '200':
          description: 알람 상세 조회 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AlarmDetailResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/AlarmNotFound'

  /api/v1/alarms/{alarmId}/ack:
    post:
      tags: [Alarms]
      summary: 단건 Ack 처리
      description: |
        대시보드 Quick Ack와 알람 상세/목록의 단건 Ack는 동일 엔드포인트를 재사용합니다.
        이미 Ack된 알람에 대해 다시 요청이 들어오면 멱등하게 200 OK와 현재 상태를 반환합니다.
      operationId: ackAlarm
      parameters:
        - $ref: '#/components/parameters/AlarmId'
      responses:
        '200':
          description: Ack 처리 성공 또는 이미 Ack된 상태 반환
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AckAlarmResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/AlarmNotFound'

  /api/v1/alarms/ack/bulk:
    post:
      tags: [Alarms]
      summary: 일괄 Bulk Ack 처리
      operationId: bulkAckAlarms
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkAckRequest'
      responses:
        '200':
          description: Bulk Ack 처리 결과
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkAckResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/InvalidRequest'

  /api/v1/admin/devices:
    get:
      tags: [Admin Devices]
      summary: 관리자 설비 목록 조회
      operationId: adminListDevices
      parameters:
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: size
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 20
      responses:
        '200':
          description: 설비 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminDeviceListResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    post:
      tags: [Admin Devices]
      summary: 설비 등록
      operationId: adminCreateDevice
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AdminDeviceCreateRequest'
      responses:
        '201':
          description: 설비 생성 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminDeviceResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/DeviceDuplicated'
        '422':
          $ref: '#/components/responses/InvalidInput'

  /api/v1/admin/devices/{deviceId}:
    get:
      tags: [Admin Devices]
      summary: 관리자 설비 상세 조회
      operationId: adminGetDevice
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: 설비 상세 정보
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminDeviceResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'
    patch:
      tags: [Admin Devices]
      summary: 설비 수정
      operationId: adminUpdateDevice
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AdminDeviceUpdateRequest'
      responses:
        '200':
          description: 설비 수정 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminDeviceResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'
        '409':
          $ref: '#/components/responses/DeviceDuplicated'
    delete:
      tags: [Admin Devices]
      summary: 설비 삭제
      operationId: adminDeleteDevice
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '204':
          description: 삭제 성공
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'
        '409':
          $ref: '#/components/responses/DeviceInUse'

  /api/v1/admin/devices/{deviceId}/history:
    get:
      tags: [Admin Devices]
      summary: 설비 설정 변경 이력 조회
      operationId: adminListDeviceChangeHistory
      parameters:
        - $ref: '#/components/parameters/DeviceId'
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: size
          schema:
            type: integer
            minimum: 1
            maximum: 200
            default: 50
      responses:
        '200':
          description: 변경 이력 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminDeviceChangeHistoryResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'

  /api/v1/admin/devices/test-connection:
    post:
      tags: [Admin Devices]
      summary: 설비 통신 테스트
      operationId: adminTestDeviceConnection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TestConnectionRequest'
      responses:
        '200':
          description: 통신 테스트 결과
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TestConnectionResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/InvalidInput'
        '503':
          $ref: '#/components/responses/ConnectionTestFailed'

  /api/v1/admin/devices/{deviceId}/tags:
    get:
      tags: [Admin Tags]
      summary: Tag 목록 조회
      operationId: adminListDeviceTags
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: Tag 목록
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TagListResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'
    post:
      tags: [Admin Tags]
      summary: Tag + 임계값 통합 생성
      operationId: adminCreateTag
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TagCreateRequest'
      responses:
        '201':
          description: Tag 생성 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TagResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/DeviceNotFound'
        '409':
          $ref: '#/components/responses/TagDuplicated'
        '422':
          $ref: '#/components/responses/InvalidInput'

  /api/v1/admin/tags/{tagId}:
    get:
      tags: [Admin Tags]
      summary: Tag 설정 단건 조회
      operationId: adminGetTag
      parameters:
        - $ref: '#/components/parameters/TagId'
      responses:
        '200':
          description: Tag 상세 조회 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TagResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/TagNotFound'
    patch:
      tags: [Admin Tags]
      summary: Tag + 임계값 통합 수정
      operationId: adminUpdateTag
      parameters:
        - $ref: '#/components/parameters/TagId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TagUpdateRequest'
      responses:
        '200':
          description: Tag 수정 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TagResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/TagNotFound'
        '422':
          $ref: '#/components/responses/InvalidInput'
    delete:
      tags: [Admin Tags]
      summary: Tag 삭제
      operationId: adminDeleteTag
      parameters:
        - $ref: '#/components/parameters/TagId'
      responses:
        '204':
          description: Tag 삭제 성공
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/TagNotFound'
        '409':
          $ref: '#/components/responses/TagReferenced'

  /api/v1/admin/policies/data:
    get:
      tags: [Admin Policies]
      summary: 데이터 정책 조회
      operationId: adminGetDataPolicy
      responses:
        '200':
          description: 시스템 전역 데이터 정책
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DataPolicyResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
    patch:
      tags: [Admin Policies]
      summary: 데이터 정책 수정
      operationId: adminUpdateDataPolicy
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DataPolicyUpdateRequest'
      responses:
        '200':
          description: 데이터 정책 수정 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DataPolicyResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/InvalidPolicy'

  /api/v1/admin/policies/data/reset:
    post:
      tags: [Admin Policies]
      summary: 데이터 정책 초기화
      operationId: adminResetDataPolicy
      responses:
        '200':
          description: 기본 정책값 반환
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DataPolicyResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /api/v1/realtime/bootstrap:
    get:
      tags: [Realtime]
      summary: 실시간 bootstrap 조회
      description: 화면 진입 또는 MQTT 재연결 이후 최신 상태 동기화를 위한 초기 REST 스냅샷 조회 API
      operationId: getRealtimeBootstrap
      responses:
        '200':
          description: 마지막 상태 스냅샷과 구독 참고 정보
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RealtimeBootstrapResponseEnvelope'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    DeviceId:
      in: path
      name: deviceId
      required: true
      schema:
        type: string
      description: 설비 식별자
    AlarmId:
      in: path
      name: alarmId
      required: true
      schema:
        type: string
      description: 알람 식별자
    TagId:
      in: path
      name: tagId
      required: true
      schema:
        type: string
      description: Tag 식별자

  responses:
    Unauthorized:
      description: 인증 실패
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            unauthorized:
              value:
                success: false
                errorCode: UNAUTHORIZED
                message: 인증이 필요합니다.
    Forbidden:
      description: 권한 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            forbidden:
              value:
                success: false
                errorCode: FORBIDDEN
                message: 해당 작업을 수행할 권한이 없습니다.
    InvalidCredentials:
      description: 로그인 실패
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            invalidCredentials:
              value:
                success: false
                errorCode: INVALID_CREDENTIALS
                message: 사용자명 또는 비밀번호가 올바르지 않습니다.
    UserInactive:
      description: 비활성 사용자
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            userInactive:
              value:
                success: false
                errorCode: USER_INACTIVE
                message: 비활성 사용자입니다.
    DeviceNotFound:
      description: 설비 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            deviceNotFound:
              value:
                success: false
                errorCode: DEVICE_NOT_FOUND
                message: 설비를 찾을 수 없습니다.
    AlarmNotFound:
      description: 알람 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            alarmNotFound:
              value:
                success: false
                errorCode: ALARM_NOT_FOUND
                message: 알람을 찾을 수 없습니다.
    TagNotFound:
      description: Tag 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            tagNotFound:
              value:
                success: false
                errorCode: TAG_NOT_FOUND
                message: Tag를 찾을 수 없습니다.
    InvalidDateRange:
      description: 잘못된 날짜 범위
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            invalidDateRange:
              value:
                success: false
                errorCode: INVALID_DATE_RANGE
                message: 잘못된 날짜 범위입니다.
    InvalidRequest:
      description: 잘못된 요청
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
    InvalidInput:
      description: 입력값 오류
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            invalidInput:
              value:
                success: false
                errorCode: INVALID_INPUT
                message: 입력값이 올바르지 않습니다.
    DeviceDuplicated:
      description: 중복 설비
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            deviceDuplicated:
              value:
                success: false
                errorCode: DEVICE_DUPLICATED
                message: 동일한 IP, Port, Slave ID 조합의 설비가 이미 존재합니다.
    DeviceInUse:
      description: 삭제 불가 설비
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            deviceInUse:
              value:
                success: false
                errorCode: DEVICE_IN_USE
                message: 참조 중인 설비는 삭제할 수 없습니다.
    TagDuplicated:
      description: 중복 Tag
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            tagDuplicated:
              value:
                success: false
                errorCode: TAG_DUPLICATED
                message: 동일 설비 내 중복 Tag입니다.
    TagReferenced:
      description: 삭제 불가 Tag
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            tagReferenced:
              value:
                success: false
                errorCode: TAG_REFERENCED
                message: 참조 중인 Tag는 삭제할 수 없습니다.
    InvalidPolicy:
      description: 잘못된 정책
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            invalidPolicy:
              value:
                success: false
                errorCode: INVALID_POLICY
                message: 정책 값이 유효하지 않습니다.
    ConnectionTestFailed:
      description: 설비 통신 테스트 실패
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponseEnvelope'
          examples:
            connectionTestFailed:
              value:
                success: false
                errorCode: CONNECTION_TEST_FAILED
                message: 설비와 통신할 수 없습니다.

  schemas:
    PageInfo:
      type: object
      required: [page, size, totalElements, totalPages]
      properties:
        page:
          type: integer
        size:
          type: integer
        totalElements:
          type: integer
        totalPages:
          type: integer

    LoginRequest:
      type: object
      required: [username, password]
      properties:
        username:
          type: string
        password:
          type: string
          format: password

    UserRole:
      type: string
      enum: [OPERATOR, ADMIN]

    User:
      type: object
      required: [id, name, role]
      properties:
        id:
          type: string
        name:
          type: string
        role:
          $ref: '#/components/schemas/UserRole'

    LoginResponse:
      type: object
      required: [user, accessToken]
      properties:
        user:
          $ref: '#/components/schemas/User'
        accessToken:
          type: string

    MeResponse:
      type: object
      required: [id, name, role]
      properties:
        id:
          type: string
        name:
          type: string
        role:
          $ref: '#/components/schemas/UserRole'

    DeviceStatus:
      type: string
      enum: [ONLINE, OFFLINE]

    AlarmSeverity:
      type: string
      enum: [NORMAL, WARNING, CRITICAL]

    PrimaryTagValue:
      type: object
      required: [tagName, value]
      properties:
        tagName:
          type: string
        value:
          type: number
        unit:
          type: string

    DashboardDeviceSummary:
      type: object
      required: [deviceId, name, status, alarmState, lastSeen, primaryTags]
      properties:
        deviceId:
          type: string
        name:
          type: string
        status:
          $ref: '#/components/schemas/DeviceStatus'
        alarmState:
          $ref: '#/components/schemas/AlarmSeverity'
        lastSeen:
          type: string
          format: date-time
        primaryTags:
          type: array
          items:
            $ref: '#/components/schemas/PrimaryTagValue'

    AlarmSummary:
      type: object
      required: [alarmId, deviceId, deviceName, severity, occurredAt, acknowledged]
      properties:
        alarmId:
          type: string
        deviceId:
          type: string
        deviceName:
          type: string
        tagId:
          type: string
          nullable: true
        tagName:
          type: string
          nullable: true
        severity:
          $ref: '#/components/schemas/AlarmSeverity'
        occurredAt:
          type: string
          format: date-time
        acknowledged:
          type: boolean
        measuredValue:
          type: number
          nullable: true

    DashboardSummary:
      type: object
      required: [deviceCount, onlineCount, offlineCount, warningCount, criticalCount]
      properties:
        deviceCount:
          type: integer
        onlineCount:
          type: integer
        offlineCount:
          type: integer
        warningCount:
          type: integer
        criticalCount:
          type: integer

    DashboardOverviewResponse:
      type: object
      required: [summary, devices, activeAlarms]
      properties:
        summary:
          $ref: '#/components/schemas/DashboardSummary'
        devices:
          type: array
          items:
            $ref: '#/components/schemas/DashboardDeviceSummary'
        activeAlarms:
          type: array
          items:
            $ref: '#/components/schemas/AlarmSummary'

    HealthStatus:
      type: string
      enum: [UP, DOWN, DEGRADED, UNKNOWN]

    SystemHealthSummary:
      type: object
      required: [api, mqttBroker, tsdb]
      properties:
        api:
          $ref: '#/components/schemas/HealthStatus'
        mqttBroker:
          $ref: '#/components/schemas/HealthStatus'
        tsdb:
          $ref: '#/components/schemas/HealthStatus'

    CurrentTagValue:
      type: object
      required: [tagId, name, value, alarmState]
      properties:
        tagId:
          type: string
        name:
          type: string
        value:
          type: number
          nullable: true
        unit:
          type: string
          nullable: true
        alarmState:
          $ref: '#/components/schemas/AlarmSeverity'
        quality:
          type: string
          nullable: true
          description: 측정 품질 또는 데이터 품질 정보

    DeviceDetail:
      type: object
      required: [deviceId, name, ip, port, slaveId, status, lastSeen, stale, tags]
      properties:
        deviceId:
          type: string
        name:
          type: string
        ip:
          type: string
        port:
          type: integer
        slaveId:
          type: integer
        pollingIntervalSec:
          type: integer
          nullable: true
        status:
          $ref: '#/components/schemas/DeviceStatus'
        lastSeen:
          type: string
          format: date-time
        stale:
          type: boolean
        tags:
          type: array
          items:
            $ref: '#/components/schemas/CurrentTagValue'

    TimeseriesPoint:
      type: object
      required: [timestamp, value]
      properties:
        timestamp:
          type: string
          format: date-time
        value:
          type: number
          nullable: true

    TimeseriesSeries:
      type: object
      required: [tagId, tagName, points]
      properties:
        tagId:
          type: string
        tagName:
          type: string
        unit:
          type: string
          nullable: true
        points:
          type: array
          items:
            $ref: '#/components/schemas/TimeseriesPoint'

    DeviceEvent:
      type: object
      required: [eventId, type, occurredAt, message]
      properties:
        eventId:
          type: string
        type:
          type: string
          enum: [ALARM, FAULT, STATUS_CHANGE]
        occurredAt:
          type: string
          format: date-time
        severity:
          $ref: '#/components/schemas/AlarmSeverity'
        message:
          type: string

    ThresholdSnapshot:
      type: object
      properties:
        warning:
          type: number
          nullable: true
        critical:
          type: number
          nullable: true
        deadband:
          type: number
          nullable: true

    AlarmDetail:
      allOf:
        - $ref: '#/components/schemas/AlarmSummary'
        - type: object
          properties:
            currentState:
              $ref: '#/components/schemas/AlarmSeverity'
            acknowledgedAt:
              type: string
              format: date-time
              nullable: true
            thresholdSnapshot:
              $ref: '#/components/schemas/ThresholdSnapshot'
            relatedSeriesWindow:
              type: array
              items:
                $ref: '#/components/schemas/TimeseriesPoint'

    AckAlarmResponse:
      type: object
      required: [alarmId, acknowledged]
      properties:
        alarmId:
          type: string
        acknowledged:
          type: boolean
        acknowledgedAt:
          type: string
          format: date-time
          nullable: true

    BulkAckRequest:
      type: object
      required: [alarm_ids]
      properties:
        alarm_ids:
          type: array
          minItems: 1
          items:
            type: string

    BulkAckItem:
      type: object
      required: [alarmId, acknowledged]
      properties:
        alarmId:
          type: string
        acknowledged:
          type: boolean
        acknowledgedAt:
          type: string
          format: date-time
          nullable: true
        skipped:
          type: boolean
          default: false

    BulkAckResponse:
      type: object
      required: [ackedCount, skippedCount, items]
      properties:
        ackedCount:
          type: integer
        skippedCount:
          type: integer
        items:
          type: array
          items:
            $ref: '#/components/schemas/BulkAckItem'

    AdminDevice:
      type: object
      required: [deviceId, name, ip, port, slaveId, pollingIntervalSec]
      properties:
        deviceId:
          type: string
        name:
          type: string
        ip:
          type: string
        port:
          type: integer
        slaveId:
          type: integer
        pollingIntervalSec:
          type: integer
        status:
          $ref: '#/components/schemas/DeviceStatus'
          nullable: true
        tagCount:
          type: integer
          nullable: true

    AdminDeviceCreateRequest:
      type: object
      required: [name, ip, port, slave_id, polling_interval_sec]
      properties:
        name:
          type: string
        ip:
          type: string
        port:
          type: integer
          minimum: 1
          maximum: 65535
        slave_id:
          type: integer
          minimum: 1
        polling_interval_sec:
          type: integer
          minimum: 1
          maximum: 10

    AdminDeviceUpdateRequest:
      type: object
      properties:
        name:
          type: string
        ip:
          type: string
        port:
          type: integer
          minimum: 1
          maximum: 65535
        slave_id:
          type: integer
          minimum: 1
        polling_interval_sec:
          type: integer
          minimum: 1
          maximum: 10

    TestConnectionRequest:
      type: object
      required: [ip, port, slave_id]
      properties:
        ip:
          type: string
        port:
          type: integer
          minimum: 1
          maximum: 65535
        slave_id:
          type: integer
          minimum: 1
        timeout_sec:
          type: integer
          minimum: 1
          maximum: 30
          default: 2

    TestConnectionResult:
      type: object
      required: [reachable]
      properties:
        reachable:
          type: boolean
        response_time_ms:
          type: integer
          nullable: true
        message:
          type: string

    TagConfig:
      type: object
      required:
        [tagId, name, address, functionCode, dataType, displayOrder, thresholds]
      properties:
        tagId:
          type: string
        name:
          type: string
        address:
          type: integer
        functionCode:
          type: string
        dataType:
          type: string
          enum: [INT16, UINT16, INT32, UINT32, FLOAT32]
        unit:
          type: string
          nullable: true
        displayOrder:
          type: integer
        byteSwap:
          type: boolean
          default: false
        wordSwap:
          type: boolean
          default: false
        thresholds:
          $ref: '#/components/schemas/ThresholdSnapshot'

    TagCreateRequest:
      type: object
      required:
        [name, address, function_code, data_type, display_order]
      properties:
        name:
          type: string
        address:
          type: integer
          minimum: 1
        function_code:
          type: string
          example: Read Holding Registers
        data_type:
          type: string
          enum: [INT16, UINT16, INT32, UINT32, FLOAT32]
        unit:
          type: string
          nullable: true
        display_order:
          type: integer
          minimum: 0
        byte_swap:
          type: boolean
          default: false
        word_swap:
          type: boolean
          default: false
        warning_threshold:
          type: number
          nullable: true
        critical_threshold:
          type: number
          nullable: true
        deadband:
          type: number
          nullable: true

    TagUpdateRequest:
      type: object
      properties:
        name:
          type: string
        address:
          type: integer
          minimum: 1
        function_code:
          type: string
        data_type:
          type: string
          enum: [INT16, UINT16, INT32, UINT32, FLOAT32]
        unit:
          type: string
          nullable: true
        display_order:
          type: integer
          minimum: 0
        byte_swap:
          type: boolean
        word_swap:
          type: boolean
        warning_threshold:
          type: number
          nullable: true
        critical_threshold:
          type: number
          nullable: true
        deadband:
          type: number
          nullable: true

    DataPolicy:
      type: object
      required: [rawRetentionDays, aggregateRetentionDays, downsamplingInterval]
      properties:
        rawRetentionDays:
          type: integer
          minimum: 1
        aggregateRetentionDays:
          type: integer
          minimum: 1
        downsamplingInterval:
          type: string
          example: 10m

    DataPolicyUpdateRequest:
      type: object
      required: [raw_retention_days, aggregate_retention_days, downsampling_interval]
      properties:
        raw_retention_days:
          type: integer
          minimum: 1
        aggregate_retention_days:
          type: integer
          minimum: 1
        downsampling_interval:
          type: string

    RealtimeBootstrap:
      type: object
      required: [snapshot]
      properties:
        snapshot:
          type: object
          additionalProperties: true
          description: 마지막 상태 스냅샷. 구현 시 대시보드 overview 요약 구조를 재사용 가능
        topics:
          type: array
          items:
            type: string

    MessageResponse:
      type: object
      required: [message]
      properties:
        message:
          type: string

    ErrorResponseEnvelope:
      type: object
      required: [success, errorCode, message]
      properties:
        success:
          type: boolean
          const: false
        errorCode:
          type: string
        message:
          type: string

    LoginResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/LoginResponse'

    MeResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/MeResponse'

    MessageResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/MessageResponse'

    DashboardOverviewResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/DashboardOverviewResponse'

    DashboardDevicesResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [devices, pageInfo]
          properties:
            devices:
              type: array
              items:
                $ref: '#/components/schemas/DashboardDeviceSummary'
            pageInfo:
              $ref: '#/components/schemas/PageInfo'

    ActiveAlarmsResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [alarms]
          properties:
            alarms:
              type: array
              items:
                $ref: '#/components/schemas/AlarmSummary'

    SystemHealthResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/SystemHealthSummary'

    DeviceDetailResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/DeviceDetail'

    TimeseriesResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [series]
          properties:
            series:
              type: array
              items:
                $ref: '#/components/schemas/TimeseriesSeries'

    DeviceEventsResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [items]
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/DeviceEvent'

    CurrentTagsResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [tags]
          properties:
            tags:
              type: array
              items:
                $ref: '#/components/schemas/CurrentTagValue'

    AlarmListResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [items, pageInfo]
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/AlarmSummary'
            pageInfo:
              $ref: '#/components/schemas/PageInfo'

    AlarmDetailResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/AlarmDetail'

    AckAlarmResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/AckAlarmResponse'

    BulkAckResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/BulkAckResponse'

    DeviceChangeLogEntry:
      type: object
      required: [id, when, actor, action, summary]
      properties:
        id:
          type: string
        when:
          type: string
          format: date-time
        actor:
          type: string
          description: users.username (JWT 주체)
        action:
          type: string
          enum: [CREATE, UPDATE, ENABLE, DISABLE, DELETE]
        summary:
          type: string

    DeviceChangeHistoryData:
      type: object
      required: [entries, pageInfo]
      properties:
        entries:
          type: array
          items:
            $ref: '#/components/schemas/DeviceChangeLogEntry'
        pageInfo:
          $ref: '#/components/schemas/PageInfo'

    AdminDeviceChangeHistoryResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/DeviceChangeHistoryData'

    AdminDeviceListResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [devices, pageInfo]
          properties:
            devices:
              type: array
              items:
                $ref: '#/components/schemas/AdminDevice'
            pageInfo:
              $ref: '#/components/schemas/PageInfo'

    AdminDeviceResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/AdminDevice'

    TestConnectionResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/TestConnectionResult'

    TagListResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          type: object
          required: [tags]
          properties:
            tags:
              type: array
              items:
                $ref: '#/components/schemas/TagConfig'

    TagResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/TagConfig'

    DataPolicyResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/DataPolicy'

    RealtimeBootstrapResponseEnvelope:
      type: object
      required: [success, data]
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/RealtimeBootstrap'