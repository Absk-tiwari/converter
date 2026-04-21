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
    const sharpFormats = ['tiff','png','jpg','webp','avif','svg'];
    for (const file of req.files) {

        const inputPath = file.path;
        const tformat = _meta[file.originalname].toLowerCase();

        let convertedBuffer, baseName;
        if(sharpFormats.includes(tformat)) {
            convertedBuffer = await sharp(inputPath).toFormat(tformat).toBuffer();
            baseName = path.basename(file.originalname, path.extname(file.originalname));
        }

        zip.append(convertedBuffer, { name: `${baseName}-converted.${tformat}` });
        fs.unlink(file.path, () => {});      // clean temp upload

    }
    await zip.finalize();
  } catch (err) {
    console.error('ZIP conversion error:', err);
    res.status(500).end();
  }
});

/* ------------------------------------------------------------------ */
/*  2. SINGLE → BLOB                                                  */
/*      POST /convert/single     field: image                         */
/* ------------------------------------------------------------------ */

router.post('/convert', upload.single('images'), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: 'No file received' });
  }

  try {
    const _meta = JSON.parse(req.body._meta);
    // const webpBuffer = await sharp(req.file.path).webp({ quality: 90 }).toBuffer();
    const tformat = _meta[req.file.originalname].toLowerCase();
    const sharpFormats = ['tiff','png','jpg','webp','avif'];
    let buffer;
    if(sharpFormats.includes(tformat)) {
        buffer = await sharp(req.file.path).toFormat(tformat).toBuffer();
        fs.unlink(req.file.path, () => {});    // clean temp upload
    } else {
        // unsupported-ones here for other modules
        if(tformat==='svg') {

            const filePath = req.file.path;
            const processedPath = `${filePath}.png`;
            try {
                // (Optional) Resize / normalize the image
                await sharp(filePath).resize(300).png().toFile(processedPath);
                // Convert to SVG using Potrace
                potrace.trace(processedPath, { threshold: 180 }, (err, svg) => {
                    fs.unlink(filePath, () => {});
                    fs.unlink(processedPath, () => {});
                    if (err) {
                        console.error("Trace error:", err);
                        return res.status(500).send('Conversion failed');
                    }
                    const svgBuffer = Buffer.from(svg, 'utf-8');
                    res.setHeader('Content-Type', 'image/svg+xml');
                    res.send(svgBuffer); // ✅ Return SVG directly
                });

            } catch (error) {
                console.error("Error:", error);
                fs.unlink(filePath, () => {});
                res.status(500).send('Something went wrong');
            }
        }

    }
    res.set({
      'Content-Type'       : 'image/webp',
      'Content-Disposition': `inline;filename="converted-${req.file.originalname}.${tformat}"`
    });
    res.end(buffer);

  } catch (err) {
    console.error('Single conversion error:', err);
    res.status(500).end();
  }
});

router.get('/terms-and-privacy', async(req,res) => {
    res.render("terms-and-privacy");
})
/* ------------------------------------------------------------------ */
/*  EXPORT ROUTER                                                     */
/* ------------------------------------------------------------------ */

module.exports = router;