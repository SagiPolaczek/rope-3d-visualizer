class Visualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.pointsMesh = null;
        this.axesHelper = null;
        this.trailMeshes = [];
        this.animationId = null;
        this.isAnimating = false;
        this.animationTime = 0;
        this.animationSpeed = 1.0;
        
        this.maxPoints = 50000; // Support much larger tensors
        this.pointRadius = 0.05; // Smaller spheres for dense 3D tensor
        this.currentStep = 0;
        this.currentData = [];
        
        this.geometry = null;
        this.material = null;
        this.instancedMesh = null;
        this.colorArray = null;
        this.positionArray = null;
        
        this.performanceMonitor = {
            lastTime: 0,
            frameCount: 0,
            fps: 60
        };
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLights();
        this.setupAxes();
        this.setupInstancedMesh();
        this.startRenderLoop();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.Fog(0x000000, 50, 200);
    }

    setupCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        
        // Will be positioned dynamically based on tensor dimensions
        this.camera.position.set(50, 40, 50);
        this.camera.lookAt(0, 0, 0);
    }
    
    updateCameraForTensor(t_len, h_len, w_len) {
        // Calculate tensor center
        const centerX = (w_len - 1) / 2;
        const centerY = (h_len - 1) / 2;  
        const centerZ = (t_len - 1) / 2;
        
        // Calculate optimal camera distance based on tensor size
        const maxDim = Math.max(w_len, h_len, t_len);
        const distance = Math.max(30, maxDim * 2);
        
        // Position camera at optimal viewing angle
        this.camera.position.set(
            centerX + distance * 0.8,
            centerY + distance * 0.6, 
            centerZ + distance * 0.8
        );
        this.camera.lookAt(centerX, centerY, centerZ);
        
        // Update orbit controls target
        if (this.controls) {
            this.controls.target.set(centerX, centerY, centerZ);
            this.controls.update();
        }
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.maxDistance = 500;
        this.controls.minDistance = 5;
        this.controls.maxPolarAngle = Math.PI;
        
        // Target will be set dynamically in updateCameraForTensor
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 20, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);

        const pointLight1 = new THREE.PointLight(0x4CAF50, 0.3, 50);
        pointLight1.position.set(-20, 10, 10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x2196F3, 0.3, 50);
        pointLight2.position.set(20, -10, -10);
        this.scene.add(pointLight2);
    }

    setupAxes() {
        this.axesHelper = new THREE.AxesHelper(15);
        this.axesHelper.position.set(-1, -1, -1); // Position slightly before tensor origin for visibility
        this.scene.add(this.axesHelper);
        
        const axesColors = [0xff0000, 0x00ff00, 0x0000ff];
        const axesLabels = ['X (Width)', 'Y (Height)', 'Z (Time)'];
        
        axesLabels.forEach((label, index) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 64;
            canvas.height = 64;
            
            context.fillStyle = '#' + axesColors[index].toString(16).padStart(6, '0');
            context.font = '32px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(label, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(3, 3, 1);
            
            const position = new THREE.Vector3();
            position.setComponent(index, 25);
            sprite.position.copy(position);
            
            this.scene.add(sprite);
        });
    }

    setupInstancedMesh() {
        this.geometry = new THREE.SphereGeometry(this.pointRadius, 8, 6);
        this.material = new THREE.MeshLambertMaterial({ 
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.instancedMesh = new THREE.InstancedMesh(
            this.geometry, 
            this.material, 
            this.maxPoints
        );
        
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(this.maxPoints * 3), 3
        );
        this.instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        
        this.scene.add(this.instancedMesh);
        
        // Setup for vector visualization
        this.vectorGroup = new THREE.Group();
        this.scene.add(this.vectorGroup);
        
        // Setup for rotation matrix visualization  
        this.rotationGroup = new THREE.Group();
        this.scene.add(this.rotationGroup);
    }

    updateVisualization(data, step) {
        console.log(`Visualization: Updating step ${step} with ${data?.length || 0} points`);
        console.log('First data point:', data?.[0]);
        
        this.currentData = data;
        this.currentStep = step;
        
        if (!data || data.length === 0) {
            console.log('No data, setting count to 0');
            this.instancedMesh.count = 0;
            return;
        }
        
        // Extract tensor dimensions from first data point if available
        if (data[0] && data[0].originalIndices) {
            // Find max dimensions by scanning data
            let maxT = 0, maxH = 0, maxW = 0;
            for (const point of data) {
                if (point.originalIndices) {
                    maxT = Math.max(maxT, point.originalIndices.t);
                    maxH = Math.max(maxH, point.originalIndices.h);
                    maxW = Math.max(maxW, point.originalIndices.w);
                }
            }
            // Update camera for actual tensor size
            this.updateCameraForTensor(maxT + 1, maxH + 1, maxW + 1);
        }
        
        const pointCount = Math.min(data.length, this.maxPoints);
        this.instancedMesh.count = pointCount;
        
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);
        const quaternion = new THREE.Quaternion();
        
        for (let i = 0; i < pointCount; i++) {
            const point = data[i];
            if (!point || !point.position) continue;
            
            // Use the exact position from the data (already mapped correctly)
            position.set(
                point.position[0],
                point.position[1], 
                point.position[2]
            );
            
            if (step === 2 && point.angle !== undefined) {
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), point.angle * 0.1);
                scale.setScalar(0.8 + 0.4 * Math.sin(point.angle));
            } else if (point.size !== undefined) {
                // Scale points based on RoPE encoding magnitude
                quaternion.set(0, 0, 0, 1);
                scale.setScalar(Math.max(0.5, point.size));
            } else {
                quaternion.set(0, 0, 0, 1);
                scale.setScalar(1);
            }
            
            matrix.compose(position, quaternion, scale);
            this.instancedMesh.setMatrixAt(i, matrix);
            
            if (point.color) {
                this.instancedMesh.setColorAt(i, new THREE.Color(
                    point.color[0],
                    point.color[1], 
                    point.color[2]
                ));
            }
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;
        
        // Clear previous visualizations
        this.clearVectorVisualization();
        this.clearRotationVisualization();
        
        // Only show final RoPE encoding visualization
        this.visualizeFinalRoPEEncoding(data);
        
        this.updateTrails(data, step);
    }
    
    clearVectorVisualization() {
        while (this.vectorGroup.children.length > 0) {
            this.vectorGroup.remove(this.vectorGroup.children[0]);
        }
    }
    
    clearRotationVisualization() {
        while (this.rotationGroup.children.length > 0) {
            this.rotationGroup.remove(this.rotationGroup.children[0]);
        }
    }
    
    visualizeRotationMatrices(data) {
        const maxVectors = Math.min(200, data.length); // Limit for performance
        
        for (let i = 0; i < maxVectors; i += 3) { // Sample every 3rd point
            const point = data[i];
            if (!point || !point.rotatedVectors) continue;
            
            const basePos = new THREE.Vector3(
                point.position[0] - 8,
                point.position[1] - 15,
                point.position[2] - 30
            );
            
            // Show rotation vectors for time dimension
            this.createVector(
                basePos,
                point.rotatedVectors.t,
                0xff4444, // Red for time
                1.5
            );
            
            // Show rotation vectors for height dimension  
            this.createVector(
                basePos,
                point.rotatedVectors.h,
                0x44ff44, // Green for height
                1.0
            );
            
            // Show rotation vectors for width dimension
            this.createVector(
                basePos,
                point.rotatedVectors.w,
                0x4444ff, // Blue for width
                0.8
            );
        }
    }
    
    visualizeEncodingVectors(data) {
        const maxVectors = Math.min(150, data.length);
        
        for (let i = 0; i < maxVectors; i += 4) {
            const point = data[i];
            if (!point || !point.encoding) continue;
            
            const basePos = new THREE.Vector3(
                point.position[0] - 8,
                point.position[1] - 15,
                point.position[2] - 30
            );
            
            // Visualize first few encoding dimensions as vectors
            for (let dim = 0; dim < Math.min(6, point.encoding.length); dim += 2) {
                const x = point.encoding[dim] || 0;
                const y = point.encoding[dim + 1] || 0;
                
                this.createVector(
                    basePos,
                    [x, y],
                    0xffffff,
                    0.5 + dim * 0.1
                );
            }
        }
    }
    
    createVector(startPos, direction, color, scale = 1.0) {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]) * scale;
        if (vectorLength < 0.1) return; // Skip very small vectors
        
        // Create arrow geometry
        const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Create line geometry
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(direction[0] * scale, direction[1] * scale, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: color });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // Position the vector
        const vectorGroup = new THREE.Group();
        vectorGroup.add(line);
        vectorGroup.add(arrow);
        
        // Position arrow at end of line
        arrow.position.set(direction[0] * scale, direction[1] * scale, 0);
        arrow.lookAt(
            direction[0] * scale * 1.1,
            direction[1] * scale * 1.1,
            0
        );
        
        vectorGroup.position.copy(startPos);
        this.vectorGroup.add(vectorGroup);
    }
    
    visualizeRotationMatricesNew(data) {
        const maxPoints = Math.min(80, data.length);
        
        for (let i = 0; i < maxPoints; i += 3) {
            const point = data[i];
            if (!point || point.type !== 'rotation_matrix') continue;
            
            const basePos = new THREE.Vector3(...point.position);
            
            // Visualize all rotation frequencies for each dimension
            if (point.allRotatedVectors) {
                this.visualizeRotationDimension(basePos, point.allRotatedVectors.t, 0xff4444, 'T', [0.5, 0, 0]);
                this.visualizeRotationDimension(basePos, point.allRotatedVectors.h, 0x44ff44, 'H', [0, 0.5, 0]);
                this.visualizeRotationDimension(basePos, point.allRotatedVectors.w, 0x4444ff, 'W', [0, 0, 0.5]);
            }
        }
    }
    
    visualizeRotationDimension(basePos, rotationData, color, label, offset) {
        if (!rotationData || rotationData.length === 0) return;
        
        // Show first few frequency components' rotations
        const maxFreqs = Math.min(4, rotationData.length);
        
        for (let f = 0; f < maxFreqs; f++) {
            const rotData = rotationData[f];
            if (!rotData || !rotData.vectors) continue;
            
            // Position offset for different frequencies
            const offsetPos = new THREE.Vector3(
                basePos.x + offset[0] * f,
                basePos.y + offset[1] * f,
                basePos.z + offset[2] * f
            );
            
            // Show rotated vectors with decreasing opacity for higher frequencies
            const opacity = 0.8 - f * 0.15;
            const scale = 1.0 - f * 0.15;
            
            // Show the first two rotated vectors (most important)
            for (let v = 0; v < Math.min(2, rotData.vectors.length); v++) {
                const vector = rotData.vectors[v];
                this.createRotationArrow(offsetPos, vector, color, scale, f, v, opacity);
            }
            
            // Add small sphere to mark the rotation center
            this.createRotationMarker(offsetPos, color, f, opacity);
        }
    }
    
    createRotationArrow(startPos, direction, color, scale, freqIndex, vectorIndex, opacity) {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
        if (vectorLength < 0.05) return;
        
        // Create arrow with varying sizes
        const arrowSize = 0.04 + freqIndex * 0.01;
        const arrowGeometry = new THREE.ConeGeometry(arrowSize, arrowSize * 3, 6);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: opacity
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Create line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(direction[0] * scale, direction[1] * scale, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: opacity * 0.8
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // Position arrow
        arrow.position.set(direction[0] * scale, direction[1] * scale, 0);
        const angle = Math.atan2(direction[1], direction[0]);
        arrow.rotateZ(angle - Math.PI / 2);
        
        // Group them
        const rotGroup = new THREE.Group();
        rotGroup.add(line);
        rotGroup.add(arrow);
        rotGroup.position.copy(startPos);
        
        this.rotationGroup.add(rotGroup);
    }
    
    createRotationMarker(position, color, freqIndex, opacity) {
        // Create small sphere to mark rotation center
        const sphereGeometry = new THREE.SphereGeometry(0.02 + freqIndex * 0.005, 6, 4);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: opacity * 0.6
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        this.rotationGroup.add(sphere);
    }
    
    visualizeEncodingVectorsNew(data) {
        const maxVectors = Math.min(80, data.length);
        
        for (let i = 0; i < maxVectors; i += 3) {
            const point = data[i];
            if (!point || point.type !== 'final_encoding') continue;
            
            const basePos = new THREE.Vector3(...point.position);
            
            // Show encoding as multiple vectors
            if (point.encoding) {
                const numPairs = Math.min(3, Math.floor(point.encoding.length / 4));
                
                for (let pair = 0; pair < numPairs; pair++) {
                    const idx = pair * 4;
                    const vec1 = [point.encoding[idx], point.encoding[idx + 1]];
                    const vec2 = [point.encoding[idx + 2], point.encoding[idx + 3]];
                    
                    const color = [0xff8888, 0x88ff88, 0x8888ff][pair];
                    this.createArrow(basePos, vec1, color, 0.8 + pair * 0.2, `e${pair}a`);
                    this.createArrow(basePos, vec2, color, 0.8 + pair * 0.2, `e${pair}b`);
                }
            }
        }
    }
    
    createArrow(startPos, direction, color, scale = 1.0, label = '') {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
        if (vectorLength < 0.05) return;
        
        // Create arrow
        const arrowGeometry = new THREE.ConeGeometry(0.08, 0.25, 6);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Create line
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(direction[0] * scale, direction[1] * scale, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // Position arrow
        arrow.position.set(direction[0] * scale, direction[1] * scale, 0);
        const angle = Math.atan2(direction[1], direction[0]);
        arrow.rotateZ(angle - Math.PI / 2);
        
        // Group them
        const arrowGroup = new THREE.Group();
        arrowGroup.add(line);
        arrowGroup.add(arrow);
        arrowGroup.position.copy(startPos);
        
        this.vectorGroup.add(arrowGroup);
    }
    
    visualizeAllFrequencies(data) {
        const maxPoints = Math.min(120, data.length);
        
        for (let i = 0; i < maxPoints; i += 2) {
            const point = data[i];
            if (!point || point.type !== 'frequency_point') continue;
            
            const basePos = new THREE.Vector3(...point.position);
            
            // Visualize frequency responses for each dimension
            if (point.responses) {
                this.visualizeFrequencyDimension(basePos, point.responses.t, 0xff4444, 'T', [1, 0, 0]);
                this.visualizeFrequencyDimension(basePos, point.responses.h, 0x44ff44, 'H', [0, 1, 0]);
                this.visualizeFrequencyDimension(basePos, point.responses.w, 0x4444ff, 'W', [0, 0, 1]);
            }
        }
    }
    
    visualizeFrequencyDimension(basePos, responses, color, label, offset) {
        if (!responses || responses.length === 0) return;
        
        // Show first few frequency components as vectors
        const maxFreqs = Math.min(5, responses.length);
        
        for (let f = 0; f < maxFreqs; f++) {
            const response = responses[f];
            if (!response) continue;
            
            // Create vector representing sin/cos pair
            const sinCosVector = [response.sin, response.cos];
            const magnitude = Math.sqrt(sinCosVector[0] * sinCosVector[0] + sinCosVector[1] * sinCosVector[1]);
            
            if (magnitude < 0.1) continue;
            
            // Position offset for different dimensions
            const offsetPos = new THREE.Vector3(
                basePos.x + offset[0] * f * 0.3,
                basePos.y + offset[1] * f * 0.3,
                basePos.z + offset[2] * f * 0.3
            );
            
            // Scale vector by frequency importance (lower frequencies are more important)
            const freqScale = 1.0 / (1 + f * 0.5);
            const scale = magnitude * freqScale * 1.5;
            
            // Create frequency vector
            this.createFrequencyVector(offsetPos, sinCosVector, color, scale, f);
            
            // Add frequency value as small sphere
            this.createFrequencyMarker(offsetPos, response.freq, color, f);
        }
    }
    
    createFrequencyVector(startPos, direction, color, scale, freqIndex) {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
        if (vectorLength < 0.05) return;
        
        // Create thinner arrow for frequency visualization
        const arrowGeometry = new THREE.ConeGeometry(0.05, 0.15, 6);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.7 - freqIndex * 0.1 
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Create line with varying thickness
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(direction[0] * scale, direction[1] * scale, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.6 - freqIndex * 0.1,
            linewidth: 2
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // Position arrow
        arrow.position.set(direction[0] * scale, direction[1] * scale, 0);
        const angle = Math.atan2(direction[1], direction[0]);
        arrow.rotateZ(angle - Math.PI / 2);
        
        // Group them
        const freqGroup = new THREE.Group();
        freqGroup.add(line);
        freqGroup.add(arrow);
        freqGroup.position.copy(startPos);
        
        this.vectorGroup.add(freqGroup);
    }
    
    createFrequencyMarker(position, frequency, color, freqIndex) {
        // Create small sphere to mark frequency position
        const sphereGeometry = new THREE.SphereGeometry(0.03 + freqIndex * 0.01, 8, 6);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8 - freqIndex * 0.1
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        this.vectorGroup.add(sphere);
    }
    
    visualizeFinalRoPEEncoding(data) {
        console.log(`Visualizing full 3D tensor with ${data.length} points`);
        
        // Show ALL points but with smart LOD (Level of Detail)
        const maxVectorPoints = Math.min(500, data.length); // Limit vectors for performance
        const vectorStep = Math.max(1, Math.floor(data.length / maxVectorPoints));
        
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            if (!point || point.type !== 'final_encoding') continue;
            
            const basePos = new THREE.Vector3(...point.position);
            
            // Show vectors only on a subset for clarity
            if (i % vectorStep === 0 && point.vectorPairs && point.vectorPairs.length > 0) {
                this.visualizeRoPEVectors(basePos, point, true); // Simplified vectors
            }
        }
        
        console.log(`Showed vectors on ${Math.floor(data.length / vectorStep)} points`);
    }
    
    visualizeRoPEVectors(basePos, point, simplified = false) {
        const maxVectors = simplified ? Math.min(3, point.vectorPairs.length) : Math.min(6, point.vectorPairs.length);
        
        // Color components based on dimension contributions
        const tColor = new THREE.Color(point.dimensionMagnitudes.t / 5, 0, 0);
        const hColor = new THREE.Color(0, point.dimensionMagnitudes.h / 5, 0);
        const wColor = new THREE.Color(0, 0, point.dimensionMagnitudes.w / 5);
        
        for (let v = 0; v < maxVectors; v++) {
            const vectorPair = point.vectorPairs[v];
            if (!vectorPair || !vectorPair.vectors) continue;
            
            const opacity = 0.8 - v * 0.1;
            const scale = 1.0 - v * 0.12;
            
            // Offset position for different vector pairs
            const offsetPos = new THREE.Vector3(
                basePos.x + (v % 3 - 1) * 0.4,
                basePos.y + Math.floor(v / 3) * 0.4,
                basePos.z
            );
            
            // Determine color based on which dimension this vector belongs to
            const t_count = point.dimensionEncodings.t.length;
            const h_count = point.dimensionEncodings.h.length;
            
            let vectorColor;
            if (v < t_count) {
                vectorColor = 0xff4444; // Red for time dimension
            } else if (v < t_count + h_count) {
                vectorColor = 0x44ff44; // Green for height dimension
            } else {
                vectorColor = 0x4444ff; // Blue for width dimension
            }
            
            // Draw both vectors in the pair
            for (let j = 0; j < vectorPair.vectors.length; j++) {
                const vector = vectorPair.vectors[j];
                this.createRoPEArrow(offsetPos, vector, vectorColor, scale * 0.8, opacity, v, j);
            }
            
            // Add encoding magnitude indicator (only for non-simplified mode)
            if (!simplified) {
                this.createEncodingMagnitudeIndicator(offsetPos, point.magnitude, v);
            }
        }
        
        // Add coordinate label only for key points
        if (!simplified && Math.random() < 0.05) { // Show labels on ~5% of points
            this.addCoordinateLabel(basePos, point.originalIndices, point.coordinates);
        }
    }
    
    createRoPEArrow(startPos, direction, color, scale, opacity, vectorIndex, subIndex) {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
        if (vectorLength < 0.05) return;
        
        // Create arrow with high detail for final encoding
        const arrowGeometry = new THREE.ConeGeometry(0.06, 0.2, 8);
        const arrowMaterial = new THREE.MeshLambertMaterial({ 
            color: color, 
            transparent: true, 
            opacity: opacity
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Create line with gradient effect
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(direction[0] * scale, direction[1] * scale, 0)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: opacity * 0.9,
            linewidth: 2
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // Position and orient arrow
        arrow.position.set(direction[0] * scale, direction[1] * scale, 0);
        const angle = Math.atan2(direction[1], direction[0]);
        arrow.rotateZ(angle - Math.PI / 2);
        
        // Create group
        const ropeGroup = new THREE.Group();
        ropeGroup.add(line);
        ropeGroup.add(arrow);
        ropeGroup.position.copy(startPos);
        
        this.vectorGroup.add(ropeGroup);
    }
    
    createEncodingMagnitudeIndicator(position, magnitude, vectorIndex) {
        // Create pulsing sphere to indicate encoding strength
        const sphereGeometry = new THREE.SphereGeometry(0.02 + magnitude * 0.001, 8, 6);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.5 + (magnitude % 1) * 0.3
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        this.vectorGroup.add(sphere);
    }
    
    addCoordinateLabel(position, originalIndices, coordinates) {
        // Create text label showing T, H, W coordinates with proper mapping
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 80;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, 160, 80);
        context.fillStyle = '#fff';
        context.font = '11px Arial';
        context.textAlign = 'center';
        
        // Show original indices and position mapping
        context.fillText(`T:${originalIndices.t} H:${originalIndices.h} W:${originalIndices.w}`, 80, 25);
        context.fillStyle = '#aaa';
        context.font = '9px Arial';
        context.fillText(`X:${position.x.toFixed(1)} Y:${position.y.toFixed(1)} Z:${position.z.toFixed(1)}`, 80, 45);
        context.fillText(`(W→X, H→Y, T→Z)`, 80, 60);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 0.8
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.2, 0.6, 1);
        sprite.position.set(position.x, position.y + 1.5, position.z);
        
        this.vectorGroup.add(sprite);
    }

    updateTrails(data, step) {
        this.clearTrails();
        
        if (step === 2) {
            this.createRotationTrails(data);
        }
    }

    createRotationTrails(data) {
        const trailGroups = {};
        
        data.forEach(point => {
            if (!point.position || point.angle === undefined) return;
            
            const key = `${Math.floor(point.position[0] / 4)}_${Math.floor(point.position[1] / 4)}`;
            if (!trailGroups[key]) {
                trailGroups[key] = [];
            }
            trailGroups[key].push(point);
        });
        
        Object.values(trailGroups).forEach(group => {
            if (group.length < 2) return;
            
            const points = [];
            const colors = [];
            
            group.forEach(point => {
                const radius = point.radius || 1;
                const centerX = point.position[0] - 8;
                const centerY = point.position[1] - 15;
                const centerZ = point.position[2] - 30;
                
                for (let i = 0; i < 32; i++) {
                    const angle = (i / 32) * Math.PI * 2;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    const z = centerZ;
                    
                    points.push(new THREE.Vector3(x, y, z));
                    
                    const alpha = 0.3 * (1 - i / 32);
                    colors.push(new THREE.Color(
                        point.color[0],
                        point.color[1],
                        point.color[2]
                    ).multiplyScalar(alpha));
                }
            });
            
            if (points.length > 0) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                geometry.setAttribute('color', new THREE.BufferAttribute(
                    new Float32Array(colors.length * 3), 3
                ));
                
                colors.forEach((color, i) => {
                    geometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
                });
                
                const material = new THREE.LineBasicMaterial({ 
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.6
                });
                
                const trail = new THREE.Line(geometry, material);
                this.trailMeshes.push(trail);
                this.scene.add(trail);
            }
        });
    }

    clearTrails() {
        this.trailMeshes.forEach(trail => {
            this.scene.remove(trail);
            if (trail.geometry) trail.geometry.dispose();
            if (trail.material) trail.material.dispose();
        });
        this.trailMeshes = [];
    }

    startAnimation() {
        this.isAnimating = true;
        this.animationTime = 0;
    }

    stopAnimation() {
        this.isAnimating = false;
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    render() {
        if (this.isAnimating) {
            this.animationTime += 0.016 * this.animationSpeed;
            
            if (this.currentStep === 2) {
                this.updateRotationAnimation();
            }
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        
        this.updatePerformanceMonitor();
    }

    updateRotationAnimation() {
        if (!this.currentData || this.currentData.length === 0) return;
        
        const pointCount = Math.min(this.currentData.length, this.maxPoints);
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        
        for (let i = 0; i < pointCount; i++) {
            const point = this.currentData[i];
            if (!point || !point.position) continue;
            
            const baseAngle = point.angle || 0;
            const animatedAngle = baseAngle + this.animationTime * 0.5;
            
            const centerX = point.position[0] - 8;
            const centerY = point.position[1] - 15;
            const centerZ = point.position[2] - 30;
            
            const radius = (point.radius || 1) * 0.5;
            const x = centerX + Math.cos(animatedAngle) * radius;
            const y = centerY + Math.sin(animatedAngle) * radius;
            const z = centerZ;
            
            position.set(x, y, z);
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), animatedAngle);
            scale.setScalar(0.8 + 0.4 * Math.sin(animatedAngle * 2));
            
            matrix.compose(position, quaternion, scale);
            this.instancedMesh.setMatrixAt(i, matrix);
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    updatePerformanceMonitor() {
        const now = performance.now();
        this.performanceMonitor.frameCount++;
        
        if (now - this.performanceMonitor.lastTime >= 1000) {
            this.performanceMonitor.fps = Math.round(
                (this.performanceMonitor.frameCount * 1000) / (now - this.performanceMonitor.lastTime)
            );
            this.performanceMonitor.frameCount = 0;
            this.performanceMonitor.lastTime = now;
            
            this.dispatchEvent('performance-update', {
                fps: this.performanceMonitor.fps,
                pointCount: this.instancedMesh.count
            });
        }
    }

    startRenderLoop() {
        const renderLoop = () => {
            this.render();
            this.animationId = requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    stopRenderLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    resetCamera() {
        this.camera.position.set(30, 30, 30);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
    }

    exportImage() {
        return this.renderer.domElement.toDataURL('image/png');
    }

    dispatchEvent(type, data) {
        const event = new CustomEvent(type, { detail: data });
        this.canvas.dispatchEvent(event);
    }

    dispose() {
        this.stopRenderLoop();
        this.clearTrails();
        
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.dispose();
        }
        
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        if (this.renderer) this.renderer.dispose();
        if (this.controls) this.controls.dispose();
        
        this.scene.clear();
    }
}

window.Visualization = Visualization;