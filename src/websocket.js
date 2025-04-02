const URLWebSocket = 'channel_rtc'
let webSocket

export async function connectToWebSocket(handlerOnMessageWebSocket, localUser) {
  webSocket = new BroadcastChannel(URLWebSocket)

  webSocket.onmessage = handlerOnMessageWebSocket
  sendMessageWebSocket({ type: 'new-user-connected', user: localUser })
}

export function sendMessageWebSocket(data) {
  webSocket.postMessage(JSON.stringify(data ?? { message: 'mensaje por defecto' }))
}
