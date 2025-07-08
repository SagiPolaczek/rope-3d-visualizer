class RopeMathNew {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 50;
        
        // Match your Python implementation exactly
        this.dim = 128;
        this.theta = 10000.0;
        this.axes_dim = [44, 42, 42];
    }

    // Exact implementation of your Python rope function
    rope(pos, dim, theta) {
        if (dim % 2 !== 0) {
            throw new Error('dim must be even');
        }
        
        // torch.linspace(0, (dim - 2) / dim, steps=dim//2)
        const steps = Math.floor(dim / 2);
        const scale = [];
        
        if (steps === 1) {
            scale.push(0);
        } else {
            for (let i = 0; i < steps; i++) {
                scale.push(i * (dim - 2) / dim / (steps - 1));
            }
        }
        
        // omega = 1.0 / (theta**scale)
        const omega = scale.map(s => 1.0 / Math.pow(theta, s));
        
        // out = torch.einsum("...n,d->...nd", pos, omega)
        const out = omega.map(freq => pos * freq);
        
        // torch.stack([torch.cos(out), -torch.sin(out), torch.sin(out), torch.cos(out)], dim=-1)
        // rearrange to 2x2 matrices
        const result = [];
        for (let i = 0; i < out.length; i++) {
            const angle = out[i];
            result.push([
                [Math.cos(angle), -Math.sin(angle)],
                [Math.sin(angle), Math.cos(angle)]
            ]);
        }
        
        return result;
    }

    // Exact implementation of your EmbedND forward
    embedND(ids, axes_dim = null) {
        const [t, h, w] = ids;
        const n_axes = 3;
        
        // Use provided axes dimensions or defaults
        const currentAxesDim = axes_dim || this.axes_dim;
        
        const embeddings = [];
        
        // rope for each axis
        const rope_t = this.rope(t, currentAxesDim[0], this.theta);
        const rope_h = this.rope(h, currentAxesDim[1], this.theta);
        const rope_w = this.rope(w, currentAxesDim[2], this.theta);
        
        // Concatenate (torch.cat)
        embeddings.push(...rope_t);
        embeddings.push(...rope_h);
        embeddings.push(...rope_w);
        
        return embeddings;
    }

    // Generate position grid exactly like your Python
    generatePositionGrid(t_len, h_len, w_len) {
        const positions = [];
        
        // Match your Python: img_ids[:, :, :, 0] = t coordinates 
        for (let t = 0; t < t_len; t++) {
            for (let h = 0; h < h_len; h++) {
                for (let w = 0; w < w_len; w++) {
                    positions.push([t, h, w]);
                }
            }
        }
        
        return positions;
    }

    // Step 1: Position Grid Visualization
    getStep1Data(params) {
        const { t_len, h_len, w_len } = params;
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        
        // Sample for performance
        const sampled = this.samplePositions(positions, 1000);
        
        return sampled.map(([t, h, w]) => ({
            position: [t - t_len/2, h - h_len/2, w - w_len/2],
            color: [t / (t_len-1), h / (h_len-1), w / (w_len-1)],
            type: 'grid_point',
            coordinates: { t, h, w }
        }));
    }

    // Step 2: Frequency Scales Visualization  
    getStep2Data(params) {
        const { t_len, h_len, w_len } = params;
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        const sampled = this.samplePositions(positions, 600);
        
        return sampled.map(([t, h, w]) => {
            // Get all frequency scales for each dimension
            const freq_t = this.getFrequencyScale(this.axes_dim[0], this.theta);
            const freq_h = this.getFrequencyScale(this.axes_dim[1], this.theta);
            const freq_w = this.getFrequencyScale(this.axes_dim[2], this.theta);
            
            // Calculate frequency responses for all frequencies
            const responses_t = freq_t.map(freq => {
                const angle = t * freq;
                return { freq, sin: Math.sin(angle), cos: Math.cos(angle), angle };
            });
            
            const responses_h = freq_h.map(freq => {
                const angle = h * freq;
                return { freq, sin: Math.sin(angle), cos: Math.cos(angle), angle };
            });
            
            const responses_w = freq_w.map(freq => {
                const angle = w * freq;
                return { freq, sin: Math.sin(angle), cos: Math.cos(angle), angle };
            });
            
            // Color based on dominant frequency response
            const dominantFreq_t = responses_t[0] || { angle: 0 };
            const dominantFreq_h = responses_h[0] || { angle: 0 };
            const dominantFreq_w = responses_w[0] || { angle: 0 };
            
            // Mix the three primary frequency responses for color
            const hue = ((dominantFreq_t.angle + dominantFreq_h.angle + dominantFreq_w.angle) % (2 * Math.PI)) / (2 * Math.PI) * 360;
            
            return {
                position: [t - t_len/2, h - h_len/2, w - w_len/2],
                color: this.hslToRgb(hue, 0.9, 0.7),
                type: 'frequency_point',
                frequencies: { t: freq_t, h: freq_h, w: freq_w },
                responses: { t: responses_t, h: responses_h, w: responses_w },
                dominantAngles: { t: dominantFreq_t.angle, h: dominantFreq_h.angle, w: dominantFreq_w.angle }
            };
        });
    }

    // Step 3: Rotation Matrices Visualization
    getStep3Data(params) {
        const { t_len, h_len, w_len, timeSlice } = params;
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        const sampled = this.samplePositions(positions, 250);
        
        return sampled.map(([t, h, w]) => {
            // Generate actual rotation matrices for ALL frequency components
            const rope_t = this.rope(t + timeSlice, this.axes_dim[0], this.theta);
            const rope_h = this.rope(h, this.axes_dim[1], this.theta);
            const rope_w = this.rope(w, this.axes_dim[2], this.theta);
            
            // Apply rotations to multiple test vectors to show the full rotation space
            const testVectors = [[1, 0], [0, 1], [0.707, 0.707], [-0.707, 0.707]];
            
            const allRotatedVectors = {
                t: rope_t.slice(0, 5).map((rotMat, i) => ({
                    matrix: rotMat,
                    vectors: testVectors.map(vec => this.matrixVectorMultiply(rotMat, vec)),
                    freqIndex: i
                })),
                h: rope_h.slice(0, 5).map((rotMat, i) => ({
                    matrix: rotMat,
                    vectors: testVectors.map(vec => this.matrixVectorMultiply(rotMat, vec)),
                    freqIndex: i
                })),
                w: rope_w.slice(0, 5).map((rotMat, i) => ({
                    matrix: rotMat,
                    vectors: testVectors.map(vec => this.matrixVectorMultiply(rotMat, vec)),
                    freqIndex: i
                }))
            };
            
            // Color based on combined rotation effect
            const primaryAngle_t = rope_t[0] ? Math.atan2(rope_t[0][1][0], rope_t[0][0][0]) : 0;
            const primaryAngle_h = rope_h[0] ? Math.atan2(rope_h[0][1][0], rope_h[0][0][0]) : 0;
            const primaryAngle_w = rope_w[0] ? Math.atan2(rope_w[0][1][0], rope_w[0][0][0]) : 0;
            
            const combinedAngle = (primaryAngle_t + primaryAngle_h + primaryAngle_w) / 3;
            const hue = ((combinedAngle + Math.PI) / (2 * Math.PI)) * 360;
            
            return {
                position: [t - t_len/2, h - h_len/2, w - w_len/2],
                color: this.hslToRgb(hue, 0.9, 0.7),
                type: 'rotation_matrix',
                allRotationMatrices: { t: rope_t, h: rope_h, w: rope_w },
                allRotatedVectors: allRotatedVectors,
                primaryAngles: { t: primaryAngle_t, h: primaryAngle_h, w: primaryAngle_w },
                combinedAngle: combinedAngle
            };
        });
    }

    // Step 4: Final RoPE Encoding
    getStep4Data(params) {
        const { t_len, h_len, w_len, timeSlice } = params;
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        const sampled = this.samplePositions(positions, 400);
        
        return sampled.map(([t, h, w]) => {
            // Get full RoPE embedding
            const embedding = this.embedND([t + timeSlice, h, w]);
            
            // Convert rotation matrices to flat encoding
            const encoding = [];
            for (const rotMat of embedding) {
                encoding.push(rotMat[0][0], rotMat[0][1], rotMat[1][0], rotMat[1][1]);
            }
            
            // Calculate magnitude
            const magnitude = Math.sqrt(encoding.reduce((sum, val) => sum + val * val, 0));
            const normalizedMag = Math.min(magnitude / 50, 1);
            
            // Color and size based on encoding strength
            const hue = normalizedMag * 240;
            const size = 0.3 + normalizedMag * 1.2;
            
            return {
                position: [t - t_len/2, h - h_len/2, w - w_len/2],
                color: this.hslToRgb(hue, 0.9, 0.8),
                type: 'final_encoding',
                encoding: encoding,
                magnitude: magnitude,
                size: size,
                rotationMatrices: embedding
            };
        });
    }

    // Helper functions
    getFrequencyScale(dim, theta) {
        const steps = Math.floor(dim / 2);
        const scale = [];
        for (let i = 0; i < steps; i++) {
            scale.push(i * (dim - 2) / dim / (steps - 1));
        }
        return scale.map(s => 1.0 / Math.pow(theta, s));
    }

    getFrequencyResponse(pos, frequencies) {
        let response = 0;
        for (const freq of frequencies) {
            response += Math.sin(pos * freq) + Math.cos(pos * freq);
        }
        return response / (frequencies.length * 2);
    }

    matrixVectorMultiply(matrix, vector) {
        return [
            matrix[0][0] * vector[0] + matrix[0][1] * vector[1],
            matrix[1][0] * vector[0] + matrix[1][1] * vector[1]
        ];
    }

    samplePositions(positions, maxCount) {
        if (positions.length <= maxCount) return positions;
        
        const step = Math.floor(positions.length / maxCount);
        const sampled = [];
        for (let i = 0; i < positions.length; i += step) {
            sampled.push(positions[i]);
        }
        return sampled.slice(0, maxCount);
    }
    
    samplePositionsStructured(positions, t_len, h_len, w_len, maxCount) {
        const totalPoints = t_len * h_len * w_len;
        
        if (totalPoints <= maxCount) {
            console.log(`Using all ${totalPoints} points`);
            return positions;
        }
        
        // Calculate sampling ratios to preserve structure
        const ratio = Math.pow(maxCount / totalPoints, 1/3);
        const sample_t = Math.max(2, Math.floor(t_len * ratio));
        const sample_h = Math.max(2, Math.floor(h_len * ratio));
        const sample_w = Math.max(2, Math.floor(w_len * ratio));
        
        const step_t = Math.max(1, Math.floor(t_len / sample_t));
        const step_h = Math.max(1, Math.floor(h_len / sample_h));
        const step_w = Math.max(1, Math.floor(w_len / sample_w));
        
        console.log(`Structured sampling: ${sample_t}×${sample_h}×${sample_w} from ${t_len}×${h_len}×${w_len}`);
        console.log(`Step sizes: t=${step_t}, h=${step_h}, w=${step_w}`);
        
        const sampled = [];
        for (let t = 0; t < t_len; t += step_t) {
            for (let h = 0; h < h_len; h += step_h) {
                for (let w = 0; w < w_len; w += step_w) {
                    sampled.push([t, h, w]);
                }
            }
        }
        
        console.log(`Sampled ${sampled.length} points`);
        return sampled;
    }

    hslToRgb(h, s, l) {
        h = h / 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
        const m = l - c / 2;
        
        let r, g, b;
        if (h < 1/6) { r = c; g = x; b = 0; }
        else if (h < 2/6) { r = x; g = c; b = 0; }
        else if (h < 3/6) { r = 0; g = c; b = x; }
        else if (h < 4/6) { r = 0; g = x; b = c; }
        else if (h < 5/6) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        return [r + m, g + m, b + m];
    }

    // Final RoPE Encoding - Enhanced Visualization
    getFinalEncodingData(params) {
        const { t_len, h_len, w_len, timeSlice } = params;
        const positions = this.generatePositionGrid(t_len, h_len, w_len);
        
        // Calculate axes dimensions based on tensor dimensions and embedding dimension
        // For visualization, we want enough dimensions to properly represent the frequencies
        // but scale with tensor size for meaningful visualization
        const totalDim = this.dim || 128;
        const axesDimT = Math.min(totalDim / 3, Math.max(4, t_len * 2));
        const axesDimH = Math.min(totalDim / 3, Math.max(4, h_len * 2));  
        const axesDimW = Math.min(totalDim / 3, Math.max(4, w_len * 2));
        
        // Ensure even numbers for rotation matrices
        const axes_dim = [
            Math.floor(axesDimT / 2) * 2,
            Math.floor(axesDimH / 2) * 2,
            Math.floor(axesDimW / 2) * 2
        ];
        
        // Use ALL positions to show the complete 3D tensor
        const sampled = positions; // No sampling - show the complete tensor structure
        
        return sampled.map(([t, h, w]) => {
            // Get full RoPE embedding with dynamic axes dimensions
            const embedding = this.embedND([t + timeSlice, h, w], axes_dim);
            
            // Convert rotation matrices to flat encoding
            const encoding = [];
            for (const rotMat of embedding) {
                encoding.push(rotMat[0][0], rotMat[0][1], rotMat[1][0], rotMat[1][1]);
            }
            
            // Calculate comprehensive metrics
            const magnitude = Math.sqrt(encoding.reduce((sum, val) => sum + val * val, 0));
            const normalizedMag = Math.min(magnitude / 100, 1);
            
            // Separate encodings by dimension for visualization
            const t_rotation_count = Math.floor(axes_dim[0] / 2);
            const h_rotation_count = Math.floor(axes_dim[1] / 2);
            const w_rotation_count = Math.floor(axes_dim[2] / 2);
            
            const t_encoding = embedding.slice(0, t_rotation_count);
            const h_encoding = embedding.slice(t_rotation_count, t_rotation_count + h_rotation_count);
            const w_encoding = embedding.slice(t_rotation_count + h_rotation_count);
            
            // Calculate per-dimension magnitudes
            const t_mag = this.calculateDimensionMagnitude(t_encoding);
            const h_mag = this.calculateDimensionMagnitude(h_encoding);
            const w_mag = this.calculateDimensionMagnitude(w_encoding);
            
            // Color based on dimensional contribution
            const r = Math.min(t_mag / 10, 1);
            const g = Math.min(h_mag / 10, 1);
            const b = Math.min(w_mag / 10, 1);
            
            // Size based on total encoding strength
            const size = 0.2 + normalizedMag * 1.5;
            
            // Generate vector pairs for visualization
            const vectorPairs = this.generateVectorPairs(embedding);
            
            return {
                // Perfect 3D grid: each unit is 1.0 apart for clean alignment
                position: [
                    w,  // X-axis: Width (0 to w_len-1)
                    h,  // Y-axis: Height (0 to h_len-1)  
                    t   // Z-axis: Time (0 to t_len-1)
                ],
                color: [r, g, b],
                type: 'final_encoding',
                encoding: encoding,
                magnitude: magnitude,
                size: size,
                rotationMatrices: embedding,
                dimensionMagnitudes: { t: t_mag, h: h_mag, w: w_mag },
                dimensionEncodings: { t: t_encoding, h: h_encoding, w: w_encoding },
                vectorPairs: vectorPairs,
                coordinates: { t: t + timeSlice, h, w },
                originalIndices: { t, h, w } // Keep original indices for debugging
            };
        });
    }
    
    calculateDimensionMagnitude(rotMatrices) {
        if (!rotMatrices || rotMatrices.length === 0) return 0;
        
        let totalMag = 0;
        for (const rotMat of rotMatrices) {
            const flatMat = [rotMat[0][0], rotMat[0][1], rotMat[1][0], rotMat[1][1]];
            totalMag += Math.sqrt(flatMat.reduce((sum, val) => sum + val * val, 0));
        }
        return totalMag / rotMatrices.length;
    }
    
    generateVectorPairs(rotMatrices) {
        const pairs = [];
        const maxPairs = Math.min(8, rotMatrices.length);
        
        for (let i = 0; i < maxPairs; i++) {
            const rotMat = rotMatrices[i];
            if (!rotMat) continue;
            
            // Apply rotation to unit vectors
            const vec1 = this.matrixVectorMultiply(rotMat, [1, 0]);
            const vec2 = this.matrixVectorMultiply(rotMat, [0, 1]);
            
            pairs.push({
                vectors: [vec1, vec2],
                matrix: rotMat,
                index: i
            });
        }
        
        return pairs;
    }

    // Main interface method - only final encoding
    getStepData(step, params) {
        try {
            // Always return final encoding regardless of step
            return this.getFinalEncodingData(params);
        } catch (error) {
            console.error('Error generating RoPE encoding data:', error);
            return [];
        }
    }
}

// Create global instance
const ropeMathNew = new RopeMathNew();