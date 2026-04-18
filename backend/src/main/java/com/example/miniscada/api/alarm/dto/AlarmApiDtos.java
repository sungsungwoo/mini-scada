package com.example.miniscada.api.alarm.dto;

import com.example.miniscada.api.device.dto.DeviceDtos;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AlarmApiDtos {

    public record PageInfo(int page, int size, long totalElements, int totalPages) {
    }

    /** 미인지(OPEN) 알람 건수 — 대시보드 `openAlarmCount` 와 동일 소스. */
    public record OpenAlarmCount(long count) {
    }

    public record AlarmSummary(
            String alarmId,
            String deviceId,
            String deviceName,
            String tagId,
            String tagName,
            String severity,
            Instant occurredAt,
            boolean acknowledged,
            BigDecimal measuredValue
    ) {
    }

    public record AlarmListData(List<AlarmSummary> items, PageInfo pageInfo) {
    }

    /** 알람 상세의 임계값(태그 기준). null 이면 태그 없음. */
    public record AlarmThresholdsView(
            BigDecimal warningMin,
            BigDecimal warningMax,
            BigDecimal criticalMin,
            BigDecimal criticalMax,
            BigDecimal deadband
    ) {
    }

    public record AlarmDetail(
            String alarmId,
            /** 표시용 코드 (예: ALM-20260416-A1B2C3D4) */
            String displayCode,
            String deviceId,
            String deviceName,
            String groupName,
            String tagId,
            String tagName,
            String severity,
            String message,
            Instant occurredAt,
            Instant clearedAt,
            boolean acknowledged,
            String acknowledgedByUsername,
            Instant acknowledgedAt,
            /** DB 미구현 시 null */
            String ackComment,
            BigDecimal measuredValue,
            String unit,
            String currentState,
            AlarmThresholdsView thresholds,
            List<DeviceDtos.TimeseriesPoint> relatedSeriesWindow
    ) {
    }

    public record AckResponse(String alarmId, boolean acknowledged, Instant acknowledgedAt) {
    }

    public record BulkAckRequest(List<String> alarm_ids) {
    }

    public record BulkAckItem(String alarmId, boolean acknowledged, Instant acknowledgedAt, boolean skipped) {
    }

    public record BulkAckData(int ackedCount, int skippedCount, List<BulkAckItem> items) {
    }
}
