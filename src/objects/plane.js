import * as THREE from "three";
import planeGeometry from "../geometry/planeGeometry";
import meshMaterial from "../material/meshMaterial";

const plane = new THREE.Mesh(planeGeometry, meshMaterial);

plane.rotateX(-Math.PI / 2);
plane.position.y = 0;

export default plane;
