package com.example.miniscada.realtime;

import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/realtime")
@RequiredArgsConstructor
public class RealtimeController {

    private final RealtimeBootstrapService realtimeBootstrapService;

    @GetMapping("/bootstrap")
    public ApiResponse<Map<String, Object>> bootstrap() {
        return ApiResponse.ok(realtimeBootstrapService.bootstrap());
    }
}
