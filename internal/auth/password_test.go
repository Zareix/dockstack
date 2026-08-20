package auth

import "testing"

func TestPasswordHashVerify(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	ok, err := VerifyPassword("correct horse battery staple", hash)
	if err != nil || !ok {
		t.Fatalf("verify correct password: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword("wrong", hash)
	if err != nil {
		t.Fatalf("verify wrong password err: %v", err)
	}
	if ok {
		t.Fatal("wrong password verified")
	}
}

func TestVerifyPasswordBadFormat(t *testing.T) {
	if _, err := VerifyPassword("x", "not-a-hash"); err == nil {
		t.Fatal("expected error for bad format")
	}
}

func TestHashTokenStable(t *testing.T) {
	a := HashToken("foo")
	b := HashToken("foo")
	if a != b || a == "" {
		t.Fatalf("hash mismatch: %q %q", a, b)
	}
	if HashToken("foo") == HashToken("bar") {
		t.Fatal("different tokens hash equal")
	}
}

func TestTokenGeneration(t *testing.T) {
	for i := 0; i < 5; i++ {
		tok, err := GenerateSessionToken()
		if err != nil {
			t.Fatal(err)
		}
		if len(tok) != 32 {
			t.Fatalf("session token length = %d", len(tok))
		}
	}
	key, err := GenerateAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	if len(key) != 64 {
		t.Fatalf("api key length = %d", len(key))
	}
}
