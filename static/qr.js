import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'

const valueEl = document.getElementById('value')
const visibleEl = document.getElementById('visible')

valueEl.onmouseover = () => {
  valueEl.select()
}

valueEl.onclick = () => {
  navigator.clipboard.writeText(valueEl.value)
}

visibleEl.onclick = () => {
  valueEl.setAttribute('type', visibleEl.checked ? 'text' : 'password')
}

const qrcode = new window.QRCode('qr', {
  width: 256,
  height: 256,
  colorDark: '#000000',
  colorLight: '#ffffff',
  correctLevel: window.QRCode.CorrectLevel.H
})

const crypt = new OpenCrypto()

const keyPair = await crypt.getRSAKeyPair()
const pem = await crypt.cryptoPublicToPem(keyPair.publicKey)

const socket = window.io()

socket.on('connect', async () => {
  const qrUrl = new URL(window.location)
  qrUrl.pathname = `/submit/${socket.id}`
  qrUrl.search = ''

  qrcode.clear()
  qrcode.makeCode(qrUrl.href)
})

socket.on('data', async (data) => {
  console.log(data)
  const decrypted = await crypt.rsaDecrypt(keyPair.privateKey, data)
  const decoded = new TextDecoder('utf-8').decode(decrypted)
  console.log(decoded)
  valueEl.value = decoded
})

socket.on('get-public-pem', () => {
  socket.emit('public-pem', window.encodeURIComponent(pem))
})
