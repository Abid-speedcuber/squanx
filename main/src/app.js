import { afterFirstPaint, preloadDeferredCode } from './moduleLoader.js';
import { AppState, generateNewScramble, initApp } from './training.js';

window.__sq1FeaturePreloadDone = false;

const initialMode = await initApp();
window.__sq1InitialMode = initialMode;

afterFirstPaint(() => {
    window.__sq1UiResponsive = performance.now();
    performance.mark('sq1:ui-responsive');

    const preload = preloadDeferredCode().then(() => {
        window.__sq1FeaturePreloadDone = performance.now();
        performance.mark('sq1:feature-preload-complete');
    });

    if (initialMode === 'trainer' && AppState.selectedCases.length > 0) {
        preload.then(() => generateNewScramble());
    }
});
