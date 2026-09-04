package ws

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"sync"

	"github.com/coder/websocket"
	"github.com/docker/docker/api/types/container"
)

var authorizedShells = map[string]bool{
	"/bin/bash": true,
	"/bin/sh":   true,
	"/bin/zsh":  true,
	"/bin/fish": true,
}

func (d *Deps) handleExecWS(w http.ResponseWriter, r *http.Request) {
	conn, err := acceptWS(w, r)
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()

	ctx := r.Context()

	var (
		mu      sync.Mutex
		execID  string
		hijack  net.Conn
		cancel  context.CancelFunc
		started bool
	)

	for {
		typ, data, err := conn.Read(ctx)
		if err != nil {
			mu.Lock()
			if hijack != nil {
				if tc, ok := hijack.(interface{ CloseWrite() error }); ok {
					_ = tc.CloseWrite()
				}
			}
			mu.Unlock()
			if cancel != nil {
				cancel()
			}
			return
		}

		switch typ {
		case websocket.MessageBinary:
			mu.Lock()
			if hijack != nil && len(data) > 0 {
				_, _ = hijack.Write(data)
			}
			mu.Unlock()
			continue
		case websocket.MessageText:
			var msg struct {
				Type string `json:"type"`
			}
			if json.Unmarshal(data, &msg) != nil {
				mu.Lock()
				if hijack != nil {
					_, _ = hijack.Write(data)
				}
				mu.Unlock()
				continue
			}
			switch msg.Type {
			case "init":
				var init struct {
					Type        string `json:"type"`
					ContainerID string `json:"containerId"`
					Cols        int    `json:"cols"`
					Rows        int    `json:"rows"`
					Shell       string `json:"shell"`
				}
				if json.Unmarshal(data, &init) != nil {
					continue
				}
				if !authorizedShells[init.Shell] {
					_ = sendWSJSON(conn, map[string]string{"type": "error", "message": "shell not authorized"})
					continue
				}
				cols, rows := init.Cols, init.Rows
				if cols <= 0 {
					cols = 80
				}
				if rows <= 0 {
					rows = 24
				}
				execCtx, execCancel := context.WithCancel(ctx)
				cancel = execCancel
				hj, exec, err := d.startExec(execCtx, init.ContainerID, init.Shell, cols, rows)
				if err != nil {
					_ = sendWSJSON(conn, map[string]string{"type": "error", "message": err.Error()})
					execCancel()
					continue
				}
				mu.Lock()
				hijack = hj
				execID = exec
				started = true
				mu.Unlock()
				go d.pumpExec(conn, hj, ctx)
			case "resize":
				if !started {
					continue
				}
				var resize struct {
					Type string `json:"type"`
					Cols int    `json:"cols"`
					Rows int    `json:"rows"`
				}
				if json.Unmarshal(data, &resize) != nil {
					continue
				}
				if resize.Cols > 0 && resize.Rows > 0 {
					_ = d.Docker.ResizeExec(ctx, execID, resize.Rows, resize.Cols)
				}
			case "close":
				mu.Lock()
				if hijack != nil {
					if tc, ok := hijack.(interface{ CloseWrite() error }); ok {
						_ = tc.CloseWrite()
					}
				}
				mu.Unlock()
				if cancel != nil {
					cancel()
				}
				return
			default:
				mu.Lock()
				if hijack != nil {
					_, _ = hijack.Write(data)
				}
				mu.Unlock()
			}
		}
	}
}

func (d *Deps) pumpExec(conn *websocket.Conn, hijack net.Conn, ctx context.Context) {
	buf := make([]byte, 32*1024)
	for {
		n, err := hijack.Read(buf)
		if n > 0 {
			if werr := conn.Write(ctx, websocket.MessageBinary, buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			_ = sendWSJSON(conn, map[string]string{"type": "exit"})
			return
		}
	}
}

func (d *Deps) startExec(ctx context.Context, containerID, shell string, cols, rows int) (net.Conn, string, error) {
	env := []string{
		"TERM=xterm-256color",
		"COLUMNS=" + strconv.Itoa(cols),
		"LINES=" + strconv.Itoa(rows),
	}
	createResp, err := d.Docker.CreateExec(ctx, containerID, container.ExecOptions{
		Cmd:          []string{shell},
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Env:          env,
	})
	if err != nil {
		return nil, "", err
	}
	execID := createResp.ID
	hj, err := d.Docker.AttachExec(ctx, execID)
	if err != nil {
		return nil, "", err
	}
	_ = d.Docker.ResizeExec(ctx, execID, rows, cols)
	return hj, execID, nil
}
