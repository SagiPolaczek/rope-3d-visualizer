class Utils {
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static lerp(start, end, t) {
        return start + (end - start) * t;
    }

    static smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    }

    static map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    static normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    static radToDeg(rad) {
        return rad * 180 / Math.PI;
    }

    static degToRad(deg) {
        return deg * Math.PI / 180;
    }

    static isPowerOfTwo(value) {
        return (value & (value - 1)) === 0;
    }

    static nextPowerOfTwo(value) {
        value--;
        value |= value >> 1;
        value |= value >> 2;
        value |= value >> 4;
        value |= value >> 8;
        value |= value >> 16;
        value++;
        return value;
    }

    static formatNumber(num, decimals = 2) {
        return Number(num.toFixed(decimals));
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static isWebGLSupported() {
        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!(context && context.getExtension);
        } catch (e) {
            return false;
        }
    }

    static getWebGLInfo() {
        if (!this.isWebGLSupported()) {
            return null;
        }

        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        
        return {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
            maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
            maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS)
        };
    }

    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    static getDevicePixelRatio() {
        return window.devicePixelRatio || 1;
    }

    static getViewportSize() {
        return {
            width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
            height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
        };
    }

    static getMemoryInfo() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                usedFormatted: this.formatFileSize(performance.memory.usedJSHeapSize),
                totalFormatted: this.formatFileSize(performance.memory.totalJSHeapSize),
                limitFormatted: this.formatFileSize(performance.memory.jsHeapSizeLimit)
            };
        }
        return null;
    }

    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    static loadJSON(url) {
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            });
    }

    static saveToLocalStorage(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }

    static loadFromLocalStorage(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return defaultValue;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }

    static removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
            return false;
        }
    }

    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    static downloadText(text, filename, mimeType = 'text/plain') {
        const blob = new Blob([text], { type: mimeType });
        this.downloadBlob(blob, filename);
    }

    static downloadJSON(data, filename) {
        const text = JSON.stringify(data, null, 2);
        this.downloadText(text, filename, 'application/json');
    }

    static copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            return new Promise((resolve, reject) => {
                if (document.execCommand('copy')) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
                document.body.removeChild(textArea);
            });
        }
    }

    static createColorGradient(colors, steps) {
        const gradient = [];
        const segmentSteps = Math.floor(steps / (colors.length - 1));
        
        for (let i = 0; i < colors.length - 1; i++) {
            const startColor = colors[i];
            const endColor = colors[i + 1];
            
            for (let j = 0; j < segmentSteps; j++) {
                const t = j / segmentSteps;
                const r = Math.round(this.lerp(startColor[0], endColor[0], t));
                const g = Math.round(this.lerp(startColor[1], endColor[1], t));
                const b = Math.round(this.lerp(startColor[2], endColor[2], t));
                gradient.push([r, g, b]);
            }
        }
        
        gradient.push(colors[colors.length - 1]);
        return gradient;
    }

    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return [h * 360, s * 100, l * 100];
    }

    static hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    static createPerformanceMonitor() {
        let frameCount = 0;
        let lastTime = performance.now();
        let fps = 60;
        
        return {
            update() {
                frameCount++;
                const now = performance.now();
                
                if (now - lastTime >= 1000) {
                    fps = Math.round((frameCount * 1000) / (now - lastTime));
                    frameCount = 0;
                    lastTime = now;
                }
                
                return fps;
            },
            getFPS() {
                return fps;
            }
        };
    }

    static createEventEmitter() {
        const events = {};
        
        return {
            on(event, callback) {
                if (!events[event]) {
                    events[event] = [];
                }
                events[event].push(callback);
            },
            
            off(event, callback) {
                if (!events[event]) return;
                
                const index = events[event].indexOf(callback);
                if (index > -1) {
                    events[event].splice(index, 1);
                }
            },
            
            emit(event, ...args) {
                if (!events[event]) return;
                
                events[event].forEach(callback => {
                    try {
                        callback(...args);
                    } catch (error) {
                        console.error('Event callback error:', error);
                    }
                });
            },
            
            once(event, callback) {
                const onceCallback = (...args) => {
                    callback(...args);
                    this.off(event, onceCallback);
                };
                this.on(event, onceCallback);
            }
        };
    }

    static validateParameters(params, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = params[key];
            
            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Parameter '${key}' is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`Parameter '${key}' must be of type ${rules.type}`);
                }
                
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`Parameter '${key}' must be >= ${rules.min}`);
                }
                
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`Parameter '${key}' must be <= ${rules.max}`);
                }
                
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`Parameter '${key}' must be one of: ${rules.enum.join(', ')}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    static benchmark(fn, iterations = 1000) {
        const start = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            fn();
        }
        
        const end = performance.now();
        const total = end - start;
        
        return {
            total,
            average: total / iterations,
            iterations
        };
    }
}

window.Utils = Utils;