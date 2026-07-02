const ImageTracer = require('imagetracerjs');
const fs = require('fs');

ImageTracer.imageToSVG(
    'public/logo.png',
    function(svgstr) { fs.writeFileSync( 'public/logo.svg', svgstr ); },
    'default'
);
