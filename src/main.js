import './style.css'

const $ = (el) => document.querySelector(el)

// VARIABLES
const startVideoCallA = $('.startVideoCallA')
const startVideoCallB = $('.startVideoCallB')
const startVideoCallC = $('.startVideoCallC')
const sendMessage = $('.sendMessage')
const containerVideos = $('#videos')

const URLWebSocket = 'channel_rtc'
let webSocket

const peerConnection1 = new RTCPeerConnection()
const peerConnection2 = new RTCPeerConnection()
// const peerConnection3a1 = new RTCPeerConnection()
// const peerConnection3a2 = new RTCPeerConnection()

const TYPES_PEER_CONNECTION = {
  UNO: 'UNO',
  DOS: 'DOS',
  // TRES: 'TRES',
  // TRES_DOS: 'TRES_DOS',
}

const NUMBERS_PEER_CONNECTIONS = {
  1: 'UNO',
  2: 'DOS'
}

let localStream
let idsRemoteVideos = {}
let totalConnections = 0
let localUser = { id: null }

// LISTENERS
/*
  A inicia la llamada
  B se conecta a A
  C se conecta a A
  C se conecta a B
 */
startVideoCallA.addEventListener('click', async () => {
  console.log('iniciar llamada A')
  const numberPeerConnection = TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]]
  // const numberPeerConnection = TYPES_PEER_CONNECTION.UNO
  await addLocalVideo(numberPeerConnection)
  await connectToWebSocket()
  handlerPeerConnection(numberPeerConnection)
})

startVideoCallB.addEventListener('click', async () => {
  console.log('llamar a A')
  totalConnections++
  const numberPeerConnection = TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]]
  await addLocalVideo(numberPeerConnection)
  await connectToWebSocket()
  handlerPeerConnection(numberPeerConnection)
  await createOffer(numberPeerConnection)
})

startVideoCallC.addEventListener('click', async () => {
  console.log('llamar a A y B')
  totalConnections++
  const numberPeerConnection = TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]]
  await addLocalVideo(numberPeerConnection)
  await connectToWebSocket()
  handlerPeerConnection(numberPeerConnection)
  await createOffer(numberPeerConnection)
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
  const data = JSON.parse(event.data)
  
  if (data.type === 'offer') {
    console.log('me llego una oferta')
    handlerOffer(data)
  } else if (data.type === 'answer') {
    console.log('me llego una respuesta')
    handlerAnswer(data)
  } else if (data.type === 'candidate') {
    // console.log({ event })
    console.log('me llego un candidato')
    handlerCandidate(data)
  } else if (data.type === 'users') {
    console.log({ data })
  } else {
    console.log('opción invalida')
  }
}

function sendMessageWebSocket (data) {
  webSocket.postMessage(JSON.stringify(data ?? { message: 'mensaje por el channel' }))
}

async function startVideo() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })

  localStream = stream
  return stream
}

function getPeerByNumber(numberPeerConnection) {
  let peer

  if (numberPeerConnection === TYPES_PEER_CONNECTION.UNO) {
    peer = peerConnection1
  } else if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
    peer = peerConnection2
  }
  // } else if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES) {
  //   peer = peerConnection3a1
  // } else if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES_DOS) {
  //   peer = peerConnection3a2
  // }

  return peer
}

function handlerPeerConnection(numberPeerConnection) {
  // let peer
  // if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
  //   peer = getPeerByNumber(TYPES_PEER_CONNECTION.UNO)
  // } else {
  //   peer = getPeerByNumber(numberPeerConnection)
  // }
  const peer = getPeerByNumber(TYPES_PEER_CONNECTION.UNO)


  peer.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessageWebSocket({
        type: 'candidate',
        candidate: event.candidate,
        numberPeerConnection
      })
    }
  }

  peer.ontrack = (event) => {
    const [stream] = event.streams
    if (idsRemoteVideos[stream.id]) return

    console.log({ event })
    const remoteVideo = document.createElement('video')
    remoteVideo.classList.add(`videoRemoto${crypto.randomUUID()}`)
    remoteVideo.srcObject = stream
    remoteVideo.autoplay = true
    remoteVideo.muted = true
    containerVideos.appendChild(remoteVideo)
    idsRemoteVideos[stream.id] = stream.id
  }

  peer.oniceconnectionstatechange = () => {
    const state = peer.iceConnectionState
    console.log("ICE Connection State:", state)

    if (state === "connected") {
      console.log("RTC Conectado")
    } else if (state === "disconnected") {
      alert("RTC Desconectado")
    }
  }

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream)
  })
}

async function createOffer (numberPeerConnection) {
  console.log({ numberPeerConnection })
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

  totalConnections++
  const peer = getPeerByNumber(TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]])
  await peer.setRemoteDescription(
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

  // if (numberPeerConnection === TYPES_PEER_CONNECTION.UNO) {
  //   const peer = getPeerByNumber(TYPES_PEER_CONNECTION.UNO)
  //   await peer.setRemoteDescription(
  //     new RTCSessionDescription(offer)
  //   )

  //   const answer = await peer.createAnswer()
  //   await peer.setLocalDescription(answer)

  //   const objAnswer = {
  //     type: answer.type,
  //     sdp: answer.sdp,
  //     numberPeerConnection
  //   }

  //   sendMessageWebSocket(objAnswer)
  // } else if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
  //   const peer = getPeerByNumber(TYPES_PEER_CONNECTION.TRES_DOS)
  //   await peer.setRemoteDescription(
  //     new RTCSessionDescription(offer)
  //   )

  //   const answer = await peer.createAnswer()
  //   await peer.setLocalDescription(answer)

  //   const objAnswer = {
  //     type: answer.type,
  //     sdp: answer.sdp,
  //     numberPeerConnection
  //   }

  //   sendMessageWebSocket(objAnswer)
  // }
}

async function handlerAnswer(dataAnswer) {
  const { type, sdp, numberPeerConnection } = dataAnswer

  const peer = getPeerByNumber(TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]])
  if (peer.signalingState !== 'stable') {
    const objAnswer = {
      type,
      sdp
    }

    await peer.setRemoteDescription(
      new RTCSessionDescription(objAnswer)
    )
  }
}

async function handlerCandidate(dataCandidate) {
  const { candidate, numberPeerConnection } = dataCandidate

  const peer = getPeerByNumber(TYPES_PEER_CONNECTION[NUMBERS_PEER_CONNECTIONS[totalConnections]])
  const iceCandidate = new RTCIceCandidate(candidate)
  await peer.addIceCandidate(iceCandidate)
  // if (numberPeerConnection === TYPES_PEER_CONNECTION.UNO) {
  //   await peerConnection1.addIceCandidate(iceCandidate)
  // } else if (numberPeerConnection === TYPES_PEER_CONNECTION.DOS) {
  //   await peerConnection2.addIceCandidate(iceCandidate)
  // }
  // } else if (numberPeerConnection === TYPES_PEER_CONNECTION.TRES) {
  //   await peerConnection3a2.addIceCandidate(iceCandidate)
  // }
}

async function addLocalVideo(numberPeerConnection) {
  const stream = await startVideo()
  const video = document.createElement('video')
  video.classList.add(`video${numberPeerConnection}`)
  video.srcObject = stream
  video.autoplay = true
  video.muted = true
  containerVideos.appendChild(video)
}

document.addEventListener('DOMContentLoaded', () => {
  window.localStorage('users', '')
  localUser = { id: crypto.randomUUID() }
})
