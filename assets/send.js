import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'

const url = new URL(window.location)
const channelId = url.searchParams.get('channel_id')
const token = url.searchParams.get('token')
const salt = url.searchParams.get('salt')
const socket = new window.WebSocket(`wss://ntfy.sh/${channelId}/ws`)

const crypt = new OpenCrypto()

async function signData ({ auth, data }) {
  const str = JSON.stringify({ auth, data })
  return await crypt.hashPassphrase(str, new TextEncoder().encode(salt))
}

async function validateData ({ auth, data, signature }) {
  const hash = await signData({ auth, data })
  return hash === signature
}

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

    if (payload.data.pem) {
      console.log('Received PEM')
      return onPem(payload.data.pem)
    }
  } catch (err) {
    console.dir({ error: err.message, get data () { return data } })
  }
})

async function onSocketConnected () {
  const auth = { token }
  const data = { ready: true }
  const signature = await signData({ auth, data })

  await window.fetch(`https://ntfy.sh/${channelId}`, {
    method: 'POST',
    body: JSON.stringify({ auth, data, signature })
  })
}

async function onPem (pem) {
  const key = await crypt.pemPublicToCrypto(pem)

  const form = document.querySelector('form')
  form.className = ''

  form.onsubmit = async (event) => {
    event.preventDefault()

    try {
      const encoded = new TextEncoder().encode(form.data.value)

      const chunks = []

      const CHUNK_SIZE = 50 + Math.floor(Math.random() * 50)
      for (let i = 0; i < encoded.byteLength; i += CHUNK_SIZE) {
        const chunk = encoded.subarray(i, i + CHUNK_SIZE)
        chunks.push(chunk)
      }

      const encryptedChunks = await Promise.all(
        chunks.map(chunk => crypt.rsaEncrypt(key, chunk))
      )

      const auth = { token }
      const data = { encryptedChunks }
      const signature = await signData({ auth, data })

      await window.fetch(`https://ntfy.sh/${channelId}`, {
        method: 'POST',
        body: JSON.stringify({ auth, data, signature })
      }).then(() => window.close())
    } catch (err) {
      console.error(err)
    }
  }
}
