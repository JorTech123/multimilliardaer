<#
    Multimilliardær — bitte liten testserver

    Spillet trenger ingen server i drift (GitHub Pages holder), men
    nettlesere nekter en del ting på file://. Denne serveren gjør at du
    kan prøve spillet lokalt uten å installere Node eller Python.

    Bruk:
        powershell -ExecutionPolicy Bypass -File verktoy\server.ps1
        powershell -ExecutionPolicy Bypass -File verktoy\server.ps1 -Port 8080

    Åpne deretter http://localhost:8777 i nettleseren.
    Avslutt med Ctrl+C.

    Bruker TcpListener og ikke HttpListener, fordi HttpListener krever
    administratorrettigheter eller en netsh-regel for å reservere URL-en.
#>

param(
    [int]$Port = 8777,
    [string]$Rot = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
)

$ErrorActionPreference = 'Stop'

$MimeTyper = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/markdown; charset=utf-8'
    '.gs'   = 'text/plain; charset=utf-8'
}

$Rot = (Resolve-Path $Rot).Path
Write-Host ''
Write-Host '  Multimilliardaer - testserver' -ForegroundColor Yellow
Write-Host "  Mappe:  $Rot" -ForegroundColor DarkGray
Write-Host "  Adresse: http://localhost:$Port" -ForegroundColor Green
Write-Host '  Avslutt med Ctrl+C' -ForegroundColor DarkGray
Write-Host ''

$lytter = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $lytter.Start()
} catch {
    Write-Host "  Kunne ikke apne port $Port. Er den i bruk? Prov -Port 8080." -ForegroundColor Red
    exit 1
}

function Send-Svar {
    param($Strom, [int]$Kode, [string]$Status, [string]$Type, [byte[]]$Kropp)
    $hode = "HTTP/1.1 $Kode $Status`r`n" +
            "Content-Type: $Type`r`n" +
            "Content-Length: $($Kropp.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
    $hodeBytes = [System.Text.Encoding]::ASCII.GetBytes($hode)
    $Strom.Write($hodeBytes, 0, $hodeBytes.Length)
    if ($Kropp.Length -gt 0) { $Strom.Write($Kropp, 0, $Kropp.Length) }
    $Strom.Flush()
}

try {
    while ($true) {
        $klient = $lytter.AcceptTcpClient()
        try {
            $strom = $klient.GetStream()
            $strom.ReadTimeout = 5000

            # Les forespørselslinja
            $buffer = New-Object byte[] 8192
            $lest = $strom.Read($buffer, 0, $buffer.Length)
            if ($lest -le 0) { continue }
            $tekst = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $lest)
            $forsteLinje = ($tekst -split "`r`n")[0]
            $deler = $forsteLinje -split ' '
            if ($deler.Count -lt 2) { continue }

            $sti = $deler[1]
            $sti = ($sti -split '\?')[0]
            $sti = [System.Uri]::UnescapeDataString($sti)
            if ($sti -eq '/' ) { $sti = '/index.html' }

            # Hindre at noen rømmer ut av prosjektmappa
            $relativ = $sti.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $full = [System.IO.Path]::GetFullPath((Join-Path $Rot $relativ))

            if (-not $full.StartsWith($Rot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $k = [System.Text.Encoding]::UTF8.GetBytes('403 Forbudt')
                Send-Svar $strom 403 'Forbidden' 'text/plain; charset=utf-8' $k
                Write-Host "  403  $sti" -ForegroundColor Red
                continue
            }

            if (Test-Path -LiteralPath $full -PathType Leaf) {
                $utvidelse = [System.IO.Path]::GetExtension($full).ToLower()
                $type = $MimeTyper[$utvidelse]
                if (-not $type) { $type = 'application/octet-stream' }
                $kropp = [System.IO.File]::ReadAllBytes($full)
                Send-Svar $strom 200 'OK' $type $kropp
                Write-Host "  200  $sti" -ForegroundColor DarkGray
            } else {
                $k = [System.Text.Encoding]::UTF8.GetBytes("404 - fant ikke $sti")
                Send-Svar $strom 404 'Not Found' 'text/plain; charset=utf-8' $k
                Write-Host "  404  $sti" -ForegroundColor Yellow
            }
        } catch {
            # En nettleser som lukker tilkoblinga er helt normalt
        } finally {
            $klient.Close()
        }
    }
} finally {
    $lytter.Stop()
    Write-Host ''
    Write-Host '  Serveren er stoppet.' -ForegroundColor Yellow
}
