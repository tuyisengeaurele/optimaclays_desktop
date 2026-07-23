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
