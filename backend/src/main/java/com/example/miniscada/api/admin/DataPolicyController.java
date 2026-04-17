package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.DataPolicyResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.DataPolicyUpdateRequest;
import com.example.miniscada.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/policies/data")
@RequiredArgsConstructor
public class DataPolicyController {

    private final DataPolicyService dataPolicyService;

    @GetMapping
    public ApiResponse<DataPolicyResponse> get() {
        return ApiResponse.ok(dataPolicyService.get());
    }

    @PatchMapping
    public ApiResponse<DataPolicyResponse> patch(@RequestBody DataPolicyUpdateRequest body) {
        return ApiResponse.ok(dataPolicyService.patch(body));
    }

    @PostMapping("/reset")
    public ApiResponse<DataPolicyResponse> reset() {
        return ApiResponse.ok(dataPolicyService.reset());
    }
}
