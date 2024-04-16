import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'
import ClipTransport from './transport.js'

const CHUNK_SIZE = 100

const url = new URL(window.location)
const channelId = url.searchParams.get('c')
const token = url.searchParams.get('t')
const salt = url.searchParams.get('s')

const crypt = new OpenCrypto()

const transport = new ClipTransport({
  channelId, token, salt, onSocketData, onSocketConnected
})
await transport.init()

function onSocketData (data) {
  if (data.pem) {
    console.log('Received PEM')
    return onPem(data.pem)
  }
}

async function onSocketConnected () {
  await transport.send({ ready: true })
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

      for (let i = 0; i < encoded.byteLength; i += CHUNK_SIZE) {
        const chunk = encoded.subarray(i, i + CHUNK_SIZE)
        chunks.push(chunk)
      }

      const encryptedChunks = await Promise.all(
        chunks.map(chunk => crypt.rsaEncrypt(key, chunk))
      )

      await transport.send({ encryptedChunks })
        .then(() => window.close())
    } catch (err) {
      console.error(err)
    }
  }
}
