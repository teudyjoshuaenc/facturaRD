import { registerAs } from '@nestjs/config'

export default registerAs('redis', () => {
  const url = process.env['REDIS_URL']
  if (url) {
    const u = new URL(url)
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
      tls: u.protocol === 'rediss:',
    }
  }
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    tls: process.env['REDIS_TLS'] === 'true',
  }
})
