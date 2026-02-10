# Cellcard eSIM Exploitation Platform

Nền tảng web/API khai thác lỗ hổng bảo mật trong hệ thống Cellcard để cho phép mua và quản lý eSIM mà không cần ứng dụng di động chính thức.

## Tổng quan

Dự án này triển khai kế hoạch khai thác các lỗ hổng bảo mật đã được xác định trong ứng dụng Cellcard, tập trung vào việc mô phỏng quy trình xác thực và chặn giao tiếp API để cung cấp dịch vụ eSIM độc lập.

## Tính năng

- **Xác thực người dùng**: Hệ thống JWT-based authentication
- **Quản lý gói eSIM**: Liệt kê và mua các gói dữ liệu
- **Kích hoạt eSIM**: Tạo mã LPA và mã QR cho cài đặt eSIM
- **API RESTful**: Endpoints toàn diện cho tích hợp
- **Giám sát**: Logging và monitoring tích hợp

## Cài đặt

### Yêu cầu hệ thống

- Node.js >= 18.0.0
- PostgreSQL >= 15
- Redis >= 7
- npm hoặc yarn

### Cài đặt dependencies

```bash
npm install
```

### Cấu hình môi trường

Tạo file `.env` trong thư mục gốc:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/cellcard_esim
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
CELLCARD_BASE_URL=https://api.cellcard.com.kh
WINGPAY_API_KEY=your-wingpay-api-key
BCRYPT_ROUNDS=12
```

### Thiết lập cơ sở dữ liệu

```bash
# Tạo database
createdb cellcard_esim

# Chạy schema
psql -d cellcard_esim -f src/config/schema.sql
```

### Khởi động Redis

```bash
redis-server
```

## Chạy ứng dụng

### Chế độ phát triển

```bash
npm run dev
```

### Build và chạy production

```bash
npm run build
npm start
```

## API Documentation

### Authentication

#### Đăng ký
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "phone": "+85512345678"
}
```

#### Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### eSIM Operations

#### Lấy danh sách gói
```http
GET /api/esim/plans
```

#### Mua eSIM
```http
POST /api/esim/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": 1,
  "paymentMethod": "wingpay",
  "paymentInfo": {...}
}
```

#### Kích hoạt eSIM
```http
GET /api/esim/activate/{transactionId}
Authorization: Bearer <token>
```

## Testing

```bash
# Chạy tất cả tests
npm test

# Chạy tests với coverage
npm run test:coverage

# Chạy tests watch mode
npm run test:watch
```

## Linting và Formatting

```bash
# Kiểm tra linting
npm run lint

# Tự động fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Cấu trúc dự án

```
src/
├── config/          # Database, Redis, schema
├── controllers/     # Request handlers
├── middleware/      # Authentication, validation
├── models/          # TypeScript interfaces
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Helper functions
└── server.ts        # Application entry point
```

## Bảo mật

- JWT authentication với refresh tokens
- Rate limiting trên tất cả endpoints
- Input validation và sanitization
- HTTPS enforcement trong production
- Secure password hashing với bcrypt

## Triển khai

### Docker (Tương lai)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD

GitHub Actions workflow được cấu hình cho automated testing và deployment.

## Phát triển

### Thêm endpoint mới

1. Tạo controller trong `src/controllers/`
2. Thêm route trong `src/routes/`
3. Cập nhật types trong `src/models/`
4. Viết tests cho functionality mới

### Database migrations

Cập nhật `src/config/schema.sql` và chạy lại script.

## Giấy phép

UNLICENSED - Chỉ sử dụng nội bộ

## Lưu ý

Dự án này được phát triển cho mục đích nghiên cứu bảo mật và demonstration. Không sử dụng cho mục đích bất hợp pháp.

## Triển khai (Deployment)

### Phát triển Local với Docker

1. **Cài đặt Docker và Docker Compose**

2. **Sao chép file môi trường:**
   ```bash
   cp .env.example .env
   ```

3. **Chỉnh sửa `.env` với cấu hình của bạn**

4. **Khởi động services:**
   ```bash
   docker-compose up -d
   ```

5. **Chạy database migrations:**
   ```bash
   docker-compose exec postgres psql -U postgres -d cellcard_esim -f /docker-entrypoint-initdb.d/01-schema.sql
   ```

6. **Truy cập ứng dụng:**
   - API: `http://localhost:3000`
   - Test Interface: `http://localhost:3000/index.html`
   - pgAdmin: `http://localhost:5050` (email: admin@cellcard.com, password: admin)
   - Redis Commander: `http://localhost:8081`

### Triển khai Staging

1. **Tạo file môi trường staging:**
   ```bash
   cp .env.example .env.staging
   # Chỉnh sửa với cấu hình staging
   ```

2. **Chạy script deployment:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh staging
   ```

### Triển khai Production

1. **Cấu hình registry Docker:**
   - Đặt `DOCKER_REGISTRY` trong deploy.sh
   - Đảm bảo bạn có quyền push tới registry

2. **Tạo file môi trường production:**
   ```bash
   cp .env.example .env.production
   # Chỉnh sửa với cấu hình production
   ```

3. **Triển khai:**
   ```bash
   ./deploy.sh production
   ```

### Cấu trúc Triển khai

```
Production Setup:
├── Load Balancer (nginx)
├── Application Servers (Docker)
├── PostgreSQL Cluster
├── Redis Cluster
├── Monitoring (Prometheus/Grafana)
└── CDN (CloudFlare/CloudFront)
```

### Môi trường Production

**Yêu cầu:**
- Docker Registry
- Kubernetes cluster (recommended)
- SSL certificates
- Monitoring stack
- Backup systems

**Cấu hình Bảo mật:**
- Environment variables cho secrets
- Network security groups
- Database encryption
- Regular security updates

### Giám sát và Logging

**Metrics:**
- Application performance (response times, error rates)
- Database performance
- Cache hit rates
- Resource utilization

**Logging:**
- Structured logging với Winston
- Centralized logging với ELK stack
- Error tracking với Sentry

### Sao lưu và Khôi phục

**Automated Backups:**
- Database: Daily với point-in-time recovery
- File system: Weekly
- Offsite storage: AWS S3 Glacier

**Recovery Testing:**
- Regular DR drills
- RTO: 4 hours
- RPO: 1 hour

### Cập nhật và Maintenance

**Zero-downtime Deployment:**
- Blue-green deployment strategy
- Health checks trước switch traffic
- Rollback procedures

**Maintenance Windows:**
- Security patches: Weekly
- Feature updates: Bi-weekly
- Major updates: Monthly
