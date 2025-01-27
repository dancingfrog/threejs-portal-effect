import * as THREE from "three";


const loadManager = new THREE.LoadingManager();

// <div id="loading">
//     <div class="progress"><div class="progressbar"></div></div>
// </div>
const loadingElem = document.createElement("div");
loadingElem.id = "loading";
const progressElem = document.createElement("div");
progressElem.className = "progress";
loadingElem.append(progressElem);
const progressBarElem = document.createElement("div");
progressBarElem.className = "progressbar";
progressElem.append(progressBarElem);

loadManager.div = loadingElem;

loadManager.handlers = [
    () => {
        loadingElem.style.opacity = 1.0;

        const fadeProgressBar =() => {
            loadingElem.style.opacity = loadingElem.style.opacity - 0.1;
            if (typeof fadeProgressBar == "function" && loadingElem.style.opacity > 0.0) {
                setTimeout(fadeProgressBar, 33);
            } else {
                loadingElem.style.display = 'none';
            }
        };

        fadeProgressBar();
    },
];

loadManager.addLoadHandler = (handler) => {
    loadManager.handlers.push(handler);
};

loadManager.onLoad = () => {
    loadManager.handlers.map(async (h) => (typeof h === "function") ? await h() : (() => {})());
};

loadManager.onProgress = (urlOfLastItemLoaded, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal;
    progressBarElem.style.transform = `scaleX(${progress})`;
};

export default loadManager;
