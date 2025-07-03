// 2 routes:
//   POST /convert/multiple   → ZIP of .webp images   (input: images[])
//   POST /convert/single     → single .webp blob     (input: image)

const express  = require('express');
const multer   = require('multer');
const sharp    = require('sharp');
const archiver = require('archiver');
const fs       = require('fs');
const path     = require('path');

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Multer disk storage setup                                         */
/* ------------------------------------------------------------------ */

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename   : (_, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const upload = multer({ storage });

/* ------------------------------------------------------------------ */
/*  1. MULTIPLE → ZIP                                                 */
/*      POST /convert/multiple   field: images  (max 20 files)         */
/* ------------------------------------------------------------------ */

router.get('/', async(req,res)=> {
    res.render('index');
})

router.post('/convert-multiple', upload.array('images', 20), async (req, res) => {

  if (!req.files?.length) {
    return res.status(400).json({ error: 'No files received' });
  }

  const _meta = JSON.parse(req.body._meta);

  // stream the zip straight to the client
  res.set({
    'Content-Type'        : 'application/zip',
    'Content-Disposition' : 'attachment; filename="converted.zip"'
  });

  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.pipe(res);

  try {
    for (const file of req.files) {

        const inputPath = file.path;
        const format = _meta[file.originalname].toLowerCase();
        const convertedBuffer = await sharp(inputPath).toFormat(format).toBuffer();
        const baseName = path.basename(file.originalname, path.extname(file.originalname));

        zip.append(convertedBuffer, { name: `${baseName}-converted.${format}` });
        fs.unlink(file.path, () => {});      // clean temp upload

    }
    await zip.finalize();
  } catch (err) {
    console.error('ZIP conversion error:', err);
    res.status(500).end();
  }
});

/* ------------------------------------------------------------------ */
/*  2. SINGLE → WEBP BLOB                                             */
/*      POST /convert/single     field: image                          */
/* ------------------------------------------------------------------ */

router.post('/convert/single', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file received' });
  }

  try {
    const webpBuffer = await sharp(req.file.path).webp({ quality: 90 }).toBuffer();
    fs.unlink(req.file.path, () => {});    // clean temp upload

    res.set({
      'Content-Type'       : 'image/webp',
      'Content-Disposition': 'inline; filename="converted.webp"'
    });
    res.end(webpBuffer);                   // sends blob to client
  } catch (err) {
    console.error('Single conversion error:', err);
    res.status(500).end();
  }
});

/* ------------------------------------------------------------------ */
/*  EXPORT ROUTER                                                     */
/* ------------------------------------------------------------------ */

module.exports = router;