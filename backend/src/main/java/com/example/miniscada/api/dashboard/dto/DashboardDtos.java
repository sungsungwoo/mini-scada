package com.example.miniscada.api.dashboard.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class DashboardDtos {

    public record DashboardSummary(
            int deviceCount,
            int onlineCount,
            int offlineCount,
            int warningCount,
            int criticalCount,
            int openAlarmCount
    ) {
    }

    public record PrimaryTagValue(String tagName, BigDecimal value, String unit) {
    }

    public record DashboardDeviceSummary(
            String deviceId,
            String groupName,
            String name,
            String status,
            String alarmState,
            String worstQuality,
            Instant lastSeen,
            List<PrimaryTagValue> primaryTags
    ) {
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

    public record DashboardOverview(
            DashboardSummary summary,
            List<DashboardDeviceSummary> devices,
            List<AlarmSummary> activeAlarms
    ) {
    }

    public record PageInfo(int page, int size, long totalElements, int totalPages) {
    }

    public record DeviceListData(List<DashboardDeviceSummary> devices, PageInfo pageInfo) {
    }

    public record ActiveAlarmsData(List<AlarmSummary> alarms) {
    }

    public record PollingLogRow(
            String deviceId,
            String deviceName,
            String result,
            Integer latencyMs,
            Instant finishedAt
    ) {
    }

    public record PollingLogsData(List<PollingLogRow> items) {
    }
}
