param(
  [string]$AccessPath = "legacy\sistema\Proyect\usuario.mdb",
  [string]$OutputDir = "logs\migration\dia74-final-rehearsal",
  [string]$BackupRoot = "backups\final-migration-rehearsal",
  [string]$ContainerName = "venta-pasajes-dia74-migration",
  [string]$PostgresImage = "postgres:16-alpine",
  [switch]$ValidateLocal,
  [switch]$KeepLocalContainer,
  [switch]$FailOnBlocked
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

function Resolve-FullPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Get-AccessProvider {
  param([string]$ResolvedAccessPath)

  $Providers = @(
    "Microsoft.ACE.OLEDB.16.0",
    "Microsoft.ACE.OLEDB.12.0",
    "Microsoft.Jet.OLEDB.4.0"
  )

  foreach ($Provider in $Providers) {
    $ConnectionString = "Provider=$Provider;Data Source=$ResolvedAccessPath;Persist Security Info=False;"
    $Connection = New-Object System.Data.OleDb.OleDbConnection($ConnectionString)
    try {
      $Connection.Open()
      return [pscustomobject]@{
        provider = $Provider
        connection_string = $ConnectionString
      }
    } catch {
      continue
    } finally {
      $Connection.Dispose()
    }
  }

  throw "No se pudo abrir Access. Instale Microsoft Access Database Engine ACE OLEDB 16 o 12."
}

function Convert-DataTableRows {
  param([System.Data.DataTable]$DataTable)

  $Rows = @()
  foreach ($Row in $DataTable.Rows) {
    $Object = [ordered]@{}
    foreach ($Column in $DataTable.Columns) {
      $Value = $Row[$Column.ColumnName]
      if ($Value -is [DBNull]) {
        $Value = $null
      }
      $Object[$Column.ColumnName] = $Value
    }
    $Rows += [pscustomobject]$Object
  }

  return $Rows
}

function Read-AccessTable {
  param(
    [System.Data.OleDb.OleDbConnection]$Connection,
    [string]$TableName
  )

  $Adapter = New-Object System.Data.OleDb.OleDbDataAdapter("SELECT * FROM [$TableName]", $Connection)
  $DataTable = New-Object System.Data.DataTable
  [void]$Adapter.Fill($DataTable)

  return [pscustomobject]@{
    name = $TableName
    count = $DataTable.Rows.Count
    columns = @($DataTable.Columns | ForEach-Object { $_.ColumnName })
    rows = @(Convert-DataTableRows -DataTable $DataTable)
  }
}

function New-DeterministicUuid {
  param([string]$Key)

  $Sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $Hash = $Sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("venta-pasajes-dia74|$Key"))
  } finally {
    $Sha.Dispose()
  }

  $GuidBytes = New-Object byte[] 16
  [Array]::Copy($Hash, 0, $GuidBytes, 0, 16)
  $GuidBytes[7] = ($GuidBytes[7] -band 0x0F) -bor 0x50
  $GuidBytes[8] = ($GuidBytes[8] -band 0x3F) -bor 0x80

  return ([Guid]::new($GuidBytes)).ToString()
}

function Normalize-Code {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return "N-A"
  }

  return (($Value.Trim().ToUpperInvariant() -replace "[^A-Z0-9]+", "-").Trim("-"))
}

function Sql-Text {
  param([object]$Value)

  if ($null -eq $Value) {
    return "NULL"
  }

  $Text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return "NULL"
  }

  return "'" + ($Text.Trim() -replace "'", "''") + "'"
}

function Sql-Number {
  param([object]$Value)

  if ($null -eq $Value) {
    return "0"
  }

  $Text = ([string]$Value).Trim().Replace(",", ".")
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return "0"
  }

  return $Text
}

function Sql-Timestamp {
  param([object]$Value)

  if ($null -eq $Value) {
    return "NULL"
  }

  try {
    $Date = [DateTime]$Value
    return "'" + $Date.ToString("yyyy-MM-dd HH:mm:ss") + "-05'::timestamptz"
  } catch {
    return "NULL"
  }
}

function Get-DepartureAtSql {
  param([object]$Salida)

  $Date = [DateTime]$Salida.Fecha_salida
  $Time = [DateTime]$Salida.Hora_salida
  $Combined = Get-Date -Year $Date.Year -Month $Date.Month -Day $Date.Day -Hour $Time.Hour -Minute $Time.Minute -Second $Time.Second
  return "'" + $Combined.ToString("yyyy-MM-dd HH:mm:ss") + "-05'::timestamptz"
}

function Get-RegistrationTimestampSql {
  param([object]$Cliente)

  try {
    $DateParts = ([string]$Cliente.F_registro).Split("/")
    if ($DateParts.Count -ne 3) {
      return "now()"
    }

    $Date = Get-Date -Year ([int]$DateParts[2]) -Month ([int]$DateParts[1]) -Day ([int]$DateParts[0])
    $TimeText = ([string]$Cliente.H_registro).Replace("a.m.", "AM").Replace("p.m.", "PM").Replace("a. m.", "AM").Replace("p. m.", "PM")
    $Time = [DateTime]::Parse($TimeText)
    $Combined = Get-Date -Year $Date.Year -Month $Date.Month -Day $Date.Day -Hour $Time.Hour -Minute $Time.Minute -Second $Time.Second
    return "'" + $Combined.ToString("yyyy-MM-dd HH:mm:ss") + "-05'::timestamptz"
  } catch {
    return "now()"
  }
}

function Add-UniqueTerminal {
  param(
    [hashtable]$Terminals,
    [string]$Name,
    [object]$LegacyId,
    [string]$ManagerName,
    [string]$Address,
    [string]$Phone,
    [string]$Email,
    [string]$LocalCode
  )

  $CleanName = if ([string]::IsNullOrWhiteSpace($Name)) { "SIN NOMBRE" } else { $Name.Trim() }
  $Key = $CleanName.ToUpperInvariant()

  if (-not $Terminals.ContainsKey($Key)) {
    $ResolvedLegacyId = $null
    if ($null -ne $LegacyId -and -not [string]::IsNullOrWhiteSpace([string]$LegacyId)) {
      $ResolvedLegacyId = [int]$LegacyId
    }

    $StableKey = if ($null -ne $ResolvedLegacyId) { "terminal:$ResolvedLegacyId" } else { "terminal:$CleanName" }
    $Terminals[$Key] = [pscustomobject]@{
      id = New-DeterministicUuid -Key $StableKey
      legacy_id = $ResolvedLegacyId
      name = $CleanName
      manager_name = $ManagerName
      address = $Address
      phone = $Phone
      email = $Email
      local_code = if ([string]::IsNullOrWhiteSpace($LocalCode)) { Normalize-Code -Value $CleanName } else { $LocalCode }
    }
  }

  return $Terminals[$Key]
}

function New-SeatLayoutRows {
  param(
    [string]$LayoutId,
    [int]$SeatCount
  )

  $Rows = @()
  for ($Seat = 1; $Seat -le $SeatCount; $Seat++) {
    $RowNumber = [int][Math]::Ceiling($Seat / 4)
    $ColumnNumber = (($Seat - 1) % 4) + 1
    $Position = switch ($ColumnNumber) {
      1 { "WINDOW" }
      2 { "AISLE" }
      3 { "AISLE" }
      4 { "WINDOW" }
      default { "MIDDLE" }
    }

    $Rows += [pscustomobject]@{
      id = New-DeterministicUuid -Key "layout-seat:${LayoutId}:$Seat"
      seat_number = $Seat
      label = [string]$Seat
      row_number = $RowNumber
      column_number = $ColumnNumber
      position = $Position
    }
  }

  return $Rows
}

function Write-SqlFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  $Content = ($Lines -join [Environment]::NewLine) + [Environment]::NewLine
  Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

function Invoke-Docker {
  param([string[]]$Arguments)

  & docker @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') fallo con codigo $LASTEXITCODE"
  }
}

function Invoke-PsqlFile {
  param(
    [string]$Database,
    [string]$FilePath,
    [string]$Container
  )

  Get-Content -LiteralPath $FilePath -Raw | docker exec -i $Container psql -U postgres -d $Database -v ON_ERROR_STOP=1 -f - | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "psql fallo aplicando $FilePath en $Database"
  }
}

function Invoke-PsqlScalar {
  param(
    [string]$Database,
    [string]$Sql,
    [string]$Container
  )

  $Value = docker exec $Container psql -U postgres -d $Database -tAc $Sql
  if ($LASTEXITCODE -ne 0) {
    throw "psql fallo consultando $Database"
  }

  return ($Value | Select-Object -First 1).Trim()
}

function Invoke-LocalValidation {
  param(
    [string]$Container,
    [string]$Image,
    [string]$IdentitySql,
    [string]$DispatchSql,
    [string]$TicketingSql
  )

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker rm -f $Container 1>$null 2>$null
  $ErrorActionPreference = $PreviousErrorActionPreference

  Invoke-Docker -Arguments @(
    "run",
    "-d",
    "--name",
    $Container,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    $Image
  )

  $Ready = $false
  for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
    docker exec $Container pg_isready -U postgres 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      $Ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }

  if (-not $Ready) {
    throw "PostgreSQL local no quedo listo en Docker."
  }

  foreach ($Database in @("identity_db", "dispatch_db", "ticketing_db")) {
    Invoke-Docker -Arguments @("exec", $Container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE $Database;")
  }

  Invoke-PsqlFile -Container $Container -Database "identity_db" -FilePath "services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql"

  Invoke-PsqlFile -Container $Container -Database "dispatch_db" -FilePath "services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql"
  Invoke-PsqlFile -Container $Container -Database "dispatch_db" -FilePath "services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql"

  Get-ChildItem -LiteralPath "services\ticketing-service\src\main\resources\db\migration" -Filter "V*.sql" |
    Sort-Object Name |
    ForEach-Object {
      Invoke-PsqlFile -Container $Container -Database "ticketing_db" -FilePath $_.FullName
    }

  Invoke-PsqlFile -Container $Container -Database "identity_db" -FilePath $IdentitySql
  Invoke-PsqlFile -Container $Container -Database "dispatch_db" -FilePath $DispatchSql
  Invoke-PsqlFile -Container $Container -Database "ticketing_db" -FilePath $TicketingSql

  $Counts = [pscustomobject]@{
    identity_users = [int](Invoke-PsqlScalar -Container $Container -Database "identity_db" -Sql "select count(*) from users where legacy_id is not null;")
    identity_profiles = [int](Invoke-PsqlScalar -Container $Container -Database "identity_db" -Sql "select count(*) from internal_profiles;")
    dispatch_terminals = [int](Invoke-PsqlScalar -Container $Container -Database "dispatch_db" -Sql "select count(*) from terminals;")
    dispatch_bus_types = [int](Invoke-PsqlScalar -Container $Container -Database "dispatch_db" -Sql "select count(*) from bus_types;")
    dispatch_buses = [int](Invoke-PsqlScalar -Container $Container -Database "dispatch_db" -Sql "select count(*) from buses;")
    dispatch_routes = [int](Invoke-PsqlScalar -Container $Container -Database "dispatch_db" -Sql "select count(*) from routes;")
    dispatch_departures = [int](Invoke-PsqlScalar -Container $Container -Database "dispatch_db" -Sql "select count(*) from departures;")
    ticketing_passengers = [int](Invoke-PsqlScalar -Container $Container -Database "ticketing_db" -Sql "select count(*) from passengers where legacy_id is not null;")
    ticketing_synced_departures = [int](Invoke-PsqlScalar -Container $Container -Database "ticketing_db" -Sql "select count(*) from synced_departures;")
    ticketing_departure_seats = [int](Invoke-PsqlScalar -Container $Container -Database "ticketing_db" -Sql "select count(*) from departure_seats;")
    ticketing_tickets = [int](Invoke-PsqlScalar -Container $Container -Database "ticketing_db" -Sql "select count(*) from tickets where legacy_id is not null;")
  }

  if (-not $KeepLocalContainer) {
    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker rm -f $Container 1>$null 2>$null
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  return $Counts
}

$ResolvedAccessPath = Resolve-FullPath -Path $AccessPath
if (-not (Test-Path -LiteralPath $ResolvedAccessPath)) {
  throw "No existe la base Access: $ResolvedAccessPath"
}

$ResolvedOutputDir = Resolve-FullPath -Path $OutputDir
$ResolvedBackupRoot = Resolve-FullPath -Path $BackupRoot
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $ResolvedBackupRoot | Out-Null

$StartedAt = Get-Date
$Timestamp = $StartedAt.ToString("yyyyMMdd-HHmmss")
$RunBackupDir = Join-Path $ResolvedBackupRoot $Timestamp
New-Item -ItemType Directory -Force -Path $RunBackupDir | Out-Null
$BackupPath = Join-Path $RunBackupDir "usuario.mdb"

$CopyTimer = [System.Diagnostics.Stopwatch]::StartNew()
Copy-Item -LiteralPath $ResolvedAccessPath -Destination $BackupPath -Force
$CopyTimer.Stop()

$AccessHash = (Get-FileHash -LiteralPath $ResolvedAccessPath -Algorithm SHA256).Hash
$BackupHash = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash

$ProviderInfo = Get-AccessProvider -ResolvedAccessPath $ResolvedAccessPath
$Connection = New-Object System.Data.OleDb.OleDbConnection($ProviderInfo.connection_string)
$Connection.Open()
try {
  $Tables = @{}
  foreach ($TableName in @("Buses", "Clientes", "Salidas", "Terminales", "Tipobus", "Usuarios")) {
    $ReadTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $Table = Read-AccessTable -Connection $Connection -TableName $TableName
    $ReadTimer.Stop()
    $Table | Add-Member -NotePropertyName read_seconds -NotePropertyValue ([Math]::Round($ReadTimer.Elapsed.TotalSeconds, 3))
    $Tables[$TableName] = $Table
  }
} finally {
  $Connection.Close()
}

$Terminals = @{}
foreach ($Terminal in $Tables["Terminales"].rows) {
  [void](Add-UniqueTerminal `
    -Terminals $Terminals `
    -Name $Terminal.Nombre `
    -LegacyId ([int]$Terminal.Id) `
    -ManagerName $Terminal.Administrador `
    -Address $Terminal.Direccion `
    -Phone $Terminal.Telefono `
    -Email $Terminal.Email `
    -LocalCode $Terminal.ID_local)
}

foreach ($Salida in $Tables["Salidas"].rows) {
  [void](Add-UniqueTerminal -Terminals $Terminals -Name $Salida.Terminal -LegacyId $null -ManagerName $null -Address $null -Phone $null -Email $null -LocalCode $null)
  [void](Add-UniqueTerminal -Terminals $Terminals -Name $Salida.Destino -LegacyId $null -ManagerName $null -Address $null -Phone $null -Email $null -LocalCode $null)
}

foreach ($Bus in $Tables["Buses"].rows) {
  [void](Add-UniqueTerminal -Terminals $Terminals -Name $Bus.Destino -LegacyId $null -ManagerName $null -Address $null -Phone $null -Email $null -LocalCode $null)
}

$IdentitySqlLines = @(
  "-- Dia 74 - carga generada desde usuario.mdb para identity_db",
  "BEGIN;"
)

foreach ($User in $Tables["Usuarios"].rows) {
  $UserId = New-DeterministicUuid -Key "user:$($User.Id_usuario)"
  $DisplayName = ("$($User.Nombres) $($User.Apellidos)").Trim()
  $IdentitySqlLines += "INSERT INTO users (id, legacy_id, identity_type, login, display_name, status, password_changed_at) VALUES ('$UserId', $($User.Id_usuario), 'LOCAL', $(Sql-Text $User.Login), $(Sql-Text $DisplayName), 'ACTIVE', $(Sql-Timestamp $User.Fecha)) ON CONFLICT (legacy_id) DO UPDATE SET login = excluded.login, display_name = excluded.display_name, status = excluded.status, updated_at = now();"
  $IdentitySqlLines += "INSERT INTO local_credentials (user_id, password_hash, temporary_password, must_change_password) VALUES ('$UserId', NULL, true, true) ON CONFLICT (user_id) DO UPDATE SET temporary_password = true, must_change_password = true, updated_at = now();"
  $IdentitySqlLines += "INSERT INTO internal_profiles (user_id, employee_code, first_name, last_name, phone, address, active) VALUES ('$UserId', $(Sql-Text $User.Login), $(Sql-Text $User.Nombres), $(Sql-Text $User.Apellidos), $(Sql-Text $User.Telefono), $(Sql-Text $User.Direccion), true) ON CONFLICT (user_id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone, address = excluded.address, updated_at = now();"
  $IdentitySqlLines += "INSERT INTO user_roles (user_id, role_id) SELECT '$UserId', id FROM roles WHERE code = 'ADMIN' ON CONFLICT DO NOTHING;"
}

$IdentitySqlLines += "COMMIT;"

$DispatchSqlLines = @(
  "-- Dia 74 - carga generada desde usuario.mdb para dispatch_db",
  "BEGIN;"
)

foreach ($Terminal in $Terminals.Values | Sort-Object name) {
  $LegacyValue = if ($null -eq $Terminal.legacy_id) { "NULL" } else { [string]$Terminal.legacy_id }
  $DispatchSqlLines += "INSERT INTO terminals (id, legacy_id, local_code, name, manager_name, address, phone, email, active) VALUES ('$($Terminal.id)', $LegacyValue, $(Sql-Text $Terminal.local_code), $(Sql-Text $Terminal.name), $(Sql-Text $Terminal.manager_name), $(Sql-Text $Terminal.address), $(Sql-Text $Terminal.phone), $(Sql-Text $Terminal.email), true) ON CONFLICT (name) DO UPDATE SET manager_name = COALESCE(excluded.manager_name, terminals.manager_name), address = COALESCE(excluded.address, terminals.address), phone = COALESCE(excluded.phone, terminals.phone), email = COALESCE(excluded.email, terminals.email), updated_at = now();"
}

foreach ($Type in $Tables["Tipobus"].rows) {
  $TypeId = New-DeterministicUuid -Key "bus-type:$($Type.Id)"
  $DispatchSqlLines += "INSERT INTO bus_types (id, legacy_id, name, active) VALUES ('$TypeId', $($Type.Id), $(Sql-Text $Type.Tipo), true) ON CONFLICT (legacy_id) DO UPDATE SET name = excluded.name, active = true, updated_at = now();"
}

$SeatCounts = @($Tables["Buses"].rows | ForEach-Object { [int]$_.Asientos } | Sort-Object -Unique)
foreach ($SeatCount in $SeatCounts) {
  $LayoutId = New-DeterministicUuid -Key "seat-layout:$SeatCount"
  $LayoutName = "Legacy Access $SeatCount asientos"
  $DispatchSqlLines += "INSERT INTO seat_layouts (id, name, seat_count, active) VALUES ('$LayoutId', $(Sql-Text $LayoutName), $SeatCount, true) ON CONFLICT (name) DO UPDATE SET seat_count = excluded.seat_count, active = true, updated_at = now();"
  foreach ($Seat in New-SeatLayoutRows -LayoutId $LayoutId -SeatCount $SeatCount) {
    $DispatchSqlLines += "INSERT INTO seat_layout_seats (id, seat_layout_id, seat_number, label, row_number, column_number, position, active) VALUES ('$($Seat.id)', '$LayoutId', $($Seat.seat_number), $(Sql-Text $Seat.label), $($Seat.row_number), $($Seat.column_number), '$($Seat.position)', true) ON CONFLICT (seat_layout_id, seat_number) DO UPDATE SET label = excluded.label, row_number = excluded.row_number, column_number = excluded.column_number, position = excluded.position, active = true;"
  }
}

foreach ($Bus in $Tables["Buses"].rows) {
  $BusId = New-DeterministicUuid -Key "bus:$($Bus.Id)"
  $BusTypeId = New-DeterministicUuid -Key "bus-type:$($Bus.Tipo)"
  $LayoutId = New-DeterministicUuid -Key "seat-layout:$($Bus.Asientos)"
  $BusTerminalLegacyId = [int]$Bus.terminal
  $TerminalByLegacy = @(
    $Terminals.Values |
      Where-Object { $null -ne $_.legacy_id -and ([int]$_.legacy_id) -eq $BusTerminalLegacyId } |
      Select-Object -First 1
  )
  if ($TerminalByLegacy.Count -eq 0) {
    throw "No se encontro terminal legacy para bus $($Bus.Id_Bus)"
  }
  $DispatchSqlLines += "INSERT INTO buses (id, legacy_id, code, plate, description, default_destination, bus_type_id, terminal_id, seat_layout_id, active) VALUES ('$BusId', $($Bus.Id), $(Sql-Text $Bus.Id_Bus), $(Sql-Text $Bus.Matricula), $(Sql-Text $Bus.Descripcion), $(Sql-Text $Bus.Destino), '$BusTypeId', '$($TerminalByLegacy[0].id)', '$LayoutId', true) ON CONFLICT (legacy_id) DO UPDATE SET code = excluded.code, plate = excluded.plate, description = excluded.description, default_destination = excluded.default_destination, bus_type_id = excluded.bus_type_id, terminal_id = excluded.terminal_id, seat_layout_id = excluded.seat_layout_id, active = true, updated_at = now();"
}

foreach ($Salida in $Tables["Salidas"].rows) {
  $Origin = $Terminals[$Salida.Terminal.Trim().ToUpperInvariant()]
  $Destination = $Terminals[$Salida.Destino.Trim().ToUpperInvariant()]
  $RouteId = New-DeterministicUuid -Key "route:$($Origin.name):$($Destination.name)"
  $RouteName = "$($Origin.name) - $($Destination.name)"
  $Bus = @($Tables["Buses"].rows | Where-Object { $_.Id_Bus -eq $Salida.Buses } | Select-Object -First 1)
  if ($Bus.Count -eq 0) {
    throw "No se encontro bus para salida legacy $($Salida.Id)"
  }
  $BusId = New-DeterministicUuid -Key "bus:$($Bus[0].Id)"
  $DepartureId = New-DeterministicUuid -Key "departure:$($Salida.Id)"
  $DispatchSqlLines += "INSERT INTO routes (id, origin_terminal_id, destination_terminal_id, name, active) VALUES ('$RouteId', '$($Origin.id)', '$($Destination.id)', $(Sql-Text $RouteName), true) ON CONFLICT (origin_terminal_id, destination_terminal_id) DO UPDATE SET name = excluded.name, active = true, updated_at = now();"
  $DispatchSqlLines += "INSERT INTO departures (id, legacy_id, bus_id, route_id, departure_at, status, notes) VALUES ('$DepartureId', $($Salida.Id), '$BusId', '$RouteId', $(Get-DepartureAtSql -Salida $Salida), 'SCHEDULED', 'Migrado desde Access usuario.mdb') ON CONFLICT (legacy_id) DO UPDATE SET bus_id = excluded.bus_id, route_id = excluded.route_id, departure_at = excluded.departure_at, status = excluded.status, updated_at = now();"
}

$DispatchSqlLines += "COMMIT;"

$TicketingSqlLines = @(
  "-- Dia 74 - carga generada desde usuario.mdb para ticketing_db",
  "BEGIN;"
)

$PassengersByDocument = @{}
foreach ($Client in $Tables["Clientes"].rows) {
  $Document = ([string]$Client.DNI).Trim()
  if (-not $PassengersByDocument.ContainsKey($Document)) {
    $PassengerId = New-DeterministicUuid -Key "passenger:$Document"
    $PassengersByDocument[$Document] = [pscustomobject]@{
      id = $PassengerId
      legacy_id = [int]$Client.Id
      document_number = $Document
      first_name = [string]$Client.Nombre
      last_name = [string]$Client.Apellido
    }
  }
}

foreach ($Passenger in $PassengersByDocument.Values | Sort-Object document_number) {
  $TicketingSqlLines += "INSERT INTO passengers (id, legacy_id, document_type, document_number, first_name, last_name, status) VALUES ('$($Passenger.id)', $($Passenger.legacy_id), 'CEDULA', $(Sql-Text $Passenger.document_number), $(Sql-Text $Passenger.first_name), $(Sql-Text $Passenger.last_name), 'ACTIVE') ON CONFLICT (document_type, document_number) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, status = 'ACTIVE', updated_at = now();"
}

foreach ($Salida in $Tables["Salidas"].rows) {
  $Origin = $Terminals[$Salida.Terminal.Trim().ToUpperInvariant()]
  $Destination = $Terminals[$Salida.Destino.Trim().ToUpperInvariant()]
  $RouteId = New-DeterministicUuid -Key "route:$($Origin.name):$($Destination.name)"
  $Bus = @($Tables["Buses"].rows | Where-Object { $_.Id_Bus -eq $Salida.Buses } | Select-Object -First 1)
  $BusId = New-DeterministicUuid -Key "bus:$($Bus[0].Id)"
  $DepartureId = New-DeterministicUuid -Key "departure:$($Salida.Id)"
  $RouteName = "$($Origin.name) - $($Destination.name)"
  $TicketingSqlLines += "INSERT INTO synced_departures (id, dispatch_departure_id, legacy_id, bus_id, bus_code, bus_plate, route_id, route_name, origin_terminal_id, origin_terminal_name, destination_terminal_id, destination_terminal_name, departure_at, status, seat_count, source_updated_at) VALUES ('$DepartureId', '$DepartureId', $($Salida.Id), '$BusId', $(Sql-Text $Salida.Buses), $(Sql-Text $Bus[0].Matricula), '$RouteId', $(Sql-Text $RouteName), '$($Origin.id)', $(Sql-Text $Origin.name), '$($Destination.id)', $(Sql-Text $Destination.name), $(Get-DepartureAtSql -Salida $Salida), 'SCHEDULED', $($Bus[0].Asientos), now()) ON CONFLICT (dispatch_departure_id) DO UPDATE SET route_name = excluded.route_name, departure_at = excluded.departure_at, status = excluded.status, seat_count = excluded.seat_count, updated_at = now();"
  for ($SeatNumber = 1; $SeatNumber -le [int]$Bus[0].Asientos; $SeatNumber++) {
    $SeatId = New-DeterministicUuid -Key "departure-seat:${DepartureId}:$SeatNumber"
    $TicketingSqlLines += "INSERT INTO departure_seats (id, dispatch_departure_id, seat_number, status) VALUES ('$SeatId', '$DepartureId', '$SeatNumber', 'AVAILABLE') ON CONFLICT (dispatch_departure_id, seat_number) DO UPDATE SET status = CASE WHEN departure_seats.status = 'SOLD' THEN departure_seats.status ELSE excluded.status END, updated_at = now();"
  }
}

foreach ($Client in $Tables["Clientes"].rows) {
  $Passenger = $PassengersByDocument[([string]$Client.DNI).Trim()]
  $Salida = @($Tables["Salidas"].rows | Where-Object { $_.Buses -eq $Client.Bus -and $_.Terminal -eq $Client.Origen -and $_.Destino -eq $Client.Destino } | Select-Object -First 1)
  if ($Salida.Count -eq 0) {
    throw "No se encontro salida para cliente legacy $($Client.Id)"
  }
  $Origin = $Terminals[$Client.Origen.Trim().ToUpperInvariant()]
  $Destination = $Terminals[$Client.Destino.Trim().ToUpperInvariant()]
  $DepartureId = New-DeterministicUuid -Key "departure:$($Salida[0].Id)"
  $SeatId = New-DeterministicUuid -Key "departure-seat:${DepartureId}:$($Client.N_asiento)"
  $TicketId = New-DeterministicUuid -Key "ticket:$($Client.Id)"
  $TicketNumber = "LEGACY-" + ([int]$Client.Id).ToString("000000")
  $TicketingSqlLines += "UPDATE departure_seats SET status = 'SOLD', passenger_id = '$($Passenger.id)', updated_at = now() WHERE id = '$SeatId';"
  $TicketingSqlLines += "INSERT INTO tickets (id, legacy_id, ticket_number, passenger_id, departure_seat_id, dispatch_departure_id, origin_terminal_id, destination_terminal_id, seat_number, fare_amount, currency, status, issued_at) VALUES ('$TicketId', $($Client.Id), $(Sql-Text $TicketNumber), '$($Passenger.id)', '$SeatId', '$DepartureId', '$($Origin.id)', '$($Destination.id)', $(Sql-Text $Client.N_asiento), $(Sql-Number $Client.Precio), 'USD', 'ISSUED', $(Get-RegistrationTimestampSql -Cliente $Client)) ON CONFLICT (legacy_id) DO UPDATE SET passenger_id = excluded.passenger_id, departure_seat_id = excluded.departure_seat_id, fare_amount = excluded.fare_amount, status = excluded.status, updated_at = now();"
}

$TicketingSqlLines += "COMMIT;"

$IdentitySqlPath = Join-Path $ResolvedOutputDir "identity_db-dia74.sql"
$DispatchSqlPath = Join-Path $ResolvedOutputDir "dispatch_db-dia74.sql"
$TicketingSqlPath = Join-Path $ResolvedOutputDir "ticketing_db-dia74.sql"

Write-SqlFile -Path $IdentitySqlPath -Lines $IdentitySqlLines
Write-SqlFile -Path $DispatchSqlPath -Lines $DispatchSqlLines
Write-SqlFile -Path $TicketingSqlPath -Lines $TicketingSqlLines

$ExpectedCounts = [pscustomobject]@{
  access_tables = [pscustomobject]@{
    Buses = $Tables["Buses"].count
    Clientes = $Tables["Clientes"].count
    Salidas = $Tables["Salidas"].count
    Terminales = $Tables["Terminales"].count
    Tipobus = $Tables["Tipobus"].count
    Usuarios = $Tables["Usuarios"].count
  }
  target_expected = [pscustomobject]@{
    identity_users = $Tables["Usuarios"].count
    dispatch_terminals = @($Terminals.Values).Count
    dispatch_bus_types = $Tables["Tipobus"].count
    dispatch_buses = $Tables["Buses"].count
    dispatch_routes = @($Tables["Salidas"].rows | ForEach-Object { "$($_.Terminal)|$($_.Destino)" } | Sort-Object -Unique).Count
    dispatch_departures = $Tables["Salidas"].count
    ticketing_passengers = @($Tables["Clientes"].rows | ForEach-Object { $_.DNI } | Sort-Object -Unique).Count
    ticketing_synced_departures = $Tables["Salidas"].count
    ticketing_departure_seats = @($Tables["Buses"].rows | Measure-Object -Property Asientos -Sum).Sum
    ticketing_tickets = $Tables["Clientes"].count
  }
}

$LocalValidation = $null
$LocalTimer = [System.Diagnostics.Stopwatch]::StartNew()
if ($ValidateLocal) {
  $LocalValidation = Invoke-LocalValidation `
    -Container $ContainerName `
    -Image $PostgresImage `
    -IdentitySql $IdentitySqlPath `
    -DispatchSql $DispatchSqlPath `
    -TicketingSql $TicketingSqlPath
}
$LocalTimer.Stop()

$FinishedAt = Get-Date
$TotalSeconds = [Math]::Round(($FinishedAt - $StartedAt).TotalSeconds, 3)

$Blockers = @()
if (-not $ValidateLocal) {
  $Blockers += "La validacion local no se ejecuto. Repetir con -ValidateLocal antes de aplicar en staging."
}
if ($AccessHash -ne $BackupHash) {
  $Blockers += "La copia reciente de Access no coincide con el hash de origen."
}

$RtoFromDay68Minutes = 17.45
$EstimatedCutoverMinutes = [Math]::Round(($TotalSeconds / 60) + $RtoFromDay68Minutes, 2)

$Result = [pscustomobject]@{
  generated_at = $FinishedAt.ToString("o")
  day = 74
  title = "Ensayo de migracion final"
  access = [pscustomobject]@{
    source_path = $ResolvedAccessPath
    backup_path = $BackupPath
    provider = $ProviderInfo.provider
    source_sha256 = $AccessHash
    backup_sha256 = $BackupHash
    copy_seconds = [Math]::Round($CopyTimer.Elapsed.TotalSeconds, 3)
    tables = @(
      foreach ($Name in @("Buses", "Clientes", "Salidas", "Terminales", "Tipobus", "Usuarios")) {
        [pscustomobject]@{
          name = $Name
          count = $Tables[$Name].count
          columns = $Tables[$Name].columns
          read_seconds = $Tables[$Name].read_seconds
        }
      }
    )
  }
  generated_sql = [pscustomobject]@{
    identity_db = $IdentitySqlPath
    dispatch_db = $DispatchSqlPath
    ticketing_db = $TicketingSqlPath
  }
  counts = $ExpectedCounts
  local_validation = [pscustomobject]@{
    executed = [bool]$ValidateLocal
    seconds = if ($ValidateLocal) { [Math]::Round($LocalTimer.Elapsed.TotalSeconds, 3) } else { $null }
    target_counts = $LocalValidation
  }
  estimated_cutover = [pscustomobject]@{
    rehearsal_total_seconds = $TotalSeconds
    day68_restore_rto_minutes = $RtoFromDay68Minutes
    estimated_cutover_minutes = $EstimatedCutoverMinutes
    note = "Estimacion inicial: tiempo del ensayo Dia 74 mas RTO medido en Dia 68."
  }
  blockers = $Blockers
  ready_for_staging_execution = ($Blockers.Count -eq 0)
}

$ResultPath = Join-Path $ResolvedOutputDir "final-migration-rehearsal.json"
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

Write-Host "Ensayo de migracion Dia 74 generado."
Write-Host "Copia Access: $BackupPath"
Write-Host "Evidencia JSON: $ResultPath"
Write-Host "SQL identity: $IdentitySqlPath"
Write-Host "SQL dispatch: $DispatchSqlPath"
Write-Host "SQL ticketing: $TicketingSqlPath"
Write-Host "Tiempo total medido: $TotalSeconds segundos"
Write-Host "Corte estimado inicial: $EstimatedCutoverMinutes minutos"

if ($LocalValidation) {
  $LocalValidation | Format-List
}

if ($Blockers.Count -gt 0) {
  Write-Host "Bloqueos:"
  foreach ($Blocker in $Blockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocked -and $Blockers.Count -gt 0) {
  exit 2
}
