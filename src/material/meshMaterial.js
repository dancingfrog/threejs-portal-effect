import * as THREE from "three";

import loadManager from "../loadManager";

function mipmap (size, color) {

    const imageCanvas = document.createElement( 'canvas' );
    const context = imageCanvas.getContext( '2d' );

    imageCanvas.width = imageCanvas.height = size;

    context.fillStyle = '#444';
    context.fillRect( 0, 0, size, size );

    context.fillStyle = color;
    context.fillRect( 0, 0, size / 2, size / 2 );
    context.fillRect( size / 2, size / 2, size / 2, size / 2 );
    return context;

}

let texture_loaded = false;

const canvasBitmap = mipmap( 256, '#f00' );
// const texture = new THREE.CanvasTexture(canvasBitmap.canvas);
const textureLoader = new THREE.TextureLoader(loadManager);
// const texture = textureLoader.load('material/textures/wall.jpg');
const texture = textureLoader.load('material/textures/mip-low-res-enlarged.png')

textureLoader.load('material/textures/mipmap-256.png', (t0) => {

    console.log("Load mipmap[0]");

    textureLoader.load('material/textures/mipmap-128.png', (t1) => {

        console.log("Load mipmap[1]");

        textureLoader.load('material/textures/mipmap-64.png', (t2) => {

            console.log("Load mipmap[2]");

            textureLoader.load('material/textures/mipmap-32.png', (t3) => {

                console.log("Load mipmap[3]");

                textureLoader.load('material/textures/mipmap-16.png', (t4) => {

                    console.log("Load mipmap[4]");

                    textureLoader.load('material/textures/mipmap-8.png', (t5) => {

                        console.log("Load mipmap[5]");

                        textureLoader.load('material/textures/mipmap-4.png', (t6) => {

                            console.log("Load mipmap[6]");

                            if (!!texture.image) {
                                console.log(texture.image);
                                /* !THIS DOM CALLBACK DOES NOT WORK/RUN...! */
                                // texture.image.onload = () => {
                                //     texture_loaded = true;
                                // }
                                texture.mipmaps[0] = texture.image;
                            } else {
                                texture.mipmaps[ 0 ] = t0.image;
                            }

                            texture.mipmaps[ 1 ] = t1.image;
                            texture.mipmaps[ 2 ] = t2.image;
                            texture.mipmaps[ 3 ] = t3.image;
                            texture.mipmaps[ 4 ] = t4.image;
                            texture.mipmaps[ 5 ] = t5.image;
                            texture.mipmaps[ 6 ] = t6.image;

                            texture_loaded = true;
                        });
                    });
                });
            });
        });
    });
});

loadManager.addLoadHandler(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    // texture.repeat.set( 1000, 1000);
    // texture.wrapS = THREE.RepeatWrapping;
    // texture.wrapT = THREE.RepeatWrapping;
    // texture.magFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    // texture.minFilter = THREE.LinearFilter;
    // texture.minFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    if (!texture_loaded) {
        console.log("meshMaterial mipmaps have not been initialized!");

        texture.mipmaps[0] = canvasBitmap.getImageData(0, 0, 256, 256); // .canvas;
        texture.mipmaps[1] = mipmap(128, '#0f0').getImageData(0, 0, 128, 128); // .canvas;
        texture.mipmaps[2] = mipmap(64, '#0f0').getImageData(0, 0, 64, 64); // .canvas;
        texture.mipmaps[3] = mipmap(32, '#00f').getImageData(0, 0, 32, 32); // .canvas;
        texture.mipmaps[4] = mipmap(16, '#404').getImageData(0, 0, 16, 16); // .canvas;
        texture.mipmaps[5] = mipmap(8, '#044').getImageData(0, 0, 8, 8); // .canvas;
        texture.mipmaps[6] = mipmap(4, '#044').getImageData(0, 0, 4, 4); // .canvas;
    }

    texture.mipmaps[7] = mipmap(2, '#040').getImageData(0, 0, 2, 2); // .canvas;
    texture.mipmaps[8] = mipmap(1, '#400').getImageData(0, 0, 1, 1); // .canvas;

    texture_loaded = true;
});


const meshMaterial = new THREE.MeshBasicMaterial({
    // color: 0x00FF00,
    map: texture,
    opacity: 1.0,
    side: THREE.DoubleSide,
    // transparent: true,
    // alphaTest: 0.025
});

export default meshMaterial;
