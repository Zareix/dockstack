package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	signInIdentifierMaxFailures = 5
	signInIPMaxFailures         = 10
	signInFailureWindow         = 15 * time.Minute
	signInLockout               = 15 * time.Minute
	signInMaxEntries            = 100
)

type bruteLimiter struct {
	mu      sync.Mutex
	entries map[string]*signInAttempts
	window  time.Duration
	lockout time.Duration
	max     int
}

type signInAttempts struct {
	failures    []time.Time
	lockedUntil time.Time
}

func newBruteLimiter(max int, window, lockout time.Duration) *bruteLimiter {
	return &bruteLimiter{
		entries: make(map[string]*signInAttempts),
		window:  window,
		lockout: lockout,
		max:     max,
	}
}

func (l *bruteLimiter) blocked(key string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	e, ok := l.entries[key]
	if !ok {
		return 0
	}
	if rem := time.Until(e.lockedUntil); rem > 0 {
		return rem
	}
	return 0
}

func (l *bruteLimiter) fail(key string) time.Duration {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.entries) >= signInMaxEntries {
		l.sweep(now)
	}
	e, ok := l.entries[key]
	if !ok {
		if len(l.entries) >= signInMaxEntries {
			return 0
		}
		e = &signInAttempts{}
		l.entries[key] = e
	}
	e.prune(now, l.window)
	e.failures = append(e.failures, now)
	if len(e.failures) >= l.max {
		e.lockedUntil = now.Add(l.lockout)
		return l.lockout
	}
	return 0
}

func (l *bruteLimiter) reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

func (e *signInAttempts) prune(now time.Time, window time.Duration) {
	fresh := now.Add(-window)
	n := 0
	for _, t := range e.failures {
		if t.After(fresh) {
			e.failures[n] = t
			n++
		}
	}
	e.failures = e.failures[:n]
}

func (l *bruteLimiter) sweep(now time.Time) {
	for key, e := range l.entries {
		stale := e.lockedUntil.Before(now) &&
			(len(e.failures) == 0 || e.failures[len(e.failures)-1].Add(l.window).Before(now))
		if stale {
			delete(l.entries, key)
		}
	}
}

type signInGuard struct {
	once sync.Once
	ip   *bruteLimiter
	id   *bruteLimiter
}

func (g *signInGuard) init() {
	g.once.Do(func() {
		g.ip = newBruteLimiter(signInIPMaxFailures, signInFailureWindow, signInLockout)
		g.id = newBruteLimiter(signInIdentifierMaxFailures, signInFailureWindow, signInLockout)
	})
}

func (g *signInGuard) check(ipKey, idKey string) error {
	g.init()
	if wait := g.ip.blocked(ipKey); wait > 0 {
		return signInTooManyRequests(wait)
	}
	if wait := g.id.blocked(idKey); wait > 0 {
		return signInTooManyRequests(wait)
	}
	return nil
}

func (g *signInGuard) recordFailure(ipKey, idKey string) {
	g.init()
	g.ip.fail(ipKey)
	if wait := g.id.fail(idKey); wait > 0 {
		slog.Warn("sign-in locked out after repeated failures", "lockout", wait.Round(time.Second).String())
	}
}

func (g *signInGuard) clear(ipKey, idKey string) {
	g.init()
	g.ip.reset(ipKey)
	g.id.reset(idKey)
}

func signInLimitKey(kind, value string) string {
	h := sha256.Sum256([]byte(kind + "\x00" + strings.ToLower(strings.TrimSpace(value))))
	return hex.EncodeToString(h[:])
}

func signInTooManyRequests(wait time.Duration) error {
	secs := int(wait.Round(time.Second) / time.Second)
	if secs < 1 {
		secs = 1
	}
	return huma.ErrorWithHeaders(huma.Error429TooManyRequests(
		fmt.Sprintf("Too many failed sign-in attempts. Try again in %s.", wait.Round(time.Second)),
	), http.Header{"Retry-After": []string{strconv.Itoa(secs)}})
}
