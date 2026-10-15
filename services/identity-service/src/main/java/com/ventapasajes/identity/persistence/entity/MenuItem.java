package com.ventapasajes.identity.persistence.entity;

import java.util.UUID;

import com.ventapasajes.identity.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "menu_items")
public class MenuItem extends AuditablePanacheEntity {

    @Column(nullable = false, unique = true)
    public String code;

    @Column(nullable = false)
    public String label;

    public String icon;

    @Column(name = "target_url", nullable = false)
    public String targetUrl;

    @Column(name = "manifest_url")
    public String manifestUrl;

    @Column(name = "informational_only", nullable = false)
    public boolean informationalOnly = false;

    @Column(name = "parent_id")
    public UUID parentId;

    @Column(nullable = false)
    public int level;

    @Column(name = "sort_order", nullable = false)
    public int sortOrder;

    @Column(nullable = false)
    public boolean active = true;
}
