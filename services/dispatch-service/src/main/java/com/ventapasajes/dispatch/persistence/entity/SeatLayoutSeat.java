package com.ventapasajes.dispatch.persistence.entity;

import java.util.UUID;

import com.ventapasajes.dispatch.domain.SeatPosition;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "seat_layout_seats",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"seat_layout_id", "seat_number"}),
                @UniqueConstraint(columnNames = {"seat_layout_id", "row_number", "column_number"})
        })
public class SeatLayoutSeat extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seat_layout_id", nullable = false)
    public SeatLayout seatLayout;

    @Column(name = "seat_number", nullable = false)
    public Integer seatNumber;

    public String label;

    @Column(name = "row_number", nullable = false)
    public Integer rowNumber;

    @Column(name = "column_number", nullable = false)
    public Integer columnNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public SeatPosition position;

    @Column(nullable = false)
    public boolean active = true;
}
