import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./styles.css"

import { router } from "./router"

const rootElement = document.getElementById("root")!
const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
