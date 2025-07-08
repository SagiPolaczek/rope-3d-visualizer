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
        this.currentStep = 0;
        this.currentData = [];
        
        // Dynamic properties that adapt to tensor size
        this.tensorCenter = { x: 0, y: 0, z: 0 };
        this.tensorDimensions = { t_len: 1, h_len: 1, w_len: 1 };
        this.adaptiveScale = { sphere: 0.05, vector: 1.0, spacing: 1.0 };
        
        // Consistent grid spacing for all calculations
        this.gridSpacing = 0.8;
        
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
        
        // Visualization groups
        this.vectorGroup = null;
        this.rotationGroup = null;
        
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
    
    // FIXED: Dynamic tensor center calculation from actual data
    getTensorCenter(data) {
        if (!data || data.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const point of data) {
            if (point.position) {
                minX = Math.min(minX, point.position[0]);
                maxX = Math.max(maxX, point.position[0]);
                minY = Math.min(minY, point.position[1]);
                maxY = Math.max(maxY, point.position[1]);
                minZ = Math.min(minZ, point.position[2]);
                maxZ = Math.max(maxZ, point.position[2]);
            }
        }
        
        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2
        };
    }
    
    // FIXED: Adaptive scaling based on tensor dimensions with consistent grid spacing
    getAdaptiveScale(t_len, h_len, w_len) {
        const maxDim = Math.max(t_len, h_len, w_len);
        
        // Adaptive sphere radius: smaller for denser tensors, relative to grid spacing
        const baseSphereRadius = 0.12;
        const sphereScale = Math.max(0.03, baseSphereRadius / Math.pow(maxDim, 0.3)) * this.gridSpacing;
        
        // Adaptive vector scaling relative to grid spacing
        const baseVectorScale = 1.0;
        const vectorScale = baseVectorScale * Math.max(0.5, Math.min(2.0, 10 / maxDim)) * this.gridSpacing;
        
        // Consistent spacing matches the fixed grid spacing
        const spacingScale = this.gridSpacing;
        
        return {
            sphere: sphereScale,
            vector: vectorScale,
            spacing: spacingScale
        };
    }
    
    // FIXED: Temporal-aware subsampling that preserves time relationships
    subsampleWithTemporalContinuity(data, targetCount) {
        if (data.length <= targetCount) {
            return data;
        }
        
        // Extract tensor dimensions from data
        const coords = data.map(p => p.originalIndices || p.coordinates || { t: 0, h: 0, w: 0 });
        const maxT = Math.max(...coords.map(c => c.t));
        const maxH = Math.max(...coords.map(c => c.h));
        const maxW = Math.max(...coords.map(c => c.w));
        
        const t_len = maxT + 1;
        const h_len = maxH + 1;
        const w_len = maxW + 1;
        
        // Calculate sampling ratios that preserve temporal structure
        const totalRatio = Math.pow(targetCount / data.length, 1/3);
        const tStep = Math.max(1, Math.round(t_len / Math.ceil(t_len * totalRatio)));
        const hStep = Math.max(1, Math.round(h_len / Math.ceil(h_len * totalRatio)));
        const wStep = Math.max(1, Math.round(w_len / Math.ceil(w_len * totalRatio)));
        
        const subsample = [];
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            const coord = point.originalIndices || point.coordinates || { t: 0, h: 0, w: 0 };
            
            if (coord.t % tStep === 0 && coord.h % hStep === 0 && coord.w % wStep === 0) {
                subsample.push(point);
            }
        }
        
        return subsample.length > 0 ? subsample : data.slice(0, targetCount);
    }
    
    updateCameraForTensor(t_len, h_len, w_len) {
        // Store tensor dimensions
        this.tensorDimensions = { t_len, h_len, w_len };
        
        // Calculate tensor center (matches data coordinate system with grid spacing)
        const centerX = (w_len - 1) / 2 * this.gridSpacing;
        const centerY = (h_len - 1) / 2 * this.gridSpacing;  
        const centerZ = (t_len - 1) / 2 * this.gridSpacing;
        
        // Update stored tensor center
        this.tensorCenter = { x: centerX, y: centerY, z: centerZ };
        
        // Calculate optimal camera distance based on tensor size with grid spacing
        const maxDim = Math.max(w_len, h_len, t_len);
        const tensorSize = maxDim * this.gridSpacing;
        const distance = Math.max(20, tensorSize * 3);
        
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
        
        // Update adaptive scaling
        this.adaptiveScale = this.getAdaptiveScale(t_len, h_len, w_len);
        
        // Update visualization scale
        this.updateVisualizationScale();
    }
    
    // FIXED: Update all visualization elements when tensor size changes
    updateVisualizationScale() {
        // Update instanced mesh sphere radius
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = new THREE.SphereGeometry(this.adaptiveScale.sphere, 8, 6);
            if (this.instancedMesh) {
                this.instancedMesh.geometry = this.geometry;
            }
        }
        
        // Update axes helper size (accounting for grid spacing)
        if (this.axesHelper) {
            this.scene.remove(this.axesHelper);
            const maxDim = Math.max(this.tensorDimensions.t_len, 
                                   this.tensorDimensions.h_len, 
                                   this.tensorDimensions.w_len);
            const axesSize = Math.max(2, Math.min(15, maxDim * this.gridSpacing * 0.5));
            this.axesHelper = new THREE.AxesHelper(axesSize);
            this.axesHelper.position.set(
                -axesSize * 0.1,
                -axesSize * 0.1,
                -axesSize * 0.1
            );
            this.scene.add(this.axesHelper);
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
        this.axesHelper.position.set(-1, -1, -1);
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
        this.geometry = new THREE.SphereGeometry(this.adaptiveScale.sphere, 8, 6);
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
        this.currentData = data;
        this.currentStep = step;
        
        if (!data || data.length === 0) {
            this.instancedMesh.count = 0;
            return;
        }
        
        // Don't recalculate tensor center from data - use the one set by updateCameraForTensor
        // this.tensorCenter = this.getTensorCenter(data);
        
        // Extract tensor dimensions from data for consistency checks
        if (data[0] && data[0].originalIndices) {
            let maxT = 0, maxH = 0, maxW = 0;
            for (const point of data) {
                if (point.originalIndices) {
                    maxT = Math.max(maxT, point.originalIndices.t);
                    maxH = Math.max(maxH, point.originalIndices.h);
                    maxW = Math.max(maxW, point.originalIndices.w);
                }
            }
            const detectedDimensions = { t_len: maxT + 1, h_len: maxH + 1, w_len: maxW + 1 };
            
            // Only update if dimensions actually changed (to avoid camera jumping)
            if (this.tensorDimensions.t_len !== detectedDimensions.t_len ||
                this.tensorDimensions.h_len !== detectedDimensions.h_len ||
                this.tensorDimensions.w_len !== detectedDimensions.w_len) {
                
                this.tensorDimensions = detectedDimensions;
                this.adaptiveScale = this.getAdaptiveScale(this.tensorDimensions.t_len, 
                                                           this.tensorDimensions.h_len, 
                                                           this.tensorDimensions.w_len);
                this.updateVisualizationScale();
            }
        }
        
        // Apply LOD (Level of Detail) for performance
        const lodData = this.applyLevelOfDetail(data);
        const pointCount = Math.min(lodData.length, this.maxPoints);
        this.instancedMesh.count = pointCount;
        
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);
        const quaternion = new THREE.Quaternion();
        
        for (let i = 0; i < pointCount; i++) {
            const point = lodData[i];
            if (!point || !point.position) continue;
            
            // Use exact position from data without hardcoded offsets
            position.set(
                point.position[0],
                point.position[1], 
                point.position[2]
            );
            
            if (step === 2 && point.angle !== undefined) {
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), point.angle * 0.1);
                scale.setScalar(0.8 + 0.4 * Math.sin(point.angle));
            } else if (point.size !== undefined) {
                quaternion.set(0, 0, 0, 1);
                scale.setScalar(Math.max(0.5, point.size * this.adaptiveScale.sphere * 10));
            } else {
                quaternion.set(0, 0, 0, 1);
                scale.setScalar(this.adaptiveScale.sphere * 20); // Scale with adaptive radius
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
        
        // Show final RoPE encoding visualization
        this.visualizeFinalRoPEEncoding(lodData);
        
        this.updateTrails(lodData, step);
    }
    
    // FIXED: Level of Detail system for performance optimization
    applyLevelOfDetail(data) {
        const totalPoints = data.length;
        
        // Performance thresholds
        if (totalPoints <= 1000) {
            return data; // Show all points for small tensors
        } else if (totalPoints <= 5000) {
            return this.subsampleWithTemporalContinuity(data, 2000); // Medium LOD
        } else if (totalPoints <= 20000) {
            return this.subsampleWithTemporalContinuity(data, 1000); // High LOD
        } else {
            return this.subsampleWithTemporalContinuity(data, 500); // Ultra LOD
        }
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
    
    // FIXED: All vector creation methods use tensor-relative coordinates
    visualizeFinalRoPEEncoding(data) {
        // Smart subsampling for vector visualization based on tensor size
        const totalPoints = data.length;
        const maxVectorPoints = Math.min(500, Math.max(50, totalPoints / 10));
        const vectorStep = Math.max(1, Math.floor(data.length / maxVectorPoints));
        
        for (let i = 0; i < data.length; i += vectorStep) {
            const point = data[i];
            if (!point || point.type !== 'final_encoding') continue;
            
            // Use actual point position without hardcoded offsets
            const basePos = new THREE.Vector3(...point.position);
            
            if (point.vectorPairs && point.vectorPairs.length > 0) {
                this.visualizeRoPEVectors(basePos, point, true);
            }
        }
    }
    
    // FIXED: Remove hardcoded position offsets, use tensor-relative positioning
    visualizeRoPEVectors(basePos, point, simplified = false) {
        const maxVectors = simplified ? Math.min(3, point.vectorPairs.length) : Math.min(6, point.vectorPairs.length);
        
        for (let v = 0; v < maxVectors; v++) {
            const vectorPair = point.vectorPairs[v];
            if (!vectorPair || !vectorPair.vectors) continue;
            
            const opacity = 0.8 - v * 0.1;
            const scale = this.adaptiveScale.vector * (1.0 - v * 0.12);
            
            // Offset position relative to tensor spacing, not hardcoded values
            const offsetPos = new THREE.Vector3(
                basePos.x + (v % 3 - 1) * this.adaptiveScale.spacing * 0.4,
                basePos.y + Math.floor(v / 3) * this.adaptiveScale.spacing * 0.4,
                basePos.z
            );
            
            // Determine color based on dimension
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
                this.createRoPEArrow(offsetPos, vector, vectorColor, scale * 0.8, opacity);
            }
            
            if (!simplified) {
                this.createEncodingMagnitudeIndicator(offsetPos, point.magnitude);
            }
        }
        
        // Add coordinate label for some points
        if (!simplified && Math.random() < 0.05) {
            this.addCoordinateLabel(basePos, point.originalIndices);
        }
    }
    
    createRoPEArrow(startPos, direction, color, scale, opacity) {
        const vectorLength = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
        if (vectorLength < 0.05) return;
        
        // Adaptive arrow size based on tensor scale
        const arrowRadius = this.adaptiveScale.sphere * 1.2;
        const arrowHeight = this.adaptiveScale.sphere * 4;
        
        const arrowGeometry = new THREE.ConeGeometry(arrowRadius, arrowHeight, 8);
        const arrowMaterial = new THREE.MeshLambertMaterial({ 
            color: color, 
            transparent: true, 
            opacity: opacity
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
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
        
        const ropeGroup = new THREE.Group();
        ropeGroup.add(line);
        ropeGroup.add(arrow);
        ropeGroup.position.copy(startPos);
        
        this.vectorGroup.add(ropeGroup);
    }
    
    createEncodingMagnitudeIndicator(position, magnitude) {
        const sphereRadius = this.adaptiveScale.sphere * (0.4 + magnitude * 0.02);
        const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 8, 6);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.5 + (magnitude % 1) * 0.3
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        this.vectorGroup.add(sphere);
    }
    
    addCoordinateLabel(position, originalIndices) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 80;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, 160, 80);
        context.fillStyle = '#fff';
        context.font = '11px Arial';
        context.textAlign = 'center';
        
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
        sprite.scale.set(1.2 * this.adaptiveScale.spacing, 0.6 * this.adaptiveScale.spacing, 1);
        sprite.position.set(position.x, position.y + 1.5 * this.adaptiveScale.spacing, position.z);
        
        this.vectorGroup.add(sprite);
    }

    updateTrails(data, step) {
        this.clearTrails();
        
        if (step === 2) {
            this.createRotationTrails(data);
        }
    }

    // FIXED: Use dynamic centering instead of hardcoded offsets
    createRotationTrails(data) {
        const trailGroups = {};
        const groupingSize = this.adaptiveScale.spacing * 4;
        
        data.forEach(point => {
            if (!point.position || point.angle === undefined) return;
            
            const key = `${Math.floor(point.position[0] / groupingSize)}_${Math.floor(point.position[1] / groupingSize)}`;
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
                const radius = (point.radius || 1) * this.adaptiveScale.spacing;
                // Use actual position without hardcoded offsets
                const centerX = point.position[0];
                const centerY = point.position[1];
                const centerZ = point.position[2];
                
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

    // FIXED: Use actual tensor coordinates without hardcoded offsets
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
            
            // Use actual position without hardcoded offsets
            const centerX = point.position[0];
            const centerY = point.position[1];
            const centerZ = point.position[2];
            
            const radius = (point.radius || 1) * this.adaptiveScale.spacing * 0.5;
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