import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../prismaClient';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET all facilities (with optional filtering)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sport_type, city } = req.query;
    
    const facilities = await prisma.facility.findMany({
      where: {
        ...(sport_type && { sport_type: sport_type as string }),
        ...(city && { city: city as string }),
      },
    });

    res.json(facilities);
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET facilities owned by the current manager
router.get('/manager', authenticateToken, requireRole(['MANAGER', 'ADMIN']), async (req: any, res: Response) => {
  try {
    const facilities = await prisma.facility.findMany({
      where: { manager_id: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(facilities);
  } catch (error) {
    console.error('Error fetching manager facilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET a single facility by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, name: true, avatar: true } },
        reviews: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    res.json(facility);
  } catch (error) {
    console.error('Error fetching facility:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a new facility (MANAGER or ADMIN only)
router.post('/', authenticateToken, requireRole(['MANAGER', 'ADMIN']), upload.array('images', 5), async (req: any, res: Response) => {
  try {
    const { name, description, address, city, sport_type, price_per_hour, operating_hours } = req.body;
    
    // Process uploaded files to base64
    const imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const base64String = file.buffer.toString('base64');
        const imageUrl = `data:${file.mimetype};base64,${base64String}`;
        imageUrls.push(imageUrl);
      }
    }

    // Parse integers and JSON from FormData strings
    const parsedPrice = parseInt(price_per_hour, 10);
    const parsedHours = typeof operating_hours === 'string' ? JSON.parse(operating_hours) : operating_hours;

    const newFacility = await prisma.facility.create({
      data: {
        name,
        description,
        address,
        city,
        sport_type,
        price_per_hour: parsedPrice,
        images: imageUrls,
        operating_hours: parsedHours,
        manager_id: req.user.id
      }
    });

    res.status(201).json(newFacility);
  } catch (error) {
    console.error('Error creating facility:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
