import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Get all conversations for the current user
router.get('/conversations', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1_id: userId },
          { user2_id: userId }
        ]
      },
      include: {
        user1: { select: { id: true, name: true, avatar: true } },
        user2: { select: { id: true, name: true, avatar: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Format for frontend
    const formatted = conversations.map(conv => {
      const otherUser = conv.user1_id === userId ? conv.user2 : conv.user1;
      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.messages[0] || null,
        updatedAt: conv.updatedAt
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a specific conversation
router.get('/:conversationId/messages', authenticateToken, async (req: any, res: any) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversation_id: req.params.conversationId },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create or get conversation with a specific user
router.post('/conversations', authenticateToken, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (targetUserId === userId) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    // Check if conversation exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: targetUserId },
          { user1_id: targetUserId, user2_id: userId }
        ]
      }
    });

    // If not, create it
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user1_id: userId,
          user2_id: targetUserId
        }
      });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Send a message via REST API (fallback for Vercel Serverless)
router.post('/messages', authenticateToken, async (req: any, res: any) => {
  try {
    const { conversation_id, text } = req.body;
    const sender_id = req.user.id;

    const message = await prisma.message.create({
      data: {
        conversation_id,
        sender_id,
        text
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } }
      }
    });

    // Update conversation timestamp and get receiver's push token
    const conversation = await prisma.conversation.update({
      where: { id: conversation_id },
      data: { updatedAt: new Date() },
      include: {
        user1: { select: { id: true, expoPushToken: true } },
        user2: { select: { id: true, expoPushToken: true } }
      }
    });

    const receiver = conversation.user1.id === sender_id ? conversation.user2 : conversation.user1;

    // Send Push Notification
    if (receiver.expoPushToken) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: receiver.expoPushToken,
            sound: 'default',
            title: `New message from ${message.sender.name}`,
            body: text,
            data: { conversationId: conversation_id },
          }),
        });
      } catch (pushError) {
        console.error('Push notification failed:', pushError);
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
