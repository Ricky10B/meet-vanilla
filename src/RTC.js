import './style.css'
import { $ } from './utilities/selector'
import { connectToWebSocket, sendMessageWebSocket } from './websocket'

// VARIABLES
const startVideoCallA = $('.startVideoCallA')
// const startVideoCallB = $('.startVideoCallB')
// const startVideoCallC = $('.startVideoCallC')
// const sendMessage = $('.sendMessage')
const containerVideos = $('#videos')

const listUsers = []
const peerConnections = {}
const listIdsVideoAddeds = {}

let localStream
let localUser = { id: null }

// LISTENERS

startVideoCallA.addEventListener('click', startConnection)
// startVideoCallA.addEventListener('click', async () => {
//   console.log('iniciar llamada A')
//   await startConnection()
// })

// startVideoCallB.addEventListener('click', async () => {
//   console.log('iniciar llamada B')
//   await startConnection()
// })

// startVideoCallC.addEventListener('click', async () => {
//   console.log('iniciar llamada C')
//   await startConnection()
// })

// FUNCTIONS
async function startConnection() {
  const stream = await startVideo()
  addVideoToDocument(stream)
  connectToWebSocket(handlerOnMessageWebSocket, localUser)
}

async function startVideo() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })

  localStream = stream
  return stream
}

async function addVideoToDocument(stream, idVideo) {
  if (listIdsVideoAddeds[stream.id]) return
  listIdsVideoAddeds[stream.id] = stream.id

  const video = document.createElement('video')
  video.classList.add(`video${idVideo ?? ''}`)
  video.srcObject = stream
  video.autoplay = true
  video.muted = true
  containerVideos.appendChild(video)
}

function handlerOnMessageWebSocket(event) {
  const data = JSON.parse(event.data)

  // console.log({ event, data })

  if (data.toIdUser != null && data.toIdUser !== localUser.id) return

  if (data.type === 'new-user-connected') {
    handlerNewUserConnected(data)
  } else if (data.type === 'response-all-users-connected') {
    handlerAddAllUsersConnected(data)
  } else if (data.type === 'offer') {
    handlerOffer(data)
  } else if (data.type === 'answer') {
    handlerAnswer(data)
  } else if (data.type === 'candidate') {
    handlerCandidate(data)
  } else {
    console.log('opcion invalida')
  }
}

function handlerNewUserConnected(data) {
  listUsers.push(data.user)
  sendMessageWebSocket({ type: 'response-all-users-connected', users: [...listUsers, localUser] })
}

function handlerAddAllUsersConnected(data) {
  for (const user of data.users) {
    const userExists = listUsers.find(prevUser => prevUser.id === user.id)
    if (!userExists && user.id !== localUser.id) {
      listUsers.push(user)
      console.log({ user })
      createOffer(user, localUser)
    }
  }

}

// function createPeerConnection() {}

async function createOffer(user, localUser) {
  const configuracion = {
    iceServers: [{
      urls: "stun:stun.l.google.com:19302",
    }],
  }

  // const idPeer = crypto.randomUUID() // el id del usuario al que me quiero conectar
  const idPeer = user.id
  const peerConnection = new RTCPeerConnection(configuracion)

  peerConnection.ontrack = (event) => {
    console.log({ event })
    const [stream] = event.streams
    addVideoToDocument(stream, user.id)
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateSender = {
        type: 'candidate',
        candidate: event.candidate,
        toIdUser: user.id,
        toIdPeer: localUser.id
      }

      // console.log('evento candidato', event, candidateSender)

      sendMessageWebSocket(candidateSender)
    }
  }

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState
    console.log('ICE Connection State:', state)

    if (state === 'connected') {
      console.log('RTC Conectado')
    } else if (state === 'disconnected') {
      window.alert('RTC Desconectado')
    }
  }

  peerConnections[idPeer] = {
    peer: peerConnection
  }
  // console.log('crear oferta para', user.id)

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  const offer = await peerConnection.createOffer()
  peerConnection.setLocalDescription(offer)

  const offerSender = {
    type: offer.type,
    sdp: offer.sdp,
    toIdUser: user.id,
    fromIdUser: localUser.id,
    toIdPeer: idPeer,
    fromIdPeer: localUser.id
  }

  sendMessageWebSocket(offerSender)
}

async function handlerOffer(dataOffer) {
  const { type, sdp, toIdUser, fromIdUser, toIdPeer, fromIdPeer } = dataOffer
  // console.log('crear answer de', toIdUser, 'para', fromIdUser)

  const configuracion = {
    iceServers: [{
      urls: "stun:stun.l.google.com:19302",
    }],
  }

  const idPeer = fromIdPeer
  const peerConnection = new RTCPeerConnection(configuracion)

  peerConnection.ontrack = (event) => {
    console.log({ event })
    const [stream] = event.streams
    addVideoToDocument(stream, fromIdUser)
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateSender = {
        type: 'candidate',
        candidate: event.candidate,
        toIdUser: fromIdUser,
        toIdPeer: localUser.id
      }

      // console.log('evento candidato', event, candidateSender)

      sendMessageWebSocket(candidateSender)
    }
  }

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState
    console.log('ICE Connection State:', state)

    if (state === 'connected') {
      console.log('RTC Conectado')
    } else if (state === 'disconnected') {
      window.alert('RTC Desconectado')
    }
  }

  // const idPeer = crypto.randomUUID()
  peerConnections[idPeer] = {
    peer: peerConnection
  }
  // crear un peer y devolver el peer recibido de la oferta

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  const offer = {
    type,
    sdp
  }

  await peerConnection.setRemoteDescription(
    new window.RTCSessionDescription(offer)
  )
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)

  const answerSender = {
    type: answer.type,
    sdp: answer.sdp,
    toIdUser: fromIdUser,
    fromIdUser: toIdUser,
    toIdPeer: fromIdPeer,
    fromIdPeer: toIdPeer
  }

  sendMessageWebSocket(answerSender)
}

async function handlerAnswer(dataAnswer) {
  const { type, sdp, toIdUser, fromIdUser, fromIdPeer } = dataAnswer
  // console.log('recibiendo answer de', fromIdUser, 'para', toIdUser)

  // console.log(`setear el valor para el peer`, peerConnections[fromIdPeer])
  // console.log({ peerConnections, fromIdPeer })
  const peer = peerConnections[fromIdPeer].peer
  if (peer.signalingState !== 'stable') {
    const answer = {
      type,
      sdp
    }
    await peer.setRemoteDescription(
      new window.RTCSessionDescription(answer)
    )
  }
}

async function handlerCandidate(dataCandidate) {
  console.log(dataCandidate)
  const { candidate, toIdPeer } = dataCandidate

  console.log({ peerConnections, toIdPeer })

  const peer = peerConnections[toIdPeer].peer
  if (!peer) return

  const iceCandidate = new window.RTCIceCandidate(candidate)
  await peer.addIceCandidate(iceCandidate)
}

document.addEventListener('DOMContentLoaded', () => {
  localUser = { id: crypto.randomUUID() }
  $('#user').textContent = localUser.id
})
