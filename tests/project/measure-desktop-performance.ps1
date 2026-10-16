[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputCsv,
  [ValidateRange(100, 10000)]
  [int]$SampleIntervalMs = 1000,
  [ValidateRange(10, 3600)]
  [int]$DurationSeconds = 240,
  [ValidateRange(5, 180)]
  [int]$StartTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$resolvedExe = (Resolve-Path -LiteralPath $ExecutablePath).Path
$exeName = [System.IO.Path]::GetFileName($resolvedExe)
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputCsv)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function Get-ProcessSnapshot {
  @(Get-CimInstance -ClassName Win32_Process -Property ProcessId, ParentProcessId, CreationDate, Name)
}

function Convert-CimCreationDate($Value) {
  if ($Value -is [datetime]) { return $Value.ToUniversalTime() }
  try { return [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$Value).ToUniversalTime() }
  catch { return [datetime]::MinValue }
}

$root = $null
$deadline = [datetime]::UtcNow.AddSeconds($StartTimeoutSeconds)
while ([datetime]::UtcNow -lt $deadline -and $null -eq $root) {
  $root = Get-CimInstance -ClassName Win32_Process -Filter "Name='$exeName'" -Property ProcessId, ParentProcessId, CreationDate, ExecutablePath |
    Where-Object { $_.ExecutablePath -and [string]::Equals([System.IO.Path]::GetFullPath($_.ExecutablePath), $resolvedExe, [System.StringComparison]::OrdinalIgnoreCase) } |
    Select-Object -First 1
  if ($null -eq $root) { Start-Sleep -Milliseconds 250 }
}
if ($null -eq $root) { throw "Não encontrei a instância indicada dentro de $StartTimeoutSeconds s." }

$rootPid = [int]$root.ProcessId
$rootCreated = Convert-CimCreationDate $root.CreationDate
$runStart = [datetime]::UtcNow
$tracked = @{}
$tracked[$rootPid] = $rootCreated
$rows = [System.Collections.Generic.List[object]]::new()
$previousCpu = $null
$previousSample = $null
$sampleNumber = 0
$emptyTreeSamples = 0
$captureUntil = $runStart.AddSeconds($DurationSeconds)

Write-Host "Capturando PID $rootPid por até $DurationSeconds s; saída: $resolvedOutput"

