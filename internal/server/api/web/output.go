package web

type OKResponse struct {
	Body struct {
		Success bool `json:"success"`
	}
}

func OK() *OKResponse {
	resp := &OKResponse{}
	resp.Body.Success = true
	return resp
}

type ListOutput[T any] struct {
	Body []T
}

type MapOutput[V any] struct {
	Body map[string]V
}

type DataOutput[T any] struct {
	Body T
}
