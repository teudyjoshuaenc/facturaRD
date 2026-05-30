import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const TAG_BYTES = 16

@Injectable()
export class CryptoService {
  private readonly key: Buffer

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('ENCRYPTION_KEY')
    // Derive exactly 32 bytes from the key string via SHA-256 so any length works
    this.key = crypto.createHash('sha256').update(raw).digest()
  }

  encryptBuffer(data: Buffer): { encrypted: Buffer; iv: string; tag: string } {
    const iv = crypto.randomBytes(IV_BYTES)
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES })
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    }
  }

  decryptBuffer(encrypted: Buffer, ivHex: string, tagHex: string): Buffer {
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  }

  // Format: base64(iv):base64(tag):base64(encrypted)
  encryptString(text: string): string {
    const { encrypted, iv, tag } = this.encryptBuffer(Buffer.from(text, 'utf8'))
    return [
      Buffer.from(iv, 'hex').toString('base64'),
      Buffer.from(tag, 'hex').toString('base64'),
      encrypted.toString('base64'),
    ].join(':')
  }

  decryptString(encryptedStr: string): string {
    const parts = encryptedStr.split(':')
    if (parts.length !== 3) throw new Error('Formato de cifrado inválido')
    const [ivB64, tagB64, dataB64] = parts as [string, string, string]
    const iv = Buffer.from(ivB64, 'base64').toString('hex')
    const tag = Buffer.from(tagB64, 'base64').toString('hex')
    const data = Buffer.from(dataB64, 'base64')
    return this.decryptBuffer(data, iv, tag).toString('utf8')
  }
}