while ([datetime]::UtcNow -lt $captureUntil) {
  $sampleAt = [datetime]::UtcNow
  $snapshot = Get-ProcessSnapshot
  $byPid = @{}
  foreach ($item in $snapshot) { $byPid[[int]$item.ProcessId] = $item }

  $pendingParents = [System.Collections.Generic.Queue[int]]::new()
  foreach ($trackedPid in $tracked.Keys) { $pendingParents.Enqueue([int]$trackedPid) }
  while ($pendingParents.Count -gt 0) {
    $parentPid = $pendingParents.Dequeue()
    foreach ($child in $snapshot | Where-Object { [int]$_.ParentProcessId -eq $parentPid }) {
      $childPid = [int]$child.ProcessId
      $childCreated = Convert-CimCreationDate $child.CreationDate
      if ($childCreated -ge $rootCreated -and -not $tracked.ContainsKey($childPid)) {
        $tracked[$childPid] = $childCreated
        $pendingParents.Enqueue($childPid)
      }
    }
  }

  $active = @()
  foreach ($trackedPid in @($tracked.Keys)) {
    if ($byPid.ContainsKey([int]$trackedPid) -and (Convert-CimCreationDate $byPid[[int]$trackedPid].CreationDate) -eq $tracked[[int]$trackedPid]) {
      $active += [int]$trackedPid
    }
  }
  $processes = @()
  foreach ($activePid in $active) {
    try { $processes += Get-Process -Id $activePid -ErrorAction Stop } catch { }
  }

  $cpuSeconds = 0.0
  $workingSet = [long]0
  $privateBytes = [long]0
  foreach ($process in $processes) {
    $cpuSeconds += $process.TotalProcessorTime.TotalSeconds
    $workingSet += [long]$process.WorkingSet64
    $privateBytes += [long]$process.PrivateMemorySize64
  }

  $processIoRead = $null
  $processIoWrite = $null
  try {
    $perfRows = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop
    $activeSet = @{}; foreach ($activePid in $active) { $activeSet[$activePid] = $true }
    $matchingPerf = @($perfRows | Where-Object { $activeSet.ContainsKey([int]$_.IDProcess) })
    if ($matchingPerf.Count -gt 0) {
      $processIoRead = [double](($matchingPerf | Measure-Object -Property IOReadBytesPersec -Sum).Sum)
      $processIoWrite = [double](($matchingPerf | Measure-Object -Property IOWriteBytesPersec -Sum).Sum)
    }
  } catch { }

  $diskRead = $null
  $diskWrite = $null
  try {
    $physicalDisk = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'" -ErrorAction Stop | Select-Object -First 1
    if ($null -ne $physicalDisk) {
      $diskRead = [double]$physicalDisk.DiskReadBytesPersec
      $diskWrite = [double]$physicalDisk.DiskWriteBytesPersec
    }
  } catch { }

  $systemCpu = $null
  try {
    $systemCpuRow = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction Stop | Select-Object -First 1
    if ($null -ne $systemCpuRow) { $systemCpu = [double]$systemCpuRow.PercentProcessorTime }
  } catch { }

  $elapsed = if ($null -ne $previousSample) { ($sampleAt - $previousSample).TotalSeconds } else { $null }
  $cpuPercentMachine = if ($null -ne $previousCpu -and $elapsed -gt 0) {
    [math]::Max(0, (($cpuSeconds - $previousCpu) / $elapsed / [Environment]::ProcessorCount) * 100)
  } else { $null }
  $state = if ($active -contains $rootPid) { 'running' } else { 'root-exited' }
  if ($active.Count -eq 0) { $emptyTreeSamples++ } else { $emptyTreeSamples = 0 }

  $rows.Add([pscustomobject]@{
    TimestampUtc = $sampleAt.ToString('o')
    ElapsedSeconds = [math]::Round(($sampleAt - $runStart).TotalSeconds, 2)
    State = $state
    RootPid = $rootPid
    ProcessCount = $active.Count
    ProcessIds = ($active -join ';')
    ProcessNames = (($processes | Select-Object -ExpandProperty ProcessName -Unique) -join ';')
    WorkingSetMiB = [math]::Round($workingSet / 1MB, 1)
    PrivateBytesMiB = [math]::Round($privateBytes / 1MB, 1)
    CpuPercentMachine = if ($null -ne $cpuPercentMachine) { [math]::Round($cpuPercentMachine, 2) } else { $null }
    ProcessIoReadMiBPerSec = if ($null -ne $processIoRead) { [math]::Round($processIoRead / 1MB, 3) } else { $null }
    ProcessIoWriteMiBPerSec = if ($null -ne $processIoWrite) { [math]::Round($processIoWrite / 1MB, 3) } else { $null }
    PhysicalDiskReadMiBPerSecTotal = if ($null -ne $diskRead) { [math]::Round($diskRead / 1MB, 3) } else { $null }
    PhysicalDiskWriteMiBPerSecTotal = if ($null -ne $diskWrite) { [math]::Round($diskWrite / 1MB, 3) } else { $null }
    SystemCpuPercent = if ($null -ne $systemCpu) { [math]::Round($systemCpu, 2) } else { $null }
  })

  $previousCpu = $cpuSeconds
  $previousSample = $sampleAt
  $sampleNumber++
  if ($emptyTreeSamples -ge 3) { break }
  Start-Sleep -Milliseconds $SampleIntervalMs
}

$rows | Export-Csv -LiteralPath $resolvedOutput -NoTypeInformation -Encoding utf8
Write-Host "Amostras: $sampleNumber; árvore no último registro: $($rows[-1].ProcessCount); estado: $($rows[-1].State)."
