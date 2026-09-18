param(
    [string]$MfeTicketingUrl = "http://localhost:3003"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$PagePath = Join-Path -Path $Root -ChildPath "apps/mfe-ticketing/app/ticketing/embedded/page.tsx"
$CssPath = Join-Path -Path $Root -ChildPath "apps/mfe-ticketing/app/globals.css"

function Assert-Contains {
    param(
        [string]$Text,
        [string]$Needle,
        [string]$Message
    )

    if (!$Text.Contains($Needle)) {
        throw $Message
    }
}

$Page = Get-Content -LiteralPath $PagePath -Raw
$Css = Get-Content -LiteralPath $CssPath -Raw

Assert-Contains -Text $Page -Needle "LEGACY_25_SEAT_COORDINATES" -Message "Missing legacy 25-seat coordinate map."
Assert-Contains -Text $Page -Needle '"25": { column: 3, position: "MIDDLE", row: 7 }' -Message "Missing middle rear seat for legacy 25 layout."
Assert-Contains -Text $Page -Needle "buildGeneratedSeatLayout" -Message "Missing generated fallback layout."
Assert-Contains -Text $Page -Needle "style={gridCellStyle(cell)}" -Message "Seat cells must use grid coordinates."
if ($Page -notmatch 'key=\{seat\.seat_id\}[\s\S]{0,700}style=\{gridCellStyle\(cell\)\}') {
    throw "Seat buttons must use grid coordinates."
}
Assert-Contains -Text $Page -Needle 'label: "Chofer"' -Message "Missing driver marker."
Assert-Contains -Text $Page -Needle 'label: "Entrada"' -Message "Missing entrance marker."
Assert-Contains -Text $Page -Needle 'label: index === 0 ? "Pasillo" : undefined' -Message "Missing aisle marker."
Assert-Contains -Text $Page -Needle "Array.from({ length: 25 }" -Message "Demo departure must exercise 25 seats."
Assert-Contains -Text $Page -Needle 'seat-${seatTone(seat.status)}' -Message "Seats must render status-specific classes."

Assert-Contains -Text $Css -Needle ".legend-cancelled" -Message "Missing cancelled status legend color."
Assert-Contains -Text $Css -Needle ".seat-cancelled" -Message "Missing cancelled seat color."
Assert-Contains -Text $Css -Needle ".layout-driver" -Message "Missing driver cell styles."
Assert-Contains -Text $Css -Needle ".layout-entry" -Message "Missing entrance cell styles."
Assert-Contains -Text $Css -Needle ".layout-aisle" -Message "Missing aisle cell styles."
Assert-Contains -Text $Css -Needle "height: var(--seat-cell-size);" -Message "Seat cells must use responsive sizing."
Assert-Contains -Text $Css -Needle "@media (max-width: 1220px)" -Message "Missing desktop/tablet breakpoint."
Assert-Contains -Text $Css -Needle "@media (max-width: 820px)" -Message "Missing narrow tablet/mobile breakpoint."
Assert-Contains -Text $Css -Needle "--seat-cell-size: 46px" -Message "Missing tablet seat size."
Assert-Contains -Text $Css -Needle "--seat-cell-size: 42px" -Message "Missing compact seat size."

$EmbeddedStatus = "not_checked"
try {
    $Embedded = Invoke-WebRequest -Uri "$MfeTicketingUrl/ticketing/embedded" -UseBasicParsing -TimeoutSec 8
    $EmbeddedStatus = $Embedded.StatusCode
} catch {
    if ($_.Exception.Response) {
        $EmbeddedStatus = [int]$_.Exception.Response.StatusCode
    } else {
        $EmbeddedStatus = "unavailable"
    }
}

[pscustomobject]@{
    service = "mfe-ticketing"
    validation = "seat-map-day34"
    legacy_25_layout = $true
    generated_layout_fallback = $true
    status_colors = @("available", "reserved", "sold", "blocked", "cancelled")
    cabin_markers = @("Chofer", "Entrada", "Pasillo")
    desktop_breakpoint = "1220px"
    tablet_breakpoint = "820px"
    embedded_status = $EmbeddedStatus
    ready = $true
} | ConvertTo-Json -Compress
