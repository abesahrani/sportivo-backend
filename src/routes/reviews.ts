import { Router, Request, Response } from 'express';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router({ mergeParams: true });

// POST create a review for a facility
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id: facility_id } = req.params; // from /api/facilities/:id/reviews
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Optional: check if the user has actually booked and checked into this facility
    const hasCheckedIn = await prisma.booking.findFirst({
      where: {
        user_id: req.user.id,
        facility_id: facility_id,
        check_in_status: true
      }
    });

    if (!hasCheckedIn) {
      return res.status(403).json({ error: 'You can only review facilities you have checked into' });
    }

    const review = await prisma.review.create({
      data: {
        user_id: req.user.id,
        facility_id,
        rating,
        comment
      }
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
