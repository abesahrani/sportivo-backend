import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

// Use memory storage for Vercel serverless compatibility
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET all community posts (Requires auth to check if user liked it)
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { comments: true } },
        postLikes: {
          where: { user_id: req.user.id }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Format to match frontend expectations
    const formattedPosts = posts.map((post: any) => ({
      id: post.id,
      user_id: post.user.id,
      user: post.user.name,
      avatar: post.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.name)}&background=random`, // fallback
      image: post.image_url,
      caption: post.caption,
      likes: post.likes,
      hasLiked: post.postLikes.length > 0,
      comments: post._count.comments
    }));

    res.json(formattedPosts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST a new community post (Requires Authentication)
router.post('/', authenticateToken, upload.single('image'), async (req: any, res: any) => {
  try {
    const { caption } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Convert file buffer to Base64 string for database storage (Vercel serverless friendly MVP solution)
    const base64String = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64String}`;

    const newPost = await prisma.post.create({
      data: {
        user_id: userId,
        image_url: imageUrl,
        caption: caption
      },
      include: {
        user: { select: { name: true, avatar: true } }
      }
    });

    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// DELETE a post
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST toggle like
router.post('/:id/like', authenticateToken, async (req: any, res: any) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const existingLike = await prisma.postLike.findUnique({
      where: { post_id_user_id: { post_id: postId, user_id: userId } }
    });

    if (existingLike) {
      // Unlike
      await prisma.postLike.delete({ where: { id: existingLike.id } });
      await prisma.post.update({ where: { id: postId }, data: { likes: { decrement: 1 } } });
      res.json({ liked: false });
    } else {
      // Like
      await prisma.postLike.create({ data: { post_id: postId, user_id: userId } });
      await prisma.post.update({ where: { id: postId }, data: { likes: { increment: 1 } } });
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST add comment
router.post('/:id/comments', authenticateToken, async (req: any, res: any) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text is required' });

    const comment = await prisma.comment.create({
      data: {
        text,
        post_id: req.params.id,
        user_id: req.user.id
      },
      include: {
        user: { select: { name: true, avatar: true } }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET post comments
router.get('/:id/comments', authenticateToken, async (req: any, res: any) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { post_id: req.params.id },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedComments = comments.map((c: any) => ({
      id: c.id,
      text: c.text,
      user: c.user.name,
      avatar: c.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user.name)}&background=random`,
      createdAt: c.createdAt
    }));

    res.json(formattedComments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

export default router;
