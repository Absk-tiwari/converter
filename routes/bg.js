const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
import '@tensorflow/tfjs-node'; // Force tfjs to use native Node backend

const { removeBackground } = require('@imgly/background-removal');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename   : (_, file, cb) => {
    let filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`
    file._modified = filename;
    cb(null, filename)
  }
});

const upload = multer({ storage });

router.post('/remove', upload.single('images'), async(req , res) => {

    if (!req.file) {
        return res.status(400).json({ error: 'No file received' });
    }

    try {
        const input = fs.readFileSync(req.file.path);

        const output = await removeBackground(input, {
            model: 'isnet_fp16', // Or 'u2netp' for faster, lower quality
            outputType: 'image/png', // Transparent background
        });
        
        fs.writeFileSync('output.png', output);
        console.log('✅ Background removed and saved to output.png');

        return res.json({message:"done ?"})

    } catch (error) {
        console.log(error);
    }

})

module.exports = router;