# Kai Voice System - Installation Guide

## Prerequisites

- **Bun runtime**: `curl -fsSL https://bun.sh/install | bash`
- **Audio player**:
  - **macOS**: Uses `afplay` (built-in)
  - **Linux**: Auto-detects `paplay`, `mpg123`, `ffplay`, or `aplay`
- **ElevenLabs account**: Sign up at [elevenlabs.io](https://elevenlabs.io)
- **Required PAI Packs** (install these first):
  - `kai-hook-system` - Foundation hook infrastructure
  - `kai-core-install` - Skills, identity, and response format

---

## 🚨 CRITICAL: Platform Compatibility Check

> **FOR AI AGENTS:** You MUST run this check FIRST. If the user is on Windows, STOP and inform them before proceeding.

### Step 0.0: Operating System Check (MANDATORY)

```bash
OS_TYPE="$(uname -s)"
echo "Detected OS: $OS_TYPE"

if [ "$OS_TYPE" = "Darwin" ]; then
  echo "✓ macOS detected - Voice system is fully supported"
  echo "  Audio: afplay (built-in)"
elif [ "$OS_TYPE" = "Linux" ]; then
  echo "✓ Linux detected - Voice system is fully supported"
  echo "  Audio: Auto-detects paplay, mpg123, ffplay, or aplay"
  echo ""
  echo "📦 Recommended: Install an audio player if not already present"
  echo "  - PulseAudio: sudo apt install pulseaudio-utils (paplay)"
  echo "  - mpg123: sudo apt install mpg123"
  echo "  - FFmpeg: sudo apt install ffmpeg (ffplay)"
  echo "  - ALSA: sudo apt install alsa-utils (aplay)"
else
  echo ""
  echo "❌ UNSUPPORTED: $OS_TYPE detected"
  echo "The Kai Voice System currently supports macOS and Linux only."
  echo "Windows is not currently supported."
fi
```

**AI Agent Instructions:**
- If OS is macOS → Proceed with installation
- If OS is Linux → Proceed with installation (audio player auto-detection enabled)
- If OS is Windows → STOP, do not proceed, inform user it's unsupported

---

## Pre-Installation: Port Configuration

### Step 0.1: Choose Voice Server Port

The default port is **8888**. If this port is in use, choose an alternative.

```bash
# Check if default port 8888 is available
if lsof -i :8888 > /dev/null 2>&1; then
  echo "⚠️  Port 8888 is IN USE"
  lsof -i :8888 | head -5
  echo ""
  echo "Options:"
  echo "  1. Stop the service using port 8888"
  echo "  2. Use a different port (set VOICE_SERVER_PORT in .env)"
else
  echo "✓ Port 8888 is available"
fi
```

**To use a custom port:** Add to `$PAI_DIR/.env`:
```bash
VOICE_SERVER_PORT=8889  # or any available port
```

The voice server and hooks will automatically use this port if set.

---

## Pre-Installation: System Analysis

### Step 0.2: Verify Required Dependencies

```bash
PAI_CHECK="${PAI_DIR:-$HOME/.config/pai}"

echo "=== Checking Required Dependencies ==="

# Check hook system (REQUIRED)
if [ -f "$PAI_CHECK/hooks/lib/observability.ts" ]; then
  echo "✓ kai-hook-system is installed"
else
  echo "❌ kai-hook-system NOT installed - REQUIRED!"
fi

# Check core install (REQUIRED)
if [ -d "$PAI_CHECK/skills" ] && [ -f "$PAI_CHECK/skills/CORE/SKILL.md" ]; then
  echo "✓ kai-core-install is installed"
else
  echo "❌ kai-core-install NOT installed - REQUIRED!"
fi

# Check for ElevenLabs API key
PAI_ENV="${PAI_DIR:-$HOME/.config/pai}/.env"
if [ -f "$PAI_ENV" ] && grep -q "ELEVENLABS_API_KEY" "$PAI_ENV"; then
  echo "✓ ELEVENLABS_API_KEY found"
else
  echo "⚠️  ELEVENLABS_API_KEY not found - add to $PAI_ENV"
fi
```

### Step 0.3: Check for Existing Voice System

```bash
PAI_CHECK="${PAI_DIR:-$HOME/.config/pai}"

# Check for existing voice directory
if [ -d "$PAI_CHECK/voice" ]; then
  echo "⚠️  Voice directory EXISTS"
else
  echo "✓ No existing voice directory"
fi

# Check for running voice server
if lsof -i :8888 > /dev/null 2>&1; then
  echo "⚠️  Something running on port 8888"
else
  echo "✓ Port 8888 is available"
fi
```

### Step 0.4: Stop Existing Voice Server (If Running)

```bash
# Stop any running voice server
pkill -f "voice/server.ts" 2>/dev/null || true

# Unload LaunchAgent if exists (macOS)
if [ -f "$HOME/Library/LaunchAgents/com.pai.voice-server.plist" ]; then
  launchctl unload "$HOME/Library/LaunchAgents/com.pai.voice-server.plist" 2>/dev/null
fi
```

---

## Step 1: Create Directory Structure

```bash
mkdir -p $PAI_DIR/hooks/lib
mkdir -p $PAI_DIR/config
mkdir -p $PAI_DIR/voice-server
```

---

## Step 2: Install Prosody Enhancer Library

Copy `src/hooks/lib/prosody-enhancer.ts` to `$PAI_DIR/hooks/lib/prosody-enhancer.ts`

---

## Step 3: Install Voice Hooks

Copy the following files:
- `src/hooks/stop-hook-voice.ts` → `$PAI_DIR/hooks/stop-hook-voice.ts`
- `src/hooks/subagent-stop-hook-voice.ts` → `$PAI_DIR/hooks/subagent-stop-hook-voice.ts`

---

## Step 4: Install Voice Configuration

Copy `config/voice-personalities.json` to `$PAI_DIR/config/voice-personalities.json`

---

## Step 5: Install Voice Server

Copy `src/voice/server.ts` to `$PAI_DIR/voice-server/server.ts`

---

## Step 6: Set Up ElevenLabs Account

1. **Sign up** at [elevenlabs.io](https://elevenlabs.io)
2. **Get your API key** from Profile + API key
3. **Add to $PAI_DIR/.env**:

```bash
ELEVENLABS_API_KEY="your-api-key"
```

4. **Test your API key**:

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/s3TPKV1kjDlVtZbl4Ksh" \
  -H "xi-api-key: YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test.", "model_id": "eleven_turbo_v2_5"}' \
  --output test.mp3

# Play the test file (macOS)
afplay test.mp3

# Or on Linux (use whichever player you have installed)
# paplay test.mp3
# mpg123 test.mp3
# ffplay -nodisp -autoexit test.mp3

rm test.mp3
```

---

## Step 7: Register Hooks

Merge the hook configuration from `config/settings-hooks.json` into your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run $PAI_DIR/hooks/stop-hook-voice.ts"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run $PAI_DIR/hooks/subagent-stop-hook-voice.ts"
          }
        ]
      }
    ]
  }
}
```

---

## Step 8: Start Voice Server

```bash
# Start the voice server
bun run $PAI_DIR/voice-server/server.ts &

# Verify it's running
curl http://localhost:8888/health
```

---

## Step 9: (Optional) Set Up Auto-Start

Create a LaunchAgent to auto-start the voice server on login:

```bash
cat > ~/Library/LaunchAgents/com.pai.voice-server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pai.voice-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/.bun/bin/bun</string>
        <string>run</string>
        <string>/Users/YOUR_USERNAME/.config/pai/voice-server/server.ts</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/pai-voice-server.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/pai-voice-server.log</string>
</dict>
</plist>
EOF

# Replace YOUR_USERNAME with your actual username
sed -i '' "s/YOUR_USERNAME/$USER/g" ~/Library/LaunchAgents/com.pai.voice-server.plist

# Load the agent
launchctl load ~/Library/LaunchAgents/com.pai.voice-server.plist
```

---

## Step 10: Verify Installation

Run the verification checklist in VERIFY.md to confirm everything works.

---

## Troubleshooting

### No Voice Output

1. Check voice server is running: `curl http://localhost:8888/health`
2. Verify ElevenLabs API key is set in `$PAI_DIR/.env`
3. Check logs: `tail -f ~/Library/Logs/pai-voice-server.log`

### Wrong Voice

1. Verify voice ID in `config/voice-personalities.json`
2. Check agent type is being detected correctly in hooks

### Audio Playback Issues

**macOS:**
1. `afplay` is built-in, should work out of the box
2. Check system volume
3. Verify audio permissions

**Linux:**
1. Install one of the supported audio players:
   - **PulseAudio**: `sudo apt install pulseaudio-utils` (provides `paplay`)
   - **mpg123**: `sudo apt install mpg123`
   - **FFmpeg**: `sudo apt install ffmpeg` (provides `ffplay`)
   - **ALSA**: `sudo apt install alsa-utils` (provides `aplay`)
2. Check system volume: `pactl list sinks` or `alsamixer`
3. Verify audio is working: `speaker-test -t wav -c 2`
