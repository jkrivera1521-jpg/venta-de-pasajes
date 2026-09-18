package com.ventapasajes.identity.persistence.entity;

import java.time.Instant;

import com.ventapasajes.identity.domain.IdentityType;
import com.ventapasajes.identity.domain.UserStatus;
import com.ventapasajes.identity.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class UserAccount extends AuditablePanacheEntity {

    @Column(name = "legacy_id")
    public Integer legacyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "identity_type", nullable = false)
    public IdentityType identityType;

    @Column(nullable = false)
    public String login;

    public String email;

    @Column(name = "google_subject")
    public String googleSubject;

    @Column(name = "display_name", nullable = false)
    public String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public UserStatus status = UserStatus.PENDING_ACTIVATION;

    @Column(name = "failed_login_attempts", nullable = false)
    public int failedLoginAttempts;

    @Column(name = "locked_until")
    public Instant lockedUntil;

    @Column(name = "last_login_at")
    public Instant lastLoginAt;

    @Column(name = "password_changed_at")
    public Instant passwordChangedAt;

    @Column(name = "retired_at")
    public Instant retiredAt;
}
