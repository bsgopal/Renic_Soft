import jwt from 'jsonwebtoken';
import { dbHelper } from '../models/dbHelper.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretrenicsoftkey12345');
    const user = await dbHelper.findById('User', decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    req.user = { ...user, _id: String(user._id) };
    if (user.clientId) req.user.clientId = String(user.clientId);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Role ${req.user?.role} is not authorized to access this resource` });
  }
  next();
};