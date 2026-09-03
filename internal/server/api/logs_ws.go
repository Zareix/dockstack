package api

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"

	"github.com/coder/websocket"

	"github.com/zareix/dockstack/internal/docker"
)

func (d *Deps) handleLogsWS(w http.ResponseWriter, r *http.Request) {
	conn, err := acceptWS(w, r)
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()

	ctx := r.Context()

	var (
		mu     sync.Mutex
		cancel context.CancelFunc
	)

	for {
		typ, data, err := conn.Read(ctx)
		if err != nil {
			mu.Lock()
			if cancel != nil {
				cancel()
			}
			mu.Unlock()
			return
		}
		if typ != websocket.MessageText {
			continue
		}
		var msg struct {
			Type      string `json:"type"`
			StackName string `json:"stackName"`
		}
		if json.Unmarshal(data, &msg) != nil {
			continue
		}
		switch msg.Type {
		case "init":
			if msg.StackName == "" {
				_ = sendWSJSON(conn, map[string]string{"type": "error", "message": "stackName is required"})
				continue
			}
			if !stackNameRe.MatchString(msg.StackName) {
				_ = sendWSJSON(conn, map[string]string{"type": "error", "message": "invalid stack name"})
				continue
			}
			mu.Lock()
			if cancel != nil {
				cancel()
			}
			streamCtx, streamCancel := context.WithCancel(ctx)
			cancel = streamCancel
			mu.Unlock()

			go d.streamStackLogsToWS(streamCtx, conn, msg.StackName)
		case "close":
			mu.Lock()
			if cancel != nil {
				cancel()
			}
			mu.Unlock()
			return
		}
	}
}

func (d *Deps) streamStackLogsToWS(ctx context.Context, conn *websocket.Conn, stackName string) {
	entries, err := d.Stacks.StreamStackLogs(ctx, stackName)
	if err != nil {
		_ = sendWSJSON(conn, map[string]string{"type": "error", "message": err.Error()})
		return
	}
	for entry := range entries {
		_ = sendWSJSON(conn, logMessage(entry))
	}
	_ = sendWSJSON(conn, map[string]string{"type": "end"})
}

func logMessage(entry docker.LogEntry) map[string]any {
	return map[string]any{
		"type":          "log",
		"containerName": entry.ContainerName,
		"message":       entry.Message,
		"stream":        entry.Stream,
		"timestamp":     entry.Timestamp,
	}
}
