# 3D Rotary Position Encoding (RoPE) Visualizer

An interactive 3D visualization tool for understanding Rotary Position Encoding (RoPE) in transformer models. This educational application provides step-by-step visualization of how 3D RoPE works, from basic position grids to final encodings.

![RoPE Visualizer](assets/screenshots/desktop.png)

## 🚀 Features

- **Interactive 3D Visualization**: Real-time 3D rendering with up to 5000 points
- **Step-by-Step Learning**: 4 educational steps explaining RoPE concepts
- **Parameter Controls**: Real-time adjustment of dimensions, frequencies, and quality
- **Animation Support**: Smooth animations showing temporal evolution
- **Performance Optimized**: 60 FPS target with instanced rendering
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **PWA Support**: Installable web app with offline capability
- **Export Functionality**: Save visualizations as PNG images

## 📚 Educational Steps

### Step 1: Position Grid
Creates 3D position coordinates for each voxel in the space. Points are colored by their position values (red=time, green=height, blue=width).

### Step 2: Frequency Scale
Different dimensions get different frequency scales for encoding. Visualizes how frequencies vary across the embedding space.

### Step 3: Rotation Matrix
Shows rotation matrices using sin/cos functions to encode positional relationships. Features animated circular rotations.

### Step 4: Final Encoding
Concatenates all dimensional encodings to create the final positional embedding, showing the complete RoPE result.

## 🛠️ Technical Implementation

### Core Technologies
- **Three.js**: 3D rendering and visualization
- **WebGL**: Hardware-accelerated graphics
- **Modern JavaScript (ES6+)**: Clean, modular code architecture
- **CSS3**: Responsive design with custom properties
- **Service Workers**: Offline functionality and caching

### Mathematical Implementation
The application implements the exact RoPE algorithm:

```python
# Frequency calculation
scale = linspace(0, (dim-2)/dim, steps=dim/2)
omega = 1.0 / (theta ** scale)

# 3D position encoding
for pos in positions:
    t, h, w = pos
    encoding = []
    
    # Apply frequencies to each dimension
    for i, freq in enumerate(omega):
        angle = pos[dim_map[i]] * freq
        encoding.extend([sin(angle), cos(angle)])
```

### Performance Features
- **Instanced Mesh Rendering**: Efficient rendering of thousands of points
- **Quality-based Subsampling**: Adaptive detail based on device capability
- **Memory Management**: Intelligent caching with 100-item limit
- **FPS Monitoring**: Real-time performance tracking

## 🎮 Controls

### Keyboard Shortcuts
- **Arrow Keys**: Navigate between steps (← →)
- **Space**: Play/pause animation
- **R**: Reset application
- **F**: Toggle fullscreen
- **H**: Show help modal
- **I**: Show about modal
- **+/-**: Adjust animation speed
- **↑↓**: Adjust quality

### Mouse Controls
- **Drag**: Rotate 3D view
- **Wheel**: Zoom in/out
- **Double-click**: Reset camera view

