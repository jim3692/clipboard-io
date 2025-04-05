import OpenCrypto from '/lib/OpenCrypto.min.js'

const SERVER = 'ntfy.sh'
const HTTP_ENDPOINT = `https://${SERVER}`
const WS_ENDPOINT = `wss://${SERVER}`

const CHANNEL_LENGTH = 8
const TOKEN_LENGTH = 8
const SALT_LENGTH = 24

const SENDER_SERVER = 'server'
const SENDER_CLIENT = 'client'

const crypt = new OpenCrypto()

export default class ClipTransport {
  constructor ({ channelId, token, salt, onSocketConnected, onSocketData }) {
    // Used for debugging
    // window.clipTransport = this

    this.channelId = channelId
    this.token = token
    this.salt = salt

    // Server generates the clientId
    const isServer = !channelId

    // Prevent messages being sent from an instance, being handled from the same
    this.peerName = isServer ? SENDER_SERVER : SENDER_CLIENT

    // Synchronization
    this.messageCounter = 0
    this.messageAttempt = 0

    // Prevent payload duplication when retrying to send a message
    this.lastAcknowledgedAttempt = -1

    // Prevent new messages from being handled when out of sync
    this.waitingForAcknowledgement = false

    this.onSocketConnected = onSocketConnected
    this.onSocketData = onSocketData
  }

  async init () {
    this.channelId = this.channelId || await this.generateChannelId()
    this.token = this.token || await this.generateRandomString(TOKEN_LENGTH)
    this.salt = this.salt || await this.generateRandomString(SALT_LENGTH)

    this.connectToSocket()
  }

  connectToSocket () {
    if (this.socket?.readyState === window.WebSocket.OPEN) {
      this.socket.close()
    }

    this.socket = new window.WebSocket(`${WS_ENDPOINT}/${this.channelId}/ws`)

    this.socket.addEventListener('open', this.onSocketConnected.bind(this))
    this.socket.addEventListener('close', this.onSocketClosed.bind(this))
    this.socket.addEventListener('error', this.onSocketClosed.bind(this))
    this.socket.addEventListener('message', this.onSocketMessage.bind(this))
  }

  onSocketMessage (event) {
    const data = JSON.parse(event.data).message

    if (!data) {
      return
    }

    try {
      const payload = JSON.parse(data)

      // Discard malformed payloads
      if (!payload?.header || !payload?.data || !payload?.signature) {
        console.log('Invalid payload')
        return
      }

      // Discard messages with invalid signature
      if (!this.validateData(payload)) {
        console.log('Invalid signature')
        return
      }

      // Discard messages sent from this instance
      if (payload.header.sender === this.peerName) {
        return
      }

      // Discard messages with wrong token
      if (!payload.header.token || payload.header.token !== this.token) {
        console.log('Invalid token', payload.header.token)
        return
      }

      // Handle ACK for last sent message
      if (payload.data.ack && payload.header.counter === this.messageCounter) {
        console.log('ACK', payload.header.counter)
        this.messageCounter++
        this.messageAttempt = 0
        this.lastAcknowledgedAttempt = -1
        this.waitingForAcknowledgement = false
        return
      }

      // Resend ACK for the last handled message
      if (payload.header.counter === this.messageCounter - 1 && payload.header.attempt > this.lastAcknowledgedAttempt) {
        this.lastAcknowledgedAttempt = payload.header.attempt
        this.send({ ack: 1 }, { attempt: payload.header.attempt, counter: payload.header.counter })
        return
      }

      // Abort if ACK has not been received for last message
      if (this.waitingForAcknowledgement) {
        console.log('waitingForAcknowledgement', this)
        return
      }

      // Validate message counter
      if (payload.header.counter !== this.messageCounter) {
        console.log('Invalid counter', payload.header.counter)
        return
      }

      this.send({ ack: 1 })
      this.messageCounter++
      this.onSocketData(payload.data)
    } catch (err) {
      console.dir({ error: err.message, get data () { return data } })
    }
  }

  async onSocketClosed () {
    await this.waitMs(5000)
    this.connectToSocket()
  }

  async send (data, { attempt, counter } = {}) {
    const header = {
      token: this.token,
      sender: this.peerName,
      counter: counter || this.messageCounter,
      attempt: attempt || this.messageAttempt
    }

    if (this.waitingForAcknowledgement && !data.ack && attempt === 0) {
      return await this.sendLater(data)
    }

    this.messageAttempt = header.attempt
    const signature = await this.signData({ header, data })

    await window.fetch(`${HTTP_ENDPOINT}/${this.channelId}`, {
      method: 'POST',
      body: JSON.stringify({ header, data, signature })
    })

    if (!data.ack) {
      this.waitingForAcknowledgement = true
    }

    await this.resendLater({ header, data })
  }

  async resendLater ({ header, data }) {
    await this.waitMs(10000)
    header.attempt++
    if (this.waitingForAcknowledgement && this.messageCounter === header.counter) {
      return await this.send(data, { attempt: header.attempt, counter: header.counter })
    }
  }

  async sendLater (data) {
    await this.waitMs(10000)
    await this.send(data)
  }

  waitMs (ms) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms)
    })
  }

  async generateRandomString (bytes) {
    const arr = await crypt.getRandomBytes(bytes)
    const str = String.fromCharCode(...arr)
    return window.btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/m, '')
  }

  async generateChannelId () {
    const randomString = await this.generateRandomString(CHANNEL_LENGTH)
    return randomString
  }

  async signData ({ header, data }) {
    const str = JSON.stringify({ header, data })
    return await crypt.hashPassphrase(str, new TextEncoder().encode(this.salt))
  }

  async validateData ({ header, data, signature }) {
    const hash = await this.signData({ header, data })
    return hash === signature
  }
}
