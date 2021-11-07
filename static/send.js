import OpenCrypto from 'https://cdn.jsdelivr.net/npm/opencrypto@1.5.5/src/OpenCrypto.min.js'

const crypt = new OpenCrypto()

const url = new URL(window.location)
const id = url.searchParams.get('id')
const pem = url.searchParams.get('pem')

console.log(pem)

const key = await crypt.pemPublicToCrypto(pem)
  .catch(err => console.error(err))

const form = document.querySelector('form')

form.onsubmit = async (event) => {
  event.preventDefault()

  try {
    const encoded = new TextEncoder().encode(form.data.value)
    const encrypted = await crypt.rsaEncrypt(key, encoded)
    console.log(encrypted)

    window.fetch(`/submit/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({ data: encrypted })
    }).then(() => window.close())
  } catch (err) {
    console.error(err)
  }
}
