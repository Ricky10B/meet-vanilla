import { isHaveCamera } from './isHaveCamera'
import './style.css'
import { generateRandomRGBColor } from './utilities/generateRandomRGBColor'
import { $ } from './utilities/selector'
import { connectToWebSocket, sendMessageWebSocket, closeWebSocket } from './websocket'

// VARIABLES
const startVideoCall = $('.startVideoCall')
const endVideoCall = $('.endVideoCall')
const stopAudio = $('.stopAudio')
const stopVideo = $('.stopVideo')
const shareScreen = $('.shareScreen')
// const sendMessage = $('.sendMessage')
const containerVideos = $('#videos')

const listUsers = []
const peerConnections = {}
const listIdsVideoAddeds = {}
const TYPES_MESSAGES_WEB_SOCKET = {
  'user_connect': handlerUserConnect,
  'users': handlerAddAllUsersConnected,
  'new-user-connected': handlerNewUserConnected,
  'offer': handlerOffer,
  'answer': handlerAnswer,
  'candidate': handlerCandidate,
  'user-disconnected': handlerUserDisconnect
}

let localStream
let localUser = { id: null }

// LISTENERS
startVideoCall.addEventListener('click', startConnection)
endVideoCall.addEventListener('click', endConnection)
stopAudio.addEventListener('click', () => handlerEnabledTracks('audio'))
stopVideo.addEventListener('click', () => handlerEnabledTracks('video'))
shareScreen.addEventListener('click', handlerShareScreen)

// FUNCTIONS
async function startConnection() {
  const stream = await startVideo()
  addVideoToDocument(stream)
  connectToWebSocket(handlerOnMessageWebSocket)
}

function endConnection() {
  sendMessageWebSocket({ type: 'user-disconnected', idPeerDisconnected: localUser.id })
  endVideo()
  removeVideoFromDocument()
  closePeerConnection()
  closeWebSocket()
}

function handlerUserDisconnect(dataUserDisconnected) {
  console.log({ dataUserDisconnected, peerConnections })
  const idUserRemote = dataUserDisconnected.idPeerDisconnected
  // const peer = new RTCPeerConnection()
  const peer = peerConnections[idUserRemote]?.peer
  if (!peer) return
  // peer.getSenders().forEach(sender => sender.track.stop())

  if (peer.connectionState === 'connected') peer.close()

  removeVideoFromDocument(idUserRemote)
  delete peerConnections[idUserRemote]
  console.log({ peerConnections })
}

async function startVideo() {
  const hasCamera = await isHaveCamera()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: hasCamera,
      audio: true,
    })

    localStream = stream
    return stream
  } catch (error) {
    console.error(error)
    throw error
  }
}

function endVideo() {
  const tracks = localStream.getTracks()
  if (tracks) tracks.forEach(track => track.stop())
  localStream = null
}

function addVideoToDocument(stream, idVideo) {
  if (listIdsVideoAddeds[stream.id]) return
  listIdsVideoAddeds[stream.id] = stream.id

  const video = document.createElement('video')
  let classVideo = 'local'
  if (idVideo) {
    classVideo = idVideo.replaceAll('.', '').replaceAll('!', '')
  }
  video.classList.add('video', `video-${classVideo}`)
  video.srcObject = stream
  video.autoplay = true
  // video.muted = true
  if (stream == null) {
    video.style.background = generateRandomRGBColor()
  }
  containerVideos.appendChild(video)
}

function removeVideoFromDocument(idVideoToRemove) {
  let classVideo = 'local'
  if (idVideoToRemove) {
    classVideo = idVideoToRemove.replaceAll('.', '').replaceAll('!', '')
  }
  $(`.video-${classVideo}`)?.remove()
}

function handlerEnabledTracks(type) {
  const tracks = localStream.getTracks()
  tracks.forEach(track => {
    if (track.kind === type) {
      track.enabled = !track.enabled
      if (type === 'audio') {
        stopAudio.textContent = track.enabled ? 'quitar audio' : 'poner audio'
      } else if (type === 'video') {
        stopVideo.textContent = track.enabled ? 'quitar video' : 'poner video'
        $('.video-local').style.background = generateRandomRGBColor()
      }
    }
  })
}

function handlerOnMessageWebSocket(event) {
  console.log(event)
  const data = JSON.parse(event.data)
  if (data.toIdUser != null && data.toIdUser !== localUser.id) return

  const functionMessageWebSocket = TYPES_MESSAGES_WEB_SOCKET[data.type]
  typeof functionMessageWebSocket === 'function'
    ? functionMessageWebSocket(data)
    : console.log('opcion invalida')
}

async function handlerShareScreen() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  addVideoToDocument(screenStream, localUser.id)
  screenStream.getTracks().forEach(track => {
    const listIdsPeerConnection = Object.keys(peerConnections)
    listIdsPeerConnection.forEach(idPeerConnection => {
      console.log({ track, idPeerConnection, peerConnections })
      peerConnections[idPeerConnection].peer.addTrack(track, screenStream)
    })
  })
}

function handlerUserConnect(dataUserConnect) {
  console.log({ dataUserConnect })
  const id = dataUserConnect.channel_name
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
    console.log({ event })
    // const [stream] = event.streams
    event.streams.forEach(stream => {
      addVideoToDocument(stream, user.id)
    })
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

function closePeerConnection() {
  localUser = { id: null }
  $('#user').textContent = ''
  // tomar todos los usuarios de peerConnections y cerrar los peers
  const idsPeers = Object.keys(peerConnections)
  idsPeers.forEach(idPeer => {
    handlerUserDisconnect({ idPeerDisconnected: idPeer })
  })
}
