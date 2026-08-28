# EVAN COFFEE — Railway

This package is prepared for Railway. It is a static website served by a tiny Node.js server.

## Files
- `index.html` — home page
- `menu.html` — digital menu
- `contact.html` — contact/location
- `qr.html` — QR generator page
- `server.js` — Railway web server
- `package.json` — start script
- bakery image files — menu assets

## Start locally
```bash
npm start
```
Then open http://localhost:3000

## Railway
1. Create a GitHub repository and upload this folder.
2. In Railway, create a New Project and deploy the GitHub repository.
3. Railway detects Node.js and runs `npm start`.
4. After deployment, open Service → Settings → Networking → Public Networking → Generate Domain.
5. Open the generated `https://....up.railway.app` URL.
6. Use that public URL in `qr.html` to create the table QR code.
