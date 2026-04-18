package com.example.miniscada.api.auth;

import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.config.AuthSessionProperties;
import com.example.miniscada.domain.auth.AuthSession;
import com.example.miniscada.domain.auth.AuthSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthSessionService {

    public static final String REFRESH_COOKIE_NAME = "mini_scada_refresh";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthSessionRepository authSessionRepository;
    private final AuthSessionProperties props;

    @Transactional
    public CreatedSession createSession(UUID userId) {
        UUID id = UUID.randomUUID();
        String raw = newRandomRawToken();
        String hash = sha256Hex(raw);
        Instant now = Instant.now();
        Instant absolute = now.plusMillis(props.getAbsoluteMaxMs());
        Instant refreshExp = now.plusMillis(props.getRefreshExpirationMs());

        AuthSession row = new AuthSession();
        row.setId(id);
        row.setUserId(userId);
        row.setRefreshTokenHash(hash);
        row.setCreatedAt(now);
        row.setLastActivityAt(now);
        row.setAbsoluteExpiresAt(absolute);
        row.setRefreshExpiresAt(refreshExp);
        authSessionRepository.save(row);
        return new CreatedSession(id, raw, refreshExp);
    }

    /**
     * Validates session for an authenticated request and bumps {@code last_activity_at} (sliding).
     */
    @Transactional
    public void validateAndTouch(UUID sessionId, UUID userIdFromJwt) {
        AuthSession s = authSessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.SESSION_EXPIRED,
                        "Session no longer valid",
                        HttpStatus.UNAUTHORIZED
                ));
        if (!s.getUserId().equals(userIdFromJwt)) {
            throw new BusinessException(ErrorCode.SESSION_EXPIRED, "Session mismatch", HttpStatus.UNAUTHORIZED);
        }
        Instant now = Instant.now();
        if (now.isAfter(s.getAbsoluteExpiresAt()) || now.isAfter(s.getRefreshExpiresAt())) {
            throw new BusinessException(ErrorCode.SESSION_EXPIRED, "Session expired", HttpStatus.UNAUTHORIZED);
        }
        s.setLastActivityAt(now);
    }

    @Transactional
    public RefreshedSession refresh(String rawRefreshToken) {
        String hash = sha256Hex(rawRefreshToken);
        AuthSession s = authSessionRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.REFRESH_TOKEN_INVALID,
                        "Invalid refresh token",
                        HttpStatus.UNAUTHORIZED
                ));
        Instant now = Instant.now();
        if (now.isAfter(s.getAbsoluteExpiresAt())) {
            authSessionRepository.delete(s);
            throw new BusinessException(
                    ErrorCode.SESSION_EXPIRED,
                    "Session absolute limit reached",
                    HttpStatus.UNAUTHORIZED
            );
        }
        if (now.isAfter(s.getRefreshExpiresAt())) {
            authSessionRepository.delete(s);
            throw new BusinessException(ErrorCode.SESSION_EXPIRED, "Refresh token expired", HttpStatus.UNAUTHORIZED);
        }
        Duration idle = Duration.between(s.getLastActivityAt(), now);
        if (idle.toMillis() > props.getIdleTimeoutMs()) {
            authSessionRepository.delete(s);
            throw new BusinessException(
                    ErrorCode.SESSION_EXPIRED,
                    "Idle timeout; login again",
                    HttpStatus.UNAUTHORIZED
            );
        }

        String newRaw = newRandomRawToken();
        String newHash = sha256Hex(newRaw);
        Instant newRefreshExp = now.plusMillis(props.getRefreshExpirationMs());

        s.setRefreshTokenHash(newHash);
        s.setLastActivityAt(now);
        s.setRefreshExpiresAt(newRefreshExp);

        return new RefreshedSession(s.getId(), s.getUserId(), newRaw, newRefreshExp);
    }

    @Transactional
    public void revokeById(UUID sessionId) {
        authSessionRepository.deleteById(sessionId);
    }

    private static String newRandomRawToken() {
        byte[] buf = new byte[32];
        RANDOM.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record CreatedSession(UUID sessionId, String plainRefreshToken, Instant refreshExpiresAt) {}

    public record RefreshedSession(UUID sessionId, UUID userId, String plainRefreshToken, Instant refreshExpiresAt) {}
}
