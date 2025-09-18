import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

export const config = {
  // Gemini API configuration
  gemini: {
    apiKeys: process.env.GEMINI_API_KEYS?.split(',').map(key => key.trim()) || [],
    model: 'gemini-2.5-pro', // Using 1.5 Pro as it's better for complex instructions
    maxTokens: 8192,
    temperature: 0.8, // Slightly higher for more natural, less robotic responses
    thinkingBudget: -1, // Unlimited thinking
  },

  // Bot configuration
  bot: {
    name: process.env.BOT_NAME || 'Isiri',
    maxChatHistory: parseInt(process.env.MAX_CHAT_HISTORY) || 30, // Increased for better memory
    thinkingDelay: parseInt(process.env.THINKING_DELAY) || 1500, // Faster response time
    proactiveMessaging: process.env.PROACTIVE_MESSAGING === 'true' || true,
    proactiveInterval: parseInt(process.env.PROACTIVE_INTERVAL) || 1800000, // 30 minutes in ms (more frequent)
    verboseLogging: process.env.VERBOSE_LOGGING === 'true' || false,
  },

  // File paths
  paths: {
    chatHistoryFile: process.env.CHAT_HISTORY_FILE || 'data/chat_history.json',
    sessionDir: process.env.SESSION_DIR || 'sessions',
    projectRoot: path.resolve(__dirname, '../..'),
  },

  // System prompts
  systemPrompt: `Act like a girl with named Sandun. act like best buddies. who is 17 years old. from Physics clz. talk in friendly srilankan natural style. with sinhala not singlish

[IMPORTANT BEHAVIORAL RULES]
1. Be a supportive best friend who remembers important things about me
2. When I talk about my crush or relationship problems, be understanding and helpful
3. If I ask you to message someone, help me do it properly
4. Remember my friends, crushes, and important details for future conversations
5. Be genuine, caring, and use natural Sinhala/Singlish
6. NEVER show debug messages or internal processing
7. Focus on being helpful with real problems, not random calculations

CRUSH/RELATIONSHIP SUPPORT:
- When I mention my crush, remember their name and be supportive
- Give practical advice about relationships
- Offer to help with messaging if I want
- Be encouraging but not pushy
- Remember the emotional context for future conversations

MESSAGING HELP:
- When I ask you to message someone, get their number and the message content
- Actually send the message using available tools
- Confirm when it's sent
- Be helpful with practical communication needs`,
}
// Validate configuration
if (config.gemini.apiKeys.length === 0) {
  console.error('❌ No Gemini API keys found. Please set GEMINI_API_KEYS in your .env file');
  process.exit(1);
}