package com.example.miniscada.polling;

import com.example.miniscada.domain.alarm.AlarmEntity;
import com.example.miniscada.domain.alarm.AlarmRepository;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestRepository;
import com.example.miniscada.infra.jdbc.TagReadingJdbcRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DevicePollPersistenceService {

    private final TagReadingJdbcRepository tagReadingJdbcRepository;
    private final DeviceTagLatestRepository deviceTagLatestRepository;
    private final AlarmRepository alarmRepository;
    private final DeviceRepository deviceRepository;

    public static String evaluateAlarmState(BigDecimal v, DeviceTagEntity t) {
        if (v == null) {
            return "UNKNOWN";
        }
        if (t.getCriticalMax() != null && v.compareTo(t.getCriticalMax()) >= 0) {
            return "CRITICAL";
        }
        if (t.getCriticalMin() != null && v.compareTo(t.getCriticalMin()) <= 0) {
            return "CRITICAL";
        }
        if (t.getWarningMax() != null && v.compareTo(t.getWarningMax()) >= 0) {
            return "WARNING";
        }
        if (t.getWarningMin() != null && v.compareTo(t.getWarningMin()) <= 0) {
            return "WARNING";
        }
        return "NORMAL";
    }

    @Transactional
    public List<UUID> applyOnlinePoll(UUID deviceId, Instant collectedAt, List<TagPollSample> samples) {
        DeviceEntity device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalStateException("device not found"));
        List<UUID> touchedAlarmIds = new ArrayList<>();
        UUID did = device.getId();
        if (samples.isEmpty()) {
            device.setLastSeenAt(collectedAt);
            device.setStatus("ONLINE");
            device.setUpdatedAt(collectedAt);
            deviceRepository.save(device);
            return touchedAlarmIds;
        }
        for (TagPollSample s : samples) {
            DeviceTagEntity tag = s.tag();
            tagReadingJdbcRepository.insert(collectedAt, tag.getId(), did, s.value(), s.quality(), s.alarmState());
            DeviceTagLatestEntity latest = deviceTagLatestRepository.findById(tag.getId()).orElseGet(() -> {
                DeviceTagLatestEntity e = new DeviceTagLatestEntity();
                e.setTagId(tag.getId());
                e.setDeviceId(did);
                return e;
            });
            latest.setValueNumeric(s.value());
            latest.setQuality(s.quality());
            latest.setAlarmState(s.alarmState());
            latest.setCollectedAt(collectedAt);
            latest.setUpdatedAt(collectedAt);
            deviceTagLatestRepository.save(latest);
            syncThresholdAlarm(device, tag, s.value(), s.alarmState(), collectedAt).ifPresent(touchedAlarmIds::add);
        }
        device.setLastSeenAt(collectedAt);
        device.setStatus("ONLINE");
        device.setUpdatedAt(collectedAt);
        deviceRepository.save(device);
        return touchedAlarmIds;
    }

    @Transactional
    public void markOffline(UUID deviceId, Instant now) {
        deviceRepository.findById(deviceId).ifPresent(d -> {
            d.setStatus("OFFLINE");
            d.setUpdatedAt(now);
            deviceRepository.save(d);
        });
    }

    private Optional<UUID> syncThresholdAlarm(
            DeviceEntity d,
            DeviceTagEntity tag,
            BigDecimal value,
            String alarmState,
            Instant now
    ) {
        var open = alarmRepository.findFirstByDeviceIdAndTagIdAndAlarmTypeAndStatus(
                d.getId(), tag.getId(), "THRESHOLD", "OPEN");
        if ("NORMAL".equals(alarmState)) {
            open.ifPresent(a -> {
                a.setStatus("CLEARED");
                a.setClearedAt(now);
                a.setUpdatedAt(now);
                alarmRepository.save(a);
            });
            return Optional.empty();
        }
        String severity = "CRITICAL".equals(alarmState) ? "CRITICAL" : "WARNING";
        BigDecimal th = "CRITICAL".equals(alarmState)
                ? firstNonNull(tag.getCriticalMax(), tag.getCriticalMin())
                : firstNonNull(tag.getWarningMax(), tag.getWarningMin());
        String msg = severity + " on " + tag.getName();
        if (open.isEmpty()) {
            AlarmEntity a = new AlarmEntity();
            a.setId(UUID.randomUUID());
            a.setDeviceId(d.getId());
            a.setTagId(tag.getId());
            a.setAlarmType("THRESHOLD");
            a.setSeverity(severity);
            a.setStatus("OPEN");
            a.setMessage(msg);
            a.setTriggeredValue(value);
            a.setThresholdValue(th);
            a.setStartedAt(now);
            a.setCreatedAt(now);
            a.setUpdatedAt(now);
            alarmRepository.save(a);
            return Optional.of(a.getId());
        }
        AlarmEntity a = open.get();
        boolean changed = !severity.equals(a.getSeverity());
        a.setSeverity(severity);
        a.setTriggeredValue(value);
        a.setThresholdValue(th);
        a.setMessage(msg);
        a.setUpdatedAt(now);
        alarmRepository.save(a);
        return changed ? Optional.of(a.getId()) : Optional.empty();
    }

    private static BigDecimal firstNonNull(BigDecimal a, BigDecimal b) {
        return a != null ? a : b;
    }
}
