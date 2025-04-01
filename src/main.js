import './style.css'

const $ = (el) => document.querySelector(el)

// VARIABLES
const startVideoCallA = $('.startVideoCallA')
const startVideoCallB = $('.startVideoCallB')
const startVideoCallC = $('.startVideoCallC')
const sendMessage = $('.sendMessage')

const URLWebSocket = 'channel_rtc'
let webSocket

const peerConnection1a2 = new RTCPeerConnection()
const peerConnection2a1 = new RTCPeerConnection()
const peerConnection3a1 = new RTCPeerConnection()
const peerConnection3a2 = new RTCPeerConnection()

const TYPES_PEER_CONNECTION = {
  UNO: 'UNO',
  DOS: 'DOS',
  TRES: 'TRES',
}

// LISTENERS
/*
  A inicia la llamada
  B se conecta a A
  C se conecta a A y B
 */
startVideoCallA.addEventListener('click', async () => {
  console.log('iniciar llamada A')
  await connectToWebSocket()
  handlerPeerConnection(TYPES_PEER_CONNECTION.UNO)
})

startVideoCallB.addEventListener('click', async () => {
  console.log('llamar a A')
  await connectToWebSocket()
  const numberPeerConnection = TYPES_PEER_CONNECTION.DOS
  handlerPeerConnection(numberPeerConnection)
  await createOffer(numberPeerConnection)
})

startVideoCallC.addEventListener('click', async () => {
  console.log('llamar a A y B')
  await connectToWebSocket()
  handlerPeerConnection(TYPES_PEER_CONNECTION.TRES)
})

sendMessage.addEventListener('click', () => {
  console.log('enviar mensaje')
  sendMessageWebSocket()
})

// FUNCTIONS
async function connectToWebSocket() {
  webSocket = new BroadcastChannel(URLWebSocket)

  webSocket.onmessage = handlerOnMessageWebSocket
}

function handlerOnMessageWebSocket(event) {
  console.log({ event })
  const data = JSON.parse(event.data)

  if (data.type === 'offer') {
    console.log('me llego una oferta')
    handlerOffer(data)
  } else if (data.type === 'answer') {
    console.log('me llego una respuesta')
    handlerAnswer(data)
  }
}

function sendMessageWebSocket (data) {
  webSocket.postMessage(JSON.stringify(data ?? { message: 'mensaje por el channel' }))
}

async function startVideo() {
  const stream = navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })

  return stream
}

function getPeerByNumber(numberPeerConnection) {
  let peer

  if (numberPeerConnection === TYPES_PEER_CONNECTION.UNO) {
    peer = peerConnection1a2
  } else if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
    peer = peerConnection2a1
  } else if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES) {
    peer = peerConnection3a1
  } else if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES_DOS) {
    peer = peerConnection3a2
  }

  return peer
}

function handlerPeerConnection(numberPeerConnection) {
  const peer = getPeerByNumber(numberPeerConnection)

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('enviando candidatos')
    }
  }

  peer.ontrack = (event) => {
    console.log({ event })
  }

  peer.oniceconnectionstatechange = () => {
    const state = peer.current.iceConnectionState
    console.log("ICE Connection State:", state)

    if (state === "connected") {
      console.log("RTC Conectado")
    } else if (state === "disconnected") {
      alert("RTC Desconectado")
    }
  }
}

async function createOffer (numberPeerConnection) {
  // de B a A inicialmente
  const peer = getPeerByNumber(numberPeerConnection)
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)
  const objOffer = {
    type: offer.type,
    sdp: offer.sdp,
    numberPeerConnection: numberPeerConnection
  }

  sendMessageWebSocket(objOffer)
}

async function handlerOffer(dataOffer) {
  console.log({ dataOffer })
  const { type, sdp, numberPeerConnection } = dataOffer
  const offer = {
    type,
    sdp
  }

  if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
    const peer = getPeerByNumber(TYPES_PEER_CONNECTION.UNO)
    peer.setRemoteDescription(
      new RTCSessionDescription(offer)
    )

    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)

    const objAnswer = {
      type: answer.type,
      sdp: answer.sdp,
      numberPeerConnection
    }

    sendMessageWebSocket(objAnswer)
  }
  if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES) {
    // const peer = getPeerByNumber(TYPES_PEER_CONNECTION.UNO)
    // peerConnection3.setRemoteDescription(
    //   new RTCSessionDescription(offer)
    // )
  }
}

async function handlerAnswer(dataAnswer) {
  const { type, sdp, numberPeerConnection } = dataAnswer

  const peer = getPeerByNumber(numberPeerConnection)
  if (peer.signalingState === 'stable') {
    const objAnswer = {
      type,
      sdp
    }

    peer.setRemoteDescription(
      new RTCSessionDescription(objAnswer)
    )
  }
}
