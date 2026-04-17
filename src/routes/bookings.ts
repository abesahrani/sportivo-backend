import { Router, Request, Response } from 'express';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// GET user's bookings (for Activity Tracker)
router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { user_id: req.user.id },
      include: {
        facility: { select: { name: true, address: true, images: true, sport_type: true } },
        participants: { include: { user: { select: { name: true, email: true } } } }
      },
      orderBy: { start_time: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a booking
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const { facility_id, start_time, end_time } = req.body;

    const facility = await prisma.facility.findUnique({ where: { id: facility_id } });
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (durationHours <= 0) {
      return res.status(400).json({ error: 'Invalid time range' });
    }

    // Check availability (very basic check)
    const conflict = await prisma.booking.findFirst({
      where: {
        facility_id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        AND: [
          { start_time: { lt: end } },
          { end_time: { gt: start } }
        ]
      }
    });

    if (conflict) {
      return res.status(400).json({ error: 'Facility is already booked for this time slot' });
    }

    const total_price = facility.price_per_hour * durationHours;

    const newBooking = await prisma.booking.create({
      data: {
        user_id: req.user.id,
        facility_id,
        start_time: start,
        end_time: end,
        total_price,
        status: 'PENDING',
        payment_status: 'UNPAID',
      }
    });

    // Also add the creator as a confirmed participant
    await prisma.bookingParticipant.create({
      data: {
        booking_id: newBooking.id,
        user_id: req.user.id,
        status: 'CONFIRMED'
      }
    });

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST cancel booking
router.post('/:id/cancel', authenticateToken, async (req: any, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });

    res.json(updatedBooking);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST check-in (Digital check-in)
router.post('/:id/checkin', authenticateToken, async (req: any, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Only confirmed bookings can be checked into' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        check_in_status: true,
        check_in_time: new Date()
      }
    });

    res.json({ message: 'Checked in successfully', booking: updatedBooking });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST invite a friend to a booking
router.post('/:id/invite', authenticateToken, async (req: any, res: Response) => {
  try {
    const { email } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Only the organizer can invite others' });

    const friend = await prisma.user.findUnique({ where: { email } });
    if (!friend) return res.status(404).json({ error: 'User with this email not found in Sportivo' });

    const participant = await prisma.bookingParticipant.create({
      data: {
        booking_id: booking.id,
        user_id: friend.id,
        status: 'PENDING'
      }
    });

    res.json({ message: 'Friend invited successfully', participant });
  } catch (error: any) {
    console.error('Error inviting friend:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'User is already invited to this booking' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
