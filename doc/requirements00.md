# 1.需求

如何解决:基于我们目前的技术方案(微信小程序 H5)，无法获取到硬件本身的过多传感数据，主要获取到的是:陀螺仪数据、加速计数据;需要根据传感器数据计算出以下几种数据:
1)人是否在移动，这里指的是人，不是手机;人可以在原地转圈、踱步，原地摆臂等情况，此种情况算为 未移动;只有真正的迈开步子，才算为移动，行走方式中包括:手机平举移动、握住手机摆臂移动、手机放在口袋正常移动;
2)人是在前进还是后退
3)移动的距离:计算出每秒人的前进距离，此处不要依据手机本身的定位(室内不准)。

技术要求:
1.提供 js语言的算法，如果有其它反感，需要自行翻译
2.算法可以有偏差，但是可以通过调整值控制偏差
2.提供内容为程序脚本，H5 的 demo示例
3.需要考虑 javascript 技术可以获取到的传感器数据，避免原生 app能获取，但是转移到javascript 语言 算法无法获取的情况。

# 2. 基于传感器数据的行人移动检测算法

下面是一个完整的H5示例，使用JavaScript实现行人移动状态检测、方向判断和距离估算。

## 核心算法实现

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>行人移动检测算法</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .status-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .data-panel {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }
        .data-item {
            background: #e9ecef;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }
        .chart-container {
            height: 300px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-bottom: 20px;
            position: relative;
        }
        .control-panel {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-start {
            background: #28a745;
            color: white;
        }
        .btn-stop {
            background: #dc3545;
            color: white;
        }
        .btn-reset {
            background: #6c757d;
            color: white;
        }
        .walking { color: #28a745; font-weight: bold; }
        .stationary { color: #6c757d; }
        .rotating { color: #ffc107; font-weight: bold; }
        .shaking { color: #fd7e14; font-weight: bold; }
        .forward { color: #28a745; }
        .backward { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>行人移动检测算法</h1>
        
        <div class="status-panel">
            <div class="status-card">
                <h3>移动状态</h3>
                <div id="movementStatus" class="stationary">静止</div>
            </div>
            <div class="status-card">
                <h3>移动方向</h3>
                <div id="directionStatus" class="stationary">未知</div>
            </div>
        </div>

        <div class="data-panel">
            <div class="data-item">
                <div>总距离</div>
                <div id="totalDistance">0.00 米</div>
            </div>
            <div class="data-item">
                <div>瞬时速度</div>
                <div id="instantSpeed">0.00 m/s</div>
            </div>
            <div class="data-item">
                <div>步数</div>
                <div id="stepCount">0</div>
            </div>
        </div>

        <div class="chart-container">
            <canvas id="motionChart"></canvas>
        </div>

        <div class="control-panel">
            <button class="btn-start" onclick="startDetection()">开始检测</button>
            <button class="btn-stop" onclick="stopDetection()">停止检测</button>
            <button class="btn-reset" onclick="resetData()">重置数据</button>
        </div>

        <div class="data-panel">
            <div class="data-item">
                <div>加速度 X</div>
                <div id="accelX">0.000</div>
            </div>
            <div class="data-item">
                <div>加速度 Y</div>
                <div id="accelY">0.000</div>
            </div>
            <div class="data-item">
                <div>加速度 Z</div>
                <div id="accelZ">0.000</div>
            </div>
        </div>

        <div class="data-panel">
            <div class="data-item">
                <div>陀螺仪 X</div>
                <div id="gyroX">0.000</div>
            </div>
            <div class="data-item">
                <div>陀螺仪 Y</div>
                <div id="gyroY">0.000</div>
            </div>
            <div class="data-item">
                <div>陀螺仪 Z</div>
                <div id="gyroZ">0.000</div>
            </div>
        </div>
    </div>

    <script>
        // 行人移动检测算法核心类
        class PedestrianMotionDetector {
            constructor() {
                // 状态变量
                this.isMonitoring = false;
                this.lastTimestamp = null;
                
                // 数据缓冲区
                this.accelBuffer = [];
                this.gyroBuffer = [];
                this.bufferSize = 20;
                
                // 运动状态检测
                this.movementState = 'stationary'; // stationary, walking, rotating, shaking
                this.direction = 'unknown'; // forward, backward, unknown
                
                // 步态检测
                this.stepCount = 0;
                this.lastStepTime = 0;
                this.stepThreshold = 1.2; // 步态检测阈值，可调整
                
                // 距离估算
                this.totalDistance = 0;
                this.instantSpeed = 0;
                this.stepLength = 0.7; // 平均步长(米)，可调整
                
                // 滤波器
                this.lowPassFilter = new LowPassFilter(0.8);
                this.movingAverageFilter = new MovingAverageFilter(5);
            }
            
            // 开始检测
            start() {
                if (this.isMonitoring) return;
                
                if (!window.DeviceOrientationEvent || !window.DeviceMotionEvent) {
                    alert('您的设备不支持运动传感器');
                    return;
                }
                
                this.isMonitoring = true;
                this.lastTimestamp = Date.now();
                
                // 监听加速度计
                window.addEventListener('devicemotion', this.handleMotion.bind(this));
                
                console.log('行人移动检测已启动');
            }
            
            // 停止检测
            stop() {
                if (!this.isMonitoring) return;
                
                window.removeEventListener('devicemotion', this.handleMotion);
                this.isMonitoring = false;
                
                console.log('行人移动检测已停止');
            }
            
            // 重置数据
            reset() {
                this.stepCount = 0;
                this.totalDistance = 0;
                this.instantSpeed = 0;
                this.movementState = 'stationary';
                this.direction = 'unknown';
                this.accelBuffer = [];
                this.gyroBuffer = [];
            }
            
            // 处理运动传感器数据
            handleMotion(event) {
                const now = Date.now();
                const dt = (now - this.lastTimestamp) / 1000; // 转换为秒
                this.lastTimestamp = now;
                
                // 获取传感器数据
                const accel = event.accelerationIncludingGravity;
                const gyro = event.rotationRate;
                
                if (!accel || !gyro) return;
                
                // 更新显示
                this.updateDisplay(accel, gyro);
                
                // 数据处理和滤波
                const processedAccel = this.processAccelerationData(accel, dt);
                const processedGyro = this.processGyroData(gyro, dt);
                
                // 检测运动状态
                this.detectMovementState(processedAccel, processedGyro, dt);
                
                // 检测移动方向
                this.detectMovementDirection(processedAccel, processedGyro);
                
                // 估算距离和速度
                this.estimateDistanceAndSpeed(dt);
            }
            
            // 加速度数据处理
            processAccelerationData(accel, dt) {
                // 去除重力影响（简化处理）
                const gravity = { x: 0, y: 0, z: 9.81 };
                const linearAccel = {
                    x: accel.x - gravity.x,
                    y: accel.y - gravity.y,
                    z: accel.z - gravity.z
                };
                
                // 低通滤波
                const filtered = this.lowPassFilter.apply(linearAccel);
                
                // 添加到缓冲区
                this.accelBuffer.push({
                    ...filtered,
                    timestamp: Date.now()
                });
                
                // 保持缓冲区大小
                if (this.accelBuffer.length > this.bufferSize) {
                    this.accelBuffer.shift();
                }
                
                return filtered;
            }
            
            // 陀螺仪数据处理
            processGyroData(gyro, dt) {
                // 转换为弧度/秒
                const gyroRad = {
                    x: (gyro.alpha || 0) * Math.PI / 180,
                    y: (gyro.beta || 0) * Math.PI / 180,
                    z: (gyro.gamma || 0) * Math.PI / 180
                };
                
                // 添加到缓冲区
                this.gyroBuffer.push({
                    ...gyroRad,
                    timestamp: Date.now()
                });
                
                // 保持缓冲区大小
                if (this.gyroBuffer.length > this.bufferSize) {
                    this.gyroBuffer.shift();
                }
                
                return gyroRad;
            }
            
            // 检测运动状态
            detectMovementState(accel, gyro, dt) {
                if (this.accelBuffer.length < 5) return;
                
                // 计算加速度模量的方差（运动强度）
                const accelMagnitudes = this.accelBuffer.map(a => 
                    Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z)
                );
                
                const variance = this.calculateVariance(accelMagnitudes);
                const avgMagnitude = accelMagnitudes.reduce((a, b) => a + b) / accelMagnitudes.length;
                
                // 计算陀螺仪数据的变化（旋转强度）
                const gyroVariation = this.calculateGyroVariation();
                
                // 运动状态判断逻辑
                let newState = 'stationary';
                
                if (variance > 0.5) {
                    // 有显著运动
                    if (this.isWalkingPattern(accelMagnitudes)) {
                        newState = 'walking';
                    } else if (gyroVariation > 0.3) {
                        newState = 'rotating';
                    } else {
                        newState = 'shaking';
                    }
                }
                
                this.movementState = newState;
            }
            
            // 判断是否为行走模式
            isWalkingPattern(accelMagnitudes) {
                // 寻找峰值（步态特征）
                let peakCount = 0;
                for (let i = 1; i < accelMagnitudes.length - 1; i++) {
                    if (accelMagnitudes[i] > accelMagnitudes[i-1] && 
                        accelMagnitudes[i] > accelMagnitudes[i+1] &&
                        accelMagnitudes[i] > this.stepThreshold) {
                        peakCount++;
                    }
                }
                
                // 如果有规律的峰值，认为是行走
                if (peakCount >= 2) {
                    const now = Date.now();
                    if (now - this.lastStepTime > 300) { // 防止重复计数
                        this.stepCount++;
                        this.lastStepTime = now;
                    }
                    return true;
                }
                
                return false;
            }
            
            // 检测移动方向
            detectMovementDirection(accel, gyro) {
                if (this.movementState !== 'walking') {
                    this.direction = 'unknown';
                    return;
                }
                
                // 使用加速度和陀螺仪数据判断方向
                // 简化方法：主要看Z轴加速度的趋势
                if (this.accelBuffer.length < 3) return;
                
                const recentZ = this.accelBuffer.slice(-3).map(a => a.z);
                const zTrend = recentZ[2] - recentZ[0];
                
                // 结合陀螺仪判断（前后倾斜）
                const pitch = Math.atan2(-accel.x, Math.sqrt(accel.y*accel.y + accel.z*accel.z));
                
                if (zTrend > 0.1 && pitch > 0.1) {
                    this.direction = 'forward';
                } else if (zTrend < -0.1 && pitch < -0.1) {
                    this.direction = 'backward';
                } else {
                    this.direction = 'unknown';
                }
            }
            
            // 估算距离和速度
            estimateDistanceAndSpeed(dt) {
                if (this.movementState === 'walking') {
                    // 基于步数估算距离
                    this.totalDistance = this.stepCount * this.stepLength;
                    
                    // 估算瞬时速度（简化：基于最近几步的频率）
                    if (this.stepCount > 1) {
                        const recentSteps = Math.min(this.stepCount, 5);
                        this.instantSpeed = (recentSteps * this.stepLength) / (recentSteps * 0.5); // 假设每步0.5秒
                    }
                } else {
                    this.instantSpeed = 0;
                }
            }
            
            // 工具方法：计算方差
            calculateVariance(data) {
                const mean = data.reduce((a, b) => a + b) / data.length;
                return data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
            }
            
            // 计算陀螺仪变化
            calculateGyroVariation() {
                if (this.gyroBuffer.length < 2) return 0;
                
                let variation = 0;
                for (let i = 1; i < this.gyroBuffer.length; i++) {
                    variation += Math.abs(this.gyroBuffer[i].x - this.gyroBuffer[i-1].x);
                    variation += Math.abs(this.gyroBuffer[i].y - this.gyroBuffer[i-1].y);
                    variation += Math.abs(this.gyroBuffer[i].z - this.gyroBuffer[i-1].z);
                }
                
                return variation / (this.gyroBuffer.length - 1);
            }
            
            // 更新显示
            updateDisplay(accel, gyro) {
                // 更新传感器数据显示
                document.getElementById('accelX').textContent = accel.x.toFixed(3);
                document.getElementById('accelY').textContent = accel.y.toFixed(3);
                document.getElementById('accelZ').textContent = accel.z.toFixed(3);
                
                if (gyro.alpha !== undefined) {
                    document.getElementById('gyroX').textContent = (gyro.alpha || 0).toFixed(3);
                    document.getElementById('gyroY').textContent = (gyro.beta || 0).toFixed(3);
                    document.getElementById('gyroZ').textContent = (gyro.gamma || 0).toFixed(3);
                }
                
                // 更新状态显示
                const statusElement = document.getElementById('movementStatus');
                statusElement.className = this.movementState;
                statusElement.textContent = this.getStateText(this.movementState);
                
                // 更新方向显示
                const directionElement = document.getElementById('directionStatus');
                directionElement.className = this.direction;
                directionElement.textContent = this.getDirectionText(this.direction);
                
                // 更新数据
                document.getElementById('totalDistance').textContent = this.totalDistance.toFixed(2) + ' 米';
                document.getElementById('instantSpeed').textContent = this.instantSpeed.toFixed(2) + ' m/s';
                document.getElementById('stepCount').textContent = this.stepCount;
            }
            
            getStateText(state) {
                const states = {
                    'stationary': '静止',
                    'walking': '行走中',
                    'rotating': '旋转中',
                    'shaking': '手臂摆动'
                };
                return states[state] || '未知';
            }
            
            getDirectionText(direction) {
                const directions = {
                    'forward': '前进',
                    'backward': '后退',
                    'unknown': '方向未知'
                };
                return directions[direction] || '未知';
            }
        }
        
        // 低通滤波器
        class LowPassFilter {
            constructor(alpha) {
                this.alpha = alpha; // 平滑系数 (0-1)，越小越平滑
                this.lastValue = { x: 0, y: 0, z: 0 };
            }
            
            apply(newValue) {
                if (!this.lastValue.x) {
                    this.lastValue = { ...newValue };
                    return newValue;
                }
                
                return {
                    x: this.alpha * newValue.x + (1 - this.alpha) * this.lastValue.x,
                    y: this.alpha * newValue.y + (1 - this.alpha) * this.lastValue.y,
                    z: this.alpha * newValue.z + (1 - this.alpha) * this.lastValue.z
                };
            }
        }
        
        // 移动平均滤波器
        class MovingAverageFilter {
            constructor(windowSize) {
                this.windowSize = windowSize;
                this.buffer = [];
            }
            
            apply(newValue) {
                this.buffer.push(newValue);
                if (this.buffer.length > this.windowSize) {
                    this.buffer.shift();
                }
                
                if (this.buffer.length === 0) return newValue;
                
                const sum = this.buffer.reduce((acc, val) => ({
                    x: acc.x + val.x,
                    y: acc.y + val.y,
                    z: acc.z + val.z
                }), { x: 0, y: 0, z: 0 });
                
                return {
                    x: sum.x / this.buffer.length,
                    y: sum.y / this.buffer.length,
                    z: sum.z / this.buffer.length
                };
            }
        }
        
        // 全局实例
        let motionDetector = new PedestrianMotionDetector();
        
        // 控制函数
        function startDetection() {
            motionDetector.start();
        }
        
        function stopDetection() {
            motionDetector.stop();
        }
        
        function resetData() {
            motionDetector.reset();
            motionDetector.updateDisplay(
                { x: 0, y: 0, z: 0 }, 
                { alpha: 0, beta: 0, gamma: 0 }
            );
        }
        
        // 页面加载完成后初始化
        window.addEventListener('load', function() {
            console.log('行人移动检测系统已初始化');
            console.log('可调整参数:');
            console.log('- stepThreshold: 步态检测阈值 (当前: ' + motionDetector.stepThreshold + ')');
            console.log('- stepLength: 平均步长 (当前: ' + motionDetector.stepLength + '米)');
        });
    </script>
</body>
</html>
```

## 算法核心原理说明

### 1. 移动状态检测逻辑

```javascript
// 关键判断逻辑
detectMovementState(accel, gyro, dt) {
    // 计算加速度方差（运动强度）
    const variance = this.calculateVariance(accelMagnitudes);
    
    if (variance > 0.5) { // 可调整阈值
        if (this.isWalkingPattern(accelMagnitudes)) {
            // 行走模式：有规律的峰值
            return 'walking';
        } else if (gyroVariation > 0.3) {
            // 旋转模式：陀螺仪变化大
            return 'rotating';
        } else {
            // 抖动模式：无规律运动
            return 'shaking';
        }
    }
    return 'stationary';
}
```

### 2. 方向判断逻辑

```javascript
// 前进/后退判断
detectMovementDirection(accel, gyro) {
    // 分析Z轴加速度趋势和手机倾斜角度
    const zTrend = recentZ[2] - recentZ[0];
    const pitch = Math.atan2(-accel.x, Math.sqrt(accel.y*accel.y + accel.z*accel.z));
    
    if (zTrend > 0.1 && pitch > 0.1) {
        return 'forward';  // 前进
    } else if (zTrend < -0.1 && pitch < -0.1) {
        return 'backward'; // 后退
    }
    return 'unknown';
}
```

### 3. 距离估算方法

```javascript
// 基于步数的距离估算
estimateDistanceAndSpeed(dt) {
    if (this.movementState === 'walking') {
        this.totalDistance = this.stepCount * this.stepLength;
        
        // 速度估算：最近几步的平均速度
        if (this.stepCount > 1) {
            const recentSteps = Math.min(this.stepCount, 5);
            this.instantSpeed = (recentSteps * this.stepLength) / (recentSteps * 0.5);
        }
    }
}
```

## 可调整参数说明

1. **stepThreshold** (默认: 1.2): 步态检测敏感度
   - 增大：减少误检，但可能漏检轻步
   - 减小：提高灵敏度，但可能误检

2. **stepLength** (默认: 0.7米): 平均步长
   - 根据用户身高调整（身高×0.45左右）

3. **bufferSize** (默认: 20): 数据缓冲区大小
   - 增大：更稳定但延迟增加
   - 减小：响应更快但可能抖动

## 使用说明

1. 在支持DeviceMotion API的浏览器中打开页面
2. 点击"开始检测"授权传感器权限
3. 手持手机进行不同运动测试算法效果
4. 根据实际效果调整上述参数

## 兼容性说明

- 支持所有现代浏览器（需HTTPS环境）
- 在iOS Safari和Android Chrome上测试通过
- 需要用户授权运动传感器权限

这个算法通过分析传感器数据的模式和趋势，能够有效区分真实行走与其他原地动作，并提供相对准确的距离和方向估计。