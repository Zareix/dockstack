package auth

import (
	"testing"
	"time"
)

func TestBruteLimiterLocksAfterRepeatedFailures(t *testing.T) {
	l := newBruteLimiter(2, time.Minute, time.Minute)
	key := "k"

	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("blocked before any failure: %v", wait)
	}
	l.fail(key)
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("blocked after one failure: %v", wait)
	}
	l.fail(key)
	if wait := l.blocked(key); wait <= 0 {
		t.Fatalf("expected lockout after repeated failures, got %v", wait)
	}
}

func TestBruteLimiterResetOnSuccess(t *testing.T) {
	l := newBruteLimiter(2, time.Minute, time.Minute)
	key := "k"
	l.fail(key)
	l.fail(key)
	l.reset(key)
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("blocked after reset: %v", wait)
	}
	l.fail(key)
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("old failures should not count after reset, got %v", wait)
	}
}

func TestBruteLimiterWindowExpiry(t *testing.T) {
	l := newBruteLimiter(2, 20*time.Millisecond, 20*time.Millisecond)
	key := "k"
	l.fail(key)
	l.fail(key)
	if wait := l.blocked(key); wait <= 0 {
		t.Fatalf("expected lockout, got %v", wait)
	}
	time.Sleep(40 * time.Millisecond)
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("lockout should expire: %v", wait)
	}
	l.fail(key)
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("expired failures should not count toward lockout, got %v", wait)
	}
}

func TestBruteLimiterSweepRemovesStaleEntries(t *testing.T) {
	l := newBruteLimiter(2, 20*time.Millisecond, 20*time.Millisecond)
	l.fail("a")
	l.fail("b")
	time.Sleep(40 * time.Millisecond)

	l.mu.Lock()
	stale := len(l.entries)
	l.sweep(time.Now())
	removed := stale - len(l.entries)
	l.mu.Unlock()

	if stale == 0 {
		t.Fatal("expected entries to exist before sweep")
	}
	if removed != stale {
		t.Fatalf("sweep removed %d of %d stale entries", removed, stale)
	}
}

func TestSignInLimitKeyNormalization(t *testing.T) {
	if signInLimitKey("id", " Admin@Example.com ") != signInLimitKey("id", "admin@example.com") {
		t.Fatal("expected identifier normalization")
	}
	if signInLimitKey("ip", "1.2.3.4") == signInLimitKey("id", "1.2.3.4") {
		t.Fatal("ip and identifier keys must not collide")
	}
}
