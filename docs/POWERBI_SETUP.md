# Power BI Setup Guide (Parallels / Windows VM)

This guide connects Power BI Desktop running in a Windows VM (via Parallels) to the live SQLite database on macOS, so the dashboard updates when you inject anomalies from the Next.js control panel.

## Prerequisites

- macOS with Parallels Desktop and a Windows 10/11 VM
- The Production Risk Radar project cloned and database seeded (`pnpm db:reset`)
- Next.js dev server running (`pnpm dev`)

## Step 1: Install Power BI Desktop

Open the **Microsoft Store** on the Windows VM, search for **"Power BI Desktop"**, and install it.

Alternatively, download from https://powerbi.microsoft.com/desktop/ using Edge in the VM.

## Step 2: Install SQLite ODBC Driver

Open **PowerShell** (Run as Administrator) in the Windows VM:

```powershell
Invoke-WebRequest -Uri "http://www.ch-werner.de/sqliteodbc/sqliteodbc_w64.exe" -OutFile "$env:TEMP\sqliteodbc_w64.exe"
Start-Process "$env:TEMP\sqliteodbc_w64.exe" -Wait
```

Click through the installer with default settings.

## Step 3: Verify the Shared Folder Path

Parallels shares your Mac home folder by default. Verify access from PowerShell:

```powershell
Test-Path "\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db"
```

This should return `True`. If not, check:

- Parallels Settings > Options > Sharing > Share Mac is enabled
- Try `dir "\\Mac\Home\Desktop"` to see what's visible
- The path is case-sensitive on the Mac side

> **Note the full path for later:**
> `\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db`

## Step 4: Create the ODBC Data Source

Run in PowerShell (as Administrator):

```powershell
# Create the DSN registry entry
$dsnPath = "HKLM:\SOFTWARE\ODBC\ODBC.INI\ProductionRiskRadar"
New-Item -Path $dsnPath -Force
Set-ItemProperty -Path $dsnPath -Name "Driver" -Value "C:\Windows\System32\sqliteodbc.dll"
Set-ItemProperty -Path $dsnPath -Name "Database" -Value "\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db"
Set-ItemProperty -Path $dsnPath -Name "Description" -Value "Production Risk Radar SQLite"

# Register in the ODBC data sources list
$dsnListPath = "HKLM:\SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources"
if (!(Test-Path $dsnListPath)) { New-Item -Path $dsnListPath -Force }
Set-ItemProperty -Path $dsnListPath -Name "ProductionRiskRadar" -Value "SQLite3 ODBC Driver"
```

## Step 5: Test the Connection

```powershell
$conn = New-Object System.Data.Odbc.OdbcConnection
$conn.ConnectionString = "DSN=ProductionRiskRadar"
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM machines"
$result = $cmd.ExecuteScalar()
Write-Host "Machines found: $result"
$conn.Close()
```

Expected output: `Machines found: 15`

## Step 6: Connect Power BI to the Database

1. Open **Power BI Desktop**
2. Click **Get Data** on the Home ribbon
3. Search for **ODBC** and select it
4. In the dropdown, select **ProductionRiskRadar**
5. Click **OK** (leave credentials as default/anonymous)
6. In the Navigator, check these tables:
   - `factory`
   - `lines`
   - `machines`
   - `telemetry`
7. Click **Load**

## Step 7: Build the Dashboard Visuals

### Top KPI Strip

| Visual | Type | Configuration |
|--------|------|---------------|
| Factory Risk | **Gauge** | Value: `factory[overall_risk_score]` * 100. Min: 0, Max: 100. Color: red above 40. |
| High Risk Count | **Card** | Create a DAX measure: `High Risk = COUNTROWS(FILTER(machines, machines[risk_score] > 0.7))` |
| Predicted Failures | **Card** | DAX measure: `Failures 7d = COUNTROWS(FILTER(machines, DATEVALUE(machines[predicted_failure_date]) <= TODAY() + 7))` |
| Throughput | **Card** | Value: `SUM(lines[throughput_forecast])`. Format as whole number with "units/day" suffix. |

### Main Visuals

| Visual | Type | Configuration |
|--------|------|---------------|
| **Risk Heatmap** | **Matrix** | Rows: `machines[machine_id]`, Columns: `machines[line]`, Values: `machines[risk_score]`. Apply conditional formatting on the value: green (0) to yellow (0.5) to red (1.0). |
| **Throughput Bar** | **Clustered Bar Chart** | Axis: `lines[line_id]`. Values: `lines[throughput_forecast]` and `lines[line_capacity]`. Format capacity bar as outline/target. |
| **High-Risk Table** | **Table** | Columns: `machine_id`, `line`, `temperature_c`, `vibration_mm_s`, `risk_score`, `predicted_failure_date`, `status`. Apply visual-level filter: `risk_score > 0.7`. |
| **Trend Line** (optional) | **Line Chart** | Axis: `telemetry[timestamp]`, Values: Average of `telemetry[risk_score]`. May need to set timestamp as Date/Time type. |

### Conditional Formatting for Heatmap

1. Click on the Matrix visual
2. Go to **Format** > **Cell elements** > **Background color**
3. Click **fx** (conditional formatting)
4. Set: Format by **Rules** or **Gradient**
   - Minimum: 0 = Green (#22c55e)
   - Center: 0.5 = Yellow (#eab308)
   - Maximum: 1.0 = Red (#ef4444)

## Step 8: Demo Refresh Flow

1. On macOS: open `/control` and click **"Overheat L1-M2"**
2. Switch to Windows/Parallels
3. In Power BI, press **Ctrl+F5** (or Home > Refresh)
4. Dashboard updates in 2-3 seconds
5. The heatmap cell for L1-M2 turns red, factory gauge rises, throughput drops

Repeat with other presets or custom injections. Use **"Reset to Baseline"** to return to the healthy state.

## Troubleshooting

### "File is locked" or "database is locked" error

SQLite WAL mode should allow concurrent reads, but if the shared folder causes issues:

1. Create a local copy script on Windows:
```powershell
# Save as C:\Scripts\copy-db.ps1
Copy-Item "\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db" "C:\PBI\factory.db" -Force
Copy-Item "\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db-wal" "C:\PBI\factory.db-wal" -Force -ErrorAction SilentlyContinue
Copy-Item "\\Mac\Home\Desktop\Projects.nosync\production risk radar\data\factory.db-shm" "C:\PBI\factory.db-shm" -Force -ErrorAction SilentlyContinue
```

2. Update the ODBC DSN to point to the local copy:
```powershell
Set-ItemProperty -Path "HKLM:\SOFTWARE\ODBC\ODBC.INI\ProductionRiskRadar" -Name "Database" -Value "C:\PBI\factory.db"
```

3. Run the copy script before each Power BI refresh.

### ODBC driver not found

Verify the driver is installed:
```powershell
Get-OdbcDriver | Where-Object Name -like "*SQLite*"
```

If nothing is returned, re-run the installer from Step 2.

### Shared folder not visible

In Parallels: **VM menu** > **Configure** > **Options** > **Sharing** > ensure "Share Mac" is checked and set to "All Disks" or "Home Folder Only".

### Power BI shows stale data

Power BI caches data. Always use **Ctrl+F5** (full refresh) rather than just navigating between pages. If data still appears stale, close and reopen the `.pbix` file.
