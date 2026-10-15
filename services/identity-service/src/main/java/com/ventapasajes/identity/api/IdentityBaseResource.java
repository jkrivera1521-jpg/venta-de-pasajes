package com.ventapasajes.identity.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.identity.api.dto.GoogleTokenExchangeRequest;
import com.ventapasajes.identity.api.dto.IdentitySessionResponse;
import com.ventapasajes.identity.api.dto.LocalLoginRequest;
import com.ventapasajes.identity.api.dto.MenuItemRequest;
import com.ventapasajes.identity.api.dto.PasswordForgotRequest;
import com.ventapasajes.identity.api.dto.PasswordLoginRequest;
import com.ventapasajes.identity.api.dto.PasswordResetRequest;
import com.ventapasajes.identity.api.dto.PublicLocalRegisterRequest;
import com.ventapasajes.identity.api.dto.ProfilePhotoRequest;
import com.ventapasajes.identity.api.dto.ThemePreferenceRequest;
import com.ventapasajes.identity.api.dto.ReplaceUserRolesRequest;
import com.ventapasajes.identity.api.dto.RoleCreateRequest;
import com.ventapasajes.identity.api.dto.RoleUpdateRequest;
import com.ventapasajes.identity.api.dto.UserCreateRequest;
import com.ventapasajes.identity.api.dto.UserUpdateRequest;
import com.ventapasajes.identity.auth.RequestIdentity;
import com.ventapasajes.identity.auth.RequiresPermission;
import com.ventapasajes.identity.service.IdentityApplicationService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/identity")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "identity-base")
public class IdentityBaseResource {

    @Inject
    IdentityApplicationService identityService;

    @Inject
    RequestIdentity requestIdentity;

    @POST
    @Path("/auth/local/login")
    @Operation(summary = "Authenticate with local username and password.")
    @APIResponse(responseCode = "200", description = "Authenticated with an internal JWT.")
    public Response localLogin(LocalLoginRequest request,
            @HeaderParam("User-Agent") String userAgent,
            @HeaderParam("X-Forwarded-For") String forwardedFor,
            @HeaderParam("X-Real-IP") String realIp) {
        return Response.ok(identityService.localLogin(request, userAgent, clientIp(forwardedFor, realIp))).build();
    }

    @POST
    @Path("/auth/google/exchange")
    @Operation(summary = "Validate a Google ID token and exchange it for an internal JWT.")
    @APIResponse(responseCode = "200", description = "Google account validated and exchanged.")
    public Response googleExchange(GoogleTokenExchangeRequest request,
            @HeaderParam("User-Agent") String userAgent,
            @HeaderParam("X-Forwarded-For") String forwardedFor,
            @HeaderParam("X-Real-IP") String realIp) {
        return Response.ok(identityService.googleExchange(request, userAgent, clientIp(forwardedFor, realIp))).build();
    }

    @POST
    @Path("/auth/local/register")
    @Operation(summary = "Register a public local customer account.")
    @APIResponse(responseCode = "201", description = "Public local account created and authenticated.")
    public Response registerLocal(PublicLocalRegisterRequest request,
            @HeaderParam("User-Agent") String userAgent,
            @HeaderParam("X-Forwarded-For") String forwardedFor,
            @HeaderParam("X-Real-IP") String realIp) {
        var response = identityService.registerLocalPublicAccount(request, userAgent, clientIp(forwardedFor, realIp));
        return Response.created(URI.create("/api/v1/identity/me"))
                .entity(response)
                .build();
    }

    @POST
    @Path("/auth/logout")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission
    @Operation(summary = "Logout from all sessions for the authenticated user.")
    @APIResponse(responseCode = "204", description = "All sessions revoked.")
    public Response logout() {
        identityService.revokeAllSessions(requestIdentity.user().id());
        return Response.noContent().build();
    }

    @POST
    @Path("/auth/logout/current")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission
    @Operation(summary = "Logout only the current authenticated session.")
    @APIResponse(responseCode = "204", description = "Current session revoked.")
    public Response logoutCurrentSession() {
        identityService.revokeSession(requestIdentity.user().sessionId());
        return Response.noContent().build();
    }

    @POST
    @Path("/auth/refresh")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission
    @Operation(summary = "Refresh the current authenticated session token.")
    @APIResponse(responseCode = "200", description = "Authenticated session token refreshed.")
    public Response refreshSession() {
        return Response.ok(identityService.refreshCurrentSession(requestIdentity.user())).build();
    }

    @GET
    @Path("/sessions")
    @RequiresPermission("identity.sessions.read")
    @Operation(summary = "List active central identity sessions.")
    @APIResponse(responseCode = "200", description = "Active sessions listed.")
    public Response listSessions() {
        return Response.ok(identityService.listActiveSessions(requestIdentity.user().sessionId())).build();
    }

    @POST
    @Path("/sessions/{sessionId}/revoke")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission("identity.sessions.revoke")
    @Operation(summary = "Revoke one central identity session.")
    @APIResponse(responseCode = "204", description = "Session revoked.")
    public Response revokeSession(@PathParam("sessionId") String sessionId) {
        identityService.revokeSession(parseUuid(sessionId, "sessionId"));
        return Response.noContent().build();
    }

    @POST
    @Path("/users/{userId}/logout")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission("identity.sessions.revoke")
    @Operation(summary = "Close all active sessions for one user.")
    @APIResponse(responseCode = "204", description = "User sessions revoked.")
    public Response logoutUser(@PathParam("userId") String userId) {
        identityService.revokeAllSessions(parseUuid(userId, "userId"));
        return Response.noContent().build();
    }

    @GET
    @Path("/me")
    @RequiresPermission
    @Operation(summary = "Read the current authenticated user profile.")
    @APIResponse(responseCode = "200", description = "Current user profile.")
    public Response currentUser() {
        return Response.ok(identityService.currentUser(requestIdentity.user().id())).build();
    }

    @PATCH
    @Path("/me/avatar")
    @RequiresPermission
    @Operation(summary = "Update the current user's profile photo.")
    @APIResponse(responseCode = "200", description = "Profile photo updated.")
    public Response updateCurrentUserAvatar(ProfilePhotoRequest request) {
        return Response.ok(identityService.updateCurrentUserAvatar(requestIdentity.user().id(), request)).build();
    }

    @PATCH
    @Path("/me/theme")
    @RequiresPermission
    @Operation(summary = "Update the current user's theme preference.")
    @APIResponse(responseCode = "200", description = "Theme preference updated.")
    public Response updateCurrentUserTheme(ThemePreferenceRequest request) {
        return Response.ok(identityService.updateCurrentUserTheme(requestIdentity.user().id(), request)).build();
    }

    @GET
    @Path("/menu")
    @RequiresPermission
    @Operation(summary = "List the menu authorized for the current user.")
    @APIResponse(responseCode = "200", description = "Authorized menu listed.")
    public Response listVisibleMenu() {
        return Response.ok(identityService.listVisibleMenu(requestIdentity.user().roles())).build();
    }

    @GET
    @Path("/menu/admin")
    @RequiresPermission("identity.menu.read")
    @Operation(summary = "List all menu items for administration.")
    @APIResponse(responseCode = "200", description = "Menu administration tree listed.")
    public Response listMenuAdmin() {
        return Response.ok(identityService.listMenuAdmin()).build();
    }

    @POST
    @Path("/menu")
    @RequiresPermission("identity.menu.manage")
    @Operation(summary = "Create one menu item.")
    @APIResponse(responseCode = "201", description = "Menu item created.")
    public Response createMenuItem(MenuItemRequest request) {
        var response = identityService.createMenuItem(request);
        return Response.created(URI.create("/api/v1/identity/menu/" + response.id())).entity(response).build();
    }

    @PATCH
    @Path("/menu/{menuItemId}")
    @RequiresPermission("identity.menu.manage")
    @Operation(summary = "Update one menu item.")
    @APIResponse(responseCode = "200", description = "Menu item updated.")
    public Response updateMenuItem(@PathParam("menuItemId") String menuItemId, MenuItemRequest request) {
        return Response.ok(identityService.updateMenuItem(parseUuid(menuItemId, "menuItemId"), request)).build();
    }

    @DELETE
    @Path("/menu/{menuItemId}")
    @RequiresPermission("identity.menu.manage")
    @Operation(summary = "Delete one menu item and its descendants.")
    @APIResponse(responseCode = "204", description = "Menu item deleted.")
    public Response deleteMenuItem(@PathParam("menuItemId") String menuItemId) {
        identityService.deleteMenuItem(parseUuid(menuItemId, "menuItemId"));
        return Response.noContent().build();
    }

    @GET
    @Path("/users")
    @RequiresPermission("identity.users.read")
    @Operation(summary = "List active internal users.")
    @APIResponse(responseCode = "200", description = "Users listed.")
    public Response listUsers() {
        return Response.ok(identityService.listUsers()).build();
    }

    @POST
    @Path("/users")
    @RequiresPermission("identity.users.write")
    @Operation(summary = "Create an internal local user.")
    @APIResponse(responseCode = "201", description = "User created.")
    public Response createUser(UserCreateRequest request) {
        var response = identityService.createUser(request, requestIdentity.user().id());
        return Response.created(URI.create("/api/v1/identity/users/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/users/{userId}")
    @RequiresPermission("identity.users.read")
    @Operation(summary = "Read one internal user.")
    @APIResponse(responseCode = "200", description = "User found.")
    public Response getUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.getUser(parseUuid(userId, "userId"))).build();
    }

