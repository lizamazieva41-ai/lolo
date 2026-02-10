import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { query } from '../config/database';
import { setCache, getCache, deleteCache } from '../config/redis';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  phone?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Query user from database
    const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0] as { id: number; email: string; password_hash: string };

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    ) as string;

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET as Secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as SignOptions
    ) as string;

    // Store refresh token in Redis
    await setCache(`refresh_token:${user.id}`, refreshToken, 60 * 60 * 24 * 7); // 7 days

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, phone }: RegisterRequest = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user
    const result = await query(
      'INSERT INTO users (email, password_hash, phone, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email',
      [email, passwordHash, phone]
    );

    const user = result.rows[0] as { id: number; email: string; password_hash: string };

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET as Secret) as { userId: number };

    // Check if refresh token exists in Redis
    const storedToken = await getCache(`refresh_token:${decoded.userId}`);

    if (!storedToken || storedToken !== refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    ) as string;

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // Note: In a real implementation, you'd get userId from JWT
    // For simplicity, assuming it's passed in body or from auth middleware
    const { userId } = req.body;

    if (userId) {
      await deleteCache(`refresh_token:${userId}`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
