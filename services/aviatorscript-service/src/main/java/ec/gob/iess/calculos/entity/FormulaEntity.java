package ec.gob.iess.calculos.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "formula", schema = "calculos")
public class FormulaEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 100)
    public String codigo;

    @Column(nullable = false, length = 200)
    public String nombre;

    @Column(nullable = false)
    public Integer version;

    @Column(nullable = false, columnDefinition = "text")
    public String expresion;

    @Column(nullable = false)
    public Boolean activa;

    @Column(name = "fecha_creacion", nullable = false)
    public OffsetDateTime fechaCreacion;
}
