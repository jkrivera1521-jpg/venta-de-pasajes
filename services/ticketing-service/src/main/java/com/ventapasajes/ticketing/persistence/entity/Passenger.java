package com.ventapasajes.ticketing.persistence.entity;

import com.ventapasajes.ticketing.domain.DocumentType;
import com.ventapasajes.ticketing.domain.PassengerStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "passengers")
public class Passenger extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 24)
    public DocumentType documentType = DocumentType.CEDULA;

    @Column(name = "document_number", nullable = false, length = 64)
    public String documentNumber;

    @Column(name = "first_name", nullable = false, length = 120)
    public String firstName;

    @Column(name = "last_name", nullable = false, length = 120)
    public String lastName;

    @Column(length = 320)
    public String email;

    @Column(length = 40)
    public String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public PassengerStatus status = PassengerStatus.ACTIVE;
}
