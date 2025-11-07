# 1.需求

如何解决:基于我们目前的技术方案(微信小程序 H5)，无法获取到硬件本身的过多传感数据，主要获取到的是:陀螺仪数据、加速计数据;需要根据传感器数据计算出以下几种数据:
1)人是否在移动，这里指的是人，不是手机; 
   人可以在原地转圈、踱步，原地摆臂等情况，此种情况算为 未移动;
   只有真正的迈开步子，才算为移动，行走方式中包括:手机平举移动、握住手机摆臂移动、手机放在口袋正常移动;
2)人是在前进还是后退
3)移动的距离:计算出每秒人的前进距离，此处不要依据手机本身的定位(室内不准)。

技术要求:
1.提供 js语言的算法，如果有其它反感，需要自行翻译
2.算法可以有偏差，但是可以通过调整值控制偏差
2.提供内容为程序脚本，H5 的 demo示例
3.需要考虑 javascript 技术可以获取到的传感器数据，避免原生 app能获取，但是转移到javascript 语言 算法无法获取的情况。

# 2.  基于传感器数据的行人移动检测算法 - 微信小程序

下面是一个完整的微信小程序，实现行人移动检测、方向识别和距离估算。

## 完整小程序代码

### 1. 项目结构
```
project/
├── app.json
├── app.js
├── pages/
│   └── index/
│       ├── index.wxml
│       ├── index.wxss
│       ├── index.js
│       └── index.json
└── utils/
    └── motionDetection.js
```

### 2. 核心算法文件

