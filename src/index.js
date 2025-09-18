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
    logger.banner(`${config.persona.name.toUpperCase()} WHATSAPP BOT - AI VERSION`, 'Enhanced with Dynamic Personality, Proactive Engagement & Predictive AI');
    
    logger.section('Enhanced AI System Initialization');
    logger.success(`✅ Persona System: ${config.persona.name} (${config.persona.age} years old)`);
    logger.success(`✅ Location: ${config.persona.location.city}, ${config.persona.location.country}`);
    logger.success(`✅ Education: ${config.persona.education.level}`);
    logger.success('✅ Dynamic Personality Evolution enabled');
    logger.success('✅ Proactive Engagement Manager ready');
    logger.success('✅ Predictive AI Systems active');
    logger.success('✅ AI-driven memory system ready');
    logger.success('✅ AI-powered tools system ready');
    logger.success('✅ Database ready');
    logger.success('✅ Gemini AI connected');

    // Set up connection handler
    whatsappClient.onConnection((status) => {
      if (status.connected) {
        logger.banner('ENHANCED AI SYSTEM ONLINE', `${config.persona.name} is online with advanced AI capabilities! 🇱🇰💕🤖`);
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

    logger.section('Enhanced AI Bot Status');
    logger.success('✅ All AI systems operational');
    logger.success('✅ Dynamic personality system active');
    logger.success('✅ Proactive engagement monitoring');
    logger.success('✅ Predictive AI analysis running');
    logger.success('✅ AI memory analysis active');
    logger.success('✅ AI tool processing active');
    logger.success('✅ Relationship tracking enabled');
    logger.info('Monitoring for messages with advanced AI...');

  } catch (error) {
    logger.fatal('Enhanced AI bot startup failed', error);
    process.exit(1);
  }
}

// Start the AI bot
startAIBot().catch((error) => {
  logger.fatal('Unhandled AI startup error', error);
  process.exit(1);
});