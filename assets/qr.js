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

async function generateRandomString (bytes) {
  const arr = await crypt.getRandomBytes(bytes)
  return window.btoa(arr).split('=').join('').split('/').join('')
}

async function generateChannelId () {
  const randomString = await generateRandomString(2)
  return `jim3692_clipboard-io_${randomString}`
}

const qrcode = new window.QRCode('qr', {
  width: 384,
  height: 384,
  colorDark: '#000000',
  colorLight: '#ffffff',
  correctLevel: window.QRCode.CorrectLevel.H
})

const crypt = new OpenCrypto()

async function signData ({ auth, data }) {
  const str = JSON.stringify({ auth, data })
  return await crypt.hashPassphrase(str, new TextEncoder().encode(salt))
}

async function validateData ({ auth, data, signature }) {
  const hash = await signData({ auth, data })
  return hash === signature
}

const keyPair = await crypt.getRSAKeyPair()
const pem = await crypt.cryptoPublicToPem(keyPair.publicKey)

const channelId = await generateChannelId()
const token = await generateRandomString(4)
const salt = await generateRandomString(6)
const socket = new window.WebSocket(`wss://ntfy.sh/${channelId}/ws`)

socket.addEventListener('open', onSocketConnected)

socket.addEventListener('close', function () {
  window.location.reload()
})

socket.addEventListener('error', function () {
  window.location.reload()
})

socket.addEventListener('message', function (event) {
  const data = JSON.parse(event.data).message

  if (!data) {
    return
  }

  try {
    const payload = JSON.parse(data)

    if (!payload.auth?.token || payload.auth.token !== token) {
      console.log('Invalid token')
      return
    }

    if (!payload.data || !payload.signature || !validateData(payload)) {
      console.log('Invalid signature')
      return
    }

    if (payload.data.ready) {
      console.log('Sending PEM ...')
      return sendPem()
    }

    if (payload.data.encryptedChunks) {
      console.log('Decrypting ...')
      return onSocketData(payload.data.encryptedChunks)
    }
  } catch (err) {
    console.dir({ error: err.message, get data () { return data } })
  }
})

async function onSocketConnected () {
  const qrUrl = new URL(window.location)
  qrUrl.pathname = '/send.html'
  qrUrl.search = `channel_id=${channelId}&token=${token}&salt=${salt}`

  console.log(qrUrl.href)

  qrcode.clear()
  qrcode.makeCode(qrUrl.href)
}

async function onSocketData (encryptedChunks) {
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

async function sendPem () {
  const auth = { token }
  const data = { pem }
  const signature = await signData({ auth, data })

  await window.fetch(`https://ntfy.sh/${channelId}`, {
    method: 'POST',
    body: JSON.stringify({ auth, data, signature })
  })
}
