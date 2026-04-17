package com.example.miniscada.api.admin;

import com.example.miniscada.api.admin.dto.AdminDtos.TagConfigResponse;
import com.example.miniscada.api.admin.dto.AdminDtos.TagCreateRequest;
import com.example.miniscada.api.admin.dto.AdminDtos.TagListData;
import com.example.miniscada.api.admin.dto.AdminDtos.TagUpdateRequest;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminTagController {

    private final AdminTagService adminTagService;

    @GetMapping("/devices/{deviceId}/tags")
    public ApiResponse<TagListData> list(@PathVariable UUID deviceId) {
        return ApiResponse.ok(adminTagService.list(deviceId));
    }

    @PostMapping("/devices/{deviceId}/tags")
    public ApiResponse<TagConfigResponse> create(
            @PathVariable UUID deviceId,
            @Valid @RequestBody TagCreateRequest body
    ) {
        return ApiResponse.ok(adminTagService.create(deviceId, body));
    }

    @GetMapping("/tags/{tagId}")
    public ApiResponse<TagConfigResponse> get(@PathVariable UUID tagId) {
        return ApiResponse.ok(adminTagService.get(tagId));
    }

    @PatchMapping("/tags/{tagId}")
    public ApiResponse<TagConfigResponse> update(@PathVariable UUID tagId, @RequestBody TagUpdateRequest body) {
        return ApiResponse.ok(adminTagService.update(tagId, body));
    }

    @DeleteMapping("/tags/{tagId}")
    public ResponseEntity<Void> delete(@PathVariable UUID tagId) {
        adminTagService.delete(tagId);
        return ResponseEntity.noContent().build();
    }
}
