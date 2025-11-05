# 1. req 1.

写一个微信小程序：
> 1. 获取手机陀螺仪信息，
> 2. 能够区分人员行走以及原地打转或胳膊抖动。
> 3. 能够获取人员行走方向。
> 4. 能够根据人员行走方向进行线路绘制。

# 微信小程序 - 运动轨迹追踪

下面是一个完整的微信小程序，可以获取陀螺仪数据，识别行走状态，追踪行走方向并绘制轨迹。

## 小程序代码实现

### 1. 项目配置文件

**app.json**
```json
{
  "pages": [
    "pages/index/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "运动轨迹追踪",
    "navigationBarTextStyle": "black"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json",
  "requiredPrivateInfos": [
    "onGyroscopeChange"
  ]
}
```

**app.js**
```javascript
App({
  onLaunch() {
    // 小程序启动时的逻辑
  }
})
```

### 2. 主页面实现

**pages/index/index.wxml**
```xml
<view class="container">
  <view class="status-section">
    <text class="status-title">运动状态:</text>
    <text class="status-value {{motionStateClass}}">{{motionStateText}}</text>
  </view>
  
  <view class="direction-section">
    <text class="direction-title">当前方向:</text>
    <text class="direction-value">{{directionText}}</text>
  </view>
  
  <view class="data-section">
    <text>X轴角速度: {{gyroData.x.toFixed(4)}} rad/s</text>
    <text>Y轴角速度: {{gyroData.y.toFixed(4)}} rad/s</text>
    <text>Z轴角速度: {{gyroData.z.toFixed(4)}} rad/s</text>
  </view>
  
  <view class="canvas-container">
    <canvas 
      canvas-id="motionCanvas" 
      class="motion-canvas"
      disable-scroll="true"
      bindtouchstart="canvasTouchStart"
      bindtouchmove="canvasTouchMove"
      bindtouchend="canvasTouchEnd">
    </canvas>
  </view>
  
  <view class="control-section">
    <button class="control-btn {{isMonitoring ? 'stop' : 'start'}}" 
            bindtap="toggleMonitoring">
      {{isMonitoring ? '停止监测' : '开始监测'}}
    </button>
    <button class="control-btn clear" bindtap="clearCanvas">清除轨迹</button>
  </view>
</view>
```

**pages/index/index.wxss**
```css
.container {
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.status-section, .direction-section {
  width: 90%;
  display: flex;
  justify-content: space-between;
  margin: 20rpx 0;
  padding: 20rpx;
  background: white;
  border-radius: 10rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}

.status-title, .direction-title {
  font-weight: bold;
  color: #333;
}

.status-value {
  font-weight: bold;
}

.status-walking {
  color: #4CAF50;
}

.status-rotating {
  color: #FF9800;
}

.status-shaking {
  color: #F44336;
}

.status-idle {
  color: #9E9E9E;
}

.direction-value {
  color: #2196F3;
  font-weight: bold;
}

.data-section {
  width: 90%;
  background: white;
  border-radius: 10rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}

.data-section text {
  display: block;
  margin: 10rpx 0;
  color: #666;
}

.canvas-container {
  width: 90%;
  height: 400rpx;
  background: white;
  border-radius: 10rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
  overflow: hidden;
}

.motion-canvas {
  width: 100%;
  height: 100%;
}

.control-section {
  display: flex;
  justify-content: space-around;
  width: 90%;
}

.control-btn {
  width: 45%;
  padding: 20rpx;
  border: none;
  border-radius: 50rpx;
  color: white;
  font-weight: bold;
  box-shadow: 0 4rpx 8rpx rgba(0,0,0,0.2);
}

.control-btn.start {
  background: #4CAF50;
}

.control-btn.stop {
  background: #F44336;
}

.control-btn.clear {
  background: #FF9800;
}
```

