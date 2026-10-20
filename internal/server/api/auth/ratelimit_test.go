package auth

import (
	"net/http"
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

func TestBruteLimiterHitCountsEveryRequest(t *testing.T) {
	l := newBruteLimiter(3, time.Minute, time.Minute)
	key := "k"
	for range 2 {
		if wait := l.hit(key); wait != 0 {
			t.Fatalf("hit before reaching max should not block: %v", wait)
		}
	}
	if wait := l.blocked(key); wait != 0 {
		t.Fatalf("blocked before reaching max: %v", wait)
	}
	if wait := l.hit(key); wait <= 0 {
		t.Fatalf("expected lockout at max hits, got %v", wait)
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

func TestRequestGuardLimitsPerEndpoint(t *testing.T) {
	g := &requestGuard{}
	g.init()
	key := signInLimitKey("ip", "1.2.3.4")
	req := testRequest("1.2.3.4")

	for range requestLimitMax {
		if err := g.passkeyBegin(req); err != nil {
			t.Fatalf("expected passkey begin to pass within limit: %v", err)
		}
	}
	if err := g.passkeyBegin(req); err == nil {
		t.Fatal("expected passkey begin to be limited after max requests")
	}
	if wait := g.forgotPass.blocked(key); wait != 0 {
		t.Fatalf("forgot-password limiter should be independent of passkey limiter: %v", wait)
	}
	if err := g.forgotPassword(req); err != nil {
		t.Fatalf("expected forgot-password to pass: %v", err)
	}
}

func TestRequestGuardKeyedByIP(t *testing.T) {
	g := &requestGuard{}
	g.init()
	for range requestLimitMax {
		if err := g.passkeyBegin(testRequest("1.2.3.4")); err != nil {
			t.Fatalf("expected requests to pass within limit: %v", err)
		}
	}
	if err := g.passkeyBegin(testRequest("5.6.7.8")); err != nil {
		t.Fatalf("other IPs should not be throttled by another IP's limit: %v", err)
	}
}

func testRequest(ip string) *http.Request {
	r, err := http.NewRequest(http.MethodPost, "http://dockstack.local/test", nil)
	if err != nil {
		panic(err)
	}
	r.RemoteAddr = ip + ":12345"
	return r
}
