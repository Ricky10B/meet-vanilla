const URLWebSocket = 'wss://mtbk.estoesunaprueba.fun:8050/ws/webrtc/'
let webSocket

export async function connectToWebSocket(handlerOnMessageWebSocket) {
  if (webSocket?.readyState === WebSocket.OPEN) return

  webSocket = new WebSocket(URLWebSocket)
  webSocket.onmessage = handlerOnMessageWebSocket
  webSocket.onclose = () => {
    console.log('Socket Cerrado')
  }
}

export function sendMessageWebSocket(data) {
  if (webSocket?.readyState === WebSocket.OPEN) {
    webSocket.send(JSON.stringify(data ?? { message: 'mensaje por defecto' }))
  }
}

export function closeWebSocket() {
  if (webSocket?.readyState === WebSocket.OPEN) {
    webSocket.close()
  }
}
