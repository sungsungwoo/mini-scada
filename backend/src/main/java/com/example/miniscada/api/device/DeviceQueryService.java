package com.example.miniscada.api.device;

import com.example.miniscada.api.device.dto.DeviceDtos;
import com.example.miniscada.api.device.dto.DeviceDtos.CurrentTagValue;
import com.example.miniscada.api.device.dto.DeviceDtos.CurrentTagsData;
import com.example.miniscada.api.device.dto.DeviceDtos.DeviceDetail;
import com.example.miniscada.api.device.dto.DeviceDtos.DeviceEvent;
import com.example.miniscada.api.device.dto.DeviceDtos.DeviceEventsData;
import com.example.miniscada.api.device.dto.DeviceDtos.TimeseriesData;
import com.example.miniscada.api.device.dto.DeviceDtos.TimeseriesPoint;
import com.example.miniscada.api.device.dto.DeviceDtos.TimeseriesSeries;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.alarm.AlarmEntity;
import com.example.miniscada.domain.alarm.AlarmRepository;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceGroupRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestRepository;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import com.example.miniscada.infra.jdbc.TagReadingJdbcRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceQueryService {

    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceTagRepository deviceTagRepository;
    private final DeviceTagLatestRepository deviceTagLatestRepository;
    private final TagReadingJdbcRepository tagReadingJdbcRepository;
    private final AlarmRepository alarmRepository;

    @Transactional(readOnly = true)
    public DeviceDetail getDevice(UUID deviceId) {
        DeviceEntity d = deviceRepository.findById(deviceId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        List<DeviceTagEntity> tags = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(deviceId);
        Map<UUID, DeviceTagLatestEntity> latest = deviceTagLatestRepository.findByDeviceId(deviceId).stream()
                .collect(Collectors.toMap(DeviceTagLatestEntity::getTagId, x -> x, (a, b) -> a));
        boolean stale = computeStale(d);
        String groupName = null;
        if (d.getDeviceGroupId() != null) {
            groupName = deviceGroupRepository.findById(d.getDeviceGroupId()).map(g -> g.getName()).orElse(null);
        }
        List<CurrentTagValue> tvs = tags.stream().map(t -> {
            DeviceTagLatestEntity l = latest.get(t.getId());
            return new CurrentTagValue(
                    t.getId().toString(),
                    t.getName(),
                    t.getCode(),
                    l != null ? l.getValueNumeric() : null,
                    t.getUnit(),
                    l != null ? l.getAlarmState() : "UNKNOWN",
                    l != null ? l.getQuality() : null
            );
        }).toList();
        return new DeviceDetail(
                d.getId().toString(),
                d.getName(),
                d.getCode(),
                d.getProtocolType(),
                groupName,
                d.getIpAddress(),
                d.getPort(),
                d.getSlaveId(),
                d.getPollingIntervalSec(),
                d.getTimeoutMs(),
                d.getStatus(),
                d.getLastSeenAt(),
                stale,
                tvs
        );
    }

    private boolean computeStale(DeviceEntity d) {
        if ("OFFLINE".equals(d.getStatus())) {
            return true;
        }
        if (d.getLastSeenAt() == null) {
            return true;
        }
        Instant threshold = Instant.now().minus(d.getOfflineThresholdSec(), ChronoUnit.SECONDS);
        return d.getLastSeenAt().isBefore(threshold);
    }

    @Transactional(readOnly = true)
    public TimeseriesData timeseries(UUID deviceId, Instant from, Instant to, String tagIdsCsv) {
        deviceRepository.findById(deviceId).orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        if (from.isAfter(to)) {
            throw BusinessException.badRequest(ErrorCode.INVALID_DATE_RANGE, "from must be <= to");
        }
        List<UUID> tagIds;
        if (tagIdsCsv == null || tagIdsCsv.isBlank()) {
            tagIds = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(deviceId).stream().map(DeviceTagEntity::getId).toList();
        } else {
            tagIds = Arrays.stream(tagIdsCsv.split(",")).map(String::trim).map(UUID::fromString).toList();
        }
        List<TimeseriesSeries> series = new ArrayList<>();
        for (UUID tagId : tagIds) {
            DeviceTagEntity tag = deviceTagRepository.findById(tagId).orElse(null);
            if (tag == null || !tag.getDeviceId().equals(deviceId)) {
                continue;
            }
            var pts = tagReadingJdbcRepository.fetchSeries(deviceId, tagId, from, to, 5000).stream()
                    .map(p -> new TimeseriesPoint(p.timestamp(), p.value()))
                    .toList();
            series.add(new TimeseriesSeries(tag.getId().toString(), tag.getName(), tag.getUnit(), pts));
        }
        return new TimeseriesData(series);
    }

    @Transactional(readOnly = true)
    public DeviceEventsData events(UUID deviceId, String typesCsv, int limit) {
        deviceRepository.findById(deviceId).orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        List<AlarmEntity> alarms = alarmRepository.findByDeviceIdOrderByStartedAtDesc(deviceId, PageRequest.of(0, limit));
        List<DeviceEvent> items = alarms.stream().map(a -> new DeviceEvent(
                a.getId().toString(),
                "ALARM",
                a.getStartedAt(),
                a.getSeverity(),
                a.getMessage()
        )).toList();
        return new DeviceEventsData(items);
    }

    @Transactional(readOnly = true)
    public CurrentTagsData currentTags(UUID deviceId) {
        DeviceDetail d = getDevice(deviceId);
        return new CurrentTagsData(d.tags());
    }
}
