package ec.gob.iess.calculos.entity;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
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

    @Column(columnDefinition = "text")
    public String descripcion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public JsonNode ejemplo;

    @Column(nullable = false)
    public Boolean activa;

    @Column(nullable = false, length = 20)
    public String estado;

    @Column(name = "creado_por", nullable = false, length = 200)
    public String creadoPor;

    @Column(name = "publicado_por", length = 200)
    public String publicadoPor;

    @Column(name = "fecha_publicacion")
    public OffsetDateTime fechaPublicacion;

    @Column(name = "activado_por", length = 200)
    public String activadoPor;

    @Column(name = "fecha_activacion")
    public OffsetDateTime fechaActivacion;

    @Column(name = "fecha_creacion", nullable = false)
    public OffsetDateTime fechaCreacion;
}
