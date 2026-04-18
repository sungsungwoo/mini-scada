package com.example.miniscada.api.auth;

import com.example.miniscada.api.auth.dto.LoginRequest;
import com.example.miniscada.api.auth.dto.RegisterRequest;
import com.example.miniscada.common.dto.ApiResponse;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.config.AuthCookieProperties;
import com.example.miniscada.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthCookieProperties authCookieProperties;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<?>> login(@Valid @RequestBody LoginRequest request) {
        LoginWithRefresh result = authService.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(result).toString())
                .body(ApiResponse.ok(result.login()));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<?>> register(@Valid @RequestBody RegisterRequest request) {
        LoginWithRefresh result = authService.register(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(result).toString())
                .body(ApiResponse.ok(result.login()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<?>> refresh(
            @CookieValue(value = AuthSessionService.REFRESH_COOKIE_NAME, required = false) String refreshCookie
    ) {
        if (refreshCookie == null || refreshCookie.isBlank()) {
            throw new BusinessException(
                    ErrorCode.REFRESH_TOKEN_INVALID,
                    "Missing refresh token",
                    HttpStatus.UNAUTHORIZED
            );
        }
        LoginWithRefresh result = authService.refresh(refreshCookie);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(result).toString())
                .body(ApiResponse.ok(result.login()));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<?>> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            try {
                Claims c = jwtTokenProvider.parse(authorization.substring(7));
                String sid = c.get("sid", String.class);
                if (sid != null && !sid.isBlank()) {
                    authService.revokeSession(UUID.fromString(sid));
                }
            } catch (Exception ignored) {
                // still clear cookie
            }
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .body(ApiResponse.ok(Map.of("message", "logged out")));
    }

    private ResponseCookie buildRefreshCookie(LoginWithRefresh result) {
        long maxAgeSec = Math.max(1L, Duration.between(Instant.now(), result.refreshExpiresAt()).getSeconds());
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(
                        AuthSessionService.REFRESH_COOKIE_NAME,
                        result.plainRefreshToken())
                .httpOnly(true)
                .path("/")
                .maxAge(maxAgeSec);
        String sameSite = authCookieProperties.getSameSite();
        if (sameSite != null && !sameSite.isBlank()) {
            b = b.sameSite(sameSite);
        }
        return b.secure(authCookieProperties.isSecure()).build();
    }

    private ResponseCookie clearRefreshCookie() {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(AuthSessionService.REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .path("/")
                .maxAge(0);
        String sameSite = authCookieProperties.getSameSite();
        if (sameSite != null && !sameSite.isBlank()) {
            b = b.sameSite(sameSite);
        }
        return b.secure(authCookieProperties.isSecure()).build();
    }
}
