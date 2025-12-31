#!/usr/bin/env bun
// $PAI_DIR/voice-server/server.ts
// Voice notification server using ElevenLabs TTS

import { serve } from "bun";
import { spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

// Load .env from PAI directory (single source of truth for all API keys)
const paiDir = process.env.PAI_DIR || join(homedir(), '.config', 'pai');
const envPath = join(paiDir, '.env');
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text();
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const PORT = parseInt(process.env.PAI_VOICE_PORT || "8888");
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error(`⚠️  ELEVENLABS_API_KEY not found in ${envPath}`);
  console.error('Add: ELEVENLABS_API_KEY=your_key_here to $PAI_DIR/.env');
}

// Default voice ID (customize to your preference)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "s3TPKV1kjDlVtZbl4Ksh";

// Voice configuration types
interface VoiceConfig {
  voice_id: string;
  voice_name: string;
  stability: number;
  similarity_boost: number;
  description: string;
}

interface VoicesConfig {
  default_volume?: number;
  voices: Record<string, VoiceConfig>;
}

// 13 Emotional Presets - Prosody System
const EMOTIONAL_PRESETS: Record<string, { stability: number; similarity_boost: number }> = {
  'excited': { stability: 0.7, similarity_boost: 0.9 },
  'celebration': { stability: 0.65, similarity_boost: 0.85 },
  'insight': { stability: 0.55, similarity_boost: 0.8 },
  'creative': { stability: 0.5, similarity_boost: 0.75 },
  'success': { stability: 0.6, similarity_boost: 0.8 },
  'progress': { stability: 0.55, similarity_boost: 0.75 },
  'investigating': { stability: 0.6, similarity_boost: 0.85 },
  'debugging': { stability: 0.55, similarity_boost: 0.8 },
  'learning': { stability: 0.5, similarity_boost: 0.75 },
  'pondering': { stability: 0.65, similarity_boost: 0.8 },
  'focused': { stability: 0.7, similarity_boost: 0.85 },
  'caution': { stability: 0.4, similarity_boost: 0.6 },
  'urgent': { stability: 0.3, similarity_boost: 0.9 },
};

// Load voice configuration
let voicesConfig: VoicesConfig | null = null;
try {
  const voicesPath = join(paiDir, 'config', 'voice-personalities.json');
  if (existsSync(voicesPath)) {
    const voicesContent = readFileSync(voicesPath, 'utf-8');
    voicesConfig = JSON.parse(voicesContent);
    console.log('✅ Loaded voice personalities from config');
  }
} catch (error) {
  console.warn('⚠️  Failed to load voice personalities, using defaults');
}

// Extract emotional marker from message
function extractEmotionalMarker(message: string): { cleaned: string; emotion?: string } {
  const emojiToEmotion: Record<string, string> = {
    '💥': 'excited', '🎉': 'celebration', '💡': 'insight', '🎨': 'creative',
    '✨': 'success', '📈': 'progress', '🔍': 'investigating', '🐛': 'debugging',
    '📚': 'learning', '🤔': 'pondering', '🎯': 'focused', '⚠️': 'caution', '🚨': 'urgent'
  };

  const emotionMatch = message.match(/\[(💥|🎉|💡|🎨|✨|📈|🔍|🐛|📚|🤔|🎯|⚠️|🚨)\s+(\w+)\]/);
  if (emotionMatch) {
    const emoji = emotionMatch[1];
    const emotionName = emotionMatch[2].toLowerCase();
    if (emojiToEmotion[emoji] === emotionName) {
      return {
        cleaned: message.replace(emotionMatch[0], '').trim(),
        emotion: emotionName
      };
    }
  }
  return { cleaned: message };
}

// Get voice configuration by voice ID or agent name
function getVoiceConfig(identifier: string): VoiceConfig | null {
  if (!voicesConfig) return null;
  if (voicesConfig.voices[identifier]) return voicesConfig.voices[identifier];
  for (const config of Object.values(voicesConfig.voices)) {
    if (config.voice_id === identifier) return config;
  }
  return null;
}