### Parameters
- **Time Length**: 4-32 (default: 16)
- **Height**: 8-60 (default: 30)
- **Width**: 16-120 (default: 60)
- **Dimension**: 64-256 (default: 128)
- **Theta**: 1-50k (default: 10k)
- **Quality**: Low/Medium/High

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)
Visit the live demo: [https://yourusername.github.io/rope-3d-visualizer/](https://yourusername.github.io/rope-3d-visualizer/)

### Option 2: Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rope-3d-visualizer.git
   cd rope-3d-visualizer
   ```

2. Start a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js (if you have http-server installed)
   npx http-server
   ```

3. Open `http://localhost:8000` in your browser

### Option 3: Static File Serving
Simply serve the files through any static web server. No build process required!

## 📱 PWA Installation

The app can be installed as a Progressive Web App:

1. **Desktop**: Click the install button in your browser's address bar
2. **Mobile**: Use "Add to Home Screen" from your browser menu
3. **Features**: Works offline, app-like experience, native integration

## 🎯 Use Cases

### Educational
- **ML Courses**: Visual teaching aid for transformer architectures
- **Research**: Understanding positional encoding mechanisms
- **Presentations**: Interactive demonstrations of RoPE concepts

### Development
- **Algorithm Validation**: Verify RoPE implementations
- **Parameter Tuning**: Visualize effect of different parameters
- **Debugging**: Debug positional encoding issues

## 🔧 Configuration

### URL Parameters
- `?step=N`: Start at specific step (0-3)
- `?quality=N`: Set initial quality (1-3)
- `?dim=N`: Set initial dimension
- `?fullscreen=true`: Start in fullscreen mode

### Local Storage
The app automatically saves:
- Parameter settings
- Current step
- Camera position
- Quality preferences

## 🌐 Browser Support

### Minimum Requirements
- **WebGL**: Required for 3D rendering
- **ES6**: Modern JavaScript support
- **CSS Grid**: Layout support
- **Service Workers**: Optional (for PWA features)

### Tested Browsers
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Recommendations
- **Desktop**: Best experience on dedicated graphics
- **Mobile**: Medium quality recommended
- **Low-end devices**: Use Low quality setting

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly across devices
5. Submit a pull request

### Code Style
- **JavaScript**: ES6+ with clear, descriptive naming
- **CSS**: BEM methodology with custom properties
- **HTML**: Semantic markup with proper accessibility
- **Comments**: Document complex algorithms and mathematical concepts

### Areas for Contribution
- 🎨 **Visualization**: New rendering techniques or visual effects
- 🧮 **Mathematics**: Additional RoPE variants or implementations
- 📱 **Mobile**: Enhanced mobile experience and performance
- 🌐 **Accessibility**: Screen reader support and keyboard navigation
- 📖 **Documentation**: Tutorials, examples, and guides
- 🔧 **Features**: Export formats, sharing capabilities, batch processing

## 📊 Performance Metrics

### Target Performance
- **FPS**: 60 on modern devices, 30+ on mobile
- **Load Time**: <3 seconds on 3G connection
- **Memory**: <100MB for typical usage
- **Points**: Up to 5000 rendered simultaneously

### Optimization Features
- Instanced mesh rendering for efficiency
- Frustum culling for off-screen objects
- Level-of-detail based on distance
- Automatic quality adjustment for mobile

## 🔍 Troubleshooting

### Common Issues

**Visualization not loading**
- Check WebGL support: Visit `chrome://gpu/`
- Update graphics drivers
- Try different browser

**Poor performance**
- Reduce quality setting
- Close other browser tabs
- Check for background apps

**Controls not responding**
- Refresh the page
- Check for JavaScript errors in console
- Try different input method

**PWA installation issues**
- Ensure HTTPS connection (required for PWA)
- Check manifest.json is accessible
- Clear browser cache and try again

## 📖 Additional Resources

### RoPE Research Papers
- [RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864)
- [3D RoPE: Three-Dimensional Rotary Position Embedding](https://arxiv.org/abs/2104.09864)

### Mathematical Background
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762) - Original Transformer paper
- [Position Information in Transformers](https://arxiv.org/abs/2102.11090) - Comprehensive position encoding survey

### Implementation References
- [Hugging Face Transformers](https://huggingface.co/transformers/) - Production RoPE implementations
- [PyTorch Implementation](https://github.com/pytorch/pytorch) - Reference implementations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **RoFormer Team**: Original RoPE research and implementation
- **Three.js Community**: Excellent 3D rendering framework
- **Open Source Contributors**: Libraries and tools that made this possible
- **Educational Community**: Feedback and suggestions for improvements

## 📞 Support

### Getting Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/rope-3d-visualizer/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/yourusername/rope-3d-visualizer/discussions)
- 📧 **Direct Contact**: your.email@example.com

### Community
- 🌟 **Star the repo** if you find it useful
- 🐦 **Share on social media** to help others discover it
- 🤝 **Contribute** to make it even better

---

**Made with ❤️ for the ML education community**

> *"Understanding through visualization makes complex concepts accessible to everyone."*