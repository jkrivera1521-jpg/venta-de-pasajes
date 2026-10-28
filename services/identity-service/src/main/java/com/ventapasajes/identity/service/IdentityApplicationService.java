package com.ventapasajes.identity.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.identity.api.ApiException;
import com.ventapasajes.identity.api.dto.ActiveSessionConflict;
import com.ventapasajes.identity.api.dto.AuthTokenResponse;
import com.ventapasajes.identity.api.dto.CurrentUserResponse;
import com.ventapasajes.identity.api.dto.GoogleTokenExchangeRequest;
import com.ventapasajes.identity.api.dto.IdentitySessionResponse;
import com.ventapasajes.identity.api.dto.LocalLoginRequest;
import com.ventapasajes.identity.api.dto.MenuItemRequest;
import com.ventapasajes.identity.api.dto.MenuItemResponse;
import com.ventapasajes.identity.api.dto.PasswordForgotRequest;
import com.ventapasajes.identity.api.dto.PasswordForgotResponse;
import com.ventapasajes.identity.api.dto.PasswordLoginRequest;
import com.ventapasajes.identity.api.dto.PasswordResetRequest;
import com.ventapasajes.identity.api.dto.ProfilePhotoRequest;
import com.ventapasajes.identity.api.dto.PermissionResponse;
import com.ventapasajes.identity.api.dto.PublicLocalRegisterRequest;
import com.ventapasajes.identity.api.dto.ReplaceUserRolesRequest;
import com.ventapasajes.identity.api.dto.RoleCreateRequest;
import com.ventapasajes.identity.api.dto.RoleResponse;
import com.ventapasajes.identity.api.dto.RoleUpdateRequest;
import com.ventapasajes.identity.api.dto.UserCreateRequest;
import com.ventapasajes.identity.api.dto.UserResponse;
import com.ventapasajes.identity.api.dto.UserUpdateRequest;
import com.ventapasajes.identity.api.dto.ThemePreferenceRequest;
import com.ventapasajes.identity.auth.AuthenticatedUser;
import com.ventapasajes.identity.auth.GoogleIdTokenVerifier;
import com.ventapasajes.identity.auth.GoogleIdTokenVerifier.GooglePrincipal;
import com.ventapasajes.identity.auth.JwtService;
import com.ventapasajes.identity.auth.PasswordHashService;
import com.ventapasajes.identity.domain.IdentityType;
import com.ventapasajes.identity.domain.RoleStatus;
import com.ventapasajes.identity.domain.UserStatus;
import com.ventapasajes.identity.persistence.entity.GoogleIdentity;
import com.ventapasajes.identity.persistence.entity.IdentitySession;
import com.ventapasajes.identity.persistence.entity.InternalProfile;
import com.ventapasajes.identity.persistence.entity.LocalCredential;
import com.ventapasajes.identity.persistence.entity.MenuItem;
import com.ventapasajes.identity.persistence.entity.PasswordResetToken;
import com.ventapasajes.identity.persistence.entity.PermissionCatalogItem;
import com.ventapasajes.identity.persistence.entity.Role;
import com.ventapasajes.identity.persistence.entity.UserAccount;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class IdentityApplicationService {

    private static final String PASSWORD_RESET = "PASSWORD_RESET";
    private static final String ACCESS_LOGIN = "ACCESS_LOGIN";
    private static final int OPAQUE_TOKEN_BYTES = 32;

    @Inject
    Instance<EntityManager> entityManager;

    @Inject
    PasswordHashService passwordHashService;

    @Inject
    JwtService jwtService;

    @Inject
    GoogleIdTokenVerifier googleIdTokenVerifier;

    @Inject
    GmailRecoveryEmailService gmailRecoveryEmailService;

    @ConfigProperty(name = "app.auth.local.max-failed-attempts", defaultValue = "5")
    int maxFailedAttempts;

    @ConfigProperty(name = "app.auth.local.lockout-minutes", defaultValue = "15")
    long lockoutMinutes;

    @ConfigProperty(name = "app.auth.recovery-token-ttl-minutes", defaultValue = "10")
    long recoveryTokenTtlMinutes;

    @ConfigProperty(name = "app.auth.recovery.return-token.enabled", defaultValue = "false")
    boolean returnRecoveryToken;

    @ConfigProperty(name = "app.auth.recovery.offline-mode", defaultValue = "false")
    boolean recoveryOfflineMode;

    @ConfigProperty(name = "app.auth.recovery.reset-url", defaultValue = "http://localhost:3001/identity/recovery")
    String recoveryResetUrl;

    @ConfigProperty(name = "app.auth.google.default-role-code", defaultValue = "CUSTOMER")
    String googleDefaultRoleCode;

    @ConfigProperty(name = "app.auth.public.default-role-code", defaultValue = "CUSTOMER")
    String publicDefaultRoleCode;

    @ConfigProperty(name = "app.security.recovery-token-pepper")
    String recoveryTokenPepper;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthTokenResponse localLogin(LocalLoginRequest request, String userAgent, String ipAddress) {
        request = requirePayload(request);
        String login = required(request.login(), "login").toLowerCase(Locale.ROOT);
        String password = required(request.password(), "password");
        UserAccount user = findUserByLoginOrEmail(login);
        if (user == null) {
            recordLoginAttempt(null, login, false, "USER_NOT_FOUND", userAgent);
            throw invalidCredentials();
        }

        if (user.lockedUntil != null && user.lockedUntil.isAfter(Instant.now())) {
            recordLoginAttempt(user.id, login, false, "USER_LOCKED", userAgent);
            throw ApiException.unauthorized("USER_LOCKED", "User is temporarily locked.");
        }
        if (user.status != UserStatus.ACTIVE) {
            recordLoginAttempt(user.id, login, false, "USER_NOT_ACTIVE", userAgent);
            throw invalidCredentials();
        }

        LocalCredential credential = LocalCredential.findById(user.id);
        if (credential == null || !passwordHashService.verify(password, credential.passwordHash)) {
            registerFailedLogin(user, login, userAgent);
            throw invalidCredentials();
        }

        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = Instant.now();
        user.persist();
        recordLoginAttempt(user.id, login, true, null, userAgent);
        if (!request.force() && hasActiveSessions(user.id)) {
            throw activeSessionConflict(user.id);
        }
        if (request.force()) {
            revokeAllSessions(user.id);
        }
        return tokenResponse(authenticatedUser(user), userAgent, ipAddress);
    }

    @Transactional
    public AuthTokenResponse googleExchange(GoogleTokenExchangeRequest request, String userAgent, String ipAddress) {
        request = requirePayload(request);
        GooglePrincipal principal = googleIdTokenVerifier.verify(request.idToken());

        UserAccount user = findUserByGoogleSubject(principal.subject());
        if (user == null) {
            user = findUserByLoginOrEmail(principal.email());
        }
        if (user == null) {
            user = createGoogleUser(principal);
        }

        linkGoogleIdentity(user, principal);
        if (user.status != UserStatus.ACTIVE) {
            throw ApiException.unauthorized("USER_NOT_ACTIVE", "User is not active.");
        }

        user.lastLoginAt = Instant.now();
        user.persist();
        if (!request.force() && hasActiveSessions(user.id)) {
            throw activeSessionConflict(user.id);
        }
        if (request.force()) {
            revokeAllSessions(user.id);
        }
        return tokenResponse(authenticatedUser(user), userAgent, ipAddress);
    }

    @Transactional
    public AuthTokenResponse registerLocalPublicAccount(PublicLocalRegisterRequest request, String userAgent, String ipAddress) {
        request = requirePayload(request);
        String login = required(request.login(), "login").toLowerCase(Locale.ROOT);
        String email = required(request.email(), "email").toLowerCase(Locale.ROOT);
        String password = required(request.password(), "password");
        validatePasswordPolicy(password);
        if (!email.contains("@") || email.startsWith("@") || email.endsWith("@")) {
            throw ApiException.validation("EMAIL_INVALID", "El correo electronico no es valido.");
        }
        if (findUserByLoginOrEmail(login) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "Ya existe un usuario con el mismo login o correo.");
        }
        if (findUserByLoginOrEmail(email) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "Ya existe un usuario con el mismo login o correo.");
        }

        UserAccount user = new UserAccount();
        user.identityType = IdentityType.LOCAL;
        user.login = login;
        user.email = email;
        user.displayName = displayNameOrFallback(request.displayName(), email);
        user.status = UserStatus.ACTIVE;
        user.lastLoginAt = Instant.now();
        user.persist();

        createOrUpdateLocalCredential(user, password, false);
        assignDefaultRole(user.id, publicDefaultRoleCode);
        recordLoginAttempt(user.id, login, true, null, userAgent);
        return tokenResponse(authenticatedUser(user), userAgent, ipAddress);
    }

    @Transactional
    public CurrentUserResponse currentUser(UUID userId) {
        return toCurrentUser(requireUser(userId));
    }

    @Transactional
    public CurrentUserResponse updateCurrentUserAvatar(UUID userId, ProfilePhotoRequest request) {
        UserAccount user = requireUser(userId);
        user.avatarUrl = normalizeAvatar(request == null ? null : request.avatarUrl());
        user.persist();
        return toCurrentUser(user);
    }

    @Transactional
    public CurrentUserResponse updateCurrentUserTheme(UUID userId, ThemePreferenceRequest request) {
        UserAccount user = requireUser(userId);
        user.darkMode = request != null && request.darkMode();
        user.persist();
        return toCurrentUser(user);
    }

    @Transactional
    public AuthTokenResponse refreshCurrentSession(AuthenticatedUser user) {
        IdentitySession session = IdentitySession.findById(user.sessionId());
        if (session == null || session.revokedAt != null) {
            throw ApiException.unauthorized("SESSION_REVOKED", "La sesion ya no esta activa.");
        }

        Instant now = Instant.now();
        session.lastSeenAt = now;
        session.expiresAt = now.plusSeconds(jwtService.accessTokenTtlSeconds());
        session.persist();
        return new AuthTokenResponse(
                jwtService.issueAccessToken(user, session.id),
                "Bearer",
                jwtService.accessTokenTtlSeconds(),
                toCurrentUser(user));
    }

    @Transactional
    public List<UserResponse> listUsers() {
        return UserAccount.<UserAccount>list("retiredAt is null order by login").stream()
                .map(this::toUserResponse)
                .toList();
    }

    @Transactional
    public UserResponse getUser(UUID userId) {
        return toUserResponse(requireUser(userId));
    }

    @Transactional
    public List<MenuItemResponse> listVisibleMenu(List<String> roleCodes) {
        Set<String> allowedRoles = new HashSet<>((roleCodes == null ? List.<String>of() : roleCodes).stream()
                .map(value -> value.toLowerCase(Locale.ROOT))
                .toList());
        List<MenuItem> activeItems = MenuItem.<MenuItem>list("active = true order by level, sortOrder, label");
        Map<UUID, MenuItem> byId = activeItems.stream().collect(java.util.stream.Collectors.toMap(item -> item.id, item -> item));
        Set<UUID> visibleIds = new HashSet<>();
        for (MenuItem item : activeItems) {
            boolean visible = menuItemVisibleForRoles(item, byId, allowedRoles);
            if (!visible) {
                continue;
            }
            UUID cursor = item.id;
            while (cursor != null && visibleIds.add(cursor)) {
                MenuItem current = byId.get(cursor);
                cursor = current == null ? null : current.parentId;
            }
        }
        return menuTree(activeItems.stream().filter(item -> visibleIds.contains(item.id)).toList(), false);
    }

    private boolean menuItemVisibleForRoles(MenuItem item, Map<UUID, MenuItem> byId, Set<String> allowedRoles) {
        UUID cursor = item.id;
        Set<UUID> visited = new HashSet<>();
        while (cursor != null && visited.add(cursor)) {
            MenuItem current = byId.get(cursor);
            if (current == null) {
                return false;
            }
            List<String> roles = menuRoleCodes(current.id);
            if (!roles.isEmpty()) {
                return roles.stream().anyMatch(role -> allowedRoles.contains(role.toLowerCase(Locale.ROOT)));
            }
            cursor = current.parentId;
        }
        return false;
    }

    @Transactional
    public List<MenuItemResponse> listMenuAdmin() {
        return menuTree(MenuItem.<MenuItem>list("order by level, sortOrder, label"), true);
    }

    @Transactional
    public MenuItemResponse createMenuItem(MenuItemRequest request) {
        request = requirePayload(request);
        String code = normalizeMenuCode(required(request.code(), "code"));
        if (MenuItem.find("code", code).firstResult() != null) {
            throw ApiException.conflict("MENU_ITEM_ALREADY_EXISTS", "Ya existe una opcion de menu con ese codigo.");
        }
        MenuItem item = new MenuItem();
        applyMenuItem(item, request, code);
        item.persist();
        replaceMenuItemRoles(item.id, request.roleIds());
        return menuItemResponse(item);
    }

    @Transactional
    public MenuItemResponse updateMenuItem(UUID menuItemId, MenuItemRequest request) {
        request = requirePayload(request);
        MenuItem item = requireMenuItem(menuItemId);
        String code = request.code() == null ? item.code : normalizeMenuCode(required(request.code(), "code"));
        MenuItem duplicate = MenuItem.find("code", code).firstResult();
        if (duplicate != null && !duplicate.id.equals(item.id)) {
            throw ApiException.conflict("MENU_ITEM_ALREADY_EXISTS", "Ya existe una opcion de menu con ese codigo.");
        }
        applyMenuItem(item, request, code);
        replaceMenuItemRoles(item.id, request.roleIds());
        return menuItemResponse(item);
    }

    @Transactional
    public void deleteMenuItem(UUID menuItemId) {
        MenuItem item = requireMenuItem(menuItemId);
        item.delete();
    }

    @Transactional
    public UserResponse createUser(UserCreateRequest request, UUID actorUserId) {
        request = requirePayload(request);
        String login = required(request.login(), "login").toLowerCase(Locale.ROOT);
        String email = required(request.email(), "email").toLowerCase(Locale.ROOT);
        if (findUserByLoginOrEmail(login) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "Ya existe un usuario con el mismo login o correo.");
        }
        if (findUserByLoginOrEmail(email) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "Ya existe un usuario con el mismo login o correo.");
        }

        UserAccount user = new UserAccount();
        user.identityType = IdentityType.LOCAL;
        user.login = login;
        user.email = email;
        user.displayName = required(request.displayName(), "displayName");
        user.status = UserStatus.ACTIVE;
        user.persist();

        upsertProfile(user.id, request.employeeCode(), request.firstName(), request.lastName(), request.phone(), request.address(), request.jobTitle());
        String temporaryPassword = required(request.temporaryPassword(), "temporaryPassword");
        validatePasswordPolicy(temporaryPassword);
        createOrUpdateLocalCredential(user, temporaryPassword, true);
        replaceUserRoles(user.id, request.roleIds(), actorUserId);
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateUser(UUID userId, UserUpdateRequest request, UUID actorUserId) {
        request = requirePayload(request);
        UserAccount user = requireUser(userId);
        String login = request.login() == null ? user.login : required(request.login(), "login").toLowerCase(Locale.ROOT);
        String email = request.email() == null ? user.email : required(request.email(), "email").toLowerCase(Locale.ROOT);
        if (request.email() != null) {
            if (user.identityType == IdentityType.GOOGLE && !email.equalsIgnoreCase(user.email)) {
                throw ApiException.validation("GOOGLE_EMAIL_READ_ONLY", "El correo de una cuenta GOOGLE no se puede modificar.");
            }
            if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                throw ApiException.validation("EMAIL_INVALID", "El correo electronico no es valido.");
            }
        }
        ensureUserIdentifierAvailable(login, user.id, false);
        ensureUserIdentifierAvailable(email, user.id, true);

        try {
            user.login = login;
            user.email = email;
            if (request.displayName() != null) {
                user.displayName = required(request.displayName(), "displayName");
            }
            upsertProfile(user.id, request.employeeCode(), request.firstName(), request.lastName(), request.phone(), request.address(), request.jobTitle());
            if (request.roleIds() != null) {
                replaceUserRoles(user.id, request.roleIds(), actorUserId);
            }
            user.persistAndFlush();
            return toUserResponse(user);
        } catch (org.hibernate.exception.ConstraintViolationException exception) {
            if ("23505".equals(exception.getSQLState())) {
                throw ApiException.conflict("USER_ALREADY_EXISTS", "El usuario o correo ya esta registrado en otra cuenta.");
            }
            throw exception;
        }
    }

    @Transactional
    public List<IdentitySessionResponse> listActiveSessions(UUID currentSessionId) {
        Instant now = Instant.now();
        return IdentitySession.<IdentitySession>list("revokedAt is null and expiresAt > ?1 order by lastSeenAt desc", now)
                .stream()
                .map(session -> {
                    UserAccount user = UserAccount.findById(session.userId);
                    if (user == null || user.retiredAt != null) {
                        return null;
                    }
                    return new IdentitySessionResponse(
                            session.id,
                            user.id,
                            user.login,
                            user.email,
                            user.displayName,
                            user.identityType.name(),
                            user.status.name(),
                            session.createdAt,
                            session.lastSeenAt,
                            session.expiresAt,
                            session.userAgent,
                            session.deviceName,
                            deviceTypeFor(session.userAgent),
                            operatingSystemFor(session.userAgent),
                            browserFor(session.userAgent),
                            browserVersionFor(session.userAgent),
                            locationFor(session.ipAddress),
                            session.ipAddress,
                            session.id.equals(currentSessionId));
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional
    public void revokeSession(UUID sessionId) {
        if (sessionId == null) {
            return;
        }
        IdentitySession session = IdentitySession.findById(sessionId);
        if (session != null && session.revokedAt == null) {
            session.revokedAt = Instant.now();
            session.persist();
        }
    }

    @Transactional
    public void revokeAllSessions(UUID userId) {
        if (userId == null) {
            return;
        }
        IdentitySession.update("revokedAt = ?1 where userId = ?2 and revokedAt is null",
                Instant.now(), userId);
    }

    private boolean hasActiveSessions(UUID userId) {
        return !IdentitySession.<IdentitySession>list("userId = ?1 and revokedAt is null and expiresAt > ?2",
                userId, Instant.now()).isEmpty();
    }

    private ApiException activeSessionConflict(UUID userId) {
        return ApiException.conflict(
                "ACTIVE_SESSION",
                "El usuario ya tiene una sesion activa en otro dispositivo.",
                new ActiveSessionConflict(listActiveSessions(null).stream()
                        .filter(session -> session.userId().equals(userId))
                        .toList()));
    }

    private void ensureUserIdentifierAvailable(String value, UUID userId, boolean email) {
        UserAccount existing = UserAccount.find("(lower(login) = ?1 or lower(email) = ?1) and id <> ?2",
                value.toLowerCase(Locale.ROOT), userId).firstResult();
        if (existing == null) {
            return;
        }
        if (email && existing.identityType == IdentityType.GOOGLE) {
            throw ApiException.conflict("EMAIL_REGISTERED_WITH_GOOGLE", "Este correo ya pertenece a una cuenta GOOGLE registrada. Utiliza otro correo.");
        }
        throw ApiException.conflict("USER_ALREADY_EXISTS", email
                ? "Este correo ya pertenece a otra cuenta registrada. Utiliza otro correo."
                : "Este usuario ya esta registrado en otra cuenta.");
    }

    @Transactional
    public UserResponse replaceUserRoles(UUID userId, ReplaceUserRolesRequest request, UUID actorUserId) {
        request = requirePayload(request);
        UserAccount user = requireUser(userId);
        replaceUserRoles(user.id, request.roleIds(), actorUserId);
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse activateUser(UUID userId) {
        UserAccount user = requireUser(userId);
        user.status = UserStatus.ACTIVE;
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
        user.persist();
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse suspendUser(UUID userId) {
        UserAccount user = requireUser(userId);
        user.status = UserStatus.SUSPENDED;
        user.persist();
        return toUserResponse(user);
    }

    @Transactional
    public List<RoleResponse> listRoles() {
        return Role.<Role>list("order by active desc, code").stream()
                .map(this::toRoleResponse)
                .toList();
    }

    @Transactional
    public RoleResponse createRole(RoleCreateRequest request) {
        request = requirePayload(request);
        String code = required(request.code(), "code").toUpperCase(Locale.ROOT);
        if (Role.find("code", code).firstResult() != null) {
            throw ApiException.conflict("ROLE_ALREADY_EXISTS", "A role already exists with the same code.");
        }
        Role role = new Role();
        role.code = code;
        role.name = required(request.name(), "name");
        role.description = normalizeNullable(request.description());
        role.active = true;
        role.status = RoleStatus.ACTIVE;
        role.persist();
        replaceRolePermissions(role.id, safeList(request.permissionCodes()));
        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse updateRole(UUID roleId, RoleUpdateRequest request, boolean replaceMissingFields) {
        request = requirePayload(request);
        Role role = requireRole(roleId);
        if (roleStatus(role) == RoleStatus.DELETED) {
            throw ApiException.validation("ROLE_DELETED", "Deleted roles cannot be modified.");
        }

        if (request.code() != null || replaceMissingFields) {
            String code = required(request.code(), "code").toUpperCase(Locale.ROOT);
            Role existing = Role.find("code = ?1 and id <> ?2", code, role.id).firstResult();
            if (existing != null) {
                throw ApiException.conflict("ROLE_ALREADY_EXISTS", "A role already exists with the same code.");
            }
            role.code = code;
        }

        if (request.name() != null || replaceMissingFields) {
            role.name = required(request.name(), "name");
        }

        if (request.description() != null || replaceMissingFields) {
            role.description = normalizeNullable(request.description());
        }

        if (request.active() != null || replaceMissingFields) {
            boolean active = request.active() == null || request.active();
            if (active) {
                role.status = RoleStatus.ACTIVE;
                role.active = true;
            } else {
                ensureRoleCanBeDeactivated(role);
                role.status = RoleStatus.DISABLED;
                role.active = false;
            }
        }

        role.persist();

        if (request.permissionCodes() != null || replaceMissingFields) {
            replaceRolePermissions(role.id, safeList(request.permissionCodes()));
        }

        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse deleteRole(UUID roleId) {
        Role role = requireRole(roleId);
        ensureRoleCanBeDeactivated(role);
        removeRoleFromUsers(role.id);
        role.active = false;
        role.status = RoleStatus.DELETED;
        role.persist();
        return toRoleResponse(role);
    }

    @Transactional
    public List<PermissionResponse> listPermissions() {
        return PermissionCatalogItem.<PermissionCatalogItem>list("order by code").stream()
                .map(permission -> new PermissionResponse(permission.code, permission.description))
                .toList();
    }

    @Transactional
    public PasswordForgotResponse forgotPassword(PasswordForgotRequest request) {
        request = requirePayload(request);
        String loginOrEmail = required(request.loginOrEmail(), "loginOrEmail").toLowerCase(Locale.ROOT);
        UserAccount user = findUserByLoginOrEmail(loginOrEmail);
        if (user == null || user.status == UserStatus.RETIRED) {
            throw ApiException.notFound("RECOVERY_ACCOUNT_NOT_FOUND", "No existe una cuenta registrada con ese correo.");
        }

        LocalCredential localCredential = LocalCredential.findById(user.id);
        String purpose = localCredential == null && user.identityType == IdentityType.GOOGLE ? ACCESS_LOGIN : PASSWORD_RESET;
        if (PASSWORD_RESET.equals(purpose) && localCredential == null) {
            throw ApiException.conflict("RECOVERY_ACCOUNT_WITHOUT_LOCAL_CREDENTIAL", "Esta cuenta no tiene credencial local recuperable.");
        }

        String recipientEmail = recoveryEmailFor(user);
        if (recipientEmail == null) {
            throw ApiException.conflict("RECOVERY_ACCOUNT_WITHOUT_EMAIL", "La cuenta no tiene un correo para enviar el enlace de recuperacion.");
        }

        String rawToken = opaqueToken();
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.userId = user.id;
        resetToken.tokenHash = hashOpaqueToken(rawToken);
        resetToken.purpose = purpose;
        resetToken.expiresAt = Instant.now().plus(recoveryTokenTtlMinutes, ChronoUnit.MINUTES);
        resetToken.persist();

        boolean skipEmail = recoveryOfflineMode && returnRecoveryToken && !gmailRecoveryEmailService.isEnabled();
        if (!skipEmail) {
            if (ACCESS_LOGIN.equals(purpose)) {
                gmailRecoveryEmailService.sendAccessRecoveryEmail(
                        recipientEmail,
                        user.displayName,
                        recoveryLink(rawToken, true),
                        recoveryTokenTtlMinutes);
            } else {
                gmailRecoveryEmailService.sendPasswordRecoveryEmail(
                        recipientEmail,
                        user.displayName,
                        recoveryLink(rawToken, false),
                        recoveryTokenTtlMinutes);
            }
        }
        return new PasswordForgotResponse(true, returnRecoveryToken ? rawToken : null);
    }

    @Transactional
    public AuthTokenResponse resetPassword(PasswordResetRequest request) {
        request = requirePayload(request);
        String rawToken = required(request.token(), "token");
        PasswordResetToken resetToken = requireUsableRecoveryToken(rawToken, PASSWORD_RESET, "RESET_TOKEN_INVALID");

        UserAccount user = requireUser(resetToken.userId);
        if (user.identityType == IdentityType.GOOGLE || LocalCredential.findById(user.id) == null) {
            throw ApiException.validation("RESET_TOKEN_INVALID", "Este enlace no permite crear contrasena local para una cuenta Google.");
        }
        String newPassword = required(request.newPassword(), "newPassword");
        validatePasswordPolicy(newPassword);
        createOrUpdateLocalCredential(user, newPassword, false);
        user.status = UserStatus.ACTIVE;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = Instant.now();
        user.passwordChangedAt = Instant.now();
        user.persist();
        resetToken.usedAt = Instant.now();
        resetToken.persist();
        return tokenResponse(authenticatedUser(user));
    }

    @Transactional
    public AuthTokenResponse loginWithRecoveryToken(PasswordLoginRequest request) {
        request = requirePayload(request);
        String rawToken = required(request.token(), "token");
        PasswordResetToken resetToken = requireUsableRecoveryToken(rawToken, ACCESS_LOGIN, "ACCESS_TOKEN_INVALID");
        UserAccount user = requireUser(resetToken.userId);
        if (user.identityType != IdentityType.GOOGLE || LocalCredential.findById(user.id) != null) {
            throw ApiException.validation("ACCESS_TOKEN_INVALID", "Este enlace no corresponde a una cuenta Google.");
        }
        user.status = UserStatus.ACTIVE;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.lastLoginAt = Instant.now();
        user.persist();
        resetToken.usedAt = Instant.now();
        resetToken.persist();
        return tokenResponse(authenticatedUser(user));
    }

    @Transactional
    public void ensureBootstrapAdmin(String login, String email, String displayName, String password) {
        String normalizedLogin = required(login, "login").toLowerCase(Locale.ROOT);
        String normalizedEmail = normalizeNullable(email);
        if (normalizedEmail == null) {
            normalizedEmail = normalizedLogin.contains("@") ? normalizedLogin : normalizedLogin + "@identity.local";
        }
        UserAccount user = findUserByLoginOrEmail(normalizedLogin);
        if (user == null) {
            user = findUserByLoginOrEmail(normalizedEmail);
        }
        if (user == null) {
            user = new UserAccount();
            user.identityType = IdentityType.LOCAL;
            user.login = normalizedLogin;
            user.email = normalizedEmail;
            user.displayName = displayName == null || displayName.isBlank() ? "Administrador" : displayName.trim();
            user.status = UserStatus.ACTIVE;
            user.persist();
            upsertProfile(user.id, null, null, null, null, null, "Administrador");
        } else {
            user.email = normalizedEmail;
            user.status = UserStatus.ACTIVE;
            user.persist();
        }
        createOrUpdateLocalCredential(user, password, false);
        Role adminRole = requireRoleByCode("ADMIN");
        grantAllPermissions(adminRole.id);
        replaceUserRoles(user.id, List.of(adminRole.id), null);
    }

    private AuthTokenResponse tokenResponse(AuthenticatedUser user) {
        return tokenResponse(user, null, null);
    }

    private AuthTokenResponse tokenResponse(AuthenticatedUser user, String userAgent, String ipAddress) {
        IdentitySession session = new IdentitySession();
        session.id = UUID.randomUUID();
        session.userId = user.id();
        session.createdAt = Instant.now();
        session.lastSeenAt = session.createdAt;
        session.expiresAt = session.createdAt.plusSeconds(jwtService.accessTokenTtlSeconds());
        session.userAgent = userAgent;
        session.deviceName = deviceNameFor(userAgent);
        session.ipAddress = ipAddress;
        session.persist();
        return new AuthTokenResponse(jwtService.issueAccessToken(user, session.id), "Bearer", jwtService.accessTokenTtlSeconds(), toCurrentUser(user));
    }

    private String deviceNameFor(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Dispositivo no identificado";
        }
        String platform = userAgent.contains("Windows") ? "Windows"
                : userAgent.contains("Android") ? "Android"
                : userAgent.contains("iPhone") ? "iPhone"
                : userAgent.contains("Mac OS") ? "macOS"
                : userAgent.contains("Linux") ? "Linux" : "Dispositivo";
        String browser = userAgent.contains("Edg/") ? "Edge"
                : userAgent.contains("Chrome/") ? "Chrome"
                : userAgent.contains("Firefox/") ? "Firefox"
                : userAgent.contains("Safari/") ? "Safari" : "Navegador";
        return platform + " - " + browser;
    }

    private String deviceTypeFor(String userAgent) {
        if (userAgent == null) {
            return "Dispositivo no identificado";
        }
        if (userAgent.contains("Tablet") || userAgent.contains("iPad")) {
            return "Tablet";
        }
        if (userAgent.contains("Mobile") || userAgent.contains("Android")) {
            return "Movil";
        }
        return "PC / navegador web";
    }

    private String operatingSystemFor(String userAgent) {
        if (userAgent == null) {
            return "No identificado";
        }
        if (userAgent.contains("Windows NT 10.0")) {
            return "Windows 10/11";
        }
        if (userAgent.contains("Windows")) {
            return "Windows";
        }
        if (userAgent.contains("Android")) {
            return "Android";
        }
        if (userAgent.contains("iPhone") || userAgent.contains("iPad")) {
            return "iOS / iPadOS";
        }
        if (userAgent.contains("Mac OS")) {
            return "macOS";
        }
        if (userAgent.contains("Linux")) {
            return "Linux";
        }
        return "No identificado";
    }

    private String browserFor(String userAgent) {
        if (userAgent == null) {
            return "Navegador no identificado";
        }
        if (userAgent.contains("Edg/")) {
            return "Microsoft Edge";
        }
        if (userAgent.contains("OPR/")) {
            return "Opera";
        }
        if (userAgent.contains("Chrome/")) {
            return "Google Chrome";
        }
        if (userAgent.contains("Firefox/")) {
            return "Mozilla Firefox";
        }
        if (userAgent.contains("Safari/") && !userAgent.contains("Chrome/")) {
            return "Safari";
        }
        return "Navegador web";
    }

    private String browserVersionFor(String userAgent) {
        if (userAgent == null) {
            return "";
        }
        String[] markers = { "Edg/", "OPR/", "Chrome/", "Firefox/", "Version/" };
        for (String marker : markers) {
            int start = userAgent.indexOf(marker);
            if (start < 0) {
                continue;
            }
            int versionStart = start + marker.length();
            int end = versionStart;
            while (end < userAgent.length() && (Character.isDigit(userAgent.charAt(end)) || userAgent.charAt(end) == '.')) {
                end++;
            }
            if (end > versionStart) {
                return userAgent.substring(versionStart, end);
            }
        }
        return "";
    }

    private String locationFor(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()
                || ipAddress.equals("127.0.0.1") || ipAddress.equals("::1") || ipAddress.equalsIgnoreCase("localhost")) {
            return "Entorno local";
        }
        return "Ubicacion aproximada no disponible";
    }

    private AuthenticatedUser authenticatedUser(UserAccount user) {
        return new AuthenticatedUser(
                user.id,
                user.login,
                user.email,
                user.displayName,
                roleCodesForUser(user.id),
                permissionCodesForUser(user.id),
                null);
    }

    private CurrentUserResponse toCurrentUser(UserAccount user) {
        return toCurrentUser(authenticatedUser(user), user.status.name());
    }

    private CurrentUserResponse toCurrentUser(AuthenticatedUser user) {
        UserAccount persisted = UserAccount.findById(user.id());
        String status = persisted == null ? null : persisted.status.name();
        return toCurrentUser(user, status);
    }

    private CurrentUserResponse toCurrentUser(AuthenticatedUser user, String status) {
        UserAccount persisted = UserAccount.findById(user.id());
        return new CurrentUserResponse(
                user.id(),
                persisted == null ? null : persisted.identityType.name(),
                user.login(),
                user.email(),
                user.displayName(),
                persisted == null ? null : persisted.avatarUrl,
                persisted != null && persisted.darkMode,
                status,
                user.roles(),
                user.permissions());
    }

    private UserResponse toUserResponse(UserAccount user) {
        InternalProfile profile = InternalProfile.findById(user.id);
        return new UserResponse(
                user.id,
                user.legacyId,
                user.identityType.name(),
                user.login,
                user.email,
                user.googleSubject,
                user.displayName,
                user.status.name(),
                profile == null ? null : profile.employeeCode,
                profile == null ? null : profile.firstName,
                profile == null ? null : profile.lastName,
                profile == null ? null : profile.phone,
                profile == null ? null : profile.address,
                profile == null ? null : profile.jobTitle,
                roleCodesForUser(user.id),
                assignedRoleCodesForUser(user.id),
                user.lastLoginAt,
                user.lockedUntil,
                user.createdAt,
                user.updatedAt);
    }

    private RoleResponse toRoleResponse(Role role) {
        RoleStatus status = roleStatus(role);
        return new RoleResponse(role.id, role.code, role.name, role.description, status == RoleStatus.ACTIVE, status.name(), permissionCodesForRole(role.id));
    }

    private void applyMenuItem(MenuItem item, MenuItemRequest request, String code) {
        UUID parentId = request.parentId();
        if (parentId != null && parentId.equals(item.id)) {
            throw ApiException.validation("MENU_PARENT_INVALID", "Una opcion no puede ser su propio padre.");
        }
        if (parentId != null && isMenuDescendant(parentId, item.id)) {
            throw ApiException.validation("MENU_PARENT_INVALID", "No se puede mover una opcion debajo de uno de sus descendientes.");
        }
        MenuItem parent = parentId == null ? null : requireMenuItem(parentId);
        int level = parent == null ? 1 : parent.level + 1;
        String label = required(request.label() == null ? item.label : request.label(), "label");
        boolean informationalOnly = request.informationalOnly() == null ? item.informationalOnly : request.informationalOnly();
        String targetUrl = informationalOnly ? "" : required(request.targetUrl() == null ? item.targetUrl : request.targetUrl(), "targetUrl");
        if (!informationalOnly && !targetUrl.startsWith("/") && !targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            throw ApiException.validation("MENU_URL_INVALID", "La URL debe ser relativa o comenzar con http:// o https://.");
        }
        item.code = code;
        item.label = label;
        item.icon = trimNullable(request.icon() == null ? item.icon : request.icon());
        item.targetUrl = targetUrl;
        item.manifestUrl = informationalOnly ? null : trimNullable(request.manifestUrl() == null ? item.manifestUrl : request.manifestUrl());
        item.informationalOnly = informationalOnly;
        item.parentId = parentId;
        item.level = level;
        item.sortOrder = request.sortOrder() == null ? (item.id == null ? nextMenuSortOrder(parentId) : item.sortOrder) : request.sortOrder();
        item.active = request.active() == null ? item.active : request.active();
        if (item.id == null) {
            item.persist();
        }
        // Ensure the moved node is visible to the recursive descendant query.
        entityManager().flush();
        updateMenuDescendantLevels(item.id, item.level);
    }

    private void updateMenuDescendantLevels(UUID parentId, int parentLevel) {
        List<MenuItem> children = MenuItem.list("parentId", parentId);
        for (MenuItem child : children) {
            child.level = parentLevel + 1;
            updateMenuDescendantLevels(child.id, child.level);
        }
    }

    private int nextMenuSortOrder(UUID parentId) {
        List<MenuItem> siblings = parentId == null
                ? MenuItem.list("parentId is null")
                : MenuItem.list("parentId", parentId);
        return siblings.stream().mapToInt(item -> item.sortOrder).max().orElse(0) + 10;
    }

    private boolean isMenuDescendant(UUID candidateParentId, UUID itemId) {
        UUID cursor = candidateParentId;
        Set<UUID> visited = new HashSet<>();
        while (cursor != null && visited.add(cursor)) {
            if (cursor.equals(itemId)) {
                return true;
            }
            MenuItem current = MenuItem.findById(cursor);
            cursor = current == null ? null : current.parentId;
        }
        return false;
    }

    private void replaceMenuItemRoles(UUID menuItemId, List<UUID> roleIds) {
        if (roleIds == null) {
            return;
        }
        for (UUID roleId : roleIds) {
            Role role = Role.findById(roleId);
            if (role == null || roleStatus(role) != RoleStatus.ACTIVE) {
                throw ApiException.validation("ROLE_NOT_FOUND", "El rol no existe o esta inactivo: " + roleId + ".");
            }
        }
        entityManager().createNativeQuery("DELETE FROM menu_item_roles WHERE menu_item_id = ?1")
                .setParameter(1, menuItemId)
                .executeUpdate();
        for (UUID roleId : roleIds) {
            entityManager().createNativeQuery("INSERT INTO menu_item_roles (menu_item_id, role_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING")
                    .setParameter(1, menuItemId)
                    .setParameter(2, roleId)
                    .executeUpdate();
        }
    }

    private MenuItem requireMenuItem(UUID menuItemId) {
        MenuItem item = MenuItem.findById(menuItemId);
        if (item == null) {
            throw ApiException.notFound("MENU_ITEM_NOT_FOUND", "La opcion de menu no existe.");
        }
        return item;
    }

    private String normalizeMenuCode(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-z0-9]+(?:[-_.][a-z0-9]+)*")) {
            throw ApiException.validation("MENU_CODE_INVALID", "El codigo solo puede contener letras, numeros, guion, punto o guion bajo.");
        }
        return normalized;
    }

    private List<MenuItemResponse> menuTree(List<MenuItem> items, boolean includeRoles) {
        Map<UUID, List<MenuItem>> children = new HashMap<>();
        for (MenuItem item : items) {
            children.computeIfAbsent(item.parentId, ignored -> new ArrayList<>()).add(item);
        }
        return menuTreeNodes(children, null, includeRoles);
    }

    private List<MenuItemResponse> menuTreeNodes(Map<UUID, List<MenuItem>> children, UUID parentId, boolean includeRoles) {
        List<MenuItem> nodes = children.getOrDefault(parentId, List.of());
        return nodes.stream()
                .sorted(java.util.Comparator.comparingInt((MenuItem item) -> item.sortOrder).thenComparing(item -> item.label))
                .map(item -> new MenuItemResponse(
                        item.id,
                        item.code,
                        item.label,
                        item.icon,
                        item.targetUrl,
                        item.manifestUrl,
                        item.informationalOnly,
                        item.parentId,
                        item.level,
                        item.sortOrder,
                        item.active,
                        includeRoles ? menuRoleCodes(item.id) : List.of(),
                        menuTreeNodes(children, item.id, includeRoles)))
                .toList();
    }

    private MenuItemResponse menuItemResponse(MenuItem item) {
        return new MenuItemResponse(item.id, item.code, item.label, item.icon, item.targetUrl, item.manifestUrl,
                item.informationalOnly, item.parentId, item.level, item.sortOrder, item.active, menuRoleCodes(item.id), List.of());
    }

    private List<String> menuRoleCodes(UUID menuItemId) {
        return entityManager().createNativeQuery("""
                SELECT r.code::text
                FROM roles r
                JOIN menu_item_roles mir ON mir.role_id = r.id
                WHERE mir.menu_item_id = ?1
                ORDER BY r.code
                """, String.class)
                .setParameter(1, menuItemId)
                .getResultList();
    }

    private UserAccount createGoogleUser(GooglePrincipal principal) {
        UserAccount user = new UserAccount();
        user.identityType = IdentityType.GOOGLE;
        user.login = principal.email();
        user.email = principal.email();
        user.googleSubject = principal.subject();
        user.avatarUrl = principal.pictureUrl();
        user.displayName = principal.displayName() == null || principal.displayName().isBlank() ? principal.email() : principal.displayName();
        user.status = UserStatus.ACTIVE;
        user.persist();
        Role defaultRole = Role.find("code = ?1 and status = ?2", googleDefaultRoleCode, RoleStatus.ACTIVE).firstResult();
        if (defaultRole != null) {
            replaceUserRoles(user.id, List.of(defaultRole.id), null);
        }
        return user;
    }

    private void assignDefaultRole(UUID userId, String roleCode) {
        Role defaultRole = Role.find("code = ?1 and status = ?2", roleCode, RoleStatus.ACTIVE).firstResult();
        if (defaultRole != null) {
            replaceUserRoles(userId, List.of(defaultRole.id), null);
        }
    }

    private void linkGoogleIdentity(UserAccount user, GooglePrincipal principal) {
        GoogleIdentity googleIdentity = GoogleIdentity.find("googleSubject", principal.subject()).firstResult();
        Instant now = Instant.now();
        if (googleIdentity == null) {
            googleIdentity = new GoogleIdentity();
            googleIdentity.userId = user.id;
            googleIdentity.googleSubject = principal.subject();
            googleIdentity.email = principal.email();
            googleIdentity.emailVerified = principal.emailVerified();
            googleIdentity.linkedAt = now;
        }
        googleIdentity.lastSeenAt = now;
        googleIdentity.persist();
        user.googleSubject = principal.subject();
        if ((user.avatarUrl == null || user.avatarUrl.isBlank()) && principal.pictureUrl() != null && !principal.pictureUrl().isBlank()) {
            user.avatarUrl = principal.pictureUrl();
        }
        if (user.email == null) {
            user.email = principal.email();
        }
    }

    private void createOrUpdateLocalCredential(UserAccount user, String password, boolean temporaryPassword) {
        LocalCredential credential = LocalCredential.findById(user.id);
        if (credential == null) {
            credential = new LocalCredential();
            credential.userId = user.id;
        }
        credential.passwordHash = passwordHashService.hash(password);
        credential.passwordAlgorithm = "PBKDF2WithHmacSHA256";
        credential.temporaryPassword = temporaryPassword;
        credential.mustChangePassword = temporaryPassword;
        credential.persist();
        user.passwordChangedAt = Instant.now();
    }

    private void registerFailedLogin(UserAccount user, String login, String userAgent) {
        user.failedLoginAttempts += 1;
        if (user.failedLoginAttempts >= maxFailedAttempts) {
            user.status = UserStatus.LOCKED;
            user.lockedUntil = Instant.now().plus(lockoutMinutes, ChronoUnit.MINUTES);
        }
        user.persist();
        recordLoginAttempt(user.id, login, false, "INVALID_CREDENTIALS", userAgent);
    }

    private void recordLoginAttempt(UUID userId, String login, boolean success, String failureReason, String userAgent) {
        entityManager().createNativeQuery("""
                INSERT INTO login_attempts (user_id, login, success, failure_reason, user_agent)
                VALUES (?1, ?2, ?3, ?4, ?5)
                """)
                .setParameter(1, userId)
                .setParameter(2, login)
                .setParameter(3, success)
                .setParameter(4, failureReason)
                .setParameter(5, userAgent)
                .executeUpdate();
    }

    private void replaceUserRoles(UUID userId, List<UUID> roleIds, UUID actorUserId) {
        List<UUID> assignedRoleIds = entityManager().createNativeQuery("SELECT role_id FROM user_roles WHERE user_id = ?1", UUID.class)
                .setParameter(1, userId)
                .getResultList();
        for (UUID roleId : safeList(roleIds)) {
            Role role = Role.findById(roleId);
            boolean retainedDisabledRole = role != null && roleStatus(role) == RoleStatus.DISABLED && assignedRoleIds.contains(roleId);
            if (role == null || (roleStatus(role) != RoleStatus.ACTIVE && !retainedDisabledRole)) {
                throw ApiException.validation("ROLE_NOT_FOUND", "Role does not exist or is inactive: " + roleId + ".");
            }
        }
        entityManager().createNativeQuery("DELETE FROM user_roles WHERE user_id = ?1")
                .setParameter(1, userId)
                .executeUpdate();
        for (UUID roleId : safeList(roleIds)) {
            entityManager().createNativeQuery("""
                    INSERT INTO user_roles (user_id, role_id, assigned_by_user_id)
                    VALUES (?1, ?2, ?3)
                    ON CONFLICT DO NOTHING
                    """)
                    .setParameter(1, userId)
                    .setParameter(2, roleId)
                    .setParameter(3, actorUserId)
                    .executeUpdate();
        }
    }

    private void removeRoleFromUsers(UUID roleId) {
        entityManager().createNativeQuery("DELETE FROM user_roles WHERE role_id = ?1")
                .setParameter(1, roleId)
                .executeUpdate();
    }

    private void ensureRoleCanBeDeactivated(Role role) {
        if ("ADMIN".equalsIgnoreCase(role.code)) {
            throw ApiException.validation("ROLE_PROTECTED", "The ADMIN role cannot be deactivated or deleted.");
        }
    }

    private RoleStatus roleStatus(Role role) {
        if (role.status != null) {
            return role.status;
        }
        return role.active ? RoleStatus.ACTIVE : RoleStatus.DELETED;
    }

    private void replaceRolePermissions(UUID roleId, List<String> permissionCodes) {
        entityManager().createNativeQuery("DELETE FROM role_permissions WHERE role_id = ?1")
                .setParameter(1, roleId)
                .executeUpdate();
        for (String permissionCode : permissionCodes) {
            String normalized = required(permissionCode, "permissionCode").toLowerCase(Locale.ROOT);
            PermissionCatalogItem permission = PermissionCatalogItem.findById(normalized);
            if (permission == null) {
                throw ApiException.validation("PERMISSION_NOT_FOUND", "Permission does not exist: " + normalized + ".");
            }
            entityManager().createNativeQuery("""
                    INSERT INTO role_permissions (role_id, permission_code)
                    VALUES (?1, ?2)
                    ON CONFLICT DO NOTHING
                    """)
                    .setParameter(1, roleId)
                    .setParameter(2, normalized)
                    .executeUpdate();
        }
    }

    private void grantAllPermissions(UUID roleId) {
        entityManager().createNativeQuery("""
                INSERT INTO role_permissions (role_id, permission_code)
                SELECT ?1, code FROM permissions
                ON CONFLICT DO NOTHING
                """)
                .setParameter(1, roleId)
                .executeUpdate();
    }

    private void upsertProfile(UUID userId, String employeeCode, String firstName, String lastName, String phone, String address, String jobTitle) {
        InternalProfile profile = InternalProfile.findById(userId);
        if (profile == null) {
            profile = new InternalProfile();
            profile.userId = userId;
        }
        if (employeeCode != null) {
            profile.employeeCode = trimNullable(employeeCode);
        }
        if (firstName != null) {
            profile.firstName = trimNullable(firstName);
        }
        if (lastName != null) {
            profile.lastName = trimNullable(lastName);
        }
        if (phone != null) {
            profile.phone = trimNullable(phone);
        }
        if (address != null) {
            profile.address = trimNullable(address);
        }
        if (jobTitle != null) {
            profile.jobTitle = trimNullable(jobTitle);
        }
        profile.persist();
    }

    private UserAccount requireUser(UUID userId) {
        UserAccount user = UserAccount.findById(userId);
        if (user == null || user.retiredAt != null) {
            throw ApiException.notFound("USER_NOT_FOUND", "User was not found.");
        }
        return user;
    }

    private Role requireRoleByCode(String code) {
        Role role = Role.find("code", code).firstResult();
        if (role == null) {
            throw ApiException.notFound("ROLE_NOT_FOUND", "Role was not found: " + code + ".");
        }
        return role;
    }

    private Role requireRole(UUID roleId) {
        Role role = Role.findById(roleId);
        if (role == null) {
            throw ApiException.notFound("ROLE_NOT_FOUND", "Role was not found.");
        }
        return role;
    }

    private UserAccount findUserByLoginOrEmail(String loginOrEmail) {
        String normalized = normalizeNullable(loginOrEmail);
        if (normalized == null) {
            return null;
        }
        return UserAccount.find("login = ?1 or email = ?1", normalized).firstResult();
    }

    private UserAccount findUserByGoogleSubject(String googleSubject) {
        String normalized = normalizeNullable(googleSubject);
        if (normalized == null) {
            return null;
        }
        return UserAccount.find("googleSubject", normalized).firstResult();
    }

    private List<String> roleCodesForUser(UUID userId) {
        return entityManager().createNativeQuery("""
                SELECT r.code::text
                FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = ?1 AND r.status = 'ACTIVE'
                ORDER BY r.code
                """, String.class)
                .setParameter(1, userId)
                .getResultList();
    }

    private List<String> assignedRoleCodesForUser(UUID userId) {
        return entityManager().createNativeQuery("""
                SELECT r.code::text
                FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = ?1 AND r.status <> 'DELETED'
                ORDER BY r.code
                """, String.class)
                .setParameter(1, userId)
                .getResultList();
    }

    private List<String> permissionCodesForUser(UUID userId) {
        return entityManager().createNativeQuery("""
                SELECT DISTINCT p.code::text AS code
                FROM permissions p
                JOIN role_permissions rp ON rp.permission_code = p.code
                JOIN user_roles ur ON ur.role_id = rp.role_id
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = ?1 AND r.status = 'ACTIVE'
                ORDER BY code
                """, String.class)
                .setParameter(1, userId)
                .getResultList();
    }

    private List<String> permissionCodesForRole(UUID roleId) {
        return entityManager().createNativeQuery("""
                SELECT p.code::text
                FROM permissions p
                JOIN role_permissions rp ON rp.permission_code = p.code
                WHERE rp.role_id = ?1
                ORDER BY p.code
                """, String.class)
                .setParameter(1, roleId)
                .getResultList();
    }

    private String opaqueToken() {
        byte[] bytes = new byte[OPAQUE_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private PasswordResetToken requireUsableRecoveryToken(String rawToken, String purpose, String errorCode) {
        PasswordResetToken resetToken = PasswordResetToken.find("tokenHash = ?1 and purpose = ?2",
                hashOpaqueToken(rawToken), purpose).firstResult();
        if (resetToken == null || resetToken.usedAt != null || resetToken.expiresAt.isBefore(Instant.now())) {
            throw ApiException.validation(errorCode, "El enlace de recuperacion es invalido o expiro.");
        }
        return resetToken;
    }

    private String recoveryLink(String rawToken, boolean accessLogin) {
        String baseUrl = recoveryResetUrl == null || recoveryResetUrl.isBlank()
                ? "http://localhost:3001/identity/recovery"
                : recoveryResetUrl.trim();
        String separator = baseUrl.contains("?") ? "&" : "?";
        String tokenParam = "token=" + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        return accessLogin ? baseUrl + separator + tokenParam + "&mode=login" : baseUrl + separator + tokenParam;
    }

    private String recoveryEmailFor(UserAccount user) {
        if (user.email != null && !user.email.isBlank()) {
            return user.email.trim().toLowerCase(Locale.ROOT);
        }
        if (user.login != null && user.login.contains("@")) {
            return user.login.trim().toLowerCase(Locale.ROOT);
        }
        return null;
    }

    private EntityManager entityManager() {
        return entityManager.get();
    }

    private String hashOpaqueToken(String rawToken) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(recoveryTokenPepper.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not hash recovery token.", exception);
        }
    }

    private String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + name + ".");
        }
        return value.trim();
    }

    private String displayNameOrFallback(String displayName, String fallback) {
        String trimmed = trimNullable(displayName);
        return trimmed == null ? fallback : trimmed;
    }

    private String normalizeAvatar(String value) {
        String avatarUrl = trimNullable(value);
        if (avatarUrl == null) {
            return null;
        }
        if (avatarUrl.length() > 1_000_000
                || !avatarUrl.matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")) {
            throw ApiException.validation("AVATAR_INVALID", "La foto debe ser una imagen JPG, PNG o WebP valida de hasta 750 KB.");
        }
        return avatarUrl;
    }

    private void validatePasswordPolicy(String password) {
        if (password.length() < 12) {
            throw ApiException.validation("PASSWORD_TOO_WEAK", "La contrasena debe tener al menos 12 caracteres.");
        }
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private <T> T requirePayload(T payload) {
        if (payload == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Request body is required.");
        }
        return payload;
    }

    private ApiException invalidCredentials() {
        return ApiException.unauthorized("INVALID_CREDENTIALS", "Login or password is invalid.");
    }
}
