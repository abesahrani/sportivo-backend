import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Configure Multer for memory storage (Serverless safe)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET current user profile
router.get('/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST update avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const base64String = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64String}`;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: imageUrl },
      select: { id: true, name: true, email: true, avatar: true, role: true }
    });

    res.json({ message: 'Avatar updated', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

export default router;