**utils/motionDetection.js**
```javascript
/**
 * 行人移动检测算法
 * 基于陀螺仪和加速度计数据识别行走状态
 */
class MotionDetection {
  constructor() {
    // 状态变量
    this.state = {
      isMoving: false,           // 是否在移动
      isWalking: false,          // 是否在行走
      direction: 'stationary',   // 方向: stationary/forward/backward
      distance: 0,              // 总移动距离(米)
      stepCount: 0,             // 步数统计
      speed: 0                  // 当前速度(m/s)
    };

    // 传感器数据缓冲区
    this.buffer = {
      accelerometer: [],
      gyroscope: [],
      timestamps: []
    };

    // 算法参数（可调整）
    this.params = {
      bufferSize: 20,           // 缓冲区大小
      stepThreshold: 1.2,        // 步伐检测阈值
      walkThreshold: 0.15,       // 行走判断阈值
      moveThreshold: 0.08,       // 移动判断阈值
      minStepInterval: 300,      // 最小步伐间隔(ms)
      maxStepInterval: 2000,     // 最大步伐间隔(ms)
      avgStepLength: 0.7,        // 平均步长(米)
      smoothingFactor: 0.8       // 平滑因子
    };

    // 历史数据
    this.history = {
      lastStepTime: 0,
      lastAcceleration: { x: 0, y: 0, z: 0 },
      filteredAcceleration: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * 处理传感器数据
   */
  processSensorData(accelerometer, gyroscope, timestamp) {
    // 1. 数据预处理
    const processedAccel = this.preprocessData(accelerometer, 'accelerometer');
    const processedGyro = this.preprocessData(gyroscope, 'gyroscope');

    // 2. 更新数据缓冲区
    this.updateBuffer(processedAccel, processedGyro, timestamp);

    // 3. 运动状态分析
    this.analyzeMotion();

    // 4. 步伐检测
    this.detectSteps();

    // 5. 方向判断
    this.determineDirection();

    return this.getState();
  }

  /**
   * 数据预处理 - 滤波和校准
   */
  preprocessData(data, type) {
    // 低通滤波减少噪声
    const filtered = {};
    const keys = Object.keys(data);
    
    keys.forEach(key => {
      // 简单的低通滤波
      if (type === 'accelerometer') {
        this.history.filteredAcceleration[key] = 
          this.params.smoothingFactor * this.history.filteredAcceleration[key] + 
          (1 - this.params.smoothingFactor) * data[key];
        
        filtered[key] = this.history.filteredAcceleration[key];
      } else {
        filtered[key] = data[key];
      }
    });

    return filtered;
  }

  /**
   * 更新数据缓冲区
   */
  updateBuffer(accel, gyro, timestamp) {
    this.buffer.accelerometer.push({...accel});
    this.buffer.gyroscope.push({...gyro});
    this.buffer.timestamps.push(timestamp);

    // 保持缓冲区大小
    if (this.buffer.accelerometer.length > this.params.bufferSize) {
      this.buffer.accelerometer.shift();
      this.buffer.gyroscope.shift();
      this.buffer.timestamps.shift();
    }
  }

  /**
   * 分析运动状态
   */
  analyzeMotion() {
    if (this.buffer.accelerometer.length < 5) 
        return;

    // 计算加速度方差（运动强度）
    const variance = this.calculateAccelerationVariance();
    
    // 计算陀螺仪活动度（旋转强度）
    const rotationIntensity = this.calculateRotationIntensity();

    // 判断是否在移动
    const wasMoving = this.state.isMoving;
    this.state.isMoving = variance > this.params.moveThreshold;

    // 判断是否在行走（排除原地动作）
    this.state.isWalking = this.state.isMoving && 
                          variance > this.params.walkThreshold && 
                          rotationIntensity < 0.5; // 限制旋转强度

    // 状态变化检测
    if (!wasMoving && this.state.isMoving) {
      this.onMovementStart();
    } else if (wasMoving && !this.state.isMoving) {
      this.onMovementStop();
    }
  }

  /**
   * 计算加速度方差
   */
  calculateAccelerationVariance() {
    const accels = this.buffer.accelerometer;
    if (accels.length === 0) 
        return 0;

    const magnitudes = accels.map(a => {
      return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    });

    const mean = magnitudes.reduce((sum, val) => sum + val, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / magnitudes.length;
    
    return variance;
  }

  /**
   * 计算旋转强度
   */
  calculateRotationIntensity() {
    const gyros = this.buffer.gyroscope;
    if (gyros.length === 0) 
        return 0;

    const intensities = gyros.map(g => {
      return Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    });

    return Math.max(...intensities);
  }

  /**
   * 步伐检测算法
   */
  detectSteps() {
    if (!this.state.isWalking || this.buffer.accelerometer.length < 3) 
        return;

    const currentTime = this.buffer.timestamps[this.buffer.timestamps.length - 1];
    const currentAccel = this.buffer.accelerometer[this.buffer.accelerometer.length - 1];
    
    // 计算加速度模量
    const magnitude = Math.sqrt(
      currentAccel.x * currentAccel.x +
      currentAccel.y * currentAccel.y +
      currentAccel.z * currentAccel.z
    );

    // 步伐检测条件
    const timeSinceLastStep = currentTime - this.history.lastStepTime;
    const isPeak = this.isAccelerationPeak(magnitude);
    const validInterval = timeSinceLastStep > this.params.minStepInterval && 
                         timeSinceLastStep < this.params.maxStepInterval;

    if (isPeak && validInterval && magnitude > this.params.stepThreshold) {
      this.onStepDetected(currentTime);
    }
  }

  /**
   * 检测加速度峰值
   */
  isAccelerationPeak(currentMagnitude) {
    if (this.buffer.accelerometer.length < 3) return false;

    const prevMagnitude = this.calculateMagnitude(
      this.buffer.accelerometer[this.buffer.accelerometer.length - 2]
    );
    const nextMagnitude = this.calculateMagnitude(
      this.buffer.accelerometer[this.buffer.accelerometer.length - 3]
    );

    return currentMagnitude > prevMagnitude && currentMagnitude > nextMagnitude;
  }

  /**
   * 计算加速度模量
   */
  calculateMagnitude(accel) {
    return Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
  }

  /**
   * 步伐检测回调
   */
  onStepDetected(timestamp) {
    this.state.stepCount++;
    this.history.lastStepTime = timestamp;

    // 更新距离估算
    this.updateDistance();

    // 更新速度估算
    this.updateSpeed();
  }

  /**
   * 更新移动距离
   */
  updateDistance() {
    this.state.distance += this.params.avgStepLength;
  }

  /**
   * 更新移动速度
   */
  updateSpeed() {
    const currentTime = Date.now();
    if (this.state.stepCount > 1) {
      const timeDiff = (currentTime - this.history.lastStepTime) / 1000; // 转换为秒
      if (timeDiff > 0) {
        this.state.speed = this.params.avgStepLength / timeDiff;
        
        // 速度平滑处理
        this.state.speed = Math.min(this.state.speed, 5); // 限制最大速度5m/s
      }
    }
  }

  /**
   * 判断移动方向（前进/后退）
   */
  determineDirection() {
    if (!this.state.isWalking) {
      this.state.direction = 'stationary';
      return;
    }

    // 分析加速度特征判断方向
    const accels = this.buffer.accelerometer;
    if (accels.length < 5) return;

    // 计算Z轴加速度趋势（手机垂直方向）
    const zTrend = this.calculateAccelerationTrend('z');
    
    // 计算运动的主要频率特征
    const frequencyAnalysis = this.analyzeFrequency();

    if (zTrend > 0.1 && frequencyAnalysis.consistency > 0.7) {
      this.state.direction = 'forward';
    } else if (zTrend < -0.1 && frequencyAnalysis.consistency > 0.7) {
      this.state.direction = 'backward';
    } else {
      this.state.direction = 'uncertain';
    }
  }

  /**
   * 计算加速度趋势
   */
  calculateAccelerationTrend(axis) {
    const accels = this.buffer.accelerometer;
    const values = accels.map(a => a[axis]);
    
    // 简单线性趋势计算
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = values.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * 分析运动频率一致性
   */
  analyzeFrequency() {
    // 简化的频率一致性分析
    const magnitudes = this.buffer.accelerometer.map(a => this.calculateMagnitude(a));
    const mean = magnitudes.reduce((a, b) => a + b) / magnitudes.length;
    const variance = magnitudes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / magnitudes.length;
    
    return {
      consistency: Math.max(0, 1 - variance * 10) // 方差越小一致性越高
    };
  }

  /**
   * 移动开始回调
   */
  onMovementStart() {
    console.log('Movement started');
    // 可以在这里添加开始移动的处理逻辑
  }

  /**
   * 移动停止回调
   */
  onMovementStop() {
    console.log('Movement stopped');
    // 重置速度但保持距离
    this.state.speed = 0;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      ...this.state,
      timestamp: Date.now()
    };
  }

  /**
   * 重置检测器
   */
  reset() {
    this.state = {
      isMoving: false,
      isWalking: false,
      direction: 'stationary',
      distance: 0,
      stepCount: 0,
      speed: 0
    };
    
    this.buffer = {
      accelerometer: [],
      gyroscope: [],
      timestamps: []
    };
    
    this.history = {
      lastStepTime: 0,
      lastAcceleration: { x: 0, y: 0, z: 0 },
      filteredAcceleration: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * 更新算法参数
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
  }
}

module.exports = MotionDetection;
```

