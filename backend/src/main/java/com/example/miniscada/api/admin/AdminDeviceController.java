package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceCreateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceListData;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.AdminDeviceUpdateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.DeviceChangeHistoryData;
import com.example.miniscada.api.admin.dto.AdminDtos.DeviceGroupOption;
import com.example.miniscada.api.admin.dto.AdminDtos.ConnectionTestDetailResult;
import com.example.miniscada.api.admin.dto.AdminDtos.TestConnectionRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.TestConnectionResult;
import com.example.miniscada.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/devices")
@RequiredArgsConstructor
public class AdminDeviceController {

    /** `device-groups`, `test-connection` 등과 충돌하지 않도록 UUID 형식만 허용 */
    private static final String DEVICE_ID_PATH =
            "/{deviceId:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";

    private final AdminDeviceService adminDeviceService;
    private final DeviceChangeLogService deviceChangeLogService;

    @GetMapping
    public ApiResponse<AdminDeviceListData> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String protocol,
            @RequestParam(required = false) String group
    ) {
        return ApiResponse.ok(adminDeviceService.list(page, size, keyword, status, protocol, group));
    }

    @PostMapping
    public ApiResponse<AdminDeviceResponse> create(
            @Valid @RequestBody AdminDeviceCreateRequest body,
            Authentication authentication
    ) {
        UUID actor = UUID.fromString(authentication.getName());
        return ApiResponse.ok(adminDeviceService.create(body, actor));
    }

    /** 디바이스 폼 등에서 사용 (`/{deviceId}` 와 분리). */
    @GetMapping("/device-groups")
    public ApiResponse<List<DeviceGroupOption>> deviceGroups() {
        return ApiResponse.ok(adminDeviceService.listDeviceGroups());
    }

    @GetMapping(DEVICE_ID_PATH)
    public ApiResponse<AdminDeviceResponse> get(@PathVariable UUID deviceId) {
        return ApiResponse.ok(adminDeviceService.get(deviceId));
    }

    @GetMapping(DEVICE_ID_PATH + "/history")
    public ApiResponse<DeviceChangeHistoryData> history(
            @PathVariable UUID deviceId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ApiResponse.ok(deviceChangeLogService.list(deviceId, page, size));
    }

    @PatchMapping(DEVICE_ID_PATH)
    public ApiResponse<AdminDeviceResponse> update(
            @PathVariable UUID deviceId,
            @RequestBody AdminDeviceUpdateRequest body,
            Authentication authentication
    ) {
        UUID actor = UUID.fromString(authentication.getName());
        return ApiResponse.ok(adminDeviceService.update(deviceId, body, actor));
    }

    @DeleteMapping(DEVICE_ID_PATH)
    public ResponseEntity<Void> delete(@PathVariable UUID deviceId, Authentication authentication) {
        UUID actor = UUID.fromString(authentication.getName());
        adminDeviceService.delete(deviceId, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/test-connection")
    public ApiResponse<TestConnectionResult> testConnection(@Valid @RequestBody TestConnectionRequest body) {
        return ApiResponse.ok(adminDeviceService.testConnection(body));
    }

    @PostMapping(DEVICE_ID_PATH + "/connection-test")
    public ApiResponse<ConnectionTestDetailResult> connectionTestReads(@PathVariable UUID deviceId) {
        return ApiResponse.ok(adminDeviceService.connectionTestReads(deviceId));
    }
}
