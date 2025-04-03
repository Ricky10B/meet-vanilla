const URLWebSocket = 'wss://mtbk.estoesunaprueba.fun:8050/ws/webrtc/'
let webSocket

export async function connectToWebSocket(handlerOnMessageWebSocket, localUser) {
  if (webSocket?.readyState === WebSocket.OPEN) return

  webSocket = new WebSocket(URLWebSocket)
  webSocket.onopen = (event) => {
    console.log({ event })
  }
  webSocket.onmessage = handlerOnMessageWebSocket
  webSocket.onclose = () => {
    console.log('Socket Cerrado')
  }
}

export function sendMessageWebSocket(data) {
  webSocket.send(JSON.stringify(data ?? { message: 'mensaje por defecto' }))
}

export function closeWebSocket() {
  webSocket.close()
}