**pages/index/index.js**
```javascript
Page({
  data: {
    isMonitoring: false,
    motionStateText: '静止',
    motionStateClass: 'status-idle',
    directionText: '未知',
    gyroData: {
      x: 0,
      y: 0,
      z: 0
    },
    // 运动状态检测
    motionState: 'idle', // idle, walking, rotating, shaking
    // 轨迹数据
    pathPoints: [],
    lastPoint: null,
    canvasContext: null,
    // 陀螺仪数据缓冲区（用于平滑处理）
    gyroBuffer: {
      x: [],
      y: [],
      z: []
    },
    bufferSize: 10
  },

  onLoad() {
    // 初始化画布
    this.initCanvas();
  },

  onUnload() {
    // 页面卸载时停止监听
    if (this.data.isMonitoring) {
      this.stopGyroscope();
    }
  },

  // 初始化画布
  initCanvas() {
    const context = wx.createCanvasContext('motionCanvas', this);
    this.setData({
      canvasContext: context
    });
    
    // 绘制初始网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
  },

  // 绘制网格
  drawGrid() {
    const ctx = this.data.canvasContext;
    const width = 340; // 画布宽度
    const height = 400; // 画布高度
    const gridSize = 40; // 网格大小
    
    ctx.setStrokeStyle('#e0e0e0');
    ctx.setLineWidth(1);
    
    // 绘制垂直线
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // 绘制水平线
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    ctx.stroke();
  },

  // 绘制中心点
  drawCenterPoint() {
    const ctx = this.data.canvasContext;
    const centerX = 170; // 画布中心X
    const centerY = 200; // 画布中心Y
    
    ctx.setFillStyle('#2196F3');
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.draw();
  },

  // 开始/停止监测
  toggleMonitoring() {
    if (this.data.isMonitoring) {
      this.stopGyroscope();
    } else {
      this.startGyroscope();
    }
  },

  // 开始陀螺仪监测
  startGyroscope() {
    const that = this;
    
    // 监听陀螺仪数据
    wx.startGyroscope({
      interval: 'game',
      success: () => {
        that.setData({
          isMonitoring: true
        });
        
        wx.onGyroscopeChange((res) => {
          that.processGyroData(res);
        });
      },
      fail: (err) => {
        wx.showToast({
          title: '陀螺仪启动失败',
          icon: 'none'
        });
        console.error('陀螺仪启动失败:', err);
      }
    });
  },

  // 停止陀螺仪监测
  stopGyroscope() {
    wx.stopGyroscope();
    wx.offGyroscopeChange();
    
    this.setData({
      isMonitoring: false,
      motionStateText: '静止',
      motionStateClass: 'status-idle'
    });
  },

  // 处理陀螺仪数据
  processGyroData(res) {
    // 更新陀螺仪数据显示
    this.setData({
      gyroData: {
        x: res.x,
        y: res.y,
        z: res.z
      }
    });
    
    // 添加到缓冲区
    this.addToBuffer(res);
    
    // 分析运动状态
    this.analyzeMotion();
    
    // 更新轨迹
    this.updatePath();
  },

  // 添加到数据缓冲区（平滑处理）
  addToBuffer(data) {
    const buffer = this.data.gyroBuffer;
    
    // 添加新数据
    buffer.x.push(data.x);
    buffer.y.push(data.y);
    buffer.z.push(data.z);
    
    // 保持缓冲区大小
    if (buffer.x.length > this.data.bufferSize) {
      buffer.x.shift();
      buffer.y.shift();
      buffer.z.shift();
    }
    
    this.setData({
      gyroBuffer: buffer
    });
  },

  // 分析运动状态
  analyzeMotion() {
    const buffer = this.data.gyroBuffer;
    
    // 计算缓冲区数据的标准差（波动程度）
    const xStd = this.calculateStd(buffer.x);
    const yStd = this.calculateStd(buffer.y);
    const zStd = this.calculateStd(buffer.z);
    
    // 计算总波动
    const totalVariation = xStd + yStd + zStd;
    
    // 判断运动状态
    let newState = 'idle';
    let stateText = '静止';
    let stateClass = 'status-idle';
    
    if (totalVariation > 0.5) {
      // 高波动，可能是行走或抖动
      if (zStd > 0.3 && Math.abs(buffer.z[buffer.z.length-1]) < 0.1) {
        // Z轴有规律波动且平均值接近0，可能是行走
        newState = 'walking';
        stateText = '行走中';
        stateClass = 'status-walking';
      } else if (xStd > 0.4 || yStd > 0.4) {
        // X或Y轴有较大波动，可能是旋转
        newState = 'rotating';
        stateText = '旋转中';
        stateClass = 'status-rotating';
      } else {
        // 其他高波动情况，判断为抖动
        newState = 'shaking';
        stateText = '手臂抖动';
        stateClass = 'status-shaking';
      }
    }
    
    // 更新运动状态显示
    if (this.data.motionState !== newState) {
      this.setData({
        motionState: newState,
        motionStateText: stateText,
        motionStateClass: stateClass
      });
    }
    
    // 更新方向显示
    this.updateDirectionDisplay(buffer);
  },

  // 计算标准差
  calculateStd(arr) {
    if (arr.length === 0) return 0;
    
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const squareDiffs = arr.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
    
    return Math.sqrt(avgSquareDiff);
  },

  // 更新方向显示
  updateDirectionDisplay(buffer) {
    if (buffer.x.length < 5) return;
    
    // 使用最近几个数据点判断主要运动方向
    const recentX = buffer.x.slice(-5);
    const recentY = buffer.y.slice(-5);
    
    const avgX = recentX.reduce((a, b) => a + b) / recentX.length;
    const avgY = recentY.reduce((a, b) => a + b) / recentY.length;
    
    let direction = '未知';
    
    // 根据X/Y轴角速度判断方向
    if (Math.abs(avgX) > Math.abs(avgY)) {
      // X轴主导（左右转向）
      direction = avgX > 0 ? '向右转' : '向左转';
    } else {
      // Y轴主导（前后倾斜）
      direction = avgY > 0 ? '向前倾' : '向后仰';
    }
    
    // 如果波动很小，显示为"直行"
    if (Math.abs(avgX) < 0.05 && Math.abs(avgY) < 0.05) {
      direction = '直行';
    }
    
    this.setData({
      directionText: direction
    });
  },

  // 更新运动轨迹
  updatePath() {
    if (this.data.motionState !== 'walking') return;
    
    const buffer = this.data.gyroBuffer;
    if (buffer.x.length < 2) return;
    
    // 使用X/Y轴角速度计算位移
    const deltaX = buffer.x[buffer.x.length-1] * 10; // 缩放因子
    const deltaY = buffer.y[buffer.y.length-1] * 10;
    
    // 获取上一个点或使用中心点
    let lastX, lastY;
    if (this.data.lastPoint) {
      lastX = this.data.lastPoint.x;
      lastY = this.data.lastPoint.y;
    } else {
      lastX = 170; // 画布中心X
      lastY = 200; // 画布中心Y
    }
    
    // 计算新点位置
    const newX = Math.max(10, Math.min(330, lastX + deltaX)); // 限制在画布内
    const newY = Math.max(10, Math.min(390, lastY + deltaY));
    
    const newPoint = { x: newX, y: newY };
    
    // 添加到路径点
    const pathPoints = this.data.pathPoints;
    pathPoints.push(newPoint);
    
    // 保持路径点数量合理
    if (pathPoints.length > 100) {
      pathPoints.shift();
    }
    
    this.setData({
      pathPoints: pathPoints,
      lastPoint: newPoint
    });
    
    // 绘制路径
    this.drawPath();
  },

  // 绘制运动路径
  drawPath() {
    const ctx = this.data.canvasContext;
    const pathPoints = this.data.pathPoints;
    
    if (pathPoints.length < 2) return;
    
    // 清除画布
    ctx.clearRect(0, 0, 340, 400);
    
    // 重新绘制网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
    
    // 设置路径样式
    ctx.setStrokeStyle('#4CAF50');
    ctx.setLineWidth(3);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');
    
    // 开始绘制路径
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    
    ctx.stroke();
    
    // 绘制当前位置点
    const lastPoint = pathPoints[pathPoints.length-1];
    ctx.setFillStyle('#F44336');
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.draw();
  },

  // 清除画布
  clearCanvas() {
    const ctx = this.data.canvasContext;
    
    // 清除画布
    ctx.clearRect(0, 0, 340, 400);
    
    // 重置路径数据
    this.setData({
      pathPoints: [],
      lastPoint: null
    });
    
    // 重新绘制网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
  },

  // 画布触摸事件（用于测试）
  canvasTouchStart(e) {
    this.setData({
      touchStart: e.touches[0]
    });
  },

  canvasTouchMove(e) {
    // 可以添加手动绘制功能（测试用）
  },

  canvasTouchEnd(e) {
    // 触摸结束处理
  }
})
```

