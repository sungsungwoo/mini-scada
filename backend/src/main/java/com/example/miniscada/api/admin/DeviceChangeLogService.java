package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.DeviceChangeHistoryData;
import com.example.miniscada.api.admin.dto.AdminDtos.DeviceChangeLogEntry;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PageInfo;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.device.DeviceChangeLogEntity;
import com.example.miniscada.domain.device.DeviceChangeLogRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.user.AppUser;
import com.example.miniscada.domain.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceChangeLogService {

    private final DeviceChangeLogRepository deviceChangeLogRepository;
    private final DeviceRepository deviceRepository;
    private final AppUserRepository appUserRepository;

    @Transactional
    public void append(UUID deviceId, String action, String summary, UUID actorUserId) {
        DeviceChangeLogEntity e = new DeviceChangeLogEntity();
        e.setId(UUID.randomUUID());
        e.setDeviceId(deviceId);
        e.setOccurredAt(Instant.now());
        e.setActorUserId(actorUserId);
        e.setAction(action);
        e.setSummary(summary);
        deviceChangeLogRepository.save(e);
    }

    @Transactional(readOnly = true)
    public DeviceChangeHistoryData list(UUID deviceId, int page, int size) {
        if (!deviceRepository.existsById(deviceId)) {
            throw BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found");
        }
        int p = Math.max(1, page);
        int s = Math.min(200, Math.max(1, size));
        Page<DeviceChangeLogEntity> result = deviceChangeLogRepository.findByDeviceIdOrderByOccurredAtDesc(
                deviceId,
                PageRequest.of(p - 1, s, Sort.by(Sort.Order.desc("occurredAt"))));
        List<DeviceChangeLogEntry> entries = new ArrayList<>();
        for (DeviceChangeLogEntity row : result.getContent()) {
            String actor = resolveActor(row.getActorUserId());
            entries.add(new DeviceChangeLogEntry(
                    row.getId().toString(),
                    row.getOccurredAt(),
                    actor,
                    row.getAction(),
                    row.getSummary()));
        }
        PageInfo pi = new PageInfo(p, s, result.getTotalElements(), result.getTotalPages());
        return new DeviceChangeHistoryData(entries, pi);
    }

    private String resolveActor(UUID actorUserId) {
        if (actorUserId == null) {
            return "—";
        }
        return appUserRepository.findById(actorUserId).map(AppUser::getUsername).orElseGet(() -> actorUserId.toString());
    }
}
