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

    // ------------------------------------------------------
    // for drawing trajectory based on gyroData and accelData.
    // ------------------------------------------------------
    // 运动状态
    this.position = { x: 0, y: 0, z: 0 };     // 位置 (米)
    this.velocity = { x: 0, y: 0, z: 0 };     // 速度 (米/秒)
    this.orientation = { roll: 0, pitch: 0, yaw: 0 }; // 姿态角 (弧度)
    
    // 传感器数据缓冲区
    // this.accelBuffer = []; 
    
    // 时间记录
    this.lastTimestamp = null;
    this.startTime = Date.now();
    
    // 轨迹历史
    this.trajectory = [];
    
    // 卡尔曼滤波器参数
    // this.kalmanFilter = this.initKalmanFilter();    
  }

  /**
   * 处理传感器数据
   */
  processSensorData(accelerometer, gyroscope, timestamp) {
    console.log("processSensorData() start")
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

    // 6. 更新 trajectory
    this.upateTrajectory(processedGyro, processedGyro,timestamp)
    console.log("processSensorData() end")
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
    console.log("analyzeMotion variance="+variance);

    // 计算陀螺仪活动度（旋转强度）
    const rotationIntensity = this.calculateRotationIntensity();
    console.log("analyzeMotion rotationIntensity="+rotationIntensity);

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
    if (accels.length < 5) 
      return;

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

    // ------ trajectory ------
    this.position = { x: 0, y: 0, z: 0 };     // 位置 (米)
    this.velocity = { x: 0, y: 0, z: 0 };     // 速度 (米/秒)
    this.orientation = { roll: 0, pitch: 0, yaw: 0 }; // 姿态角 (弧度)
    
    // 传感器数据缓冲区
    // this.accelBuffer = []; 
    
    // 时间记录
    this.lastTimestamp = null;
    this.startTime = Date.now();
    
    // 轨迹历史
    this.trajectory = [];    
  }

  /**
   * 更新算法参数
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
  }

// ---------------------------------------------
// for drawing trajectory based on gyroData and accelData.
// ---------------------------------------------
upateTrajectory(gyroData, accelData, timestamp ){
    this.updateOrientation(gyroData, accelData, timestamp);
    this.updatePosition(accelData);
}

// ### 2. 传感器数据融合算法   
// 使用互补滤波融合加速度计和陀螺仪数据
updateOrientation(gyroData, accelData, timestamp) {
  if (!this.lastTimestamp) {
    this.lastTimestamp = timestamp;
    return;
  }
  
  const dt = (timestamp - this.lastTimestamp) / 1000; // 转换为秒
  this.lastTimestamp = timestamp;
  
  // 1. 陀螺仪积分得到角度变化
  const gyroOrientation = {
    roll: this.orientation.roll + gyroData.x * dt,
    pitch: this.orientation.pitch + gyroData.y * dt, 
    yaw: this.orientation.yaw + gyroData.z * dt
  };
  
  // 2. 从加速度计计算姿态角（去除重力影响）
  const accelOrientation = this.calculateOrientationFromAccel(accelData);
  
  // 3. 互补滤波融合
  const alpha = 0.98; // 陀螺仪权重
  this.orientation = {
    roll: alpha * gyroOrientation.roll + (1 - alpha) * accelOrientation.roll,
    pitch: alpha * gyroOrientation.pitch + (1 - alpha) * accelOrientation.pitch,
    yaw: gyroOrientation.yaw // 磁力计缺失时，yaw角主要依赖陀螺仪
  };
}

// 从加速度计计算姿态角
calculateOrientationFromAccel(accel) {
  const { x, y, z } = accel;
  
  // 计算俯仰角(pitch)和横滚角(roll)
  const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z));
  const roll = Math.atan2(y, z);
  
  return { roll, pitch, yaw: 0 }; // yaw无法从加速度计获得
}

// ### 3. 位移计算（核心算法）
// 双重积分计算位移
updatePosition(accelData) {
  if (!this.lastTimestamp) 
    return;
  
  const dt = (Date.now() - this.lastTimestamp) / 1000;
  
  // 1. 将加速度从设备坐标系转换到世界坐标系
  const worldAccel = this.deviceToWorldCoordinates(accelData);
  
  // 2. 减去重力加速度（约9.8 m/s²）
  const linearAccel = this.removeGravity(worldAccel);
  
  // 3. 第一次积分得到速度
  this.velocity.x += linearAccel.x * dt;
  this.velocity.y += linearAccel.y * dt; 
  this.velocity.z += linearAccel.z * dt;
  
  // 4. 第二次积分得到位移
  this.position.x += this.velocity.x * dt;
  this.position.y += this.velocity.y * dt;
  this.position.z += this.velocity.z * dt;
  
  // 5. 应用零速度修正（减少漂移）
  this.applyZeroVelocityUpdate();
  
  // 6. 记录轨迹点
  this.trajectory.push({
    x: this.position.x,
    y: this.position.y,
    z: this.position.z,
    timestamp: Date.now()
  });
  
  // 限制轨迹长度
  if (this.trajectory.length > 1000) {
    this.trajectory.shift();
  }
}

// 坐标系转换
deviceToWorldCoordinates(accel) {
  const { roll, pitch, yaw } = this.orientation;
  
  // 简化版旋转矩阵计算
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  
  return {
    x: accel.x * cosPitch + accel.z * sinPitch,
    y: accel.x * sinRoll * sinPitch + accel.y * cosRoll - accel.z * sinRoll * cosPitch,
    z: -accel.x * cosRoll * sinPitch + accel.y * sinRoll + accel.z * cosRoll * cosPitch
  };
}

// 去除重力影响
removeGravity(worldAccel) {
  const gravity = 9.8;
  return {
    x: worldAccel.x,
    y: worldAccel.y, 
    z: worldAccel.z - gravity  // 假设Z轴垂直向上
  };
} 

// ### 4. 零速度修正算法（关键抗漂移技术）

// 检测静止状态并修正速度漂移
applyZeroVelocityUpdate() {
  // 检测静止状态（通过加速度幅度方差）
  const isStationary = this.detectStationaryState();
  
  if (isStationary) {
    // 重置速度，减少积分漂移
    this.velocity.x *= 0.1;
    this.velocity.y *= 0.1;
    this.velocity.z *= 0.1;
    
    console.log('零速度修正应用');
  }
}

// 通过加速度方差检测静止状态
detectStationaryState() {
  if (this.buffer.accelerometer.length < 10) 
    return false;
  
  // 计算最近加速度数据的方差
  const recentAccel = this.buffer.accelerometer.slice(-10);
  const magnitudes = recentAccel.map(a => 
    Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z)
  );
  
  const mean = magnitudes.reduce((sum, m) => sum + m, 0) / magnitudes.length;
  const variance = magnitudes.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / magnitudes.length;
  
  // 方差小于阈值则认为静止
  return variance < 0.1;
}

getPosition(){
  // 返回新对象，避免外部直接修改内部数据
  return { ...this.position };
}

getTrajectory()
{
  return this.trajectory;
}
 
}

module.exports = MotionDetection;
