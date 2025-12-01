const express = require('express');
const crypto = require('crypto');
const { ShopsRepo, BarbersRepo, MirrorsRepo } = require('../db/repositories');
const { generateToken, authMiddleware, requireAdmin, ROLES } = require('./middleware');

const router = express.Router();

function hashPin(pin) {
    return crypto.createHash('sha256').update(pin).digest('hex');
}

router.post('/login', async (req, res) => {
    try {
        const { shop_slug, email, pin } = req.body;
        
        if (!shop_slug || !pin) {
            return res.status(400).json({ success: false, error: 'Shop and PIN required' });
        }
        
        const shop = await ShopsRepo.getBySlug(shop_slug);
        if (!shop || !shop.is_active) {
            return res.status(404).json({ success: false, error: 'Shop not found' });
        }
        
        const barber = await BarbersRepo.getByPinCode(shop.id, pin);
        if (!barber) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const token = generateToken({
            barber_id: barber.id,
            shop_id: shop.id,
            name: barber.name,
            role: barber.role
        });
        
        res.json({
            success: true,
            token,
            user: {
                id: barber.id,
                name: barber.name,
                role: barber.role,
                shop_id: shop.id,
                shop_name: shop.name
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

router.post('/login/email', async (req, res) => {
    try {
        const { shop_slug, email, password } = req.body;
        
        if (!shop_slug || !email) {
            return res.status(400).json({ success: false, error: 'Shop and email required' });
        }
        
        const shop = await ShopsRepo.getBySlug(shop_slug);
        if (!shop || !shop.is_active) {
            return res.status(404).json({ success: false, error: 'Shop not found' });
        }
        
        const barber = await BarbersRepo.getByEmail(shop.id, email);
        if (!barber || !barber.is_active) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        const token = generateToken({
            barber_id: barber.id,
            shop_id: shop.id,
            name: barber.name,
            role: barber.role
        });
        
        res.json({
            success: true,
            token,
            user: {
                id: barber.id,
                name: barber.name,
                role: barber.role,
                shop_id: shop.id,
                shop_name: shop.name
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const barber = await BarbersRepo.getById(req.auth.barber_id);
        const shop = await ShopsRepo.getById(req.auth.shop_id);
        
        if (!barber || !shop) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({
            success: true,
            user: {
                id: barber.id,
                name: barber.name,
                email: barber.email,
                role: barber.role,
                color: barber.color,
                shop_id: shop.id,
                shop_name: shop.name
            }
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

router.post('/mirror/register', async (req, res) => {
    try {
        const { registration_code, device_uid } = req.body;
        
        if (!registration_code || !device_uid) {
            return res.status(400).json({ success: false, error: 'Registration code and device UID required' });
        }
        
        const mirror = await MirrorsRepo.getByRegistrationCode(registration_code);
        if (!mirror) {
            return res.status(404).json({ success: false, error: 'Invalid or expired registration code' });
        }
        
        const registered = await MirrorsRepo.registerDevice(registration_code, device_uid);
        if (!registered) {
            return res.status(500).json({ success: false, error: 'Registration failed' });
        }
        
        const shop = await ShopsRepo.getById(registered.shop_id);
        
        res.json({
            success: true,
            mirror: {
                id: registered.id,
                label: registered.label,
                shop_id: registered.shop_id,
                shop_name: shop.name
            },
            device_token: registered.device_token
        });
    } catch (err) {
        console.error('Mirror registration error:', err);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

router.post('/mirror/heartbeat', async (req, res) => {
    try {
        const { device_uid } = req.body;
        
        if (!device_uid) {
            return res.status(400).json({ success: false, error: 'Device UID required' });
        }
        
        const mirror = await MirrorsRepo.heartbeat(device_uid);
        if (!mirror) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ success: false, error: 'Heartbeat failed' });
    }
});

router.post('/barbers', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, email, phone, pin_code, role, color } = req.body;
        
        if (!name || !pin_code) {
            return res.status(400).json({ success: false, error: 'Name and PIN required' });
        }
        
        const barber = await BarbersRepo.create({
            shop_id: req.auth.shop_id,
            name,
            email,
            phone,
            pin_code,
            role: role || ROLES.BARBER,
            color
        });
        
        res.json({ success: true, barber });
    } catch (err) {
        console.error('Create barber error:', err);
        if (err.code === '23505') {
            res.status(409).json({ success: false, error: 'Email or PIN already in use' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to create barber' });
        }
    }
});

router.get('/barbers', authMiddleware, async (req, res) => {
    try {
        const barbers = await BarbersRepo.getByShop(req.auth.shop_id);
        res.json({ success: true, barbers });
    } catch (err) {
        console.error('Get barbers error:', err);
        res.status(500).json({ success: false, error: 'Failed to get barbers' });
    }
});

router.put('/barbers/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const barber = await BarbersRepo.getById(id);
        
        if (!barber || barber.shop_id !== req.auth.shop_id) {
            return res.status(404).json({ success: false, error: 'Barber not found' });
        }
        
        const updated = await BarbersRepo.update(id, req.body);
        res.json({ success: true, barber: updated });
    } catch (err) {
        console.error('Update barber error:', err);
        res.status(500).json({ success: false, error: 'Failed to update barber' });
    }
});

router.delete('/barbers/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const barber = await BarbersRepo.getById(id);
        
        if (!barber || barber.shop_id !== req.auth.shop_id) {
            return res.status(404).json({ success: false, error: 'Barber not found' });
        }
        
        if (barber.id === req.auth.barber_id) {
            return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        }
        
        await BarbersRepo.delete(id);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete barber error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete barber' });
    }
});

router.post('/barbers/:id/clock-in', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { mirror_id } = req.body;
        
        if (parseInt(id) !== req.auth.barber_id && req.auth.role !== ROLES.ADMIN) {
            return res.status(403).json({ success: false, error: 'Cannot clock in for another barber' });
        }
        
        const session = await BarbersRepo.clockIn(id, mirror_id);
        res.json({ success: true, session });
    } catch (err) {
        console.error('Clock in error:', err);
        res.status(500).json({ success: false, error: 'Failed to clock in' });
    }
});

router.post('/barbers/:id/clock-out', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (parseInt(id) !== req.auth.barber_id && req.auth.role !== ROLES.ADMIN) {
            return res.status(403).json({ success: false, error: 'Cannot clock out for another barber' });
        }
        
        const session = await BarbersRepo.clockOut(id);
        res.json({ success: true, session });
    } catch (err) {
        console.error('Clock out error:', err);
        res.status(500).json({ success: false, error: 'Failed to clock out' });
    }
});

router.get('/shops', async (req, res) => {
    try {
        const shops = await ShopsRepo.getAll();
        res.json({
            success: true,
            shops: shops.map(s => ({ id: s.id, name: s.name, slug: s.slug }))
        });
    } catch (err) {
        console.error('Get shops error:', err);
        res.status(500).json({ success: false, error: 'Failed to get shops' });
    }
});

router.get('/shop', authMiddleware, async (req, res) => {
    try {
        const shop = await ShopsRepo.getById(req.auth.shop_id);
        if (!shop) {
            return res.status(404).json({ success: false, error: 'Shop not found' });
        }
        res.json({ success: true, shop });
    } catch (err) {
        console.error('Get shop error:', err);
        res.status(500).json({ success: false, error: 'Failed to get shop' });
    }
});

router.put('/shop', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const shop = await ShopsRepo.update(req.auth.shop_id, req.body);
        res.json({ success: true, shop });
    } catch (err) {
        console.error('Update shop error:', err);
        res.status(500).json({ success: false, error: 'Failed to update shop' });
    }
});

router.get('/mirrors', authMiddleware, async (req, res) => {
    try {
        const mirrors = await MirrorsRepo.getByShop(req.auth.shop_id);
        res.json({ success: true, mirrors });
    } catch (err) {
        console.error('Get mirrors error:', err);
        res.status(500).json({ success: false, error: 'Failed to get mirrors' });
    }
});

router.post('/mirrors', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { label } = req.body;
        
        if (!label) {
            return res.status(400).json({ success: false, error: 'Label required' });
        }
        
        const mirror = await MirrorsRepo.create({
            shop_id: req.auth.shop_id,
            label
        });
        
        const withCode = await MirrorsRepo.generateRegistrationCode(mirror.id);
        
        res.json({ success: true, mirror: withCode });
    } catch (err) {
        console.error('Create mirror error:', err);
        res.status(500).json({ success: false, error: 'Failed to create mirror' });
    }
});

router.post('/mirrors/:id/regenerate-code', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const mirror = await MirrorsRepo.getById(id);
        
        if (!mirror || mirror.shop_id !== req.auth.shop_id) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        const updated = await MirrorsRepo.generateRegistrationCode(id);
        res.json({ success: true, mirror: updated });
    } catch (err) {
        console.error('Regenerate code error:', err);
        res.status(500).json({ success: false, error: 'Failed to regenerate code' });
    }
});

router.put('/mirrors/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const mirror = await MirrorsRepo.getById(id);
        
        if (!mirror || mirror.shop_id !== req.auth.shop_id) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        const updated = await MirrorsRepo.update(id, req.body);
        res.json({ success: true, mirror: updated });
    } catch (err) {
        console.error('Update mirror error:', err);
        res.status(500).json({ success: false, error: 'Failed to update mirror' });
    }
});

router.delete('/mirrors/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const mirror = await MirrorsRepo.getById(id);
        
        if (!mirror || mirror.shop_id !== req.auth.shop_id) {
            return res.status(404).json({ success: false, error: 'Mirror not found' });
        }
        
        await MirrorsRepo.delete(id);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete mirror error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete mirror' });
    }
});

module.exports = router;
