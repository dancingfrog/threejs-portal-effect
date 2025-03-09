// Setup canvas texture
import * as THREE from "three";

const textureCanvas = document.createElement('canvas');
const canvasTexture = new THREE.CanvasTexture(textureCanvas);

function randInt(min, max) {
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return Math.random() * (max - min) + min | 0;
}

function drawRandomDot(texture) {
    const ctx = texture.source.data.getContext('2d');

    ctx.strokeStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
    ctx.fillStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
    ctx.beginPath();

    const x = randInt(ctx.canvas.width);
    const y = randInt(ctx.canvas.height);
    const radius = randInt(10, 64);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    return ctx;
}

// for (let i = 0; i < 1000; i++) {
//     drawRandomDot(canvasTexture);
// }

function generateFaceLabel(texture, faceColor, textColor, text) {
    const ctx = texture.source.data.getContext('2d');

    ctx.canvas.width = ctx.canvas.height = 100;

    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const {width, height} = ctx.canvas;
    ctx.fillStyle = faceColor;
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${width * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(text, width / 2, height / 2);

    return ctx;
}

function generateFaceGrid(texture, gridColor, gridSpacingPixels) {

    const textureRepeatScale = gridSpacingPixels * gridSpacingPixels;
    texture.repeat.set(textureRepeatScale, textureRepeatScale);
    texture.repeat.x = textureRepeatScale;
    texture.repeat.y = textureRepeatScale;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace;

    const ctx = texture.source.data.getContext('2d');

    ctx.canvas.width = ctx.canvas.height = textureRepeatScale;

    const w = ctx.canvas.width,
        h = ctx.canvas.height;

    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    for (let x=gridSpacingPixels/2; x<=w; x+=gridSpacingPixels){
        ctx.save();
        ctx.translate(0.5, 0);
        ctx.moveTo(x-0.5,0);      // 0.5 offset so that 1px lines are crisp
        ctx.lineTo(x-0.5,h);
        ctx.restore();
    }
    for (let y=gridSpacingPixels/2;y<=h;y+=gridSpacingPixels){
        ctx.save();
        ctx.translate(0, 0.5);
        ctx.moveTo(0,y-0.5);
        ctx.lineTo(w,y-0.5);
        ctx.restore();
    }
    ctx.stroke();

    return ctx;
}

// generateFaceLabel(textureCanvasCtx, '#F00', '#0FF', '+X');
generateFaceGrid(canvasTexture, '#09F', 10.0);

export default canvasTexture;
