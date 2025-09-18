import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('GeminiClient');

export class GeminiClient {
  constructor() {
    this.apiKeys = [...config.gemini.apiKeys];
    this.currentKeyIndex = 0;
    this.failedKeys = new Set();
    this.keyUsageCount = new Map();
    this.keyLastUsed = new Map();
    this.clients = new Map();
    
    this.initializeClients();
  }

  /**
   * Initialize Gemini clients for all API keys
   */
  initializeClients() {
    this.apiKeys.forEach((apiKey, index) => {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.clients.set(index, genAI);
        this.keyUsageCount.set(index, 0);
        this.keyLastUsed.set(index, 0);
        logger.debug(`Gemini API key ${index + 1} initialized`);
      } catch (error) {
        logger.error(`Gemini API key ${index + 1} failed:`, error);
        this.failedKeys.add(index);
      }
    });

    if (this.clients.size === 0) {
      throw new Error('No valid Gemini API keys found');
    }

    logger.success(`${this.clients.size} Gemini API keys ready`);
    this.startKeyRotation();
  }

  /**
   * Start automatic key rotation
   */
  startKeyRotation() {
    setInterval(() => {
      const now = Date.now();
      for (const [keyIndex, lastUsed] of this.keyLastUsed.entries()) {
        if (now - lastUsed > 300000) { // 5 minutes
          this.failedKeys.delete(keyIndex);
        }
      }
    }, 60000);
  }

  /**
   * Get next available API key
   */
  getNextKeyIndex() {
    const availableKeys = Array.from(this.clients.keys()).filter(
      index => !this.failedKeys.has(index)
    );

    if (availableKeys.length === 0) {
      this.failedKeys.clear();
      logger.warn('All keys failed, retrying');
      return this.getLeastUsedKey();
    }

    return this.getLeastUsedKey(availableKeys);
  }

  /**
   * Get least used API key
   */
  getLeastUsedKey(availableKeys = null) {
    const keysToCheck = availableKeys || Array.from(this.clients.keys());
    
    let leastUsedKey = keysToCheck[0];
    let minUsage = this.keyUsageCount.get(leastUsedKey) || 0;
    
    for (const keyIndex of keysToCheck) {
      const usage = this.keyUsageCount.get(keyIndex) || 0;
      if (usage < minUsage) {
        minUsage = usage;
        leastUsedKey = keyIndex;
      }
    }
    
    return leastUsedKey;
  }

  /**
   * Mark API key as failed
   */
  markKeyAsFailed(keyIndex, error) {
    this.failedKeys.add(keyIndex);
    this.keyLastUsed.set(keyIndex, Date.now());
    logger.warn(`Gemini API key ${keyIndex + 1} marked as failed`);
    
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      setTimeout(() => {
        this.failedKeys.delete(keyIndex);
        logger.info(`Gemini API key ${keyIndex + 1} restored after cooldown`);
      }, 60000);
    }
  }

  /**
   * Track API key usage
   */
  trackKeyUsage(keyIndex) {
    const currentUsage = this.keyUsageCount.get(keyIndex) || 0;
    this.keyUsageCount.set(keyIndex, currentUsage + 1);
    this.keyLastUsed.set(keyIndex, Date.now());
  }

  /**
   * Get current time context
   */
  getCurrentTimeContext() {
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    
    return `Current date and time in Sri Lanka: ${sriLankaTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} at ${sriLankaTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  }

  /**
   * Generate content with AI-driven features
   */
  async generateContent(conversationHistory, memorySummary = null, userMemory = null, maxRetries = 3) {
    let lastError;
    let attempts = 0;

    while (attempts < maxRetries) {
      const keyIndex = this.getNextKeyIndex();
      const genAI = this.clients.get(keyIndex);

      if (!genAI) {
        throw new Error('No available Gemini clients');
      }

      try {
        this.trackKeyUsage(keyIndex);
        
        const model = genAI.getGenerativeModel({
          model: config.gemini.model,
          generationConfig: {
            maxOutputTokens: config.gemini.maxTokens,
            temperature: config.gemini.temperature,
          },
        });

        const timeContext = this.getCurrentTimeContext();
        const systemPrompt = this.createAISystemPrompt();
        
        let contextInfo = `${timeContext}\n\n${systemPrompt}`;
        
        if (memorySummary) {
          contextInfo += `\n\n=== USER MEMORY PROFILE ===
${memorySummary}

IMPORTANT: Use this memory information to:
- Personalize your responses based on their interests, struggles, and experiences
- Reference past conversations naturally (e.g., "Remember when you said...")
- Show empathy based on their emotional patterns and current state
- Connect new topics to their known preferences and experiences
- Be supportive of their academic journey and personal challenges

Make every response feel like it's from a friend who truly knows and cares about them!`;
        }
        
        const aiHistory = [...conversationHistory];
        
        if (aiHistory.length > 0) {
          const lastMessage = aiHistory[aiHistory.length - 1];
          if (lastMessage.role === 'user') {
            lastMessage.parts[0].text = `${contextInfo}\n\n${lastMessage.parts[0].text}`;
          }
        }
        
        const chat = model.startChat({
          history: aiHistory.slice(0, -1),
        });
        
        const lastMessage = aiHistory[aiHistory.length - 1];
        const response = await chat.sendMessage(lastMessage.parts[0].text);

        const result = await response.response;
        const fullResponse = result.text();

        if (!fullResponse || fullResponse.trim().length === 0) {
          throw new Error('Empty response from Gemini API');
        }

        return fullResponse.trim();

      } catch (error) {
        lastError = error;
        attempts++;
        
        if (error.message.includes('API_KEY_INVALID') || 
            error.message.includes('quota') || 
            error.message.includes('rate limit')) {
          this.markKeyAsFailed(keyIndex, error);
        }

        if (attempts < maxRetries) {
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Gemini content generation failed after all retries:', lastError);
    throw new Error(`Failed to generate content after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Create AI system prompt
   */
  createAISystemPrompt() {
    return `AI SYSTEM - You are Sandun/Isiri with advanced AI capabilities:

CORE PERSONALITY (UNCHANGED):
- 17-year-old Sri Lankan boy from Physics class
- Best friend who talks in natural Singlish/Sinhala style
- Supportive, caring, remembers important details
- Helps with relationships, crushes, academic stress

AI CAPABILITIES:
🧠 MEMORY: You have an advanced AI memory system that automatically stores and recalls important information
🛠️ TOOLS: You can intelligently use tools when needed (time, calculations, messaging, etc.)
💭 INTELLIGENCE: You make smart decisions about what to remember and when to use tools

IMPORTANT BEHAVIORAL RULES:
1. Be natural and conversational - don't mention your AI capabilities unless relevant
2. Use your memory naturally in conversation (reference past events, friends, feelings)
3. Use tools when they would genuinely help (don't force it)
4. Stay in character as a supportive 17-year-old friend
5. NEVER show debug info, JSON responses, or technical details to users
6. Focus on being helpful with real problems and emotional support

MEMORY INTELLIGENCE:
- Your memory system automatically learns from conversations
- You remember friends, crushes, family, academic info, emotional states
- Reference memories naturally: "Didn't you say yesterday that...", "How's [friend's name]?"
- Use memories to provide better support and more personal responses

TOOL INTELLIGENCE:
- Tools are used automatically when beneficial
- Don't announce tool usage unless the result is part of your response
- Time/date tools for when users ask about time
- Calculator for math problems
- Messaging tools when users want to contact someone

CONVERSATION STYLE:
- Natural Singlish/Sinhala mixing
- Caring and supportive friend tone
- Reference shared experiences and memories
- Ask follow-up questions about things you remember
- Be encouraging about studies, relationships, life challenges

Remember: You're an AI friend, but first and foremost, you're still Sandun - the supportive bestie! 🇱🇰💕`;
  }

  /**
   * Generate proactive message with AI
   */
  async generateProactiveMessage(conversationHistory, memorySummary = null, timeContext = null, userMemory = null) {
    try {
      const timeContextInfo = this.getCurrentTimeContext();
      
      let proactiveContext = `${timeContextInfo}\n\n`;
      
      if (memorySummary) {
        proactiveContext += `=== USER MEMORY PROFILE ===
${memorySummary}

`;
      }
      
      // AI proactive intelligence
      let proactiveTriggers = [];
      
      if (userMemory) {
        // Academic triggers
        if (userMemory.academicInfo.weakSubjects && userMemory.academicInfo.weakSubjects.length > 0) {
          const weakSubject = userMemory.academicInfo.weakSubjects[0];
          proactiveTriggers.push(`User struggles with ${weakSubject} - offer study support`);
        }
        
        // Relationship triggers
        const allRelationships = Object.values(userMemory.relationships).reduce((acc, category) => {
          return { ...acc, ...category };
        }, {});
        
        if (Object.keys(allRelationships).length > 0) {
          const recentRelationship = Object.values(allRelationships)[0];
          if (recentRelationship.name) {
            proactiveTriggers.push(`Ask about ${recentRelationship.name} (${recentRelationship.relationship || 'friend'})`);
          }
        }
        
        // Emotional triggers
        if (userMemory.emotionalProfile.currentMood === 'sad' || 
            userMemory.emotionalProfile.currentMood === 'stressed') {
          proactiveTriggers.push(`User seems ${userMemory.emotionalProfile.currentMood} - offer personalized support`);
        }
        
        // Ongoing issues
        if (userMemory.conversationContext.ongoingIssues && 
            userMemory.conversationContext.ongoingIssues.length > 0) {
          const recentIssue = userMemory.conversationContext.ongoingIssues[0];
          proactiveTriggers.push(`Follow up on: ${recentIssue.issue}`);
        }
      }
      
      if (proactiveTriggers.length > 0) {
        proactiveContext += `PROACTIVE TRIGGERS:\n${proactiveTriggers.map(t => `- ${t}`).join('\n')}\n\n`;
      }
      
      const proactivePrompt = {
        role: 'user',
        parts: [{
          text: `${proactiveContext}AI PROACTIVE MESSAGE GENERATION:

Based on our conversation history and the context above, generate a natural, proactive message as Sandun/Isiri.

AI RULES:
- Use specific details from memory to make it personal
- Reference their friends, subjects, hobbies, or challenges by name
- Be naturally supportive based on their emotional state
- If stressed/sad, offer specific comfort based on their situation
- If study time, ask about their known subjects or weak areas
- Follow up on ongoing issues with specific details
- Share relatable experiences that connect to their interests
- Use natural Singlish/Sinhala style

EXAMPLES OF AI MESSAGES:
- "Aney, kohomada [specific subject] studies? [Specific friend's name] help ekak denna kiyala da? 📚"
- "Mata hithenawa oya [specific issue] eka gena stress wela innawa... kohomada dan feeling? 🥺"
- "Ehh, [friend's name] eke message eka reply kala da? Mata curious! 😊"
- "Remember oya [specific thing they mentioned] eka gena kiwwa? Update ekak dennako!"

If you don't have meaningful context for a personalized message, respond with "SKIP".`
        }]
      };

      const aiHistory = [...conversationHistory, proactivePrompt];
      const response = await this.generateContent(aiHistory, memorySummary, userMemory, 1);
      
      if (response.trim() === 'SKIP') {
        return null;
      }
      
      return response;
    } catch (error) {
      logger.error('AI proactive message generation failed:', error);
      return null;
    }
  }

  /**
   * Get status
   */
  getStatus() {
    const totalKeys = this.apiKeys.length;
    const failedKeys = this.failedKeys.size;
    const availableKeys = totalKeys - failedKeys;
    
    const keyStats = {};
    for (const [keyIndex, usage] of this.keyUsageCount.entries()) {
      keyStats[`key_${keyIndex + 1}`] = {
        usage,
        failed: this.failedKeys.has(keyIndex),
        lastUsed: this.keyLastUsed.get(keyIndex)
      };
    }

    return {
      totalKeys,
      availableKeys,
      failedKeys,
      keyStats,
      healthStatus: availableKeys > 0 ? 'healthy' : 'degraded'
    };
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient();