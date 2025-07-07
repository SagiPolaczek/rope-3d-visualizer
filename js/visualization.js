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
        
        this.maxPoints = 5000;
        this.pointRadius = 0.1;
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
        this.camera.position.set(30, 30, 30);
        this.camera.lookAt(0, 0, 0);
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
        this.controls.maxDistance = 100;
        this.controls.minDistance = 5;
        this.controls.maxPolarAngle = Math.PI;
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
        this.axesHelper = new THREE.AxesHelper(25);
        this.scene.add(this.axesHelper);
        
        const axesColors = [0xff0000, 0x00ff00, 0x0000ff];
        const axesLabels = ['X', 'Y', 'Z'];
        
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
            position.setComponent(index, 28);
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
    }

    updateVisualization(data, step) {
        this.currentData = data;
        this.currentStep = step;
        
        if (!data || data.length === 0) {
            this.instancedMesh.count = 0;
            return;
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
            
            position.set(
                point.position[0] - 8,
                point.position[1] - 15,
                point.position[2] - 30
            );
            
            if (step === 2 && point.angle !== undefined) {
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), point.angle * 0.1);
                scale.setScalar(0.8 + 0.4 * Math.sin(point.angle));
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
        
        this.updateTrails(data, step);
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