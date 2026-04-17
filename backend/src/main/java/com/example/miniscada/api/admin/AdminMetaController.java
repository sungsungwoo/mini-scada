package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.DeviceGroupOption;
import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminMetaController {

    private final AdminDeviceService adminDeviceService;

    @GetMapping("/device-groups")
    public ApiResponse<List<DeviceGroupOption>> deviceGroups() {
        return ApiResponse.ok(adminDeviceService.listDeviceGroups());
    }
}
