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

func EncryptData(plaintext []byte, password []byte, modTimeHighByte byte) ([]byte, error) {
	cipher := &zipcipher.ZipCipher{}
	cipher.InitKeys(password)

	header := make([]byte, 12)
	if _, err := rand.Read(header[:11]); err != nil {
		return nil, fmt.Errorf("failed to generate random header: %w", err)
	}
	header[11] = modTimeHighByte

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
