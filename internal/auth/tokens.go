package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

const tokenAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func randomString(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random: %w", err)
	}
	for i := range buf {
		buf[i] = tokenAlphabet[int(buf[i])%len(tokenAlphabet)]
	}
	return string(buf), nil
}

func GenerateSessionToken() (string, error) {
	return randomString(32)
}

func GenerateAPIKey() (string, error) {
	// 64-char [a-zA-Z] key, matching better-auth's format.
	return randomString(64)
}

func GenerateResetToken() (string, error) {
	return randomString(32)
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
