package docker

import (
	"context"
	"net"

	"github.com/docker/docker/api/types/container"
)

func (c *Client) CreateExec(ctx context.Context, containerID string, opts container.ExecOptions) (container.ExecCreateResponse, error) {
	return c.api.ContainerExecCreate(ctx, containerID, opts)
}

func (c *Client) ResizeExec(ctx context.Context, execID string, height, width int) error {
	return c.api.ContainerExecResize(ctx, execID, container.ResizeOptions{
		Height: uint(height),
		Width:  uint(width),
	})
}

func (c *Client) AttachExec(ctx context.Context, execID string) (net.Conn, error) {
	hj, err := c.api.ContainerExecAttach(ctx, execID, container.ExecAttachOptions{
		Detach: false,
		Tty:    true,
	})
	if err != nil {
		return nil, err
	}
	return hj.Conn, nil
}
