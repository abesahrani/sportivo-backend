import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import facilityRoutes from './routes/facilities';
import bookingRoutes from './routes/bookings';
import paymentRoutes from './routes/payments';
import reviewRoutes from './routes/reviews';
import postRoutes from './routes/posts';
import userRoutes from './routes/users';
import chatRoutes from './routes/chat';
import http from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve the uploads directory statically so frontend can access images
app.use('/uploads', express.static('uploads'));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sportivo API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/facilities/:id/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_chat', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their personal room`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversation_id, sender_id, receiver_id, text } = data;
      
      // Save message to DB
      const message = await prisma.message.create({
        data: {
          conversation_id,
          sender_id,
          text,
        },
        include: { sender: { select: { id: true, name: true, avatar: true } } }
      });

      // Emit to receiver's personal room
      io.to(receiver_id).emit('receive_message', message);
      // Emit to sender's personal room (for multi-device sync)
      io.to(sender_id).emit('receive_message', message);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;
