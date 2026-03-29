package creator

import (
	"crypto/rand"
	"fmt"

	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
)

func EncryptFilename(plaintext string, password []byte) []byte {
	cipher := &zipcipher.ZipCipher{}
	cipher.InitKeys(password)

	plaintextBytes := []byte(plaintext)
	encrypted := make([]byte, len(plaintextBytes))

	for i, b := range plaintextBytes {
		encrypted[i] = cipher.DecryptByte(b)
		cipher.UpdateCipher(b)
	}

	return encrypted
}

func EncryptData(plaintext []byte, password []byte, crc32Val uint32) ([]byte, error) {
	cipher := &zipcipher.ZipCipher{}
	cipher.InitKeys(password)

	header := make([]byte, 12)
	if _, err := rand.Read(header[:10]); err != nil {
		return nil, fmt.Errorf("failed to generate random header: %w", err)
	}
	for i := 0; i < 10; i++ {
		if header[i] == 0 {
			header[i] = 1
		}
	}
	header[10] = byte((crc32Val >> 16) & 0xff)
	header[11] = byte((crc32Val >> 24) & 0xff)

	result := make([]byte, 12+len(plaintext))

	for i, b := range header {
		result[i] = cipher.DecryptByte(b)
		cipher.UpdateCipher(b)
	}

	for i, b := range plaintext {
		result[12+i] = cipher.DecryptByte(b)
		cipher.UpdateCipher(b)
	}

	return result, nil
}
