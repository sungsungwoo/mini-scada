package com.example.miniscada.polling;

import com.example.miniscada.api.admin.dto.AdminDtos.ConnectionSampleTagRow;
import com.example.miniscada.api.admin.dto.AdminDtos.ConnectionTestDetailResult;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceGroupRepository;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import com.example.miniscada.realtime.MqttPublishService;
import com.ghgande.j2mod.modbus.facade.ModbusTCPMaster;
import com.ghgande.j2mod.modbus.procimg.InputRegister;
import com.ghgande.j2mod.modbus.procimg.Register;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ModbusDevicePollService {

    private final DeviceRepository deviceRepository;
    private final DeviceGroupRepository deviceGroupRepository;
    private final DeviceTagRepository deviceTagRepository;
    private final DevicePollPersistenceService devicePollPersistenceService;
    private final MqttPublishService mqttPublishService;
    private final PollingLogWriter pollingLogWriter;

    public void pollDevice(UUID deviceId) {
        DeviceEntity device = deviceRepository.findById(deviceId).orElse(null);
        if (device == null || !device.isActive()) {
            return;
        }
        if (!"MODBUS_TCP".equalsIgnoreCase(device.getProtocolType())) {
            return;
        }
        String ip = device.getIpAddress() == null ? null : device.getIpAddress().trim();
        if (ip == null || ip.isBlank() || device.getPort() == null || device.getSlaveId() == null) {
            return;
        }

        List<DeviceTagEntity> tags = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(deviceId);
        long enabledCount = tags.stream().filter(DeviceTagEntity::isEnabled).count();

        Instant pollStarted = Instant.now();
        long startNs = System.nanoTime();

        ModbusTCPMaster master = new ModbusTCPMaster(ip, device.getPort());
        // 스케줄 폴링도 동일 j2mod 타임아웃; Docker→호스트 Modbus 시 너무 짧으면 Connect timed out
        master.setTimeout(Math.max(3_000, Math.max(500, device.getTimeoutMs())));
        List<TagPollSample> samples = new ArrayList<>();
        try {
            log.info(
                    "ModbusTCP connect attempt (scheduled poll): code={} deviceId={} host={} port={}",
                    device.getCode(),
                    deviceId,
                    ip,
                    device.getPort());
            master.connect();
            int slave = device.getSlaveId();
            for (DeviceTagEntity tag : tags) {
                if (!tag.isEnabled()) {
                    continue;
                }
                try {
                    TagPollSample s = readTag(master, slave, tag);
                    if (s != null) {
                        samples.add(s);
                    }
                } catch (Exception ex) {
                    log.debug("Tag read failed {} {}: {}", device.getCode(), tag.getCode(), ex.getMessage());
                }
            }
        } catch (Exception e) {
            String err = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (isLikelyUnreachableNetwork(err)) {
                log.debug("Modbus poll failed {}: {}", device.getCode(), err);
            } else {
                log.warn("Modbus poll failed {}: {}", device.getCode(), err);
            }
            Instant failAt = Instant.now();
            devicePollPersistenceService.markOffline(deviceId, failAt);
            pollingLogWriter.append(
                    deviceId,
                    pollStarted,
                    failAt,
                    "ERROR",
                    latencyMs(startNs),
                    null,
                    err
            );
            return;
        } finally {
            try {
                master.disconnect();
            } catch (Exception ignored) {
            }
        }

        String result;
        String errMsg = null;
        if (enabledCount > 0 && samples.isEmpty()) {
            result = "ERROR";
            errMsg = "All enabled tag reads failed";
        } else if (enabledCount > samples.size()) {
            result = "PARTIAL_SUCCESS";
        } else {
            result = "SUCCESS";
        }

        Instant collectedAt = Instant.now();
        List<UUID> alarmIds = devicePollPersistenceService.applyOnlinePoll(deviceId, collectedAt, samples);
        publishMqtt(deviceId, samples, collectedAt, alarmIds);

        Instant finishedAt = Instant.now();
        pollingLogWriter.append(
                deviceId,
                pollStarted,
                finishedAt,
                result,
                latencyMs(startNs),
                null,
                errMsg
        );
    }

    /**
     * 시뮬레이터 미기동·Docker에서 127.0.0.1 오설정 등으로 매 스케줄마다 WARN이 쌓이는 것을 막기 위해,
     * 전형적인 "대상 없음" 네트워크 오류는 DEBUG만 남김. (근본 해결은 디바이스 IP를 백엔드가 실제로 닿는 주소로 저장.)
     */
    private static boolean isLikelyUnreachableNetwork(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String m = message.toLowerCase();
        return m.contains("connection refused")
                || m.contains("connection timed out")
                || m.contains("timed out")
                || m.contains("connection reset")
                || m.contains("no route to host")
                || m.contains("host is down")
                || m.contains("network is unreachable");
    }

    private static int latencyMs(long startNs) {
        long ms = (System.nanoTime() - startNs) / 1_000_000L;
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0, ms));
    }

    private TagPollSample readTag(ModbusTCPMaster master, int slave, DeviceTagEntity tag) throws Exception {
        int fc = tag.getFunctionCode();
        int qty = ModbusValueParser.registerWordCount(tag.getDataType(), tag.getQuantity());
        int addr = tag.getAddress();
        Register[] regs;
        if (fc == 3) {
            regs = master.readMultipleRegisters(slave, addr, qty);
        } else if (fc == 4) {
            InputRegister[] ir = master.readInputRegisters(slave, addr, qty);
            regs = ModbusValueParser.toRegisters(ir);
        } else {
            return null;
        }
        boolean[] sw = SwapEncoding.decode(tag.getByteOrder());
        BigDecimal value = ModbusValueParser.parse(
                tag.getDataType(),
                regs,
                sw[0],
                sw[1],
                tag.getScaleFactor(),
                tag.getOffsetValue()
        );
        String quality = value == null ? "BAD" : "GOOD";
        String alarmState = value == null ? "UNKNOWN" : DevicePollPersistenceService.evaluateAlarmState(value, tag);
        return new TagPollSample(tag, value, alarmState, quality);
    }

    /**
     * Admin UI: connect with stored IP/port/slave and read each tag (same decoding as polling). No DB/MQTT side effects.
     */
    public ConnectionTestDetailResult connectionTestWithTags(UUID deviceId) {
        DeviceEntity device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalStateException("Device not found"));
        String groupName = resolveGroupName(device);
        List<DeviceTagEntity> tags = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(deviceId);
        List<String> logs = new ArrayList<>();

        if (!"MODBUS_TCP".equalsIgnoreCase(device.getProtocolType())) {
            logs.add(tsPrefix() + " Protocol is " + device.getProtocolType() + " — tag reads skipped (MODBUS_TCP only)");
            return detailShell(device, groupName, tagsSkippedNonTcp(tags, device.getProtocolType()), logs,
                    false, false, null, "Tag read test is only available for MODBUS_TCP", 0, enabledCount(tags));
        }

        if (connectionParamsIncomplete(device)) {
            String msg = "IP, port, and slave ID are required for connection test";
            logs.add(tsPrefix() + " " + msg);
            return detailShell(device, groupName, tagsSkippedParams(tags, msg), logs,
                    false, false, null, msg, 0, enabledCount(tags));
        }

        log.info(
                "Admin connection test: deviceId={} code={} target={} slaveId={} tagCount={}",
                deviceId,
                device.getCode(),
                formatTarget(device),
                device.getSlaveId(),
                tags.size());

        // j2mod: 이 값이 TCP connect·읽기 SO 타임아웃 모두에 사용됨. Docker→호스트(동일 EC2 172.31.x) 헤어핀은 2s 부족한 경우가 있어 최소 10s.
        int timeoutMs = Math.max(10_000, Math.max(500, device.getTimeoutMs()));
        logs.add(tsPrefix() + " Socket timeout (connect + reads) = " + timeoutMs + " ms");
        long t0 = System.nanoTime();
        String connectHost = device.getIpAddress().trim();
        int connectPort = device.getPort();
        ModbusTCPMaster master = new ModbusTCPMaster(connectHost, connectPort);
        master.setTimeout(timeoutMs);
        List<ConnectionSampleTagRow> rows = new ArrayList<>();
        try {
            log.info(
                    "ModbusTCP connect attempt (admin connection test): host={} port={} deviceId={} code={} timeoutMs={}",
                    connectHost,
                    connectPort,
                    deviceId,
                    device.getCode(),
                    timeoutMs);
            master.connect();
            logs.add(tsPrefix() + " Connected to " + formatTarget(device));
            logs.add(tsPrefix() + " Modbus session opened");
            int slave = device.getSlaveId();

            int enabledOk = 0;
            int enabledTotal = 0;
            for (DeviceTagEntity tag : tags) {
                if (!tag.isEnabled()) {
                    rows.add(rowSkippedDisabled(tag));
                    continue;
                }
                enabledTotal++;
                try {
                    TagPollSample sample = readTag(master, slave, tag);
                    if (sample == null) {
                        rows.add(rowFailed(tag, "Unsupported function code (only FC 3 and 4)"));
                        logs.add(tsPrefix() + " Read skipped: " + tag.getName() + " — unsupported FC");
                        continue;
                    }
                    if (sample.value() == null) {
                        rows.add(rowFailed(tag, "Could not decode value"));
                        logs.add(tsPrefix() + " Read failed: " + tag.getName() + " — decode");
                        continue;
                    }
                    enabledOk++;
                    rows.add(rowOk(tag, sample.value()));
                    logs.add(tsPrefix() + " Read OK: " + tag.getName() + " = " + sample.value());
                } catch (Exception ex) {
                    String em = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
                    rows.add(rowFailed(tag, em));
                    logs.add(tsPrefix() + " Read failed: " + tag.getName() + " — " + em);
                }
            }

            int totalMs = (int) ((System.nanoTime() - t0) / 1_000_000L);
            boolean success = enabledTotal == 0 || enabledOk == enabledTotal;
            String message = success ? "OK" : (enabledOk == 0 ? "All enabled tag reads failed" : "Some tag reads failed");
            logs.add(tsPrefix() + " Completed: " + enabledOk + " / " + enabledTotal + " enabled tags OK");

            return detailShell(device, groupName, rows, logs, success, true, totalMs, message, enabledOk, enabledTotal);
        } catch (Exception e) {
            String err = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            log.warn(
                    "Admin connection test connect failed: deviceId={} target={} — {}",
                    deviceId,
                    formatTarget(device),
                    err);
            logs.add(tsPrefix() + " Connect failed: " + err);
            if (err.toLowerCase().contains("timed out")) {
                logs.add(tsPrefix()
                        + " Hint: backend in Docker → same-host Modbus often works better with IP host.docker.internal (see compose extra_hosts) or 172.17.0.1.");
            }
            List<ConnectionSampleTagRow> failRows = new ArrayList<>();
            for (DeviceTagEntity tag : tags) {
                if (!tag.isEnabled()) {
                    failRows.add(rowSkippedDisabled(tag));
                } else {
                    failRows.add(rowNotAttempted(tag, err));
                }
            }
            return detailShell(device, groupName, failRows, logs, false, false, null, err, 0, enabledCount(tags));
        } finally {
            try {
                master.disconnect();
            } catch (Exception ignored) {
            }
        }
    }

    private String resolveGroupName(DeviceEntity device) {
        if (device.getDeviceGroupId() == null) {
            return null;
        }
        return deviceGroupRepository.findById(device.getDeviceGroupId()).map(g -> g.getName()).orElse(null);
    }

    private static boolean connectionParamsIncomplete(DeviceEntity d) {
        String ip = d.getIpAddress() == null ? null : d.getIpAddress().trim();
        return ip == null || ip.isBlank()
                || d.getPort() == null || d.getPort() <= 0
                || d.getSlaveId() == null;
    }

    private static int enabledCount(List<DeviceTagEntity> tags) {
        return (int) tags.stream().filter(DeviceTagEntity::isEnabled).count();
    }

    private static List<ConnectionSampleTagRow> tagsSkippedNonTcp(List<DeviceTagEntity> tags, String protocol) {
        List<ConnectionSampleTagRow> rows = new ArrayList<>();
        for (DeviceTagEntity t : tags) {
            rows.add(new ConnectionSampleTagRow(
                    t.getId().toString(),
                    t.getName(),
                    formatAddressLabel(t.getFunctionCode(), t.getAddress()),
                    "—",
                    "SKIPPED",
                    "Tag read test is only available for MODBUS_TCP (device is " + protocol + ")"
            ));
        }
        return rows;
    }

    private static List<ConnectionSampleTagRow> tagsSkippedParams(List<DeviceTagEntity> tags, String reason) {
        List<ConnectionSampleTagRow> rows = new ArrayList<>();
        for (DeviceTagEntity t : tags) {
            rows.add(new ConnectionSampleTagRow(
                    t.getId().toString(),
                    t.getName(),
                    formatAddressLabel(t.getFunctionCode(), t.getAddress()),
                    "—",
                    "SKIPPED",
                    reason
            ));
        }
        return rows;
    }

    private static ConnectionSampleTagRow rowSkippedDisabled(DeviceTagEntity tag) {
        return new ConnectionSampleTagRow(
                tag.getId().toString(),
                tag.getName(),
                formatAddressLabel(tag.getFunctionCode(), tag.getAddress()),
                "—",
                "SKIPPED",
                "Tag is disabled"
        );
    }

    private static ConnectionSampleTagRow rowOk(DeviceTagEntity tag, BigDecimal value) {
        return new ConnectionSampleTagRow(
                tag.getId().toString(),
                tag.getName(),
                formatAddressLabel(tag.getFunctionCode(), tag.getAddress()),
                formatDisplayValue(value, tag.getUnit()),
                "OK",
                null
        );
    }

    private static ConnectionSampleTagRow rowFailed(DeviceTagEntity tag, String error) {
        return new ConnectionSampleTagRow(
                tag.getId().toString(),
                tag.getName(),
                formatAddressLabel(tag.getFunctionCode(), tag.getAddress()),
                "—",
                "FAILED",
                error
        );
    }

    private static ConnectionSampleTagRow rowNotAttempted(DeviceTagEntity tag, String connectError) {
        return new ConnectionSampleTagRow(
                tag.getId().toString(),
                tag.getName(),
                formatAddressLabel(tag.getFunctionCode(), tag.getAddress()),
                "—",
                "NOT_ATTEMPTED",
                connectError
        );
    }

    private static String formatAddressLabel(int fc, int addr) {
        if (fc == 3) {
            return String.valueOf(40001 + addr);
        }
        if (fc == 4) {
            return String.valueOf(30001 + addr);
        }
        return fc + ":" + addr;
    }

    private static String formatTarget(DeviceEntity d) {
        if (d.getIpAddress() == null || d.getPort() == null) {
            return "—";
        }
        return d.getIpAddress().trim() + ":" + d.getPort();
    }

    private static String formatDisplayValue(BigDecimal value, String unit) {
        if (value == null) {
            return "—";
        }
        String s = value.stripTrailingZeros().toPlainString();
        if (unit != null && !unit.isBlank()) {
            return s + " " + unit.trim();
        }
        return s;
    }

    private static String tsPrefix() {
        return "[" + DateTimeFormatter.ofPattern("HH:mm:ss").format(LocalTime.now()) + "]";
    }

    private static ConnectionTestDetailResult detailShell(
            DeviceEntity device,
            String groupName,
            List<ConnectionSampleTagRow> sampleReads,
            List<String> logLines,
            boolean success,
            boolean reachable,
            Integer responseTimeMs,
            String message,
            int tagsOk,
            int tagsTotal
    ) {
        return new ConnectionTestDetailResult(
                success,
                reachable,
                responseTimeMs,
                message,
                device.getId().toString(),
                device.getName(),
                device.getCode(),
                groupName,
                device.getProtocolType(),
                formatTarget(device),
                device.getSlaveId(),
                device.getPollingIntervalSec(),
                device.getTimeoutMs(),
                sampleReads,
                logLines,
                tagsOk,
                tagsTotal
        );
    }

    private void publishMqtt(UUID deviceId, List<TagPollSample> samples, Instant now, List<UUID> alarmIds) {
        mqttPublishService.ensureConnected();
        String idStr = deviceId.toString();
        mqttPublishService.publishJson("/" + idStr + "/status", Map.of(
                "status", "ONLINE",
                "lastSeen", now.toString()
        ));
        for (TagPollSample s : samples) {
            java.util.HashMap<String, Object> payload = new java.util.HashMap<>();
            payload.put("value", s.value());
            payload.put("unit", s.tag().getUnit() != null ? s.tag().getUnit() : "");
            payload.put("alarmState", s.alarmState());
            payload.put("quality", s.quality());
            mqttPublishService.publishJson("/" + idStr + "/" + s.tag().getCode(), payload);
        }
        for (UUID aid : alarmIds) {
            mqttPublishService.publishJson("/alarm", Map.of(
                    "alarmId", aid.toString(),
                    "deviceId", idStr
            ));
        }
    }
}
