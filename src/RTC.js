import './style.css'
import { $ } from './utilities/selector'
import { connectToWebSocket, sendMessageWebSocket } from './websocket'

// VARIABLES
const startVideoCall = $('.startVideoCall')
// const sendMessage = $('.sendMessage')
const containerVideos = $('#videos')

const listUsers = []
const peerConnections = {}
const listIdsVideoAddeds = {}
const TYPES_MESSAGES_WEB_SOCKET = {
  'isCaller': handlerIsCaller,
  'users': handlerAddAllUsersConnected,
  'new-user-connected': handlerNewUserConnected,
  // 'response-all-users-connected': handlerAddAllUsersConnected,
  'offer': handlerOffer,
  'answer': handlerAnswer,
  'candidate': handlerCandidate
}

let localStream
let localUser = { id: null }

// LISTENERS
startVideoCall.addEventListener('click', startConnection)

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

  if (data.users) data.type = 'users'
  if (data.toIdUser != null && data.toIdUser !== localUser.id) return

  const functionMessageWebSocket = TYPES_MESSAGES_WEB_SOCKET[data.type]
  typeof functionMessageWebSocket === 'function'
    ? functionMessageWebSocket(data)
    : console.log('opcion invalida')
}

function handlerIsCaller(dataIsCaller) {
  const { id } = dataIsCaller
  localUser.id = id
  $('#user').textContent = id

  sendMessageWebSocket({ type: 'new-user-connected', user: localUser })
  sendMessageWebSocket({ type: 'users' })
}

function handlerNewUserConnected(dataUser) {
  listUsers.push(dataUser.user)
  // sendMessageWebSocket({ type: 'response-all-users-connected', users: [...listUsers, localUser] })
}

function handlerAddAllUsersConnected(data) {
  for (const user of data.users) {
    const userExists = listUsers.find(prevUser => prevUser.id === user.channel_name)
    if (!userExists && user.channel_name !== localUser.id) {
      user.id = user.channel_name
      listUsers.push(user)
      createOffer(user, localUser)
    }
  }
}

function createPeerConnection(user) {
  const configuracion = {
    iceServers: [{
      urls: "stun:stun.l.google.com:19302",
    }],
  }

  const idPeer = user.id
  const peerConnection = new RTCPeerConnection(configuracion)

  peerConnection.ontrack = (event) => {
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

      sendMessageWebSocket(candidateSender)
    }
  }

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState

    if (state === 'connected') {
      console.log('RTC Conectado')
    } else if (state === 'disconnected') {
      window.alert('RTC Desconectado')
    }
  }

  peerConnections[idPeer] = {
    peer: peerConnection
  }

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  return peerConnection
}

async function createOffer(user, localUser) {
  const peerConnection = createPeerConnection(user)
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  const offerSender = {
    type: offer.type,
    sdp: offer.sdp,
    toIdUser: user.id,
    fromIdUser: localUser.id,
    toIdPeer: user.id,
    fromIdPeer: localUser.id
  }

  sendMessageWebSocket(offerSender)
}

async function handlerOffer(dataOffer) {
  const { type, sdp, toIdUser, fromIdUser, toIdPeer, fromIdPeer } = dataOffer

  const peerConnection = createPeerConnection({ id: fromIdPeer })
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
  const { type, sdp, fromIdPeer } = dataAnswer

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
  const { candidate, toIdPeer } = dataCandidate

  const peer = peerConnections[toIdPeer].peer
  if (!peer) return

  const iceCandidate = new window.RTCIceCandidate(candidate)
  await peer.addIceCandidate(iceCandidate)
}
