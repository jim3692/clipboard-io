import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'
import ClipTransport from './transport.js'

const valueEl = document.getElementById('value')
const visibleEl = document.getElementById('visible')
const qrEl = document.getElementById('qr')

valueEl.onmouseover = () => {
  valueEl.select()
}

valueEl.onclick = () => {
  navigator.clipboard.writeText(valueEl.value)
}

visibleEl.onclick = () => {
  valueEl.setAttribute('type', visibleEl.checked ? 'text' : 'password')
}

qrEl.onclick = () => {
  const url = qrEl.getAttribute('title')
  if (url) {
    navigator.clipboard.writeText(url)
  }
}

const qrcode = new window.QRCode('qr', {
  width: 384,
  height: 384,
  colorDark: '#000000',
  colorLight: '#ffffff',
  correctLevel: window.QRCode.CorrectLevel.H
})

const crypt = new OpenCrypto()

const keyPair = await crypt.getRSAKeyPair()
const pem = await crypt.cryptoPublicToPem(keyPair.publicKey)

const transport = new ClipTransport({ onSocketConnected, onSocketData })
await transport.init()

async function onSocketConnected () {
  const qrUrl = new URL(window.location)
  qrUrl.pathname = '/send.html'
  qrUrl.search = `c=${transport.channelId}&t=${transport.token}&s=${transport.salt}`

  console.log(qrUrl.href)

  qrcode.clear()
  qrcode.makeCode(qrUrl.href)
}

function onSocketData (data) {
  if (data.ready) {
    console.log('Ready')
    return onReady()
  }

  if (data.encryptedChunks) {
    console.log('Received encrypted data')
    return onDataReceived(data)
  }
}

async function onDataReceived ({ encryptedChunks }) {
  console.log('Decrypting chunks ...')
  const decryptedChunks = await Promise.all(
    encryptedChunks.map(chunk => crypt.rsaDecrypt(keyPair.privateKey, chunk))
  )

  console.log('Merging chunks ...')
  const length = decryptedChunks.reduce((sum, chunk) => chunk.byteLength + sum, 0)
  const decrypted = new Uint8Array(length)
  let offset = 0
  for (const chunk of decryptedChunks) {
    decrypted.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  console.log('Decoding ...')
  const decoded = new TextDecoder('utf-8').decode(decrypted)
  valueEl.value = decoded
}

async function onReady () {
  await transport.send({ pem })
}
