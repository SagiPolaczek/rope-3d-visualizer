class RopeMath {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.axes_dim = [44, 42, 42];
    }

    linspace(start, end, num) {
        const step = (end - start) / (num - 1);
        return Array.from({ length: num }, (_, i) => start + step * i);
    }

    meshgrid(x, y, z) {
        const result = [];
        for (let i = 0; i < x.length; i++) {
            for (let j = 0; j < y.length; j++) {
                for (let k = 0; k < z.length; k++) {
                    result.push([x[i], y[j], z[k]]);
                }
            }
        }
        return result;
    }

    generatePositionGrid(t_len, h_len, w_len) {
        const cacheKey = `grid_${t_len}_${h_len}_${w_len}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const t_range = Array.from({ length: t_len }, (_, i) => i);
        const h_range = Array.from({ length: h_len }, (_, i) => i);
        const w_range = Array.from({ length: w_len }, (_, i) => i);

        const positions = this.meshgrid(t_range, h_range, w_range);
        
        this.updateCache(cacheKey, positions);
        return positions;
    }

    calculateFrequencyScales(dim, theta = 10000) {
        const cacheKey = `freq_${dim}_${theta}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Match Python: torch.linspace(0, (dim - 2) / dim, steps=dim//2)
        const scale = this.linspace(0, (dim - 2) / dim, Math.floor(dim / 2));
        const omega = scale.map(s => 1.0 / Math.pow(theta, s));
        
        this.updateCache(cacheKey, omega);
        return omega;
    }

    rope(pos, dim, theta) {
        // Match Python rope function
        const scale = this.linspace(0, (dim - 2) / dim, Math.floor(dim / 2));
        const omega = scale.map(s => 1.0 / Math.pow(theta, s));
        
        const result = [];
        for (let i = 0; i < omega.length; i++) {
            const angle = pos * omega[i];
            // Python: torch.stack([torch.cos(out), -torch.sin(out), torch.sin(out), torch.cos(out)], dim=-1)
            result.push([
                [Math.cos(angle), -Math.sin(angle)],
                [Math.sin(angle), Math.cos(angle)]
            ]);
        }
        return result;
    }

    generateRotationMatrix(angle) {
        const cos_theta = Math.cos(angle);
        const sin_theta = Math.sin(angle);
        return [
            [cos_theta, -sin_theta],
            [sin_theta, cos_theta]
        ];
    }

    apply3DRoPE(positions, dim, theta = 10000, timeSlice = 0) {
        const cacheKey = `rope_${positions.length}_${dim}_${theta}_${timeSlice}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const [t_dim, h_dim, w_dim] = this.axes_dim;
        const omega_t = this.calculateFrequencyScales(t_dim, theta);
        const omega_h = this.calculateFrequencyScales(h_dim, theta);
        const omega_w = this.calculateFrequencyScales(w_dim, theta);

        const encodedPositions = positions.map(([t, h, w]) => {
            // Generate rope encodings for each axis (matching Python implementation)
            const rope_t = this.rope(t + timeSlice, t_dim, theta);
            const rope_h = this.rope(h, h_dim, theta);
            const rope_w = this.rope(w, w_dim, theta);
            
            // Concatenate all rope encodings (match Python torch.cat)
            const allRopes = [...rope_t, ...rope_h, ...rope_w];
            
            // Convert 2x2 rotation matrices to encoding values
            const encoding = [];
            for (const rotMat of allRopes) {
                // Extract rotation matrix values
                encoding.push(rotMat[0][0]); // cos
                encoding.push(rotMat[0][1]); // -sin
                encoding.push(rotMat[1][0]); // sin
                encoding.push(rotMat[1][1]); // cos
            }
            
            while (encoding.length < dim) {
                encoding.push(0);
            }
            
            return {
                position: [t, h, w],
                encoding: encoding.slice(0, dim),
                rotationMatrices: allRopes,
                magnitude: Math.sqrt(encoding.reduce((sum, val) => sum + val * val, 0))
            };
        });

        this.updateCache(cacheKey, encodedPositions);
        return encodedPositions;
    }

    getStepData(step, params) {
        const { t_len, h_len, w_len, dim, theta, timeSlice, quality } = params;
        
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        const sampledPositions = this.subsamplePositions(positions, quality);
        
        switch (step) {
            case 0:
                return this.getPositionGridData(sampledPositions, params);
            case 1:
                return this.getFrequencyScaleData(sampledPositions, params);
            case 2:
                return this.getRotationMatrixData(sampledPositions, params);
            case 3:
                return this.getFinalEncodingData(sampledPositions, params);
            default:
                return this.getPositionGridData(sampledPositions, params);
        }
    }

    getPositionGridData(positions, params) {
        const { t_len, h_len, w_len } = params;
        
        return positions.map(([t, h, w]) => ({
            position: [t, h, w],
            color: [
                t / Math.max(t_len - 1, 1),
                h / Math.max(h_len - 1, 1), 
                w / Math.max(w_len - 1, 1)
            ],
            encoding: null,
            step: 0
        }));
    }

    getFrequencyScaleData(positions, params) {
        const { dim, theta } = params;
        const omega = this.calculateFrequencyScales(dim, theta);
        
        return positions.map(([t, h, w]) => {
            const freqSum = omega.reduce((sum, freq, i) => {
                const angle = (t + h + w) * freq;
                return sum + Math.sin(angle) + Math.cos(angle);
            }, 0);
            
            const normalizedFreq = (freqSum + omega.length * 2) / (omega.length * 4);
            const hue = normalizedFreq * 360;
            
            return {
                position: [t, h, w],
                color: this.hslToRgb(hue, 0.8, 0.6),
                encoding: null,
                step: 1,
                frequency: normalizedFreq
            };
        });
    }

    getRotationMatrixData(positions, params) {
        const { dim, theta, timeSlice } = params;
        
        return positions.map(([t, h, w]) => {
            // Generate actual RoPE rotation matrices for visualization
            const rope_t = this.rope(t + timeSlice, 44, theta);
            const rope_h = this.rope(h, 42, theta);
            const rope_w = this.rope(w, 42, theta);
            
            // Use first rotation matrix from each axis for visualization
            const rotMat_t = rope_t[0] || [[1, 0], [0, 1]];
            const rotMat_h = rope_h[0] || [[1, 0], [0, 1]];
            const rotMat_w = rope_w[0] || [[1, 0], [0, 1]];
            
            // Create vectors to visualize the rotation
            const baseVector = [1, 0]; // Unit vector
            
            // Apply rotation matrices
            const rotated_t = [
                baseVector[0] * rotMat_t[0][0] + baseVector[1] * rotMat_t[0][1],
                baseVector[0] * rotMat_t[1][0] + baseVector[1] * rotMat_t[1][1]
            ];
            
            const rotated_h = [
                baseVector[0] * rotMat_h[0][0] + baseVector[1] * rotMat_h[0][1],
                baseVector[0] * rotMat_h[1][0] + baseVector[1] * rotMat_h[1][1]
            ];
            
            const rotated_w = [
                baseVector[0] * rotMat_w[0][0] + baseVector[1] * rotMat_w[0][1],
                baseVector[0] * rotMat_w[1][0] + baseVector[1] * rotMat_w[1][1]
            ];
            
            // Color based on rotation angle
            const angle_t = Math.atan2(rotated_t[1], rotated_t[0]);
            const hue = ((angle_t + Math.PI) / (2 * Math.PI)) * 360;
            
            return {
                position: [t, h, w],
                color: this.hslToRgb(hue, 0.9, 0.7),
                encoding: null,
                step: 2,
                rotationMatrices: {
                    t: rotMat_t,
                    h: rotMat_h,
                    w: rotMat_w
                },
                rotatedVectors: {
                    t: rotated_t,
                    h: rotated_h,
                    w: rotated_w
                },
                angle: angle_t
            };
        });
    }

    getFinalEncodingData(positions, params) {
        const encodedPositions = this.apply3DRoPE(positions, params.dim, params.theta, params.timeSlice);
        
        return encodedPositions.map(data => {
            const { position, encoding, magnitude } = data;
            
            // Enhanced visualization of RoPE values
            const normalizedMagnitude = Math.min(magnitude / 50, 1); // Adjusted scale
            
            // Color based on encoding magnitude
            const hue = (normalizedMagnitude * 300) % 360; // More color range
            
            // Make points more visible based on encoding strength
            const pointSize = 0.5 + normalizedMagnitude * 1.5;
            
            return {
                position: position,
                color: this.hslToRgb(hue, 0.9, 0.7), // More saturated colors
                encoding: encoding,
                step: 3,
                magnitude: magnitude,
                size: pointSize
            };
        });
    }

    subsamplePositions(positions, quality) {
        const subsampleRates = {
            1: 4,
            2: 2,
            3: 1
        };
        
        const rate = subsampleRates[quality] || 2;
        if (rate === 1) return positions;
        
        return positions.filter((_, index) => index % rate === 0);
    }

    hslToRgb(h, s, l) {
        h = h / 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
        const m = l - c / 2;
        
        let r, g, b;
        
        if (h < 1/6) {
            r = c; g = x; b = 0;
        } else if (h < 2/6) {
            r = x; g = c; b = 0;
        } else if (h < 3/6) {
            r = 0; g = c; b = x;
        } else if (h < 4/6) {
            r = 0; g = x; b = c;
        } else if (h < 5/6) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        return [r + m, g + m, b + m];
    }

    updateCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheInfo() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys())
        };
    }
}

const ropeMath = new RopeMath();