### 3. 主页面文件

**pages/index/index.wxml**
```xml
<view class="container">
  <view class="status-card">
    <text class="card-title">运动状态监测</text>
    
    <view class="status-item">
      <text class="label">移动状态:</text>
      <text class="value {{motionState.isMoving ? 'active' : 'inactive'}}">
        {{motionState.isMoving ? '移动中' : '静止'}}
      </text>
    </view>
    
    <view class="status-item">
      <text class="label">行走状态:</text>
      <text class="value {{motionState.isWalking ? 'walking' : 'inactive'}}">
        {{motionState.isWalking ? '行走中' : '未行走'}}
      </text>
    </view>
    
    <view class="status-item">
      <text class="label">移动方向:</text>
      <text class="value direction-{{motionState.direction}}">
        {{directionText}}
      </text>
    </view>
  </view>

  <view class="data-card">
    <text class="card-title">实时数据</text>
    
    <view class="data-grid">
      <view class="data-item">
        <text class="data-value">{{motionState.distance.toFixed(2)}}</text>
        <text class="data-label">距离(米)</text>
      </view>
      
      <view class="data-item">
        <text class="data-value">{{motionState.speed.toFixed(2)}}</text>
        <text class="data-label">速度(m/s)</text>
      </view>
      
      <view class="data-item">
        <text class="data-value">{{motionState.stepCount}}</text>
        <text class="data-label">步数</text>
      </view>
    </view>
  </view>

  <view class="sensor-card">
    <text class="card-title">传感器数据</text>
    
    <view class="sensor-data">
      <text>加速度: X:{{sensorData.accel.x.toFixed(3)}} Y:{{sensorData.accel.y.toFixed(3)}} Z:{{sensorData.accel.z.toFixed(3)}}</text>
      <text>陀螺仪: X:{{sensorData.gyro.x.toFixed(3)}} Y:{{sensorData.gyro.y.toFixed(3)}} Z:{{sensorData.gyro.z.toFixed(3)}}</text>
    </view>
  </view>

  <view class="control-card">
    <button class="control-btn {{isMonitoring ? 'stop' : 'start'}}" 
            bindtap="toggleMonitoring">
      {{isMonitoring ? '停止监测' : '开始监测'}}
    </button>
    
    <button class="control-btn reset" bindtap="resetData">重置数据</button>
    
    <button class="control-btn settings" bindtap="showSettings">参数设置</button>
  </view>

  <!-- 参数设置面板 -->
  <view class="settings-panel {{showSettingsPanel ? 'show' : ''}}">
    <view class="settings-content">
      <text class="settings-title">算法参数调整</text>
      
      <view class="param-item">
        <text class="param-label">步伐阈值: {{params.stepThreshold}}</text>
        <slider value="{{params.stepThreshold}}" min="0.5" max="2.0" step="0.1" 
                bindchange="onStepThresholdChange"/>
      </view>
      
      <view class="param-item">
        <text class="param-label">行走阈值: {{params.walkThreshold}}</text>
        <slider value="{{params.walkThreshold}}" min="0.05" max="0.3" step="0.01" 
                bindchange="onWalkThresholdChange"/>
      </view>
      
      <view class="param-item">
        <text class="param-label">平均步长: {{params.avgStepLength}}米</text>
        <slider value="{{params.avgStepLength}}" min="0.5" max="1.0" step="0.05" 
                bindchange="onStepLengthChange"/>
      </view>
      
      <button class="control-btn confirm" bindtap="hideSettings">确认</button>
    </view>
  </view>
</view>
```

