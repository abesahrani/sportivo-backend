import { Router, Request, Response } from 'express';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// POST mock charge endpoint
router.post('/charge', authenticateToken, async (req: any, res: Response) => {
  try {
    const { booking_id } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: booking_id } });
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    // Mock Midtrans successful response
    // In a real app, we would call Midtrans API to get a Snap Token or charge response
    const mockPaymentResponse = {
      transaction_id: `mock-txn-${Date.now()}`,
      order_id: booking.id,
      gross_amount: booking.total_price,
      payment_type: 'bank_transfer',
      transaction_status: 'settlement', // Automatically settling for test
      status_code: '200'
    };

    // Since we mock auto-settlement, let's update the booking status directly
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        payment_status: 'PAID',
        status: 'CONFIRMED'
      }
    });

    res.json({
      message: 'Payment mock successful',
      payment_response: mockPaymentResponse,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST webhook from payment gateway (Midtrans usually hits this)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { order_id, transaction_status } = req.body;

    if (!order_id) return res.status(400).json({ error: 'Order ID is missing' });

    // Assuming order_id is the booking ID
    const booking = await prisma.booking.findUnique({ where: { id: order_id } });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      await prisma.booking.update({
        where: { id: order_id },
        data: { payment_status: 'PAID', status: 'CONFIRMED' }
      });
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      await prisma.booking.update({
        where: { id: order_id },
        data: { payment_status: 'UNPAID', status: 'CANCELLED' }
      });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
