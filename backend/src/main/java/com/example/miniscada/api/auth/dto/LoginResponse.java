package com.example.miniscada.api.auth.dto;

import com.example.miniscada.api.user.dto.UserDto;

public record LoginResponse(
        UserDto user,
        String accessToken
) {
}
