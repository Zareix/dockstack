package auth

import (
	"testing"

	"github.com/zareix/dockstack/internal/config"
)

func TestOAuthStateRoundTrip(t *testing.T) {
	d := &Deps{Cfg: &config.Config{AuthSecret: "secret"}}

	signed := d.signOAuthState()
	if !d.verifyOAuthState(signed) {
		t.Fatalf("verifyOAuthState(%q) = false, want true", signed)
	}

	// The state must be signed: a bare token without a MAC is rejected.
	if d.verifyOAuthState("c88a3aea-6c44-4080-b4bf-2dda00089dbe") {
		t.Fatal("verifyOAuthState(bare token) = true, want false")
	}
	if d.verifyOAuthState(signed + "tampered") {
		t.Fatal("verifyOAuthState(tampered) = true, want false")
	}
	if d.verifyOAuthState("") {
		t.Fatal("verifyOAuthState(empty) = true, want false")
	}

	// A different secret must not validate the same state.
	other := &Deps{Cfg: &config.Config{AuthSecret: "other"}}
	if other.verifyOAuthState(signed) {
		t.Fatal("verifyOAuthState with different secret = true, want false")
	}
}
