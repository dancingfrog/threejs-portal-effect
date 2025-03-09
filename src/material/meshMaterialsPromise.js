import * as THREE from "three";
import loadManager from "../loadManager";

const textureLoader = new THREE.TextureLoader(loadManager);

function loadColorTexture (path) {
    const texture = textureLoader.load( path );
    const textureRepeatScale = 10;
    texture.repeat.set(textureRepeatScale, textureRepeatScale);
    // texture.repeat.x = textureRepeatScale;
    // texture.repeat.y = textureRepeatScale;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace;
    return { // new MeshStandardNodeMaterial({
        // color: 0x00FF00,
        map: texture,
        opacity: 1.0,
        side: THREE.DoubleSide,
        // transparent: true,
        // alphaTest: 0.025
    };
}

const meshMaterials = [
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-1.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-2.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-3.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-4.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-5.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('material/textures/flower-6.jpg')),
];

export default new Promise((resolve, reject) => {
    loadManager.addLoadHandler(() => {
        setTimeout(
            resolve,
            1000,
            meshMaterials
        );
    });
});
