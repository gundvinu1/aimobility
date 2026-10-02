import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  /** Hash a password using scrypt with a random 16-byte salt */
  async hash(plaintext: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(plaintext, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`$scrypt$${salt}$${derivedKey.toString('hex')}`);
      });
    });
  }

  /** Verify a plaintext password against a stored hash */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      if (hash.startsWith('$scrypt$')) {
        const parts = hash.split('$');
        const salt = parts[2];
        const key = parts[3];
        if (!salt || !key) return false;
        const keyBuffer = Buffer.from(key, 'hex');
        const derivedKey = crypto.scryptSync(plaintext, salt, 64);
        return crypto.timingSafeEqual(keyBuffer, derivedKey);
      }
      return false;
    } catch {
      return false;
    }
  }
}
