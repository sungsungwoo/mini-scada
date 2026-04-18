package com.example.miniscada.api.auth;

import com.example.miniscada.api.auth.dto.LoginResponse;

import java.time.Instant;

public record LoginWithRefresh(LoginResponse login, String plainRefreshToken, Instant refreshExpiresAt) {}
