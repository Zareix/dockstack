package randid

import (
	"crypto/rand"
	"encoding/hex"
)

func New() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		panic("randid: " + err.Error())
	}
	return hex.EncodeToString(buf)
}
