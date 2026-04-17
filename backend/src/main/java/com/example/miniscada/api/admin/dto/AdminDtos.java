package com.example.miniscada.api.admin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AdminDtos {

    public record AdminDeviceCreateRequest(
            String name,
            String description,
            String ip,
            Integer port,
            @JsonProperty("slave_id") Integer slaveId,
            @JsonProperty("polling_interval_sec") Integer pollingIntervalSec,
            @JsonProperty("timeout_ms") Integer timeoutMs,
            @JsonProperty("device_group_id") String deviceGroupId
    ) {
    }

    public record AdminDeviceUpdateRequest(
            String name,
            String description,
            String ip,
            Integer port,
            @JsonProperty("slave_id") Integer slaveId,
            @JsonProperty("polling_interval_sec") Integer pollingIntervalSec,
            @JsonProperty("timeout_ms") Integer timeoutMs,
            @JsonProperty("is_active") Boolean active,
            @JsonProperty("device_group_id") String deviceGroupId,
            @JsonProperty("protocol_type") String protocolType
    ) {
    }

    public record DeviceGroupOption(String id, String name) {
    }

    public record TestConnectionRequest(
            String ip,
            Integer port,
            @JsonProperty("slave_id") Integer slaveId,
            @JsonProperty("timeout_sec") Integer timeoutSec
    ) {
    }

    public record TestConnectionResult(boolean reachable, Integer response_time_ms, String message) {
    }

    /** Admin connection test page: real TCP read per enabled tag (MODBUS_TCP only). */
    public record ConnectionSampleTagRow(
            @JsonProperty("tagId") String tagId,
            String name,
            @JsonProperty("addressLabel") String addressLabel,
            @JsonProperty("valueDisplay") String valueDisplay,
            String result,
            @JsonProperty("errorMessage") String errorMessage
    ) {
    }

    public record ConnectionTestDetailResult(
            boolean success,
            boolean reachable,
            @JsonProperty("responseTimeMs") Integer responseTimeMs,
            String message,
            @JsonProperty("deviceId") String deviceId,
            String name,
            String code,
            @JsonProperty("groupName") String groupName,
            @JsonProperty("protocolType") String protocolType,
            String target,
            @JsonProperty("slaveId") Integer slaveId,
            @JsonProperty("pollingIntervalSec") Integer pollingIntervalSec,
            @JsonProperty("timeoutMs") Integer timeoutMs,
            @JsonProperty("sampleReads") List<ConnectionSampleTagRow> sampleReads,
            @JsonProperty("logLines") List<String> logLines,
            @JsonProperty("tagsOk") int tagsOk,
            @JsonProperty("tagsTotal") int tagsTotal
    ) {
    }

    public record AdminDeviceResponse(
            @JsonProperty("deviceId") String deviceId,
            @JsonProperty("name") String name,
            @JsonProperty("code") String code,
            @JsonProperty("description") String description,
            @JsonProperty("groupName") String groupName,
            @JsonProperty("protocolType") String protocolType,
            @JsonProperty("ip") String ip,
            @JsonProperty("port") Integer port,
            @JsonProperty("slaveId") Integer slaveId,
            @JsonProperty("pollingIntervalSec") Integer pollingIntervalSec,
            @JsonProperty("timeoutMs") Integer timeoutMs,
            @JsonProperty("lastSeenAt") Instant lastSeenAt,
            @JsonProperty("isActive") boolean active,
            @JsonProperty("status") String status,
            @JsonProperty("tagCount") Long tagCount
    ) {
    }

    public record AdminDeviceListData(List<AdminDeviceResponse> devices, com.example.miniscada.api.dashboard.dto.DashboardDtos.PageInfo pageInfo) {
    }

    public record TagCreateRequest(
            String name,
            Integer address,
            @JsonProperty("function_code") String functionCode,
            @JsonProperty("data_type") String dataType,
            String unit,
            @JsonProperty("display_order") Integer displayOrder,
            @JsonProperty("byte_swap") Boolean byteSwap,
            @JsonProperty("word_swap") Boolean wordSwap,
            @JsonProperty("warning_threshold") BigDecimal warningThreshold,
            @JsonProperty("critical_threshold") BigDecimal criticalThreshold,
            BigDecimal deadband
    ) {
    }

    public record TagUpdateRequest(
            String name,
            Integer address,
            @JsonProperty("function_code") String functionCode,
            @JsonProperty("data_type") String dataType,
            String unit,
            @JsonProperty("display_order") Integer displayOrder,
            @JsonProperty("byte_swap") Boolean byteSwap,
            @JsonProperty("word_swap") Boolean wordSwap,
            @JsonProperty("warning_threshold") BigDecimal warningThreshold,
            @JsonProperty("critical_threshold") BigDecimal criticalThreshold,
            BigDecimal deadband
    ) {
    }

    public record ThresholdSnapshot(
            BigDecimal warning,
            BigDecimal critical,
            BigDecimal deadband
    ) {
    }

    public record TagConfigResponse(
            String tagId,
            String name,
            Integer address,
            @JsonProperty("functionCode") String functionCode,
            @JsonProperty("dataType") String dataType,
            String unit,
            @JsonProperty("displayOrder") Integer displayOrder,
            @JsonProperty("byteSwap") boolean byteSwap,
            @JsonProperty("wordSwap") boolean wordSwap,
            ThresholdSnapshot thresholds
    ) {
    }

    public record TagListData(List<TagConfigResponse> tags) {
    }

    public record DataPolicyResponse(
            @JsonProperty("rawRetentionDays") int rawRetentionDays,
            @JsonProperty("aggregateRetentionDays") int aggregateRetentionDays,
            @JsonProperty("downsamplingInterval") String downsamplingInterval
    ) {
    }

    public record DataPolicyUpdateRequest(
            @JsonProperty("raw_retention_days") Integer rawRetentionDays,
            @JsonProperty("aggregate_retention_days") Integer aggregateRetentionDays,
            @JsonProperty("downsampling_interval") String downsamplingInterval
    ) {
    }

    /** 설비 변경 이력 한 줄 (프론트 프리뷰의 `when` 필드와 호환) */
    public record DeviceChangeLogEntry(
            String id,
            @JsonProperty("when") Instant when,
            String actor,
            String action,
            String summary
    ) {
    }

    public record DeviceChangeHistoryData(
            List<DeviceChangeLogEntry> entries,
            com.example.miniscada.api.dashboard.dto.DashboardDtos.PageInfo pageInfo
    ) {
    }
}
