const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, 'public', 'logo.png');
const tempPath = path.join(__dirname, 'public', 'logo_temp.png');

async function processImage() {
  try {
    const img = sharp(inputPath);
    const metadata = await img.metadata();
    
    // Trim the image to remove transparent borders
    const trimmed = img.trim();
    const trimmedBuffer = await trimmed.toBuffer();
    
    const trimmedImg = sharp(trimmedBuffer);
    const trimmedMeta = await trimmedImg.metadata();
    
    console.log(`Original size: ${metadata.width}x${metadata.height}`);
    console.log(`Trimmed size: ${trimmedMeta.width}x${trimmedMeta.height}`);
    
    // Determine the max dimension to make it square
    const maxDim = Math.max(trimmedMeta.width, trimmedMeta.height);
    
    // We want the icon to be large, so 5% padding on each side -> the content takes up 90%
    const targetSize = Math.ceil(maxDim / 0.9);
    
    // Create a new square image with transparent background
    await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      {
        input: trimmedBuffer,
        gravity: 'center'
      }
    ])
    .png()
    .toFile(tempPath);
    
    // Replace the original file
    fs.renameSync(tempPath, inputPath);
    
    console.log('Successfully enlarged the logo inside the canvas.');
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

processImage();
