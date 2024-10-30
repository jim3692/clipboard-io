# Clipboard IO
*End to end encrypted clipboard*

It's pretty common to use a password manager. It's also common needing to enter those 20+ characters passwords on untrusted devices.

Instead of having to login to your password manager to copy that one password you need, just go to [clip.knp.one](https://clip.knp.one) and scan the QR with your phone to securely and quickly send your password.

## Technical Details

- All communications are end-to-end encrypted using RSA-2048
  - When the user first enters the page, a new key pair is generated
  - The public key is sent to the other device, when the QR is scanned
- All data is transferred using [ntfy.sh](https://ntfy.sh)
  - When the user first enters the page, a random channel is selected
  - The target channel info is added in the QR

## Resources

- [ntfy.sh](https://ntfy.sh)
- [OpenCrypto](https://github.com/safebash/opencrypto)
- [qrcodejs](https://github.com/davidshimjs/qrcodejs)
