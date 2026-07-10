let featureModulesPromise = null;
let devtoolModulePromise = null;
let xlsxScriptPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

function afterFirstPaint(callback) {
    requestAnimationFrame(() => {
        setTimeout(callback, 0);
    });
}

function ensureXlsxScript() {
    if (!xlsxScriptPromise) {
        xlsxScriptPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }

    return xlsxScriptPromise;
}

function ensureFeatureModules() {
    if (!featureModulesPromise) {
        featureModulesPromise = Promise.all([
            import('./hexify.js'),
            import('./getSpecificHex.js'),
            import('./scrambleNormalizer.js'),
            import('./scrambleGenner.js'),
            import('./draw-scramble.js'),
            import('./drawScramsInteractive.js')
        ]).then(([
            hexify,
            hexState,
            scrambleNormalizer,
            scrambleGenner,
            drawScramble,
            interactiveScramble
        ]) => ({
            drawScramble,
            hexify,
            hexState,
            interactiveScramble,
            scrambleGenner,
            scrambleNormalizer
        }));
    }

    return featureModulesPromise;
}

function preloadDeferredCode() {
    return Promise.allSettled([
        ensureFeatureModules(),
        ensureXlsxScript()
    ]);
}

function ensureDevtoolModule() {
    if (!devtoolModulePromise) {
        devtoolModulePromise = import('./devtool.js');
    }

    return devtoolModulePromise;
}

async function openDevtoolFullscreen() {
    const { showJsonCreatorFullscreen } = await ensureDevtoolModule();
    showJsonCreatorFullscreen();
}

window.showJsonCreatorFullscreen = openDevtoolFullscreen;

export {
    afterFirstPaint,
    ensureDevtoolModule,
    ensureFeatureModules,
    ensureXlsxScript,
    openDevtoolFullscreen,
    preloadDeferredCode
};
