import { jsonDb } from '../database/jsonDb.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';
import { aiMemoryManager } from '../database/aiMemoryManager.js';
import { aiTools } from '../tools/aiTools.js';
import { mcpTools } from '../tools/mcpTools.js';
import { memoryManager } from '../database/memoryManager.js';
import { chatPresenceManager } from './chatPresenceManager.js';
import { personaManager } from '../system/personaManager.js';
import { proactiveEngagementManager } from '../system/proactiveEngagementManager.js';
import { predictiveAI } from '../system/predictiveAI.js';
import cron from 'node-cron';

const logger = createModuleLogger('ChatbotService');

export class ChatbotService {
  constructor() {
    this.processingMessages = new Set();
    this.activeUsers = new Set();
    this.lastProactiveMessage = new Map();
    this.setupMessageHandler();
    // Remove legacy proactive messaging - now handled by proactiveEngagementManager
  }

  /**
   * Set up message handler for WhatsApp client
   */
  setupMessageHandler() {
    whatsappClient.onMessage(async (messageInfo) => {
      await this.handleIncomingMessage(messageInfo);
    });
  }



  /**
   * Handle incoming WhatsApp message with enhanced AI-driven approach
   */
  async handleIncomingMessage(messageInfo) {
    const { sender, text, senderName, isGroup, quotedMessage, hasQuote } = messageInfo;

    if (isGroup) {
      logger.debug(`Skipping group message from ${senderName}`);
      return;
    }

    const messageKey = `${sender}-${messageInfo.id}`;
    if (this.processingMessages.has(messageKey)) {
      logger.debug(`Duplicate message detected: ${messageKey}`);
      return;
    }

    this.processingMessages.add(messageKey);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      logger.info(`📨 ${senderName}: ${preview}`);

      this.activeUsers.add(sender);
      
      // Register user with proactive engagement manager
      proactiveEngagementManager.registerActiveUser(sender);

      // Handle realistic chat presence (seen/read behavior)
      await chatPresenceManager.handleMessagePresence(messageInfo);
      
      // Notify presence manager about user activity
      chatPresenceManager.onUserMessage(sender);

      // AI-driven memory analysis (happens in background)
      this.processMemoryInBackground(sender, text);

      // Enhanced relationship and persona analysis
      await this.processRelationshipAndPersona(sender, text);

      // Handle reply context
      let finalText = text;
      if (hasQuote && quotedMessage) {
        const replyContext = this.formatReplyContext(quotedMessage);
        finalText = `${replyContext}\n\nUser's reply: ${text}`;
      }

      // AI-driven tool analysis
      const toolResults = await this.processToolsWithAI(sender, text);
      
      // Add tool results to context if any
      if (toolResults) {
        const toolContext = aiTools.formatToolResultsForAI(toolResults);
        finalText = `${finalText}${toolContext}`;
      }

      // Show typing indicator
      await whatsappClient.sendTyping(sender, true);

      if (config.bot.thinkingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, config.bot.thinkingDelay));
      }

      // Store user message
      await jsonDb.addMessage(sender, 'user', finalText, {
        senderName,
        messageId: messageInfo.id,
        quotedMessage: quotedMessage,
        hasQuote: hasQuote,
        originalText: text
      });

      // Get enhanced AI-driven context with persona
      const conversationHistory = await jsonDb.getConversationContext(sender, false); // Don't include legacy system prompt
      const memorySummary = await memoryManager.getMemorySummary(sender);
      const userMemory = await memoryManager.getUserMemory(sender);
      const timeContext = await jsonDb.getTimeContext(sender);

      // Generate dynamic persona-based system prompt
      const currentMood = userMemory.emotionalProfile?.currentMood;
      const personaPrompt = await personaManager.generatePersonaPrompt(sender, { userMood: currentMood });

      // Add persona prompt to conversation context
      const enhancedHistory = [
        {
          role: 'user',
          parts: [{ text: personaPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: `I understand! I'm ${config.persona.name}, ready to chat with you as your friend! 😊` }]
        },
        ...conversationHistory
      ];

      // Add time context to memory summary
      const aiMemorySummary = memorySummary + this.formatTimeContextForAI(timeContext);

      // Generate response using Gemini with enhanced context
      const response = await geminiClient.generateContent(enhancedHistory, aiMemorySummary, userMemory);

      // Clean response
      const cleanResponse = this.cleanResponse(response);

      // Store bot response
      await jsonDb.addMessage(sender, 'assistant', cleanResponse);

      // Stop typing and send
      await whatsappClient.sendTyping(sender, false);
      await whatsappClient.sendMessage(sender, cleanResponse);

      // Notify presence manager about bot response
      chatPresenceManager.onBotResponse(sender);

      logger.success(`✨ Enhanced AI reply sent to ${senderName}`);

    } catch (err) {
      logger.error(`Failed to process message from ${senderName}:`, err);

      await whatsappClient.sendTyping(sender, false);
      const errorMessage = this.getErrorMessage(err);
      await whatsappClient.sendMessage(sender, errorMessage);

    } finally {
      this.processingMessages.delete(messageKey);
    }
  }

  /**
   * Process memory operations in background using AI
   */
  async processMemoryInBackground(userId, userMessage) {
    try {
      // Run AI memory analysis in background
      setTimeout(async () => {
        await aiMemoryManager.analyzeMessageForMemoryOperations(userId, userMessage, geminiClient);
      }, 100);
    } catch (error) {
      logger.debug('Background memory processing error:', error);
    }
  }

  /**
   * Process relationship building and persona evolution
   */
  async processRelationshipAndPersona(userId, userMessage) {
    try {
      // Analyze relationship building opportunities
      const opportunities = await personaManager.analyzeRelationshipOpportunities(userId, userMessage);
      
      // Process relationship opportunities
      if (opportunities.length > 0) {
        await personaManager.processRelationshipOpportunities(userId, opportunities);
      }

      // Check for crisis indicators
      const crisisKeywords = ['depressed', 'want to die', 'hate myself', 'give up', 'can\'t handle', 'suicidal'];
      if (crisisKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
        proactiveEngagementManager.markUserInCrisis(userId, 'high', 'Crisis keywords detected in conversation');
      }

      // Trigger predictive analysis for high-engagement interactions
      if (opportunities.length > 0 || userMessage.length > 100) {
        // Run predictive analysis in background
        setTimeout(async () => {
          await predictiveAI.predictUserMood(userId, 12);
        }, 5000); // 5 second delay
      }
    } catch (error) {
      logger.debug('Error in relationship and persona processing:', error);
    }
  }

  /**
   * Process tools using AI analysis
   */
  async processToolsWithAI(userId, userMessage) {
    try {
      const availableTools = mcpTools.getAvailableTools();
      return await aiTools.analyzeMessageForToolOperations(userId, userMessage, availableTools, geminiClient);
    } catch (error) {
      logger.debug('AI tool processing error:', error);
      return null;
    }
  }

  /**
   * Format reply context for AI understanding
   */
  formatReplyContext(quotedMessage) {
    if (!quotedMessage) return '';
    
    const sender = quotedMessage.isFromBot ? 'Isiri' : 'User';
    return `[REPLYING TO ${sender.toUpperCase()}: "${quotedMessage.text}"]`;
  }

  /**
   * Format time context for AI understanding
   */
  formatTimeContextForAI(timeContext) {
    if (!timeContext) return '';

    let context = `\n\n=== REAL-TIME CONTEXT ===\n`;
    context += `Current time: ${timeContext.currentTime} (${timeContext.currentTimeOfDay})\n`;
    
    if (timeContext.timeSinceLastMessage !== null) {
      context += `Time since last message: ${timeContext.timeSinceLastMessage} minutes ago\n`;
    }
    
    if (timeContext.isLateNight) {
      context += `⚠️ It's late night - user should probably be sleeping for A/L studies\n`;
    }
    
    if (timeContext.isMealTime) {
      context += `🍽️ It's meal time - good time to ask about food\n`;
    }
    
    if (timeContext.isStudyTime) {
      context += `📚 It's typical study time for A/L students\n`;
    }
    
    context += `\nUse this timing information to respond naturally as a real friend would!\n`;
    return context;
  }

  /**
   * Clean response text
   */
  cleanResponse(response) {
    if (!response) return 'Sorry, mata response eka generate karanna bari una. Try again please! 😅';
    
    // Remove any JSON artifacts or debug info
    let cleaned = response
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/MEMORY ANALYSIS[\s\S]*$/i, '')
      .replace(/TOOL ANALYSIS[\s\S]*$/i, '')
      .trim();
    
    return cleaned || 'Hmm, mata mokak reply karanna ona kiyala confuse una. Try again? 🤔';
  }

  /**
   * Get appropriate error message
   */
  getErrorMessage(error) {
    const errorMessages = [
      'Aney sorry, mata mokak weda una! 😅 Try again please.',
      'Ehh, error wela! Mata brain freeze wela thiyenawa. 🤯',
      'Oops! Mata thoda issue ekak. Try again karanna? 🙈',
      'Sorry sorry, mata system eka hang wela. Eka try karanna! 😬'
    ];
    
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }

  /**
   * Get comprehensive service status
   */
  getStatus() {
    return {
      activeUsers: this.activeUsers.size,
      processingMessages: this.processingMessages.size,
      
      // Core AI features
      aiMemory: true,
      aiTools: true,
      chatPresence: chatPresenceManager.getPresenceStatus(),
      
      // Enhanced AI systems
      personaSystem: {
        enabled: true,
        dynamicPersonality: config.features.dynamic.personality_evolution,
        relationshipTracking: config.features.dynamic.relationship_tracking,
        contextAdaptation: config.features.dynamic.context_adaptation
      },
      
      proactiveEngagement: {
        enabled: config.features.proactive.mental_health_checkins,
        ...proactiveEngagementManager.getStatus()
      },
      
      predictiveAI: {
        enabled: config.features.predictive.mood_analysis,
        ...predictiveAI.getStatus()
      },
      
      // Persona configuration
      currentPersona: {
        name: config.persona.name,
        age: config.persona.age,
        location: `${config.persona.location.city}, ${config.persona.location.country}`,
        education: config.persona.education.level,
        traits: config.persona.personality_traits.slice(0, 5) // Show first 5 traits
      }
    };
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService();