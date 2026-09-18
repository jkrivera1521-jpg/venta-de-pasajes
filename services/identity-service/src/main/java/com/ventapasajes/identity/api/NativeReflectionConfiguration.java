package com.ventapasajes.identity.api;

import com.ventapasajes.identity.api.dto.AuthorizedIdentityCreateRequest;
import com.ventapasajes.identity.api.dto.AuthorizedIdentityResponse;
import com.ventapasajes.identity.api.dto.AuthTokenResponse;
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
import com.ventapasajes.identity.api.dto.StatusReasonRequest;
import com.ventapasajes.identity.api.dto.UserCreateRequest;
import com.ventapasajes.identity.api.dto.UserResponse;
import com.ventapasajes.identity.api.dto.UserUpdateRequest;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection(targets = {
        ApiErrorResponse.class,
        ApiErrorResponse.ApiError.class,
        ServiceStatus.class,
        AuthorizedIdentityCreateRequest.class,
        AuthorizedIdentityResponse.class,
        AuthTokenResponse.class,
        CurrentUserResponse.class,
        GoogleTokenExchangeRequest.class,
        LocalLoginRequest.class,
        PasswordForgotRequest.class,
        PasswordForgotResponse.class,
        PasswordResetRequest.class,
        PermissionResponse.class,
        ReplaceUserRolesRequest.class,
        RoleCreateRequest.class,
        RoleResponse.class,
        StatusReasonRequest.class,
        UserCreateRequest.class,
        UserResponse.class,
        UserUpdateRequest.class
})
public final class NativeReflectionConfiguration {

    private NativeReflectionConfiguration() {
    }
}