    @PATCH
    @Path("/users/{userId}")
    @RequiresPermission("identity.users.write")
    @Operation(summary = "Update one internal user profile.")
    @APIResponse(responseCode = "200", description = "User updated.")
    public Response updateUser(@PathParam("userId") String userId, UserUpdateRequest request) {
        if (request != null && request.roleIds() != null && !requestIdentity.user().hasPermission("identity.roles.manage")) {
            throw ApiException.forbidden("FORBIDDEN", "No tienes permisos para modificar los roles del usuario.");
        }
        return Response.ok(identityService.updateUser(parseUuid(userId, "userId"), request, requestIdentity.user().id())).build();
    }

    @PUT
    @Path("/users/{userId}/roles")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Replace all roles for one user.")
    @APIResponse(responseCode = "200", description = "User roles replaced.")
    public Response replaceUserRoles(@PathParam("userId") String userId, ReplaceUserRolesRequest request) {
        return Response.ok(identityService.replaceUserRoles(parseUuid(userId, "userId"), request, requestIdentity.user().id())).build();
    }

    @POST
    @Path("/users/{userId}/activate")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission("identity.users.status")
    @Operation(summary = "Activate one user.")
    @APIResponse(responseCode = "200", description = "User activated.")
    public Response activateUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.activateUser(parseUuid(userId, "userId"))).build();
    }

    @POST
    @Path("/users/{userId}/suspend")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission("identity.users.status")
    @Operation(summary = "Suspend one user.")
    @APIResponse(responseCode = "200", description = "User suspended.")
    public Response suspendUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.suspendUser(parseUuid(userId, "userId"))).build();
    }

    @GET
    @Path("/roles")
    @RequiresPermission("identity.roles.read")
    @Operation(summary = "List roles with their current active or inactive state.")
    @APIResponse(responseCode = "200", description = "Roles listed.")
    public Response listRoles() {
        return Response.ok(identityService.listRoles()).build();
    }

    @POST
    @Path("/roles")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Create one role with permissions.")
    @APIResponse(responseCode = "201", description = "Role created.")
    public Response createRole(RoleCreateRequest request) {
        var response = identityService.createRole(request);
        return Response.created(URI.create("/api/v1/identity/roles/" + response.id()))
                .entity(response)
                .build();
    }

    @PATCH
    @Path("/roles/{roleId}")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Partially update one role and optionally replace its permissions.")
    @APIResponse(responseCode = "200", description = "Role updated.")
    public Response updateRole(@PathParam("roleId") String roleId, RoleUpdateRequest request) {
        return Response.ok(identityService.updateRole(parseUuid(roleId, "roleId"), request, false)).build();
    }

    @PUT
    @Path("/roles/{roleId}")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Replace one role definition and its permissions.")
    @APIResponse(responseCode = "200", description = "Role replaced.")
    public Response replaceRole(@PathParam("roleId") String roleId, RoleUpdateRequest request) {
        return Response.ok(identityService.updateRole(parseUuid(roleId, "roleId"), request, true)).build();
    }

    @DELETE
    @Path("/roles/{roleId}")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Soft delete one role and remove it from assigned users.")
    @APIResponse(responseCode = "200", description = "Role marked inactive.")
    public Response deleteRole(@PathParam("roleId") String roleId) {
        return Response.ok(identityService.deleteRole(parseUuid(roleId, "roleId"))).build();
    }

    @GET
    @Path("/permissions")
    @RequiresPermission("identity.permissions.read")
    @Operation(summary = "List permission catalog.")
    @APIResponse(responseCode = "200", description = "Permissions listed.")
    public Response listPermissions() {
        return Response.ok(identityService.listPermissions()).build();
    }

    @POST
    @Path("/password/forgot")
    @Operation(summary = "Create a one-time password reset token.")
    @APIResponse(responseCode = "202", description = "Password recovery accepted.")
    public Response forgotPassword(PasswordForgotRequest request) {
        return Response.accepted(identityService.forgotPassword(request)).build();
    }

    @POST
    @Path("/password/login")
    @Operation(summary = "Authenticate with a one-time account access token.")
    @APIResponse(responseCode = "200", description = "Recovery login completed and authenticated.")
    public Response loginWithRecoveryToken(PasswordLoginRequest request) {
        return Response.ok(identityService.loginWithRecoveryToken(request)).build();
    }

    @POST
    @Path("/password/reset")
    @Operation(summary = "Reset a password with a one-time token.")
    @APIResponse(responseCode = "200", description = "Password reset completed and authenticated.")
    public Response resetPassword(PasswordResetRequest request) {
        return Response.ok(identityService.resetPassword(request)).build();
    }

    private UUID parseUuid(String value, String fieldName) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw ApiException.validation("VALIDATION_ERROR", "Field must be a UUID: " + fieldName + ".");
        }
    }

    private String clientIp(String forwardedFor, String realIp) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return realIp == null || realIp.isBlank() ? "No identificada" : realIp.trim();
    }
}
