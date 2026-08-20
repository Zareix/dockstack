// Package server provides the HTTP API and embedded SPA for dockstack.
package server

// @title Dockstack API
// @version 0.20.1
// @description Self-hosted Docker Compose stack management API.
// @contact.name Dockstack
// @license.name MIT

// @tag.name auth
// @tag.description Session and API-key authentication, user management.

// @tag.name stacks
// @tag.description Docker Compose stack lifecycle management.

// @tag.name resources
// @tag.description Containers, images, volumes and networks.

// @securityDefinitions.apikey SessionCookie
// @in cookie
// @name dockstack_session

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization

// @externalDocs.url https://zareix.github.io/dockstack/
