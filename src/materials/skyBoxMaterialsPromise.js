import * as THREE from "three";
import loadManager from "../loadManager";

const textureLoader = new THREE.TextureLoader(loadManager);

function loadColorTexture (path) {
    const texture = textureLoader.load( path );
    // const textureRepeatScale = 10;
    // texture.repeat.set(textureRepeatScale, textureRepeatScale);
    // texture.repeat.x = textureRepeatScale;
    // texture.repeat.y = textureRepeatScale;
    // texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.SRGBColorSpace;
    return { // new MeshStandardNodeMaterial({
        // color: 0x00FF00,
        map: texture,
        opacity: 1.0,
        side: THREE.BackSide,
        // transparent: true,
        // alphaTest: 0.025
    };
}

const meshMaterials = [
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_ft.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_bk.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_up.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_dn.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_rt.jpg')),
    new THREE.MeshBasicMaterial(loadColorTexture('assets/material/textures/penguins-skybox-pack/penguins (9)/divine_lf.jpg')),
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
