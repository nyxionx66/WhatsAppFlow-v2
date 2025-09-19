import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { createModuleLogger } from '../utils/logger.js';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { geminiClient } from '../gemini/geminiClient.js';
import { FileUtils } from '../utils/fileUtils.js';
import { memoryManager } from '../database/memoryManager.js';
import { config } from '../config/config.js';
import path from 'path';

const logger = createModuleLogger('MCPTools');

export class MCPTools {
  constructor() {
    this.tools = new Map();
    this.contacts = new Map(); // Store user contacts
    this.outgoingMessageContexts = new Map(); // Store context of messages sent to contacts
    this.pdfCache = new Map(); // Cache for PDF metadata
    this.initializeTools();
  }

  /**
   * Initialize all MCP tools
   */
  initializeTools() {
    // Time and Date Tools
    this.registerTool('get_current_time', this.getCurrentTime.bind(this));
    this.registerTool('get_current_date', this.getCurrentDate.bind(this));
    this.registerTool('get_timestamp', this.getTimestamp.bind(this));
    
    // WhatsApp Tools
    this.registerTool('send_message_to_number', this.sendMessageToNumber.bind(this));
    this.registerTool('send_message_to_contact', this.sendMessageToContact.bind(this));
    this.registerTool('delete_message', this.deleteMessage.bind(this));
    this.registerTool('get_chat_info', this.getChatInfo.bind(this));
    this.registerTool('set_typing_status', this.setTypingStatus.bind(this));
    
    // Contact Management Tools
    this.registerTool('store_contact', this.storeContact.bind(this));
    this.registerTool('get_contacts', this.getContacts.bind(this));
    this.registerTool('find_contact', this.findContact.bind(this));
    
    // System Tools
    this.registerTool('get_system_status', this.getSystemStatus.bind(this));
    this.registerTool('clear_chat_history', this.clearChatHistory.bind(this));
    
    // Memory Tools
    this.registerTool('get_user_memory', this.getUserMemory.bind(this));
    this.registerTool('get_user_memory_details', this.getUserMemoryDetails.bind(this));
    this.registerTool('store_memory', this.storeMemory.bind(this));
    
    // Emotional Intelligence Tools
    this.registerTool('analyze_emotional_state', this.analyzeEmotionalState.bind(this));
    
    // Utility Tools
    this.registerTool('generate_random_number', this.generateRandomNumber.bind(this));
    this.registerTool('calculate', this.calculate.bind(this));
    this.registerTool('format_text', this.formatText.bind(this));

    // Enhanced PDF Tools
    this.registerTool('create_pdf_from_topic', this.createPdfFromTopic.bind(this));
    this.registerTool('create_study_guide_pdf', this.createStudyGuidePdf.bind(this));
    this.registerTool('create_custom_pdf', this.createCustomPdf.bind(this));
    this.registerTool('append_to_pdf', this.appendToPdf.bind(this));
    this.registerTool('insert_pdf_section', this.insertPdfSection.bind(this));
    this.registerTool('create_pdf_with_images', this.createPdfWithImages.bind(this));
    this.registerTool('merge_pdfs', this.mergePdfs.bind(this));
    this.registerTool('send_pdf_to_user', this.sendPdfToUser.bind(this));
    this.registerTool('get_pdf_info', this.getPdfInfo.bind(this));
    this.registerTool('list_user_pdfs', this.listUserPdfs.bind(this));

    // Message Context Tools
    this.registerTool('store_outgoing_message_context', this.storeOutgoingMessageContext.bind(this));
    this.registerTool('get_outgoing_message_context', this.getOutgoingMessageContext.bind(this));
    this.registerTool('check_incoming_message_context', this.checkIncomingMessageContext.bind(this));

    logger.success(`${this.tools.size} MCP tools initialized`);
  }

