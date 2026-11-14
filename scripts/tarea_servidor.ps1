<#
.SYNOPSIS
  Registra (o quita) la tarea de Windows que mantiene arriba el servidor de la aplicación.

.DESCRIPTION
  Crea la tarea «Loteria-Servidor» en el Programador de tareas, solo para el usuario actual (no pide administrador):
    - arranca `python servir.py` (waitress, solo 127.0.0.1) al iniciar sesión;
    - si el proceso falla, Windows lo reinicia cada minuto, sin límite de intentos;
    - guarda la salida en logs\servidor.log.
  Ejecútalo desde el checkout principal (donde están .venv y .env): la tarea apunta a la carpeta que contiene este script.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\tarea_servidor.ps1            # registra e inicia
  powershell -ExecutionPolicy Bypass -File scripts\tarea_servidor.ps1 -Quitar    # detiene y elimina
#>
param([switch]$Quitar)

$ErrorActionPreference = 'Stop'
$Nombre = 'Loteria-Servidor'
$Raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Python = Join-Path $Raiz '.venv\Scripts\python.exe'
$Logs = Join-Path $Raiz 'logs'

if ($Quitar) {
    if (Get-ScheduledTask -TaskName $Nombre -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $Nombre -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $Nombre -Confirm:$false
        Write-Host "Tarea '$Nombre' eliminada. Si el servidor sigue en marcha, ciérralo (python servir.py): la tarea ya no lo vigila."
    } else {
        Write-Host "La tarea '$Nombre' no existe."
    }
    return
}

if (-not (Test-Path $Python)) { throw "No encuentro $Python. Crea el entorno virtual (ver CLAUDE.md) antes de registrar la tarea." }
if (-not (Test-Path (Join-Path $Raiz '.env'))) { throw "No encuentro $Raiz\.env. Ejecuta este script desde el checkout principal, no desde un worktree." }
New-Item -ItemType Directory -Force $Logs | Out-Null

$Accion = New-ScheduledTaskAction -Execute 'cmd.exe' -WorkingDirectory $Raiz `
    -Argument ('/c ""{0}" servir.py >> "{1}" 2>&1"' -f $Python, (Join-Path $Logs 'servidor.log'))
$Disparador = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$Ajustes = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName $Nombre -Action $Accion -Trigger $Disparador -Settings $Ajustes -Principal $Principal -Force | Out-Null
Start-ScheduledTask -TaskName $Nombre
Write-Host "Tarea '$Nombre' registrada e iniciada. Servidor en http://127.0.0.1:5000 (solo este equipo). Log: $Logs\servidor.log"
