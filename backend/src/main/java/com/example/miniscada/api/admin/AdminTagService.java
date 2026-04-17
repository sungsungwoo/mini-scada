package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.TagConfigResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.TagCreateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.TagListData;
import com.example.miniscada.api.admin.dto.AdminDtos.TagUpdateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.ThresholdSnapshot;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.device.DeviceEntity;
import com.example.miniscada.domain.device.DeviceRepository;
import com.example.miniscada.domain.tag.DeviceTagEntity;
import com.example.miniscada.domain.tag.DeviceTagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminTagService {

    private final DeviceRepository deviceRepository;
    private final DeviceTagRepository deviceTagRepository;

    @Transactional(readOnly = true)
    public TagListData list(UUID deviceId) {
        deviceRepository.findById(deviceId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        var tags = deviceTagRepository.findByDeviceIdOrderByDisplayOrderAsc(deviceId).stream()
                .map(this::toConfig)
                .toList();
        return new TagListData(tags);
    }

    @Transactional(readOnly = true)
    public TagConfigResponse get(UUID tagId) {
        DeviceTagEntity t = deviceTagRepository.findById(tagId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.TAG_NOT_FOUND, "Tag not found"));
        return toConfig(t);
    }

    @Transactional
    public TagConfigResponse create(UUID deviceId, TagCreateRequest req) {
        DeviceEntity d = deviceRepository.findById(deviceId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.DEVICE_NOT_FOUND, "Device not found"));
        if (deviceTagRepository.existsByDeviceIdAndCode(deviceId, req.name())) {
            throw BusinessException.conflict(ErrorCode.TAG_DUPLICATED, "Duplicate tag code/name");
        }
        int fc = parseFunctionCode(req.functionCode());
        if (deviceTagRepository.existsByDeviceIdAndFunctionCodeAndAddress(deviceId, fc, req.address())) {
            throw BusinessException.conflict(ErrorCode.TAG_DUPLICATED, "Duplicate function/address");
        }
        DeviceTagEntity t = new DeviceTagEntity();
        t.setId(UUID.randomUUID());
        t.setDeviceId(deviceId);
        t.setName(req.name());
        t.setCode(req.name());
        t.setFunctionCode(fc);
        t.setAddress(req.address());
        t.setQuantity(1);
        t.setDataType(req.dataType());
        t.setUnit(req.unit());
        t.setDisplayOrder(req.displayOrder() != null ? req.displayOrder() : 0);
        t.setByteOrder(encodeSwap(req.byteSwap(), req.wordSwap()));
        applyThresholds(t, req.warningThreshold(), req.criticalThreshold(), req.deadband());
        Instant now = Instant.now();
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        deviceTagRepository.save(t);
        return toConfig(t);
    }

    @Transactional
    public TagConfigResponse update(UUID tagId, TagUpdateRequest req) {
        DeviceTagEntity t = deviceTagRepository.findById(tagId)
                .orElseThrow(() -> BusinessException.notFound(ErrorCode.TAG_NOT_FOUND, "Tag not found"));
        UUID deviceId = t.getDeviceId();
        if (req.name() != null) {
            t.setName(req.name());
            t.setCode(req.name());
        }
        if (req.address() != null) {
            t.setAddress(req.address());
        }
        if (req.functionCode() != null) {
            t.setFunctionCode(parseFunctionCode(req.functionCode()));
        }
        if (req.dataType() != null) {
            t.setDataType(req.dataType());
        }
        if (req.unit() != null) {
            t.setUnit(req.unit());
        }
        if (req.displayOrder() != null) {
            t.setDisplayOrder(req.displayOrder());
        }
        if (req.byteSwap() != null || req.wordSwap() != null) {
            boolean bs = req.byteSwap() != null ? req.byteSwap() : t.getByteOrder() != null && t.getByteOrder().contains("BYTE");
            boolean ws = req.wordSwap() != null ? req.wordSwap() : t.getByteOrder() != null && t.getByteOrder().contains("WORD");
            t.setByteOrder(encodeSwap(bs, ws));
        }
        if (req.warningThreshold() != null || req.criticalThreshold() != null || req.deadband() != null) {
            applyThresholds(t,
                    req.warningThreshold() != null ? req.warningThreshold() : t.getWarningMax(),
                    req.criticalThreshold() != null ? req.criticalThreshold() : t.getCriticalMax(),
                    req.deadband() != null ? req.deadband() : t.getDeadband());
        }
        t.setUpdatedAt(Instant.now());
        deviceTagRepository.save(t);
        return toConfig(t);
    }

    @Transactional
    public void delete(UUID tagId) {
        if (!deviceTagRepository.existsById(tagId)) {
            throw BusinessException.notFound(ErrorCode.TAG_NOT_FOUND, "Tag not found");
        }
        deviceTagRepository.deleteById(tagId);
    }

    private void applyThresholds(DeviceTagEntity t, BigDecimal warn, BigDecimal crit, BigDecimal dead) {
        t.setWarningMax(warn);
        t.setCriticalMax(crit);
        t.setDeadband(dead);
    }

    private static String encodeSwap(Boolean byteSwap, Boolean wordSwap) {
        if (Boolean.TRUE.equals(byteSwap) || Boolean.TRUE.equals(wordSwap)) {
            return "BYTE:" + Boolean.TRUE.equals(byteSwap) + ";WORD:" + Boolean.TRUE.equals(wordSwap);
        }
        return null;
    }

    private static boolean[] decodeSwap(String s) {
        boolean bs = false;
        boolean ws = false;
        if (s != null && s.startsWith("BYTE:")) {
            String[] p = s.split(";");
            for (String x : p) {
                if (x.startsWith("BYTE:")) {
                    bs = Boolean.parseBoolean(x.substring(5));
                }
                if (x.startsWith("WORD:")) {
                    ws = Boolean.parseBoolean(x.substring(5));
                }
            }
        }
        return new boolean[]{bs, ws};
    }

    private static int parseFunctionCode(String raw) {
        if (raw == null) {
            throw BusinessException.badRequest(ErrorCode.INVALID_INPUT, "function_code required");
        }
        String s = raw.trim();
        try {
            int v = Integer.parseInt(s);
            if (v < 1 || v > 4) {
                throw new IllegalArgumentException();
            }
            return v;
        } catch (Exception ignored) {
            String u = s.toUpperCase();
            if (u.contains("HOLDING") || u.contains("3")) {
                return 3;
            }
            if (u.contains("INPUT") && u.contains("REGISTER") || u.contains("4")) {
                return 4;
            }
            if (u.contains("COIL") || u.contains("1")) {
                return 1;
            }
            if (u.contains("DISCRETE") || u.contains("2")) {
                return 2;
            }
        }
        throw BusinessException.badRequest(ErrorCode.INVALID_INPUT, "Invalid function_code");
    }

    private TagConfigResponse toConfig(DeviceTagEntity t) {
        boolean[] sw = decodeSwap(t.getByteOrder());
        ThresholdSnapshot th = new ThresholdSnapshot(t.getWarningMax(), t.getCriticalMax(), t.getDeadband());
        return new TagConfigResponse(
                t.getId().toString(),
                t.getName(),
                t.getAddress(),
                String.valueOf(t.getFunctionCode()),
                t.getDataType(),
                t.getUnit(),
                t.getDisplayOrder(),
                sw[0],
                sw[1],
                th
        );
    }
}