**pages/index/index.wxss**
```css
.container {
  padding: 20rpx;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.status-card, .data-card, .sensor-card, .control-card {
  background: white;
  border-radius: 20rpx;
  padding: 30rpx;
  margin: 20rpx 0;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1);
}

.card-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
  display: block;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20rpx 0;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 10rpx;
}

.label {
  font-size: 32rpx;
  color: #666;
}

.value {
  font-size: 32rpx;
  font-weight: bold;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
}

.value.active {
  background: #4CAF50;
  color: white;
}

.value.inactive {
  background: #9E9E9E;
  color: white;
}

.value.walking {
  background: #2196F3;
  color: white;
}

.direction-forward {
  background: #4CAF50;
  color: white;
}

.direction-backward {
  background: #FF9800;
  color: white;
}

.direction-stationary {
  background: #9E9E9E;
  color: white;
}

.direction-uncertain {
  background: #FFC107;
  color: white;
}

.data-grid {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.data-item {
  flex: 1;
  padding: 20rpx;
}

.data-value {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #2196F3;
}

.data-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-top: 10rpx;
}

.sensor-data {
  background: #f8f9fa;
  padding: 20rpx;
  border-radius: 10rpx;
}

.sensor-data text {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin: 10rpx 0;
  font-family: 'Courier New', monospace;
}

.control-card {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
}

.control-btn {
  margin: 10rpx;
  padding: 20rpx 40rpx;
  border: none;
  border-radius: 50rpx;
  color: white;
  font-size: 32rpx;
  font-weight: bold;
  min-width: 200rpx;
}

.control-btn.start {
  background: #4CAF50;
}

.control-btn.stop {
  background: #F44336;
}

.control-btn.reset {
  background: #FF9800;
}

.control-btn.settings {
  background: #2196F3;
}

.control-btn.confirm {
  background: #4CAF50;
  width: 100%;
  margin-top: 40rpx;
}

.settings-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s;
}

.settings-panel.show {
  opacity: 1;
  visibility: visible;
}

.settings-content {
  background: white;
  width: 80%;
  border-radius: 20rpx;
  padding: 40rpx;
  transform: translateY(50rpx);
  transition: transform 0.3s;
}

.settings-panel.show .settings-content {
  transform: translateY(0);
}

.settings-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 40rpx;
  display: block;
}

.param-item {
  margin: 40rpx 0;
}

.param-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
}
```

