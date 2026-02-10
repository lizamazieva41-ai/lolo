import { jest } from '@jest/globals';
import { login, register, refreshToken, logout } from '../controllers/authController';
import { query } from '../config/database';
import { setCache, getCache, deleteCache } from '../config/redis';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../config/redis');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockSetCache = setCache as jest.MockedFunction<typeof setCache>;
const mockGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockDeleteCache = deleteCache as jest.MockedFunction<typeof deleteCache>;

describe('Auth Controller', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword'
      };

      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockQuery.mockResolvedValueOnce({ rows: [user] });
      mockSetCache.mockResolvedValueOnce(undefined);

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      // Mock jwt.sign
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'sign')
        .mockReturnValueOnce('access_token')
        .mockReturnValueOnce('refresh_token');

      await login(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: {
          id: 1,
          email: 'test@example.com'
        }
      });
    });

    it('should return 400 if email or password missing', async () => {
      mockReq.body = { email: 'test@example.com' };

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Email and password are required'
      });
    });

    it('should return 401 for invalid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid credentials'
      });
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      mockReq.body = {
        email: 'new@example.com',
        password: 'password123',
        phone: '+85512345678'
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'new@example.com' }] }); // Insert user

      // Mock bcrypt.hash
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('$2a$12$hashedpassword');

      await register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
        user: {
          id: 1,
          email: 'new@example.com'
        }
      });
    });

    it('should return 409 if user already exists', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'password123'
      };

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User already exists'
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockReq.body = { refreshToken: 'valid_refresh_token' };

      mockGetCache.mockResolvedValueOnce('valid_refresh_token');

      // Mock jwt.verify and jwt.sign
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValueOnce({ userId: 1 });
      jest.spyOn(jwt, 'sign').mockReturnValueOnce('new_access_token');

      await refreshToken(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        accessToken: 'new_access_token'
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      mockReq.body = { refreshToken: 'invalid_token' };

      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token'
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      mockReq.body = { userId: 1 };

      mockDeleteCache.mockResolvedValueOnce(1);

      await logout(mockReq, mockRes);

      expect(mockDeleteCache).toHaveBeenCalledWith('refresh_token:1');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });
    });
  });
});
