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
import java.util.Map;

@Entity
@Table(name = "ejecucion", schema = "calculos")
public class EjecucionEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "id_solicitud", nullable = false, length = 100)
    public String idSolicitud;

    @Column(name = "formula_id")
    public Long formulaId;

    @Column(name = "codigo_formula", nullable = false, length = 100)
    public String codigoFormula;

    @Column(name = "version_formula")
    public Integer versionFormula;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    public Map<String, Object> parametros;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public JsonNode resultado;

    @Column(name = "tipo_resultado", length = 200)
    public String tipoResultado;

    @Column(nullable = false, length = 30)
    public String estado;

    @Column(columnDefinition = "text")
    public String error;

    @Column(name = "fecha_inicio", nullable = false)
    public OffsetDateTime fechaInicio;

    @Column(name = "fecha_fin", nullable = false)
    public OffsetDateTime fechaFin;

    @Column(name = "duracion_ms", nullable = false)
    public Long duracionMs;
}