**pages/index/index.js**
```javascript
const MotionDetection = require('../../utils/motionDetection.js');

Page({
  data: {
    isMonitoring: false,
    motionState: {
      isMoving: false,
      isWalking: false,
      direction: 'stationary',
      distance: 0,
      stepCount: 0,
      speed: 0
    },
    sensorData: {
      accel: { x: 0, y: 0, z: 0 },
      gyro: { x: 0, y: 0, z: 0 }
    },
    directionText: '静止',
    showSettingsPanel: false,
    params: {
      stepThreshold: 1.2,
      walkThreshold: 0.15,
      avgStepLength: 0.7
    }
  },

  onLoad() {
    this.motionDetector = new MotionDetection();
  },

  onUnload() {
    this.stopMonitoring();
  },

  // 开始/停止监测
  toggleMonitoring() {
    if (this.data.isMonitoring) {
      this.stopMonitoring();
    } else {
      this.startMonitoring();
    }
  },

  // 开始监测
  startMonitoring() {
    const that = this;
    
    // 启动加速度计
    wx.startAccelerometer({
      interval: 'game',
      success: () => {
        console.log('加速度计启动成功');
        
        // 启动陀螺仪
        wx.startGyroscope({
          interval: 'game',
          success: () => {
            console.log('陀螺仪启动成功');
            that.setData({ isMonitoring: true });
            that.setupSensorListeners();
          },
          fail: (err) => {
            console.error('陀螺仪启动失败:', err);
            wx.showToast({ title: '陀螺仪启动失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('加速度计启动失败:', err);
        wx.showToast({ title: '加速度计启动失败', icon: 'none' });
      }
    });
  },

  // 停止监测
  stopMonitoring() {
    wx.stopAccelerometer();
    wx.stopGyroscope();
    this.setData({ isMonitoring: false });
  },

  // 设置传感器监听
  setupSensorListeners() {
    const that = this;
    
    // 加速度计数据监听
    wx.onAccelerometerChange((res) => {
      that.setData({
        'sensorData.accel': res
      });
      
      // 处理传感器数据
      that.processSensorData();
    });
    
    // 陀螺仪数据监听
    wx.onGyroscopeChange((res) => {
      that.setData({
        'sensorData.gyro': res
      });
    });
  },

  // 处理传感器数据
  processSensorData() {
    const motionState = this.motionDetector.processSensorData(
      this.data.sensorData.accel,
      this.data.sensorData.gyro,
      Date.now()
    );
    
    this.setData({
      motionState: motionState,
      directionText: this.getDirectionText(motionState.direction)
    });
  },

  // 获取方向文本
  getDirectionText(direction) {
    const texts = {
      'stationary': '静止',
      'forward': '前进',
      'backward': '后退',
      'uncertain': '方向不确定'
    };
    return texts[direction] || '未知';
  },

  // 重置数据
  resetData() {
    this.motionDetector.reset();
    this.setData({
      motionState: {
        isMoving: false,
        isWalking: false,
        direction: 'stationary',
        distance: 0,
        stepCount: 0,
        speed: 0
      }
    });
  },

  // 显示设置面板
  showSettings() {
    this.setData({ showSettingsPanel: true });
  },

  // 隐藏设置面板
  hideSettings() {
    this.setData({ showSettingsPanel: false });
  },

  // 参数变更处理
  onStepThresholdChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.stepThreshold': value
    });
    this.motionDetector.updateParams({ stepThreshold: value });
  },

  onWalkThresholdChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.walkThreshold': value
    });
    this.motionDetector.updateParams({ walkThreshold: value });
  },

  onStepLengthChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.avgStepLength': value
    });
    this.motionDetector.updateParams({ avgStepLength: value });
  }
});
```

**pages/index/index.json**
```json
{
  "usingComponents": {},
  "navigationBarTitleText": "行人移动检测"
}
```

### 4. 应用配置文件

**app.json**
```json
{
  "pages": [
    "pages/index/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#2196F3",
    "navigationBarTitleText": "移动检测小程序",
    "navigationBarTextStyle": "white"
  },
  "requiredPrivateInfos": [
    "onAccelerometerChange",
    "onGyroscopeChange"
  ],
  "permission": {
    "scope.userLocation": {
      "desc": "用于运动检测功能"
    }
  }
}
```

## 算法特点说明

### 1. 移动检测原理
- **加速度方差分析**：检测整体运动强度
- **陀螺仪活动度**：排除原地旋转动作
- **步伐模式识别**：通过加速度峰值检测真实步伐

### 2. 方向判断
- **Z轴趋势分析**：通过垂直方向加速度判断前后移动
- **频率一致性**：确保是规律的行走模式

### 3. 距离估算
- **步数统计**：基于加速度峰值检测
- **步长估算**：使用可配置的平均步长参数
- **速度计算**：基于步伐间隔时间

### 4. 参数调优建议

```javascript
// 不同使用场景的参数建议
const presets = {
  // 口袋模式（默认）
  pocket: { stepThreshold: 1.2, walkThreshold: 0.15, avgStepLength: 0.7 },
  
  // 手持模式
  handhold: { stepThreshold: 1.0, walkThreshold: 0.12, avgStepLength: 0.6 },
  
  // 跑步模式  
  running: { stepThreshold: 1.5, walkThreshold: 0.2, avgStepLength: 1.0 }
};
```

## 使用说明

1. 在微信开发者工具中导入项目
2. 确保在app.json中声明传感器权限
3. 点击"开始监测"启动传感器
4. 根据实际使用场景调整算法参数
5. 测试不同移动模式（行走、跑步、原地动作）

## 注意事项

- 算法效果受手机放置方式和步行习惯影响
- 需要在实际环境中校准参数以获得最佳效果
- 室内定位精度有限，主要用于相对距离估算

这个小程序提供了完整的行人移动检测功能，可以根据实际需求进一步优化算法参数。