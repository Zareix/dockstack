package logging

import (
	"log/slog"
	"os"
	"strings"
)

type Level string

const (
	LevelDebug Level = "debug"
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"
)

type Format string

const (
	FormatText Format = "text"
	FormatJSON Format = "json"
)

func Setup() {
	var level slog.Level
	switch Level(strings.ToLower(os.Getenv("LOG_LEVEL"))) {
	case LevelDebug:
		level = slog.LevelDebug
	case LevelWarn:
		level = slog.LevelWarn
	case LevelError:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: level}
	var handler slog.Handler
	if Format(strings.ToLower(os.Getenv("LOG_FORMAT"))) == FormatJSON {
		handler = slog.NewJSONHandler(os.Stderr, opts)
	} else {
		handler = slog.NewTextHandler(os.Stderr, opts)
	}
	slog.SetDefault(slog.New(handler))
}
