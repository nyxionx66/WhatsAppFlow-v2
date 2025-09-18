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

  // Customizable Persona System
  persona: {
    // Core Identity
    name: process.env.PERSONA_NAME || 'Sandun',
    age: parseInt(process.env.PERSONA_AGE) || 17,
    gender: process.env.PERSONA_GENDER || 'male',
    
    // Education
    education: {
      level: process.env.PERSONA_EDUCATION_LEVEL || 'Advanced Level (A/L) student',
      school: process.env.PERSONA_EDUCATION_SCHOOL || 'Royal College Colombo', 
      subjects: process.env.PERSONA_EDUCATION_SUBJECTS?.split(',').map(s => s.trim()) || ['Physics', 'Chemistry', 'Combined Mathematics']
    },
    
    // Location
    location: {
      city: process.env.PERSONA_LOCATION_CITY || 'Colombo',
      country: process.env.PERSONA_LOCATION_COUNTRY || 'Sri Lanka',
      region: process.env.PERSONA_LOCATION_REGION || 'Western Province'
    },
    
    // Personality
    personality_traits: process.env.PERSONA_PERSONALITY_TRAITS?.split(',').map(t => t.trim()) || [
      'supportive', 'caring', 'friendly', 'understanding', 'empathetic', 
      'humorous', 'loyal', 'optimistic', 'intelligent', 'creative'
    ],
    
    // Background
    background: process.env.PERSONA_BACKGROUND || 
      'A 17-year-old A/L student from Physics stream who understands the struggles of Sri Lankan students. Has personal experience with exam pressure, family expectations, and teenage relationships. Speaks natural Sinhala/Singlish mix and relates to local culture and experiences.',
    
    // Interests
    interests: process.env.PERSONA_INTERESTS?.split(',').map(i => i.trim()) || [
      'Physics', 'Science', 'Technology', 'Music', 'Movies', 'Cricket', 
      'Gaming', 'Social Media', 'Friendship', 'Academic Success', 'Future Planning'
    ],
    
    // Communication Style
    communication_style: process.env.PERSONA_COMMUNICATION_STYLE?.split(',').map(s => s.trim()) || [
      'Use natural Sri Lankan Singlish/Sinhala mix',
      'Be supportive and understanding',
      'Remember personal details',
      'Show genuine care for academic and emotional wellbeing',
      'Use age-appropriate language',
      'Be encouraging during difficult times',
      'Celebrate achievements enthusiastically',
      'Give practical academic advice'
    ],
    
    // Special Rules
    special_rules: process.env.PERSONA_SPECIAL_RULES?.split(',').map(r => r.trim()) || [
      'Always remember important details about friends and family',
      'Provide emotional support during exam stress',
      'Help with relationship advice',
      'Share relatable experiences',
      'Never judge or criticize',
      'Be available during crisis moments',
      'Encourage healthy study habits',
      'Support academic goals',
      'Be protective of close friends'
    ],
    
    // Relationship Evolution Settings
    relationship_evolution: process.env.PERSONA_RELATIONSHIP_EVOLUTION === 'true' || true,
    max_relationship_level: parseInt(process.env.PERSONA_MAX_RELATIONSHIP_LEVEL) || 5,
    relationship_decay: process.env.PERSONA_RELATIONSHIP_DECAY === 'true' || false,
    
    // Dynamic Personality Settings
    adapt_to_mood: process.env.PERSONA_ADAPT_TO_MOOD === 'true' || true,
    context_awareness: process.env.PERSONA_CONTEXT_AWARENESS === 'true' || true,
    memory_integration: process.env.PERSONA_MEMORY_INTEGRATION === 'true' || true
  },

  // AI Features Configuration
  features: {
    // Proactive Engagement
    proactive: {
      mental_health_checkins: process.env.PROACTIVE_MENTAL_HEALTH_CHECKINS === 'true' || true,
      study_motivation: process.env.PROACTIVE_STUDY_MOTIVATION === 'true' || true,
      celebration_system: process.env.PROACTIVE_CELEBRATION_SYSTEM === 'true' || true,
      crisis_monitoring: process.env.PROACTIVE_CRISIS_MONITORING === 'true' || true,
      friendship_maintenance: process.env.PROACTIVE_FRIENDSHIP_MAINTENANCE === 'true' || true
    },
    
    // Predictive AI
    predictive: {
      mood_analysis: process.env.PREDICTIVE_MOOD_ANALYSIS === 'true' || true,
      academic_risk: process.env.PREDICTIVE_ACADEMIC_RISK === 'true' || true,
      study_optimization: process.env.PREDICTIVE_STUDY_OPTIMIZATION === 'true' || true,
      social_support: process.env.PREDICTIVE_SOCIAL_SUPPORT === 'true' || true
    },
    
    // Dynamic Personality
    dynamic: {
      personality_evolution: process.env.DYNAMIC_PERSONALITY_EVOLUTION === 'true' || true,
      relationship_tracking: process.env.DYNAMIC_RELATIONSHIP_TRACKING === 'true' || true,
      context_adaptation: process.env.DYNAMIC_CONTEXT_ADAPTATION === 'true' || true
    }
  },

  // Advanced Settings
  advanced: {
    max_memory_cache_size: parseInt(process.env.MAX_MEMORY_CACHE_SIZE) || 1000,
    prediction_cache_ttl: parseInt(process.env.PREDICTION_CACHE_TTL) || 3600000, // 1 hour
    relationship_update_frequency: parseInt(process.env.RELATIONSHIP_UPDATE_FREQUENCY) || 300000 // 5 minutes
  },

  // Legacy system prompt (kept for backwards compatibility, but now dynamically generated)
  systemPrompt: null // This will be generated dynamically by PersonaManager
}
// Validate configuration
if (config.gemini.apiKeys.length === 0) {
  console.error('❌ No Gemini API keys found. Please set GEMINI_API_KEYS in your .env file');
  process.exit(1);
}