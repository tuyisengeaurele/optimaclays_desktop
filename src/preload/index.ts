import { contextBridge, ipcRenderer } from 'electron'

let currentToken: string | null = null

function setToken(token: string | null): void {
  currentToken = token
}

async function invoke<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
  const result = await ipcRenderer.invoke(channel, { token: currentToken, payload })
  if (!result.ok) throw new Error(result.message)
  return result.data
}

// invokePublic sends the payload as-is, with no token envelope attached.
// auth:logout is registered as public (it must tolerate an already-expired
// or missing token) and expects the token inside its own payload, e.g.
// invokePublic('auth:logout', { token: currentToken }) - not invoke().
async function invokePublic<TPayload, TResult>(channel: string, payload: TPayload): Promise<TResult> {
  const result = await ipcRenderer.invoke(channel, payload)
  if (!result.ok) throw new Error(result.message)
  return result.data
}

const api = {
  setToken,
  invoke,
  invokePublic,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
