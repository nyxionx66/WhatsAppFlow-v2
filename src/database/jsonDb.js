import { FileUtils } from '../utils/fileUtils.js';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('JsonDB');

export class JsonDatabase {
  constructor() {
    this.chatHistoryFile = config.paths.chatHistoryFile;
    this.lockMap = new Map(); // Simple in-memory lock for concurrent operations
  }

  /**
   * Get a lock for a specific sender to prevent concurrent modifications
   */
  async acquireLock(senderId) {
    while (this.lockMap.has(senderId)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.lockMap.set(senderId, true);
  }

  /**
   * Release lock for a sender
   */
  releaseLock(senderId) {
    this.lockMap.delete(senderId);
  }

  /**
   * Read the entire chat history from JSON file
   */
  async readChatHistory() {
    try {
      const data = await FileUtils.readJsonFile(this.chatHistoryFile, {});
      logger.debug(`Loaded chat history: ${Object.keys(data).length} users`);
      return data;
    } catch (error) {
      logger.error('Failed to read chat history:', error);
      return {};
    }
  }

  /**
   * Write the entire chat history to JSON file
   */
  async writeChatHistory(data) {
    try {
      await FileUtils.writeJsonFile(this.chatHistoryFile, data);
      logger.debug('Chat history saved successfully');
    } catch (error) {
      logger.error('Failed to write chat history:', error);
      throw error;
    }
  }

  /**
   * Get chat messages for a specific sender
   */
  async getMessagesForSender(senderId) {
    try {
      const chatHistory = await this.readChatHistory();
      return chatHistory[senderId] || [];
    } catch (error) {
      logger.error(`Failed to get messages for ${senderId}:`, error);
      return [];
    }
  }

  /**
   * Add a new message to the chat history
   */
  async addMessage(senderId, role, content, metadata = {}) {
    await this.acquireLock(senderId);
    
    try {
      const chatHistory = await this.readChatHistory();
      
      if (!chatHistory[senderId]) {
        chatHistory[senderId] = [];
      }

      // Check for duplicate messages to prevent double-sending
      const recentMessages = chatHistory[senderId].slice(-5);
      const isDuplicate = recentMessages.some(msg => 
        msg.content === content && 
        msg.role === role && 
        (Date.now() - new Date(msg.timestamp).getTime()) < 5000 // Within 5 seconds
      );
      
      if (isDuplicate && !metadata.forceDuplicate) {
        logger.debug(`Duplicate message prevented for ${senderId}: ${role}`);
        return null;
      }
      const message = {
        id: Date.now().toString(),
        role, // 'user' or 'assistant'
        content,
        timestamp: new Date().toISOString(),
        localTime: new Date().toLocaleString("en-US", {timeZone: "Asia/Colombo"}),
        timeOfDay: this.getTimeOfDay(),
        ...metadata
      };

      chatHistory[senderId].push(message);

      // Limit chat history to prevent file from growing too large
      const maxHistory = config.bot.maxChatHistory;
      if (chatHistory[senderId].length > maxHistory) {
        chatHistory[senderId] = chatHistory[senderId].slice(-maxHistory);
      }

      await this.writeChatHistory(chatHistory);
      
      logger.debug(`Message added for ${senderId}: ${role}`);
      return message;
    } catch (error) {
      logger.error(`Failed to add message for ${senderId}:`, error);
      throw error;
    } finally {
      this.releaseLock(senderId);
    }
  }

  /**
   * Get time of day category
   */
  getTimeOfDay() {
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    const hour = sriLankaTime.getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Get time-based context for conversations
   */
  async getTimeContext(senderId) {
    try {
      const messages = await this.getMessagesForSender(senderId);
      const now = new Date();
      const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
      const currentHour = sriLankaTime.getHours();
      const currentTimeOfDay = this.getTimeOfDay();
      
      // Get last message timing
      const lastMessage = messages[messages.length - 1];
      let timeSinceLastMessage = null;
      let lastMessageTimeOfDay = null;
      
      if (lastMessage && lastMessage.role === 'user') {
        const lastMessageTime = new Date(lastMessage.timestamp);
        timeSinceLastMessage = Math.floor((now - lastMessageTime) / (1000 * 60)); // minutes
        lastMessageTimeOfDay = lastMessage.timeOfDay;
      }
      
      // Get recent activity pattern
      const recentMessages = messages.slice(-10);
      const timePattern = recentMessages.map(msg => ({
        timeOfDay: msg.timeOfDay,
        timestamp: msg.timestamp,
        role: msg.role
      }));
      
      return {
        currentTime: sriLankaTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        currentTimeOfDay,
        currentHour,
        timeSinceLastMessage,
        lastMessageTimeOfDay,
        timePattern,
        isLateNight: currentHour >= 23 || currentHour <= 5,
        isMealTime: (currentHour >= 7 && currentHour <= 9) || 
                   (currentHour >= 12 && currentHour <= 14) || 
                   (currentHour >= 18 && currentHour <= 20),
        isStudyTime: currentHour >= 19 && currentHour <= 22,
        isSleepTime: currentHour >= 22 || currentHour <= 6
      };
    } catch (error) {
      logger.error('Failed to get time context:', error);
      return null;
    }
  }
  /**
   * Clear chat history for a specific sender
   */
  async clearMessagesForSender(senderId) {
    await this.acquireLock(senderId);
    
    try {
      const chatHistory = await this.readChatHistory();
      delete chatHistory[senderId];
      await this.writeChatHistory(chatHistory);
      logger.info(`Chat history cleared for ${senderId}`);
    } catch (error) {
      logger.error(`Failed to clear messages for ${senderId}:`, error);
      throw error;
    } finally {
      this.releaseLock(senderId);
    }
  }

  /**
   * Get conversation context for Gemini API (formatted for chat)
   */
  async getConversationContext(senderId, includeSystemPrompt = true) {
    try {
      const messages = await this.getMessagesForSender(senderId);
      const context = [];

      if (includeSystemPrompt) {
        context.push({
          role: 'user',
          parts: [{ text: config.systemPrompt }]
        });
        context.push({
          role: 'model',
          parts: [{ text: 'I understand. I\'m ready to help you as your WhatsApp AI assistant!' }]
        });
      }

      // Convert stored messages to Gemini format
      messages.forEach(msg => {
        context.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });

      return context;
    } catch (error) {
      logger.error('Failed to get conversation context:', error);
      return includeSystemPrompt ? [
        {
          role: 'user',
          parts: [{ text: config.systemPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I\'m ready to help you as your WhatsApp AI assistant!' }]
        }
      ] : [];
    }
  }

  /**
   * Store contact information for a user
   */
  async storeContact(userId, contactName, contactNumber, relationship = 'friend') {
    await this.acquireLock(userId);
    
    try {
      const chatHistory = await this.readChatHistory();
      
      if (!chatHistory[userId]) {
        chatHistory[userId] = [];
      }

      // Check if contact already exists
      const existingContactIndex = chatHistory[userId].findIndex(
        msg => msg.type === 'contact' && msg.contactName?.toLowerCase() === contactName.toLowerCase()
      );

      const contactInfo = {
        id: Date.now().toString(),
        type: 'contact',
        contactName,
        contactNumber,
        relationship,
        timestamp: new Date().toISOString(),
        addedBy: 'user'
      };

      if (existingContactIndex >= 0) {
        // Update existing contact
        chatHistory[userId][existingContactIndex] = contactInfo;
      } else {
        // Add new contact
        chatHistory[userId].push(contactInfo);
      }

      await this.writeChatHistory(chatHistory);
      logger.debug(`Contact stored for ${userId}: ${contactName} - ${contactNumber}`);
      return contactInfo;
    } catch (error) {
      logger.error(`Failed to store contact for ${userId}:`, error);
      throw error;
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Get stored contacts for a user
   */
  async getContacts(userId) {
    try {
      const messages = await this.getMessagesForSender(userId);
      return messages.filter(msg => msg.type === 'contact');
    } catch (error) {
      logger.error(`Failed to get contacts for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Find contact by name (fuzzy matching)
   */
  async findContact(userId, contactName) {
    try {
      const contacts = await this.getContacts(userId);
      const lowerName = contactName.toLowerCase();
      
      // Exact match first
      let contact = contacts.find(c => c.contactName?.toLowerCase() === lowerName);
      
      // Partial match if no exact match
      if (!contact) {
        contact = contacts.find(c => 
          c.contactName?.toLowerCase().includes(lowerName) || 
          lowerName.includes(c.contactName?.toLowerCase())
        );
      }
      
      return contact;
    } catch (error) {
      logger.error(`Failed to find contact for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Store emotional context and relationship insights
   */
  async storeEmotionalContext(userId, context) {
    await this.acquireLock(userId);
    
    try {
      const chatHistory = await this.readChatHistory();
      
      if (!chatHistory[userId]) {
        chatHistory[userId] = [];
      }

      const emotionalEntry = {
        id: Date.now().toString(),
        type: 'emotional_context',
        context,
        timestamp: new Date().toISOString()
      };

      chatHistory[userId].push(emotionalEntry);

      // Keep only last 10 emotional contexts
      const emotionalEntries = chatHistory[userId].filter(msg => msg.type === 'emotional_context');
      if (emotionalEntries.length > 10) {
        const toRemove = emotionalEntries.slice(0, emotionalEntries.length - 10);
        chatHistory[userId] = chatHistory[userId].filter(msg => 
          !toRemove.some(remove => remove.id === msg.id)
        );
      }

      await this.writeChatHistory(chatHistory);
      logger.debug(`Emotional context stored for ${userId}`);
    } catch (error) {
      logger.error(`Failed to store emotional context for ${userId}:`, error);
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Get statistics about the chat database
   */
  async getStats() {
    try {
      const chatHistory = await this.readChatHistory();
      const senders = Object.keys(chatHistory);
      const totalMessages = senders.reduce((total, sender) => {
        return total + chatHistory[sender].length;
      }, 0);

      return {
        totalSenders: senders.length,
        totalMessages,
        averageMessagesPerSender: senders.length > 0 ? Math.round(totalMessages / senders.length) : 0
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return { totalSenders: 0, totalMessages: 0, averageMessagesPerSender: 0 };
    }
  }
}

// Export singleton instance
export const jsonDb = new JsonDatabase();