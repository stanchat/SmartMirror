const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d';

const ROLES = {
    ADMIN: 'admin',
    BARBER: 'barber'
};

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    
    req.auth = decoded;
    next();
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.auth = decoded;
        }
    }
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        
        if (!roles.includes(req.auth.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        
        next();
    };
}

function requireAdmin(req, res, next) {
    if (!req.auth) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    if (req.auth.role !== ROLES.ADMIN) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    next();
}

function requireShopAccess(req, res, next) {
    if (!req.auth) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const shopId = parseInt(req.params.shopId || req.body.shop_id || req.query.shop_id);
    
    if (shopId && req.auth.shop_id !== shopId) {
        return res.status(403).json({ success: false, error: 'Access denied to this shop' });
    }
    
    next();
}

function mirrorAuth(req, res, next) {
    const deviceToken = req.headers['x-device-token'];
    const deviceUid = req.headers['x-device-uid'];
    
    if (!deviceToken || !deviceUid) {
        return res.status(401).json({ success: false, error: 'Mirror authentication required' });
    }
    
    req.mirror = { deviceToken, deviceUid };
    next();
}

module.exports = {
    JWT_SECRET,
    ROLES,
    generateToken,
    verifyToken,
    authMiddleware,
    optionalAuth,
    requireRole,
    requireAdmin,
    requireShopAccess,
    mirrorAuth
};
