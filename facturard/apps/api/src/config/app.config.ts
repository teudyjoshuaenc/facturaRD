import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  env: process.env['NODE_ENV'] ?? 'development',
  allowedOrigins: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
}))
