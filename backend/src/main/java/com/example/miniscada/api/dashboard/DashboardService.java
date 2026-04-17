package com.example.miniscada.api.dashboard;

import com.example.miniscada.api.dashboard.dto.DashboardDtos;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.ActiveAlarmsData;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.AlarmSummary;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DashboardDeviceSummary;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DashboardOverview;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DashboardSummary;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.DeviceListData;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PageInfo;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PollingLogRow;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PollingLogsData;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PrimaryTagValue;
import com.example.miniscada.domain.alarm.AlarmEntity;
import com.example.miniscada.domain.alarm.AlarmRepository;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceGroupRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.polling.PollingLogEntity;
import com.example.miniscada.domain.polling.PollingLogRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestEntity;
import com.example.miniscada.domain.tag.DeviceTagLatestRepository;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int PRIMARY_TAG_LIMIT = 3;

    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceTagRepository deviceTagRepository;
    private final DeviceTagLatestRepository deviceTagLatestRepository;
    private final AlarmRepository alarmRepository;
    private final PollingLogRepository pollingLogRepository;

    @Transactional(readOnly = true)
    public DashboardOverview overview(boolean includeActiveAlarms) {
        List<DeviceEntity> devices = deviceRepository.findByActiveTrueOrderByNameAsc();
        List<DashboardDeviceSummary> rows = devices.stream().map(this::toDeviceSummary).toList();

        int online = (int) devices.stream().filter(d -> "ONLINE".equals(d.getStatus())).count();
        int offline = (int) devices.stream().filter(d -> "OFFLINE".equals(d.getStatus())).count();
        int warnDevices = (int) rows.stream().filter(r -> "WARNING".equals(r.alarmState())).count();
        int critDevices = (int) rows.stream().filter(r -> "CRITICAL".equals(r.alarmState())).count();
        int openAlarmCount = (int) Math.min(alarmRepository.countByStatus("OPEN"), Integer.MAX_VALUE);

        DashboardSummary summary = new DashboardSummary(
                devices.size(),
                online,
                offline,
                warnDevices,
                critDevices,
                openAlarmCount
        );

        List<AlarmSummary> active = List.of();
        if (includeActiveAlarms) {
            List<AlarmEntity> open = alarmRepository.findByStatusOrderByStartedAtDesc("OPEN", PageRequest.of(0, 50));
            active = open.stream().map(this::toAlarmSummary).toList();
        }
        return new DashboardOverview(summary, rows, active);
    }

    @Transactional(readOnly = true)
    public DeviceListData devices(Integer page, int size, String status, String alarmState, String keyword) {
        int p = page == null ? 1 : page;
        final String kw = keyword != null && !keyword.isBlank() ? keyword.trim().toLowerCase() : null;
        List<DashboardDeviceSummary> all = deviceRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(this::toDeviceSummary)
                .filter(d -> status == null || status.equals(d.status()))
                .filter(d -> alarmState == null || alarmState.equals(d.alarmState()))
                .filter(d -> kw == null
                        || d.name().toLowerCase().contains(kw)
                        || (d.groupName() != null && d.groupName().toLowerCase().contains(kw))
                        || d.deviceId().toLowerCase().contains(kw))
                .toList();
        int from = Math.max(0, (p - 1) * size);
        int to = Math.min(from + size, all.size());
        List<DashboardDeviceSummary> slice = from >= all.size() ? List.of() : all.subList(from, to);
        int totalPages = (int) Math.ceil(all.size() / (double) size);
        PageInfo pi = new PageInfo(p, size, all.size(), totalPages);
        return new DeviceListData(slice, pi);
    }

    @Transactional(readOnly = true)
    public ActiveAlarmsData activeAlarms(int limit) {
        List<AlarmEntity> open = alarmRepository.findByStatusOrderByStartedAtDesc("OPEN", PageRequest.of(0, limit));
        return new ActiveAlarmsData(open.stream().map(this::toAlarmSummary).toList());
    }

    @Transactional(readOnly = true)
    public PollingLogsData pollingLogs(int limit) {
        int n = Math.min(200, Math.max(1, limit));
        List<PollingLogEntity> rows = pollingLogRepository.findByOrderByStartedAtDesc(PageRequest.of(0, n));
        List<PollingLogRow> items = rows.stream().map(this::toPollingRow).toList();
        return new PollingLogsData(items);
    }

    private PollingLogRow toPollingRow(PollingLogEntity p) {
        DeviceEntity d = deviceRepository.findById(p.getDeviceId()).orElse(null);
        String name = d != null ? d.getName() : "?";
        return new PollingLogRow(
                p.getDeviceId().toString(),
                name,
                p.getResult(),
                p.getLatencyMs(),
                p.getFinishedAt() != null ? p.getFinishedAt() : p.getStartedAt()
        );
    }

    private DashboardDeviceSummary toDeviceSummary(DeviceEntity d) {
        List<DeviceTagEntity> tags = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(d.getId());
        Map<UUID, DeviceTagLatestEntity> latestByTag = deviceTagLatestRepository.findByDeviceId(d.getId()).stream()
                .collect(Collectors.toMap(DeviceTagLatestEntity::getTagId, x -> x, (a, b) -> a));
        String worst = worstAlarmState(tags, latestByTag);
        String quality = worstQuality(tags, latestByTag);
        List<PrimaryTagValue> primary = tags.stream()
                .limit(PRIMARY_TAG_LIMIT)
                .map(t -> {
                    DeviceTagLatestEntity l = latestByTag.get(t.getId());
                    BigDecimal v = l != null ? l.getValueNumeric() : null;
                    return new PrimaryTagValue(t.getName(), v, t.getUnit());
                })
                .toList();
        String groupName = null;
        if (d.getDeviceGroupId() != null) {
            groupName = deviceGroupRepository.findById(d.getDeviceGroupId()).map(g -> g.getName()).orElse(null);
        }
        return new DashboardDeviceSummary(
                d.getId().toString(),
                groupName,
                d.getName(),
                d.getStatus(),
                worst,
                quality,
                d.getLastSeenAt(),
                primary
        );
    }

    private static String worstQuality(List<DeviceTagEntity> tags, Map<UUID, DeviceTagLatestEntity> latestByTag) {
        if (tags.isEmpty()) {
            return "UNKNOWN";
        }
        int worst = 0;
        for (DeviceTagEntity t : tags) {
            DeviceTagLatestEntity l = latestByTag.get(t.getId());
            if (l == null) {
                worst = Math.max(worst, 2);
                continue;
            }
            worst = Math.max(worst, qualityRank(l.getQuality()));
        }
        return labelForQualityRank(worst);
    }

    private static int qualityRank(String quality) {
        if (quality == null) {
            return 2;
        }
        return switch (quality) {
            case "TIMEOUT" -> 4;
            case "BAD" -> 3;
            case "UNCERTAIN" -> 2;
            case "GOOD" -> 1;
            default -> 2;
        };
    }

    private static String labelForQualityRank(int worst) {
        if (worst >= 4) {
            return "TIMEOUT";
        }
        if (worst == 3) {
            return "BAD";
        }
        if (worst == 2) {
            return "UNCERTAIN";
        }
        return "GOOD";
    }

    private static String worstAlarmState(List<DeviceTagEntity> tags, Map<UUID, DeviceTagLatestEntity> latestByTag) {
        int score = 0;
        for (DeviceTagEntity t : tags) {
            DeviceTagLatestEntity l = latestByTag.get(t.getId());
            if (l == null) {
                continue;
            }
            score = Math.max(score, alarmRank(l.getAlarmState()));
        }
        if (score >= 2) {
            return "CRITICAL";
        }
        if (score == 1) {
            return "WARNING";
        }
        return "NORMAL";
    }

    private static int alarmRank(String state) {
        if (state == null) {
            return 0;
        }
        return switch (state) {
            case "CRITICAL" -> 2;
            case "WARNING" -> 1;
            default -> 0;
        };
    }

    private AlarmSummary toAlarmSummary(AlarmEntity a) {
        DeviceEntity d = deviceRepository.findById(a.getDeviceId()).orElse(null);
        String deviceName = d != null ? d.getName() : "?";
        String tagName = null;
        if (a.getTagId() != null) {
            tagName = deviceTagRepository.findById(a.getTagId()).map(DeviceTagEntity::getName).orElse(null);
        }
        return new AlarmSummary(
                a.getId().toString(),
                a.getDeviceId().toString(),
                deviceName,
                a.getTagId() != null ? a.getTagId().toString() : null,
                tagName,
                a.getSeverity(),
                a.getStartedAt(),
                "ACKED".equals(a.getStatus()),
                a.getTriggeredValue()
        );
    }
}
