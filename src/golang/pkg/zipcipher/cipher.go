package zipcipher

import (
	"unicode/utf8"
)

// ZipCipher implements the PKZIP stream cipher for filename decryption
type ZipCipher struct {
	Keys [3]uint32
}

// InitKeys initializes the cipher with the given password
func (z *ZipCipher) InitKeys(password []byte) {
	z.Keys[0] = 305419896 // 0x12345678
	z.Keys[1] = 591751049 // 0x23456789
	z.Keys[2] = 878082192 // 0x34567890

	for _, b := range password {
		z.UpdateCipher(b)
	}
}

// UpdateCipher updates the cipher state with a byte
func (z *ZipCipher) UpdateCipher(byteVal byte) {
	z.Keys[0] = UpdateCRC32(z.Keys[0], byteVal)
	z.Keys[1] = (z.Keys[1] + (z.Keys[0] & 0xFF)) & 0xFFFFFFFF
	z.Keys[1] = (z.Keys[1] * 134775813) & 0xFFFFFFFF
	z.Keys[1] = z.Keys[1] + 1
	keyshift := z.Keys[1] >> 24
	z.Keys[2] = UpdateCRC32(z.Keys[2], byte(keyshift))
}

// DecryptByte performs the PKZIP decryption for a single byte
func (z *ZipCipher) DecryptByte(byteVal byte) byte {
	temp := ((z.Keys[2]) & 0xFFFF) | 2
	decrypted := byteVal ^ byte(((temp * (temp ^ 1)) >> 8))
	return decrypted
}

// DecryptData decrypts a byte slice using the PKZIP stream cipher
func (z *ZipCipher) DecryptData(encryptedData []byte) []byte {
	if len(encryptedData) == 0 {
		return []byte{}
	}

	decrypted := make([]byte, len(encryptedData))
	for i, byteVal := range encryptedData {
		decrypted[i] = z.DecryptByte(byteVal)
		z.UpdateCipher(decrypted[i])
	}
	return decrypted
}

// ResetCipher resets the cipher to its initial state
func (z *ZipCipher) ResetCipher() {
	z.Keys[0] = 305419896 // 0x12345678
	z.Keys[1] = 591751049 // 0x23456789
	z.Keys[2] = 878082192 // 0x34567890
}

// DecryptFilename decrypts an encrypted filename and attempts to decode it
func DecryptFilename(encryptedData []byte, password []byte) (string, bool) {
	if len(encryptedData) == 0 {
		return "", false
	}

	cipher := &ZipCipher{}
	cipher.InitKeys(password)
	decrypted := cipher.DecryptData(encryptedData)

	// Try different encodings to decode the filename
	encodings := []string{
		"utf-8",
		"latin-1",
		"cp1252",
		"ascii",
	}

	for _, encoding := range encodings {
		if decoded, ok := tryDecode(decrypted, encoding); ok && isValidFilename(decoded) {
			return decoded, true
		}
	}

	// Try Japanese encoding as fallback
	if decoded, ok := tryDecodeCP932(decrypted); ok && len(decoded) > 1 {
		return decoded, true
	}

	return "", false
}

// tryDecode attempts to decode bytes using the specified encoding
func tryDecode(data []byte, encoding string) (string, bool) {
	switch encoding {
	case "utf-8":
		if !utf8.Valid(data) {
			return "", false
		}
		return string(data), true
	case "latin-1", "cp1252", "ascii":
		// For these encodings, we can just convert directly
		result := make([]rune, len(data))
		for i, b := range data {
			result[i] = rune(b)
		}
		return string(result), true
	default:
		return "", false
	}
}

// tryDecodeCP932 attempts to decode using Japanese CP932 encoding
func tryDecodeCP932(data []byte) (string, bool) {
	// Simplified CP932 decoding - in a real implementation, you'd use
	// golang.org/x/text/encoding/japanese.ShiftJIS
	// For now, just treat as extended Latin-1
	result := make([]rune, len(data))
	for i, b := range data {
		if b < 128 {
			result[i] = rune(b)
		} else {
			result[i] = rune(b) // Simplified handling
		}
	}
	return string(result), true
}

// isValidFilename checks if a decoded string is likely to be a valid filename
func isValidFilename(filename string) bool {
	if len(filename) == 0 {
		return false
	}

	// Check if the filename contains reasonable characters
	validCharCount := 0
	for _, r := range filename {
		if (r >= 32 && r <= 126) || r == '_' || r == '-' || r == '.' || r == '/' {
			validCharCount++
		}
	}

	// At least 80% of characters should be valid
	return float64(validCharCount)/float64(len(filename)) >= 0.8
}

// MakeSafeFilename creates a safe filename for filesystem storage
func MakeSafeFilename(filename string) string {
	if len(filename) == 0 {
		return "unnamed_file"
	}

	// Replace invalid characters with underscores
	safe := make([]rune, 0, len(filename))
	for _, r := range filename {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
			r == '_' || r == '-' || r == '.' || r == '/' || r == ' ' {
			safe = append(safe, r)
		} else {
			safe = append(safe, '_')
		}
	}

	result := string(safe)

	// Ensure the filename is not empty
	if len(result) == 0 {
		return "unnamed_file"
	}

	return result
}