package com.example.miniscada.api.health;

import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/system/health")
@RequiredArgsConstructor
public class SystemHealthController {

    private final SystemHealthService systemHealthService;

    @GetMapping("/summary")
    public ApiResponse<Map<String, String>> summary() {
        return ApiResponse.ok(systemHealthService.summary());
    }
}
