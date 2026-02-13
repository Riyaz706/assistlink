// Polyfill to prevent setCustomSourceTransformer error
// This MUST run before any other modules load, especially react-native-maps
// Patch resolveAssetSource IMMEDIATELY when this module loads
// NOTE: Metro requires static require() calls - no dynamic requires allowed

(function patchResolveAssetSourceImmediately() {
  'use strict';
  
  // Patch function - patches resolveAssetSource.setCustomSourceTransformer
  const patchResolveAssetSource = function(resolveAssetSource) {
    if (!resolveAssetSource) return false;
    
    // CRITICAL: Always define setCustomSourceTransformer as a no-op function
    // This prevents "is not a function (it is undefined)" errors
    try {
      Object.defineProperty(resolveAssetSource, 'setCustomSourceTransformer', {
        value: function() {
          // No-op: This API is deprecated and not needed in Expo
          return undefined;
        },
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      try {
        resolveAssetSource.setCustomSourceTransformer = function() {
          return undefined;
        };
      } catch (e2) {
        // Ignore if assignment also fails
      }
    }
    return true;
  };
  
  // Hook into Module system BEFORE anything else loads
  try {
    const Module = require('module');
    if (Module) {
      // Patch Module._load to intercept ALL module loads
      const originalLoad = Module._load;
      if (originalLoad) {
        Module._load = function(request, parent, isMain) {
          const result = originalLoad.apply(this, arguments);
          
          // Patch resolveAssetSource when it's loaded
          if (result && typeof result === 'object') {
            if (request && (
              request.includes('resolveAssetSource') || 
              request.includes('Image/resolveAssetSource') ||
              request.includes('react-native/Libraries/Image') ||
              request.includes('react-native/src/Libraries/Image') ||
              request.includes('Libraries/Image/resolveAssetSource')
            )) {
              patchResolveAssetSource(result);
              if (result.default) {
                patchResolveAssetSource(result.default);
              }
            }
            
            // Also check if the result exports resolveAssetSource
            if (result.resolveAssetSource) {
              patchResolveAssetSource(result.resolveAssetSource);
            }
          }
          
          return result;
        };
      }
      
      // Also patch require.cache to patch already loaded modules
      if (Module._cache) {
        for (const key in Module._cache) {
          if (key && (
            key.includes('resolveAssetSource') ||
            key.includes('Image/resolveAssetSource') ||
            key.includes('react-native/Libraries/Image')
          )) {
            try {
              const cachedModule = Module._cache[key];
              if (cachedModule && cachedModule.exports) {
                patchResolveAssetSource(cachedModule.exports);
                if (cachedModule.exports.default) {
                  patchResolveAssetSource(cachedModule.exports.default);
                }
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
    }
  } catch (e) {
    // Module patching failed - continue with direct patching
  }
  
  // Try to patch immediately with static requires (correct path for React Native 0.81+)
  // The actual file is at Libraries/Image/resolveAssetSource.js (not src/Libraries)
  try {
    // eslint-disable-next-line import/no-unresolved
    const resolveAssetSource = require('react-native/Libraries/Image/resolveAssetSource');
    if (resolveAssetSource) {
      patchResolveAssetSource(resolveAssetSource);
      if (resolveAssetSource.default) {
        patchResolveAssetSource(resolveAssetSource.default);
      }
    }
  } catch (e1) {
    // Path not available yet - will be patched via Module._load hook
    // This is OK, the Module._load hook will catch it when it loads
  }
})();
