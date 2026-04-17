package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceCreateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceListData;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceUpdateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.DeviceGroupOption;
import com.example.miniscada.api.admin.dto.AdminDtos.ConnectionTestDetailResult;
import com.example.miniscada.api.admin.dto.AdminDtos.TestConnectionRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.TestConnectionResult;
import com.example.miniscada.api.dashboard.dto.DashboardDtos.PageInfo;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceGroupRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import com.example.miniscada.polling.ModbusDevicePollService;
import com.ghgande.j2mod.modbus.facade.ModbusTCPMaster;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminDeviceService {

    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceTagRepository deviceTagRepository;
    private final ModbusDevicePollService modbusDevicePollService;
    private final DeviceChangeLogService deviceChangeLogService;

    @Transactional(readOnly = true)
    public List<DeviceGroupOption> listDeviceGroups() {
        return deviceGroupRepository.findAll().stream()
                .map(g -> new DeviceGroupOption(g.getId().toString(), g.getName()))
                .sorted(Comparator.comparing(DeviceGroupOption::name))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminDeviceListData list(int page, int size, String keyword, String status, String protocol, String group) {
        int p = Math.max(1, page);
        int s = Math.min(200, Math.max(1, size));
        Specification<DeviceEntity> spec = buildDeviceListSpec(keyword, status, protocol, group);
        Page<DeviceEntity> result = deviceRepository.findAll(
                spec,
                PageRequest.of(p - 1, s, Sort.by(Sort.Order.asc("name").ignoreCase())));
        var items = result.getContent().stream().map(this::toResponse).toList();
        PageInfo pi = new PageInfo(p, s, result.getTotalElements(), result.getTotalPages());
        return new AdminDeviceListData(items, pi);
    }

    private Specification<DeviceEntity> buildDeviceListSpec(String keyword, String status, String protocol, String group) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String kw = keyword.trim();
                try {
                    UUID id = UUID.fromString(kw);
                    predicates.add(cb.equal(root.get("id"), id));
                } catch (IllegalArgumentException ignored) {
                    String like = "%" + kw.toLowerCase(Locale.ROOT) + "%";
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.get("name")), like),
                            cb.like(cb.lower(root.get("code")), like),
                            cb.like(cb.lower(root.get("ipAddress")), like)
                    ));
                }
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }
            if (protocol != null && !protocol.isBlank() && !"ALL".equalsIgnoreCase(protocol.trim())) {
                predicates.add(cb.equal(root.get("protocolType"), protocol.trim()));
            }
            if (group != null && !group.isBlank() && !"ALL".equalsIgnoreCase(group.trim())) {
                String g = group.trim();
                if ("Ungrouped".equals(g)) {
                    predicates.add(cb.isNull(root.get("deviceGroupId")));
                } else {
                    Optional<com.example.miniscada.domain.device.DeviceGroupEntity> og = deviceGroupRepository.findByName(g);
                    if (og.isPresent()) {
                        predicates.add(cb.equal(root.get("deviceGroupId"), og.get().getId()));
                    } else {
                        predicates.add(cb.disjunction());
                    }
                }
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    @Transactional(readOnly = true)
    public AdminDeviceResponse get(UUID id) {
        DeviceEntity d = deviceRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        return toResponse(d);
    }

    @Transactional
    public AdminDeviceResponse create(AdminDeviceCreateRequest req, UUID actorUserId) {
        validateConn(req.ip(), req.port(), req.slaveId(), null);
        DeviceEntity d = new DeviceEntity();
        d.setId(UUID.randomUUID());
        d.setName(req.name());
        d.setCode("D-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        if (req.description() != null) {
            d.setDescription(req.description());
        }
        d.setProtocolType("MODBUS_TCP");
        d.setIpAddress(req.ip().trim());
        d.setPort(req.port());
        d.setSlaveId(req.slaveId());
        d.setPollingIntervalSec(req.pollingIntervalSec() != null ? req.pollingIntervalSec() : 5);
        if (req.timeoutMs() != null && req.timeoutMs() > 0) {
            d.setTimeoutMs(req.timeoutMs());
        }
        d.setStatus("UNKNOWN");
        if (req.deviceGroupId() != null && !req.deviceGroupId().isBlank()) {
            UUID gid = parseUuid(req.deviceGroupId(), "device_group_id");
            deviceGroupRepository.findById(gid)
                    .orElseThrow(() -> BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, "Device group not found"));
            d.setDeviceGroupId(gid);
        }
        Instant now = Instant.now();
        d.setCreatedAt(now);
        d.setUpdatedAt(now);
        deviceRepository.save(d);
        deviceChangeLogService.append(
                d.getId(),
                "CREATE",
                "Device created: " + d.getName() + " (" + d.getCode() + ")",
                actorUserId);
        return toResponse(d);
    }

    @Transactional
    public AdminDeviceResponse update(UUID id, AdminDeviceUpdateRequest req, UUID actorUserId) {
        DeviceEntity d = deviceRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        DeviceSnapshot before = DeviceSnapshot.from(d);
        String ip =
                req.ip() != null
                        ? req.ip().trim()
                        : (d.getIpAddress() != null ? d.getIpAddress().trim() : null);
        Integer port = req.port() != null ? req.port() : d.getPort();
        Integer slave = req.slaveId() != null ? req.slaveId() : d.getSlaveId();
        if (!connectionTupleUnchanged(d, ip, port, slave)) {
            validateConn(ip, port, slave, id);
        }
        if (req.name() != null) {
            d.setName(req.name());
        }
        if (req.description() != null) {
            d.setDescription(req.description());
        }
        if (req.ip() != null) {
            d.setIpAddress(req.ip().trim());
        }
        if (req.port() != null) {
            d.setPort(req.port());
        }
        if (req.slaveId() != null) {
            d.setSlaveId(req.slaveId());
        }
        if (req.pollingIntervalSec() != null) {
            d.setPollingIntervalSec(req.pollingIntervalSec());
        }
        if (req.timeoutMs() != null && req.timeoutMs() > 0) {
            d.setTimeoutMs(req.timeoutMs());
        }
        if (req.active() != null) {
            d.setActive(req.active());
        }
        if (req.deviceGroupId() != null) {
            if (req.deviceGroupId().isBlank()) {
                d.setDeviceGroupId(null);
            } else {
                UUID gid = parseUuid(req.deviceGroupId(), "device_group_id");
                deviceGroupRepository.findById(gid)
                        .orElseThrow(() -> BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, "Device group not found"));
                d.setDeviceGroupId(gid);
            }
        }
        if (req.protocolType() != null && !req.protocolType().isBlank()) {
            d.setProtocolType(normalizeProtocolType(req.protocolType()));
        }
        d.setUpdatedAt(Instant.now());
        deviceRepository.save(d);
        logIfChanged(id, before, d, actorUserId);
        return toResponse(d);
    }

    private static final Set<String> ALLOWED_DEVICE_PROTOCOLS =
            Set.of("MODBUS_TCP", "MODBUS_RTU", "SIMULATOR");

    private static String normalizeProtocolType(String raw) {
        String p = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if (!ALLOWED_DEVICE_PROTOCOLS.contains(p)) {
            throw BusinessException.badRequest(ErrorCode.INVALID_INPUT, "Invalid protocol_type");
        }
        return p;
    }

    @Transactional
    public void delete(UUID id, UUID actorUserId) {
        DeviceEntity d = deviceRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        deviceChangeLogService.append(
                id,
                "DELETE",
                "Device deleted: " + d.getName() + " (" + d.getCode() + ")",
                actorUserId);
        deviceRepository.deleteById(id);
    }

    public TestConnectionResult testConnection(TestConnectionRequest req) {
        int timeoutMs = (req.timeoutSec() != null ? req.timeoutSec() : 2) * 1000;
        long t0 = System.currentTimeMillis();
        ModbusTCPMaster master = new ModbusTCPMaster(req.ip(), req.port());
        master.setTimeout(timeoutMs);
        try {
            master.connect();
            master.readMultipleRegisters(req.slaveId(), 0, 1);
            int ms = (int) (System.currentTimeMillis() - t0);
            master.disconnect();
            return new TestConnectionResult(true, ms, "OK");
        } catch (Exception e) {
            return new TestConnectionResult(false, null, e.getMessage());
        }
    }

    /** Full connection test with per-tag reads (uses {@link ModbusDevicePollService} decoding). */
    public ConnectionTestDetailResult connectionTestReads(UUID deviceId) {
        if (!deviceRepository.existsById(deviceId)) {
            throw BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found");
        }
        return modbusDevicePollService.connectionTestWithTags(deviceId);
    }

    /** ip/port/slave가 기존과 동일하면 중복 검사 생략(편집 저장 시 오탐 방지). */
    private static boolean connectionTupleUnchanged(DeviceEntity d, String ip, Integer port, Integer slaveId) {
        String curIp = d.getIpAddress() == null ? null : d.getIpAddress().trim();
        return Objects.equals(curIp, ip)
                && Objects.equals(d.getPort(), port)
                && Objects.equals(d.getSlaveId(), slaveId);
    }

    private void validateConn(String ip, Integer port, Integer slaveId, UUID excludeId) {
        if (ip == null || port == null || slaveId == null) {
            throw BusinessException.badRequest(ErrorCode.INVALID_INPUT, "ip, port, slave_id required");
        }
        ip = ip.trim();
        boolean dup = excludeId == null
                ? deviceRepository.existsByIpAddressAndPortAndSlaveId(ip, port, slaveId)
                : deviceRepository.existsOtherWithSameConn(ip, port, slaveId, excludeId);
        if (dup) {
            throw BusinessException.conflict(ErrorCode.DEVICE_DUPLICATED, "Duplicate ip/port/slave");
        }
    }

    private static UUID parseUuid(String raw, String field) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest(ErrorCode.INVALID_INPUT, "Invalid " + field);
        }
    }

    private void logIfChanged(UUID deviceId, DeviceSnapshot before, DeviceEntity d, UUID actorUserId) {
        DeviceSnapshot after = DeviceSnapshot.from(d);
        List<String> lines = diffSnapshots(before, after);
        if (lines.isEmpty()) {
            return;
        }
        if (lines.size() == 1 && lines.get(0).startsWith("Active:")) {
            deviceChangeLogService.append(
                    deviceId,
                    d.isActive() ? "ENABLE" : "DISABLE",
                    d.isActive() ? "Device enabled" : "Device disabled",
                    actorUserId);
        } else {
            deviceChangeLogService.append(deviceId, "UPDATE", String.join(" · ", lines), actorUserId);
        }
    }

    private static List<String> diffSnapshots(DeviceSnapshot b, DeviceSnapshot a) {
        List<String> lines = new ArrayList<>();
        if (!Objects.equals(b.name(), a.name())) {
            lines.add("Name: '" + ellip(b.name(), 80) + "' → '" + ellip(a.name(), 80) + "'");
        }
        if (!Objects.equals(b.description(), a.description())) {
            lines.add("Description updated");
        }
        if (!Objects.equals(b.ip(), a.ip())) {
            lines.add("IP: '" + nz(b.ip()) + "' → '" + nz(a.ip()) + "'");
        }
        if (!Objects.equals(b.port(), a.port())) {
            lines.add("Port: " + nz(b.port()) + " → " + nz(a.port()));
        }
        if (!Objects.equals(b.slaveId(), a.slaveId())) {
            lines.add("Slave ID: " + nz(b.slaveId()) + " → " + nz(a.slaveId()));
        }
        if (b.pollingIntervalSec() != a.pollingIntervalSec()) {
            lines.add("Polling interval: " + b.pollingIntervalSec() + "s → " + a.pollingIntervalSec() + "s");
        }
        if (b.timeoutMs() != a.timeoutMs()) {
            lines.add("Timeout: " + b.timeoutMs() + "ms → " + a.timeoutMs() + "ms");
        }
        if (b.active() != a.active()) {
            lines.add(
                    "Active: " + (b.active() ? "active" : "inactive") + " → " + (a.active() ? "active" : "inactive"));
        }
        if (!Objects.equals(b.deviceGroupId(), a.deviceGroupId())) {
            lines.add("Device group: " + fmtUuid(b.deviceGroupId()) + " → " + fmtUuid(a.deviceGroupId()));
        }
        if (!Objects.equals(b.protocolType(), a.protocolType())) {
            lines.add("Protocol: " + b.protocolType() + " → " + a.protocolType());
        }
        return lines;
    }

    private static String nz(Object o) {
        return o == null ? "—" : String.valueOf(o);
    }

    private static String ellip(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, Math.max(0, max - 3)) + "...";
    }

    private static String fmtUuid(UUID id) {
        return id == null ? "none" : id.toString().substring(0, 8);
    }

    private record DeviceSnapshot(
            String name,
            String description,
            String ip,
            Integer port,
            Integer slaveId,
            int pollingIntervalSec,
            int timeoutMs,
            boolean active,
            UUID deviceGroupId,
            String protocolType
    ) {
        static DeviceSnapshot from(DeviceEntity d) {
            return new DeviceSnapshot(
                    d.getName(),
                    d.getDescription(),
                    d.getIpAddress(),
                    d.getPort(),
                    d.getSlaveId(),
                    d.getPollingIntervalSec(),
                    d.getTimeoutMs(),
                    d.isActive(),
                    d.getDeviceGroupId(),
                    d.getProtocolType());
        }
    }

    private AdminDeviceResponse toResponse(DeviceEntity d) {
        long tc = deviceTagRepository.countByDeviceId(d.getId());
        String groupName = null;
        if (d.getDeviceGroupId() != null) {
            groupName = deviceGroupRepository.findById(d.getDeviceGroupId()).map(g -> g.getName()).orElse(null);
        }
        return new AdminDeviceResponse(
                d.getId().toString(),
                d.getName(),
                d.getCode(),
                d.getDescription(),
                groupName,
                d.getProtocolType(),
                d.getIpAddress(),
                d.getPort(),
                d.getSlaveId(),
                d.getPollingIntervalSec(),
                d.getTimeoutMs(),
                d.getLastSeenAt(),
                d.isActive(),
                d.getStatus(),
                tc
        );
    }
}