### 3. 其他配置文件

**sitemap.json**
```json
{
  "desc": "关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html",
  "rules": [{
    "action": "allow",
    "page": "*"
  }]
}
```

**project.config.json**
```json
{
  "description": "项目配置文件",
  "packOptions": {
    "ignore": []
  },
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "preloadBackgroundData": false,
    "minified": true,
    "newFeature": false,
    "coverView": true,
    "nodeModules": false,
    "autoAudits": false,
    "showShadowRootInWxmlPanel": true,
    "scopeDataCheck": false,
    "uglifyFileName": false,
    "checkInvalidKey": true,
    "checkSiteMap": true,
    "uploadWithSourceMap": true,
    "compileHotReLoad": false,
    "useMultiFrameRuntime": true,
    "useApiHook": true,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    },
    "enableEngineNative": false,
    "bundle": false,
    "useIsolateContext": true,
    "useCompilerModule": true,
    "userConfirmedUseCompilerModuleSwitch": false,
    "packNpmManually": false,
    "packNpmRelationList": []
  },
  "compileType": "miniprogram",
  "libVersion": "2.19.4",
  "appid": "touristappid",
  "projectname": "motion-tracker",
  "debugOptions": {
    "hidedInDevtools": []
  },
  "scripts": {},
  "isGameTourist": false,
  "simulatorType": "wechat",
  "simulatorPluginLibVersion": {},
  "condition": {
    "search": {
      "current": -1,
      "list": []
    },
    "conversation": {
      "current": -1,
      "list": []
    },
    "game": {
      "current": -1,
      "list": []
    },
    "plugin": {
      "current": -1,
      "list": []
    },
    "gamePlugin": {
      "current": -1,
      "list": []
    },
    "miniprogram": {
      "current": -1,
      "list": []
    }
  }
}
```

## 功能说明

1. **陀螺仪数据获取**：实时获取手机陀螺仪的X、Y、Z轴角速度数据
2. **运动状态识别**：
   - 行走检测：通过分析Z轴规律性波动识别
   - 旋转检测：通过X/Y轴较大波动识别
   - 手臂抖动检测：通过不规则高波动识别
3. **方向判断**：根据X/Y轴角速度判断运动方向（左转、右转、前倾、后仰）
4. **轨迹绘制**：在行走状态下，根据陀螺仪数据绘制运动轨迹

## 使用说明

1. 在微信开发者工具中创建新项目，导入上述文件
2. 确保在app.json中已声明陀螺仪权限
3. 点击"开始监测"按钮启动陀螺仪
4. 手持手机进行不同运动测试功能
5. 观察运动状态识别和轨迹绘制效果

## 注意事项

- 实际行走检测效果受手机放置方式和步行模式影响
- 轨迹绘制是基于陀螺仪数据的模拟，非GPS定位
- 不同手机陀螺仪灵敏度可能有所差异

这个小程序提供了基本的运动状态识别和轨迹绘制功能，您可以根据实际需求进一步优化算法和界面。