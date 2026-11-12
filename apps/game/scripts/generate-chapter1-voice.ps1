<#
.SYNOPSIS
  Chapter 1 voice worker (Windows only). Local text-to-speech, no network.

.DESCRIPTION
  Reads a JSON array of VoiceJob objects (see apps/game/src/game/voice/buildVoiceJobs.ts).
  For each job it:
    1. creates a Windows.Media.SpeechSynthesis.SpeechSynthesizer and selects the voice by display name,
    2. sets Options.SpeakingRate and Options.AudioPitch,
    3. writes a 16 kHz mono WAV (default folder: apps/game/.voice-cache/),
    4. normalizes the peak to -3 dBFS in a small compiled C# helper and measures duration and RMS,
    5. encodes an MP3 with MediaTranscoder (mono, 16000 Hz, 48000 bps; retry at 32000 bps if refused).
  It prints a JSON array of VoiceJobResult objects on stdout (and writes it to -ResultFile when given).
  Progress messages go to stderr so stdout stays valid JSON.

  Relative outWav/outMp3 paths are resolved against apps/game (the parent of this script folder).
  Absolute paths are used as they are.

  Before any file is changed, the script exits with a clear message if the platform, PowerShell host
  or speech API is missing. If a voice is not installed, only the jobs that use it get an error result.

.PARAMETER JobFile
  Path to the jobs JSON file.

.PARAMETER ResultFile
  Optional path to also write the results JSON (UTF-8, no BOM).

.PARAMETER ListVoices
  Print the installed voices as JSON and exit. Writes no file.
#>
[CmdletBinding()]
param(
  [string]$JobFile,
  [string]$ResultFile,
  [switch]$ListVoices
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
  [Console]::Error.WriteLine("[voice] $Message")
}

function Exit-Early([string]$Message) {
  [Console]::Error.WriteLine("[voice] ERROR: $Message")
  exit 2
}

# ---------------------------------------------------------------------------------------------
# Pre-flight checks. Nothing is created or changed until all of them pass.
# ---------------------------------------------------------------------------------------------
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  Exit-Early 'This script needs Windows (Windows.Media.SpeechSynthesis). Platform is not Windows.'
}
if ($PSVersionTable.PSEdition -eq 'Core') {
  Exit-Early 'Run this script with Windows PowerShell 5.1 (powershell.exe). PowerShell 7 cannot load the Windows Runtime types.'
}
if (-not $ListVoices) {
  if ([string]::IsNullOrWhiteSpace($JobFile)) { Exit-Early 'Missing -JobFile <path to jobs JSON>.' }
  if (-not (Test-Path -LiteralPath $JobFile -PathType Leaf)) { Exit-Early "Job file not found: $JobFile" }
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
  $null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media.Transcoding, ContentType = WindowsRuntime]
  $null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media.MediaProperties, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Storage.CreationCollisionOption, Windows.Storage, ContentType = WindowsRuntime]
} catch {
  Exit-Early "The Windows speech API is not available on this machine: $($_.Exception.Message)"
}

$allVoices = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices)

if ($ListVoices) {
  $list = @($allVoices | ForEach-Object { [ordered]@{ name = $_.DisplayName; language = $_.Language } })
  ConvertTo-Json -InputObject $list -Compress
  exit 0
}

if ($allVoices.Count -eq 0) {
  Exit-Early 'No speech voices are installed (SpeechSynthesizer.AllVoices is empty).'
}

# Read the job file (UTF-8, Vietnamese text must survive).
try {
  $raw = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $JobFile).Path, [System.Text.Encoding]::UTF8)
  $parsed = ConvertFrom-Json -InputObject $raw
} catch {
  Exit-Early "Job file is not valid JSON: $($_.Exception.Message)"
}
$jobs = @($parsed)

$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

# ---------------------------------------------------------------------------------------------
# C# helper: peak normalization to -3 dBFS, duration and RMS. Pure computation on bytes.
# ---------------------------------------------------------------------------------------------
if (-not ('Chapter1VoiceWav' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.IO;

public static class Chapter1VoiceWav
{
    // Input: WAV bytes (16-bit PCM, mono). Output: canonical 44-byte-header WAV, peak at targetPeakDbfs.
    // info[0] = duration in ms, info[1] = RMS dBFS, info[2] = peak dBFS (all after normalization),
    // info[3] = sample rate.
    public static byte[] Normalize(byte[] input, double targetPeakDbfs, double[] info)
    {
        if (input == null || input.Length < 44) throw new InvalidDataException("WAV data is too short.");
        if (input[0] != 'R' || input[1] != 'I' || input[2] != 'F' || input[3] != 'F')
            throw new InvalidDataException("Not a RIFF file.");

        int pos = 12;
        int channels = 0, rate = 0, bits = 0, format = 0;
        int dataStart = -1, dataLen = 0;
        while (pos + 8 <= input.Length)
        {
            string id = "" + (char)input[pos] + (char)input[pos + 1] + (char)input[pos + 2] + (char)input[pos + 3];
            long size = BitConverter.ToUInt32(input, pos + 4);
            int body = pos + 8;
            if (id == "fmt ")
            {
                format = BitConverter.ToUInt16(input, body);
                channels = BitConverter.ToUInt16(input, body + 2);
                rate = BitConverter.ToInt32(input, body + 4);
                bits = BitConverter.ToUInt16(input, body + 14);
            }
            else if (id == "data")
            {
                dataStart = body;
                long avail = input.Length - body;
                dataLen = (int)Math.Min(size, avail);
                break;
            }
            pos = body + (int)Math.Min(size + (size & 1), int.MaxValue - body);
        }
        if (dataStart < 0) throw new InvalidDataException("WAV has no data chunk.");
        if (format != 1 || bits != 16) throw new InvalidDataException("WAV is not 16-bit PCM (format " + format + ", bits " + bits + ").");
        if (channels != 1) throw new InvalidDataException("WAV is not mono (channels " + channels + ").");
        if (rate != 16000) throw new InvalidDataException("WAV sample rate is " + rate + " Hz, expected 16000.");

        int count = dataLen / 2;
        if (count == 0) throw new InvalidDataException("WAV has no samples.");
        short[] samples = new short[count];
        int peak = 0;
        for (int i = 0; i < count; i++)
        {
            short s = BitConverter.ToInt16(input, dataStart + i * 2);
            samples[i] = s;
            int a = s == short.MinValue ? 32768 : Math.Abs((int)s);
            if (a > peak) peak = a;
        }
        if (peak == 0) throw new InvalidDataException("Synthesized audio is silent.");

        double target = 32768.0 * Math.Pow(10.0, targetPeakDbfs / 20.0);
        double gain = target / peak;
        double sumSq = 0;
        int newPeak = 0;
        for (int i = 0; i < count; i++)
        {
            double v = Math.Round(samples[i] * gain);
            if (v > 32767) v = 32767;
            if (v < -32768) v = -32768;
            samples[i] = (short)v;
            sumSq += v * v;
            int a = Math.Abs((int)v);
            if (a > newPeak) newPeak = a;
        }
        double rms = Math.Sqrt(sumSq / count);

        byte[] output = new byte[44 + count * 2];
        using (MemoryStream ms = new MemoryStream(output))
        using (BinaryWriter w = new BinaryWriter(ms))
        {
            w.Write(new char[] { 'R', 'I', 'F', 'F' });
            w.Write(36 + count * 2);
            w.Write(new char[] { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' });
            w.Write(16);
            w.Write((short)1);
            w.Write((short)1);
            w.Write(rate);
            w.Write(rate * 2);
            w.Write((short)2);
            w.Write((short)16);
            w.Write(new char[] { 'd', 'a', 't', 'a' });
            w.Write(count * 2);
            for (int i = 0; i < count; i++) w.Write(samples[i]);
        }

        info[0] = Math.Round(count * 1000.0 / rate);
        info[1] = rms > 0 ? Math.Round(20.0 * Math.Log10(rms / 32768.0) * 100.0) / 100.0 : -120.0;
        info[2] = Math.Round(20.0 * Math.Log10(newPeak / 32768.0) * 100.0) / 100.0;
        info[3] = rate;
        return output;
    }
}
'@
}

# ---------------------------------------------------------------------------------------------
# Windows Runtime await helpers (Windows PowerShell 5.1).
# ---------------------------------------------------------------------------------------------
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
$asTaskProgress = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1'
  } | Select-Object -First 1

function Wait-Operation($Operation, [Type]$ResultType) {
  $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $null = $task.Wait(-1)
  return $task.Result
}

function Wait-ActionWithProgress($Action) {
  $task = $asTaskProgress.MakeGenericMethod([double]).Invoke($null, @($Action))
  $null = $task.Wait(-1)
}

function Resolve-JobPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) { return [System.IO.Path]::GetFullPath($Path) }
  return [System.IO.Path]::GetFullPath((Join-Path $appRoot $Path))
}

function Find-Voice([string]$Name) {
  $exact = $allVoices | Where-Object { $_.DisplayName -eq $Name } | Select-Object -First 1
  if ($exact) { return $exact }
  # Installed display names can carry a suffix such as "Microsoft David - English (United States)".
  return $allVoices | Where-Object { $_.DisplayName -like "$Name *" } | Select-Object -First 1
}

function Clamp([double]$Value, [double]$Min, [double]$Max) {
  return [Math]::Min($Max, [Math]::Max($Min, $Value))
}

function Convert-ToMp3([string]$WavPath, [string]$Mp3Path, [int]$Bitrate) {
  $src = Wait-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($WavPath)) ([Windows.Storage.StorageFile])
  $dir = [System.IO.Path]::GetDirectoryName($Mp3Path)
  $name = [System.IO.Path]::GetFileName($Mp3Path)
  $folder = Wait-Operation ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($dir)) ([Windows.Storage.StorageFolder])
  $dest = Wait-Operation ($folder.CreateFileAsync($name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])

  $profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp3([Windows.Media.MediaProperties.AudioEncodingQuality]::Medium)
  $profile.Audio.ChannelCount = 1
  $profile.Audio.SampleRate = 16000
  $profile.Audio.Bitrate = $Bitrate

  $transcoder = New-Object Windows.Media.Transcoding.MediaTranscoder
  $prep = Wait-Operation ($transcoder.PrepareFileTranscodeAsync($src, $dest, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
  if (-not $prep.CanTranscode) {
    throw "MediaTranscoder refused the profile ($Bitrate bps): $($prep.FailureReason)"
  }
  Wait-ActionWithProgress ($prep.TranscodeAsync())
}

# ---------------------------------------------------------------------------------------------
# Run the jobs. A failure in one job never stops the others.
# ---------------------------------------------------------------------------------------------
$results = New-Object System.Collections.Generic.List[object]
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$total = $jobs.Count
$index = 0

foreach ($job in $jobs) {
  $index++
  $clipId = [string]$job.clipId
  $locale = [string]$job.locale
  Write-Log "($index/$total) $locale $clipId"
  $wavPath = $null
  $mp3Path = $null
  try {
    if ([string]::IsNullOrWhiteSpace($clipId) -or [string]::IsNullOrWhiteSpace([string]$job.text)) {
      throw 'Job has no clipId or no text.'
    }
    $voice = Find-Voice ([string]$job.voice)
    if (-not $voice) { throw "Voice not installed: $($job.voice)" }
    $wantedLang = if ($locale -eq 'vi') { 'vi' } elseif ($locale -eq 'en') { 'en' } else { $null }
    if ($wantedLang -and -not $voice.Language.StartsWith($wantedLang, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Voice '$($voice.DisplayName)' has language $($voice.Language), which does not match locale $locale."
    }

    $wavPath = Resolve-JobPath ([string]$job.outWav)
    $mp3Path = Resolve-JobPath ([string]$job.outMp3)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($wavPath)) | Out-Null
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($mp3Path)) | Out-Null

    $synth.Voice = $voice
    $synth.Options.SpeakingRate = Clamp ([double]$job.rate) 0.5 6.0
    $synth.Options.AudioPitch = Clamp ([double]$job.pitch) 0.0 2.0

    $stream = Wait-Operation ($synth.SynthesizeTextToStreamAsync([string]$job.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $bytes = $null
    try {
      $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
      $ms = New-Object System.IO.MemoryStream
      $netStream.CopyTo($ms)
      $bytes = $ms.ToArray()
    } finally {
      $stream.Dispose()
    }

    $info = New-Object 'double[]' 4
    $normalized = [Chapter1VoiceWav]::Normalize($bytes, -3.0, $info)
    [System.IO.File]::WriteAllBytes($wavPath, $normalized)

    $bitrate = 48000
    try {
      Convert-ToMp3 $wavPath $mp3Path $bitrate
    } catch {
      Write-Log "  48000 bps failed ($($_.Exception.Message)); retrying at 32000 bps"
      Convert-ToMp3 $wavPath $mp3Path 32000
    }

    $mp3Size = (Get-Item -LiteralPath $mp3Path).Length
    if ($mp3Size -le 0) { throw 'MP3 file is empty.' }

    $results.Add([ordered]@{
      clipId    = $clipId
      locale    = $locale
      ok        = $true
      durationMs = [int]$info[0]
      bytes     = [int]$mp3Size
      rmsDbfs   = $info[1]
      peakDbfs  = $info[2]
    })
  } catch {
    if ($mp3Path -and (Test-Path -LiteralPath $mp3Path)) {
      Remove-Item -LiteralPath $mp3Path -Force -ErrorAction SilentlyContinue
    }
    $results.Add([ordered]@{
      clipId = $clipId
      locale = $locale
      ok     = $false
      error  = $_.Exception.Message
    })
  }
}

$synth.Dispose()

$json = ConvertTo-Json -InputObject @($results.ToArray()) -Depth 4
if ($ResultFile) {
  $resultPath = Resolve-JobPath $ResultFile
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resultPath)) | Out-Null
  [System.IO.File]::WriteAllText($resultPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}
[Console]::Out.WriteLine($json)

if (@($results | Where-Object { -not $_.ok }).Count -gt 0) { exit 1 }
exit 0
