---
name: Kai Voice System
pack-id: danielmiessler-kai-voice-system-core-v1.2.0
version: 1.2.0
author: danielmiessler
description: Voice notification system with ElevenLabs TTS, prosody enhancement for natural speech, and agent personality-driven voice delivery
type: feature
purpose-type: [notifications, accessibility, automation]
platform: macos (linux with modifications)
dependencies:
  - kai-hook-system (required) - Hooks trigger voice notifications
  - kai-core-install (required) - Skills, identity, and response format drive voice output
keywords: [voice, tts, elevenlabs, notifications, prosody, speech, agents, personalities, accessibility]
---

<p align="center">
  <img src="../icons/kai-voice-system-v2.png" alt="Kai Voice System" width="256">
</p>

# Kai Voice System (kai-voice-system)

> Voice notification system with natural speech synthesis and personality-driven delivery

## 🚨 Platform Requirements

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS** | ✅ Fully Supported | Uses `afplay` (built-in) for audio playback |
| **Linux** | ✅ Fully Supported | Auto-detects `paplay`, `mpg123`, `ffplay`, or `aplay` |
| **Windows** | ❌ Not Supported | No current implementation |

**Before installing:** The installation guide will check your OS and verify audio player availability.

---

## What This Pack Provides

- **Spoken Notifications**: Hear task completions via ElevenLabs text-to-speech
- **Cross-Platform Audio**: Supports macOS (`afplay`) and Linux (`paplay`, `mpg123`, `ffplay`, `aplay`)
- **Prosody Enhancement**: Natural speech patterns with emotional markers
- **Agent Personalities**: Different voices for different agent types
- **Intelligent Cleaning**: Strips code blocks and artifacts for clean speech
- **Graceful Degradation**: Works silently when voice server is offline

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Stop Hook     │ ───► │  Voice Server    │ ───► │   ElevenLabs    │
│ (extracts msg)  │      │  (localhost:8888)│      │   (TTS API)     │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

## The 5-Layer Prosody Enhancement Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                    PROSODY ENHANCEMENT PIPELINE                   │
├──────────────────────────────────────────────────────────────────┤
│  1. TEXT EXTRACTION         Raw completion message                │
│  2. CONTEXT ANALYSIS        Detect emotional patterns             │
│  3. PERSONALITY PROSODY     Agent-specific speech patterns        │
│  4. SPEECH CLEANING         Remove non-spoken artifacts           │
│  5. VOICE DELIVERY          Personality → Voice ID routing        │
└──────────────────────────────────────────────────────────────────┘
```

## What's Included

| Component | File | Purpose |
|-----------|------|---------|
| Voice stop hook | `src/hooks/stop-hook-voice.ts` | Main agent voice notification |
| Subagent voice hook | `src/hooks/subagent-stop-hook-voice.ts` | Subagent voice notification |
| Prosody enhancer | `src/hooks/lib/prosody-enhancer.ts` | Add emotion/pauses to speech |
| Voice server | `src/voice/server.ts` | HTTP server for TTS requests |
| Server management | `src/voice/manage.sh` | Start/stop/restart server |
| Voice personalities | `config/voice-personalities.json` | Agent voice configurations |
| Hook configuration | `config/settings-hooks.json` | Hook registration template |

**Summary:**
- **Files created:** 7
- **Hooks registered:** 2 (Stop, SubagentStop)
- **Dependencies:** kai-hook-system (required), kai-core-install (required), ElevenLabs API key

## Agent Voice Mapping

| Agent Type | Voice Name | Speaking Rate | Stability | Archetype |
|------------|------------|---------------|-----------|-----------|
| PAI (Main) | Your DA | 235 wpm | 0.38 | enthusiast |
| Intern | Dev Patel | 270 wpm | 0.30 | enthusiast |
| Engineer | Marcus Webb | 212 wpm | 0.72 | wise-leader |
| Architect | Serena Blackwood | 205 wpm | 0.75 | wise-leader |
| Researcher | Ava Sterling | 229 wpm | 0.64 | analyst |
| Designer | Aditi Sharma | 226 wpm | 0.52 | critic |
| Artist | Priya Desai | 215 wpm | 0.20 | enthusiast |
| Pentester | Rook Blackburn | 260 wpm | 0.18 | enthusiast |
| Writer | Emma Hartley | 230 wpm | 0.48 | storyteller |

## Emotional Detection

The prosody enhancer detects emotional context from message patterns:

| Priority | Emotion | Triggers | Marker |
|----------|---------|----------|--------|
| 1 | urgent | "critical", "broken", "failing" | [🚨 urgent] |
| 2 | debugging | "bug", "error", "tracking" | [🐛 debugging] |
| 3 | insight | "wait", "aha", "I see" | [💡 insight] |
| 4 | celebration | "finally", "phew", "we did it" | [🎉 celebration] |
| 5 | excited | "breakthrough", "discovered" | [💥 excited] |
| 6 | investigating | "analyzing", "examining" | [🔍 investigating] |
| 7 | progress | "phase complete", "moving to" | [📈 progress] |
| 8 | success | "completed", "fixed", "deployed" | [✨ success] |
| 9 | caution | "warning", "careful", "partial" | [⚠️ caution] |

## Credits

- **Author:** Daniel Miessler
- **Origin:** Extracted from production Kai system (2024-2025)
- **License:** MIT

## Works Well With

- **kai-hook-system** (required) - Hooks trigger voice notifications
- **kai-core-install** (required) - Response format provides 🎯 COMPLETED line
- **kai-history-system** - Complementary functionality
