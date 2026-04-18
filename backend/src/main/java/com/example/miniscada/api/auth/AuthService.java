package com.example.miniscada.api.auth;

import com.example.miniscada.api.auth.dto.LoginRequest;
import com.example.miniscada.api.auth.dto.LoginResponse;
import com.example.miniscada.api.auth.dto.RegisterRequest;
import com.example.miniscada.api.user.dto.UserDto;
import com.example.miniscada.common.exception.BusinessException;
import com.example.miniscada.common.exception.ErrorCode;
import com.example.miniscada.domain.user.AppUser;
import com.example.miniscada.domain.user.AppUserRepository;
import com.example.miniscada.domain.user.RoleEntity;
import com.example.miniscada.domain.user.RoleRepository;
import com.example.miniscada.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final AppUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthSessionService authSessionService;

    @Transactional
    public LoginWithRefresh login(LoginRequest req) {
        AppUser user = userRepository.findByUsername(req.username())
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.INVALID_CREDENTIALS,
                        "Invalid username or password",
                        HttpStatus.UNAUTHORIZED
                ));
        if (!user.isActive()) {
            throw new BusinessException(ErrorCode.USER_INACTIVE, "User inactive", HttpStatus.FORBIDDEN);
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BusinessException(
                    ErrorCode.INVALID_CREDENTIALS,
                    "Invalid username or password",
                    HttpStatus.UNAUTHORIZED
            );
        }
        List<String> roleNames = user.getRoles().stream()
                .map(RoleEntity::getName)
                .sorted()
                .toList();
        AuthSessionService.CreatedSession session = authSessionService.createSession(user.getId());
        String token = jwtTokenProvider.createToken(
                user.getId(), user.getUsername(), roleNames, session.sessionId());
        return new LoginWithRefresh(
                new LoginResponse(toUserDto(user), token),
                session.plainRefreshToken(),
                session.refreshExpiresAt()
        );
    }

    /**
     * Self-service registration: always assigns {@code OPERATOR} only (never ADMIN).
     */
    @Transactional
    public LoginWithRefresh register(RegisterRequest req) {
        String username = req.username().trim();
        if (userRepository.existsByUsername(username)) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN, "Username already taken", HttpStatus.CONFLICT);
        }

        String emailRaw = req.email() != null ? req.email().trim() : "";
        if (!emailRaw.isEmpty()) {
            if (!EMAIL.matcher(emailRaw).matches()) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "Invalid email format", HttpStatus.UNPROCESSABLE_ENTITY);
            }
            userRepository.findByEmail(emailRaw).ifPresent(u -> {
                throw new BusinessException(ErrorCode.EMAIL_TAKEN, "Email already registered", HttpStatus.CONFLICT);
            });
        }

        RoleEntity operator = roleRepository.findByName("OPERATOR")
                .orElseThrow(() -> new IllegalStateException("OPERATOR role missing — check DB seed"));

        Instant now = Instant.now();
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setName(req.name() != null && !req.name().isBlank() ? req.name().trim() : username);
        user.setEmail(emailRaw.isEmpty() ? null : emailRaw);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        user.getRoles().add(operator);

        userRepository.save(user);

        List<String> roleNames = List.of("OPERATOR");
        AuthSessionService.CreatedSession session = authSessionService.createSession(user.getId());
        String token = jwtTokenProvider.createToken(
                user.getId(), user.getUsername(), roleNames, session.sessionId());
        return new LoginWithRefresh(
                new LoginResponse(toUserDto(user), token),
                session.plainRefreshToken(),
                session.refreshExpiresAt()
        );
    }

    @Transactional
    public LoginWithRefresh refresh(String rawRefreshToken) {
        AuthSessionService.RefreshedSession r = authSessionService.refresh(rawRefreshToken);
        AppUser user = userRepository.findById(r.userId())
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        "User not found",
                        HttpStatus.NOT_FOUND
                ));
        if (!user.isActive()) {
            throw new BusinessException(ErrorCode.USER_INACTIVE, "User inactive", HttpStatus.FORBIDDEN);
        }
        List<String> roleNames = user.getRoles().stream()
                .map(RoleEntity::getName)
                .sorted()
                .toList();
        String access = jwtTokenProvider.createToken(
                user.getId(), user.getUsername(), roleNames, r.sessionId());
        return new LoginWithRefresh(
                new LoginResponse(toUserDto(user), access),
                r.plainRefreshToken(),
                r.refreshExpiresAt()
        );
    }

    @Transactional
    public void revokeSession(UUID sessionId) {
        authSessionService.revokeById(sessionId);
    }

    private static UserDto toUserDto(AppUser user) {
        String role = user.getRoles().stream()
                .map(RoleEntity::getName)
                .max(Comparator.comparing(r -> r.equals("ADMIN") ? 1 : 0))
                .orElse("OPERATOR");
        return new UserDto(user.getId().toString(), user.getUsername(), user.getName(), role);
    }
}
