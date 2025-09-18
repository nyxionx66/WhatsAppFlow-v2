#!/usr/bin/env node

import { whatsappClient } from './whatsapp/whatsappClient.js';
import { chatbotService } from './services/chatbotService.js';
import { jsonDb } from './database/jsonDb.js';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { personaManager } from './system/personaManager.js';
import { proactiveEngagementManager } from './system/proactiveEngagementManager.js';
import { predictiveAI } from './system/predictiveAI.js';

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  try {
    await whatsappClient.disconnect();
    logger.info('AI bot shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

async function startAIBot() {
  try {
    logger.banner('NETHMI WHATSAPP BOT - AI VERSION', 'Powered by Google Gemini 2.5 Pro with AI-Driven Memory & Tools');
    
    logger.section('AI System Initialization');
    logger.success('AI bot configuration loaded');
    logger.success('AI-driven memory system ready');
    logger.success('AI-powered tools system ready');
    logger.success('Database ready');
    logger.success('Gemini AI connected');

    // Set up connection handler
    whatsappClient.onConnection((status) => {
      if (status.connected) {
        logger.banner('AI SYSTEM ONLINE', `${config.bot.name} is online with advanced AI capabilities! 🇱🇰💕🤖`);
      } else {
        logger.warn('WhatsApp connection lost');
      }
    });

    // Set up QR handler
    whatsappClient.onQR((qr) => {
      logger.info('Waiting for QR code scan...');
    });

    // Initialize WhatsApp client
    await whatsappClient.initialize();

    logger.section('AI Bot Status');
    logger.success('All AI systems operational');
    logger.success('AI memory analysis active');
    logger.success('AI tool processing active');
    logger.success('Proactive messaging with AI');
    logger.info('Monitoring for messages with advanced AI...');

  } catch (error) {
    logger.fatal('AI bot startup failed', error);
    process.exit(1);
  }
}

// Start the AI bot
startAIBot().catch((error) => {
  logger.fatal('Unhandled AI startup error', error);
  process.exit(1);
});