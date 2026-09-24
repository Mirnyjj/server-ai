# Crypto — Secret Service

## Что сделано

AES-256-GCM шифрование Instagram access tokens at rest (ТЗ §6).

### API

```ts
encryptSecret(plaintext: string): string
// returns "iv:ciphertext:authTag" (base64url)

decryptSecret(payload: string): string
```

### Как работает

1. Key = SHA-256(`INSTAGRAM_TOKEN_ENCRYPTION_KEY`)
2. Random 12-byte IV per encryption
3. AES-256-GCM → ciphertext + 16-byte auth tag
4. Format: `base64url(iv):base64url(ct):base64url(tag)`

### Где используется

- `auth.service` — encrypt before save Connection
- `token.resolver` — decrypt for API calls
- `refresh.service` — decrypt → refresh → encrypt

### Env

```
INSTAGRAM_TOKEN_ENCRYPTION_KEY=  # min 32 characters
```
