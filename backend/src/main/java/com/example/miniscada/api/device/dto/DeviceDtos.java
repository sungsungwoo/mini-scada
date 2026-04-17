package com.example.miniscada.api.device.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class DeviceDtos {

    public record CurrentTagValue(
            String tagId,
            String name,
            String code,
            BigDecimal value,
            String unit,
            String alarmState,
            String quality
    ) {
    }

    public record DeviceDetail(
            String deviceId,
            String name,
            String code,
            String protocolType,
            String groupName,
            String ip,
            Integer port,
            Integer slaveId,
            Integer pollingIntervalSec,
            Integer timeoutMs,
            String status,
            Instant lastSeen,
            boolean stale,
            List<CurrentTagValue> tags
    ) {
    }

    public record TimeseriesPoint(Instant timestamp, BigDecimal value) {
    }

    public record TimeseriesSeries(String tagId, String tagName, String unit, List<TimeseriesPoint> points) {
    }

    public record TimeseriesData(List<TimeseriesSeries> series) {
    }

    public record DeviceEvent(
            String eventId,
            String type,
            Instant occurredAt,
            String severity,
            String message
    ) {
    }

    public record DeviceEventsData(List<DeviceEvent> items) {
    }

    public record CurrentTagsData(List<CurrentTagValue> tags) {
    }
}
