$ErrorActionPreference = "Stop"

$configuredJavaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME")
$javaCandidates = @(
    @(
        $configuredJavaHome,
        [Environment]::GetEnvironmentVariable("ANDROID_STUDIO_JBR"),
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio\jre"
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) }
)

if ($javaCandidates.Count -eq 0) {
    throw "No se encontro un JDK compatible. Instala Android Studio o define ANDROID_STUDIO_JBR."
}

$javaHomeForAndroid = $javaCandidates[0]
$env:JAVA_HOME = $javaHomeForAndroid
$env:Path = (Join-Path $javaHomeForAndroid "bin") + ";" + $env:Path

$androidDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\android")).Path
Push-Location $androidDirectory

try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle termino con el codigo $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
