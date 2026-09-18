package com.ventapasajes.identity.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.identity.api.ApiException;
import com.ventapasajes.identity.api.dto.AuthTokenResponse;
import com.ventapasajes.identity.api.dto.AuthorizedIdentityCreateRequest;
import com.ventapasajes.identity.api.dto.AuthorizedIdentityResponse;
import com.ventapasajes.identity.api.dto.CurrentUserResponse;
import com.ventapasajes.identity.api.dto.GoogleTokenExchangeRequest;
import com.ventapasajes.identity.api.dto.LocalLoginRequest;
import com.ventapasajes.identity.api.dto.PasswordForgotRequest;
import com.ventapasajes.identity.api.dto.PasswordForgotResponse;
import com.ventapasajes.identity.api.dto.PasswordResetRequest;
import com.ventapasajes.identity.api.dto.PermissionResponse;
import com.ventapasajes.identity.api.dto.ReplaceUserRolesRequest;
import com.ventapasajes.identity.api.dto.RoleCreateRequest;
import com.ventapasajes.identity.api.dto.RoleResponse;
import com.ventapasajes.identity.api.dto.UserCreateRequest;
import com.ventapasajes.identity.api.dto.UserResponse;
import com.ventapasajes.identity.api.dto.UserUpdateRequest;
import com.ventapasajes.identity.auth.AuthenticatedUser;
import com.ventapasajes.identity.auth.GoogleIdTokenVerifier;
import com.ventapasajes.identity.auth.GoogleIdTokenVerifier.GooglePrincipal;
import com.ventapasajes.identity.auth.JwtService;
import com.ventapasajes.identity.auth.PasswordHashService;
import com.ventapasajes.identity.domain.AuthorizedIdentityType;
import com.ventapasajes.identity.domain.IdentityType;
import com.ventapasajes.identity.domain.UserStatus;
import com.ventapasajes.identity.persistence.entity.AuthorizedIdentity;
import com.ventapasajes.identity.persistence.entity.GoogleIdentity;
import com.ventapasajes.identity.persistence.entity.InternalProfile;
import com.ventapasajes.identity.persistence.entity.LocalCredential;
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
    private static final int OPAQUE_TOKEN_BYTES = 32;

    @Inject
    Instance<EntityManager> entityManager;

    @Inject
    PasswordHashService passwordHashService;

    @Inject
    JwtService jwtService;

    @Inject
    GoogleIdTokenVerifier googleIdTokenVerifier;

    @ConfigProperty(name = "app.auth.local.max-failed-attempts", defaultValue = "5")
    int maxFailedAttempts;

    @ConfigProperty(name = "app.auth.local.lockout-minutes", defaultValue = "15")
    long lockoutMinutes;

    @ConfigProperty(name = "app.auth.recovery-token-ttl-minutes", defaultValue = "30")
    long recoveryTokenTtlMinutes;

    @ConfigProperty(name = "app.auth.recovery.return-token.enabled", defaultValue = "false")
    boolean returnRecoveryToken;

    @ConfigProperty(name = "app.security.recovery-token-pepper")
    String recoveryTokenPepper;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthTokenResponse localLogin(LocalLoginRequest request, String userAgent) {
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
        return tokenResponse(authenticatedUser(user));
    }

    @Transactional
    public AuthTokenResponse googleExchange(GoogleTokenExchangeRequest request) {
        GooglePrincipal principal = googleIdTokenVerifier.verify(request == null ? null : request.idToken());
        if (!isAuthorizedGoogleIdentity(principal)) {
            throw ApiException.forbidden("GOOGLE_IDENTITY_NOT_AUTHORIZED", "Google identity is not authorized for this system.");
        }

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
        return tokenResponse(authenticatedUser(user));
    }

    @Transactional
    public CurrentUserResponse currentUser(UUID userId) {
        return toCurrentUser(requireUser(userId));
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
    public UserResponse createUser(UserCreateRequest request, UUID actorUserId) {
        request = requirePayload(request);
        IdentityType identityType = request.identityType() == null ? IdentityType.LOCAL : request.identityType();
        String login = required(request.login(), "login").toLowerCase(Locale.ROOT);
        if (findUserByLoginOrEmail(login) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "A user already exists with the same login or email.");
        }
        if (request.email() != null && findUserByLoginOrEmail(request.email().toLowerCase(Locale.ROOT)) != null) {
            throw ApiException.conflict("USER_ALREADY_EXISTS", "A user already exists with the same login or email.");
        }

        UserAccount user = new UserAccount();
        user.identityType = identityType;
        user.login = login;
        user.email = normalizeNullable(request.email());
        user.googleSubject = normalizeNullable(request.googleSubject());
        user.displayName = required(request.displayName(), "displayName");
        user.status = UserStatus.ACTIVE;
        user.persist();

        upsertProfile(user.id, request.employeeCode(), request.firstName(), request.lastName(), request.phone(), request.address(), request.jobTitle());
        if (identityType == IdentityType.LOCAL || identityType == IdentityType.HYBRID) {
            String temporaryPassword = required(request.temporaryPassword(), "temporaryPassword");
            createOrUpdateLocalCredential(user, temporaryPassword, true);
        }
        replaceUserRoles(user.id, request.roleIds(), actorUserId);
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateUser(UUID userId, UserUpdateRequest request) {
        request = requirePayload(request);
        UserAccount user = requireUser(userId);
        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.displayName = request.displayName().trim();
        }
        upsertProfile(user.id, request.employeeCode(), request.firstName(), request.lastName(), request.phone(), request.address(), request.jobTitle());
        user.persist();
        return toUserResponse(user);
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
        return Role.<Role>list("active = true order by code").stream()
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
        role.persist();
        replaceRolePermissions(role.id, safeList(request.permissionCodes()));
        return toRoleResponse(role);
    }

    @Transactional
    public List<PermissionResponse> listPermissions() {
        return PermissionCatalogItem.<PermissionCatalogItem>list("order by code").stream()
                .map(permission -> new PermissionResponse(permission.code, permission.description))
                .toList();
    }

    @Transactional
    public List<AuthorizedIdentityResponse> listAuthorizedIdentities() {
        return AuthorizedIdentity.<AuthorizedIdentity>list("order by type, value").stream()
                .map(this::toAuthorizedIdentityResponse)
                .toList();
    }

    @Transactional
    public AuthorizedIdentityResponse createAuthorizedIdentity(AuthorizedIdentityCreateRequest request, UUID actorUserId) {
        request = requirePayload(request);
        AuthorizedIdentityType type = request.type() == null ? AuthorizedIdentityType.EMAIL : request.type();
        String value = normalizeAuthorizedValue(type, required(request.value(), "value"));
        AuthorizedIdentity existing = AuthorizedIdentity.find("type = ?1 and value = ?2", type, value).firstResult();
        if (existing != null) {
            throw ApiException.conflict("AUTHORIZED_IDENTITY_ALREADY_EXISTS", "Authorized identity already exists.");
        }
        AuthorizedIdentity identity = new AuthorizedIdentity();
        identity.type = type;
        identity.value = value;
        identity.active = request.active() == null || request.active();
        identity.createdByUserId = actorUserId;
        identity.persist();
        return toAuthorizedIdentityResponse(identity);
    }

    @Transactional
    public PasswordForgotResponse forgotPassword(PasswordForgotRequest request) {
        request = requirePayload(request);
        String loginOrEmail = required(request.loginOrEmail(), "loginOrEmail").toLowerCase(Locale.ROOT);
        UserAccount user = findUserByLoginOrEmail(loginOrEmail);
        String rawToken = null;
        if (user != null && LocalCredential.findById(user.id) != null && user.status != UserStatus.RETIRED) {
            rawToken = opaqueToken();
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.userId = user.id;
            resetToken.tokenHash = hashOpaqueToken(rawToken);
            resetToken.purpose = PASSWORD_RESET;
            resetToken.expiresAt = Instant.now().plus(recoveryTokenTtlMinutes, ChronoUnit.MINUTES);
            resetToken.persist();
        }
        return new PasswordForgotResponse(true, returnRecoveryToken ? rawToken : null);
    }

    @Transactional
    public void resetPassword(PasswordResetRequest request) {
        request = requirePayload(request);
        String rawToken = required(request.token(), "token");
        PasswordResetToken resetToken = PasswordResetToken.find("tokenHash = ?1 and purpose = ?2",
                hashOpaqueToken(rawToken), PASSWORD_RESET).firstResult();
        if (resetToken == null || resetToken.usedAt != null || resetToken.expiresAt.isBefore(Instant.now())) {
            throw ApiException.validation("RESET_TOKEN_INVALID", "Password reset token is invalid or expired.");
        }

        UserAccount user = requireUser(resetToken.userId);
        createOrUpdateLocalCredential(user, required(request.newPassword(), "newPassword"), false);
        user.status = UserStatus.ACTIVE;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        user.passwordChangedAt = Instant.now();
        user.persist();
        resetToken.usedAt = Instant.now();
        resetToken.persist();
    }

    @Transactional
    public void ensureBootstrapAdmin(String login, String email, String displayName, String password) {
        String normalizedLogin = required(login, "login").toLowerCase(Locale.ROOT);
        UserAccount user = findUserByLoginOrEmail(normalizedLogin);
        if (user == null) {
            user = new UserAccount();
            user.identityType = IdentityType.LOCAL;
            user.login = normalizedLogin;
            user.email = normalizeNullable(email);
            user.displayName = displayName == null || displayName.isBlank() ? "Administrador" : displayName.trim();
            user.status = UserStatus.ACTIVE;
            user.persist();
            upsertProfile(user.id, null, null, null, null, null, "Administrador");
        } else {
            user.status = UserStatus.ACTIVE;
            user.persist();
        }
        createOrUpdateLocalCredential(user, password, false);
        Role adminRole = requireRoleByCode("ADMIN");
        grantAllPermissions(adminRole.id);
        replaceUserRoles(user.id, List.of(adminRole.id), null);
    }

    private AuthTokenResponse tokenResponse(AuthenticatedUser user) {
        return new AuthTokenResponse(jwtService.issueAccessToken(user), "Bearer", jwtService.accessTokenTtlSeconds(), toCurrentUser(user));
    }

    private AuthenticatedUser authenticatedUser(UserAccount user) {
        return new AuthenticatedUser(
                user.id,
                user.login,
                user.email,
                user.displayName,
                roleCodesForUser(user.id),
                permissionCodesForUser(user.id));
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
        return new CurrentUserResponse(user.id(), user.login(), user.email(), user.displayName(), status, user.roles(), user.permissions());
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
                user.lastLoginAt,
                user.lockedUntil,
                user.createdAt,
                user.updatedAt);
    }

    private RoleResponse toRoleResponse(Role role) {
        return new RoleResponse(role.id, role.code, role.name, role.description, role.active, permissionCodesForRole(role.id));
    }

    private AuthorizedIdentityResponse toAuthorizedIdentityResponse(AuthorizedIdentity identity) {
        return new AuthorizedIdentityResponse(
                identity.id,
                identity.type.name(),
                identity.value,
                identity.active,
                identity.createdByUserId,
                identity.createdAt,
                identity.updatedAt);
    }

    private UserAccount createGoogleUser(GooglePrincipal principal) {
        UserAccount user = new UserAccount();
        user.identityType = IdentityType.GOOGLE;
        user.login = principal.email();
        user.email = principal.email();
        user.googleSubject = principal.subject();
        user.displayName = principal.displayName() == null || principal.displayName().isBlank() ? principal.email() : principal.displayName();
        user.status = UserStatus.ACTIVE;
        user.persist();
        Role sellerRole = Role.find("code", "TICKET_SELLER").firstResult();
        if (sellerRole != null) {
            replaceUserRoles(user.id, List.of(sellerRole.id), null);
        }
        return user;
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
        if (user.email == null) {
            user.email = principal.email();
        }
        if (user.identityType == IdentityType.LOCAL) {
            user.identityType = IdentityType.HYBRID;
        }
    }

    private boolean isAuthorizedGoogleIdentity(GooglePrincipal principal) {
        if (existsActiveAuthorizedIdentity(AuthorizedIdentityType.GOOGLE_SUBJECT, principal.subject())) {
            return true;
        }
        if (existsActiveAuthorizedIdentity(AuthorizedIdentityType.EMAIL, principal.email())) {
            return true;
        }
        String domain = emailDomain(principal.email());
        return domain != null && existsActiveAuthorizedIdentity(AuthorizedIdentityType.DOMAIN, domain);
    }

    private boolean existsActiveAuthorizedIdentity(AuthorizedIdentityType type, String value) {
        return AuthorizedIdentity.count("type = ?1 and value = ?2 and active = true", type, normalizeAuthorizedValue(type, value)) > 0;
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
        entityManager().createNativeQuery("DELETE FROM user_roles WHERE user_id = ?1")
                .setParameter(1, userId)
                .executeUpdate();
        for (UUID roleId : safeList(roleIds)) {
            Role role = Role.findById(roleId);
            if (role == null || !role.active) {
                throw ApiException.validation("ROLE_NOT_FOUND", "Role does not exist or is inactive: " + roleId + ".");
            }
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
                WHERE ur.user_id = ?1 AND r.active = true
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
                WHERE ur.user_id = ?1 AND r.active = true
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

    private String normalizeAuthorizedValue(AuthorizedIdentityType type, String value) {
        String normalized = required(value, "value").toLowerCase(Locale.ROOT);
        if (type == AuthorizedIdentityType.DOMAIN && normalized.startsWith("@")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private String emailDomain(String email) {
        int atIndex = email == null ? -1 : email.lastIndexOf('@');
        return atIndex < 0 ? null : email.substring(atIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + name + ".");
        }
        return value.trim();
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