  /**
   * Register a new tool
   */
  registerTool(name, handler) {
    this.tools.set(name, handler);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName, params = {}) {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      const result = await tool(params);
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Get list of available tools with descriptions
   */
  getAvailableTools() {
    return {
      // Time and Date Tools
      get_current_time: {
        description: "Get current time in Sri Lanka timezone",
        parameters: {
          format: "Optional format (12h/24h), default: 12h"
        }
      },
      get_current_date: {
        description: "Get current date in Sri Lanka",
        parameters: {
          format: "Optional format (short/long/iso), default: long"
        }
      },
      get_timestamp: {
        description: "Get current Unix timestamp",
        parameters: {}
      },
      
      // WhatsApp Tools
      send_message_to_number: {
        description: "Send a message to a specific WhatsApp number",
        parameters: {
          number: "Phone number with country code (e.g., 94771234567)",
          message: "Message text to send"
        }
      },
      send_message_to_contact: {
        description: "Send a message to a stored contact",
        parameters: {
          contactName: "Name of the stored contact",
          message: "Message text to send",
          userId: "User ID who owns the contact"
        }
      },
      delete_message: {
        description: "Delete a message by its ID",
        parameters: {
          messageId: "Message ID to delete",
          chatId: "Chat ID where the message is located"
        }
      },
      get_chat_info: {
        description: "Get information about a chat",
        parameters: {
          chatId: "Chat ID to get info for"
        }
      },
      set_typing_status: {
        description: "Set typing indicator for a chat",
        parameters: {
          chatId: "Chat ID",
          isTyping: "true/false"
        }
      },
      
      // Contact Management Tools
      store_contact: {
        description: "Store a contact with name, number and relationship",
        parameters: {
          userId: "User ID who owns the contact",
          contactName: "Name of the contact",
          contactNumber: "Phone number",
          relationship: "Relationship type (friend/crush/family/etc)"
        }
      },
      get_contacts: {
        description: "Get all stored contacts for a user",
        parameters: {
          userId: "User ID"
        }
      },
      find_contact: {
        description: "Find a contact by name",
        parameters: {
          userId: "User ID",
          contactName: "Name to search for"
        }
      },
      
      // System Tools
      get_system_status: {
        description: "Get current system status and statistics",
        parameters: {}
      },
      clear_chat_history: {
        description: "Clear chat history for a user",
        parameters: {
          userId: "User ID to clear history for"
        }
      },
      get_user_memory: {
        description: "Get comprehensive memory profile for a user",
        parameters: {
          userId: "User ID to get memory for"
        }
      },
      get_user_memory_details: {
        description: "Get specific details from user's memory profile",
        parameters: {
          userId: "User ID",
          category: "Memory category (personalInfo, relationships, academicInfo, emotionalProfile, etc.)",
          subcategory: "Optional subcategory within the category"
        }
      },
      store_memory: {
        description: "Store specific memory information for a user",
        parameters: {
          userId: "User ID",
          category: "Memory category (personalInfo, relationships, academicInfo, etc.)",
          data: "Memory data to store"
        }
      },
      
      // Emotional Intelligence
      analyze_emotional_state: {
        description: "Analyze and store emotional context",
        parameters: {
          userId: "User ID",
          emotionalContext: "Emotional context to analyze"
        }
      },

      // Enhanced PDF Tools
      create_pdf_from_topic: {
        description: "Create a comprehensive PDF document from a topic with professional formatting",
        parameters: {
          topic: "The topic for the PDF content",
          userId: "User ID for personalization",
          style: "PDF style: academic, professional, casual, study-guide",
          includeImages: "Include relevant diagrams/images (true/false)",
          pageLayout: "single-column, two-column, mixed",
          colorScheme: "blue, green, purple, orange, monochrome"
        }
      },
      create_study_guide_pdf: {
        description: "Create a structured study guide PDF with sections, summaries, and key points",
        parameters: {
          subject: "Subject/topic for the study guide",
          userId: "User ID",
          chapters: "Array of chapter topics or auto-generate",
          includeQuizzes: "Include practice questions (true/false)",
          difficulty: "beginner, intermediate, advanced"
        }
      },
      create_custom_pdf: {
        description: "Create a custom PDF with specific content and formatting",
        parameters: {
          title: "PDF title",
          content: "Raw content or structured data",
          userId: "User ID",
          template: "report, letter, presentation, article, manual",
          formatting: "Custom formatting options object"
        }
      },
      append_to_pdf: {
        description: "Add new content to existing PDF with proper formatting",
        parameters: {
          filePath: "Path to existing PDF",
          newContent: "Content to append",
          sectionTitle: "Title for new section",
          insertPosition: "end, beginning, after-section"
        }
      },
      insert_pdf_section: {
        description: "Insert a new section at specific position in PDF",
        parameters: {
          filePath: "Path to existing PDF",
          sectionContent: "Content for new section",
          sectionTitle: "Section title",
          insertAfter: "Insert after this section title",
          insertBefore: "Insert before this section title"
        }
      },
      create_pdf_with_images: {
        description: "Create PDF with embedded images and diagrams",
        parameters: {
          topic: "PDF topic",
          userId: "User ID",
          imageUrls: "Array of image URLs to include",
          imageDescriptions: "Descriptions for each image",
          layout: "text-image, image-text, mixed"
        }
      },
      merge_pdfs: {
        description: "Merge multiple PDFs into one document",
        parameters: {
          pdfPaths: "Array of PDF file paths to merge",
          outputName: "Name for merged PDF",
          userId: "User ID",
          includeBookmarks: "Add navigation bookmarks (true/false)"
        }
      },
      send_pdf_to_user: {
        description: "Send a PDF file to user via WhatsApp",
        parameters: {
          userId: "User ID to send to",
          filePath: "Path to PDF file",
          fileName: "Custom filename (optional)",
          caption: "Message caption (optional)"
        }
      },
      get_pdf_info: {
        description: "Get information about a PDF file",
        parameters: {
          filePath: "Path to PDF file"
        }
      },
      list_user_pdfs: {
        description: "List all PDFs created for a user",
        parameters: {
          userId: "User ID",
          sortBy: "date, name, size, type"
        }
      },
      
      // Utility Tools
      generate_random_number: {
        description: "Generate a random number",
        parameters: {
          min: "Minimum value (default: 1)",
          max: "Maximum value (default: 100)"
        }
      },
      calculate: {
        description: "Perform mathematical calculations",
        parameters: {
          expression: "Mathematical expression to evaluate"
        }
      },
      format_text: {
        description: "Format text in various ways",
        parameters: {
          text: "Text to format",
          style: "Format style (uppercase/lowercase/title/reverse)"
        }
      },
      
      // Message Context Tools
      store_outgoing_message_context: {
        description: "Store context for messages sent to contacts",
        parameters: {
          userId: "User ID who sent the message",
          contactNumber: "Contact's phone number",
          context: "Message context object with purpose, relationship, etc."
        }
      },
      get_outgoing_message_context: {
        description: "Get context for previous messages sent to a contact",
        parameters: {
          userId: "User ID",
          contactNumber: "Contact's phone number"
        }
      },
      check_incoming_message_context: {
        description: "Check if an incoming message is a reply to a previous outgoing message",
        parameters: {
          userId: "User ID",
          senderNumber: "Number of the person who sent the message",
          messageText: "The incoming message text"
        }
      }
    };
  }

  // ==================== TIME AND DATE TOOLS ====================

  async getCurrentTime(params = {}) {
    const { format = '12h' } = params;
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    
    if (format === '24h') {
      return sriLankaTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } else {
      return sriLankaTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  async getCurrentDate(params = {}) {
    const { format = 'long' } = params;
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    
    switch (format) {
      case 'short':
        return sriLankaTime.toLocaleDateString('en-US');
      case 'iso':
        return sriLankaTime.toISOString().split('T')[0];
      case 'long':
      default:
        return sriLankaTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
    }
  }

  async getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  // ==================== WHATSAPP TOOLS ====================

  async sendMessageToNumber(params) {
    const { number, message } = params;
    
    if (!number || !message) {
      throw new Error('Number and message are required');
    }

    // Format number to WhatsApp JID format
    const formattedNumber = number.replace(/[^\d]/g, '');
    const jid = `${formattedNumber}@s.whatsapp.net`;
    
    logger.info(`Sending message to ${number} (${jid}): ${message}`);
    await whatsappClient.sendMessage(jid, message);
    
    return {
      success: true,
      message: `Message sent to ${number}`,
      jid: jid
    };
  }

  async sendMessageToContact(params) {
    const { contactName, message, userId, purpose, context } = params;
    
    if (!contactName || !message || !userId) {
      throw new Error('Contact name, message, and user ID are required');
    }

    const contact = await this.findContact({ userId, contactName });
    if (!contact) {
      throw new Error(`Contact '${contactName}' not found`);
    }

    // Store the message context for tracking
    await this.storeOutgoingMessageContext({
      userId,
      contactNumber: contact.contactNumber,
      context: {
        contactName,
        message,
        purpose: purpose || 'general',
        context: context || 'user_requested',
        timestamp: new Date().toISOString(),
        relationship: contact.relationship
      }
    });

    const result = await this.sendMessageToNumber({
      number: contact.contactNumber,
      message: message
    });

    return {
      ...result,
      purpose,
      context,
      contactName
    };
  }

  async deleteMessage(params) {
    const { messageId, chatId } = params;
    
    if (!messageId || !chatId) {
      throw new Error('Message ID and Chat ID are required');
    }

    try {
      await whatsappClient.deleteMessage(chatId, messageId);
      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  async getChatInfo(params) {
    const { chatId } = params;
    
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    try {
      const info = await whatsappClient.getChatInfo(chatId);
      return info;
    } catch (error) {
      throw new Error(`Failed to get chat info: ${error.message}`);
    }
  }

  async setTypingStatus(params) {
    const { chatId, isTyping = true } = params;
    
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    await whatsappClient.sendTyping(chatId, isTyping);
    
    return {
      success: true,
      message: `Typing status set to ${isTyping} for ${chatId}`
    };
  }

  // ==================== CONTACT MANAGEMENT TOOLS ====================

  async storeContact(params) {
    const { userId, contactName, contactNumber, relationship = 'friend' } = params;
    
    if (!userId || !contactName || !contactNumber) {
      throw new Error('User ID, contact name, and contact number are required');
    }

    if (!this.contacts.has(userId)) {
      this.contacts.set(userId, new Map());
    }

    const userContacts = this.contacts.get(userId);
    userContacts.set(contactName.toLowerCase(), {
      contactName,
      contactNumber,
      relationship,
      dateAdded: new Date().toISOString()
    });

    return {
      success: true,
      message: `Contact '${contactName}' stored successfully`,
      contact: {
        contactName,
        contactNumber,
        relationship
      }
    };
  }

  async getContacts(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const userContacts = this.contacts.get(userId);
    if (!userContacts) {
      return [];
    }

    return Array.from(userContacts.values());
  }

  async findContact(params) {
    const { userId, contactName } = params;
    
    if (!userId || !contactName) {
      throw new Error('User ID and contact name are required');
    }

    const userContacts = this.contacts.get(userId);
    if (!userContacts) {
      return null;
    }

    return userContacts.get(contactName.toLowerCase()) || null;
  }

  // ==================== SYSTEM TOOLS ====================

  async getSystemStatus() {
    const { chatbotService } = await import('../services/chatbotService.js');
    return chatbotService.getStatus();
  }

  async clearChatHistory(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { jsonDb } = await import('../database/jsonDb.js');
    await jsonDb.clearMessagesForSender(userId);
    
    return {
      success: true,
      message: `Chat history cleared for ${userId}`
    };
  }

  async getUserMemory(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    const memory = await memoryManager.getUserMemory(userId);
    
    return {
      success: true,
      memory: memory
    };
  }

  async getUserMemoryDetails(params) {
    const { userId, category, subcategory } = params;
    
    if (!userId || !category) {
      throw new Error('User ID and category are required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    const memory = await memoryManager.getUserMemory(userId);
    
    if (!memory[category]) {
      return null;
    }

    if (subcategory) {
      return memory[category][subcategory] || null;
    }

    return memory[category];
  }

  async storeMemory(params) {
    const { userId, category, data } = params;
    
    if (!userId || !category || !data) {
      throw new Error('User ID, category, and data are required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    await memoryManager.updateMemory(userId, category, data, true);
    
    return {
      success: true,
      message: `Memory stored for ${userId} in category ${category}`
    };
  }

  async analyzeEmotionalState(params) {
    const { userId, emotionalContext } = params;
    
    if (!userId || !emotionalContext) {
      throw new Error('User ID and emotional context are required');
    }

    const { jsonDb } = await import('../database/jsonDb.js');
    await jsonDb.storeEmotionalContext(userId, emotionalContext);

    // Also store in memory system
    const { memoryManager } = await import('../database/memoryManager.js');
    await memoryManager.storeEmotionalContext(userId, { 
      mood: emotionalContext.mood,
      stressLevel: emotionalContext.stressLevel,
      traits: emotionalContext.traits
    });
    
    return {
      success: true,
      message: 'Emotional context analyzed and stored',
      context: emotionalContext
    };
  }

  // ==================== ENHANCED PDF TOOLS ====================

  /**
   * Get professional HTML template for PDF generation
   */
  _getPdfTemplate(options = {}) {
    const {
      title = 'Document',
      style = 'academic',
      colorScheme = 'blue',
      language = 'si', // Default to Sinhala
      pageLayout = 'single-column',
      includeHeader = true,
      includeFooter = true
    } = options;

    const colors = {
      blue: { primary: '#2563eb', secondary: '#3b82f6', accent: '#e0f2fe', text: '#1e293b' },
      green: { primary: '#059669', secondary: '#10b981', accent: '#d1fae5', text: '#1f2937' },
      purple: { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#ede9fe', text: '#1f2937' },
      orange: { primary: '#ea580c', secondary: '#f97316', accent: '#fed7aa', text: '#1f2937' },
      monochrome: { primary: '#374151', secondary: '#6b7280', accent: '#f3f4f6', text: '#111827' }
    };

    const selectedColors = colors[colorScheme] || colors.blue;

    // Enhanced Sinhala font support with better fallbacks
    const fontFamily = language === 'si' ? 
      "'Noto Sans Sinhala', 'Noto Serif Sinhala', 'Iskoola Pota', 'DL-Manel', 'Mal Gun', 'FM Abhaya', serif" : 
      "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    return `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Sinhala:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary-color: ${selectedColors.primary};
            --secondary-color: ${selectedColors.secondary};
            --accent-color: ${selectedColors.accent};
            --text-color: ${selectedColors.text};
            --font-family: ${fontFamily};
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @page {
            size: A4;
            margin: 25mm 20mm;
            @top-center {
              content: "${includeHeader ? title : ''}";
              font-family: var(--font-family);
              font-size: 10pt;
              color: var(--secondary-color);
              border-bottom: 1px solid var(--accent-color);
              padding-bottom: 5px;
            }
            @bottom-center {
              content: ${includeFooter ? '"Page " counter(page) " of " counter(pages)' : '""'};
              font-family: var(--font-family);
              font-size: 9pt;
              color: var(--secondary-color);
            }
          }

          body {
            font-family: var(--font-family);
            font-size: ${language === 'si' ? '15pt' : '11pt'}; /* Slightly larger for better Sinhala readability */
            line-height: ${language === 'si' ? '1.8' : '1.7'}; /* Better line spacing for Sinhala */
            color: var(--text-color);
            background: white;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility; /* Better text rendering for Sinhala */
          }

          .document-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px 0;
            border-bottom: 3px solid var(--primary-color);
            background: linear-gradient(135deg, var(--accent-color) 0%, rgba(255,255,255,0.9) 100%);
            border-radius: 8px;
            margin: -10px -10px 40px -10px;
            padding: 40px 20px 30px 20px;
          }

          .document-title {
            font-size: ${language === 'si' ? '30pt' : '24pt'}; /* Larger for Sinhala titles */
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 10px;
            letter-spacing: ${language === 'si' ? '0px' : '-0.5px'}; /* No letter spacing for Sinhala */
            word-spacing: ${language === 'si' ? '0.1em' : 'normal'}; /* Better word spacing for Sinhala */
          }

          .document-subtitle {
            font-size: ${language === 'si' ? '16pt' : '14pt'};
            color: var(--secondary-color);
            font-weight: 400;
            margin-bottom: 15px;
          }

          .document-meta {
            font-size: ${language === 'si' ? '11pt' : '10pt'};
            color: var(--secondary-color);
            font-style: italic;
          }

          .content-wrapper {
            ${pageLayout === 'two-column' ? `
              columns: 2;
              column-gap: 30px;
              column-rule: 1px solid var(--accent-color);
            ` : ''}
          }

          h1 {
            font-size: ${language === 'si' ? '24pt' : '20pt'}; /* Larger for Sinhala headings */
            font-weight: 600;
            color: var(--primary-color);
            margin: 35px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--accent-color);
            page-break-after: avoid;
            word-spacing: ${language === 'si' ? '0.1em' : 'normal'};
          }

          h2 {
            font-size: ${language === 'si' ? '20pt' : '16pt'}; /* Larger for Sinhala subheadings */
            font-weight: 600;
            color: var(--primary-color);
            margin: 30px 0 15px 0;
            padding-left: 15px;
            border-left: 4px solid var(--primary-color);
            page-break-after: avoid;
            word-spacing: ${language === 'si' ? '0.1em' : 'normal'};
          }

          h3 {
            font-size: ${language === 'si' ? '18pt' : '14pt'}; /* Larger for Sinhala */
            font-weight: 600;
            color: var(--secondary-color);
            margin: 25px 0 12px 0;
            page-break-after: avoid;
            word-spacing: ${language === 'si' ? '0.1em' : 'normal'};
          }

          h4 {
            font-size: ${language === 'si' ? '14pt' : '12pt'};
            font-weight: 600;
            color: var(--secondary-color);
            margin: 20px 0 10px 0;
          }

          p {
            margin-bottom: ${language === 'si' ? '18px' : '15px'}; /* More spacing for Sinhala */
            text-align: justify;
            text-justify: inter-word;
            orphans: 3;
            widows: 3;
            word-spacing: ${language === 'si' ? '0.05em' : 'normal'}; /* Better word spacing for Sinhala */
            text-indent: ${language === 'si' ? '1.5em' : '0'}; /* Indent for Sinhala paragraphs */
          }

          .highlight {
            background: linear-gradient(120deg, var(--accent-color) 0%, var(--accent-color) 100%);
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
          }

          .important {
            background: var(--accent-color);
            border-left: 4px solid var(--primary-color);
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
            font-weight: 500;
          }

          ul, ol {
            margin: 15px 0 15px 25px;
            padding-left: 0;
          }

          li {
            margin-bottom: 8px;
            line-height: 1.6;
          }

          .formula-box {
            background: var(--accent-color);
            border: 1px solid var(--secondary-color);
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 13pt;
            font-weight: 600;
            break-inside: avoid;
          }

          .table-wrapper {
            margin: 25px 0;
            overflow-x: auto;
            break-inside: avoid;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }

          th {
            background: var(--primary-color);
            color: white;
            font-weight: 600;
            padding: 12px 15px;
            text-align: left;
            font-size: ${language === 'si' ? '12pt' : '10pt'};
          }

          td {
            padding: 10px 15px;
            border-bottom: 1px solid var(--accent-color);
            font-size: ${language === 'si' ? '12pt' : '10pt'};
          }

          tr:nth-child(even) {
            background: rgba(37, 99, 235, 0.05);
          }

          .section-break {
            page-break-before: always;
            margin-top: 0;
          }

          .no-break {
            page-break-inside: avoid;
          }

          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 600; }
          .font-italic { font-style: italic; }

          .quote-box {
            border-left: 4px solid var(--primary-color);
            background: var(--accent-color);
            padding: 20px 25px;
            margin: 25px 0;
            font-style: italic;
            border-radius: 0 8px 8px 0;
            position: relative;
          }

          .quote-box::before {
            content: '"';
            font-size: 48pt;
            color: var(--primary-color);
            position: absolute;
            top: -10px;
            left: 10px;
            font-weight: bold;
            opacity: 0.3;
          }

          .image-placeholder {
            width: 100%;
            height: 200px;
            background: var(--accent-color);
            border: 2px dashed var(--secondary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px 0;
            border-radius: 8px;
            font-style: italic;
            color: var(--secondary-color);
          }

          .footer-info {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid var(--accent-color);
            font-size: 9pt;
            color: var(--secondary-color);
            text-align: center;
          }

          .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin: 20px 0;
          }

          .sidebar {
            background: var(--accent-color);
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid var(--primary-color);
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="document-header">
          <div class="document-title">{TITLE}</div>
          <div class="document-subtitle">{SUBTITLE}</div>
          <div class="document-meta">{META}</div>
        </div>
        <div class="content-wrapper">
          {CONTENT}
        </div>
        <div class="footer-info">
          Generated on {DATE} • Created with Advanced PDF Generator
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate professional PDF from HTML content
   */
  async _generatePdfFromHtml(htmlContent, filePath, options = {}) {
    const {
      format = 'A4',
      orientation = 'portrait',
      margin = { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
      displayHeaderFooter = true,
      headerTemplate = '',
      footerTemplate = '',
      printBackground = true,
      preferCSSPageSize = true
    } = options;

    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      headless: true
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport for better rendering
      await page.setViewport({ width: 1200, height: 1600 });
      
      // Load HTML content
      await page.setContent(htmlContent, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      });

      // Generate PDF with high quality settings
      await page.pdf({
        path: filePath,
        format,
        landscape: orientation === 'landscape',
        margin,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        printBackground,
        preferCSSPageSize,
        timeout: 60000
      });

      logger.success(`PDF generated successfully: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to generate PDF: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Process and enhance content with AI - optimized for Sinhala
   */
  async _processContentWithAI(content, options = {}) {
    const {
      language = 'si', // Default to Sinhala
      style = 'academic',
      enhance = true,
      addStructure = true,
      includeExamples = false
    } = options;

    if (!enhance) return content;

    const prompts = [];

    if (addStructure) {
      prompts.push("Add proper headings, subheadings, and structure to organize the content logically.");
    }

    if (includeExamples) {
      prompts.push("Include relevant examples, case studies, or practical applications where appropriate.");
    }

    prompts.push("Ensure the content is comprehensive, well-formatted, and suitable for a professional document.");

    // Always enhance for Sinhala
    prompts.push("The entire content must be in Sinhala language with proper Sinhala grammar and structure. Use natural Sinhala expressions and terminology. Avoid mixing English words unless they are commonly accepted technical terms.");

    const enhancementPrompt = `
Please enhance and improve the following content according to these requirements:
${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Style: ${style}
Language: Sinhala (සිංහල)

Original content:
---
${content}
---

Please return only the enhanced content without any additional commentary.
    `;

    try {
      const enhanced = await geminiClient.generateContent([{ 
        role: 'user', 
        parts: [{ text: enhancementPrompt }] 
      }]);

      return enhanced || content;
    } catch (error) {
      logger.warn(`Content enhancement failed, using original: ${error.message}`);
      return content;
    }
  }

  /**
   * Convert markdown-style content to HTML
   */
  _convertToHtml(content) {
    let html = content
      // Headers
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Lists
      .replace(/^\* (.+$)/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+$)/gm, '<li>$1</li>')
      
      // Highlight important text
      .replace(/==(.+?)==/g, '<span class="highlight">$1</span>')
      
      // Important boxes
      .replace(/^!!! (.+$)/gm, '<div class="important">$1</div>')
      
      // Formulas
      .replace(/\$\$(.+?)\$\$/g, '<div class="formula-box">$1</div>')
      
      // Quotes
      .replace(/^> (.+$)/gm, '<div class="quote-box">$1</div>')
      
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap in paragraphs and fix lists
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><li>/g, '<ul><li>').replace(/<\/li><\/p>/g, '</li></ul>');
    html = html.replace(/<\/ul><ul>/g, '');

    return html;
  }

  /**
   * Store PDF metadata
   */
  async _storePdfMetadata(filePath, metadata) {
    const fileName = path.basename(filePath);
    this.pdfCache.set(filePath, {
      ...metadata,
      fileName,
      createdAt: new Date().toISOString(),
      size: (await fs.stat(filePath)).size
    });
  }

  async createPdfFromTopic(params) {
    const { 
      topic, 
      userId, 
      style = 'academic', 
      includeImages = false,
      pageLayout = 'single-column',
      colorScheme = 'blue'
    } = params;

    if (!topic || !userId) {
      throw new Error('Topic and userId are required to create a PDF.');
    }

    logger.info(`Creating professional PDF for topic: ${topic}`);

    const userMemory = await memoryManager.getUserMemory(userId);
    const language = 'si'; // Always use Sinhala

    // Generate structured study guide in Sinhala

    // Generate content with AI - Always in Sinhala
    const generationPrompt = `Create a comprehensive, well-structured document about "${topic}". 
Style: ${style}
Requirements:
- Include a clear introduction and conclusion
- Use proper headings and subheadings
- Add relevant examples and explanations
- Make it suitable for learning and reference
- Length: comprehensive but focused
- Write entirely in Sinhala language with proper Sinhala grammar and structure
- Use natural Sinhala expressions and terminology
- Avoid mixing English words unless they are commonly accepted technical terms
${includeImages ? '- Indicate where diagrams or images would be helpful with [IMAGE: description]' : ''}

Format the content with markdown-style formatting for better structure.`;

    const rawContent = await geminiClient.generateContent([{ 
      role: 'user', 
      parts: [{ text: generationPrompt }] 
    }]);

    // Enhance content for Sinhala
    const processedContent = await this._processContentWithAI(rawContent, {
      language: 'si', // Always Sinhala
      style,
      enhance: true,
      addStructure: true,
      includeExamples: style !== 'minimal'
    });

    // Convert to HTML
    const htmlContent = this._convertToHtml(processedContent);

    // Get template with Sinhala language
    const template = this._getPdfTemplate({
      title: topic,
      style,
      colorScheme,
      language: 'si', // Always Sinhala
      pageLayout,
      includeHeader: true,
      includeFooter: true
    });

    const currentDate = new Date().toLocaleDateString('si-LK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const finalHtml = template
      .replace('{TITLE}', topic)
      .replace('{SUBTITLE}', 'සම්පූර්ණ අධ්‍යයන මාර්ගෝපදේශය') // Always use Sinhala subtitle
      .replace('{META}', 
        `${userMemory.personalInfo?.name || 'පරිශීලක'} සඳහා සකස් කරන ලදී` // Always use Sinhala meta
      )
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', currentDate);

    // Generate PDF
    const pdfDir = 'data/pdfs';
    await FileUtils.ensureDir(pdfDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${userId.split('@')[0]}-${topic.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await this._generatePdfFromHtml(finalHtml, filePath, {
      format: 'A4',
      orientation: 'portrait',
      printBackground: true,
      margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' }
    });

    // Store content for editing
    const txtFilePath = filePath.replace('.pdf', '.txt');
    await fs.writeFile(txtFilePath, processedContent, 'utf-8');

    // Store metadata with Sinhala language
    await this._storePdfMetadata(filePath, {
      topic,
      userId,
      style,
      language: 'si', // Always Sinhala
      type: 'topic-guide',
      pageLayout,
      colorScheme
    });

    logger.success(`Professional PDF created: ${filePath}`);

    return {
      success: true,
      filePath,
      fileName,
      message: `Professional PDF created for topic "${topic}"`,
      metadata: {
        pages: 'Multiple',
        style,
        language: 'si', // Always Sinhala
        size: (await fs.stat(filePath)).size
      }
    };
  }

  async createStudyGuidePdf(params) {
    const { 
      subject, 
      userId, 
      chapters = 'auto', 
      includeQuizzes = false,
      difficulty = 'intermediate'
    } = params;

    if (!subject || !userId) {
      throw new Error('Subject and userId are required');
    }

    logger.info(`Creating study guide PDF for: ${subject}`);

    const userMemory = await memoryManager.getUserMemory(userId);
    // Always use Sinhala as default language for PDFs
    const language = 'si';

    // Generate structured study guide
    const prompt = `Create a comprehensive study guide for "${subject}".
Difficulty level: ${difficulty}
Requirements:
- Create 6-8 main chapters/sections
- Each chapter should have: introduction, key concepts, detailed explanations, examples
- Include summary points for each chapter
${includeQuizzes ? '- Add 5 practice questions at the end of each chapter' : ''}
- Make it suitable for ${difficulty} level students
- Write entirely in Sinhala language with proper Sinhala grammar and structure
- Use natural Sinhala expressions and terminology
- Avoid mixing English words unless they are commonly accepted technical terms
- Use proper headings and structure
- Include important formulas, definitions, and key points

Format with clear sections and markdown-style formatting.`;

    const content = await geminiClient.generateContent([{ 
      role: 'user', 
      parts: [{ text: prompt }] 
    }]);

    const htmlContent = this._convertToHtml(content);
    const template = this._getPdfTemplate({
      title: subject,
      style: 'academic',
      colorScheme: 'blue',
      language: 'si', // Always Sinhala
      pageLayout: 'single-column'
    });

    const finalHtml = template
      .replace('{TITLE}', subject)
      .replace('{SUBTITLE}', 'අධ්‍යයන මාර්ගෝපදේශය') // Always use Sinhala
      .replace('{META}', `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Level`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    // Generate PDF
    const pdfDir = 'data/pdfs';
    await FileUtils.ensureDir(pdfDir);
    const fileName = `${userId.split('@')[0]}-study-guide-${subject.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await this._generatePdfFromHtml(finalHtml, filePath);
    
    // Store content for editing
    await fs.writeFile(filePath.replace('.pdf', '.txt'), content, 'utf-8');
    
    await this._storePdfMetadata(filePath, {
      subject,
      userId,
      type: 'study-guide',
      difficulty,
      includeQuizzes,
      language: 'si' // Always Sinhala
    });

    return {
      success: true,
      filePath,
      fileName,
      message: `Study guide created for "${subject}"`,
      metadata: { type: 'study-guide', difficulty, includeQuizzes }
    };
  }

  async createCustomPdf(params) {
    const {
      title,
      content,
      userId,
      template = 'article',
      formatting = {}
    } = params;

    if (!title || !content || !userId) {
      throw new Error('Title, content, and userId are required');
    }

    const {
      style = 'professional',
      colorScheme = 'blue',
      pageLayout = 'single-column',
      language = 'si' // Always default to Sinhala
    } = formatting;

    const htmlContent = this._convertToHtml(content);
    const htmlTemplate = this._getPdfTemplate({
      title,
      style,
      colorScheme,
      language,
      pageLayout
    });

    const finalHtml = htmlTemplate
      .replace('{TITLE}', title)
      .replace('{SUBTITLE}', formatting.subtitle || 'Custom Document')
      .replace('{META}', formatting.meta || `Template: ${template}`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    const pdfDir = 'data/pdfs';
    await FileUtils.ensureDir(pdfDir);
    const fileName = `${userId.split('@')[0]}-custom-${title.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await this._generatePdfFromHtml(finalHtml, filePath);
    await fs.writeFile(filePath.replace('.pdf', '.txt'), content, 'utf-8');
    
    await this._storePdfMetadata(filePath, {
      title,
      userId,
      type: 'custom',
      template,
      formatting,
      language
    });

    return {
      success: true,
      filePath,
      fileName,
      message: `Custom PDF "${title}" created successfully`
    };
  }

  async appendToPdf(params) {
    const { 
      filePath, 
      newContent, 
      sectionTitle = 'Additional Content',
      insertPosition = 'end' 
    } = params;

    if (!filePath || !newContent) {
      throw new Error('filePath and newContent are required');
    }

    logger.info(`Appending content to PDF: ${filePath}`);

    const txtFilePath = filePath.replace('.pdf', '.txt');
    let existingContent = '';
    
    try {
      existingContent = await fs.readFile(txtFilePath, 'utf-8');
    } catch (error) {
      throw new Error('Original content file not found');
    }

    // Process new content
    const processedNewContent = await this._processContentWithAI(newContent, {
      enhance: true,
      addStructure: false
    });

    // Combine content based on position
    let combinedContent;
    const sectionHeader = `\n\n# ${sectionTitle}\n\n`;
    
    switch (insertPosition) {
      case 'beginning':
        combinedContent = sectionHeader + processedNewContent + '\n\n---\n\n' + existingContent;
        break;
      case 'end':
      default:
        combinedContent = existingContent + '\n\n---\n\n' + sectionHeader + processedNewContent;
        break;
    }

    // Get existing metadata to maintain formatting
    const metadata = this.pdfCache.get(filePath) || {};
    const htmlContent = this._convertToHtml(combinedContent);
    const template = this._getPdfTemplate({
      title: metadata.topic || metadata.title || 'Updated Document',
      style: metadata.style || 'academic',
      colorScheme: metadata.colorScheme || 'blue',
      language: metadata.language || 'en'
    });

    const finalHtml = template
      .replace('{TITLE}', metadata.topic || metadata.title || 'Updated Document')
      .replace('{SUBTITLE}', 'Updated Version')
      .replace('{META}', `Last updated: ${new Date().toLocaleDateString()}`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    await this._generatePdfFromHtml(finalHtml, filePath);
    await fs.writeFile(txtFilePath, combinedContent, 'utf-8');

    logger.success(`PDF updated successfully: ${filePath}`);

    return {
      success: true,
      filePath,
      message: 'Content appended successfully',
      sectionAdded: sectionTitle
    };
  }

  async insertPdfSection(params) {
    const {
      filePath,
      sectionContent,
      sectionTitle,
      insertAfter,
      insertBefore
    } = params;

    if (!filePath || !sectionContent || !sectionTitle) {
      throw new Error('filePath, sectionContent, and sectionTitle are required');
    }

    const txtFilePath = filePath.replace('.pdf', '.txt');
    let existingContent = '';
    
    try {
      existingContent = await fs.readFile(txtFilePath, 'utf-8');
    } catch (error) {
      throw new Error('Original content file not found');
    }

    const processedContent = await this._processContentWithAI(sectionContent, {
      enhance: true,
      addStructure: false
    });

    const newSection = `\n\n# ${sectionTitle}\n\n${processedContent}\n\n`;
    let updatedContent = existingContent;

    if (insertAfter) {
      const afterIndex = existingContent.indexOf(`# ${insertAfter}`);
      if (afterIndex !== -1) {
        const nextSectionIndex = existingContent.indexOf('\n# ', afterIndex + 1);
        const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : existingContent.length;
        updatedContent = existingContent.slice(0, insertIndex) + newSection + existingContent.slice(insertIndex);
      } else {
        updatedContent = existingContent + newSection;
      }
    } else if (insertBefore) {
      const beforeIndex = existingContent.indexOf(`# ${insertBefore}`);
      if (beforeIndex !== -1) {
        updatedContent = existingContent.slice(0, beforeIndex) + newSection + existingContent.slice(beforeIndex);
      } else {
        updatedContent = existingContent + newSection;
      }
    } else {
      updatedContent = existingContent + newSection;
    }

    // Regenerate PDF
    const metadata = this.pdfCache.get(filePath) || {};
    const htmlContent = this._convertToHtml(updatedContent);
    const template = this._getPdfTemplate({
      title: metadata.topic || metadata.title || 'Document',
      style: metadata.style || 'academic',
      colorScheme: metadata.colorScheme || 'blue',
      language: metadata.language || 'en'
    });

    const finalHtml = template
      .replace('{TITLE}', metadata.topic || metadata.title || 'Document')
      .replace('{SUBTITLE}', 'Updated Version')
      .replace('{META}', `Section added: ${sectionTitle}`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    await this._generatePdfFromHtml(finalHtml, filePath);
    await fs.writeFile(txtFilePath, updatedContent, 'utf-8');

    return {
      success: true,
      filePath,
      message: `Section "${sectionTitle}" inserted successfully`
    };
  }

  async createPdfWithImages(params) {
    const {
      topic,
      userId,
      imageUrls = [],
      imageDescriptions = [],
      layout = 'mixed'
    } = params;

    // This would be enhanced to actually handle images
    // For now, create placeholders where images should go
    const imagePrompt = `Create a comprehensive document about "${topic}" with detailed descriptions for visual content.
Include specific points where diagrams, charts, or images would enhance understanding.
Mark these with [IMAGE: detailed description of what should be shown].`;

    const content = await geminiClient.generateContent([{ 
      role: 'user', 
      parts: [{ text: imagePrompt }] 
    }]);

    // Process image placeholders
    let processedContent = content;
    imageUrls.forEach((url, index) => {
      const description = imageDescriptions[index] || `Image ${index + 1}`;
      processedContent = processedContent.replace(
        `[IMAGE: ${description}]`,
        `<div class="image-placeholder">📊 ${description}<br><small>Image would be displayed here</small></div>`
      );
    });

    const htmlContent = this._convertToHtml(processedContent);
    const template = this._getPdfTemplate({
      title: topic,
      style: 'professional',
      colorScheme: 'blue',
      pageLayout: layout === 'two-column' ? 'two-column' : 'single-column'
    });

    const finalHtml = template
      .replace('{TITLE}', topic)
      .replace('{SUBTITLE}', 'Visual Guide')
      .replace('{META}', `Includes ${imageUrls.length} visual elements`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    const pdfDir = 'data/pdfs';
    await FileUtils.ensureDir(pdfDir);
    const fileName = `${userId.split('@')[0]}-visual-${topic.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await this._generatePdfFromHtml(finalHtml, filePath);
    await fs.writeFile(filePath.replace('.pdf', '.txt'), processedContent, 'utf-8');
    
    await this._storePdfMetadata(filePath, {
      topic,
      userId,
      type: 'visual-guide',
      imageCount: imageUrls.length,
      layout
    });

    return {
      success: true,
      filePath,
      fileName,
      message: `Visual PDF created with ${imageUrls.length} image placeholders`
    };
  }

  async sendPdfToUser(params) {
    const { userId, filePath, fileName, caption } = params;
    
    if (!userId || !filePath) {
      throw new Error('userId and filePath are required');
    }

    try {
      const stats = await fs.stat(filePath);
      const metadata = this.pdfCache.get(filePath);
      
      let finalCaption = caption;
      if (!finalCaption && metadata) {
        finalCaption = `📄 ${metadata.topic || metadata.title || 'Document'}\n` +
                      `📊 Type: ${metadata.type || 'PDF'}\n` +
                      `📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n` +
                      `🗓️ Created: ${new Date(metadata.createdAt).toLocaleDateString()}`;
      }

      logger.info(`Sending PDF ${filePath} to user ${userId}`);
      
      await whatsappClient.sendDocument(
        userId, 
        filePath, 
        fileName || path.basename(filePath),
        finalCaption
      );

      return {
        success: true,
        message: `PDF sent successfully to ${userId}`,
        fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
      };
    } catch (error) {
      throw new Error(`Failed to send PDF: ${error.message}`);
    }
  }

  async getPdfInfo(params) {
    const { filePath } = params;
    
    if (!filePath) {
      throw new Error('filePath is required');
    }

    try {
      const stats = await fs.stat(filePath);
      const metadata = this.pdfCache.get(filePath) || {};

      return {
        success: true,
        info: {
          fileName: path.basename(filePath),
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          created: stats.birthtime,
          modified: stats.mtime,
          metadata
        }
      };
    } catch (error) {
      throw new Error(`Failed to get PDF info: ${error.message}`);
    }
  }

  async listUserPdfs(params) {
    const { userId, sortBy = 'date' } = params;
    
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      const pdfDir = 'data/pdfs';
      const userPrefix = userId.split('@')[0];
      const files = await fs.readdir(pdfDir);
      
      const userPdfs = [];
      
      for (const file of files) {
        if (file.startsWith(userPrefix) && file.endsWith('.pdf')) {
          const filePath = path.join(pdfDir, file);
          const stats = await fs.stat(filePath);
          const metadata = this.pdfCache.get(filePath) || {};
          
          userPdfs.push({
            fileName: file,
            filePath,
            size: stats.size,
            sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
            created: stats.birthtime,
            modified: stats.mtime,
            metadata
          });
        }
      }

              // Sort PDFs
      userPdfs.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.fileName.localeCompare(b.fileName);
          case 'size':
            return b.size - a.size;
          case 'type':
            return (a.metadata.type || '').localeCompare(b.metadata.type || '');
          case 'date':
          default:
            return new Date(b.created) - new Date(a.created);
        }
      });

      return {
        success: true,
        pdfs: userPdfs,
        count: userPdfs.length,
        totalSize: userPdfs.reduce((sum, pdf) => sum + pdf.size, 0)
      };
    } catch (error) {
      throw new Error(`Failed to list PDFs: ${error.message}`);
    }
  }

  async mergePdfs(params) {
    const { 
      pdfPaths, 
      outputName, 
      userId, 
      includeBookmarks = true 
    } = params;

    if (!pdfPaths || !Array.isArray(pdfPaths) || pdfPaths.length < 2) {
      throw new Error('At least 2 PDF paths are required for merging');
    }

    if (!outputName || !userId) {
      throw new Error('outputName and userId are required');
    }

    // For now, we'll create a new PDF with combined content from text files
    logger.info(`Merging ${pdfPaths.length} PDFs for user ${userId}`);

    let combinedContent = '';
    const metadata = [];

    for (const pdfPath of pdfPaths) {
      try {
        const txtPath = pdfPath.replace('.pdf', '.txt');
        const content = await fs.readFile(txtPath, 'utf-8');
        const pdfMetadata = this.pdfCache.get(pdfPath) || {};
        
        combinedContent += `\n\n# ${pdfMetadata.topic || pdfMetadata.title || path.basename(pdfPath, '.pdf')}\n\n`;
        combinedContent += content;
        combinedContent += '\n\n---\n\n';
        
        metadata.push(pdfMetadata);
      } catch (error) {
        logger.warn(`Could not read content from ${pdfPath}: ${error.message}`);
      }
    }

    const htmlContent = this._convertToHtml(combinedContent);
    const template = this._getPdfTemplate({
      title: outputName,
      style: 'professional',
      colorScheme: 'blue',
      language: metadata[0]?.language || 'en'
    });

    const finalHtml = template
      .replace('{TITLE}', outputName)
      .replace('{SUBTITLE}', 'Merged Document')
      .replace('{META}', `Combined from ${pdfPaths.length} documents`)
      .replace('{CONTENT}', htmlContent)
      .replace('{DATE}', new Date().toLocaleDateString());

    const pdfDir = 'data/pdfs';
    await FileUtils.ensureDir(pdfDir);
    const fileName = `${userId.split('@')[0]}-merged-${outputName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    await this._generatePdfFromHtml(finalHtml, filePath);
    await fs.writeFile(filePath.replace('.pdf', '.txt'), combinedContent, 'utf-8');
    
    await this._storePdfMetadata(filePath, {
      title: outputName,
      userId,
      type: 'merged',
      sourceFiles: pdfPaths,
      mergedAt: new Date().toISOString()
    });

    return {
      success: true,
      filePath,
      fileName,
      message: `Successfully merged ${pdfPaths.length} PDFs into "${outputName}"`,
      sourceCount: pdfPaths.length
    };
  }

  // ==================== UTILITY TOOLS ====================

  async generateRandomNumber(params = {}) {
    const { min = 1, max = 100 } = params;
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      number: randomNum,
      range: `${min}-${max}`
    };
  }

  async calculate(params) {
    const { expression } = params;
    
    if (!expression) {
      throw new Error('Mathematical expression is required');
    }

    try {
      // Enhanced calculator with more operations
      const sanitized = expression.replace(/[^0-9+\-*/.()^% ]/g, '');
      
      // Handle basic mathematical functions
      let processedExpression = sanitized
        .replace(/\^/g, '**')  // Power operator
        .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
        .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
        .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
        .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
        .replace(/log\(([^)]+)\)/g, 'Math.log($1)')
        .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');
      
      const result = Function(`"use strict"; return (${processedExpression})`)();
      
      return {
        expression: expression,
        result: result,
        formatted: typeof result === 'number' ? result.toLocaleString() : result
      };
    } catch (error) {
      throw new Error(`Invalid mathematical expression: ${error.message}`);
    }
  }

  async formatText(params) {
    const { text, style } = params;
    
    if (!text) {
      throw new Error('Text is required');
    }

    let formatted;
    switch (style?.toLowerCase()) {
      case 'uppercase':
        formatted = text.toUpperCase();
        break;
      case 'lowercase':
        formatted = text.toLowerCase();
        break;
      case 'title':
        formatted = text.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
      case 'sentence':
        formatted = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        break;
      case 'reverse':
        formatted = text.split('').reverse().join('');
        break;
      case 'clean':
        formatted = text.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
        break;
      case 'slug':
        formatted = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-');
        break;
      default:
        formatted = text;
    }

    return {
      original: text,
      formatted: formatted,
      style: style || 'none',
      length: {
        original: text.length,
        formatted: formatted.length
      }
    };
  }

  // ==================== MESSAGE CONTEXT TOOLS ====================

  async storeOutgoingMessageContext(params) {
    const { userId, contactNumber, context } = params;
    
    if (!userId || !contactNumber || !context) {
      throw new Error('User ID, contact number, and context are required');
    }

    if (!this.outgoingMessageContexts.has(userId)) {
      this.outgoingMessageContexts.set(userId, new Map());
    }

    const userContexts = this.outgoingMessageContexts.get(userId);
    
    // Store context with timestamp
    const contextWithMeta = {
      ...context,
      storedAt: new Date().toISOString(),
      isActive: true // Mark as active until resolved
    };

    if (!userContexts.has(contactNumber)) {
      userContexts.set(contactNumber, []);
    }

    userContexts.get(contactNumber).unshift(contextWithMeta);

    // Keep only last 10 contexts per contact
    if (userContexts.get(contactNumber).length > 10) {
      userContexts.set(contactNumber, userContexts.get(contactNumber).slice(0, 10));
    }

    return {
      success: true,
      message: 'Message context stored successfully'
    };
  }

  async getOutgoingMessageContext(params) {
    const { userId, contactNumber } = params;
    
    if (!userId || !contactNumber) {
      throw new Error('User ID and contact number are required');
    }

    const userContexts = this.outgoingMessageContexts.get(userId);
    if (!userContexts || !userContexts.has(contactNumber)) {
      return [];
    }

    return userContexts.get(contactNumber) || [];
  }

  async checkIncomingMessageContext(params) {
    const { userId, senderNumber, messageText } = params;
    
    if (!userId || !senderNumber || !messageText) {
      throw new Error('User ID, sender number, and message text are required');
    }

    // Format sender number to match stored format
    const formattedSender = senderNumber.replace(/[^\d]/g, '');
    
    const userContexts = this.outgoingMessageContexts.get(userId);
    if (!userContexts) {
      return null;
    }

    // Check all stored numbers for a match
    for (const [storedNumber, contexts] of userContexts.entries()) {
      const cleanStoredNumber = storedNumber.replace(/[^\d]/g, '');
      
      if (cleanStoredNumber === formattedSender || 
          cleanStoredNumber.endsWith(formattedSender) || 
          formattedSender.endsWith(cleanStoredNumber)) {
        
        // Find the most recent active context
        const activeContext = contexts.find(ctx => ctx.isActive);
        
        if (activeContext) {
          // Mark context as resolved
          activeContext.isActive = false;
          activeContext.resolvedAt = new Date().toISOString();
          activeContext.replyReceived = messageText;
          
          return {
            hasContext: true,
            context: activeContext,
            contactName: activeContext.contactName,
            purpose: activeContext.purpose,
            originalMessage: activeContext.message,
            relationship: activeContext.relationship,
            timeSinceSent: Math.floor((Date.now() - new Date(activeContext.timestamp).getTime()) / (1000 * 60)) // minutes
          };
        }
      }
    }

    return {
      hasContext: false,
      message: 'No active outgoing message context found for this sender'
    };
  }
}

// Export singleton instance
export const mcpTools = new MCPTools();