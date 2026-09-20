import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await this.deriveKey(password, salt);

    return [
      HASH_PREFIX,
      salt.toString('base64'),
      derivedKey.toString('base64'),
    ].join('$');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [prefix, saltValue, hashValue] = storedHash.split('$');

    if (prefix !== HASH_PREFIX || !saltValue || !hashValue) {
      return false;
    }

    const salt = Buffer.from(saltValue, 'base64');
    const expectedHash = Buffer.from(hashValue, 'base64');

    if (expectedHash.length !== KEY_LENGTH) {
      return false;
    }

    const actualHash = await this.deriveKey(password, salt);
    return timingSafeEqual(actualHash, expectedHash);
  }

  private deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      });
    });
  }
}
