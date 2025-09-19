import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { config } from '../config/config.js';
import { FileUtils } from '../utils/fileUtils.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('WhatsAppClient');

export class WhatsAppClient {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.qrAttempts = 0;
    this.maxQrAttempts = 10; // Allow up to 10 QR code generations
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.qrHandlers = [];
    this.isRestarting = false;
  }

  /**
   * Initialize WhatsApp client with session management
   */
  async initialize() {
    try {
      // Ensure session directory exists
      await FileUtils.ensureDir(config.paths.sessionDir);
      
      logger.info('Setting up session management...');

      // Create auth state for session persistence with retry logic
      const authState = await this.createAuthState();
      
      const { state, saveCreds } = authState;
      
      // Get Baileys version
      const { version, isLatest } = await this.getBaileysVersion();
      
      logger.info(`Using Baileys version: ${version.join('.')} ${isLatest ? '(latest)' : '(outdated)'}`);

      // Create a minimal logger for Baileys to reduce verbosity
      const baileysLogger = {
        fatal: (msg) => logger.error('Baileys Fatal:', msg),
        error: (msg) => logger.error('Baileys Error:', msg),
        warn: () => {}, // Suppress warnings
        info: () => {}, // Suppress info
        debug: () => {}, // Suppress debug
        trace: () => {}, // Suppress trace
        child: () => baileysLogger, // Return same logger for child calls
        silent: () => {} // Silent method
      };

      // Create WhatsApp socket
      this.sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        version,
        printQRInTerminal: false, // We'll handle QR display ourselves
        logger: baileysLogger, // Use minimal logger
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        fireInitQueries: true,
        emitOwnEvents: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        maxMsgRetryCount: 5,
        getMessage: async (key) => {
          return undefined;
        }
      });

      // Set up event handlers
      this.setupEventHandlers(saveCreds);

      // Reset reconnect attempts on successful initialization
      this.reconnectAttempts = 0;

      logger.success('WhatsApp client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  /**
   * Create auth state with proper error handling
   */
  async createAuthState() {
    try {
      // Check if session directory has files
      const fs = await import('fs');
      const files = await fs.promises.readdir(config.paths.sessionDir).catch(() => []);
      
      if (files.length === 0) {
        logger.info('No existing session found, will show QR code for pairing');
      } else {
        logger.info(`Found existing session files: ${files.length} files`);
      }

      return await useMultiFileAuthState(config.paths.sessionDir);
    } catch (error) {
      logger.error('Failed to create auth state, session might be corrupted:', error);
      // We are not clearing the session here to allow for manual intervention.
      // If the bot fails to start, the user may need to clear the session directory manually.
      throw new Error(`Failed to create auth state: ${error.message}. Session files may be corrupt.`);
    }
  }

  /**
   * Get Baileys version with fallback
   */
  async getBaileysVersion() {
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      return {
        version: versionInfo.version,
        isLatest: versionInfo.isLatest
      };
    } catch (error) {
      logger.warn('Could not fetch latest version, using default');
      return {
        version: [2, 3000, 1023223821],
        isLatest: false
      };
    }
  }

  /**
   * Set up event handlers for WhatsApp socket
   */
  setupEventHandlers(saveCreds) {
    // Connection updates
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('→ Waiting for QR code scan...');
        qrcode.generate(qr, { small: true });
        
        // Notify QR handlers
        this.qrHandlers.forEach(handler => {
          try {
            handler(qr);
          } catch (error) {
            logger.error('Error in QR handler:', error);
          }
        });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const reasonText = this.getDisconnectReason(reason);
        
        logger.warn(`Connection closed: ${reasonText}`);
        this.isConnected = false;
        
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        // Handle specific error codes
        if (reason === 515) {
          // Stream error - immediate restart required
          logger.info('Stream error detected, restarting immediately...');
          if (!this.isRestarting) {
            this.isRestarting = true;
            setTimeout(async () => {
              try {
                await this.initialize();
                this.isRestarting = false;
              } catch (error) {
                logger.error('Failed to restart after stream error:', error);
                this.isRestarting = false;
              }
            }, 2000); // Short delay before restart
          }
          return;
        }

        if (reason === DisconnectReason.restartRequired) {
          logger.info('Restart required after pairing, restarting connection...');
          if (!this.isRestarting) {
            this.isRestarting = true;
            setTimeout(async () => {
              try {
                await this.initialize();
                this.isRestarting = false;
              } catch (error) {
                logger.error('Failed to restart after pairing:', error);
                this.isRestarting = false;
              }
            }, 3000); // Slightly longer delay after pairing
          }
          return;
        }

        // Handle QR timeout/expiry - generate new QR
        if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.timedOut) {
          this.qrAttempts++;
          if (this.qrAttempts <= this.maxQrAttempts) {
            logger.info(`QR code expired, generating new QR code... (${this.qrAttempts}/${this.maxQrAttempts})`);
            if (!this.isRestarting) {
              this.isRestarting = true;
              this.reconnectAttempts = 0; // Reset attempts for QR regeneration
              setTimeout(async () => {
                try {
                  await this.initialize();
                  this.isRestarting = false;
                } catch (error) {
                  logger.error('Failed to regenerate QR code:', error);
                  this.isRestarting = false;
                }
              }, 2000);
            }
          } else {
            logger.warn('Maximum QR generation attempts reached. Please restart the application.');
          }
          return;
        }

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && !this.isRestarting) {
          this.reconnectAttempts++;
          const delayTime = Math.min(10000 * this.reconnectAttempts, 60000); // Max 1 minute delay
          
          logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delayTime/1000} seconds...`);
          
          setTimeout(async () => {
            try {
              await this.initialize();
            } catch (error) {
              logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
            }
          }, delayTime);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max reconnection attempts reached. Manual intervention required.');
        } else if (reason === DisconnectReason.loggedOut) {
          logger.warn('Logged out - manual reconnection required');
        }

        // Notify connection handlers
        this.connectionHandlers.forEach(handler => {
          try {
            handler({ connected: false, reason: lastDisconnect?.error });
          } catch (error) {
            logger.error('Error in connection handler:', error);
          }
        });
      } else if (connection === 'open') {
        logger.success('WhatsApp is now online and ready!');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset on successful connection
        this.qrAttempts = 0; // Reset QR attempts on successful connection
        this.isRestarting = false; // Reset restart flag

        // Notify connection handlers
        this.connectionHandlers.forEach(handler => {
          try {
            handler({ connected: true });
          } catch (error) {
            logger.error('Error in connection handler:', error);
          }
        });
      }
    });

    // Save credentials when updated
    this.sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (error) {
        logger.error('Failed to save credentials:', error);
      }
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async (m) => {
      const messages = m.messages;
      
      for (const message of messages) {
        // Skip if message is from status broadcast or if it's our own message
        if (message.key.remoteJid === 'status@broadcast' || message.key.fromMe) {
          continue;
        }

        // Extract message info
        const messageInfo = this.extractMessageInfo(message);
        
        if (messageInfo) {
          // Notify message handlers
          this.messageHandlers.forEach(handler => {
            try {
              handler(messageInfo);
            } catch (error) {
              logger.error('Error in message handler:', error);
            }
          });
        }
      }
    });
  }

  /**
   * Get human-readable disconnect reason
   */
  getDisconnectReason(statusCode) {
    const reasons = {
      [DisconnectReason.badSession]: 'Bad session file',
      [DisconnectReason.connectionClosed]: 'Connection closed',
      [DisconnectReason.connectionLost]: 'Connection lost',
      [DisconnectReason.connectionReplaced]: 'Connection replaced',
      [DisconnectReason.loggedOut]: 'Logged out',
      [DisconnectReason.restartRequired]: 'Restart required',
      [DisconnectReason.timedOut]: 'Connection timed out',
      [DisconnectReason.multideviceMismatch]: 'Multi-device mismatch',
      515: 'Stream error'
    };
    
    return reasons[statusCode] || `Unknown (${statusCode})`;
  }

  /**
   * Extract relevant information from WhatsApp message
   */
  extractMessageInfo(message) {
    try {
      const messageType = Object.keys(message.message || {})[0];
      let text = '';
      let quotedMessage = null;
      
      // Extract text based on message type
      switch (messageType) {
        case 'conversation':
          text = message.message.conversation;
          break;
        case 'extendedTextMessage':
          text = message.message.extendedTextMessage.text;
          // Check for quoted message (reply)
          if (message.message.extendedTextMessage.contextInfo?.quotedMessage) {
            quotedMessage = this.extractQuotedMessage(message.message.extendedTextMessage.contextInfo);
          }
          break;
        case 'imageMessage':
          text = message.message.imageMessage.caption || '[Image]';
          break;
        case 'videoMessage':
          text = message.message.videoMessage.caption || '[Video]';
          break;
        case 'documentMessage':
          text = message.message.documentMessage.caption || '[Document]';
          break;
        default:
          text = `[${messageType || 'Unknown message type'}]`;
      }

      if (!text || text.trim().length === 0) {
        return null;
      }

      return {
        id: message.key.id,
        sender: message.key.remoteJid,
        senderName: message.pushName || 'Unknown',
        text: text.trim(),
        timestamp: message.messageTimestamp,
        messageType,
        isGroup: message.key.remoteJid.endsWith('@g.us'),
        quotedMessage: quotedMessage,
        hasQuote: !!quotedMessage,
        raw: message
      };
    } catch (error) {
      logger.error('Error extracting message info:', error);
      return null;
    }
  }

  /**
   * Extract quoted message information
   */
  extractQuotedMessage(contextInfo) {
    try {
      const quotedMsg = contextInfo.quotedMessage;
      const participant = contextInfo.participant;
      
      if (!quotedMsg) return null;
      
      let quotedText = '';
      const quotedType = Object.keys(quotedMsg)[0];
      
      switch (quotedType) {
        case 'conversation':
          quotedText = quotedMsg.conversation;
          break;
        case 'extendedTextMessage':
          quotedText = quotedMsg.extendedTextMessage.text;
          break;
        case 'imageMessage':
          quotedText = quotedMsg.imageMessage.caption || '[Image]';
          break;
        case 'videoMessage':
          quotedText = quotedMsg.videoMessage.caption || '[Video]';
          break;
        default:
          quotedText = `[${quotedType}]`;
      }
      
      return {
        text: quotedText,
        sender: participant,
        messageType: quotedType,
        isFromBot: participant === undefined || participant === this.sock?.user?.id
      };
    } catch (error) {
      logger.debug('Error extracting quoted message:', error);
      return null;
    }
  }
  /**
   * Send a text message
   */
  async sendMessage(jid, text) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      await this.sock.sendMessage(jid, { text });
    } catch (error) {
      logger.error(`Failed to send message to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Send a document
   */
  async sendDocument(jid, filePath, fileName) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      const message = {
        document: { url: filePath },
        mimetype: 'application/pdf',
        fileName: fileName || 'document.pdf'
      };
      await this.sock.sendMessage(jid, message);
    } catch (error) {
      logger.error(`Failed to send document to ${jid}:`, error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(jid, messageId) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      await this.sock.sendMessage(jid, { delete: { id: messageId, remoteJid: jid, fromMe: true } });
    } catch (error) {
      logger.error(`Failed to delete message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get chat information
   */
  async getChatInfo(jid) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      const chat = await this.sock.chatRead(jid);
      return {
        jid: jid,
        name: chat.name || 'Unknown',
        isGroup: jid.endsWith('@g.us'),
        lastMessageTime: chat.conversationTimestamp,
        unreadCount: chat.unreadCount || 0
      };
    } catch (error) {
      logger.error(`Failed to get chat info for ${jid}:`, error);
      return {
        jid: jid,
        name: 'Unknown',
        isGroup: jid.endsWith('@g.us'),
        error: error.message
      };
    }
  }

  /**
   * Mark message as read (seen)
   */
  async markAsRead(jid, messageId) {
    if (!this.isConnected || !this.sock) {
      return;
    }

    try {
      await this.sock.readMessages([{
        remoteJid: jid,
        id: messageId,
        participant: undefined
      }]);
    } catch (error) {
      // Silently fail for read receipts
      logger.debug(`Failed to mark message as read: ${error.message}`);
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(jid, isTyping = true) {
    if (!this.isConnected || !this.sock) {
      return;
    }

    try {
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch (error) {
      // Silently fail for typing indicators
    }
  }

  /**
   * Register message handler
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Register connection handler
   */
  onConnection(handler) {
    this.connectionHandlers.push(handler);
  }

  /**
   * Register QR code handler
   */
  onQR(handler) {
    this.qrHandlers.push(handler);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      hasSocket: !!this.sock,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isRestarting: this.isRestarting
    };
  }

  /**
   * Gracefully disconnect
   */
  async disconnect() {
    if (this.sock) {
      // No need to logout. This invalidates the session.
      // The socket will be closed automatically when the process exits.
      logger.success('WhatsApp client disconnected');
      this.sock = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const whatsappClient = new WhatsAppClient();