// Sanitize input for TTS - allow natural speech, block dangerous characters
function sanitizeForSpeech(input: string): string {
  return input
    .replace(/<script/gi, '')
    .replace(/\.\.\//g, '')
    .replace(/[;&|><`$\\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .trim()
    .substring(0, 500);
}

// Validate input
function validateInput(input: any): { valid: boolean; error?: string; sanitized?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }
  if (input.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }
  const sanitized = sanitizeForSpeech(input);
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Message contains no valid content after sanitization' };
  }
  return { valid: true, sanitized };
}

// Generate speech using ElevenLabs API
async function generateSpeech(
  text: string,
  voiceId: string,
  voiceSettings?: { stability: number; similarity_boost: number }
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const settings = voiceSettings || { stability: 0.5, similarity_boost: 0.5 };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: settings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

// Get volume setting from config (defaults to 0.8 = 80%)
function getVolumeSetting(): number {
  if (voicesConfig && typeof voicesConfig.default_volume === 'number') {
    const vol = voicesConfig.default_volume;
    if (vol >= 0 && vol <= 1) return vol;
  }
  return 0.8;
}

// Detect available audio player on the system
function detectAudioPlayer(): { command: string; args: (volume: number, file: string) => string[] } | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS - use afplay
    return {
      command: '/usr/bin/afplay',
      args: (volume: number, file: string) => ['-v', volume.toString(), file]
    };
  } else if (platform === 'linux') {
    // Linux - try multiple players in order of preference
    const players = [
      {
        command: '/usr/bin/paplay',
        args: (volume: number, file: string) => {
          // paplay uses 0-65536 volume range
          const paVolume = Math.floor(volume * 65536);
          return ['--volume', paVolume.toString(), file];
        }
      },
      {
        command: '/usr/bin/mpg123',
        args: (volume: number, file: string) => {
          // mpg123 uses 0-100 percentage
          const mpgVolume = Math.floor(volume * 100);
          return ['-f', mpgVolume.toString(), file];
        }
      },
      {
        command: '/usr/bin/ffplay',
        args: (volume: number, file: string) => {
          // ffplay uses 0-100 volume
          const ffVolume = Math.floor(volume * 100);
          return ['-nodisp', '-autoexit', '-volume', ffVolume.toString(), file];
        }
      },
      {
        command: '/usr/bin/aplay',
        args: (_volume: number, file: string) => {
          // aplay doesn't support volume control directly, use system volume
          return [file];
        }
      }
    ];

    // Check which player is available
    for (const player of players) {
      try {
        const { execSync } = require('child_process');
        execSync(`which ${player.command.split('/').pop()}`, { stdio: 'ignore' });
        return player;
      } catch {
        continue;
      }
    }
  }

  return null;
}

// Play audio using platform-appropriate player
async function playAudio(audioBuffer: ArrayBuffer): Promise<void> {
  const tempFile = `/tmp/voice-${Date.now()}.mp3`;
  await Bun.write(tempFile, audioBuffer);
  const volume = getVolumeSetting();

  const player = detectAudioPlayer();
  if (!player) {
    console.error('❌ No audio player found. Install paplay, mpg123, ffplay, or aplay on Linux.');
    spawn('/bin/rm', [tempFile]); // Clean up temp file
    throw new Error('No audio player available');
  }

  const args = player.args(volume, tempFile);
  console.log(`🔊 Playing audio with: ${player.command.split('/').pop()}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(player.command, args);

    proc.on('error', (error) => {
      console.error('Error playing audio:', error);
      spawn('/bin/rm', [tempFile]); // Clean up temp file
      reject(error);
    });

    proc.on('exit', (code) => {
      spawn('/bin/rm', [tempFile]); // Clean up temp file
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Audio player exited with code ${code}`));
      }
    });
  });
}

// Escape for AppleScript notifications
function escapeForAppleScript(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Send macOS notification with voice
async function sendNotification(
  title: string,
  message: string,
  voiceEnabled = true,
  voiceId: string | null = null
) {
  const titleValidation = validateInput(title);
  const messageValidation = validateInput(message);

  if (!titleValidation.valid) throw new Error(`Invalid title: ${titleValidation.error}`);
  if (!messageValidation.valid) throw new Error(`Invalid message: ${messageValidation.error}`);

  const safeTitle = titleValidation.sanitized!;
  let safeMessage = messageValidation.sanitized!;

  // Extract emotional marker if present
  const { cleaned, emotion } = extractEmotionalMarker(safeMessage);
  safeMessage = cleaned;

  // Generate and play voice using ElevenLabs
  if (voiceEnabled && ELEVENLABS_API_KEY) {
    try {
      const voice = voiceId || DEFAULT_VOICE_ID;
      const voiceConfig = getVoiceConfig(voice);

      // Determine voice settings (priority: emotional > personality > defaults)
      let voiceSettings = { stability: 0.5, similarity_boost: 0.5 };

      if (emotion && EMOTIONAL_PRESETS[emotion]) {
        voiceSettings = EMOTIONAL_PRESETS[emotion];
        console.log(`🎭 Emotion: ${emotion}`);
      } else if (voiceConfig) {
        voiceSettings = {
          stability: voiceConfig.stability,
          similarity_boost: voiceConfig.similarity_boost
        };
        console.log(`👤 Personality: ${voiceConfig.description}`);
      }

      console.log(`🎙️  Generating speech (voice: ${voice}, stability: ${voiceSettings.stability})`);

      const audioBuffer = await generateSpeech(safeMessage, voice, voiceSettings);
      await playAudio(audioBuffer);
    } catch (error) {
      console.error("Failed to generate/play speech:", error);
    }
  }

  // Display macOS notification
  try {
    const escapedTitle = escapeForAppleScript(safeTitle);
    const escapedMessage = escapeForAppleScript(safeMessage);
    const script = `display notification "${escapedMessage}" with title "${escapedTitle}" sound name ""`;
    spawn('/usr/bin/osascript', ['-e', script]);
  } catch (error) {
    console.error("Notification display error:", error);
  }
}

// Rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// Start HTTP server
const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const clientIp = req.headers.get('x-forwarded-for') || 'localhost';

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ status: "error", message: "Rate limit exceeded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Main notification endpoint
    if (url.pathname === "/notify" && req.method === "POST") {
      try {
        const data = await req.json();
        const title = data.title || "PAI Notification";
        const message = data.message || "Task completed";
        const voiceEnabled = data.voice_enabled !== false;
        const voiceId = data.voice_id || data.voice_name || null;

        if (voiceId && typeof voiceId !== 'string') {
          throw new Error('Invalid voice_id');
        }

        console.log(`📨 Notification: "${title}" - "${message.substring(0, 50)}..."`);

        await sendNotification(title, message, voiceEnabled, voiceId);

        return new Response(
          JSON.stringify({ status: "success", message: "Notification sent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } catch (error: any) {
        console.error("Notification error:", error);
        return new Response(
          JSON.stringify({ status: "error", message: error.message || "Internal server error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: error.message?.includes('Invalid') ? 400 : 500 }
        );
      }
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          port: PORT,
          voice_system: "ElevenLabs",
          default_voice_id: DEFAULT_VOICE_ID,
          api_key_configured: !!ELEVENLABS_API_KEY
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response("PAI Voice Server - POST to /notify", {
      headers: corsHeaders,
      status: 200
    });
  },
});

console.log(`🚀 Voice Server running on port ${PORT}`);
console.log(`🎙️  Using ElevenLabs TTS (default voice: ${DEFAULT_VOICE_ID})`);
console.log(`📡 POST to http://localhost:${PORT}/notify`);
console.log(`🔒 Security: CORS restricted to localhost, rate limiting enabled`);
console.log(`🔑 API Key: ${ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
