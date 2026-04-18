package com.example.miniscada.api.alarm;

import com.example.miniscada.api.alarm.dto.AlarmApiDtos;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AckResponse;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmDetail;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmListData;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmSummary;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.BulkAckData;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.BulkAckItem;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.AlarmThresholdsView;
import com.example.miniscada.api.alarm.dto.AlarmApiDtos.PageInfo;
import com.example.miniscada.api.device.dto.DeviceDtos;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.alarm.AlarmEntity;
import com.example.miniscada.domain.alarm.AlarmRepository;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceGroupRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.user.AppUserRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestRepository;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import com.example.miniscada.infra.jdbc.TagReadingJdbcRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AlarmService {

    private final AlarmRepository alarmRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceTagRepository deviceTagRepository;
    private final DeviceTagLatestRepository deviceTagLatestRepository;
    private final TagReadingJdbcRepository tagReadingJdbcRepository;
    private final AppUserRepository appUserRepository;

    @Transactional(readOnly = true)
    public long countOpenAlarms() {
        return alarmRepository.countByStatus("OPEN");
    }

    @Transactional(readOnly = true)
    public AlarmListData list(
            String severity,
            Boolean acknowledged,
            UUID deviceId,
            Instant from,
            Instant to,
            String keyword,
            int page,
            int size
    ) {
        Specification<AlarmEntity> spec = (root, q, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (severity != null) {
                ps.add(cb.equal(root.get("severity"), severity));
            }
            if (acknowledged != null) {
                if (acknowledged) {
                    ps.add(cb.equal(root.get("status"), "ACKED"));
                } else {
                    ps.add(cb.equal(root.get("status"), "OPEN"));
                }
            }
            if (deviceId != null) {
                ps.add(cb.equal(root.get("deviceId"), deviceId));
            }
            if (from != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("startedAt"), from));
            }
            if (to != null) {
                ps.add(cb.lessThanOrEqualTo(root.get("startedAt"), to));
            }
            if (keyword != null && !keyword.isBlank()) {
                String raw = keyword.trim();
                String pattern = "%" + raw.toLowerCase() + "%";
                Subquery<UUID> deviceSub = q.subquery(UUID.class);
                Root<DeviceEntity> dev = deviceSub.from(DeviceEntity.class);
                deviceSub.select(dev.get("id"));
                deviceSub.where(cb.like(cb.lower(dev.get("name")), pattern));
                Predicate byDeviceName = root.get("deviceId").in(deviceSub);
                Predicate byMessage = cb.like(cb.lower(root.get("message")), pattern);
                Predicate bySeverity = cb.like(cb.lower(root.get("severity")), pattern);
                List<Predicate> orKw = new ArrayList<>();
                orKw.add(byDeviceName);
                orKw.add(byMessage);
                orKw.add(bySeverity);
                try {
                    UUID id = UUID.fromString(raw);
                    orKw.add(cb.equal(root.get("id"), id));
                } catch (IllegalArgumentException ignored) {
                    // partial id search not supported
                }
                ps.add(cb.or(orKw.toArray(new Predicate[0])));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        Page<AlarmEntity> p = alarmRepository.findAll(
                spec,
                PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "startedAt"))
        );
        List<AlarmSummary> items = p.getContent().stream().map(this::toSummary).toList();
        PageInfo pi = new PageInfo(page, size, p.getTotalElements(), p.getTotalPages());
        return new AlarmListData(items, pi);
    }

    @Transactional(readOnly = true)
    public AlarmDetail get(UUID alarmId) {
        AlarmEntity a = alarmRepository.findById(alarmId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.ALARM_NOT_FOUND, "Alarm not found"));
        return toDetail(a);
    }

    @Transactional
    public AckResponse ack(UUID alarmId, UUID actorUserId) {
        AlarmEntity a = alarmRepository.findById(alarmId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.ALARM_NOT_FOUND, "Alarm not found"));
        if ("ACKED".equals(a.getStatus())) {
            return new AckResponse(a.getId().toString(), true, a.getAckedAt());
        }
        a.setStatus("ACKED");
        a.setAckedAt(Instant.now());
        a.setAckedBy(actorUserId);
        a.setUpdatedAt(Instant.now());
        alarmRepository.save(a);
        return new AckResponse(a.getId().toString(), true, a.getAckedAt());
    }

    @Transactional
    public BulkAckData bulkAck(List<String> alarmIds, UUID actorUserId) {
        if (alarmIds == null || alarmIds.isEmpty()) {
            throw BusinessException.badRequest(ErrorCode.INVALID_REQUEST, "alarm_ids required");
        }
        List<BulkAckItem> items = new ArrayList<>();
        int acked = 0;
        int skipped = 0;
        for (String idStr : alarmIds) {
            UUID id = UUID.fromString(idStr);
            AlarmEntity a = alarmRepository.findById(id).orElse(null);
            if (a == null) {
                skipped++;
                items.add(new BulkAckItem(idStr, false, null, true));
                continue;
            }
            if ("ACKED".equals(a.getStatus())) {
                items.add(new BulkAckItem(idStr, true, a.getAckedAt(), false));
                continue;
            }
            a.setStatus("ACKED");
            a.setAckedAt(Instant.now());
            a.setAckedBy(actorUserId);
            a.setUpdatedAt(Instant.now());
            alarmRepository.save(a);
            acked++;
            items.add(new BulkAckItem(idStr, true, a.getAckedAt(), false));
        }
        return new BulkAckData(acked, skipped, items);
    }

    private AlarmSummary toSummary(AlarmEntity a) {
        DeviceEntity d = deviceRepository.findById(a.getDeviceId()).orElse(null);
        String tagName = null;
        if (a.getTagId() != null) {
            tagName = deviceTagRepository.findById(a.getTagId()).map(DeviceTagEntity::getName).orElse(null);
        }
        return new AlarmSummary(
                a.getId().toString(),
                a.getDeviceId().toString(),
                d != null ? d.getName() : "?",
                a.getTagId() != null ? a.getTagId().toString() : null,
                tagName,
                a.getSeverity(),
                a.getStartedAt(),
                "ACKED".equals(a.getStatus()),
                a.getTriggeredValue()
        );
    }

    private AlarmDetail toDetail(AlarmEntity a) {
        AlarmSummary s = toSummary(a);
        DeviceEntity device = deviceRepository.findById(a.getDeviceId()).orElse(null);
        String groupName = null;
        if (device != null && device.getDeviceGroupId() != null) {
            groupName = deviceGroupRepository.findById(device.getDeviceGroupId())
                    .map(g -> g.getName())
                    .orElse(null);
        }
        DeviceTagEntity tag = a.getTagId() != null
                ? deviceTagRepository.findById(a.getTagId()).orElse(null)
                : null;
        AlarmThresholdsView th = tag == null ? null : new AlarmThresholdsView(
                tag.getWarningMin(),
                tag.getWarningMax(),
                tag.getCriticalMin(),
                tag.getCriticalMax(),
                tag.getDeadband()
        );
        List<DeviceDtos.TimeseriesPoint> window = List.of();
        if (a.getTagId() != null && a.getDeviceId() != null) {
            Instant to = a.getStartedAt();
            Instant from = to.minusSeconds(3600);
            window = tagReadingJdbcRepository.fetchSeries(a.getDeviceId(), a.getTagId(), from, to, 200).stream()
                    .map(p -> new DeviceDtos.TimeseriesPoint(p.timestamp(), p.value()))
                    .toList();
        }
        String currentState = "NORMAL";
        if (a.getTagId() != null) {
            currentState = deviceTagLatestRepository.findByTagId(a.getTagId())
                    .map(l -> l.getAlarmState() != null ? l.getAlarmState() : "UNKNOWN")
                    .orElse("UNKNOWN");
        }
        String ackBy = null;
        if (a.getAckedBy() != null) {
            ackBy = appUserRepository.findById(a.getAckedBy()).map(u -> u.getUsername()).orElse(null);
        }
        String day = DateTimeFormatter.ofPattern("yyyyMMdd")
                .withZone(ZoneId.of("Asia/Seoul"))
                .format(a.getStartedAt());
        String shortHex = a.getId().toString().replace("-", "").substring(0, 8).toUpperCase();
        String displayCode = "ALM-" + day + "-" + shortHex;
        return new AlarmDetail(
                s.alarmId(),
                displayCode,
                s.deviceId(),
                s.deviceName(),
                groupName,
                s.tagId(),
                s.tagName(),
                s.severity(),
                a.getMessage(),
                s.occurredAt(),
                a.getClearedAt(),
                s.acknowledged(),
                ackBy,
                a.getAckedAt(),
                null,
                s.measuredValue(),
                tag != null ? tag.getUnit() : null,
                currentState,
                th,
                window
        );
    }
}
