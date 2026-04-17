package com.example.miniscada.api.user;

import com.example.miniscada.api.user.dto.UserDto;
import com.example.miniscada.common.dto.ApiResponse;
import com.example.miniscada.domain.user.AppUser;
import com.example.miniscada.domain.user.AppUserRepository;
import com.example.miniscada.domain.user.RoleEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AppUserRepository userRepository;

    @GetMapping("/me")
    public ApiResponse<UserDto> me(Authentication authentication) {
        UUID id = UUID.fromString(authentication.getName());
        AppUser user = userRepository.findById(id).orElseThrow();
        String role = user.getRoles().stream()
                .map(RoleEntity::getName)
                .max(Comparator.comparing(r -> r.equals("ADMIN") ? 1 : 0))
                .orElse("OPERATOR");
        return ApiResponse.ok(new UserDto(user.getId().toString(), user.getUsername(), user.getName(), role));
    }
}
